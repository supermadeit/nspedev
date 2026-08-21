// Full-screen results renderer: rank/player/team/statline rows, with
// "N more · tap to expand" truncation. Renders every NspeResult `kind`
// through ONE component instead of one mobile view per engine (matches how
// the results screen was scoped from the first mockup) — for Phase 1, that
// means every kind (including h2h/trend/compute/team/explosive) renders as
// a plain list (`showRank=false` unless the payload is inherently a ranked
// leaderboard already, e.g. `mlb_report_leaderboard`). This first pass isn't
// exhaustive or especially pretty for every payload shape — it just needs to
// show something sensible (player/team + the primary stat per row) and never
// crash on an unexpected shape.
import { useState } from 'react'
import type { NspeResult } from '@/hooks/useNspeQuery'
import { asNumber } from '@/lib/nspe-api'
import { C } from './theme'

export interface ListRow {
  id: string
  primary: string
  secondary?: string
  value: string
  meta?: string
}

const INITIAL_VISIBLE = 15

function fmt(n: unknown): string {
  const v = asNumber(n)
  return Number.isFinite(v) ? String(v) : '—'
}

// Best-effort adapter from a raw NspeResult payload into flat display rows.
// Every branch guards against missing/odd shapes rather than throwing.
// `statLabel` is the unit for the *generic* (nba/mlb/nhl/nfl trend/compute)
// case only — every other kind already carries its own labels/units inline
// on the payload (HR, ft, K, etc.), so this is unused there.
export function deriveRows(result: NspeResult, statLabel?: string): ListRow[] {
  try {
    switch (result.kind) {
      case 'h2h': {
        const { games, query } = result.payload
        return (games ?? []).map((g, i) => ({
          id: `${i}`,
          primary: g.date ?? g.date_iso ?? `game ${i + 1}`,
          secondary: g.opponent ?? query.opponent_code ?? undefined,
          value: `${fmt(g.H)}-${fmt(g.AB)}, ${fmt(g.HR)}HR ${fmt(g.RBI)}RBI`,
          meta: g.venue,
        }))
      }
      case 'mlb_pitch_h2h': {
        const { games } = result.payload
        return (games ?? []).map((g, i) => ({
          id: `${i}`,
          primary: g.date_display ?? g.date_iso ?? `game ${i + 1}`,
          secondary: g.opponent_team,
          value: `${fmt(g.k)}K ${fmt(g.bb)}BB ${fmt(g.hr)}HR`,
          meta: typeof g.ip === 'number' || typeof g.ip === 'string' ? `${g.ip} IP` : undefined,
        }))
      }
      case 'mlb_pitch_fpv': {
        const { games } = result.payload
        return (games ?? []).map((g, i) => ({
          id: `${i}`,
          primary: g.date_iso ?? `game ${i + 1}`,
          secondary: g.opponent_team,
          value: g.fpv != null ? `${g.fpv} mph` : '—',
          meta: g.pitch_type,
        }))
      }
      case 'mlb_bat_team': {
        const { contributing_pitchers, team } = result.payload
        return (contributing_pitchers ?? []).map((p, i) => ({
          id: `${i}`,
          primary: p.name,
          secondary: team,
          value: `${p.games} games`,
        }))
      }
      case 'mlb_team_overview': {
        const p = result.payload
        const rows: ListRow[] = []
        if (p['3down'] != null) rows.push({ id: '3down', primary: '3-down', value: fmt(p['3down']) })
        if (p['6down'] != null) rows.push({ id: '6down', primary: '6-down', value: fmt(p['6down']) })
        if (p['9down'] != null) rows.push({ id: '9down', primary: '9-down', value: fmt(p['9down']) })
        if (p.team_k_total != null) rows.push({ id: 'k', primary: 'team K', value: fmt(p.team_k_total) })
        if (p.team_bb_total != null) rows.push({ id: 'bb', primary: 'team BB', value: fmt(p.team_bb_total) })
        return rows
      }
      case 'mlb_report_leaderboard': {
        const { rows } = result.payload
        return (rows ?? []).map((r, i) => ({
          id: `${i}`,
          primary: r.player,
          secondary: r.team,
          value: r.grade,
          meta: `score ${fmt(r.score)} · ${r.games}g`,
        }))
      }
      case 'mlb_player_report': {
        const { report, player, team } = result.payload
        const breakdown = report?.breakdown ?? []
        if (breakdown.length === 0) {
          return [{ id: 'summary', primary: player, secondary: team, value: report?.grade ?? '—', meta: `score ${fmt(report?.score)}` }]
        }
        return breakdown.map((b, i) => ({
          id: `${i}`,
          primary: b.label,
          secondary: player,
          value: fmt(b.points),
          meta: `rate ${fmt(b.rate)}`,
        }))
      }
      case 'mlb_hr': {
        return (result.payload.results ?? []).map((r, i) => {
          const isTrend = 'matches' in r && Array.isArray((r as { matches?: unknown }).matches)
          const trend = r as { met_count?: number; window?: number }
          const compute = r as { hr_count?: number; total_ft?: number; games?: number }
          return {
            id: `${i}`,
            primary: r.player,
            secondary: r.team,
            value: isTrend ? `met=${fmt(trend.met_count)}` : `${fmt(compute.hr_count)} HR`,
            meta: isTrend ? undefined : `${fmt(compute.total_ft)} ft · ${fmt(compute.games)}g`,
          }
        })
      }
      case 'mlb_first_pa': {
        return (result.payload.results ?? []).map((r, i) => ({
          id: `${i}`,
          primary: r.player,
          secondary: r.team,
          value: `met=${fmt(r.met_count)}`,
        }))
      }
      case 'mlb_team_runs': {
        const statField = (result.payload.query as { stat?: string })?.stat
        const unit = statField === 'runs_allowed' ? 'allowed' : 'runs'
        return (result.payload.results ?? []).map((r, i) => {
          const trend = r as { met_count?: number; window?: number }
          const compute = r as { total?: number; games?: number; avg?: number }
          const isTrend = trend.met_count != null
          return {
            id: `${i}`,
            primary: r.team,
            value: isTrend ? `met=${fmt(trend.met_count)}` : `${fmt(compute.total)} ${unit}`,
            meta: isTrend ? undefined : compute.games != null ? `${fmt(compute.games)}g · avg ${fmt(compute.avg)}` : undefined,
          }
        })
      }
      case 'nfl_explosive': {
        // Trend: `met` is a count of qualifying games (unitless, shown as
        // met/window already). Compute: `value` is the count of qualifying
        // explosive plays for the season — "plays", not yards (total yards
        // on those plays is a separate `yards` field, surfaced in meta).
        return (result.payload.results ?? []).map((r, i) => {
          const isCompute = r.value != null && !r.matches
          const count = r.met ?? r.met_count ?? r.value
          return {
            id: `${i}`,
            primary: r.player,
            secondary: r.team,
            value: count != null ? (isCompute ? `${fmt(count)} plays` : `met=${fmt(count)}`) : '—',
            meta:
              isCompute && r.yards != null
                ? `${fmt(r.yards)} total yds${r.games != null ? ` · ${fmt(r.games)}g` : ''}`
                : r.games != null
                ? `${fmt(r.games)}g`
                : r.window != null
                ? `window ${fmt(r.window)}`
                : undefined,
          }
        })
      }
      case 'generic':
      default: {
        return (result.rows ?? []).map((r, i) => {
          // Trend rows carry a per-game breakdown (date + value + label per
          // match, date already disambiguated with a year suffix upstream in
          // extractDateToken) — `total` there is the met-count (how many
          // games satisfied the threshold), NOT a stat total, so it must
          // NEVER be labeled with the stat unit ("4 hits" reads as a compute
          // total of 4 hits, which is wrong — it's "met the threshold in 4
          // games"). Compute rows have no per-game breakdown at all — a bare
          // season/window total is the correct and only reading there, so
          // that's the one case that gets the "N unit" label.
          const matches = r.matchDetails ?? []
          const isTrend = matches.length > 0
          const unit = matches[0]?.statLabel ?? statLabel ?? ''
          const meta =
            matches.length > 0
              ? matches.map((m) => `${m.value}${m.statLabel} ${m.date}`).join(' · ')
              : r.streakDetails?.length
              ? `${r.streakDetails.length} streak(s)`
              : undefined
          return {
            id: `${i}`,
            primary: r.player,
            secondary: r.team,
            value: isTrend ? `met=${fmt(r.total)}` : unit ? `${fmt(r.total)} ${unit}` : fmt(r.total),
            meta,
          }
        })
      }
    }
  } catch (err) {
    console.error('deriveRows failed for kind', result.kind, err)
    return []
  }
}

