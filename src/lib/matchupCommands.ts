// Derives "this week's matchup commands" from the same bundled schedule
// data {nfl.season} reads (WorldCupApp.tsx) — used to populate the
// predictive-syntax dropdown when a query looks like it's heading toward
// "matchup" ("ma", "matc", "matchup", ...), so the full slate is one
// keystroke away from anywhere, not just from navigating into {nfl.season}
// itself. Deliberately a small self-contained copy of the couple of types/
// helpers WorldCupApp.tsx also needs (not imported from there) — that file
// is a page component, not a shared lib, and duplicating ~15 lines here is
// cheaper than restructuring an already-working, unrelated file mid-session.
import nflData from '@/assets/data/worldcup.json'
import scheduleData from '@/assets/data/nfl_schedule.json'
import type { SampleQuery } from './predictiveCommands'
import { getCurrentNflWeek } from './nflWeek'

interface NflTeam {
  name: string
  abbr: string
}

interface NflDivision {
  teams: NflTeam[]
}

interface NflSeasonData {
  current_week: number | null
  conferences: {
    AFC: Record<string, NflDivision>
    NFC: Record<string, NflDivision>
  }
}

interface Game {
  week: number
  awayTeam: string
  homeTeam: string
}

interface ScheduleData {
  games: Game[]
}

function buildAbbrMap(data: NflSeasonData): Record<string, string> {
  const map: Record<string, string> = {}
  for (const conf of ['AFC', 'NFC'] as const) {
    for (const division of Object.values(data.conferences[conf])) {
      for (const team of division.teams) {
        map[team.name] = team.abbr
      }
    }
  }
  return map
}

// Last week number present in the schedule (the clamp ceiling).
function scheduleWeeks(schedule: ScheduleData): number {
  return schedule.games.reduce((m, g) => Math.max(m, g.week), 1)
}

// Computed once at module load — the schedule/standings files are static
// bundled data (refreshed by a build+deploy, not a live fetch), so there's
// nothing to recompute per keystroke.
const WEEKLY_MATCHUP_COMMANDS: SampleQuery[] = (() => {
  const data = nflData as unknown as NflSeasonData
  const schedule = scheduleData as unknown as ScheduleData
  const week = getCurrentNflWeek(scheduleWeeks(schedule), data.current_week)
  const abbrMap = buildAbbrMap(data)
  return schedule.games
    .filter((g) => g.week === week)
    .map((g) => {
      const away = (abbrMap[g.awayTeam] ?? g.awayTeam.slice(0, 3).toUpperCase()).toLowerCase()
      const home = (abbrMap[g.homeTeam] ?? g.homeTeam.slice(0, 3).toUpperCase()).toLowerCase()
      return {
        label: `nfl matchup · ${away.toUpperCase()} vs ${home.toUpperCase()}`,
        command: `nspe nfl matchup ${away} vs ${home}`,
      }
    })
})()

export function getWeeklyMatchupCommands(): SampleQuery[] {
  return WEEKLY_MATCHUP_COMMANDS
}

// This week's opponent for an NFL team abbreviation (case-insensitive), from
// the same slate WEEKLY_MATCHUP_COMMANDS is built from — parsed back out of
// each "nspe nfl matchup {away} vs {home}" command rather than a second
// schedule pass. Undefined on a bye week or an unknown abbreviation.
export function getOpponentThisWeek(team: string | undefined): string | undefined {
  if (!team) return undefined
  const t = team.toLowerCase()
  for (const q of WEEKLY_MATCHUP_COMMANDS) {
    const [away, home] = q.command.replace('nspe nfl matchup ', '').split(' vs ')
    if (away === t) return home
    if (home === t) return away
  }
  return undefined
}
