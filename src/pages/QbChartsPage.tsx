// {chart} — 2025 QB pass-yards + explosive-play chart. Desktop-first: full
// column set, ESPN-style sortable stat grid (click a header, it re-sorts
// descending by that column; click again for ascending). Mobile isn't
// getting its own condensed layout yet (explicitly deferred — see the
// conversation this was built from), so this only guards against actually
// breaking on a narrow screen via horizontal scroll, not a redesign.
//
// Data source: qb-explosives-2025.json, a stable copy of the sample dataset
// used to design this page — 2025 is stale/full-roster (65 QBs, starters and
// backups alike). Swap this import for the real 2026 starters-only feed once
// the backend ships it; nothing else about this page should need to change,
// since the column defs read off the same shape.
import { useMemo, useState } from 'react'
import qbData from '@/assets/data/qb-explosives-2025.json'
import { normalizeDisplayPlayer } from '@/lib/nspe-payloads'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  amber: 'oklch(0.80 0.18 60)',
  surface: 'oklch(0.10 0 0)',
  surface2: 'oklch(0.15 0 0)',
  border: 'oklch(0.25 0 0)',
  textDim: 'oklch(0.50 0 0)',
  textBright: 'oklch(0.90 0 0)',
}

interface ExplosiveBand {
  count: number
  td: number
  yards: number
}

interface QbRow {
  player_name: string
  team: string
  quarter_yards: { q1: number; q2: number; q3: number; q4: number; '1h': number; '2h': number }
  explosive: { '20-29': ExplosiveBand; '30-39': ExplosiveBand; '40-49': ExplosiveBand; '50+': ExplosiveBand }
}

const RAW_PLAYERS = (qbData as { season: number; players: QbRow[] }).players
const SEASON = (qbData as { season: number }).season
const BANDS: Array<keyof QbRow['explosive']> = ['20-29', '30-39', '40-49', '50+']

interface DerivedRow {
  player: string
  team: string
  q1: number
  q2: number
  q3: number
  q4: number
  h1: number
  h2: number
  bands: Record<string, ExplosiveBand>
  totalPlays: number
  totalYards: number
  totalTd: number
}

const ROWS: DerivedRow[] = RAW_PLAYERS.map((p) => {
  const bandEntries = BANDS.map((b) => p.explosive[b])
  return {
    player: normalizeDisplayPlayer(p.player_name),
    team: p.team,
    q1: p.quarter_yards.q1,
    q2: p.quarter_yards.q2,
    q3: p.quarter_yards.q3,
    q4: p.quarter_yards.q4,
    h1: p.quarter_yards['1h'],
    h2: p.quarter_yards['2h'],
    bands: p.explosive,
    totalPlays: bandEntries.reduce((s, b) => s + b.count, 0),
    totalYards: bandEntries.reduce((s, b) => s + b.yards, 0),
    totalTd: bandEntries.reduce((s, b) => s + b.td, 0),
  }
})

interface ColumnDef {
  key: string
  label: string
  group?: string
  get: (r: DerivedRow) => number | string
  numeric?: boolean
}

const COLUMNS: ColumnDef[] = [
  { key: 'player', label: 'Player', get: (r) => r.player },
  { key: 'team', label: 'Team', get: (r) => r.team },
  { key: 'q1', label: 'Q1', group: 'Pass yds / quarter', get: (r) => r.q1, numeric: true },
  { key: 'q2', label: 'Q2', group: 'Pass yds / quarter', get: (r) => r.q2, numeric: true },
  { key: 'q3', label: 'Q3', group: 'Pass yds / quarter', get: (r) => r.q3, numeric: true },
  { key: 'q4', label: 'Q4', group: 'Pass yds / quarter', get: (r) => r.q4, numeric: true },
  { key: 'h1', label: '1H', group: 'Pass yds / quarter', get: (r) => r.h1, numeric: true },
  { key: 'h2', label: '2H', group: 'Pass yds / quarter', get: (r) => r.h2, numeric: true },
  // The count column's label reads the band's own shorthand ("30" for the
  // 30-39 band) rather than a generic "Ct" — the header above it already
  // says "yd plays", so the number here is what actually needs to be tied to
  // its category at a glance.
  ...BANDS.flatMap((b): ColumnDef[] => [
    { key: `${b}-count`, label: b.split(/[-+]/)[0], group: `${b} yd plays`, get: (r) => r.bands[b].count, numeric: true },
    { key: `${b}-td`, label: 'TD', group: `${b} yd plays`, get: (r) => r.bands[b].td, numeric: true },
    { key: `${b}-yards`, label: 'Yds', group: `${b} yd plays`, get: (r) => r.bands[b].yards, numeric: true },
  ]),
  { key: 'totalPlays', label: 'Plays', group: 'Explosive totals', get: (r) => r.totalPlays, numeric: true },
  { key: 'totalTd', label: 'TD', group: 'Explosive totals', get: (r) => r.totalTd, numeric: true },
  { key: 'totalYards', label: 'Yds', group: 'Explosive totals', get: (r) => r.totalYards, numeric: true },
]

