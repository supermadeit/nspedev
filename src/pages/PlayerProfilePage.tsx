// {database} player profile — reads /database/:slug live from the backend
// (GET /database/{slug}, tries the batter builder then falls back to QB,
// 404 if neither hits — see nspedev-live-architecture-pivot in memory).
// Renders the shared section-driven contract from @/components/
// ProfileSections (also used by H2hStaffOverlay for {h2h -staff}) rather
// than a sport-specific layout — the backend's shaper functions
// (build_qb_profile_payload / build_batter_profile_payload) already return
// JSON matching ProfilePayload, so this file no longer needs the
// adaptQbProfile/adaptBatterProfile bundled-JSON adapters it used to carry.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { normalizeDisplayPlayer } from '@/lib/nspe-payloads'
import { fetchPlayerProfile } from '@/lib/databaseApi'
import { loadPlayerIndex, searchPlayers } from '@/lib/playerSearch'
import { PlayerSearchDropdown } from '@/components/PlayerSearchDropdown'
import { C, MiniStat, SectionStack, type ProfileSection, type StatChipsSection } from '@/components/ProfileSections'

// Profile window block (GET /database/{slug}?window=...): the seasons on file
// for this player, newest first, to drive the season toggle. `season` is the
// value passed back as ?window=<season>; `label` is display-ready ("2025-26"
// for NBA/NHL, "2025" for NFL/MLB). `team` is only filled for some sports
// (NHL today) — hide it when null.
export interface ProfileWindowSeason {
  season: number | string
  label: string
  games?: number | null
  team?: string | null
}

export interface ProfileWindow {
  seasons: ProfileWindowSeason[]
  /** false until the backend ships the career view — the {career} button stays greyed. */
  career_available?: boolean
  /** e.g. "On file: 2015-16 to 2025-26 (11 seasons)". */
  coverage?: string
  /** Which window this response is for, when the backend echoes it. */
  selected?: number | string
}

export interface ProfilePayload {
  player: string
  player_id: string
  team: string
  position: string
  season: number
  seasonLabel?: string
  sport?: string
  window?: ProfileWindow
  // Compact chips shown next to the player name in the header (e.g. "next
  // opponent" totals) rather than in the main section stack — optional
  // since not every sport/position necessarily has an equivalent concept.
  headerNote?: StatChipsSection
  sections: ProfileSection[]
}

// Light runtime check, not full validation — this is a brand-new live
// endpoint that hasn't been exercised against real traffic yet, so a
// malformed/unexpected response should render the not-found state instead
// of crashing the page on a missing/wrong-shaped field.
function isProfilePayload(v: unknown): v is ProfilePayload {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return typeof r.player === 'string' && typeof r.player_id === 'string' && Array.isArray(r.sections)
}

type LoadState = { status: 'loading' } | { status: 'ready'; data: ProfilePayload } | { status: 'not-found' } | { status: 'error'; message: string }

// Window toggle: one pill per season on file (newest first, scrollable), a
// {career} button (greyed until the backend reports career_available) and a
// {postseason} toggle (greyed — wired up once the backend delivers it).
function WindowBar({
  win,
  selectedKey,
  notice,
  isSwitching,
  onSelect,
}: {
  win?: ProfileWindow
  selectedKey: string
  notice: string | null
  isSwitching: boolean
  onSelect: (value: string | null) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Bring the selected pill into view when the list is long (17 seasons).
    const el = scrollRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selectedKey, win?.seasons.length])

  const pill = (active: boolean, disabled = false) => ({
    color: disabled ? C.textDim : active ? C.accent : C.textBright,
    borderColor: active ? C.accent : C.border,
    backgroundColor: active ? 'oklch(0.20 0.02 195)' : 'transparent',
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })
  const pillClass = 'font-mono text-[12px] px-2.5 py-1 rounded border whitespace-nowrap flex-none transition-colors'
  const careerReady = Boolean(win?.career_available)

  return (
    <div className="px-6 py-3 space-y-2" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-[10px] uppercase tracking-widest flex-none" style={{ color: C.textDim }}>window</span>
        {win && win.seasons.length > 0 && (
          <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto min-w-0 max-w-full pb-1">
            {win.seasons.map((s) => {
              const key = String(s.season)
              const active = selectedKey === key
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isSwitching}
                  aria-pressed={active}
                  title={[s.team, s.games != null ? `${s.games} GP` : null].filter(Boolean).join(' · ') || undefined}
                  onClick={() => !active && onSelect(key)}
                  className={pillClass}
                  style={pill(active)}
                >
                  {s.label}
                  {s.team ? <span style={{ color: C.textDim }}>{` ${s.team}`}</span> : null}
                </button>
              )
            })}
          </div>
        )}
        <span className="flex gap-1.5 flex-none">
          <button
            type="button"
            disabled={!careerReady || isSwitching}
            aria-pressed={selectedKey === 'career'}
            title={careerReady ? 'Career view' : 'Career view coming soon'}
            onClick={() => careerReady && selectedKey !== 'career' && onSelect('career')}
            className={pillClass}
            style={pill(selectedKey === 'career', !careerReady)}
          >
            {'{career}'}
          </button>
          <button
            type="button"
            disabled
            aria-disabled
            title="Postseason view coming soon"
            className={pillClass}
            style={pill(false, true)}
          >
            {'{postseason}'}
          </button>
        </span>
      </div>
      {win?.coverage && (
        <div className="font-mono text-[11px]" style={{ color: C.textDim }}>{win.coverage}</div>
      )}
      {notice && (
        <div className="font-mono text-[12px]" style={{ color: 'oklch(0.75 0.15 30)' }}>{notice}</div>
      )}
    </div>
  )
}

