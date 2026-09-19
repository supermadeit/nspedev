// Hand-curated catalog of example commands — the source of truth for both
// {sample-queries} and predictive syntax text (searchSyntax() in
// syntaxSuggestions.ts, via sampleQueries.ts's buildSampleQueries()).
//
// Unlike the old buildSampleQueries() (which mechanically derived a small
// list from curatedDefaults.ts, the mobile calculator's own auto-default
// table), this is authored directly. Most of the breadth here — h2h,
// streak, team, first-PA, -ov, combo stats, period variants — has no
// calculator-default analogue at all, so deriving it mechanically bought
// little; curatedDefaults.ts stays exactly as it was, untouched and
// calculator-only.
//
// Every stat code used below is already registered in nspe-payloads.ts's
// STAT_FIELDS for its sport. Don't add a new stat/mode combo here without
// confirming that first — an unrecognized stat silently falls back to a
// bare "met=N" badge instead of a real value/date, the exact bug class this
// session spent several turns chasing down (-pr/-rr, the 1h engine's `value`
// vs `val` field, etc).
//
// Grammar per mode (mirrors QueryBuilder.tsx's builtCommand exactly):
//   trend      nspe {sport} {period?} {nfl-category?} -{stat}{N} -last{met}/{last}
//   compute    nspe {sport} {nfl-category?} -{stat} min{N} {-season|-career|-last{N}}
//   streak     nspe {sport} {nfl-category?} -{stat}{N} -streak{N}
//   team (mlb) nspe mlb team -{runs|allowed}{N} -last{met}/{last}  |  min{N} {window}
//   first (mlb)nspe mlb first -{xbh|walk|single|hit} -last{met}/{last}
//   h2h (mlb)  nspe mlb {player} vs {TEAM}
//   long       nspe {sport} long {nfl-category?} -{yds|hr}{N} -last{met}/{last}
//   -ov (nfl)  nspe nfl {long|1h|q1} {player} -ov {YYYY | -career | YYYY-YYYY}?

// Defined here (not sampleQueries.ts) since this is now the primary content
// file — sampleQueries.ts re-exports it so existing imports elsewhere don't
// need to change.
export interface SampleQuery {
  /** Short scannable label, e.g. "nba trend · pts (1h)". */
  label: string
  command: string
  // The literal substring inside THIS entry's own `command` that stands in
  // for "a player" — set only on commands that showcase one specific player
  // (mostly -ov and h2h). findPlayerSpotlightCommands (syntaxSuggestions.ts)
  // replaces it with whichever real player the live search currently has
  // topping the match list, so e.g. "nspe nfl long mahomes -ov" surfaces for
  // ANY searched player, not just Mahomes — must exactly match a substring
  // of `command` above (not the player's full real name) or the swap silently
  // no-ops.
  playerHint?: string
}

