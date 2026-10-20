// `nfl matchup <A> vs <B>` full-screen overlay — purely descriptive, no
// trend/compute window, never a predictive-syntax sample (the entry point
// is a clickable {A vs B} button next to a real scheduled game, not typed).
//
// Rebuilt 2026-10-18 (owner ask) from a two-tab layout (a full meeting-
// history table, then a grid of every player's stat card) down to just a
// short, deterministic worded summary per team — two things drove this:
// (1) /matchup is a free, unauthenticated feature, and the dropped
// `meetings` table was the heaviest part of the payload for any
// longstanding rivalry (CAR/ARI alone had 17 rows, each with two nested
// stat objects) — real weight for a free feature that's already been
// flaky under backend load; (2) a few sentences someone can actually read
// in passing is a better fit for a header click-through than a dense
// table/card grid was. The summary is templated from data already on the
// payload, not an LLM call — stays free and instant, no new endpoint, no
// sign-in gate. See the conversation this was rescoped in for the two
// worked examples (CAR/ARI, DET/CIN) the wording and player-selection
// logic below were tuned against.
import { useEffect, useState } from 'react'
import { type MatchupInsightPayload, type MatchupPlayer, type MatchupTeamPlayers } from '@/lib/nspe-payloads'
import { type MatchupGameFile, type MatchupAllowsHighlight, type MatchupStarterInfo } from '@/lib/matchupsApi'
import { C } from '@/components/ProfileSections'
import { PLAYER_INDEX, loadPlayerIndex } from '@/lib/playerSearch'

export interface MatchupInsightOverlayProps {
  open: boolean
  onClose: () => void
  payload: MatchupInsightPayload | MatchupGameFile | null
}

// Precomputed files (owner ask, 2026-10-26) carry a `summary` block already
// built server-side — only check needed to tell one from a plain live
// /matchup payload, which has no such field.
function isGameFile(p: MatchupInsightPayload | MatchupGameFile): p is MatchupGameFile {
  return 'summary' in p
}

// ---- per-sport stat vocabulary -----------------------------------------
// One production stat per category to rank players by and lead each
// sentence with. NFL has no backend-given "production" ranking (its own
// `players` array sorts by vs_opponent.games — most history against this
// specific opponent, a different notion — see the conversation this was
// confirmed in), so NFL's yards-based ranking here is this file's own.
// NBA/MLB/NHL's primary stat matches the backend engine's own sort key
// (recent_form.pts/rbi/points respectively, confirmed by nspe-v2-da,
// 2026-10-18) — picked for consistency with how the backend itself already
// defines "produced the most," not independently chosen.
interface CategorySpec {
  primary: string
  primaryLabel: string
  secondary?: string
  secondaryLabel?: string
  verb: string
}

const CATEGORY_SPECS: Record<string, CategorySpec> = {
  // NFL
  pass: { primary: 'yards', primaryLabel: 'yards', secondary: 'td', secondaryLabel: 'TDs', verb: 'thrown for' },
  rush: { primary: 'yards', primaryLabel: 'yards', secondary: 'td', secondaryLabel: 'TDs', verb: 'rushed for' },
  rec: { primary: 'yards', primaryLabel: 'yards', secondary: 'td', secondaryLabel: 'TDs', verb: 'caught for' },
  // NBA
  scoring: { primary: 'pts', primaryLabel: 'points', secondary: 'reb', secondaryLabel: 'rebounds', verb: 'averaged' },
  // MLB
  batting: { primary: 'rbi', primaryLabel: 'RBIs', secondary: 'hr', secondaryLabel: 'home runs', verb: 'driven in' },
  // NHL
  skater: { primary: 'points', primaryLabel: 'points', secondary: 'goals', secondaryLabel: 'goals', verb: 'posted' },
}

function statValue(split: Record<string, unknown>, key: string): number | null {
  const v = split[key]
  return typeof v === 'number' ? v : null
}

// Naive fallback only — plain camelCase split, no name-database backing.
// Correct for most names ("BryceYoung" -> "Bryce Young") but loses
// internal capitals on Mc/Mac-style surnames ("TreyMcbride", should read
// "McBride") and drops apostrophes entirely ("JaMarrChase", should read
// "Ja'Marr"). resolveDisplayName below is what actually fixes this for
// any player already in the live index; this only fires for the rare one
// who isn't (index still loading, or genuinely missing from it).
function formatNameFallback(raw: string): string {
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2')
}

// Case/punctuation-insensitive key — "Ja'Marr Chase" and "JaMarrChase"
// (this payload's own flattened player_name) both reduce to "jamarrchase",
// which is what makes the lookup below work at all.
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '')
}

