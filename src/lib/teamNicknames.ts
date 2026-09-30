// Team-code -> nickname (no city) lookup, for the matchup-box display
// convention adopted app-wide: "{PHI @ ATL}" reads as "{Phillies @ Braves}".
// Covers MLB/NBA/NHL. NFL has its own equivalent derived straight from
// worldcup.json (see buildFullNameMap/buildNicknameMap in WorldCupApp.tsx) —
// that's already the single source of truth for its codes, so it doesn't
// need a second, hand-maintained list here that could drift from it.
//
// Keys are uppercase codes. Several keys intentionally point at the same
// team where different engines/feeds in this app disagree on its code (CWS
// vs CHW for the White Sox, OAK vs ATH for the Athletics — see
// src/lib/teams.ts's own comment on this exact inconsistency) — this map is
// purely for display, so it costs nothing to be generous about which
// spelling it recognizes. A sport this map doesn't cover, or a code it
// doesn't recognize (including an already-descriptive placeholder string
// like a tiebreaker's "Yankees/Red Sox"), is returned unchanged.

const MLB_NICKNAMES: Record<string, string> = {
  ARI: 'Diamondbacks', AZ: 'Diamondbacks',
  ATL: 'Braves',
  BAL: 'Orioles',
  BOS: 'Red Sox',
  CHC: 'Cubs',
  CWS: 'White Sox', CHW: 'White Sox',
  CIN: 'Reds',
  CLE: 'Guardians',
  COL: 'Rockies',
  DET: 'Tigers',
  HOU: 'Astros',
  KC: 'Royals',
  LAA: 'Angels',
  LAD: 'Dodgers',
  MIA: 'Marlins',
  MIL: 'Brewers',
  MIN: 'Twins',
  NYM: 'Mets',
  NYY: 'Yankees',
  OAK: 'Athletics', ATH: 'Athletics',
  PHI: 'Phillies',
  PIT: 'Pirates',
  SD: 'Padres',
  SF: 'Giants',
  SEA: 'Mariners',
  STL: 'Cardinals',
  TB: 'Rays',
  TEX: 'Rangers',
  TOR: 'Blue Jays',
  WSH: 'Nationals', WAS: 'Nationals',
}

const NBA_NICKNAMES: Record<string, string> = {
  ATL: 'Hawks',
  BOS: 'Celtics',
  BKN: 'Nets', BRK: 'Nets',
  CHA: 'Hornets',
  CHI: 'Bulls',
  CLE: 'Cavaliers',
  DAL: 'Mavericks',
  DEN: 'Nuggets',
  DET: 'Pistons',
  GS: 'Warriors', GSW: 'Warriors',
  HOU: 'Rockets',
  IND: 'Pacers',
  LAC: 'Clippers',
  LAL: 'Lakers',
  MEM: 'Grizzlies',
  MIA: 'Heat',
  MIL: 'Bucks',
  MIN: 'Timberwolves',
  NO: 'Pelicans', NOP: 'Pelicans',
  NY: 'Knicks', NYK: 'Knicks',
  OKC: 'Thunder',
  ORL: 'Magic',
  PHI: 'Sixers', PHILA: 'Sixers',
  PHX: 'Suns',
  POR: 'Trail Blazers',
  SAC: 'Kings',
  SA: 'Spurs', SAS: 'Spurs',
  TOR: 'Raptors',
  UTAH: 'Jazz', UTA: 'Jazz',
  WSH: 'Wizards', WAS: 'Wizards',
}

const NHL_NICKNAMES: Record<string, string> = {
  ANA: 'Ducks',
  ARI: 'Coyotes', // pre-relocation code — harmless to keep mapped
  BOS: 'Bruins',
  BUF: 'Sabres',
  CGY: 'Flames',
  CAR: 'Hurricanes',
  CHI: 'Blackhawks',
  COL: 'Avalanche',
  CBJ: 'Blue Jackets',
  DAL: 'Stars',
  DET: 'Red Wings',
  EDM: 'Oilers',
  FLA: 'Panthers',
  LA: 'Kings', LAK: 'Kings',
  MIN: 'Wild',
  MTL: 'Canadiens',
  NSH: 'Predators',
  NJ: 'Devils', NJD: 'Devils',
  NYI: 'Islanders',
  NYR: 'Rangers',
  OTT: 'Senators',
  PHI: 'Flyers',
  PIT: 'Penguins',
  SJ: 'Sharks', SJS: 'Sharks',
  SEA: 'Kraken',
  STL: 'Blues',
  TB: 'Lightning', TBL: 'Lightning',
  TOR: 'Maple Leafs',
  UTAH: 'Mammoth', UTA: 'Mammoth', // formerly Arizona Coyotes
  VAN: 'Canucks',
  VGK: 'Golden Knights', VEG: 'Golden Knights',
  WSH: 'Capitals', WAS: 'Capitals',
  WPG: 'Jets',
}

const NICKNAME_MAPS: Record<string, Record<string, string>> = {
  mlb: MLB_NICKNAMES,
  nba: NBA_NICKNAMES,
  nhl: NHL_NICKNAMES,
}

export function teamNickname(sport: string, code: string): string {
  const map = NICKNAME_MAPS[sport]
  if (!map || !code) return code
  return map[code.toUpperCase()] ?? code
}