const NFL_COMMANDS: SampleQuery[] = [
  // trend
  { label: 'nfl trend · pass -yds', command: 'nspe nfl pass -yds225 -last1/1' },
  { label: 'nfl trend · pass -yds', command: 'nspe nfl pass -yds250 -last1/1' },
  { label: 'nfl trend · pass -yds', command: 'nspe nfl pass -yds300 -last1/1' },
  { label: 'nfl trend · pass -td', command: 'nspe nfl pass -td2 -last1/1' },
  { label: 'nfl trend · pass -td', command: 'nspe nfl pass -td3 -last1/1' },
  { label: 'nfl trend · rush -yds', command: 'nspe nfl rush -yds80 -last1/1' },
  { label: 'nfl trend · rush -yds', command: 'nspe nfl rush -yds100 -last1/1' },
  { label: 'nfl trend · rush -td', command: 'nspe nfl rush -td1 -last1/1' },
  { label: 'nfl trend · rec -yds', command: 'nspe nfl rec -yds70 -last1/1' },
  { label: 'nfl trend · rec -td', command: 'nspe nfl rec -td1 -last1/1' },
  { label: 'nfl trend · pass+rush (-pr)', command: 'nspe nfl -pr250 -last1/1' },
  { label: 'nfl trend · rush+rec (-rr)', command: 'nspe nfl -rr80 -last1/1' },
  { label: 'nfl trend · anytime TD', command: 'nspe nfl any -td2 -last1/1' },
  // compute
  { label: 'nfl compute · pass_yds', command: 'nspe nfl pass -yds min300 -last1' },
  { label: 'nfl compute · rush_yds', command: 'nspe nfl rush -yds min100 -last1' },
  { label: 'nfl compute · pass+rush (-pr)', command: 'nspe nfl -pr min250 -last1' },
  { label: 'nfl compute · rush+rec (-rr)', command: 'nspe nfl -rr min80 -last1' },
  // streak
  { label: 'nfl streak · pass -td', command: 'nspe nfl pass -td1 -streak3 2025' },
  { label: 'nfl streak · rush -yds', command: 'nspe nfl rush -yds50 -streak2 2025' },
  // 1h
  { label: 'nfl trend · pass (1h)', command: 'nspe nfl 1h pass -yds100 -last1/1' },
  { label: 'nfl trend · pass (1h)', command: 'nspe nfl 1h pass -yds120 -last1/1' },
  { label: 'nfl trend · pass (1h)', command: 'nspe nfl 1h pass -yds150 -last1/1' },
  // explosive
  { label: 'nfl explosive · pass', command: 'nspe nfl long pass -yds30 -last1/1' },
  { label: 'nfl explosive · rush', command: 'nspe nfl long rush -yds20 -last1/1' },
  { label: 'nfl explosive · rec', command: 'nspe nfl long rec -yds25 -last1/1' },
  { label: 'nfl explosive compute · pass', command: 'nspe nfl long pass -yds min400 -season' },
  // -ov — windows: bare YYYY, -career, YYYY-YYYY, or omitted (current season)
  { label: 'nfl overview · long (-ov)', command: 'nspe nfl long mahomes -ov', playerHint: 'mahomes' },
  { label: 'nfl overview · 1h (-ov, career)', command: 'nspe nfl 1h dak -ov -career', playerHint: 'dak' },
  { label: 'nfl overview · q1 (-ov)', command: 'nspe nfl q1 kenneth -ov', playerHint: 'kenneth' },
  { label: 'nfl overview · long (-ov, range)', command: 'nspe nfl long lamar -ov', playerHint: 'lamar' },
  { label: 'nfl overview · long (-ov)', command: 'nspe nfl long caleb -ov', playerHint: 'caleb' },
  { label: 'nfl overview · long (-ov)', command: 'nspe nfl long dak -ov 2025', playerHint: 'dak' },
  { label: 'nfl overview · q1 (-ov)', command: 'nspe nfl q1 dak -ov -career', playerHint: 'dak' },
  // -statN -ov — third -ov shape (see nspe-payloads.ts's
  // NflOverviewStatNPayload comment): "how many games has this player hit
  // >=N of this stat," own match list, own view. No window defaults to
  // current season; -career and YYYY-YYYY are also allowed, same as the
  // other -ov variants above.
  { label: 'nfl overview · 1h -yds150 (-ov, career)', command: 'nspe nfl dak 1h -yds150 -ov -career', playerHint: 'dak' },
  // h2h — divisional opponent (WSH is a real NFC East rival of DAL)
  { label: 'nfl h2h (career)', command: 'nspe nfl dak vs wsh -career', playerHint: 'dak' },
  // "-week" — career performance in one week number across every season,
  // a different concept from h2h (opponent) despite reusing the same
  // totals/games rendering. Confirmed live against a real backend response.
  { label: 'nfl career · week 1', command: 'nspe nfl dak -week1 -career', playerHint: 'dak' },
]

