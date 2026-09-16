import { useMemo, useState } from 'react'
import { StarsBackground } from '@/components/StarsBackground'
import nflData from '@/assets/data/worldcup.json'
import scheduleData from '@/assets/data/nfl_schedule.json'

// ---------------- types ----------------

interface NflTeam {
  name: string
  city: string
  abbr: string
  standing: number | null
  wins: number | null
  losses: number | null
  ties: number | null
}

interface NflDivision {
  division: string
  teams: NflTeam[]
}

interface NflConference {
  East: NflDivision
  North: NflDivision
  South: NflDivision
  West: NflDivision
}

interface NflSeasonData {
  season: string
  current_week: number | null
  total_weeks: number
  last_updated: string | null
  conferences: {
    AFC: NflConference
    NFC: NflConference
  }
}

interface Game {
  week: number
  awayTeam: string
  homeTeam: string
  gameTime: string
  gameDate: string
  score_away?: number | null
  score_home?: number | null
}

interface ScheduleData {
  season: number
  totalGames: number
  games: Game[]
}

// ---------------- design tokens ----------------

const C = {
  label:  'oklch(0.55 0 0)',
  value:  'oklch(0.88 0 0)',
  accent: 'oklch(0.85 0.15 195)',
  green:  'oklch(0.85 0.15 145)',
  border: 'oklch(0.28 0 0)',
  panel:  'oklch(0.13 0 0)',
  dim:    'oklch(0.40 0 0)',
}

// ---------------- helpers ----------------

