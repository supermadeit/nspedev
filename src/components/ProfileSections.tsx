// Shared section-driven rendering contract, originally built for
// PlayerProfilePage.tsx (/database/:slug) and pulled out here once
// {h2h -staff} needed the exact same "tagged sections, dispatched by type"
// approach for a completely different dataset (a batter's breakdown vs an
// opposing team's pitching staff). Every section is explicitly tagged with
// a `type` naming which of a small fixed set of renderers to use — NOT
// inferred from the data's shape, since duck-typing breaks the moment two
// section types happen to structurally overlap. Any future result that
// needs a full-page/full-overlay treatment should reuse these types before
// inventing a new one.
import type { ReactNode } from 'react'
import { extractDateToken } from '@/lib/nspe-payloads'

export const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  surface: 'oklch(0.10 0 0)',
  surface2: 'oklch(0.15 0 0)',
  border: 'oklch(0.25 0 0)',
  textDim: 'oklch(0.50 0 0)',
  textBright: 'oklch(0.90 0 0)',
}

export type SectionType = 'flat_totals' | 'stat_chips' | 'keyed_entries' | 'band_breakdown' | 'match_list' | 'stat_table'

export interface StatEntry {
  key: string
  label: string
  value: string | number
  accent?: boolean
}

// `width` only matters on desktop (md:) — two consecutive 'half' sections
// pair up side by side (see groupSections), anything else (including a lone
// 'half' with no partner) renders full width. Purely a layout hint, not tied
// to any specific section pairing, so any two sections can opt into it.
export interface FlatTotalsSection {
  type: 'flat_totals'
  label: string
  entries: StatEntry[]
  width?: 'full' | 'half'
}

export interface StatChipsSection {
  type: 'stat_chips'
  label: string
  entries: StatEntry[]
}

export interface KeyedEntry {
  key: string
  label: string
  count: number
  games: { date: string; value: number }[]
}

export interface KeyedEntriesSection {
  type: 'keyed_entries'
  label: string
  entries: KeyedEntry[]
  width?: 'full' | 'half'
}

export interface BandEntry {
  key: string
  groupLabel: string
  shortLabel: string
  count: number
  yards: number
  td?: number
}

export interface BandBreakdownSection {
  type: 'band_breakdown'
  label: string
  entries: BandEntry[]
  width?: 'full' | 'half'
}

export interface MatchListRow {
  date: string
  opponent?: string
  fields: { label: string; value: string | number }[]
}

export interface MatchListSection {
  type: 'match_list'
  label: string
  rows: MatchListRow[]
  width?: 'full' | 'half'
}

// A labeled table — columns + rows + an optional totals row. Generic enough
// for any "breakdown by X" dataset (pitching staff, matchup splits, etc.),
// not tied to any one sport. Rendered with horizontal scroll on narrow
// screens rather than compressing columns, matching /charts' convention.
export interface StatTableColumn {
  key: string
  label: string
}

export interface StatTableRow {
  key: string
  label: string
  values: Array<string | number>
}

export interface StatTableSection {
  type: 'stat_table'
  label: string
  columns: StatTableColumn[]
  rows: StatTableRow[]
  totalsRow?: StatTableRow
  width?: 'full' | 'half'
}

export type ProfileSection =
  | FlatTotalsSection
  | KeyedEntriesSection
  | BandBreakdownSection
  | MatchListSection
  | StatTableSection

// ---------------------------------------------------------------------------
// Renderers — one per SectionType, dispatched by SectionView. These know
// nothing about any specific sport or query engine, only the 6 shapes.
// ---------------------------------------------------------------------------

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[12px] font-bold uppercase tracking-widest mb-2" style={{ color: C.textBright }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded px-3 py-2 min-w-[76px]" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
      <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: C.textDim }}>
        {label}
      </div>
      <div className="font-mono text-[18px] font-bold" style={{ color: accent ? C.green : C.textBright }}>
        {value}
      </div>
    </div>
  )
}

// Smaller than StatCard — used for header chips, where full-size cards
// wouldn't fit squeezed in next to a title.
export function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded px-2 py-1" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
      <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: C.textDim }}>
        {label}
      </div>
      <div className="font-mono text-[13px] font-bold" style={{ color: accent ? C.green : C.textBright }}>
        {value}
      </div>
    </div>
  )
}

function FlatTotalsView({ section }: { section: FlatTotalsSection }) {
  return (
    <div>
      <SectionLabel>{section.label}</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {section.entries.map((e) => (
          <StatCard key={e.key} label={e.label} value={e.value} accent={e.accent} />
        ))}
      </div>
    </div>
  )
}

