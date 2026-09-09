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
import { useNavigate, useParams } from 'react-router-dom'
import { normalizeDisplayPlayer } from '@/lib/nspe-payloads'
import { fetchPlayerProfile } from '@/lib/databaseApi'
import { loadPlayerIndex, searchPlayers } from '@/lib/playerSearch'
import { PlayerSearchDropdown } from '@/components/PlayerSearchDropdown'
import { C, MiniStat, SectionStack, type ProfileSection, type StatChipsSection } from '@/components/ProfileSections'

export interface ProfilePayload {
  player: string
  player_id: string
  team: string
  position: string
  season: number
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

export default function PlayerProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // {database} in the header doubles as a search toggle — clicking it pops
  // open the same player-search dropdown the homepage uses, so switching to
  // another player doesn't require backing out to the homepage first. No
  // CLI-doubling heuristic needed here (unlike the homepage input) since
  // this is a dedicated search-only field — every keystroke searches.
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchActiveIndex, setSearchActiveIndex] = useState(0)
  const [isPlayerIndexReady, setIsPlayerIndexReady] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPlayerIndex().then(() => setIsPlayerIndexReady(true))
  }, [])

  useEffect(() => {
    if (!isSearchOpen) return
    searchInputRef.current?.focus()
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [isSearchOpen])

  const playerMatches = useMemo(
    () => (isSearchOpen ? searchPlayers(searchValue, 8) : []),
    [searchValue, isSearchOpen, isPlayerIndexReady],
  )

  const goToPlayerProfile = (targetSlug: string) => {
    setIsSearchOpen(false)
    setSearchValue('')
    navigate(`/database/${targetSlug}`)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false)
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
    if (!slug) {
      setState({ status: 'not-found' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetchPlayerProfile(slug)
      .then((payload) => {
        if (cancelled) return
        if (!payload) {
          setState({ status: 'not-found' })
          return
        }
        if (!isProfilePayload(payload)) {
          console.error('GET /database/{slug} returned an unexpected shape:', payload)
          setState({ status: 'not-found' })
          return
        }
        setState({ status: 'ready', data: { ...payload, player: normalizeDisplayPlayer(payload.player) } })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load player profile:', err)
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [slug])

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
          {'{homepage}'}
        </a>
      </div>
    )
  }

  const DATA = state.data

  return (
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      <div>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="relative" ref={searchContainerRef}>
            <button
              type="button"
              onClick={() => setIsSearchOpen((v) => !v)}
              className="font-mono font-bold text-[15px] hover:opacity-80 transition-opacity"
              style={{ color: C.accent }}
              aria-label="Search another player"
            >
              {'{database}'}
            </button>
            <span className="ml-2 font-mono text-[12px]" style={{ color: C.textDim }}>
              {DATA.season} season profile
            </span>
            {isSearchOpen && (
              <div className="absolute top-full left-0 mt-2 w-[320px] z-30">
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
                  <div className="mt-1.5">
                    <PlayerSearchDropdown
                      matches={playerMatches}
                      activeIndex={searchActiveIndex}
                      onHoverIndex={setSearchActiveIndex}
                      onSelect={(entry) => goToPlayerProfile(entry.slug)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <a href="/charts" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
              {'{chart}'}
            </a>
            <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
              {'{homepage}'}
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
              <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: C.textDim }}>
                {DATA.headerNote.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DATA.headerNote.entries.map((c) => (
                  <MiniStat key={c.key} label={c.label} value={c.value} accent={c.accent} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-6 max-w-[1100px]">
          <SectionStack sections={DATA.sections} />
        </div>
      </div>
    </div>
  )
}
