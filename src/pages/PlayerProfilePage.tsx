// {database} player profile — first prototype, built against a single real
// sample payload (qb-profile-dak-prescott.json) since there's no live
// per-player endpoint yet (see the conversation this was designed in: the
// backend serves one player per request, not a bulk roster file — this page
// will eventually fetch /database/{slug} live and drop the hardcoded import).
//
// Deliberately reuses QbChartsPage's palette, typography, and conventions
// (bold white category headers, amber for TD>0, the band-shorthand "20/30/
// 40/50" column labels, sortable tables) for brand consistency between the
// two — same terminal aesthetic, same "chart" visual language, since this
// page is meant to read as a sibling of /charts, not a different product.
import { useMemo, useState, type ReactNode } from 'react'
import profileData from '@/assets/data/qb-profile-dak-prescott.json'
import { extractDateToken, normalizeDisplayPlayer } from '@/lib/nspe-payloads'

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

interface RecentGame {
  date: string
  date_iso: string
  venue: string
  opponent: string
  pass_yds: number
  pass_td: number
  pass_int: number
  pass_rtg: number
  rush_yds: number
  rush_td: number
}

interface SeasonSplit {
  season: number
  total: number
}

interface ProfilePayload {
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
    per_quarter: { q1: number; q2: number; q3: number; q4: number; '1h': number; '2h': number }
    explosive: { '20-29': ExplosiveBand; '30-39': ExplosiveBand; '40-49': ExplosiveBand; '50+': ExplosiveBand }
    recent_games: RecentGame[]
    career_splits: { stat: string; splits_count: number; splits: SeasonSplit[] }
  }
}

const DATA = profileData as ProfilePayload
const BANDS: Array<keyof ProfilePayload['sections']['explosive']> = ['20-29', '30-39', '40-49', '50+']

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
      <div className="font-mono text-[18px] font-bold" style={{ color: accent ? C.amber : C.textBright }}>
        {value}
      </div>
    </div>
  )
}

interface GameColumn {
  key: keyof RecentGame | 'date'
  label: string
  get: (g: RecentGame) => number | string
  numeric?: boolean
}

const GAME_COLUMNS: GameColumn[] = [
  { key: 'date', label: 'Date', get: (g) => extractDateToken(g.date_iso ?? g.date) ?? g.date },
  { key: 'venue', label: 'Venue', get: (g) => g.venue },
  { key: 'opponent', label: 'Opp', get: (g) => g.opponent },
  { key: 'pass_yds', label: 'Pass Yds', get: (g) => g.pass_yds, numeric: true },
  { key: 'pass_td', label: 'Pass TD', get: (g) => g.pass_td, numeric: true },
  { key: 'pass_int', label: 'INT', get: (g) => g.pass_int, numeric: true },
  { key: 'pass_rtg', label: 'Rtg', get: (g) => g.pass_rtg, numeric: true },
  { key: 'rush_yds', label: 'Rush Yds', get: (g) => g.rush_yds, numeric: true },
  { key: 'rush_td', label: 'Rush TD', get: (g) => g.rush_td, numeric: true },
]