const MLB_COMMANDS: SampleQuery[] = [
  // trend
  { label: 'mlb trend/yst · hits', command: 'nspe mlb -hits2 -yst' },
  { label: 'mlb trend/yst · tb', command: 'nspe mlb -tb2 -yst' },
  { label: 'mlb trend/yst · hr', command: 'nspe mlb -hr1 -yst' },
  { label: 'mlb trend/yst · runs', command: 'nspe mlb -runs1 -yst' },
  { label: 'mlb trend/yst · runs', command: 'nspe mlb -runs2 -yst' },
  { label: 'mlb trend/yst · rbi', command: 'nspe mlb -rbi2 -yst' },
  { label: 'mlb trend/yst · rbi', command: 'nspe mlb -rbi1 -yst' },
  { label: 'mlb trend · hits', command: 'nspe mlb -hits2 -last3/5' },
  { label: 'mlb trend · hr', command: 'nspe mlb -hr1 -last1/1' },
  { label: 'mlb trend · rbi', command: 'nspe mlb -rbi2 -last3/5' },
  { label: 'mlb trend · runs', command: 'nspe mlb -runs2 -last2/5' },
  { label: 'mlb trend · tb', command: 'nspe mlb -tb2 -last4/5' },
  { label: 'mlb trend · doubles', command: 'nspe mlb -dub1 -last2/5' },
  { label: 'mlb trend · steals', command: 'nspe mlb -sb1 -last1/1' },
  { label: 'mlb trend · walks', command: 'nspe mlb -bb2 -last3/5' },
  // compute
  { label: 'mlb compute · runs', command: 'nspe mlb -runs min20 -last25' },
  { label: 'mlb compute · rbi', command: 'nspe mlb -rbi min10 -last10' },
  { label: 'mlb compute · tb', command: 'nspe mlb -tb min100 -season' },
  // streak
  { label: 'mlb streak · hits', command: 'nspe mlb -hits1 -streak5' },
  // -hr1 -streak3 (HR in 3 straight games) is rare enough it can genuinely
  // return zero qualifying players on a given day — tb2 is a far more
  // reliably-hit bar, so the sample never looks "broken" just from bad luck.
  { label: 'mlb streak · tb', command: 'nspe mlb -tb2 -streak3' },
  { label: 'mlb streak · hits', command: 'nspe mlb -hits1 -streak5' },
  { label: 'mlb streak · runs', command: 'nspe mlb -runs1 -streak5' },
  { label: 'mlb streak · rbi', command: 'nspe mlb -rbi1 -streak5' },
  { label: 'mlb streak · hr', command: 'nspe mlb -hr1 -streak2' },



  // explosive (HR distance)
  { label: 'mlb explosive · hr distance', command: 'nspe mlb long -hr350 -last1/5' },
  { label: 'mlb explosive compute · hr distance', command: 'nspe mlb long -hr min800 -last10' },
  // first plate appearance — no threshold N, one PA per game
  { label: 'mlb first pa · hit', command: 'nspe mlb first -hit -last1/1' },
  { label: 'mlb first pa · xbh', command: 'nspe mlb first -xbh -last1/5' },
  { label: 'mlb first pa · walk', command: 'nspe mlb first -walk -last1/5' },
  { label: 'mlb first pa · single', command: 'nspe mlb first -single -last1/5' },
  // team
  { label: 'mlb team trend · runs for', command: 'nspe mlb team -runs5 -last2/5' },
  { label: 'mlb team trend · runs allowed', command: 'nspe mlb team -allowed4 -last2/5' },
  { label: 'mlb team compute · runs for', command: 'nspe mlb team -runs min120 -last25' },
  { label: 'mlb team compute · runs allowed', command: 'nspe mlb team -allowed min500 -season' },
  // h2h
  { label: 'mlb h2h', command: 'nspe mlb aaron judge vs bos', playerHint: 'aaron judge' },
  { label: 'mlb h2h', command: 'nspe mlb shohei ohtani vs sf', playerHint: 'shohei ohtani' },
  { label: 'mlb h2h', command: 'nspe mlb juan soto vs atl', playerHint: 'juan soto' },
]

const NBA_COMMANDS: SampleQuery[] = [
  // trend
  { label: 'nba trend · pts', command: 'nspe nba -pts25 -last3/5' },
  { label: 'nba trend · reb', command: 'nspe nba -reb12 -last2/5' },
  { label: 'nba trend · ast', command: 'nspe nba -ast8 -last6/10' },
  { label: 'nba trend · 3pm', command: 'nspe nba -tpm4 -last1/1' },
  { label: 'nba trend · blk', command: 'nspe nba -blk3 -last2/4' },
  { label: 'nba trend · stl', command: 'nspe nba -stl3 -last3/5' },
  { label: 'nba trend · total (pts+reb+ast)', command: 'nspe nba -total50 -last1/3' },
  { label: 'nba trend · total (pts+reb+ast)', command: 'nspe nba -total40 -last2/4' },
  // Combo stats use each half separately dash-flagged, slash-joined
  // ("-pts/-ast35") — confirmed against a real backend response; sending
  // the old "-pts+ast35" form returns no results even locally.
  { label: 'nba trend · pts/ast', command: 'nspe nba -pts/-ast35 -last2/3' },
  { label: 'nba trend · pts/reb', command: 'nspe nba -pts/-reb35 -last2/5' },
  { label: 'nba trend · reb/ast', command: 'nspe nba -reb/-ast20 -last2/5' },
  { label: 'nba trend · stl/blk', command: 'nspe nba -stl/-blk4 -last2/5' },
  // period
  { label: 'nba trend · pts (q1)', command: 'nspe nba q1 -pts15 -last2/5' },
  { label: 'nba trend · pts (1h)', command: 'nspe nba 1h -pts20 -last2/3' },
  { label: 'nba trend · reb (1h)', command: 'nspe nba 1h -reb6 -last2/5' },
  // compute
  { label: 'nba compute · pts', command: 'nspe nba -pts min30 -last10' },
  { label: 'nba compute · reb', command: 'nspe nba -reb min60 -last10' },
  { label: 'nba compute · ast', command: 'nspe nba -ast min40 -last10' },
  { label: 'nba compute · total', command: 'nspe nba -total min80 -season' },
  // Pinned to 2025, not bare -season — the 2026 season just started, so
  // nobody would clear a 2000 cumulative pts+reb+ast threshold yet. Year
  // filter is real, working QueryBuilder syntax (see QueryBuilder.tsx's
  // builtCommand comment, "-season 2025"), not a new grammar.
  { label: 'nba compute · total (2025)', command: 'nspe nba -total min2000 -season 2025' },
  { label: 'nba compute · 3pm', command: 'nspe nba -tpm min20 -last10' },
  // streak
  { label: 'nba streak · pts', command: 'nspe nba -pts20 -streak3' },
  { label: 'nba streak · ast', command: 'nspe nba -ast8 -streak5' },
  { label: 'nba streak · reb', command: 'nspe nba -reb10 -streak4' },
  { label: 'nba streak · blk', command: 'nspe nba -blk2 -streak3' },
]

