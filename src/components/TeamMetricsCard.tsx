// {team.metrics} shared rendering — one card = one (team, window) pair's
// full metric breakdown. Deliberately the only piece of UI this feature
// needs beyond a team/window picker: "single team" is just one card, "team
// vs team" and "this season vs a past season" are both just two of these
// cards rendered side by side with different payloads, so there's no
// separate comparison-mode renderer to maintain — see nfl/nba/nhl
// TeamMetricsPage.tsx for how the page assembles 1 or 2 of these.
//
// Per-sport field sets are completely different (NFL has no record block at
// all; NBA/NHL's shooting/special-teams/etc. share nothing) — this file only
// knows how to lay out whatever field list it's given via `fieldGroups`,
// each sport's own page defines that list. Reuses the same CHART_COLORS-
// style token set (`C`) as every other data-dense page (SortableStatChart,
// ProfileSections) for visual consistency.
import { C } from '@/components/ProfileSections'
import {
  normalizeTeamMetricsRecord,
  type TeamMetricsPayload,
  type TeamMetricsValue,
} from '@/lib/databaseApi'

export interface TeamMetricsFieldDef {
  key: string
  label: string
  /** Consecutive fields sharing a group render under one spanning heading
   * (same convention as SortableStatChart's column groups). */
  group?: string
  /** Only for array-valued metrics (NBA's points_by_quarter, NHL's
   * goals_by_period) — labels each position in the array, e.g.
   * ['Q1','Q2','Q3','Q4']. Ignored for plain-number metrics. */
  periodLabels?: string[]
}

function formatNumber(n: number): string {
  // Whole numbers (games counts that snuck through, etc.) stay whole;
  // everything else — these are almost all per-game averages or
  // percentages — gets one decimal, which is what every example payload's
  // own precision actually supports reading at a glance.
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function formatValue(v: TeamMetricsValue, periodLabels?: string[]): string {
  if (v == null) return '—'
  if (Array.isArray(v)) {
    return v.map((n, i) => `${periodLabels?.[i] ?? `#${i + 1}`} ${n == null ? '—' : formatNumber(n)}`).join('  ·  ')
  }
  return formatNumber(v)
}

function MetricRow({ field, metrics }: { field: TeamMetricsFieldDef; metrics: TeamMetricsPayload['metrics'] }) {
  const entry = metrics[field.key]
  if (!entry) return null
  const isList = Array.isArray(entry.for) || Array.isArray(entry.against)
  return (
    <div
      className={`grid items-baseline gap-2 py-1.5 px-1 ${isList ? '' : 'grid-cols-[1fr_auto_auto_auto]'}`}
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      {isList ? (
        <div>
          <div className="font-mono text-[11px] mb-1" style={{ color: C.textDim }}>
            {field.label}
            <span className="ml-1" style={{ color: 'oklch(0.40 0 0)' }}>({entry.unit})</span>
          </div>
          <div className="font-mono text-[11px]" style={{ color: C.accent }}>for: {formatValue(entry.for, field.periodLabels)}</div>
          {entry.against !== undefined && (
            <div className="font-mono text-[11px]" style={{ color: C.textDim }}>against: {formatValue(entry.against, field.periodLabels)}</div>
          )}
        </div>
      ) : (
        <>
          <span className="font-mono text-[12px] truncate" style={{ color: C.textDim }}>{field.label}</span>
          <span className="font-mono text-[13px] font-bold text-right" style={{ color: C.accent }}>{formatValue(entry.for)}</span>
          <span className="font-mono text-[13px] text-right" style={{ color: entry.against === undefined ? 'transparent' : C.textDim }}>
            {entry.against === undefined ? '—' : formatValue(entry.against)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-right whitespace-nowrap" style={{ color: 'oklch(0.40 0 0)' }}>
            {entry.unit}
          </span>
        </>
      )}
      {entry.note && (
        <div className="col-span-full font-mono text-[10px] italic" style={{ color: 'oklch(0.40 0 0)' }}>{entry.note}</div>
      )}
    </div>
  )
}

export function TeamMetricsCard({
  payload,
  teamLabel,
  fieldGroups,
  allowsLabel = 'opponent thresholds allowed',
}: {
  payload: TeamMetricsPayload
  teamLabel: string
  fieldGroups: TeamMetricsFieldDef[]
  allowsLabel?: string
}) {
  const record = normalizeTeamMetricsRecord(payload.record)
  const allowsEntries = Object.entries(payload.allows ?? {})

  // Build group spans the same way SortableStatChart does for its column
  // headers — consecutive fields sharing a `group` get one heading, fields
  // with no group get none.
  const groupedFields: Array<{ group: string | null; fields: TeamMetricsFieldDef[] }> = []
  for (const f of fieldGroups) {
    const g = f.group ?? null
    const last = groupedFields[groupedFields.length - 1]
    if (last && last.group === g) last.fields.push(f)
    else groupedFields.push({ group: g, fields: [f] })
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
      <div className="px-4 py-3" style={{ backgroundColor: C.surface2, borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono font-bold text-[15px]" style={{ color: C.accent }}>{`{${teamLabel}}`}</span>
          <span className="font-mono text-[11px]" style={{ color: C.textDim }}>{payload.window.label} · {payload.games} GM</span>
        </div>
        {record && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[12px]" style={{ color: C.textBright }}>
            <span className="font-bold">{record.record}</span>
            {record.home && <span style={{ color: C.textDim }}>home {record.home}</span>}
            {record.road && <span style={{ color: C.textDim }}>road {record.road}</span>}
            {record.margin != null && (
              <span style={{ color: record.margin >= 0 ? C.green : 'oklch(0.75 0.15 30)' }}>
                {record.margin >= 0 ? `+${record.margin}` : record.margin} margin
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 pb-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: 'oklch(0.38 0 0)' }}>
          <span />
          <span className="text-right">for</span>
          <span className="text-right">vs</span>
          <span className="text-right">unit</span>
        </div>
        {groupedFields.map((g, gi) => (
          <div key={gi}>
            {g.group && (
              <div className="font-mono text-[10px] uppercase tracking-widest mt-2 mb-0.5" style={{ color: C.textDim }}>{g.group}</div>
            )}
            {g.fields.map((f) => <MetricRow key={f.key} field={f} metrics={payload.metrics} />)}
          </div>
        ))}
      </div>

      {allowsEntries.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface2 }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: C.textDim }}>{allowsLabel}</div>
          <div className="flex flex-wrap gap-2">
            {allowsEntries.map(([key, a]) => (
              <div key={key} className="rounded px-2.5 py-1.5" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                <div className="font-mono text-[11px]" style={{ color: C.textBright }}>{a.label}</div>
                <div className="font-mono text-[13px] font-bold" style={{ color: C.accent }}>
                  {a.pct}% <span className="font-normal text-[10px]" style={{ color: C.textDim }}>({a.count}/{a.games})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payload.box_score_coverage && (
        <div className="px-4 py-2 font-mono text-[10px] italic" style={{ color: 'oklch(0.40 0 0)', borderTop: `1px solid ${C.border}` }}>
          {payload.box_score_coverage}
        </div>
      )}
    </div>
  )
}
