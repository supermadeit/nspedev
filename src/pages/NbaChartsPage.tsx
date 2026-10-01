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
import { loadPlayerIndex, PLAYER_INDEX, normalizePlayerKey, type PlayerIndexEntry } from '@/lib/playerSearch'
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

function deriveRows(players: NbaScoringBucketRow[], indexByKey: Map<string, PlayerIndexEntry>): Row[] {
  return players.map((p) => {
    // See MlbChartsPage.tsx's deriveRows for why the index's real display
    // name wins over regex-reconstructing p.player_name's squashed key.
    const indexed = indexByKey.get(normalizePlayerKey(p.player_name))
    return {
      player: indexed?.name ?? normalizeDisplayPlayer(p.player_name),
      slug: indexed?.slug,
      team: p.team,
      games: p.games,
      qp: p.quarter_points,
      bands: p.bands,
      defense: p.defense,
    }
  })
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
  // rateOf on every threshold-*game-count* column below — a raw count
  // unfairly buries a low-GP player under a high-GP one on the same
  // threshold, reported 2026-09-30 ("Giannis (36 GP) looks worse than he is
  // next to guys with 70 GP. A count/% toggle fixes that."). Season totals
  // (steals/blocks below) aren't game counts, so they're left out of it.
  { key: 'pts25', label: '25+', group: 'Point games', get: (r) => band('25+')(r, 'points'), numeric: true, rateOf: (r) => r.games },
  { key: 'pts30', label: '30+', group: 'Point games', get: (r) => band('30+')(r, 'points'), numeric: true, rateOf: (r) => r.games },
  { key: 'pts35', label: '35+', group: 'Point games', get: (r) => band('35+')(r, 'points'), numeric: true, rateOf: (r) => r.games },
  { key: 'pts40', label: '40+', group: 'Point games', get: (r) => band('40+')(r, 'points'), numeric: true, rateOf: (r) => r.games },
  { key: 'reb6', label: '6+', group: 'Rebound games', get: (r) => band('6+')(r, 'rebounds'), numeric: true, rateOf: (r) => r.games },
  { key: 'reb8', label: '8+', group: 'Rebound games', get: (r) => band('8+')(r, 'rebounds'), numeric: true, rateOf: (r) => r.games },
  { key: 'reb10', label: '10+', group: 'Rebound games', get: (r) => band('10+')(r, 'rebounds'), numeric: true, rateOf: (r) => r.games },
  { key: 'reb12', label: '12+', group: 'Rebound games', get: (r) => band('12+')(r, 'rebounds'), numeric: true, rateOf: (r) => r.games },
  { key: 'ast6', label: '6+', group: 'Assist games', get: (r) => band('6+')(r, 'assists'), numeric: true, rateOf: (r) => r.games },
  { key: 'ast8', label: '8+', group: 'Assist games', get: (r) => band('8+')(r, 'assists'), numeric: true, rateOf: (r) => r.games },
  { key: 'ast10', label: '10+', group: 'Assist games', get: (r) => band('10+')(r, 'assists'), numeric: true, rateOf: (r) => r.games },
  { key: 'ast12', label: '12+', group: 'Assist games', get: (r) => band('12+')(r, 'assists'), numeric: true, rateOf: (r) => r.games },
  { key: 'pra30', label: '30+', group: 'PRA games', get: (r) => band('30+')(r, 'total_pra'), numeric: true, rateOf: (r) => r.games },
  { key: 'pra35', label: '35+', group: 'PRA games', get: (r) => band('35+')(r, 'total_pra'), numeric: true, rateOf: (r) => r.games },
  { key: 'pra40', label: '40+', group: 'PRA games', get: (r) => band('40+')(r, 'total_pra'), numeric: true, rateOf: (r) => r.games },
  { key: 'pra45', label: '45+', group: 'PRA games', get: (r) => band('45+')(r, 'total_pra'), numeric: true, rateOf: (r) => r.games },
  { key: 'pra50', label: '50+', group: 'PRA games', get: (r) => band('50+')(r, 'total_pra'), numeric: true, rateOf: (r) => r.games },
  { key: 'stl', label: 'STL', group: 'Defense (season)', get: (r) => r.defense.steals_total, numeric: true },
  { key: 'blk', label: 'BLK', group: 'Defense (season)', get: (r) => r.defense.blocks_total, numeric: true },
  { key: 'stocks', label: 'STOCKS', group: 'Defense (season)', get: (r) => r.defense.stocks_total, numeric: true },
]

export default function NbaChartsPage() {
  const [data, setData] = useState<NbaScoringBucketsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [indexByKey, setIndexByKey] = useState<Map<string, PlayerIndexEntry>>(new Map())

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
      setIndexByKey(new Map(PLAYER_INDEX.map((e) => [normalizePlayerKey(e.name), e])))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => (data ? deriveRows(data.players, indexByKey) : []), [data, indexByKey])

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
          <a href="/nba.team.metrics" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
            {'{team.metrics}'}
          </a>
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
