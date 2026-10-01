// Shared sortable/grouped stat-grid table — the exact visual template
// QbChartsPage.tsx (NFL's {chart}) established: click any column header to
// sort by it (desc first, asc on a second click), optional group headers
// spanning consecutive columns, sticky header rows, zebra-striped body,
// player names linked to /database/{slug} when the live index has a match.
//
// Extracted fresh for the NBA/MLB/NHL charts pages the owner asked to be
// "uniform to the NFL format" rather than refactoring QbChartsPage.tsx to
// use this — that page is already live and most-visited; this file has zero
// chance of touching its behavior. If NFL's page ever needs a real change to
// this same table logic, moving it onto this shared component then is a
// reasonable follow-up, not a prerequisite for shipping these three.
import { useMemo, useState } from 'react'

export const CHART_COLORS = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  surface: 'oklch(0.10 0 0)',
  surface2: 'oklch(0.15 0 0)',
  border: 'oklch(0.25 0 0)',
  // Bumped to match textBright — grey text site-wide was hard to read
  // (2026-10-01), owner wants white.
  textDim: 'oklch(0.90 0 0)',
  textBright: 'oklch(0.90 0 0)',
}

export interface StatChartColumn<T> {
  key: string
  label: string
  /** Consecutive columns sharing the same group label get one spanning
   * header above their own — same as NFL's "20-29 yd plays" spanning its
   * count/TD/yards trio. */
  group?: string
  // `null` means "no data for this player," distinct from a real 0 — e.g.
  // NBA's per-quarter scoring isn't tracked for most players yet (reported
  // 2026-09-30: Deni Avdija/Jay Huff showing 0 across every quarter despite
  // real minutes, silently ranking last in a sortable column). Renders as
  // "—" and always sorts to the bottom regardless of sort direction.
  get: (row: T) => number | string | null
  numeric?: boolean
  /** Overrides the plain value for this one column (e.g. the player-name
   * cell, linked when a slug is known) — every other column just renders
   * `get(row)` as-is. */
  renderCell?: (row: T, value: number | string | null) => React.ReactNode
  /** Cell text color override — e.g. NFL's "green when this TD column is
   * greater than zero" treatment. Falls back to textBright. */
  cellColor?: (row: T, value: number | string | null) => string | undefined
  /** Marks a raw threshold-game *count* column as convertible to a rate —
   * reported 2026-09-30: "Giannis (36 GP) looks worse than he is next to
   * guys with 70 GP. A count/% toggle fixes that." `rateOf(row)` supplies
   * the denominator (almost always games played). Only used when the
   * table's count/% toggle (auto-shown whenever any column has this) is
   * switched to "%" — sorts and displays as `(count / rateOf(row)) * 100`,
   * one decimal, with a trailing "%". Columns without this are unaffected
   * by the toggle (GP itself, season totals like TB/PIM, etc. stay counts). */
  rateOf?: (row: T) => number
}

export function SortableStatChart<T>({
  columns,
  rows,
  rowKey,
  defaultSortKey,
  defaultSortDir = 'desc',
}: {
  columns: StatChartColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  defaultSortKey: string
  defaultSortDir?: 'asc' | 'desc'
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
  const hasRateColumns = useMemo(() => columns.some((c) => c.rateOf), [columns])
  const [rateMode, setRateMode] = useState(false)

  // The value actually sorted/displayed for a cell — the raw count, or (in
  // rate mode, for a column that opts in via rateOf) that count as a percent
  // of its denominator. One decimal; a zero denominator reads as "no data"
  // rather than a division-by-zero NaN/Infinity.
  const cellValue = (col: StatChartColumn<T>, row: T): number | string | null => {
    const raw = col.get(row)
    if (rateMode && col.rateOf && typeof raw === 'number') {
      const denom = col.rateOf(row)
      if (!denom) return null
      return Math.round((raw / denom) * 1000) / 10
    }
    return raw
  }

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = cellValue(col, a)
      const bv = cellValue(col, b)
      // Missing data always sinks to the bottom regardless of sort
      // direction — an ascending sort shouldn't put "no data" at the top
      // just because null reads as "smaller than everything."
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, sortKey, sortDir, rateMode])

  const onSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const groupSpans: Array<{ label: string | null; span: number }> = []
  const groupStartKeys = new Set<string>()
  let prevGroup: string | null | undefined = undefined
  for (const col of columns) {
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
  const C = CHART_COLORS

  return (
    <div>
      {hasRateColumns && (
        <div className="flex items-center gap-2 mb-2 font-mono text-[11px]" style={{ color: C.textDim }}>
          <span>threshold columns:</span>
          <button
            type="button"
            onClick={() => setRateMode(false)}
            className="px-2 py-0.5 rounded transition-opacity hover:opacity-80"
            style={{
              backgroundColor: !rateMode ? 'oklch(0.20 0.03 195)' : C.surface2,
              color: !rateMode ? C.accent : C.textDim,
              border: `1px solid ${C.border}`,
            }}
          >
            count
          </button>
          <button
            type="button"
            onClick={() => setRateMode(true)}
            className="px-2 py-0.5 rounded transition-opacity hover:opacity-80"
            style={{
              backgroundColor: rateMode ? 'oklch(0.20 0.03 195)' : C.surface2,
              color: rateMode ? C.accent : C.textDim,
              border: `1px solid ${C.border}`,
            }}
          >
            % of GP
          </button>
        </div>
      )}
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
          {columns.map((col) => (
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
          <tr key={rowKey(r)} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'oklch(0.12 0 0)' }}>
            <td className="px-2 py-1.5" style={{ color: C.textDim, borderBottom: `1px solid ${C.border}` }}>
              {i + 1}
            </td>
            {columns.map((col) => {
              const v = cellValue(col, r)
              const isRateCell = rateMode && !!col.rateOf && typeof v === 'number'
              return (
                <td
                  key={col.key}
                  className={`px-2 py-1.5 whitespace-nowrap ${col.numeric ? 'text-right' : 'text-left'}`}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    color: col.cellColor?.(r, v) ?? C.textBright,
                    ...dividerStyle(col.key),
                  }}
                >
                  {v == null ? (
                    <span style={{ color: C.textDim }}>—</span>
                  ) : col.renderCell ? (
                    col.renderCell(r, v)
                  ) : isRateCell ? (
                    `${v}%`
                  ) : (
                    v
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  )
}
