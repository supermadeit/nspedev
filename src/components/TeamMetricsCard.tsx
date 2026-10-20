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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { C } from '@/components/ProfileSections'
import {
  normalizeAllowsInstance,
  normalizeTeamMetricsRecord,
  type TeamMetricsAllowsEntry,
  type TeamMetricsPayload,
  type TeamMetricsValue,
} from '@/lib/databaseApi'
import { useAuth } from '@/context/AuthContext'
import { PocketError, pocketShareUrl, saveTeamMetricsStatPocket, type TeamMetricsStatSnapshot } from '@/lib/pockets'

const DANGER = 'oklch(0.75 0.15 30)'

function buildStatSnapshot(payload: TeamMetricsPayload, teamLabel: string, stat: TeamMetricsAllowsEntry): TeamMetricsStatSnapshot {
  return { sport: payload.sport, team: payload.team, teamLabel, window: payload.window, games: payload.games, stat }
}

type SaveStatus = 'saving' | 'saved' | 'error'

// Shared by both the compact chip grid and the single-team detail panel
// below — "save this one stat as a shareable link" (owner ask, 2026-10-19).
// Saves AND copies the share link in one click rather than a save-then-go-
// share-it-separately flow, since the whole point is one-click shareability;
// see saveTeamMetricsStatPocket's own comment for why it defaults public.
function useSaveStatPocket() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<Record<string, { status: SaveStatus; message: string }>>({})

  const save = (key: string, snapshot: TeamMetricsStatSnapshot) => {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    setState((s) => ({ ...s, [key]: { status: 'saving', message: 'saving…' } }))
    void saveTeamMetricsStatPocket(snapshot)
      .then(async (pocket) => {
        let message = 'link copied ✓'
        try {
          await navigator.clipboard.writeText(pocketShareUrl(pocket.id, pocket.kind))
        } catch {
          message = 'saved (copy failed)'
        }
        setState((s) => ({ ...s, [key]: { status: 'saved', message } }))
      })
      .catch((e) => {
        setState((s) => ({ ...s, [key]: { status: 'error', message: e instanceof PocketError ? e.message : 'could not save' } }))
      })
      .finally(() => {
        window.setTimeout(() => {
          setState((s) => {
            const next = { ...s }
            delete next[key]
            return next
          })
        }, 2600)
      })
  }

  return { saveState: state, save }
}

export interface TeamMetricsFieldDef {
  key: string
  label: string
  /** Consecutive fields sharing a group render under one spanning heading
   * (same convention as SortableStatChart's column groups). */
  group?: string
  /** Only for array-valued metrics (NBA's points_by_quarter, NHL's
   * goals_by_period, MLB's runs_by_inning) — labels each position in the
   * array, e.g. ['Q1','Q2','Q3','Q4']. Ignored for plain-number metrics. */
  periodLabels?: string[]
  /** Overrides the default "whole numbers stay whole, else 1 decimal"
   * formatting — needed for MLB's rate stats (batting_avg/OBP/SLG/OPS at
   * .246-style 3 decimals, ERA/WHIP at 2), where the default 1-decimal
   * rounding (0.246 -> "0.2") would destroy the actual stat. Per
   * nspe-v2-da 2026-10-01. */
  decimals?: number
}

function formatNumber(n: number, decimals?: number): string {
  if (decimals != null) return n.toFixed(decimals)
  // Whole numbers (games counts that snuck through, etc.) stay whole;
  // everything else — these are almost all per-game averages or
  // percentages — gets one decimal, which is what every example payload's
  // own precision actually supports reading at a glance.
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function formatValue(v: TeamMetricsValue, periodLabels?: string[], decimals?: number): string {
  if (v == null) return '—'
  if (Array.isArray(v)) {
    return v.map((n, i) => `${periodLabels?.[i] ?? `#${i + 1}`} ${n == null ? '—' : formatNumber(n, decimals)}`).join('  ·  ')
  }
  return formatNumber(v, decimals)
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
            <span className="ml-1" style={{ color: C.textBright }}>({entry.unit})</span>
          </div>
          <div className="font-mono text-[11px]" style={{ color: C.accent }}>for: {formatValue(entry.for, field.periodLabels, field.decimals)}</div>
          {entry.against !== undefined && (
            <div className="font-mono text-[11px]" style={{ color: C.textDim }}>against: {formatValue(entry.against, field.periodLabels, field.decimals)}</div>
          )}
        </div>
      ) : (
        <>
          <span className="font-mono text-[12px] truncate" style={{ color: C.textDim }}>{field.label}</span>
          <span className="font-mono text-[13px] font-bold text-right" style={{ color: C.accent }}>{formatValue(entry.for, undefined, field.decimals)}</span>
          <span className="font-mono text-[13px] text-right" style={{ color: entry.against === undefined ? 'transparent' : C.textDim }}>
            {entry.against === undefined ? '—' : formatValue(entry.against, undefined, field.decimals)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-right whitespace-nowrap" style={{ color: C.textBright }}>
            {entry.unit}
          </span>
        </>
      )}
      {entry.note && (
        <div className="col-span-full font-mono text-[10px] italic" style={{ color: C.textBright }}>{entry.note}</div>
      )}
    </div>
  )
}

