// {sap.zilla}'s guided leg builder — turns a (league, player/team, category,
// stat, window, number) selection into the exact leg string POST /lab
// expects ("nfl josh allen -q1ryds10"), so a user never sees or types the
// syntax itself. Deliberately scoped to the stats/scopes backend's contract
// documented with an unambiguous, fully-written example — anything beyond
// this list degrades to a clear per-leg error from the backend, not a
// crash, per the contract's own `errors[]`.
//
// Categories (Passing/Rushing/Receiving/... ) are a frontend-only grouping
// on top of the backend's flat stat list — there's no category concept in
// the API itself, this just avoids handing a novice user a 13-item dropdown
// of raw stat codes (owner ask, 2026-10-19: "categories that lead to other
// props ... then a number selector", same spirit as {team.metrics}).
export type LabSport = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'cfb' | 'cbb'

export interface LabStatOption {
  value: string
  label: string
  // Per-stat sensible starting threshold, mirrored from GET /lab/lines'
  // own `default` field (verified live 2026-10-19) — a flat "100" default
  // regardless of stat was confusing (a novice picking "pass TD" still saw
  // 100, which reads like a yardage line, not a touchdown count).
  default: number
}

export interface LabCategoryOption {
  key: string
  label: string
  stats: string[] // LabStatOption.value refs, within this sport's LAB_STATS
}

export const LAB_SPORTS: { value: LabSport; label: string }[] = [
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  // First two college sports (confirmed live 2026-10-20, deploys 33558fa /
  // 0996ea2) — same rubric/stat keys as their pro counterparts, no
  // quarter/half scope at all (college has no period-level source; GET
  // /lab/lines marks every cfb/cbb stat's `scopes` null). "ncaaf"/"ncaab"
  // are accepted server-side as aliases but legs built here always use the
  // canonical cfb/cbb tokens.
  { value: 'cfb', label: 'CFB' },
  { value: 'cbb', label: 'CBB' },
]

export const LAB_STATS: Record<LabSport, LabStatOption[]> = {
  nfl: [
    { value: 'pyds', label: 'Pass Yds', default: 250 },
    { value: 'ptd', label: 'Pass TD', default: 2 },
    { value: 'int', label: 'INT', default: 1 },
    { value: 'ryds', label: 'Rush Yds', default: 60 },
    { value: 'rtd', label: 'Rush TD', default: 1 },
    { value: 'rec', label: 'Receptions', default: 5 },
    { value: 'recyds', label: 'Rec Yds', default: 60 },
    { value: 'rectd', label: 'Rec TD', default: 1 },
    { value: 'rr', label: 'Rush+Rec Yds', default: 80 },
    { value: 'rrtd', label: 'Rush+Rec TD', default: 1 },
    { value: 'pr', label: 'Pass+Rush Yds', default: 275 },
    { value: 'plong', label: 'Longest Pass', default: 40 },
    { value: 'rlong', label: 'Longest Rush', default: 20 },
    { value: 'reclong', label: 'Longest Reception', default: 25 },
  ],
  nba: [
    { value: 'pts', label: 'PTS', default: 25 },
    { value: 'reb', label: 'REB', default: 10 },
    { value: 'ast', label: 'AST', default: 8 },
    { value: 'tpm', label: '3PM', default: 4 },
    { value: 'stl', label: 'STL', default: 2 },
    { value: 'blk', label: 'BLK', default: 2 },
    { value: 'pra', label: 'PTS+REB+AST', default: 35 },
    { value: 'pa', label: 'PTS+AST', default: 30 },
    { value: 'pr', label: 'PTS+REB', default: 30 },
    { value: 'ra', label: 'REB+AST', default: 15 },
  ],
  mlb: [
    { value: 'h', label: 'Hits', default: 2 },
    { value: 'r', label: 'Runs', default: 1 },
    { value: 'rbi', label: 'RBI', default: 1 },
    { value: 'tb', label: 'Total Bases', default: 2 },
    { value: 'bb', label: 'Walks', default: 1 },
    { value: 'hr', label: 'Home Runs', default: 1 },
    { value: 'hrr', label: 'HRR', default: 3 },
    { value: 'k', label: 'Strikeouts', default: 6 },
  ],
  nhl: [
    { value: 'sog', label: 'SOG', default: 4 },
    { value: 'g', label: 'Goals', default: 1 },
    { value: 'a', label: 'Assists', default: 1 },
    { value: 'pts', label: 'Points', default: 2 },
    { value: 'blk', label: 'Blocks', default: 2 },
  ],
  // Confirmed live 2026-10-20 — the exact same 14 keys/defaults as NFL,
  // scopes always null (no quarter/half source for college).
  cfb: [
    { value: 'pyds', label: 'Pass Yds', default: 250 },
    { value: 'ptd', label: 'Pass TD', default: 2 },
    { value: 'int', label: 'INT', default: 1 },
    { value: 'ryds', label: 'Rush Yds', default: 60 },
    { value: 'rtd', label: 'Rush TD', default: 1 },
    { value: 'rec', label: 'Receptions', default: 5 },
    { value: 'recyds', label: 'Rec Yds', default: 60 },
    { value: 'rectd', label: 'Rec TD', default: 1 },
    { value: 'rr', label: 'Rush+Rec Yds', default: 80 },
    { value: 'rrtd', label: 'Rush+Rec TD', default: 1 },
    { value: 'pr', label: 'Pass+Rush Yds', default: 275 },
    { value: 'plong', label: 'Longest Pass', default: 40 },
    { value: 'rlong', label: 'Longest Rush', default: 20 },
    { value: 'reclong', label: 'Longest Reception', default: 25 },
  ],
  // Confirmed live 2026-10-20 — identical to NBA's 10 keys/defaults.
  cbb: [
    { value: 'pts', label: 'PTS', default: 25 },
    { value: 'reb', label: 'REB', default: 10 },
    { value: 'ast', label: 'AST', default: 8 },
    { value: 'tpm', label: '3PM', default: 4 },
    { value: 'stl', label: 'STL', default: 2 },
    { value: 'blk', label: 'BLK', default: 2 },
    { value: 'pra', label: 'PTS+REB+AST', default: 35 },
    { value: 'pa', label: 'PTS+AST', default: 30 },
    { value: 'pr', label: 'PTS+REB', default: 30 },
    { value: 'ra', label: 'REB+AST', default: 15 },
  ],
}

