// {chart} — NBA. Uniform to NFL's QbChartsPage.tsx template (see
// SortableStatChart.tsx for the shared table itself): a sortable per-player
// grid off nba_scoring_buckets.json, live via the same allowlisted
// /api/data/output/ static-file route NFL's chart already uses.
//
// Per nspe-v2-da (2026-09-30): scoring-only — no per-quarter rebounds/
// assists/blocks/steals exist, just points by quarter/half/OT plus full-game
// threshold bands (points/rebounds/assists/PRA) and season defensive totals.
// Assist-vs-turnover ratio isn't here — no per-player turnover data exists
// anywhere on file yet (waiting on scrape-room's per-player box-score work).
// 470 players, no minimum-games floor.
import { useEffect, useMemo, useState } from 'react'
import { fetchNbaScoringBuckets, type NbaScoringBucketRow, type NbaScoringBucketsData } from '@/lib/databaseApi'
import { normalizeDisplayPlayer } from '@/lib/nspe-payloads'
import { loadPlayerIndex, PLAYER_INDEX, normalizePlayerKey } from '@/lib/playerSearch'
import { SportsSwitcher } from '@/components/SportsSwitcher'
import { CHART_COLORS as C, SortableStatChart, type StatChartColumn } from '@/components/SortableStatChart'

interface Row {
  player: string
  slug?: string
  team: string
  games: number
  qp: NbaScoringBucketRow['quarter_points']
  bands: NbaScoringBucketRow['bands']
  defense: NbaScoringBucketRow['defense']
}

function deriveRows(players: NbaScoringBucketRow[], slugByKey: Map<string, string>): Row[] {
  return players.map((p) => ({
    player: normalizeDisplayPlayer(p.player_name),
    slug: slugByKey.get(normalizePlayerKey(p.player_name)),
    team: p.team,
    games: p.games,
    qp: p.quarter_points,
    bands: p.bands,
    defense: p.defense,
  }))
}

const band = (key: string) => (r: Row, category: keyof NbaScoringBucketRow['bands']) => r.bands[category]?.[key] ?? 0