export function TeamMetricsCard({
  payload,
  teamLabel,
  fieldGroups,
  allowsLabel = 'opponent thresholds allowed',
  hideAllows = false,
  collapsibleAllows = false,
}: {
  payload: TeamMetricsPayload
  teamLabel: string
  fieldGroups: TeamMetricsFieldDef[]
  allowsLabel?: string
  /** Single-team mode moves this section out into its own expanded
   * OpponentThresholdsPanel (see below) rather than the compact inline
   * version here — set when that panel is rendering alongside this card so
   * the same data doesn't show twice. */
  hideAllows?: boolean
  /** nba/mlb/nhl carry enough threshold categories that showing every
   * value at once pushes the rest of the page down and makes scrolling
   * past it a chore (owner ask, 2026-10-19); nfl has few enough it's left
   * fully expanded. The menu of categories always shows in full — this
   * only gates the VALUE within each one, revealed per-category on click
   * (not a whole-section collapse — corrected 2026-10-19, this is also the
   * shape a future per-category subscription gate will slot into). */
  collapsibleAllows?: boolean
}) {
  const record = normalizeTeamMetricsRecord(payload.record)
  const allowsEntries = Object.entries(payload.allows ?? {})
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const { saveState, save } = useSaveStatPocket()

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
        {/* "for"/"vs"/"unit" tested as unclear (reported 2026-10-04,
            screenshot) — a reader had no way to tell "vs" meant "what this
            team allows" rather than a generic comparison marker. "for" now
            matches the color of the bold cyan value it sits over (same cyan
            = "this team produces" cue MetricRow already uses below it);
            "unit" -> "allowed" since the white number + its unit abbreviation
            right under it (e.g. "417.3 AVG/GM") read together as one idea —
            what the opponent put up against this team. */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 pb-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: C.textBright }}>
          <span />
          <span className="text-right font-bold" style={{ color: C.accent }}>for</span>
          <span className="text-right">vs</span>
          <span className="text-right">allowed</span>
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

      {!hideAllows && allowsEntries.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface2 }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: C.textDim }}>{allowsLabel}</div>
          <div className="flex flex-wrap gap-2">
            {allowsEntries.map(([key, a]) => {
              const isOpen = !collapsibleAllows || openKeys.has(key)
              const saved = saveState[key]
              return (
                <div key={key} className="rounded px-2.5 py-1.5" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                  <button
                    type="button"
                    onClick={collapsibleAllows ? () => toggleKey(key) : undefined}
                    className="block w-full text-left"
                    style={{ cursor: collapsibleAllows ? 'pointer' : 'default' }}
                  >
                    <div className="font-mono text-[11px]" style={{ color: C.textBright }}>{a.label}</div>
                    {isOpen ? (
                      <div className="font-mono text-[13px] font-bold" style={{ color: C.accent }}>
                        {a.pct}% <span className="font-normal text-[10px]" style={{ color: C.textDim }}>({a.count}/{a.games})</span>
                      </div>
                    ) : (
                      <div className="font-mono text-[10px] italic" style={{ color: C.textDim }}>click to view</div>
                    )}
                  </button>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => save(key, buildStatSnapshot(payload, teamLabel, a))}
                      disabled={saved?.status === 'saving'}
                      className="mt-1 font-mono text-[9px] underline disabled:opacity-50"
                      style={{ color: saved?.status === 'error' ? DANGER : C.textDim }}
                    >
                      {saved?.message ?? 'save & share'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {payload.box_score_coverage && (
        <div className="px-4 py-2 font-mono text-[10px] italic" style={{ color: C.textBright, borderTop: `1px solid ${C.border}` }}>
          {payload.box_score_coverage}
        </div>
      )}
    </div>
  )
}

// Single-team mode's expanded "opponent thresholds allowed" — takes over
// the space that's otherwise an unused placeholder on wider viewports once
// {vs. another team}/{vs. a past season} stop needing it for a second card
// (owner ask, 2026-10-16). Same threshold data as the compact version
// inside TeamMetricsCard (hidden there via `hideAllows` when this is
// showing), just given real room: one row per threshold instead of a
// wrapped chip grid, plus the actual opposing players/games that met each
// one (backend's `instances` field, confirmed live 2026-10-16). The
// count-but-no-instances fallback below is now just a defensive guard for
// a genuinely unexpected shape, not an expected "pending backend" state —
// the feature's live on all 4 sports.
export function OpponentThresholdsPanel({
  payload,
  teamLabel,
  allowsLabel = 'opponent thresholds allowed',
  collapsible = false,
}: {
  payload: TeamMetricsPayload
  teamLabel: string
  allowsLabel?: string
  /** See TeamMetricsCard's `collapsibleAllows` — same reasoning, and the
   * same per-category (not whole-section) shape: the full menu of
   * categories always shows, each one's own pct/count/instances detail is
   * what's gated behind its own click (corrected 2026-10-19). This panel
   * carries the per-instance detail, so it's the longer of the two to
   * reveal per click on nba/mlb/nhl. */
  collapsible?: boolean
}) {
  const allowsEntries = Object.entries(payload.allows ?? {})
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const toggleKey = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const { saveState, save } = useSaveStatPocket()

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
      <div className="px-4 py-3" style={{ backgroundColor: C.surface2, borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono font-bold text-[15px]" style={{ color: C.accent }}>{allowsLabel}</span>
          <span className="font-mono text-[11px]" style={{ color: C.textDim }}>{`vs. ${teamLabel}`}</span>
        </div>
      </div>

      {allowsEntries.length === 0 ? (
        <div className="px-4 py-6 font-mono text-[12px] text-center" style={{ color: C.textDim }}>
          No threshold data for this window.
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          {allowsEntries.map(([key, a]) => {
            const isOpen = !collapsible || openKeys.has(key)
            const saved = saveState[key]
            return (
              <div key={key} className="rounded px-3 py-2.5" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
                <button
                  type="button"
                  onClick={collapsible ? () => toggleKey(key) : undefined}
                  className="block w-full text-left"
                  style={{ cursor: collapsible ? 'pointer' : 'default' }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[12px]" style={{ color: C.textBright }}>{a.label}</span>
                    {isOpen ? (
                      <span className="font-mono text-[14px] font-bold" style={{ color: C.accent }}>
                        {a.pct}% <span className="font-normal text-[10px]" style={{ color: C.textDim }}>({a.count}/{a.games} games)</span>
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] italic" style={{ color: C.textDim }}>click to view</span>
                    )}
                  </div>
                  {isOpen && (a.instances && a.instances.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {a.instances.map((inst, i) => {
                        const n = normalizeAllowsInstance(inst)
                        return (
                          <div key={i} className="flex items-baseline justify-between gap-3 font-mono text-[11px]" style={{ color: C.textDim }}>
                            <span>{n.who}{inst.team ? ` (${inst.team})` : ''}</span>
                            <span className="flex items-baseline gap-2">
                              {n.value != null && <span style={{ color: C.textBright }}>{n.value}</span>}
                              {n.date && <span>{n.date}</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : a.count > 0 ? (
                    <div className="mt-1.5 font-mono text-[10px] italic" style={{ color: C.textBright }}>
                      {a.count} of {a.games} games met this — detail unavailable for this entry
                    </div>
                  ) : null)}
                </button>
                {isOpen && (
                  <button
                    type="button"
                    onClick={() => save(key, buildStatSnapshot(payload, teamLabel, a))}
                    disabled={saved?.status === 'saving'}
                    className="mt-2 font-mono text-[10px] underline disabled:opacity-50"
                    style={{ color: saved?.status === 'error' ? DANGER : C.textDim }}
                  >
                    {saved?.message ?? 'save & share'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
