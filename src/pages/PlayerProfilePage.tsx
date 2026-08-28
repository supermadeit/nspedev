// {database} player profile — reads /database/:slug. Renders the shared
// section-driven contract from @/components/ProfileSections (also used by
// H2hStaffOverlay for {h2h -staff}) rather than a sport-specific layout.
//
// No live per-player endpoint exists yet, so PROFILES_BY_SLUG is still built
// from two bundled globs (qb-profiles/*.json, batter-profiles/*.json), each
// run through its own adapter (adaptQbProfile / adaptBatterProfile) below.
// Both adapters are temporary scaffolding: they exist only because the
// bundled files predate this section-type contract. Once a live endpoint
// ships a payload already shaped as ProfilePayload, delete both adapters and
// their raw globs/interfaces — nothing else in this file changes. Confirmed
// both sports' raw data map onto the same 6 section types (flat_totals,
// keyed_entries, match_list) with zero new types needed — only the field
// names/labels differ per sport, which is exactly what an adapter is for.
import { useParams } from 'react-router-dom'
import { formatBattingAvg, normalizeDisplayPlayer } from '@/lib/nspe-payloads'
import {
  C,
  MiniStat,
  SectionStack,
  type BandBreakdownSection,
  type FlatTotalsSection,
  type KeyedEntriesSection,
  type MatchListSection,
  type ProfileSection,
  type StatChipsSection,
} from '@/components/ProfileSections'

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

const qbProfileModules = import.meta.glob('../assets/data/qb-profiles/*.json', { eager: true }) as Record<
  string,
  { default: RawQbProfile }
>

// ---------------------------------------------------------------------------
// Temporary adapter: bundled batter-profiles/*.json -> ProfilePayload. Same
// deal as adaptQbProfile above — delete once a live endpoint sends the
// tagged shape directly.
// ---------------------------------------------------------------------------

interface RawSeasonSplitEntryGeneric {
  count: number
  games: { date: string; value: number }[]
}

interface RawBatterRecentGame {
  date: string
  date_iso?: string
  opponent?: string
  AB?: number
  R?: number
  H?: number
  '2B'?: number
  '3B'?: number
  HR?: number
  RBI?: number
  BB?: number
  SO?: number
  SB?: number
  TB?: number
}

interface RawHrEvent {
  date: string
  distance_feet: number
  inning?: number
  opponent?: string
}

interface RawFirstPaMatch {
  date: string
  opponent?: string
  inning?: number
  category?: string
  result?: string
  distance_feet?: number | null
  description?: string
}

interface RawBatterProfile {
  player: string
  player_id: string
  team: string
  position: string
  season: number
  sections: {
    season_totals: {
      AB: number
      R: number
      H: number
      '2B': number
      '3B': number
      HR: number
      RBI: number
      BB: number
      SO: number
      SB: number
      TB: number
      avg: number
      obp: number
      slg: number
      ops: number
    }
    season_splits: Record<string, RawSeasonSplitEntryGeneric>
    recent_games: RawBatterRecentGame[]
    career_splits: { splits_single_season: boolean; splits_count: number; splits: { season: number; total: number }[] }
    // Both ship as a real object for most players, but a handful of real
    // files have `hr_distance: {}` / `first_pa: {}` outright (no qualifying
    // events recorded) rather than a zeroed-out shape — Partial reflects
    // that instead of asserting fields that aren't actually always there.
    hr_distance: Partial<{ total_ft: number; hr_count: number; games: number; events: RawHrEvent[] }>
    first_pa: Partial<{ count: number; games_in_window: number; matches: RawFirstPaMatch[] }>
  }
}

// Batter split keys look like "hr_games", "multi_hit_games",
// "rbi_3plus_games" — strip the "_games" suffix (redundant once the count is
// already shown next to the label), then reuse the QB "_Nplus" convention
// for threshold splits. Kept separate from formatSplitLabel (QB's ordering
// puts the threshold first, e.g. "3+ pass rush TD") since there's no
// existing convention to match here and no reason to force one.
const BATTER_SPLIT_ABBR = new Set(['hr', 'rbi', 'bb', 'so', 'sb', 'ab', 'xbh', 'tb'])
function formatBatterSplitLabel(key: string): string {
  const stripped = key.replace(/_games$/, '')
  const m = stripped.match(/^(.+)_(\d+)plus$/)
  if (m) {
    const [, statPart, threshold] = m
    const words = statPart.split('_').map((w) => (BATTER_SPLIT_ABBR.has(w) ? w.toUpperCase() : w))
    return `${words.join(' ')} ${threshold}+`
  }
  const words = stripped.split('_').map((w) => (BATTER_SPLIT_ABBR.has(w) ? w.toUpperCase() : w))
  return words.join(' ')
}

