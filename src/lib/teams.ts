// Opponent codes per sport, for generating "{player} vs {TEAM}" commands.
// NFL comes from the same bundled standings file the rankings page reads;
// MLB is a fixed list of the codes the backend's h2h engine accepts (checked
// live: "cws"/"chw" and "ath"/"oak" both resolve, "az" does not — "ari" does).
import nflData from '@/assets/data/worldcup.json'

interface NflTeam { abbr: string }
interface NflDivision { teams: NflTeam[] }
interface NflSeason { conferences: Record<string, Record<string, NflDivision>> }

const NFL_TEAMS: string[] = (() => {
  const out: string[] = []
  for (const conf of Object.values((nflData as unknown as NflSeason).conferences)) {
    for (const div of Object.values(conf)) for (const t of div.teams) out.push(t.abbr.toLowerCase())
  }
  return out
})()

const MLB_TEAMS = [
  'ari', 'atl', 'bal', 'bos', 'chc', 'cws', 'cin', 'cle', 'col', 'det',
  'hou', 'kc', 'laa', 'lad', 'mia', 'mil', 'min', 'nym', 'nyy', 'ath',
  'phi', 'pit', 'sd', 'sf', 'sea', 'stl', 'tb', 'tex', 'tor', 'wsh',
]

const TEAMS_BY_SPORT: Record<string, string[]> = { nfl: NFL_TEAMS, mlb: MLB_TEAMS }

// Lowercase opponent codes for a sport; empty when h2h-by-team isn't offered.
export function getTeamCodes(sport: string | undefined): string[] {
  return (sport && TEAMS_BY_SPORT[sport]) || []
}