// Owner report, 2026-10-18: names on this payload are losslessly
// flattened camelCase ("TreyMcbride", "JaMarrChase") with no reliable way
// to algorithmically recover the real capitalization/punctuation (is
// "Laporta" one word or "La" + "Porta"? Does "JaMarr" want an apostrophe?
// Can't tell from the flattened string alone). The site's own live player
// index (/database/index, already fetched for search/profile pages) turns
// out to already carry the correctly formatted version of most of these
// ("Trey McBride", "Ja'Marr Chase" — confirmed live) — so this matches
// against that instead of guessing, falling back to the plain camelCase
// split only for whoever isn't in it yet.
function resolveDisplayName(raw: string): string {
  const key = nameKey(raw)
  const hit = PLAYER_INDEX.find((e) => nameKey(e.name) === key)
  return hit ? hit.name : formatNameFallback(raw)
}

// Mirrors App.tsx's own isPlayerIndexReady pattern (see its loadPlayerIndex
// useEffect) — loadPlayerIndex() is idempotent/safe to call from here even
// if some other component already triggered it, and this overlay can't
// assume one has (it mounts from three separate route trees — App.tsx,
// WorldCupApp.tsx, SportSeasonPage.tsx — not all of which load the index
// on their own). The index is usually already warm by the time someone
// clicks into a matchup from a page that's been open a few seconds, so
// this mostly just re-renders once with the same names already resolved
// correctly; the fallback above covers the rare case where it's still
// loading.
function usePlayerIndexReady(): boolean {
  const [ready, setReady] = useState(PLAYER_INDEX.length > 0)
  useEffect(() => {
    if (ready) return
    loadPlayerIndex().then(() => setReady(true))
  }, [ready])
  return ready
}

function formatStatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

// Every secondaryLabel above (and "yards" itself) is a plain plural with no
// irregular form to worry about, so a trailing-s strip is enough — catches
// "1 TDs"/"1 home runs"/"1 rebound[s]" rather than shipping grammatically
// broken single-game sentences, which single-meeting samples (see
// meetingPhrase below) hit often.
function pluralize(label: string, count: number): string {
  return count === 1 ? label.replace(/s$/, '') : label
}

// Ratio of a player's per-game production against THIS opponent to their
// normal per-game production (recent form). >1 means they've outproduced
// their own normal rate specifically against this team. Needs at least one
// meeting on record and a positive recent-form baseline to mean anything —
// returns null rather than a misleading number otherwise.
function standoutRatio(player: MatchupPlayer): number | null {
  const spec = CATEGORY_SPECS[player.category]
  if (!spec) return null
  const vsGames = player.vs_opponent.games
  const formGames = player.recent_form.games
  if (!vsGames || vsGames < 1 || !formGames || formGames < 1) return null
  const vsVal = statValue(player.vs_opponent, spec.primary)
  const formVal = statValue(player.recent_form, spec.primary)
  if (vsVal === null || formVal === null || formVal <= 0) return null
  const vsRate = vsVal / vsGames
  const formRate = formVal / formGames
  if (formRate <= 0) return null
  return vsRate / formRate
}

function productionTotal(player: MatchupPlayer): number {
  const spec = CATEGORY_SPECS[player.category]
  if (!spec) return 0
  return statValue(player.recent_form, spec.primary) ?? 0
}

// A rate bump has to clear this before it's worth leading with over the
// team's actual top overall producer — tuned against the two worked
// examples (LaPorta/Chase both clear it on a single-digit game sample,
// McMillan's closer-but-not-quite 1.4x bump and ARI's 1.3x Harrison bump
// both correctly stay below it, matching the owner-approved drafts).
const STANDOUT_THRESHOLD = 1.4

interface HighlightPick {
  player: MatchupPlayer
  // 'qb': NFL's auto-include slot (always shown, good or bad — see the
  // file banner). 'standout': picked over the plain top producer because
  // of a real bump against this specific opponent. 'producer': the
  // team's actual top overall producer, no matchup-specific story to add.
  role: 'qb' | 'standout' | 'producer'
}

