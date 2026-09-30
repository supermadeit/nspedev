// {chart} — MLB. Uniform to NFL's QbChartsPage.tsx template (see
// SortableStatChart.tsx for the shared table itself): a sortable per-batter
// grid off mlb_batter_buckets.json, live via the same allowlisted
// /api/data/output/ static-file route NFL's chart already uses.
//
// Per nspe-v2-da (2026-09-30): this is deliberately NOT an HR-distance/
// explosives chart — that stays command/querybuilder-only. This is
// season-total counting-stat buckets off the standard batting box line
// (games with 2+/3+ hits, 2+/3+ RBI, extra-base-hit games, doubles, total
// bases) — 393 batters, no minimum-games floor, so sorting/filtering by
// volume is left to the person looking at the table, same as NFL's chart.
import { useEffect, useMemo, useState } from 'react'
import { fetchMlbBatterBuckets, type MlbBatterBucketRow, type MlbBatterBucketsData } from '@/lib/databaseApi'
import { normalizeDisplayPlayer } from '@/lib/nspe-payloads'
import { loadPlayerIndex, PLAYER_INDEX, normalizePlayerKey, type PlayerIndexEntry } from '@/lib/playerSearch'
import { SportsSwitcher } from '@/components/SportsSwitcher'
import { CHART_COLORS as C, SortableStatChart, type StatChartColumn } from '@/components/SortableStatChart'

interface Row {
  player: string
  slug?: string
  team: string
  games: number
  b: MlbBatterBucketRow['buckets']
}

function deriveRows(players: MlbBatterBucketRow[], indexByKey: Map<string, PlayerIndexEntry>): Row[] {
  return players.map((p) => {
    // p.player_name is a squashed alias key (e.g. "MichaelHarrisIi",
    // "CjAbrams") with no recoverable case/hyphen info — regex-reinserting
    // spaces before capitals can't tell "Ii" was really "II" or that
    // "PeteCrowArmstrong" had a hyphen. The live player index carries the
    // real display name (same match used for the /database/{slug} link), so
    // use that whenever there's a match and only fall back to the
    // best-effort regex reconstruction for names the index doesn't have.
    const indexed = indexByKey.get(normalizePlayerKey(p.player_name))
    return {
      player: indexed?.name ?? normalizeDisplayPlayer(p.player_name),
      slug: indexed?.slug,
      team: p.team,
      games: p.games,
      b: p.buckets,
    }
  })
}

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
  // rateOf on the threshold-*game-count* columns only — a raw count unfairly
  // buries a 66-GP player under a 155-GP one on the same threshold, reported
  // 2026-09-30 ("Giannis (36 GP) looks worse than he is next to guys with 70
  // GP"). Season totals (doubles, TB below) aren't game counts, so no toggle.
  { key: 'h2', label: '2+H', group: 'Hitting games', get: (r) => r.b.games_2plus_hits, numeric: true, rateOf: (r) => r.games },
  { key: 'h3', label: '3+H', group: 'Hitting games', get: (r) => r.b.games_3plus_hits, numeric: true, rateOf: (r) => r.games },
  { key: 'rbi2', label: '2+RBI', group: 'RBI games', get: (r) => r.b.games_2plus_rbi, numeric: true, rateOf: (r) => r.games },
  { key: 'rbi3', label: '3+RBI', group: 'RBI games', get: (r) => r.b.games_3plus_rbi, numeric: true, rateOf: (r) => r.games },
  { key: 'xbh1', label: '1+XBH', group: 'Extra-base hits', get: (r) => r.b.games_1plus_xbh, numeric: true, rateOf: (r) => r.games },
  { key: 'xbh2', label: '2+XBH', group: 'Extra-base hits', get: (r) => r.b.games_2plus_xbh, numeric: true, rateOf: (r) => r.games },
  { key: 'doubles', label: '2B', group: 'Extra-base hits', get: (r) => r.b.total_doubles, numeric: true },
  { key: 'tb', label: 'TB', group: 'Extra-base hits', get: (r) => r.b.total_bases, numeric: true },
]

export default function MlbChartsPage() {
  const [data, setData] = useState<MlbBatterBucketsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [indexByKey, setIndexByKey] = useState<Map<string, PlayerIndexEntry>>(new Map())

  useEffect(() => {
    let cancelled = false
    fetchMlbBatterBuckets()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        console.error('Failed to load mlb-batter-buckets:', err)
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
            {data?.season ?? '…'} MLB batting · season counting-stat buckets
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="font-mono text-[13px] underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
            {'{homepage}'}
          </a>
          <SportsSwitcher current="mlb" variant="charts" />
        </div>
      </div>

      <div className="px-6 py-3 font-mono text-[11px]" style={{ color: C.textDim }}>
        {loadError ? loadError : !data ? 'loading…' : `${rows.length} batters · click any column to sort`}
      </div>

      {data && !loadError && (
        <div className="px-6 pb-10 overflow-x-auto">
          <SortableStatChart columns={COLUMNS} rows={rows} rowKey={(r) => `${r.player}-${r.team}`} defaultSortKey="tb" />
        </div>
      )}
    </div>
  )
}