function formatUpdated(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${m}/${day} ${hh}:${mm}`
}

function wlt(team: NflTeam): string {
  if (team.wins === null) return '—'
  const t = team.ties ?? 0
  return t > 0 ? `${team.wins}-${team.losses}-${t}` : `${team.wins}-${team.losses}`
}

function buildAbbrMap(data: NflSeasonData): Record<string, string> {
  const map: Record<string, string> = {}
  for (const conf of ['AFC', 'NFC'] as const) {
    for (const div of ['East', 'North', 'South', 'West'] as const) {
      for (const team of data.conferences[conf][div].teams) {
        map[team.name] = team.abbr
      }
    }
  }
  return map
}

// ---------------- division panel ----------------

function DivisionPanel({ division }: { division: NflDivision }) {
  const [conf, ...rest] = division.division.split(' ')
  const dir = rest.join(' ')
  return (
    <div
      className="rounded p-2 flex flex-col"
      style={{ backgroundColor: C.panel, border: `1px solid ${C.accent}` }}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5 shrink-0" style={{ color: C.label }}>
        {conf.toLowerCase()} · {dir.toLowerCase()}
      </div>
      <div
        className="grid items-center gap-x-2 pb-1 mb-1 border-b font-mono text-[10px]"
        style={{ gridTemplateColumns: '14px 36px 1fr 60px', color: C.label, borderColor: C.border }}
      >
        <span /><span>team</span><span /><span className="text-right">w-l</span>
      </div>
      <div className="font-mono text-[11px] space-y-[1px]">
        {division.teams.map((team, i) => {
          const rank = team.standing ?? (i + 1)
          const isLeader = rank === 1
          const isPending = team.wins === null
          return (
            <div
              key={team.abbr}
              className="grid items-center gap-x-2 py-[2px]"
              style={{ gridTemplateColumns: '14px 36px 1fr 60px', color: C.value, opacity: isPending ? 0.65 : 1 }}
            >
              <span style={{ color: isLeader ? C.accent : C.dim }}>
                {isPending ? '○' : isLeader ? '●' : '·'}
              </span>
              <span className="font-bold" style={{ color: isLeader ? C.value : C.label }}>{team.abbr}</span>
              <span className="truncate" style={{ color: C.label }}>{team.city} {team.name}</span>
              <span className="text-right tabular-nums" style={{ color: isPending ? C.dim : isLeader ? C.accent : C.value }}>
                {wlt(team)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- divisions view ----------------

function DivisionsView({ conferences }: { conferences: NflSeasonData['conferences'] }) {
  const dirs = ['East', 'North', 'South', 'West'] as const
  return (
    <div className="h-full flex flex-col gap-4">
      {(['AFC', 'NFC'] as const).map((conf) => (
        <div key={conf} className="flex-1 min-h-0 flex flex-col">
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2 shrink-0" style={{ color: C.green }}>
            {conf}
          </div>
          <div className="grid gap-3 flex-1 min-h-0" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {dirs.map((dir) => (
              <DivisionPanel key={dir} division={conferences[conf][dir]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------- game card ----------------

function GameCard({ game, abbrMap }: { game: Game; abbrMap: Record<string, string> }) {
  const awayAbbr = abbrMap[game.awayTeam] ?? game.awayTeam.slice(0, 3).toUpperCase()
  const homeAbbr = abbrMap[game.homeTeam] ?? game.homeTeam.slice(0, 3).toUpperCase()
  const isComplete = game.score_away != null && game.score_home != null
  const awayWon = isComplete && (game.score_away as number) > (game.score_home as number)
  const homeWon = isComplete && (game.score_home as number) > (game.score_away as number)

  const renderSide = (
    abbr: string,
    name: string,
    score: number | null | undefined,
    won: boolean,
    isTop: boolean,
  ) => (
    <div
      className="flex items-center justify-between gap-1 px-1.5 py-[2px]"
      style={{ borderBottom: isTop ? `1px solid ${C.green}` : undefined, opacity: isComplete && !won ? 0.45 : 1 }}
    >
      <span className="font-mono text-[11px] font-bold shrink-0" style={{ color: won ? C.accent : C.value, minWidth: 28 }}>
        {abbr}
      </span>
      <span className="font-mono text-[10px] truncate flex-1" style={{ color: C.label }}>{name}</span>
      <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: won ? C.accent : C.dim, fontWeight: won ? 600 : 400 }}>
        {score != null ? score : '—'}
      </span>
    </div>
  )

  return (
    <div
      className="rounded"
      style={{
        backgroundColor: 'oklch(0.10 0 0)',
        border: `1.5px solid ${C.green}`,
        minWidth: 0,
        boxShadow: `0 0 0 1px oklch(0.85 0.15 145 / 0.35), 0 0 10px oklch(0.85 0.15 145 / 0.18)`,
      }}
    >
      {renderSide(awayAbbr, game.awayTeam, game.score_away, awayWon, true)}
      {renderSide(homeAbbr, game.homeTeam, game.score_home, homeWon, false)}
      <div
        className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[1px]"
        style={{ color: C.label, borderTop: `1px solid ${C.green}`, backgroundColor: 'oklch(0.08 0 0)' }}
      >
        {isComplete ? 'final' : (game.gameTime || game.gameDate || 'tbd')}
      </div>
    </div>
  )
}

// ---------------- schedule view ----------------

function ScheduleView({
  games,
  totalWeeks,
  abbrMap,
  initialWeek,
}: {
  games: Game[]
  totalWeeks: number
  abbrMap: Record<string, string>
  initialWeek: number
}) {
  const [week, setWeek] = useState(initialWeek)
  const weekGames = useMemo(() => games.filter((g) => g.week === week), [games, week])
  const byDate = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, Game[]>()
    for (const g of weekGames) {
      const d = g.gameDate || 'TBD'
      if (!map.has(d)) { map.set(d, []); order.push(d) }
      map.get(d)!.push(g)
    }
    return order.map((d) => ({ date: d, games: map.get(d)! }))
  }, [weekGames])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button type="button" onClick={() => setWeek((w) => Math.max(1, w - 1))} disabled={week === 1}
          className="font-mono text-[16px] hover:opacity-70 transition-opacity disabled:opacity-20" style={{ color: C.accent }}>
          ←
        </button>
        <span className="font-mono text-[13px]" style={{ color: C.value }}>
          week <span style={{ color: C.accent }}>{week}</span>
          <span style={{ color: C.label }}> · {totalWeeks}</span>
        </span>
        <button type="button" onClick={() => setWeek((w) => Math.min(totalWeeks, w + 1))} disabled={week === totalWeeks}
          className="font-mono text-[16px] hover:opacity-70 transition-opacity disabled:opacity-20" style={{ color: C.accent }}>
          →
        </button>
        <span className="font-mono text-[10px]" style={{ color: C.dim }}>{weekGames.length} games</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
        {weekGames.length === 0 && (
          <div className="font-mono text-[11px]" style={{ color: C.dim }}>schedule data pending</div>
        )}
        {byDate.map(({ date, games: dGames }) => (
          <div key={date}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: C.label }}>{date}</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))' }}>
              {dGames.map((g, i) => <GameCard key={i} game={g} abbrMap={abbrMap} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- playoffs placeholder ----------------

function PlayoffsView() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <div className="font-mono text-[13px] uppercase tracking-widest" style={{ color: C.dim }}>nfl.playoffs</div>
      <div className="font-mono text-[11px]" style={{ color: C.label }}>playoff bracket · available once seeds are set</div>
    </div>
  )
}

// ---------------- page ----------------

type ActiveView = 'season' | 'schedule' | 'playoffs'

export default function WorldCupApp() {
  const data = nflData as unknown as NflSeasonData
  const schedule = scheduleData as unknown as ScheduleData
  const [activeView, setActiveView] = useState<ActiveView>('season')
  const abbrMap = useMemo(() => buildAbbrMap(data), [data])
  const weekLabel = data.current_week != null
    ? `week ${data.current_week} · ${data.total_weeks}`
    : 'pre-season'
  // Schedule tab opens on the active week (data.current_week), not always
  // week 1 — current_week is expected to already reflect the Tuesday-
  // morning rollover backend-side (games run through Monday Night Football,
  // so the "active" week doesn't advance until Tuesday). Clamped in case
  // current_week is ever missing/out of range before a season starts.
  const initialScheduleWeek = Math.min(Math.max(data.current_week ?? 1, 1), data.total_weeks)

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden">
      <StarsBackground density={180} />

      <div className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between gap-6">
        <div className="flex flex-col">
          <a href="/" className="font-mono text-[14px] hover:opacity-70 transition-opacity" style={{ color: C.label }}>
            ← nspe.dev
          </a>
          <div className="font-mono text-[18px] mt-1" style={{ color: C.value }}>
            <span style={{ color: C.accent }}>nfl.season</span>
            <span style={{ color: C.label }}>{' · '}</span>
            <span style={{ color: C.green }}>{data.season}</span>
          </div>
          <div className="font-mono text-[11px] mt-0.5" style={{ color: C.label }}>{weekLabel}</div>
        </div>

        <div className="flex items-center gap-5 pt-2">
          {(['season', 'schedule'] as const).map((view) => (
            <button key={view} type="button" onClick={() => setActiveView(view)}
              className="font-mono font-bold text-[14px] underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: activeView === view ? C.accent : C.label, textDecoration: activeView === view ? 'underline' : 'none' }}>
              {`{nfl.${view}}`}
            </button>
          ))}
          <span className="font-mono font-bold text-[14px] whitespace-nowrap inline-flex items-baseline gap-1.5"
            style={{ color: C.dim, cursor: 'not-allowed', userSelect: 'none' }}>
            <span>{'{nfl.playoffs}'}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>(pending)</span>
          </span>
        </div>
      </div>

      <div className="relative z-10 h-full pt-28 pb-8 px-6 max-w-[1480px] mx-auto">
        {activeView === 'season' && (
          <section className="h-full flex flex-col">
            <div className="font-mono text-[11px] uppercase tracking-widest mb-3 shrink-0" style={{ color: C.label }}>divisions</div>
            <div className="flex-1 min-h-0"><DivisionsView conferences={data.conferences} /></div>
          </section>
        )}
        {activeView === 'schedule' && (
          <section className="h-full flex flex-col">
            <div className="font-mono text-[11px] uppercase tracking-widest mb-3 shrink-0" style={{ color: C.label }}>
              schedule · {schedule.totalGames} games
            </div>
            <div className="flex-1 min-h-0">
              <ScheduleView games={schedule.games} totalWeeks={data.total_weeks} abbrMap={abbrMap} initialWeek={initialScheduleWeek} />
            </div>
          </section>
        )}
        {activeView === 'playoffs' && (
          <section className="h-full flex flex-col"><PlayoffsView /></section>
        )}
      </div>

      <div className="fixed bottom-3 left-4 z-20 font-mono text-[11px]" style={{ color: C.label }}>
        updated · {formatUpdated(data.last_updated)}
      </div>
    </div>
  )
}