export default function PlayerProfilePage() {
  const [sortKey, setSortKey] = useState<GameColumn['key']>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { season_totals, per_quarter, explosive, recent_games, career_splits } = DATA.sections
  const compPct = ((season_totals.pass_cmp / season_totals.pass_att) * 100).toFixed(1)

  const sortedGames = useMemo(() => {
    const col = GAME_COLUMNS.find((c) => c.key === sortKey)
    if (!col) return recent_games
    const copy = [...recent_games]
    copy.sort((a, b) => {
      const av = col.get(a)
      const bv = col.get(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [sortKey, sortDir, recent_games])

  const onSortGames = (key: GameColumn['key']) => {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const maxSeasonTotal = Math.max(...career_splits.splits.map((s) => s.total))

  return (
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
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

      <div className="px-6 py-4 flex items-baseline gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="font-mono text-[24px] font-bold" style={{ color: C.textBright }}>
          {normalizeDisplayPlayer(DATA.player)}
        </span>
        <span className="font-mono text-[13px]" style={{ color: C.textDim }}>
          {DATA.team} · {DATA.position}
        </span>
      </div>

      <div className="px-6 py-6 space-y-8 max-w-[1100px]">
        <div>
          <SectionLabel>Season totals</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <StatCard label="Comp / Att" value={`${season_totals.pass_cmp}/${season_totals.pass_att}`} />
            <StatCard label="Comp %" value={`${compPct}%`} />
            <StatCard label="Pass Yds" value={season_totals.pass_yds.toLocaleString()} />
            <StatCard label="Pass TD" value={season_totals.pass_td} accent={season_totals.pass_td > 0} />
            <StatCard label="INT" value={season_totals.pass_int} />
            <StatCard label="Rush Att" value={season_totals.rush_car} />
            <StatCard label="Rush Yds" value={season_totals.rush_yds} />
            <StatCard label="Rush TD" value={season_totals.rush_td} accent={season_totals.rush_td > 0} />
          </div>
        </div>

        <div>
          <SectionLabel>Pass yds / quarter</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <StatCard label="Q1" value={per_quarter.q1} />
            <StatCard label="Q2" value={per_quarter.q2} />
            <StatCard label="Q3" value={per_quarter.q3} />
            <StatCard label="Q4" value={per_quarter.q4} />
            <StatCard label="1H" value={per_quarter['1h']} />
            <StatCard label="2H" value={per_quarter['2h']} />
          </div>
        </div>

        <div>
          <SectionLabel>Explosive pass plays</SectionLabel>
          <div className="flex flex-wrap gap-3">
            {BANDS.map((b) => {
              const band = explosive[b]
              const shortLabel = b.split(/[-+]/)[0]
              return (
                <div key={b} className="rounded px-3 py-2" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
                  <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>
                    {b} yd plays
                  </div>
                  <div className="flex items-end gap-3">
                    <div>
                      <div className="font-mono text-[9px] uppercase" style={{ color: C.textDim }}>
                        {shortLabel}
                      </div>
                      <div className="font-mono text-[16px] font-bold" style={{ color: C.textBright }}>
                        {band.count}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase" style={{ color: C.textDim }}>
                        TD
                      </div>
                      <div className="font-mono text-[16px] font-bold" style={{ color: band.td > 0 ? C.amber : C.textBright }}>
                        {band.td}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase" style={{ color: C.textDim }}>
                        Yds
                      </div>
                      <div className="font-mono text-[16px] font-bold" style={{ color: C.textBright }}>
                        {band.yards}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <SectionLabel>Recent games</SectionLabel>
          <div className="overflow-x-auto">
            <table className="border-collapse font-mono text-[12px]" style={{ minWidth: '100%' }}>
              <thead>
                <tr>
                  {GAME_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => onSortGames(col.key)}
                      className={`px-2 py-1.5 whitespace-nowrap cursor-pointer select-none hover:opacity-80 transition-opacity ${col.numeric ? 'text-right' : 'text-left'}`}
                      style={{
                        backgroundColor: sortKey === col.key ? 'oklch(0.20 0.03 195)' : C.surface2,
                        borderBottom: `1px solid ${C.border}`,
                        color: sortKey === col.key ? C.accent : C.textBright,
                        fontWeight: sortKey === col.key ? 700 : 500,
                      }}
                    >
                      {col.label}
                      {sortKey === col.key && <span style={{ color: C.textDim }}>{sortDir === 'desc' ? ' ▾' : ' ▴'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedGames.map((g, i) => (
                  <tr key={g.date_iso} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'oklch(0.12 0 0)' }}>
                    {GAME_COLUMNS.map((col) => {
                      const v = col.get(g)
                      const isTd = col.key === 'pass_td' || col.key === 'rush_td'
                      return (
                        <td
                          key={col.key}
                          className={`px-2 py-1.5 whitespace-nowrap ${col.numeric ? 'text-right' : 'text-left'}`}
                          style={{
                            borderBottom: `1px solid ${C.border}`,
                            color: isTd && typeof v === 'number' && v > 0 ? C.amber : C.textBright,
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

        <div>
          <SectionLabel>Career — {career_splits.stat.replace('_', ' ')} by season</SectionLabel>
          <div className="flex flex-col gap-1">
            {career_splits.splits.map((s) => (
              <div key={s.season} className="flex items-center gap-3">
                <span className="font-mono text-[12px] w-10 flex-none" style={{ color: C.textDim }}>
                  {s.season}
                </span>
                <div className="flex-1 rounded-sm overflow-hidden" style={{ backgroundColor: C.surface2 }}>
                  <div
                    className="h-[18px] rounded-sm"
                    style={{ width: `${(s.total / maxSeasonTotal) * 100}%`, backgroundColor: 'oklch(0.45 0.10 195)' }}
                  />
                </div>
                <span className="font-mono text-[12px] font-bold w-14 flex-none text-right" style={{ color: C.textBright }}>
                  {s.total.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