export default function PlayerProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // Selected window lives in the URL (?window=2019 | career) so a season view
  // is shareable and the back button steps through them.
  const [searchParams, setSearchParams] = useSearchParams()
  const windowParam = searchParams.get('window')
  const [isSwitching, setIsSwitching] = useState(false)
  const [windowNotice, setWindowNotice] = useState<string | null>(null)
  const loadedSlugRef = useRef<string | null>(null)

  // Player search lives directly in the header now — {database} used to be
  // a click-to-open toggle for this same dropdown, but that doubled up with
  // this always-visible field once it moved out here, so the button was
  // removed in favor of just this. No CLI-doubling heuristic needed here
  // (unlike the homepage input) since this is a dedicated search-only field
  // — every keystroke searches.
  const [searchValue, setSearchValue] = useState('')
  const [searchActiveIndex, setSearchActiveIndex] = useState(0)
  const [isPlayerIndexReady, setIsPlayerIndexReady] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPlayerIndex().then(() => setIsPlayerIndexReady(true))
  }, [])

  const playerMatches = useMemo(
    () => searchPlayers(searchValue, 8),
    [searchValue, isPlayerIndexReady],
  )

  const goToPlayerProfile = (targetSlug: string) => {
    setSearchValue('')
    navigate(`/database/${targetSlug}`)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchValue('')
      searchInputRef.current?.blur()
      return
    }
    if (playerMatches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSearchActiveIndex((i) => (i + 1) % playerMatches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSearchActiveIndex((i) => (i - 1 + playerMatches.length) % playerMatches.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const match = playerMatches[searchActiveIndex] ?? playerMatches[0]
      goToPlayerProfile(match.entry.slug)
    }
  }

  useEffect(() => {
    setWindowNotice(null)
  }, [slug])

  const selectWindow = (value: string | null) => {
    setWindowNotice(null)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('window', value)
        else next.delete('window')
        return next
      },
      { replace: false },
    )
  }

  useEffect(() => {
    if (!slug) {
      setState({ status: 'not-found' })
      return
    }
    let cancelled = false
    // Same player, new window: keep the current profile on screen (dimmed)
    // instead of blanking to "loading…".
    const isSameProfile = loadedSlugRef.current === slug
    if (isSameProfile) setIsSwitching(true)
    else setState({ status: 'loading' })

    const dropBadWindow = (message: string) => {
      setWindowNotice(message)
      // Back to the default window; if a profile is already showing, that's
      // simply the previous state, otherwise the effect re-runs without it.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('window')
          return next
        },
        { replace: true },
      )
    }

    fetchPlayerProfile(slug, windowParam)
      .then((result) => {
        if (cancelled) return
        setIsSwitching(false)
        if (result.status === 'not-found') {
          if (windowParam) {
            dropBadWindow(
              result.detail && !result.detail.startsWith('{') && !result.detail.startsWith('[')
                ? result.detail
                : `${windowParam} isn't on file for this player.`,
            )
            return
          }
          setState({ status: 'not-found' })
          return
        }
        if (result.status === 'bad-window') {
          dropBadWindow(`"${windowParam}" isn't a valid window — pick a season below.`)
          return
        }
        const payload = result.payload
        if (!isProfilePayload(payload)) {
          console.error('GET /database/{slug} returned an unexpected shape:', payload)
          setState({ status: 'not-found' })
          return
        }
        loadedSlugRef.current = slug
        setState({ status: 'ready', data: { ...payload, player: normalizeDisplayPlayer(payload.player) } })
      })
      .catch((err) => {
        if (cancelled) return
        setIsSwitching(false)
        console.error('Failed to load player profile:', err)
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [slug, windowParam])

  if (state.status === 'loading') {
    return (
      <div
        className="h-dvh w-full flex items-center justify-center"
        style={{ backgroundColor: C.surface, color: C.textDim, fontFamily: 'monospace' }}
      >
        <span className="font-mono text-[13px]">loading…</span>
      </div>
    )
  }

  if (state.status === 'not-found' || state.status === 'error') {
    return (
      <div
        className="h-dvh w-full flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}
      >
        <span className="font-mono text-[14px]" style={{ color: C.textDim }}>
          {state.status === 'error' ? `couldn't load profile — ${state.message}` : `no profile found for "${slug}"`}
        </span>
        <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
          {'{HOMEPAGE}'}
        </a>
      </div>
    )
  }

  const DATA = state.data

  return (
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-y-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="font-mono font-bold text-[19px]" style={{ color: C.textBright }}>
            {windowParam === 'career' ? 'CAREER' : `${DATA.seasonLabel ?? DATA.season} SEASON`} PROFILE
          </span>
          <div className="flex items-center gap-4">
            <div className="relative w-[200px] sm:w-[240px]">
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value)
                  setSearchActiveIndex(0)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="search a player"
                className="w-full h-[38px] px-3 font-mono text-[13px] rounded-lg border outline-none"
                style={{ backgroundColor: C.surface2, borderColor: C.border, color: C.textBright }}
              />
              {playerMatches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-30">
                  <PlayerSearchDropdown
                    matches={playerMatches}
                    activeIndex={searchActiveIndex}
                    onHoverIndex={setSearchActiveIndex}
                    onSelect={(entry) => goToPlayerProfile(entry.slug)}
                  />
                </div>
              )}
            </div>
            <a href="/charts" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
              {'{chart}'}
            </a>
            <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
              {'{HOMEPAGE}'}
            </a>
          </div>
        </div>

        {/* Identity + header note (e.g. next-opponent totals) share the
            header row — side-by-side with the name is desktop-only (md:),
            smaller MiniStat chips instead of full StatCards so it actually
            fits; below md it stacks. */}
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-3 flex-none">
            <span className="font-mono text-[24px] font-bold" style={{ color: C.textBright }}>
              {DATA.player}
            </span>
            <span className="font-mono text-[13px]" style={{ color: C.textDim }}>
              {DATA.team} · {DATA.position}
            </span>
          </div>
          {DATA.headerNote && (
            <div>
              {/* The backend's "Data on file: 2009-10 to 2025-26 (regular
                  season) — earlier seasons may include some playoff games"
                  caption is data-coverage detail readers don't need — the
                  chips below stand on their own. Other header-note labels
                  (e.g. "next opponent") still show. */}
              {!/^data on file/i.test(DATA.headerNote.label) && (
                <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: C.textDim }}>
                  {DATA.headerNote.label}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {DATA.headerNote.entries.map((c) => (
                  <MiniStat key={c.key} label={c.label} value={c.value} accent={c.accent} />
                ))}
              </div>
            </div>
          )}
        </div>

        {(DATA.window || windowNotice) && (
          <WindowBar
            win={DATA.window}
            selectedKey={windowParam === 'career' ? 'career' : String(DATA.window?.selected ?? DATA.season)}
            notice={windowNotice}
            isSwitching={isSwitching}
            onSelect={selectWindow}
          />
        )}

        <div
          className="px-6 py-6 max-w-[1100px] transition-opacity"
          style={{ opacity: isSwitching ? 0.45 : 1 }}
          aria-busy={isSwitching}
        >
          <SectionStack sections={DATA.sections} />
        </div>
      </div>
    </div>
  )
}