const NHL_COMMANDS: SampleQuery[] = [
  // trend
  { label: 'nhl trend · goals', command: 'nspe nhl -g1 -last2/5' },
  // Real token is -ast, not -a — confirmed live against utils/nspe_cli.py;
  // -a1 errored ("Unrecognized token for compute parser: a") on the actual
  // backend. See nspedev-next-session-punchlist-2026-09-17 item 7.
  { label: 'nhl trend · assists', command: 'nspe nhl -ast1 -last2/5' },
  { label: 'nhl trend · points', command: 'nspe nhl -pts2 -last3/5' },
  { label: 'nhl trend · shots on goal', command: 'nspe nhl -sog4 -last3/5' },
  // Blocks (-blk) and penalty minutes (-pim) shelved, not deleted — confirmed
  // broken against the live backend (see punchlist item 7): raw NHL scrape
  // data has no blocked-shots field at all (not a code fix, needs a scraper
  // change), and pim is scraped but never wired into the stat vocabulary.
  // Restore once the backend side is fixed.
  // { label: 'nhl trend · blocks', command: 'nspe nhl -blk2 -last3/5' },
  // { label: 'nhl trend · penalty minutes', command: 'nspe nhl -pim2 -last2/5' },
  { label: 'nhl trend · goals (single game)', command: 'nspe nhl -g1 -last1/1' },
  { label: 'nhl trend · sog (single game)', command: 'nspe nhl -sog5 -last1/1' },
  // period (p1 = first period, nhl's q1 equivalent)
  { label: 'nhl trend · goals (p1)', command: 'nspe nhl p1 -g1 -last1/1' },
  { label: 'nhl trend · points (p1)', command: 'nspe nhl p1 -pts1 -last2/5' },
  { label: 'nhl trend · sog (p1)', command: 'nspe nhl p1 -sog2 -last2/5' },
  // compute
  { label: 'nhl compute · goals', command: 'nspe nhl -g min10 -last10' },
  { label: 'nhl compute · assists', command: 'nspe nhl -ast min15 -last10' },
  { label: 'nhl compute · points', command: 'nspe nhl -pts min25 -last10' },
  { label: 'nhl compute · sog', command: 'nspe nhl -sog min50 -last10' },
  // Shelved alongside the trend -blk entry above — same missing-data root cause.
  // { label: 'nhl compute · blocks', command: 'nspe nhl -blk min20 -last10' },
  // streak
  { label: 'nhl streak · points', command: 'nspe nhl -pts1 -streak5' },
  { label: 'nhl streak · goals', command: 'nspe nhl -g1 -streak3' },
  { label: 'nhl streak · sog', command: 'nspe nhl -sog3 -streak4' },
]

// nfl/mlb listed first — promoteMoatCommands (sampleQueries.ts) additionally
// sorts nfl/mlb ahead of nba/nhl regardless of this array's order (it's
// currently nfl/mlb season), but this ordering keeps the raw catalog
// readable in the same priority for anyone editing it directly.
export const PREDICTIVE_COMMANDS: SampleQuery[] = [
  ...NFL_COMMANDS,
  ...MLB_COMMANDS,
  ...NBA_COMMANDS,
  ...NHL_COMMANDS,
]