export const LAB_CATEGORIES: Record<LabSport, LabCategoryOption[]> = {
  nfl: [
    { key: 'passing', label: 'Passing', stats: ['pyds', 'ptd', 'plong', 'int'] },
    { key: 'rushing', label: 'Rushing', stats: ['ryds', 'rtd', 'rlong'] },
    { key: 'receiving', label: 'Receiving', stats: ['rec', 'recyds', 'rectd', 'reclong'] },
    { key: 'combined', label: 'Combined', stats: ['rr', 'rrtd', 'pr'] },
  ],
  nba: [
    { key: 'scoring', label: 'Scoring', stats: ['pts', 'tpm'] },
    { key: 'rebounding', label: 'Rebounding', stats: ['reb'] },
    { key: 'playmaking', label: 'Playmaking', stats: ['ast'] },
    { key: 'defense', label: 'Defense', stats: ['stl', 'blk'] },
    { key: 'combined', label: 'Combined', stats: ['pra', 'pa', 'pr', 'ra'] },
  ],
  mlb: [
    { key: 'hitting', label: 'Hitting', stats: ['h', 'hr', 'tb', 'rbi', 'r', 'bb'] },
    { key: 'pitching', label: 'Pitching', stats: ['k'] },
    { key: 'combined', label: 'Combined', stats: ['hrr'] },
  ],
  nhl: [
    { key: 'shooting', label: 'Shooting', stats: ['sog', 'g'] },
    { key: 'playmaking', label: 'Playmaking', stats: ['a'] },
    { key: 'defense', label: 'Defense', stats: ['blk'] },
    { key: 'combined', label: 'Combined', stats: ['pts'] },
  ],
  // Same grouping as NFL — identical stat keys, so no reason to regroup them.
  cfb: [
    { key: 'passing', label: 'Passing', stats: ['pyds', 'ptd', 'plong', 'int'] },
    { key: 'rushing', label: 'Rushing', stats: ['ryds', 'rtd', 'rlong'] },
    { key: 'receiving', label: 'Receiving', stats: ['rec', 'recyds', 'rectd', 'reclong'] },
    { key: 'combined', label: 'Combined', stats: ['rr', 'rrtd', 'pr'] },
  ],
  // Same grouping as NBA — identical stat keys.
  cbb: [
    { key: 'scoring', label: 'Scoring', stats: ['pts', 'tpm'] },
    { key: 'rebounding', label: 'Rebounding', stats: ['reb'] },
    { key: 'playmaking', label: 'Playmaking', stats: ['ast'] },
    { key: 'defense', label: 'Defense', stats: ['stl', 'blk'] },
    { key: 'combined', label: 'Combined', stats: ['pra', 'pa', 'pr', 'ra'] },
  ],
}

export function labStatOption(sport: LabSport, stat: string): LabStatOption | undefined {
  return LAB_STATS[sport].find((s) => s.value === stat)
}

// NFL-only — a quarter/half prefix on the stat token. Trimmed to the 3
// cases worth surfacing in the picker for PLAYER legs (full game, 1st
// quarter, 1st half); the backend contract also has q2/q3/q4/2h/every-
// quarter/each-half, but those stay reachable only by hand-typed syntax for
// now (owner ask, 2026-10-19: keep the "window" column simple, default to
// full game). Team legs get a wider set below — see LAB_TEAM_SCOPES.
export type LabScope = 'season' | 'q1' | 'q2' | 'q3' | 'q4' | '1h' | '2h' | 'eq' | 'eh'