function KeyedEntriesView({ section }: { section: KeyedEntriesSection }) {
  return (
    <div>
      <SectionLabel>{section.label}</SectionLabel>
      <div className="flex flex-wrap gap-3">
        {section.entries.map((entry) => (
          <div key={entry.key} className="rounded px-3 py-2 max-w-[420px]" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: C.textDim }}>
                {entry.label}
              </span>
              <span className="font-mono text-[16px] font-bold" style={{ color: C.accent }}>
                {entry.count}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px]" style={{ color: C.textDim }}>
              {entry.games.map((g, i) => (
                <span key={i}>
                  <span style={{ color: C.textBright }}>{g.value}</span> {extractDateToken(g.date) ?? g.date}
                  {i < entry.games.length - 1 ? ' ·' : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BandBreakdownView({ section }: { section: BandBreakdownSection }) {
  return (
    <div>
      <SectionLabel>{section.label}</SectionLabel>
      {/* Sized down from StatCard-scale so all bands sit on one row within
          a half-width column instead of wrapping to their own line. */}
      <div className="flex flex-wrap gap-2">
        {section.entries.map((band) => (
          <div key={band.key} className="rounded px-2 py-1.5" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
            <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: C.textDim }}>
              {band.groupLabel}
            </div>
            <div className="flex items-end gap-2">
              <div>
                <div className="font-mono text-[8px] uppercase" style={{ color: C.textDim }}>
                  {band.shortLabel}
                </div>
                <div className="font-mono text-[14px] font-bold" style={{ color: C.textBright }}>
                  {band.count}
                </div>
              </div>
              <div>
                <div className="font-mono text-[8px] uppercase" style={{ color: C.textDim }}>
                  Yds
                </div>
                <div className="font-mono text-[14px] font-bold" style={{ color: C.textBright }}>
                  {band.yards}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchListView({ section }: { section: MatchListSection }) {
  return (
    <div>
      <SectionLabel>{section.label}</SectionLabel>
      <div className="flex flex-col gap-1.5">
        {section.rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded px-3 py-2"
            style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}
          >
            <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
              {extractDateToken(row.date) ?? row.date}
            </span>
            {row.opponent && (
              <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
                {row.opponent}
              </span>
            )}
            <div className="flex gap-2 ml-auto flex-wrap justify-end">
              {row.fields.map((f, j) => (
                <span key={j} className="font-mono text-[11px] font-bold" style={{ color: C.textBright }}>
                  {f.value}
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatTableView({ section }: { section: StatTableSection }) {
  return (
    <div>
      <SectionLabel>{section.label}</SectionLabel>
      <div className="overflow-x-auto rounded" style={{ border: `1px solid ${C.border}` }}>
        <table className="border-collapse font-mono text-[12px]" style={{ minWidth: '100%' }}>
          <thead>
            <tr>
              <th className="px-3 py-1.5 text-left" style={{ backgroundColor: C.surface2, borderBottom: `1px solid ${C.border}`, color: C.textDim }}>
                {section.label.split(' ')[0] || ''}
              </th>
              {section.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-1.5 text-right whitespace-nowrap"
                  style={{ backgroundColor: C.surface2, borderBottom: `1px solid ${C.border}`, color: C.textDim }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, i) => (
              <tr key={row.key} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'oklch(0.13 0 0)' }}>
                <td className="px-3 py-1.5 whitespace-nowrap" style={{ borderBottom: `1px solid ${C.border}`, color: C.accent }}>
                  {row.label}
                </td>
                {row.values.map((v, j) => (
                  <td key={j} className="px-2 py-1.5 text-right whitespace-nowrap" style={{ borderBottom: `1px solid ${C.border}`, color: C.textBright }}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            {section.totalsRow && (
              <tr>
                <td className="px-3 py-1.5 font-bold whitespace-nowrap" style={{ color: C.textBright }}>
                  {section.totalsRow.label}
                </td>
                {section.totalsRow.values.map((v, j) => (
                  <td key={j} className="px-2 py-1.5 text-right font-bold whitespace-nowrap" style={{ color: C.green }}>
                    {v}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SectionView({ section }: { section: ProfileSection }) {
  switch (section.type) {
    case 'flat_totals':
      return <FlatTotalsView section={section} />
    case 'keyed_entries':
      return <KeyedEntriesView section={section} />
    case 'band_breakdown':
      return <BandBreakdownView section={section} />
    case 'match_list':
      return <MatchListView section={section} />
    case 'stat_table':
      return <StatTableView section={section} />
  }
}

// Consecutive 'half'-width sections pair up into a side-by-side row (desktop
// only, via md: on the wrapper) — anything else, including an unpaired
// trailing 'half', renders full width on its own row.
export function groupSections(sections: ProfileSection[]): ProfileSection[][] {
  const groups: ProfileSection[][] = []
  let i = 0
  while (i < sections.length) {
    const current = sections[i]
    const next = sections[i + 1]
    if (current.width === 'half' && next?.width === 'half') {
      groups.push([current, next])
      i += 2
    } else {
      groups.push([current])
      i += 1
    }
  }
  return groups
}

// Convenience wrapper most callers want directly: group + render the full
// section list. Callers with unusual layout needs can still use
// groupSections/SectionView themselves instead of this.
export function SectionStack({ sections }: { sections: ProfileSection[] }) {
  return (
    <div className="space-y-8">
      {groupSections(sections).map((group, i) =>
        group.length === 2 ? (
          <div key={i} className="flex flex-col md:flex-row gap-8">
            {group.map((s) => (
              <div key={s.label} className="md:flex-1">
                <SectionView section={s} />
              </div>
            ))}
          </div>
        ) : (
          <div key={i}>
            <SectionView section={group[0]} />
          </div>
        ),
      )}
    </div>
  )
}