export default function QbChartsPage() {
  const [sortKey, setSortKey] = useState('totalYards')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey)
    if (!col) return ROWS
    const copy = [...ROWS]
    copy.sort((a, b) => {
      const av = col.get(a)
      const bv = col.get(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [sortKey, sortDir])

  const onSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // Group headers span consecutive columns sharing the same `group` label —
  // walk COLUMNS once to compute each group's column count, and the key of
  // the first column in each group (a divider renders on those, in both the
  // header and body, so it's visually unambiguous which columns a category
  // header owns instead of relying on the label alone).
  const groupSpans: Array<{ label: string | null; span: number }> = []
  const groupStartKeys = new Set<string>()
  let prevGroup: string | null | undefined = undefined
  for (const col of COLUMNS) {
    const g = col.group ?? null
    if (g !== prevGroup) {
      groupStartKeys.add(col.key)
      groupSpans.push({ label: g, span: 1 })
    } else {
      groupSpans[groupSpans.length - 1].span += 1
    }
    prevGroup = g
  }
  const dividerStyle = (key: string) => (groupStartKeys.has(key) ? { borderLeft: `1px solid oklch(0.38 0 0)` } : {})

  return (
    // h-dvh + overflow-y-auto here (not min-h-screen relying on normal page
    // scroll) because the global `body` rule in index.css is
    // `overflow: hidden` — every other scrollable surface in this app
    // (MobileCalculatorApp, BuilderScreen, ResultsScreen) already has to
    // establish its own scroll container for the same reason.
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <span className="font-mono font-bold text-[15px]" style={{ color: C.accent }}>
            {'{chart}'}
          </span>
          <span className="ml-2 font-mono text-[12px]" style={{ color: C.textDim }}>
            {SEASON} QB pass yds / quarter · explosive pass plays by distance band
          </span>
        </div>
        <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
          {'{homepage}'}
        </a>
      </div>

      <div className="px-6 py-3 font-mono text-[11px]" style={{ color: C.textDim }}>
        {ROWS.length} QBs · click any column to sort · TD counts are explosive-play TDs only, not season pass TD totals
      </div>

      <div className="px-6 pb-10 overflow-x-auto">
        <table className="border-collapse font-mono text-[12px]" style={{ minWidth: '100%' }}>
          <thead>
            <tr>
              <th
                className="sticky top-0 px-2 py-1.5 text-left"
                style={{ backgroundColor: C.surface2, borderBottom: `1px solid ${C.border}`, color: C.textDim }}
              >
                #
              </th>
              {groupSpans.map((g, i) => (
                <th
                  key={i}
                  colSpan={g.span}
                  className="sticky top-0 px-2 py-1.5 text-center text-[12px] uppercase tracking-widest font-bold"
                  style={{
                    backgroundColor: C.surface2,
                    borderBottom: `1px solid ${C.border}`,
                    borderLeft: g.label ? `1px solid oklch(0.38 0 0)` : undefined,
                    color: C.textBright,
                  }}
                >
                  {g.label ?? ''}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky top-[26px] px-2 py-1.5" style={{ backgroundColor: C.surface2, borderBottom: `1px solid ${C.border}` }} />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className={`sticky top-[26px] px-2 py-1.5 whitespace-nowrap cursor-pointer select-none hover:opacity-80 transition-opacity ${col.numeric ? 'text-right' : 'text-left'}`}
                  style={{
                    backgroundColor: sortKey === col.key ? 'oklch(0.20 0.03 195)' : C.surface2,
                    borderBottom: `1px solid ${C.border}`,
                    color: sortKey === col.key ? C.accent : C.textBright,
                    fontWeight: sortKey === col.key ? 700 : 500,
                    ...dividerStyle(col.key),
                  }}
                >
                  {col.label}
                  {sortKey === col.key && <span style={{ color: C.textDim }}>{sortDir === 'desc' ? ' ▾' : ' ▴'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={`${r.player}-${r.team}`} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'oklch(0.12 0 0)' }}>
                <td className="px-2 py-1.5" style={{ color: C.textDim, borderBottom: `1px solid ${C.border}` }}>
                  {i + 1}
                </td>
                {COLUMNS.map((col) => {
                  const v = col.get(r)
                  const isTdCol = col.label === 'TD'
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 whitespace-nowrap ${col.numeric ? 'text-right' : 'text-left'}`}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        color: col.key === 'player' ? C.accent : isTdCol && typeof v === 'number' && v > 0 ? C.amber : C.textBright,
                        ...dividerStyle(col.key),
                      }}
                    >
                      {v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
