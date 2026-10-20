// {sap.zilla} — the "saps to sharps" backtest lab (owner-named, 2026-10-19).
// Pure historical counts, never a price: "how often has this actually
// happened," no odds/edge/value language anywhere on this page, matching
// the backend's own refusal to emit those words (see labApi.ts). Styled
// like {team.metrics} (full-height dark terminal page, bordered cards, no
// PageShell/shadcn chrome) per the owner's inclination — not a hard
// instruction, just where this naturally landed.
//
// Two ways in, one endpoint: a category → stat → number picker (free, no
// auth — never shows the user raw syntax like "-q1ryds10", it just builds
// it) and a screenshot of a real slip (signed in, costs a free question or
// a credit — the model reads legs out of the image, shown read-only in the
// results section below). The old "type legs directly" box is removed for
// now (owner ask, 2026-10-19) — it's coming back once there's a legend to
// go with it.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { C } from '@/components/ProfileSections'
import { HomeLogoLink } from '@/components/HomeLogoLink'
import { loadPlayerIndex, searchPlayers, PLAYER_INDEX, type PlayerMatch } from '@/lib/playerSearch'
import { teamRoster } from '@/lib/teamNicknames'
import {
  LAB_SPORTS,
  LAB_CATEGORIES,
  LAB_NFL_SCOPES,
  LAB_TEAM_STATS,
  LAB_TEAM_SCOPES,
  LAB_LEAGUE_POSITIONS,
  labStatOption,
  labTeamStatOption,
  labStatSupportsScope,
  buildPlayerLeg,
  buildTeamLeg,
  buildLeagueLeg,
  type LabSport,
  type LabScope,
} from '@/lib/labLegs'
import { runLabLegs, runLabImage, LabError_, type LabResult, type LabImageResult, type LabLeagueView } from '@/lib/labApi'
import madeitLogo from '@/assets/images/madeit-tech-logo-v2.jpeg'

const MAX_LEGS = 12
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

function fieldStyle(): CSSProperties {
  return { backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.textBright }
}

// A leg the picker built, plus a plain-English label for the on-screen
// list — the actual "nfl josh allen -q1ryds10" string is what goes over
// the wire, never what the user reads (owner ask, 2026-10-19: no made-up
// or exposed syntax anywhere on this page).
interface BuiltLeg {
  raw: string
  label: string
}

