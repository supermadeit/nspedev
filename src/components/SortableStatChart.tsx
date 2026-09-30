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
  textDim: 'oklch(0.50 0 0)',
  textBright: 'oklch(0.90 0 0)',
}

export interface StatChartColumn<T> {
  key: string
  label: string
  /** Consecutive columns sharing the same group label get one spanning
   * header above their own — same as NFL's "20-29 yd plays" spanning its
   * count/TD/yards trio. */
  group?: string
  get: (row: T) => number | string
  numeric?: boolean
  /** Overrides the plain value for this one column (e.g. the player-name
   * cell, linked when a slug is known) — every other column just renders
   * `get(row)` as-is. */
  renderCell?: (row: T, value: number | string) => React.ReactNode
  /** Cell text color override — e.g. NFL's "green when this TD column is
   * greater than zero" treatment. Falls back to textBright. */
  cellColor?: (row: T, value: number | string) => string | undefined
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

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = col.get(a)
      const bv = col.get(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, columns, sortKey, sortDir])

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
              const v = col.get(r)
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
                  {col.renderCell ? col.renderCell(r, v) : v}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