// Up to two players per team: NFL's QB always takes one slot (whether
// they've played well or poorly here — that's the point, see the
// conversation this was confirmed in); the other slot goes to whichever is
// more notable between the team's actual top overall producer and anyone
// who's clearly outplayed their own normal rate specifically against this
// opponent, even if that player wouldn't otherwise crack the top of the
// list. Non-NFL sports have no equivalent "always include" position, so
// both slots there are just producer-or-standout.
function pickHighlights(players: MatchupPlayer[], sport: string): HighlightPick[] {
  if (players.length === 0) return []

  const qb = sport === 'nfl' ? players.find((p) => p.category === 'pass') : undefined
  const pool = players.filter((p) => p !== qb)
  if (pool.length === 0) return qb ? [{ player: qb, role: 'qb' }] : []

  const byProduction = [...pool].sort((a, b) => productionTotal(b) - productionTotal(a))
  const topProducer = byProduction[0]

  const standoutCandidate = [...pool]
    .filter((p) => p !== topProducer)
    .map((p) => ({ player: p, ratio: standoutRatio(p) }))
    .filter((x): x is { player: MatchupPlayer; ratio: number } => x.ratio !== null && x.ratio >= STANDOUT_THRESHOLD)
    .sort((a, b) => b.ratio - a.ratio)[0]?.player

  const picks: HighlightPick[] = []
  if (qb) {
    // Slot 1 is always the QB. Slot 2 is the standout if one clears the
    // threshold, else the team's actual top producer.
    picks.push({ player: qb, role: 'qb' })
    picks.push(standoutCandidate
      ? { player: standoutCandidate, role: 'standout' }
      : { player: topProducer, role: 'producer' })
  } else {
    // No QB concept (non-NFL) — slot 1 is always the top producer, slot 2
    // is the standout if one clears the threshold, else the next-best
    // producer.
    picks.push({ player: topProducer, role: 'producer' })
    const second = standoutCandidate ?? byProduction[1]
    if (second) picks.push({ player: second, role: standoutCandidate ? 'standout' : 'producer' })
  }

  // Dedup (defensive — the branches above shouldn't produce one, but a
  // repeated name would read worse than a single mention) and cap at 2.
  const seen = new Set<string>()
  return picks.filter((pick) => {
    if (seen.has(pick.player.player_name)) return false
    seen.add(pick.player.player_name)
    return true
  }).slice(0, 2)
}

// vs_opponent is only appended for the 'qb' role (always — see the file
// banner) and the 'standout' role (it's the whole reason they're
// mentioned). A plain 'producer' pick gets its recent-form line only —
// dragging in a middling or irrelevant matchup-history number for a player
// who's just the team's best overall option reads as noise, not signal.
function playerSentence(pick: HighlightPick, opponentLabel: string): string {
  const { player, role } = pick
  const spec = CATEGORY_SPECS[player.category]
  const name = resolveDisplayName(player.player_name)
  if (!spec) return `${name} — no stat line available.`

  const formPrimary = statValue(player.recent_form, spec.primary)
  const formSecondary = spec.secondary ? statValue(player.recent_form, spec.secondary) : null
  const formGames = player.recent_form.games

  let sentence: string
  if (formPrimary === null || !formGames) {
    sentence = `${name} has no recent-form data available.`
  } else {
    const secondaryPhrase = formSecondary !== null && spec.secondaryLabel
      ? ` and ${formatStatNumber(formSecondary)} ${pluralize(spec.secondaryLabel, formSecondary)}`
      : ''
    sentence = `${name} has ${spec.verb} ${formatStatNumber(formPrimary)} ${pluralize(spec.primaryLabel, formPrimary)}${secondaryPhrase} over his last ${formGames} games.`
  }

  if (role === 'qb' || role === 'standout') {
    const vsGames = player.vs_opponent.games
    const vsPrimary = statValue(player.vs_opponent, spec.primary)
    if (vsGames && vsGames >= 1 && vsPrimary !== null) {
      const vsSecondary = spec.secondary ? statValue(player.vs_opponent, spec.secondary) : null
      const vsSecondaryPhrase = vsSecondary !== null && spec.secondaryLabel
        ? ` and ${formatStatNumber(vsSecondary)} ${pluralize(spec.secondaryLabel, vsSecondary)}`
        : ''
      const meetingPhrase = vsGames === 1 ? `in his one game against ${opponentLabel}` : `across ${vsGames} meetings against ${opponentLabel}`
      sentence += ` ${name.split(' ')[0]} has ${formatStatNumber(vsPrimary)} ${pluralize(spec.primaryLabel, vsPrimary)}${vsSecondaryPhrase} ${meetingPhrase}.`
    }
  }

  return sentence
}

function buildTeamSummary(team: MatchupTeamPlayers, sport: string, opponentLabel: string): string {
  const picks = pickHighlights(team.players, sport)
  if (picks.length === 0) return `No recent-form data available for ${team.team}.`
  return picks.map((pick) => playerSentence(pick, opponentLabel)).join(' ')
}