export default function SapZillaPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // ---- composer state ----
  const [sport, setSport] = useState<LabSport>('nfl')
  const [kind, setKind] = useState<'player' | 'team' | 'league'>('player')
  const [playerQuery, setPlayerQuery] = useState('')
  const [playerMatches, setPlayerMatches] = useState<PlayerMatch[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [teamCode, setTeamCode] = useState('')
  const [teamStat, setTeamStat] = useState(LAB_TEAM_STATS[0].value)
  const [teamScope, setTeamScope] = useState<LabScope>('season')
  // League-wide legs reuse the same category/stat state as player legs
  // (same per-sport stat catalog, confirmed live) — only "position or any"
  // is unique to this kind.
  const [leaguePosition, setLeaguePosition] = useState('any')
  const [category, setCategory] = useState(LAB_CATEGORIES.nfl[0].key)
  const [stat, setStat] = useState(LAB_CATEGORIES.nfl[0].stats[0])
  const [scope, setScope] = useState<LabScope>('season')
  // A string, not a number — a controlled number input that coerces to 0
  // on every keystroke fights the user mid-type ("3" then "0" renders as
  // "030" once the field has already snapped to 0 in between). Parsed to
  // a number only when actually building a leg. (reported 2026-10-19)
  const [numText, setNumText] = useState(String(labStatOption('nfl', LAB_CATEGORIES.nfl[0].stats[0])?.default ?? 0))
  const [legs, setLegs] = useState<BuiltLeg[]>([])

  // ---- date range ----
  // Default bumped 2018 -> 2020 (owner ask, 2026-10-26: "the decade, not
  // 2018") — matches GET /lab/lines' own options.since. 2018/2019 stay
  // selectable in the dropdown below, just not pre-selected anymore.
  const [since, setSince] = useState(2020)
  const [post, setPost] = useState(false)
  const [seasonOnly, setSeasonOnly] = useState(false)

  // ---- screenshot ----
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageDataUri, setImageDataUri] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // ---- run state ----
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [result, setResult] = useState<LabResult | LabImageResult | null>(null)

  const numValue = numText === '' ? 0 : parseInt(numText, 10) || 0

  // Forces one re-render once the index finishes loading, so
  // sportHasPlayerIndex below reflects reality instead of the empty-array
  // state this module starts in (same pattern as MatchupInsightOverlay's
  // usePlayerIndexReady).
  const [indexReady, setIndexReady] = useState(PLAYER_INDEX.length > 0)
  useEffect(() => {
    if (indexReady) return
    loadPlayerIndex().then(() => setIndexReady(true))
  }, [indexReady])

  // Originally added because GET /database/index briefly carried no cfb
  // entries at all (confirmed live 2026-10-20), which would have left the
  // "+ add leg" button permanently disabled for CFB — selecting a player
  // currently requires clicking an autocomplete match that could never
  // appear. Backend added cfb/cbb to the index same day, so this is
  // dormant in practice now (both have real coverage), but kept as a
  // generic safety net — computed live against whatever's actually in the
  // index, so it self-retires per sport the moment that sport gets
  // coverage, no code change needed each time. A wrong typed name just
  // surfaces in the result's own errors[], same graceful-degradation rule
  // as everywhere else here.
  const sportHasPlayerIndex = PLAYER_INDEX.some((e) => e.sport === sport)
  const effectivePlayer = selectedPlayer ?? (!sportHasPlayerIndex ? playerQuery.trim() || null : null)

  useEffect(() => {
    const cat = LAB_CATEGORIES[sport][0]
    setCategory(cat.key)
    setStat(cat.stats[0])
    setNumText(String(labStatOption(sport, cat.stats[0])?.default ?? 0))
    setScope('season')
    setLeaguePosition('any')
    // Team legs are NFL-only — drop back to player if a non-NFL sport gets
    // picked while "team" was selected. League-wide works for every sport,
    // so it's left alone here (functional update so this effect doesn't
    // need `kind` in its deps).
    if (sport !== 'nfl') setKind((k) => (k === 'team' ? 'player' : k))
  }, [sport])

  useEffect(() => {
    if (!playerQuery.trim()) {
      setPlayerMatches([])
      return
    }
    setPlayerMatches(searchPlayers(playerQuery, 6, sport))
  }, [playerQuery, sport])

  function selectKind(k: 'player' | 'team' | 'league') {
    setKind(k)
    // player and league share the same stat catalog/state, so only team
    // has a different source for the default.
    setNumText(String(k === 'team' ? labTeamStatOption(teamStat)?.default ?? 0 : labStatOption(sport, stat)?.default ?? 0))
  }

  function selectTeamStat(statValue: string) {
    setTeamStat(statValue)
    setNumText(String(labTeamStatOption(statValue)?.default ?? 0))
    setTeamScope('season')
  }

  function selectCategory(catKey: string) {
    setCategory(catKey)
    const cat = LAB_CATEGORIES[sport].find((c) => c.key === catKey)
    const firstStat = cat?.stats[0] ?? ''
    setStat(firstStat)
    setNumText(String(labStatOption(sport, firstStat)?.default ?? 0))
    setScope('season')
  }

  function selectStat(statValue: string) {
    setStat(statValue)
    setNumText(String(labStatOption(sport, statValue)?.default ?? 0))
    setScope('season')
  }

  function addLegFromPicker() {
    if (legs.length >= MAX_LEGS || numValue <= 0) return
    if (kind === 'player') {
      if (!effectivePlayer) return
      const raw = buildPlayerLeg(sport, effectivePlayer, stat, scope, numValue)
      const statLabel = labStatOption(sport, stat)?.label ?? stat
      const scopeLabel = scope === 'season' ? '' : ` (${LAB_NFL_SCOPES.find((s) => s.value === scope)?.label})`
      const label = `${effectivePlayer} · ${statLabel} ${numValue}+${scopeLabel}`
      // Dedupe on add — caught live (owner screenshot, 2026-10-19): clicking
      // "+ add leg" twice on the same selection silently added it twice.
      setLegs((prev) => (prev.some((l) => l.raw === raw) ? prev : [...prev, { raw, label }]))
    } else if (kind === 'team') {
      if (!teamCode.trim()) return
      const raw = buildTeamLeg(teamCode, teamStat, teamScope, numValue)
      const nickname = teamRoster('nfl').find((t) => t.code === teamCode)?.nickname ?? teamCode.toUpperCase()
      const statLabel = labTeamStatOption(teamStat)?.label ?? teamStat
      const scopeLabel = teamScope === 'season' ? '' : ` (${LAB_TEAM_SCOPES.find((s) => s.value === teamScope)?.label})`
      const label = `${nickname} · ${statLabel} ${numValue}+${scopeLabel}`
      setLegs((prev) => (prev.some((l) => l.raw === raw) ? prev : [...prev, { raw, label }]))
    } else {
      // league-wide — a population rate, not one player/team's history. No
      // extra required field beyond the stat/number already needed for
      // every kind (leaguePosition defaults to "any", always valid).
      const raw = buildLeagueLeg(sport, leaguePosition, stat, numValue)
      const sportLabel = LAB_SPORTS.find((s) => s.value === sport)?.label ?? sport
      const posLabel = leaguePosition === 'any' ? 'any position' : leaguePosition
      const statLabel = labStatOption(sport, stat)?.label ?? stat
      const label = `${sportLabel} ${posLabel} · ${statLabel} ${numValue}+`
      setLegs((prev) => (prev.some((l) => l.raw === raw) ? prev : [...prev, { raw, label }]))
    }
  }

  function removeLeg(i: number) {
    setLegs((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleFile(file: File) {
    setImageError(null)
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.type)) {
      setImageError('Screenshot must be a PNG, JPEG, WebP, or GIF.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Screenshot is too large (6 MB max).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUri(reader.result as string)
      setImageName(file.name)
    }
    reader.onerror = () => setImageError("Couldn't read that file.")
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageDataUri(null)
    setImageName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function run() {
    setRunError(null)
    if (imageDataUri) {
      if (!user) {
        navigate(`/login?redirect=${encodeURIComponent('/sap.zilla')}`)
        return
      }
      setRunning(true)
      try {
        const res = await runLabImage(imageDataUri, { since, post, season: seasonOnly })
        setResult(res)
      } catch (e) {
        setRunError(e instanceof LabError_ ? e.message : 'Could not read that screenshot.')
      } finally {
        setRunning(false)
      }
      return
    }

    if (legs.length === 0) {
      setRunError('Add at least one leg first.')
      return
    }
    setRunning(true)
    try {
      const res = await runLabLegs(legs.map((l) => l.raw), { since, post, season: seasonOnly })
      setResult(res)
    } catch (e) {
      setRunError(e instanceof LabError_ ? e.message : 'Something went wrong.')
    } finally {
      setRunning(false)
    }
  }

  const imageResult = result && 'read_from_image' in result ? (result as LabImageResult) : null
  const statOption = labStatOption(sport, stat)
  const activeCategories = LAB_CATEGORIES[sport]
  const activeCategory = activeCategories.find((c) => c.key === category) ?? activeCategories[0]

  return (
    // h-dvh + overflow-y-auto, not min-h-dvh — body has a global
    // `overflow: hidden` (src/index.css), so this page needs its own
    // capped-height scroll container, same fix as {team.metrics}. Without
    // it, content past the fold (the "run it" button included) was just
    // clipped with no way to reach it (reported 2026-10-19).
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-[15px] rounded px-2 py-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}>
            {'{sap.zilla}'}
          </span>
          <span className="font-mono text-[12px]" style={{ color: C.textDim }}>
            how often props happen in general, select player, vs opponent etc
          </span>
        </div>
        <HomeLogoLink fontSizePx={13} />
      </div>

      <div className="px-6 py-6 max-w-3xl mx-auto space-y-5">
        <div className="rounded-lg p-4 font-mono text-[13px] space-y-2" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.textBright }}>
            Pick a prop or line, or stack a few, and {'{sap.zilla}'} counts every game it actually happened
          </p>
          <p style={{ color: C.textDim }}>
            The proof to whatever you were about to take on faith.
          </p>
        </div>

        {/* ---- composer ---- */}
        <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: C.textDim }}>check probability</div>

          <div className="flex flex-wrap gap-2">
            {LAB_SPORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSport(s.value)}
                className="font-mono text-[12px] font-bold px-3 py-1.5 rounded"
                style={{
                  border: `1px solid ${sport === s.value ? C.accent : C.border}`,
                  color: sport === s.value ? C.accent : C.textDim,
                }}
              >
                {s.label}
              </button>
            ))}
            <span className="w-px self-stretch" style={{ backgroundColor: C.border }} />
            {(sport === 'nfl' ? (['player', 'team', 'league'] as const) : (['player', 'league'] as const)).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => selectKind(k)}
                className="font-mono text-[12px] font-bold px-3 py-1.5 rounded"
                style={{ border: `1px solid ${kind === k ? C.accent : C.border}`, color: kind === k ? C.accent : C.textDim }}
              >
                {k === 'player' ? 'player' : k === 'team' ? 'team' : 'league-wide'}
              </button>
            ))}
          </div>

          {kind === 'player' ? (
            <div className="relative">
              <input
                value={selectedPlayer ?? playerQuery}
                onChange={(e) => {
                  setSelectedPlayer(null)
                  setPlayerQuery(e.target.value)
                }}
                placeholder={sportHasPlayerIndex ? 'search a player…' : "type the player's full name…"}
                className="w-full rounded px-3 py-2 font-mono text-[13px]"
                style={fieldStyle()}
              />
              {!selectedPlayer && playerMatches.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-10 mt-1 rounded overflow-hidden"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
                >
                  {playerMatches.map((m) => (
                    <button
                      key={m.entry.slug}
                      type="button"
                      onClick={() => {
                        setSelectedPlayer(m.entry.name)
                        setPlayerQuery('')
                        setPlayerMatches([])
                      }}
                      className="block w-full text-left px-3 py-1.5 font-mono text-[12px] hover:opacity-80"
                      style={{ color: C.textBright }}
                    >
                      {m.entry.name} <span style={{ color: C.textDim }}>{m.entry.team}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : kind === 'team' ? (
            <select value={teamCode} onChange={(e) => setTeamCode(e.target.value)} className="w-full rounded px-3 py-2 font-mono text-[13px]" style={fieldStyle()}>
              <option value="">select a team…</option>
              {teamRoster('nfl').map((t) => (
                <option key={t.code} value={t.code}>{t.nickname} ({t.code})</option>
              ))}
            </select>
          ) : (
            // League-wide — a position (or "any") in place of one player.
            // MLB has no position breakdown at all (confirmed live), so it
            // only ever offers "any", never a position chip.
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLeaguePosition('any')}
                className="font-mono text-[12px] px-2.5 py-1 rounded"
                style={{ border: `1px solid ${leaguePosition === 'any' ? C.accent : C.border}`, color: leaguePosition === 'any' ? C.accent : C.textDim }}
              >
                any position
              </button>
              {LAB_LEAGUE_POSITIONS[sport].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setLeaguePosition(pos)}
                  className="font-mono text-[12px] px-2.5 py-1 rounded"
                  style={{ border: `1px solid ${leaguePosition === pos ? C.accent : C.border}`, color: leaguePosition === pos ? C.accent : C.textDim }}
                >
                  {pos}
                </button>
              ))}
            </div>
          )}

          {/* Category → stat chips — no raw stat codes or syntax shown
              anywhere, same spirit as {team.metrics}'s click-to-view menus
              (owner ask, 2026-10-19).
              A category holding exactly one stat (NHL's old Playmaking/
              Defense/Combined, NBA's old Rebounding/Playmaking) renders as
              a single direct stat chip instead — no point clicking a
              category just to reveal the one stat it contains (owner ask,
              2026-10-26). Clicking it still goes through selectCategory,
              which already auto-picks that lone stat. */}
          {(kind === 'player' || kind === 'league') && (
            <>
              <div className="flex flex-wrap gap-2">
                {activeCategories.map((c) => {
                  const isSingleStat = c.stats.length === 1
                  const label = isSingleStat ? labStatOption(sport, c.stats[0])?.label ?? c.label : c.label
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => selectCategory(c.key)}
                      className="font-mono text-[12px] px-2.5 py-1 rounded"
                      style={{ border: `1px solid ${category === c.key ? C.accent : C.border}`, color: category === c.key ? C.accent : C.textDim }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {activeCategory.stats.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {activeCategory.stats.map((sVal) => {
                    const opt = labStatOption(sport, sVal)
                    if (!opt) return null
                    return (
                      <button
                        key={sVal}
                        type="button"
                        onClick={() => selectStat(sVal)}
                        className="font-mono text-[12px] px-2.5 py-1 rounded"
                        style={{ border: `1px solid ${stat === sVal ? C.accent : C.border}`, color: stat === sVal ? C.accent : C.textDim }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Team legs grew from points-only to 5 stats, all scoped
              (confirmed live 2026-10-26) — same flat chip row as a
              single-category sport section, no category wrapper needed
              for just 5 items. */}
          {kind === 'team' && (
            <div className="flex flex-wrap gap-2">
              {LAB_TEAM_STATS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => selectTeamStat(s.value)}
                  className="font-mono text-[12px] px-2.5 py-1 rounded"
                  style={{ border: `1px solid ${teamStat === s.value ? C.accent : C.border}`, color: teamStat === s.value ? C.accent : C.textDim }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <span className="font-mono text-[12px] font-bold" style={{ color: C.textBright }}>
              {kind === 'team' ? labTeamStatOption(teamStat)?.label ?? teamStat : statOption?.label ?? stat}
            </span>
            {/* Player legs only — league-wide legs are whole-game only, no
                scope ever (a scoped league leg errors server-side,
                confirmed live 2026-10-26), even for a stat that supports
                scope as a player leg. */}
            {kind === 'player' && labStatSupportsScope(sport, stat) && (
              <select value={scope} onChange={(e) => setScope(e.target.value as LabScope)} className="rounded px-2 py-1.5 font-mono text-[12px]" style={fieldStyle()}>
                {LAB_NFL_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
            {kind === 'team' && (
              <select value={teamScope} onChange={(e) => setTeamScope(e.target.value as LabScope)} className="rounded px-2 py-1.5 font-mono text-[12px]" style={fieldStyle()}>
                {LAB_TEAM_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
            <span className="font-mono text-[12px]" style={{ color: C.textDim }}>at least</span>
            <input
              type="text"
              inputMode="numeric"
              value={numText}
              onChange={(e) => setNumText(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
              className="w-20 rounded px-2 py-1.5 font-mono text-[12px]"
              style={fieldStyle()}
            />
            <button
              type="button"
              onClick={addLegFromPicker}
              disabled={
                legs.length >= MAX_LEGS ||
                numValue <= 0 ||
                (kind === 'player' ? !effectivePlayer : kind === 'team' ? !teamCode : false)
              }
              className="font-mono text-[12px] font-bold px-3 py-1.5 rounded disabled:opacity-40"
              style={{ border: `1px solid ${C.accent}`, color: C.accent }}
            >
              + add leg
            </button>
          </div>

          {legs.length > 0 && (
            <div className="space-y-1.5">
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded px-2.5 py-1.5" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                  <span className="font-mono text-[12px]" style={{ color: C.textBright }}>{leg.label}</span>
                  <button type="button" onClick={() => removeLeg(i)} className="font-mono text-[12px]" style={{ color: C.textDim }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={run}
            disabled={running}
            className="w-full font-mono font-bold text-[14px] py-2.5 rounded disabled:opacity-50"
            style={{ border: `1px solid ${C.accent}`, color: C.accent }}
          >
            {running ? 'running…' : imageDataUri ? 'read my screenshot' : 'run it'}
          </button>
        </div>

        {/* ---- screenshot — a separate path from the picker above, not
            mixed into it (owner ask, 2026-10-19) ---- */}
        <div
          className="rounded-lg p-4 space-y-2 text-center"
          style={{ backgroundColor: C.surface2, border: `1px dashed ${C.border}` }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          {imageDataUri ? (
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-[12px]" style={{ color: C.textBright }}>{imageName}</span>
              <button type="button" onClick={clearImage} className="font-mono text-[12px] underline" style={{ color: C.accent }}>remove</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="font-mono text-[12px]" style={{ color: C.textDim }}>
              drop a screenshot of a slip here, or click to choose one — {user ? 'free question or 1 credit' : 'sign in required'}
            </button>
          )}
          {imageError && <div className="font-mono text-[11px]" style={{ color: 'oklch(0.75 0.15 30)' }}>{imageError}</div>}
        </div>

        {/* ---- date range ---- */}
        <div className="flex flex-wrap items-center gap-4 font-mono text-[12px]" style={{ color: C.textDim }}>
          <label className="flex items-center gap-1.5">
            since
            <select value={since} onChange={(e) => setSince(Number(e.target.value))} className="rounded px-2 py-1" style={fieldStyle()}>
              {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> include postseason
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={seasonOnly} onChange={(e) => setSeasonOnly(e.target.checked)} /> this season only
          </label>
        </div>

        {runError && (
          <div className="rounded px-3 py-2 font-mono text-[12px]" style={{ border: '1px solid oklch(0.6 0.2 25)', color: 'oklch(0.85 0.15 25)' }}>
            {runError}
          </div>
        )}

        {/* ---- results ---- */}
        {result && <LabResults result={result} imageResult={imageResult} />}
      </div>
    </div>
  )
}

function LabResults({ result, imageResult }: { result: LabResult; imageResult: LabImageResult | null }) {
  const showIndependent = result.joint.clusters.some((c) => c.method !== 'single') && result.joint.method !== 'single'
  return (
    <div className="space-y-4">
      {imageResult && (
        <div className="rounded-lg p-4 font-mono text-[12px] space-y-1.5" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <div className="uppercase tracking-widest text-[10px]" style={{ color: C.textDim }}>read from your screenshot</div>
          {imageResult.read_from_image.legs.map((l, i) => <div key={i} style={{ color: C.textBright }}>{l}</div>)}
          {imageResult.read_from_image.unreadable.length > 0 && (
            <div style={{ color: 'oklch(0.75 0.15 30)' }}>
              couldn't read: {imageResult.read_from_image.unreadable.join(', ')}
            </div>
          )}
          <div style={{ color: C.textDim }}>
            {imageResult.quota.kind === 'free' ? `${imageResult.quota.remaining} free questions left today` : `${imageResult.quota.remaining} credits left`}
            {imageResult.credits_charged > 0 ? ` · ${imageResult.credits_charged} credit charged` : ' · free hit'}
          </div>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="rounded-lg p-4 font-mono text-[12px] space-y-1" style={{ border: '1px solid oklch(0.6 0.2 25)' }}>
          {result.errors.map((e, i) => (
            <div key={i} style={{ color: 'oklch(0.85 0.15 25)' }}>
              <span style={{ color: C.textDim }}>{e.leg}:</span> {e.error}
            </div>
          ))}
        </div>
      )}

      {result.legs.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          {result.legs.map((leg, i) => (
            <div key={i} style={{ borderBottom: i === result.legs.length - 1 ? 'none' : `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[13px]">
                <span style={{ color: C.textBright }}>{leg.text}</span>
                <span className="whitespace-nowrap font-bold" style={{ color: C.accent }}>
                  {leg.hits} of {leg.n} <span className="font-normal" style={{ color: C.textDim }}>({(leg.pct * 100).toFixed(0)}%)</span>
                </span>
              </div>
              {leg.league_view && <LeagueLegDetail view={leg.league_view} />}
            </div>
          ))}
        </div>
      )}

      {result.card.together && (
        <div className="rounded-lg p-4 font-mono text-[13px] space-y-1" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.textBright }}>{result.card.together}</div>
          {showIndependent && (
            <div style={{ color: C.textDim }}>if independent: {((result.joint.independent_pct ?? 0) * 100).toFixed(0)}%</div>
          )}
        </div>
      )}

      {/* Share card — {sap.zilla}'s own poster, same bottom-left brand mark
          as {team.metrics}' single-stat shareables. No persisted share
          link yet (that's a fast-follow, same as team.metrics got one
          after its own base page shipped) — this is the "good enough to
          screenshot" version for now. */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
        <div className="px-5 py-5 text-center">
          <div className="font-mono font-bold text-[18px]" style={{ color: C.accent }}>{result.card.headline}</div>
          <div className="mt-3 space-y-1">
            {result.card.lines.map((l, i) => (
              <div key={i} className="font-mono text-[13px]" style={{ color: C.textBright }}>{l}</div>
            ))}
          </div>
        </div>
        <div className="flex justify-start px-5 pb-4">
          <img src={madeitLogo} alt="nspe" className="pointer-events-none" style={{ width: '22px', height: '36px', objectFit: 'contain' }} />
        </div>
      </div>
    </div>
  )
}

// League-wide legs measure a population, not one player — the owner wants
// both units visible at once (owner ask, 2026-10-26): the row above this
// already shows the player-game rate (hits/n on the leg itself); this
// panel adds the per-GAME view (at_least_one_complete / both_sides, both
// measured over complete_games — the games where both sides' data is on
// file), the top-5 individual leaderboard, and the data-coverage note,
// printed verbatim per the contract rather than reworded.
function pct(split: { hits: number; n: number }): string {
  return split.n > 0 ? `${((split.hits / split.n) * 100).toFixed(0)}%` : '—'
}

function LeagueLegDetail({ view }: { view: LabLeagueView }) {
  const { games, top, note } = view
  return (
    <div className="px-4 pb-3 font-mono text-[12px] space-y-2" style={{ color: C.textDim, borderTop: `1px solid ${C.border}` }}>
      <div className="pt-2.5 uppercase tracking-widest text-[10px]">per game, {view.unit}</div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <span>
          at least one side hit: <span style={{ color: C.textBright }}>{games.at_least_one_complete.hits} of {games.at_least_one_complete.n}</span>
          {' '}({pct(games.at_least_one_complete)})
        </span>
        <span>
          both sides hit: <span style={{ color: C.textBright }}>{games.both_sides.hits} of {games.both_sides.n}</span>
          {' '}({pct(games.both_sides)})
        </span>
      </div>
      {top.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {top.map((p, i) => (
            <span key={i}>
              <span style={{ color: C.textBright }}>{p.player}</span> {p.hits}/{p.n}
            </span>
          ))}
        </div>
      )}
      {note && <div className="italic">{note}</div>}
    </div>
  )
}