export const LAB_NFL_SCOPES: { value: LabScope; label: string }[] = [
  { value: 'season', label: 'full game' },
  { value: 'q1', label: '1st quarter' },
  { value: '1h', label: '1st half' },
]

// Per GET /lab/lines (verified live 2026-10-19): only these 4 NFL stats
// carry quarter/half scopes at all — showing the window selector for e.g.
// Pass TD produced syntax the backend has never supported ("-ehptd2"),
// which is the bug this list exists to prevent.
export const LAB_NFL_SCOPE_STATS = ['pyds', 'ryds', 'rec', 'recyds']

export function labStatSupportsScope(sport: LabSport, stat: string): boolean {
  return sport === 'nfl' && LAB_NFL_SCOPE_STATS.includes(stat)
}

function scopePrefix(scope: LabScope): string {
  return scope === 'season' ? '' : scope
}

/** Builds the "-<scope><stat><number>" line token (NFL scopes other than
 * "season" only make sense for NFL — callers should only offer them there). */
export function buildLineToken(stat: string, scope: LabScope, n: number): string {
  return `-${scopePrefix(scope)}${stat}${n}`
}

/** A full leg string for a player: "nfl josh allen -q1ryds10". */
export function buildPlayerLeg(sport: LabSport, playerName: string, stat: string, scope: LabScope, n: number): string {
  return `${sport} ${playerName.toLowerCase()} ${buildLineToken(stat, scope, n)}`
}

// Team legs are NFL-only. Grew from points-only to 5 stats with full
// quarter/half scoping (confirmed live 2026-10-26, deploy a7a6d4a — GET
// /lab/lines team_lines.nfl now lists all 5 with the same 9-entry scopes
// array scoped player stats carry; team_lines_pending.nfl is empty, so
// nothing's held back anymore).
export const LAB_TEAM_STATS: LabStatOption[] = [
  { value: 'pts', label: 'Points', default: 24 },
  { value: 'td', label: 'Any TD', default: 3 },
  { value: 'rtd', label: 'Rush TD', default: 1 },
  { value: 'ptd', label: 'Pass TD', default: 2 },
  { value: 'fg', label: 'Field Goal', default: 2 },
]

export function labTeamStatOption(stat: string): LabStatOption | undefined {
  return LAB_TEAM_STATS.find((s) => s.value === stat)
}

// Every team stat scopes identically (unlike player stats, where only 4 of
// 13 do) — widened past the player picker's 3-option trim to include every
// quarter/each half specifically, since those are the showcased use case
// ("KC a TD in each half", "a FG in each half" — the owner's original ask
// per backend). q2/q3/q4/2h stay hand-typed-only, same reasoning as the
// player scope trim.
export const LAB_TEAM_SCOPES: { value: LabScope; label: string }[] = [
  { value: 'season', label: 'full game' },
  { value: 'q1', label: '1st quarter' },
  { value: '1h', label: '1st half' },
  { value: 'eq', label: 'every quarter' },
  { value: 'eh', label: 'each half' },
]

export function buildTeamLeg(teamCode: string, stat: string, scope: LabScope, n: number): string {
  return `nfl team ${teamCode.toLowerCase()} ${buildLineToken(stat, scope, n)}`
}

// League-wide prop legs — a population rate ("how often does a QB start
// clear 2+ pass TD"), not one player's history. Confirmed live 2026-10-26
// (deploy abe7462). Every sport supports this (unlike team legs, which stay
// NFL-only); MLB has no position breakdown at all, so its picker should
// only ever offer "any", never a position chip row.
export const LAB_LEAGUE_POSITIONS: Record<LabSport, string[]> = {
  nfl: ['QB', 'RB', 'WR', 'TE'],
  cfb: ['QB', 'RB', 'WR', 'TE'],
  nba: ['G', 'F', 'C'],
  cbb: ['G', 'F', 'C'],
  nhl: ['C', 'LW', 'RW', 'D'],
  mlb: [],
}

// Same stat catalog player legs already use for this sport (confirmed
// live — "nfl qb -ptd2", "cfb wr -recyds100", "nba g -pts25" all reuse the
// exact per-sport stat keys already in LAB_STATS). Whole-game only, no
// scope ever — a scoped league leg errors server-side ("unknown line"),
// confirmed live.
export function buildLeagueLeg(sport: LabSport, positionOrAny: string, stat: string, n: number): string {
  return `${sport} ${positionOrAny.toLowerCase()} -${stat}${n}`
}

// Kept for when typed syntax returns alongside a legend (owner ask,
// 2026-10-19: picker-only for now) — not referenced by the page currently.
export const LAB_SYNTAX_EXAMPLES = [
  'nfl josh allen -q1ryds10',
  'nfl james cook -rr80',
  'nfl team buf -pts24',
  'nfl team kc -ehtd1',
  'nba jalen brunson -pra45',
  'mlb aaron judge -hr1',
  'nhl connor mcdavid -pts2',
]