function adaptBatterProfile(raw: RawBatterProfile): ProfilePayload {
  const { season_totals: t, season_splits, recent_games, career_splits, hr_distance: hr, first_pa } = raw.sections

  const seasonTotals: FlatTotalsSection = {
    type: 'flat_totals',
    label: 'Season totals',
    entries: [
      { key: 'avg', label: 'AVG', value: formatBattingAvg(t.avg) },
      { key: 'obp', label: 'OBP', value: formatBattingAvg(t.obp) },
      { key: 'slg', label: 'SLG', value: formatBattingAvg(t.slg) },
      { key: 'ops', label: 'OPS', value: formatBattingAvg(t.ops) },
      { key: 'ab', label: 'AB', value: t.AB },
      { key: 'r', label: 'R', value: t.R },
      { key: 'h', label: 'H', value: t.H },
      { key: '2b', label: '2B', value: t['2B'] },
      { key: '3b', label: '3B', value: t['3B'] },
      { key: 'hr', label: 'HR', value: t.HR, accent: t.HR > 0 },
      { key: 'rbi', label: 'RBI', value: t.RBI },
      { key: 'bb', label: 'BB', value: t.BB },
      { key: 'so', label: 'SO', value: t.SO },
      { key: 'sb', label: 'SB', value: t.SB },
      { key: 'tb', label: 'TB', value: t.TB },
    ],
  }

  const seasonSplits: KeyedEntriesSection = {
    type: 'keyed_entries',
    label: 'Season splits',
    entries: Object.entries(season_splits).map(([key, split]) => ({
      key,
      label: formatBatterSplitLabel(key),
      count: split.count,
      games: split.games,
    })),
  }

  // No per-season backend concept the QB shape has an equivalent for — a
  // straight season-by-season series reuses flat_totals directly (label =
  // year, value = that season's total for whatever stat this split tracks).
  const careerBySeason: FlatTotalsSection = {
    type: 'flat_totals',
    label: 'Career totals by season',
    entries: career_splits.splits.map((s) => ({
      key: String(s.season),
      label: String(s.season),
      value: s.total,
    })),
  }

  // First-PA outcomes pair side-by-side with the HR-distance summary below,
  // mirroring the QB layout's "Pass yds/quarter | Explosive pass plays"
  // half-width row — first_pa is this sport's equivalent "per-something
  // breakdown" slot. Both sections are genuinely absent for some real
  // players (a handful of batter files ship `first_pa: {}` / `hr_distance:
  // {}` — no matches recorded rather than a zeroed shape), so both are
  // built conditionally and dropped from the section list entirely rather
  // than rendering an empty/undefined section. groupSections already
  // handles an unpaired lone 'half' by rendering it full-width, so leaving
  // one out when the other is missing needs no extra layout logic.
  const firstPaOutcomes: MatchListSection | null = Array.isArray(first_pa?.matches)
    ? {
        type: 'match_list',
        label: 'First PA outcomes',
        width: 'half',
        rows: first_pa.matches.map((m) => ({
          date: m.date,
          opponent: m.opponent,
          fields: [
            { label: '', value: m.result ?? m.category ?? '—' },
            ...(m.distance_feet ? [{ label: ' ft', value: m.distance_feet }] : []),
          ],
        })),
      }
    : null

  const hrDistanceSummary: FlatTotalsSection | null =
    typeof hr?.total_ft === 'number'
      ? {
          type: 'flat_totals',
          label: 'HR distance',
          width: 'half',
          entries: [
            { key: 'total_ft', label: 'Total Ft', value: hr.total_ft.toLocaleString() },
            { key: 'hr_count', label: 'HR Count', value: hr.hr_count ?? 0, accent: (hr.hr_count ?? 0) > 0 },
            { key: 'games', label: 'Games', value: hr.games ?? 0 },
          ],
        }
      : null

  const hrLog: MatchListSection | null = Array.isArray(hr?.events)
    ? {
        type: 'match_list',
        label: 'HR log',
        rows: hr.events.map((e) => ({
          date: e.date,
          opponent: e.opponent,
          fields: [
            { label: ' ft', value: e.distance_feet },
            ...(e.inning ? [{ label: ' inn', value: e.inning }] : []),
          ],
        })),
      }
    : null

  const recentGamesLog: MatchListSection = {
    type: 'match_list',
    label: 'Recent games',
    rows: recent_games.map((g) => ({
      date: g.date_iso ?? g.date,
      opponent: g.opponent,
      fields: [
        { label: ' AB', value: g.AB ?? 0 },
        { label: ' H', value: g.H ?? 0 },
        ...(g.HR ? [{ label: ' HR', value: g.HR }] : []),
        ...(g.RBI ? [{ label: ' RBI', value: g.RBI }] : []),
        ...(g['2B'] ? [{ label: ' 2B', value: g['2B'] }] : []),
        ...(g['3B'] ? [{ label: ' 3B', value: g['3B'] }] : []),
        ...(g.BB ? [{ label: ' BB', value: g.BB }] : []),
        ...(g.SO ? [{ label: ' SO', value: g.SO }] : []),
        ...(g.SB ? [{ label: ' SB', value: g.SB }] : []),
      ],
    })),
  }

  return {
    player: normalizeDisplayPlayer(raw.player),
    player_id: raw.player_id,
    team: raw.team,
    position: raw.position,
    season: raw.season,
    sections: (
      [
        seasonTotals,
        seasonSplits,
        careerBySeason,
        firstPaOutcomes,
        hrDistanceSummary,
        hrLog,
        recentGamesLog,
      ] as Array<ProfileSection | null>
    ).filter((s): s is ProfileSection => s !== null),
  }
}

const batterProfileModules = import.meta.glob('../assets/data/batter-profiles/*.json', { eager: true }) as Record<
  string,
  { default: RawBatterProfile }
>

const PROFILES_BY_SLUG: Record<string, ProfilePayload> = {
  ...Object.fromEntries(Object.values(qbProfileModules).map((m) => [m.default.player_id, adaptQbProfile(m.default)])),
  ...Object.fromEntries(
    Object.values(batterProfileModules).map((m) => [m.default.player_id, adaptBatterProfile(m.default)]),
  ),
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

        <div className="px-6 py-6 max-w-[1100px]">
          <SectionStack sections={DATA.sections} />
        </div>
      </div>
    </div>
  )
}