// A ranked leaderboard payload gets rank numbers by default; every other
// Phase-1 kind renders as a plain ordered list.
function defaultShowRank(kind: NspeResult['kind']): boolean {
  return kind === 'mlb_report_leaderboard'
}

export interface LeaderboardListProps {
  result: NspeResult
  showRank?: boolean
  /** Unit label for the generic case's bare compute totals, e.g. "hits". */
  statLabel?: string
}

export function LeaderboardList({ result, showRank, statLabel }: LeaderboardListProps) {
  const [expanded, setExpanded] = useState(false)
  const rows = deriveRows(result, statLabel)
  const rank = showRank ?? defaultShowRank(result.kind)
  const visible = expanded ? rows : rows.slice(0, INITIAL_VISIBLE)
  const hiddenCount = rows.length - visible.length

  if (rows.length === 0) {
    return (
      <div className="font-mono text-[12px] text-center py-10" style={{ color: C.textDim }}>
        no rows to display for this result
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-1.5">
        {visible.map((row, i) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
            style={{ backgroundColor: C.surface2, borderColor: C.border }}
          >
            {rank && (
              <div
                className="font-mono text-[11px] font-bold w-6 text-center flex-none"
                style={{ color: C.accent }}
              >
                {i + 1}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[13px] truncate" style={{ color: C.textBright }}>
                {row.primary}
              </div>
              {(row.secondary || row.meta) && (
                <div className="font-mono text-[10px] truncate" style={{ color: C.textDim }}>
                  {[row.secondary, row.meta].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            <div className="font-mono text-[13px] font-bold flex-none" style={{ color: C.accent }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full mt-2 py-2 font-mono text-[11px] rounded-lg border"
          style={{ backgroundColor: 'transparent', borderColor: C.border, color: C.textDim }}
        >
          {hiddenCount} more · tap to expand
        </button>
      )}
    </div>
  )
}
