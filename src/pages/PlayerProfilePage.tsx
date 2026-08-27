// {database} player profile — reads /database/:slug. Renders a generic
// section-driven contract (SectionType + ProfileSection below) rather than
// a QB-specific layout: every section is explicitly tagged with a `type`
// naming which of a small fixed set of renderers to use — NOT inferred from
// the data's shape, since duck-typing breaks the moment two section types
// happen to structurally overlap. New sports/positions reuse whichever
// types fit their data (a pitcher's game log is still `match_list`, a
// batter's season totals are still `flat_totals`) — a new page is only
// needed for a shape that genuinely doesn't fit any of these, same escape
// hatch /charts already uses for its own bespoke layout.
//
// No live per-player endpoint exists yet, so PROFILES_BY_SLUG is still
// built from the bundled qb-profiles/*.json glob, run through adaptQbProfile
// below. That adapter is temporary scaffolding: it exists only because the
// 36 bundled files predate this section-type contract. Once a live endpoint
// ships a payload already shaped as ProfilePayload, delete adaptQbProfile
// and the raw glob/interfaces above it — nothing else in this file changes.
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { extractDateToken, normalizeDisplayPlayer } from '@/lib/nspe-payloads'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  surface: 'oklch(0.10 0 0)',
  surface2: 'oklch(0.15 0 0)',
  border: 'oklch(0.25 0 0)',
  textDim: 'oklch(0.50 0 0)',
  textBright: 'oklch(0.90 0 0)',
}

// ---------------------------------------------------------------------------
// Generic section-driven profile contract — this is the shape a live
// per-player backend endpoint should send directly.
// ---------------------------------------------------------------------------

export type SectionType = 'flat_totals' | 'stat_chips' | 'keyed_entries' | 'band_breakdown' | 'match_list'

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

export type ProfileSection = FlatTotalsSection | KeyedEntriesSection | BandBreakdownSection | MatchListSection

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

// ---------------------------------------------------------------------------
// Temporary adapter: bundled qb-profiles/*.json -> ProfilePayload. Delete
// this whole block (and the raw interfaces it uses) once a live endpoint
// sends the tagged shape directly — see file header.
// ---------------------------------------------------------------------------

interface RawExplosiveBand {
  count: number
  td: number
  yards: number
}

interface RawSeasonSplitEntry {
  count: number
  games: { date: string; value: number }[]
}

interface RawNextMatchupTotals {
  pass_yds: number
  pass_td: number
  pass_int: number
  rush_yds: number
  rush_td: number
  pass_rtg: number
  games: number
}

interface RawQbProfile {
  player: string
  player_id: string
  team: string
  position: string
  season: number
  sections: {
    season_totals: {
      pass_cmp: number
      pass_att: number
      pass_yds: number
      pass_td: number
      pass_int: number
      rush_car: number
      rush_yds: number
      rush_td: number
    }
    season_splits: Record<string, RawSeasonSplitEntry>
    per_quarter: { q1: number; q2: number; q3: number; q4: number; '1h': number; '2h': number }
    explosive: Record<'20-29' | '30-39' | '40-49' | '50+', RawExplosiveBand>
    next_matchup_h2h: { next_opponent: string; totals: RawNextMatchupTotals }
  }
}

// "pass_rush_td_3plus" -> "3+ pass rush TD", "pass_rush_yds_300plus" -> "300+
// pass rush yds" — generic so new split keys the backend adds later (other
// stats, other positions) render sensibly without a code change here.
function formatSplitLabel(key: string): string {
  const m = key.match(/^(.+)_(\d+)plus$/)
  if (!m) return key.replace(/_/g, ' ')
  const [, statPart, threshold] = m
  const words = statPart.split('_').map((w) => (w === 'td' ? 'TD' : w))
  return `${threshold}+ ${words.join(' ')}`
}

const EXPLOSIVE_BANDS: Array<'20-29' | '30-39' | '40-49' | '50+'> = ['20-29', '30-39', '40-49', '50+']

