// {sap.zilla}'s guided leg builder — turns a (league, player/team, stat,
// scope, number) selection into the exact leg string POST /lab expects
// ("nfl josh allen -eqryds10"), so most people never have to hand-write the
// syntax. Deliberately scoped to the stats/scopes backend's contract
// documented with an unambiguous, fully-written example (season-scope
// stats for all four sports; NFL's quarter/half/every-quarter scopes) —
// anything a user wants beyond this list can still be typed directly into
// the raw legs box next to this picker, using the same cheat sheet shown
// there. A bad leg just comes back in `errors[]` (per the contract), so a
// wrong guess here degrades to a clear per-leg error, not a crash.
export type LabSport = 'nfl' | 'nba' | 'mlb' | 'nhl'

export interface LabStatOption {
  value: string
  label: string
}

export const LAB_SPORTS: { value: LabSport; label: string }[] = [
  { value: 'nfl', label: 'NFL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
]

export const LAB_STATS: Record<LabSport, LabStatOption[]> = {
  nfl: [
    { value: 'pyds', label: 'Pass Yds' },
    { value: 'ptd', label: 'Pass TD' },
    { value: 'ryds', label: 'Rush Yds' },
    { value: 'rtd', label: 'Rush TD' },
    { value: 'rec', label: 'Receptions' },
    { value: 'recyds', label: 'Rec Yds' },
    { value: 'rectd', label: 'Rec TD' },
    { value: 'rr', label: 'Rush+Rec Yds' },
    { value: 'rrtd', label: 'Rush+Rec TD' },
    { value: 'pr', label: 'Pass+Rush Yds' },
    { value: 'plong', label: 'Longest Pass' },
    { value: 'rlong', label: 'Longest Rush' },
    { value: 'reclong', label: 'Longest Reception' },
  ],
  nba: [
    { value: 'pts', label: 'PTS' },
    { value: 'reb', label: 'REB' },
    { value: 'ast', label: 'AST' },
    { value: 'tpm', label: '3PM' },
    { value: 'stl', label: 'STL' },
    { value: 'blk', label: 'BLK' },
    { value: 'pra', label: 'PTS+REB+AST' },
    { value: 'pa', label: 'PTS+AST' },
    { value: 'pr', label: 'PTS+REB' },
    { value: 'ra', label: 'REB+AST' },
  ],
  mlb: [
    { value: 'h', label: 'Hits' },
    { value: 'r', label: 'Runs' },
    { value: 'rbi', label: 'RBI' },
    { value: 'tb', label: 'Total Bases' },
    { value: 'bb', label: 'Walks' },
    { value: 'hr', label: 'Home Runs' },
    { value: 'hrr', label: 'HRR' },
    { value: 'k', label: 'Strikeouts' },
  ],
  nhl: [
    { value: 'sog', label: 'SOG' },
    { value: 'g', label: 'Goals' },
    { value: 'a', label: 'Assists' },
    { value: 'pts', label: 'Points' },
    { value: 'blk', label: 'Blocks' },
  ],
}

// NFL-only — quarter/half scopes prefix the stat token. "every quarter"/
// "each half" mean the threshold held in all 4 quarters / both halves of
// the same game, not a one-time hit; backend's examples: -eqryds10,
// -eqpyds, -eqrecyds, -eqrec, -q1pyds40, -1hryds40, -ehryds10.
export type LabScope = 'season' | 'q1' | 'q2' | 'q3' | 'q4' | '1h' | '2h' | 'eq' | 'eh'

export const LAB_NFL_SCOPES: { value: LabScope; label: string }[] = [
  { value: 'season', label: 'any game' },
  { value: 'q1', label: '1st quarter' },
  { value: 'q2', label: '2nd quarter' },
  { value: 'q3', label: '3rd quarter' },
  { value: 'q4', label: '4th quarter' },
  { value: '1h', label: '1st half' },
  { value: '2h', label: '2nd half' },
  { value: 'eq', label: 'every quarter' },
  { value: 'eh', label: 'each half' },
]

function scopePrefix(scope: LabScope): string {
  return scope === 'season' ? '' : scope
}

/** Builds the "-<scope><stat><number>" line token (NFL scopes other than
 * "season" only make sense for NFL — callers should only offer them there). */
export function buildLineToken(stat: string, scope: LabScope, n: number): string {
  return `-${scopePrefix(scope)}${stat}${n}`
}

/** A full leg string for a player: "nfl josh allen -eqryds10". */
export function buildPlayerLeg(sport: LabSport, playerName: string, stat: string, scope: LabScope, n: number): string {
  return `${sport} ${playerName.toLowerCase()} ${buildLineToken(stat, scope, n)}`
}

/** Team legs are NFL-only, points-only in v1 (confirmed 2026-10-19 — team
 * TD lines error, team box scores have no TD field on file yet). */
export function buildTeamLeg(teamCode: string, n: number): string {
  return `nfl team ${teamCode.toLowerCase()} -pts${n}`
}

// Shown next to the raw-legs box so anyone who wants a scope/stat this
// picker doesn't cover can still type it correctly, straight from the
// contract rather than a guess.
export const LAB_SYNTAX_EXAMPLES = [
  'nfl josh allen -eqryds10',
  'nfl james cook -rr80',
  'nfl team buf -pts24',
  'nba jalen brunson -pra45',
  'mlb aaron judge -hr1',
  'nhl connor mcdavid -pts2',
]
