// {chart} — NHL. Uniform to NFL's QbChartsPage.tsx template (see
// SortableStatChart.tsx for the shared table itself): a sortable per-player
// grid off nhl_scoring_buckets.json, live via the same allowlisted
// /api/data/output/ static-file route NFL's chart already uses.
//
// Per nspe-v2-da (2026-09-30): goal/point/assist/SOG threshold-game counts
// plus season totals including PIM — 956 players, no minimum-games floor.
import { useEffect, useMemo, useState } from 'react'
import { fetchNhlScoringBuckets, type NhlScoringBucketRow, type NhlScoringBucketsData } from '@/lib/databaseApi'
import { normalizeDisplayPlayer } from '@/lib/nspe-payloads'
import { loadPlayerIndex, PLAYER_INDEX, normalizePlayerKey } from '@/lib/playerSearch'
import { SportsSwitcher } from '@/components/SportsSwitcher'
import { CHART_COLORS as C, SortableStatChart, type StatChartColumn } from '@/components/SortableStatChart'

interface Row {
  player: string
  slug?: string
  team: string
  position: string
  games: number
  bands: NhlScoringBucketRow['bands']
  totals: NhlScoringBucketRow['totals']
}

function deriveRows(players: NhlScoringBucketRow[], slugByKey: Map<string, string>): Row[] {
  return players.map((p) => ({
    player: normalizeDisplayPlayer(p.player_name),
    slug: slugByKey.get(normalizePlayerKey(p.player_name)),
    team: p.team,
    position: p.position,
    games: p.games,
    bands: p.bands,
    totals: p.totals,
  }))
}

const band = (key: string) => (r: Row, category: keyof NhlScoringBucketRow['bands']) => r.bands[category]?.[key] ?? 0

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
  { key: 'position', label: 'Pos', get: (r) => r.position },
  { key: 'games', label: 'GP', get: (r) => r.games, numeric: true },
  { key: 'g2', label: '2+', group: 'Goal games', get: (r) => band('2+')(r, 'goals'), numeric: true },
  { key: 'g3', label: '3+', group: 'Goal games', get: (r) => band('3+')(r, 'goals'), numeric: true },
  { key: 'p2', label: '2+', group: 'Point games', get: (r) => band('2+')(r, 'points'), numeric: true },
  { key: 'p3', label: '3+', group: 'Point games', get: (r) => band('3+')(r, 'points'), numeric: true },
  { key: 'p4', label: '4+', group: 'Point games', get: (r) => band('4+')(r, 'points'), numeric: true },
  { key: 'a2', label: '2+', group: 'Assist games', get: (r) => band('2+')(r, 'assists'), numeric: true },
  { key: 'a3', label: '3+', group: 'Assist games', get: (r) => band('3+')(r, 'assists'), numeric: true },
  { key: 'a4', label: '4+', group: 'Assist games', get: (r) => band('4+')(r, 'assists'), numeric: true },
  { key: 'sog3', label: '3+', group: 'SOG games', get: (r) => band('3+')(r, 'sog'), numeric: true },
  { key: 'sog4', label: '4+', group: 'SOG games', get: (r) => band('4+')(r, 'sog'), numeric: true },
  { key: 'sog5', label: '5+', group: 'SOG games', get: (r) => band('5+')(r, 'sog'), numeric: true },
  { key: 'sog6', label: '6+', group: 'SOG games', get: (r) => band('6+')(r, 'sog'), numeric: true },
  { key: 'tg', label: 'G', group: 'Season totals', get: (r) => r.totals.goals, numeric: true },
  { key: 'ta', label: 'A', group: 'Season totals', get: (r) => r.totals.assists, numeric: true },
  { key: 'tp', label: 'PTS', group: 'Season totals', get: (r) => r.totals.points, numeric: true },
  { key: 'tsog', label: 'SOG', group: 'Season totals', get: (r) => r.totals.sog, numeric: true },
  { key: 'pim', label: 'PIM', group: 'Season totals', get: (r) => r.totals.pim, numeric: true },
]

export default function NhlChartsPage() {
  const [data, setData] = useState<NhlScoringBucketsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [slugByKey, setSlugByKey] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    fetchNhlScoringBuckets()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        console.error('Failed to load nhl-scoring-buckets:', err)
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
            {data?.season ?? '…'} NHL scoring · goal/point/assist/SOG threshold games · season totals
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
            {'{homepage}'}
          </a>
          <SportsSwitcher current="nhl" variant="charts" />
        </div>
      </div>

      <div className="px-6 py-3 font-mono text-[11px]" style={{ color: C.textDim }}>
        {loadError ? loadError : !data ? 'loading…' : `${rows.length} players · click any column to sort`}
      </div>

      {data && !loadError && (
        <div className="px-6 pb-10 overflow-x-auto">
          <SortableStatChart columns={COLUMNS} rows={rows} rowKey={(r) => `${r.player}-${r.team}`} defaultSortKey="tp" />
        </div>
      )}
    </div>
  )
}