function adaptQbProfile(raw: RawQbProfile): ProfilePayload {
  const { season_totals: t, season_splits, per_quarter: q, explosive, next_matchup_h2h: nm } = raw.sections
  const compPct = ((t.pass_cmp / t.pass_att) * 100).toFixed(1)

  const seasonTotals: FlatTotalsSection = {
    type: 'flat_totals',
    label: 'Season totals',
    entries: [
      { key: 'comp_att', label: 'Comp / Att', value: `${t.pass_cmp}/${t.pass_att}` },
      { key: 'comp_pct', label: 'Comp %', value: `${compPct}%` },
      { key: 'pass_yds', label: 'Pass Yds', value: t.pass_yds.toLocaleString() },
      { key: 'pass_td', label: 'Pass TD', value: t.pass_td, accent: t.pass_td > 0 },
      { key: 'pass_int', label: 'INT', value: t.pass_int },
      { key: 'rush_att', label: 'Rush Att', value: t.rush_car },
      { key: 'rush_yds', label: 'Rush Yds', value: t.rush_yds },
      { key: 'rush_td', label: 'Rush TD', value: t.rush_td, accent: t.rush_td > 0 },
    ],
  }

  const seasonSplits: KeyedEntriesSection = {
    type: 'keyed_entries',
    label: 'Season splits',
    entries: Object.entries(season_splits).map(([key, split]) => ({
      key,
      label: formatSplitLabel(key),
      count: split.count,
      games: split.games,
    })),
  }

  const passYdsPerQuarter: FlatTotalsSection = {
    type: 'flat_totals',
    label: 'Pass yds / quarter',
    width: 'half',
    entries: [
      { key: 'q1', label: 'Q1', value: q.q1 },
      { key: 'q2', label: 'Q2', value: q.q2 },
      { key: 'q3', label: 'Q3', value: q.q3 },
      { key: 'q4', label: 'Q4', value: q.q4 },
      { key: '1h', label: '1H', value: q['1h'] },
      { key: '2h', label: '2H', value: q['2h'] },
    ],
  }

  const explosivePlays: BandBreakdownSection = {
    type: 'band_breakdown',
    label: 'Explosive pass plays',
    width: 'half',
    entries: EXPLOSIVE_BANDS.map((b) => ({
      key: b,
      groupLabel: `${b} yd plays`,
      shortLabel: b.split(/[-+]/)[0],
      count: explosive[b].count,
      yards: explosive[b].yards,
    })),
  }

  return {
    player: normalizeDisplayPlayer(raw.player),
    player_id: raw.player_id,
    team: raw.team,
    position: raw.position,
    season: raw.season,
    headerNote: {
      type: 'stat_chips',
      label: `Next opponent — ${nm.next_opponent} (career totals)`,
      entries: [
        { key: 'games', label: 'Games', value: nm.totals.games },
        { key: 'pass_yds', label: 'Pass Yds', value: nm.totals.pass_yds.toLocaleString() },
        { key: 'pass_td', label: 'Pass TD', value: nm.totals.pass_td, accent: nm.totals.pass_td > 0 },
        { key: 'int', label: 'INT', value: nm.totals.pass_int },
        { key: 'rtg', label: 'Rtg', value: nm.totals.pass_rtg },
        { key: 'rush_yds', label: 'Rush Yds', value: nm.totals.rush_yds },
        { key: 'rush_td', label: 'Rush TD', value: nm.totals.rush_td, accent: nm.totals.rush_td > 0 },
      ],
    },
    sections: [seasonTotals, seasonSplits, passYdsPerQuarter, explosivePlays],
  }
}

const profileModules = import.meta.glob('../assets/data/qb-profiles/*.json', { eager: true }) as Record<
  string,
  { default: RawQbProfile }
>
const PROFILES_BY_SLUG: Record<string, ProfilePayload> = Object.fromEntries(
  Object.values(profileModules).map((m) => [m.default.player_id, adaptQbProfile(m.default)]),
)

// ---------------------------------------------------------------------------
// Generic renderers — one per SectionType, dispatched by SectionView. These
// know nothing about QBs or any other sport; they only know the 5 shapes.
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[12px] font-bold uppercase tracking-widest mb-2" style={{ color: C.textBright }}>
      {children}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
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
// wouldn't fit squeezed in next to the player name.
function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
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
            <div className="flex gap-2 ml-auto">
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

function SectionView({ section }: { section: ProfileSection }) {
  switch (section.type) {
    case 'flat_totals':
      return <FlatTotalsView section={section} />
    case 'keyed_entries':
      return <KeyedEntriesView section={section} />
    case 'band_breakdown':
      return <BandBreakdownView section={section} />
    case 'match_list':
      return <MatchListView section={section} />
  }
}

// Consecutive 'half'-width sections pair up into a side-by-side row (desktop
// only, via md: on the wrapper) — anything else, including an unpaired
// trailing 'half', renders full width on its own row.
function groupSections(sections: ProfileSection[]): ProfileSection[][] {
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

export default function PlayerProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const DATA = slug ? PROFILES_BY_SLUG[slug] : undefined

  if (!DATA) {
    return (
      <div
        className="h-dvh w-full flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}
      >
        <span className="font-mono text-[14px]" style={{ color: C.textDim }}>
          no profile found for "{slug}"
        </span>
        <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
          {'{homepage}'}
        </a>
      </div>
    )
  }

  return (
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      <div>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <span className="font-mono font-bold text-[15px]" style={{ color: C.accent }}>
              {'{database}'}
            </span>
            <span className="ml-2 font-mono text-[12px]" style={{ color: C.textDim }}>
              {DATA.season} season profile
            </span>
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

        <div className="px-6 py-6 space-y-8 max-w-[1100px]">
          {groupSections(DATA.sections).map((group, i) =>
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
      </div>
    </div>
  )
}