// A compact league-rank badge from the structured allows_highlight fields —
// not a repeat of its own `.text`, which is already the trailing sentence
// of the paragraph above it (confirmed against real NHL/NFL files: both
// end with the exact same "<TEAM> allows <label> ... #<rank> of <of>"
// clause) — repeating that verbatim as a second line would just be the
// same sentence twice.
function AllowsBadge({ highlight }: { highlight: MatchupAllowsHighlight | null }) {
  if (!highlight) return null
  return (
    <div
      className="mt-1.5 inline-block font-mono text-[11px] rounded px-2 py-1"
      style={{ border: `1px solid ${C.border}`, color: C.textDim }}
    >
      {highlight.label} allowed: <span style={{ color: C.accent, fontWeight: 700 }}>{highlight.pct.toFixed(0)}%</span>
      {' '}({highlight.count} of {highlight.games}) · #{highlight.rank} of {highlight.of}
    </div>
  )
}

// NHL only — absent on every other sport's file.
function StartersRow({ starters }: { starters: Record<string, MatchupStarterInfo> | null | undefined }) {
  if (!starters) return null
  const teams = Object.keys(starters)
  if (teams.length === 0) return null
  const statusColor = (status: MatchupStarterInfo['status']) =>
    status === 'confirmed' ? 'oklch(0.78 0.16 145)' : status === 'likely' ? 'oklch(0.80 0.15 85)' : C.textDim
  return (
    <div className="flex flex-wrap gap-4 font-mono text-[12px]" style={{ color: C.textDim }}>
      {teams.map((team) => {
        const s = starters[team]
        return (
          <span key={team}>
            {team} goalie: <span style={{ color: C.textBright }}>{s.goalie}</span>{' '}
            <span className="uppercase text-[9px] tracking-wider font-bold" style={{ color: statusColor(s.status) }}>
              {s.status}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function MatchupInsightOverlay({ open, onClose, payload }: MatchupInsightOverlayProps) {
  // Hook runs unconditionally (before the early return below, per the
  // rules of hooks) — its only job is forcing one re-render once the
  // index is ready, so resolveDisplayName's module-level PLAYER_INDEX
  // read picks up real names instead of the camelCase fallback.
  usePlayerIndexReady()
  if (!open || !payload) return null

  const teamA = payload.query.team_a
  const teamB = payload.query.team_b
  const record = payload.team_record
  const sport = (payload.engine.match(/^([a-z]+)_matchup_insight$/i)?.[1] ?? 'nfl').toLowerCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[720px] max-h-[90vh] rounded-lg overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 flex-none"
          style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}
        >
          <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>
            {teamA} vs {teamB} — matchup insight
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: C.accent }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 flex-none" style={{ borderBottom: `1px solid ${C.border}` }}>
          {/* record is teamA's wins-losses. The team AHEAD is named (with its
              own wins first), never teamA by default; equal wins reads
              "series even". */}
          <span className="font-mono text-[13px]" style={{ color: C.textBright }}>
            {record.wins === record.losses ? (
              <>series even </>
            ) : (
              <>{record.wins > record.losses ? teamA : teamB} leads series </>
            )}
            <span style={{ color: C.accent, fontWeight: 700 }}>
              {Math.max(record.wins, record.losses)}-{Math.min(record.wins, record.losses)}
              {record.ties ? `-${record.ties}` : ''}
              {record.otl ? ` (${record.otl} OTL)` : ''}
            </span>
          </span>
        </div>

        {isGameFile(payload) && payload.starters && (
          <div className="px-5 py-3 flex-none" style={{ borderBottom: `1px solid ${C.border}` }}>
            <StartersRow starters={payload.starters} />
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>
              {teamA}
            </div>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: C.textBright }}>
              {isGameFile(payload) ? payload.summary.team_a : buildTeamSummary(payload.team_a, sport, teamB)}
            </p>
            {/* allows_highlight.team_a describes what team_a's players FACE
                (team_b/home's defense) — confirmed against real files: it's
                the opponent's highlight, not the team's own, same team as
                the trailing sentence of summary.team_a itself. */}
            {isGameFile(payload) && <AllowsBadge highlight={payload.allows_highlight.team_a} />}
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>
              {teamB}
            </div>
            <p className="font-mono text-[13px] leading-relaxed" style={{ color: C.textBright }}>
              {isGameFile(payload) ? payload.summary.team_b : buildTeamSummary(payload.team_b, sport, teamA)}
            </p>
            {isGameFile(payload) && <AllowsBadge highlight={payload.allows_highlight.team_b} />}
          </div>
        </div>
      </div>
    </div>
  )
}