const COLUMNS: StatChartColumn<Row>[] = [
  {
    key: 'player',
    label: 'Player',
    get: (r) => r.player,
    cellColor: (r) => (r.slug ? C.accent : undefined),
    renderCell: (r, v) =>
      r.slug ? (
        <a href={`/database/${r.slug}`} className="hover:underline">
          {v}
        </a>
      ) : (
        v
      ),
  },
  { key: 'team', label: 'Team', get: (r) => r.team },
  { key: 'games', label: 'GP', get: (r) => r.games, numeric: true },
  { key: 'q1', label: 'Q1', group: 'Points / quarter', get: (r) => r.qp.q1, numeric: true },
  { key: 'q2', label: 'Q2', group: 'Points / quarter', get: (r) => r.qp.q2, numeric: true },
  { key: 'q3', label: 'Q3', group: 'Points / quarter', get: (r) => r.qp.q3, numeric: true },
  { key: 'q4', label: 'Q4', group: 'Points / quarter', get: (r) => r.qp.q4, numeric: true },
  { key: 'h1', label: '1H', group: 'Points / quarter', get: (r) => r.qp['1h'], numeric: true },
  { key: 'h2', label: '2H', group: 'Points / quarter', get: (r) => r.qp['2h'], numeric: true },
  { key: 'ot', label: 'OT', group: 'Points / quarter', get: (r) => r.qp.ot, numeric: true },
  { key: 'pts25', label: '25+', group: 'Point games', get: (r) => band('25+')(r, 'points'), numeric: true },
  { key: 'pts30', label: '30+', group: 'Point games', get: (r) => band('30+')(r, 'points'), numeric: true },
  { key: 'pts35', label: '35+', group: 'Point games', get: (r) => band('35+')(r, 'points'), numeric: true },
  { key: 'pts40', label: '40+', group: 'Point games', get: (r) => band('40+')(r, 'points'), numeric: true },
  { key: 'reb6', label: '6+', group: 'Rebound games', get: (r) => band('6+')(r, 'rebounds'), numeric: true },
  { key: 'reb8', label: '8+', group: 'Rebound games', get: (r) => band('8+')(r, 'rebounds'), numeric: true },
  { key: 'reb10', label: '10+', group: 'Rebound games', get: (r) => band('10+')(r, 'rebounds'), numeric: true },
  { key: 'reb12', label: '12+', group: 'Rebound games', get: (r) => band('12+')(r, 'rebounds'), numeric: true },
  { key: 'ast6', label: '6+', group: 'Assist games', get: (r) => band('6+')(r, 'assists'), numeric: true },
  { key: 'ast8', label: '8+', group: 'Assist games', get: (r) => band('8+')(r, 'assists'), numeric: true },
  { key: 'ast10', label: '10+', group: 'Assist games', get: (r) => band('10+')(r, 'assists'), numeric: true },
  { key: 'ast12', label: '12+', group: 'Assist games', get: (r) => band('12+')(r, 'assists'), numeric: true },
  { key: 'pra30', label: '30+', group: 'PRA games', get: (r) => band('30+')(r, 'total_pra'), numeric: true },
  { key: 'pra35', label: '35+', group: 'PRA games', get: (r) => band('35+')(r, 'total_pra'), numeric: true },
  { key: 'pra40', label: '40+', group: 'PRA games', get: (r) => band('40+')(r, 'total_pra'), numeric: true },
  { key: 'pra45', label: '45+', group: 'PRA games', get: (r) => band('45+')(r, 'total_pra'), numeric: true },
  { key: 'pra50', label: '50+', group: 'PRA games', get: (r) => band('50+')(r, 'total_pra'), numeric: true },
  { key: 'stl', label: 'STL', group: 'Defense (season)', get: (r) => r.defense.steals_total, numeric: true },
  { key: 'blk', label: 'BLK', group: 'Defense (season)', get: (r) => r.defense.blocks_total, numeric: true },
  { key: 'stocks', label: 'STOCKS', group: 'Defense (season)', get: (r) => r.defense.stocks_total, numeric: true },
]

export default function NbaChartsPage() {
  const [data, setData] = useState<NbaScoringBucketsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [slugByKey, setSlugByKey] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    fetchNbaScoringBuckets()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        console.error('Failed to load nba-scoring-buckets:', err)
        if (!cancelled) setLoadError("Couldn't load chart data — try refreshing.")
      })
    loadPlayerIndex().then(() => {
      if (cancelled) return
      setSlugByKey(new Map(PLAYER_INDEX.map((e) => [normalizePlayerKey(e.name), e.slug])))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => (data ? deriveRows(data.players, slugByKey) : []), [data, slugByKey])

  return (
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <span className="font-mono font-bold text-[15px]" style={{ color: C.accent }}>
            {'{chart}'}
          </span>
          <span className="ml-2 font-mono text-[12px]" style={{ color: C.textDim }}>
            {data?.season ?? '…'} NBA scoring · points by quarter · threshold bands · defense
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
            {'{homepage}'}
          </a>
          <SportsSwitcher current="nba" variant="charts" />
        </div>
      </div>

      <div className="px-6 py-3 font-mono text-[11px]" style={{ color: C.textDim }}>
        {loadError ? loadError : !data ? 'loading…' : `${rows.length} players · click any column to sort · no per-quarter reb/ast/stl/blk exists, scoring only`}
      </div>

      {data && !loadError && (
        <div className="px-6 pb-10 overflow-x-auto">
          <SortableStatChart columns={COLUMNS} rows={rows} rowKey={(r) => `${r.player}-${r.team}`} defaultSortKey="pts30" />
        </div>
      )}
    </div>
  )
}
