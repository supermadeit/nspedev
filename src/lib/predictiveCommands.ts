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
//   parlay(nfl)nspe nfl -parlay -week{N} -shape {S}? -risk {longshot|safe}?
//   legs (nfl) nspe nfl {player} -week{N} -legs
//   slots(nfl) nspe nfl {player} -slots -ov [pass|rush|rec] [window] | {player} -mnf|-snf|-tnf|-prime|-1pm|-4pm -ov [-statN] | {pass|rush|rec} -statN -mnf -leaderboard | team [TEAM] -mnf|...

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
  // The backend's -weekN engine only tracks QBs (confirmed live: "isn't in
  // the tracked QB pool"), so this template is skipped for every other
  // position by findPlayerSpotlightCommands.
  qbOnly?: boolean
  // Only surface for this exact player (lowercase full name, same string as
  // playerHint) instead of swapping in whoever was searched — for commands
  // that only work for a tracked subset (-staff needs data/output/mlb_bvp).
  onlyFor?: string
  // 'middle' pins the entry near the middle of the ordered list instead of
  // wherever promoteMoatCommands (sampleQueries.ts) would put it — for
  // commands that match the moat pattern but shouldn't lead the dropdown.
  placement?: 'middle'
}

import { getCurrentNflWeek } from './nflWeek'

// Parlay/legs commands take the slate's week. Tracks the current NFL week
// (see nflWeek.ts) instead of a hardcoded number, so the examples stay
// runnable as the season advances.
const PARLAY_WEEK = getCurrentNflWeek(18, null)

// Every shape the parlay builder accepts. Omitting -shape defaults to 3/2/1;
// omitting -risk (or a bare -risk) defaults to standard. The backend's -risk
// only recognizes "safe" and "longshot" (utils/nspe_cli.py) — any other word,
// including "short", is silently ignored and returns the standard parlay, so
// the examples use "safe". Typing "short" still finds them (see the keyword
// alias in syntaxSuggestions.ts).
const PARLAY_SHAPES = ['3/2/1', '3/3/3', '2/2', '5/4/3/2/1', '5/5/5/5/5', '6/6/6/6/6/6']

function buildParlayCommands(): SampleQuery[] {
  const out: SampleQuery[] = [
    { label: 'nfl parlay · default', command: `nspe nfl -parlay -week${PARLAY_WEEK}` },
  ]
  for (const shape of PARLAY_SHAPES) {
    out.push({ label: `nfl parlay · ${shape}`, command: `nspe nfl -parlay -week${PARLAY_WEEK} -shape ${shape}` })
    out.push({ label: `nfl parlay · ${shape} longshot`, command: `nspe nfl -parlay -week${PARLAY_WEEK} -shape ${shape} -risk longshot` })
    out.push({ label: `nfl parlay · ${shape} safe`, command: `nspe nfl -parlay -week${PARLAY_WEEK} -shape ${shape} -risk safe` })
  }
  out.push({ label: 'nfl parlay · 3/3/3 standard risk', command: `nspe nfl -parlay -week${PARLAY_WEEK} -shape 3/3/3 -risk` })
  return out
}

const NFL_COMMANDS: SampleQuery[] = [
  // trend
  { label: 'nfl trend · pass -yds', command: 'nspe nfl pass -yds225 -last1/1' },
  { label: 'nfl trend · pass -yds', command: 'nspe nfl pass -yds250 -last1/1' },
  { label: 'nfl trend · pass -yds', command: 'nspe nfl pass -yds300 -last1/1' },
  { label: 'nfl trend · pass -td', command: 'nspe nfl pass -td1 -last1/1' },
  { label: 'nfl trend · pass -td', command: 'nspe nfl pass -td2 -last1/1' },
  { label: 'nfl trend · pass -td', command: 'nspe nfl pass -td3 -last1/1' },
  { label: 'nfl trend · rush -yds', command: 'nspe nfl rush -yds60 -last1/1' },
  { label: 'nfl trend · rush -yds', command: 'nspe nfl rush -yds80 -last1/1' },
  { label: 'nfl trend · rush -yds', command: 'nspe nfl rush -yds100 -last1/1' },
  { label: 'nfl trend · rush -td', command: 'nspe nfl rush -td1 -last1/1' },
  { label: 'nfl trend · rush -td', command: 'nspe nfl rush -td2 -last1/1' },
  { label: 'nfl trend · rec -yds', command: 'nspe nfl rec -yds50 -last1/1' },
  { label: 'nfl trend · rec -yds', command: 'nspe nfl rec -yds60 -last1/1' },
  { label: 'nfl trend · rec -yds', command: 'nspe nfl rec -yds80 -last1/1' },
  { label: 'nfl trend · rec -yds', command: 'nspe nfl rec -yds100 -last1/1' },
  { label: 'nfl trend · rec -td', command: 'nspe nfl rec -td1 -last1/1' },
  { label: 'nfl trend · rec -td', command: 'nspe nfl rec -td2 -last1/1' },
  { label: 'nfl trend · pass+rush (-pr)', command: 'nspe nfl -pr200 -last1/1' },
  { label: 'nfl trend · pass+rush (-pr)', command: 'nspe nfl -pr250 -last1/1' },
  { label: 'nfl trend · pass+rush (-pr)', command: 'nspe nfl -pr300 -last1/1' },
  { label: 'nfl trend · pass+rush (-pr)', command: 'nspe nfl -pr350 -last1/1' },
  { label: 'nfl trend · rush+rec (-rr)', command: 'nspe nfl -rr80 -last1/1' },
  { label: 'nfl trend · rush+rec (-rr)', command: 'nspe nfl -rr100 -last1/1' },
  { label: 'nfl trend · rush+rec (-rr)', command: 'nspe nfl -rr120 -last1/1' },
  { label: 'nfl trend · rush+rec (-rr)', command: 'nspe nfl -rr150 -last1/1' },
  { label: 'nfl trend · anytime TD', command: 'nspe nfl any -td1 -last1/1' },
  { label: 'nfl trend · anytime TD', command: 'nspe nfl any -td2 -last1/1' },
  { label: 'nfl trend · anytime TD', command: 'nspe nfl any -td3 -last1/1' },
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
  // Position-agnostic player templates — the backend infers rush/rec/pass
  // category from the player, so these work for every NFL player (verified
  // live for Derrick Henry and CeeDee Lamb, not just QBs).
  { label: 'nfl overview · scopes (-ov)', command: 'nspe nfl derrick henry -ov', playerHint: 'derrick henry' },
  { label: 'nfl overview · 1h -yds50 (-ov, career)', command: 'nspe nfl 1h derrick henry -yds50 -ov -career', playerHint: 'derrick henry' },
  { label: 'nfl overview · long (-ov)', command: 'nspe nfl long derrick henry -ov', playerHint: 'derrick henry' },
  // Broadcast slots — MNF/SNF/TNF/FRI-SAT/PRIME (MNF+SNF+TNF+FRI/SAT)/1PM/4PM.
  // Windows: -career, YYYY, YYYY-YYYY, or omitted (current season). Coverage
  // is solid from ~2016; earlier games are partly missing. Backend: player
  // tables are engine nfl_player_slots, team is nfl_team_slots.
  // Player slot comparison table (default category, or pass|rush|rec named):
  { label: 'nfl slots · compare all slots', command: 'nspe nfl derrick henry -slots -ov -career', playerHint: 'derrick henry' },
  { label: 'nfl slots · this season', command: 'nspe nfl derrick henry -slots -ov', playerHint: 'derrick henry' },
  { label: 'nfl slots · one season', command: 'nspe nfl derrick henry -slots -ov 2025', playerHint: 'derrick henry' },
  { label: 'nfl slots · range', command: 'nspe nfl derrick henry -slots -ov 2020-2025', playerHint: 'derrick henry' },
  { label: 'nfl slots · pass', command: 'nspe nfl mahomes -slots pass -ov -career' },
  { label: 'nfl slots · rec', command: 'nspe nfl cmac -slots -ov rec -career' },
  // Single-slot personal views (bare table, or "how many games hit N"):
  { label: 'nfl slot · MNF', command: 'nspe nfl derrick henry -mnf -ov -career', playerHint: 'derrick henry' },
  { label: 'nfl slot · SNF', command: 'nspe nfl derrick henry -snf -ov -career', playerHint: 'derrick henry' },
  { label: 'nfl slot · TNF', command: 'nspe nfl derrick henry -tnf -ov -career', playerHint: 'derrick henry' },
  { label: 'nfl slot · primetime', command: 'nspe nfl derrick henry -prime -ov -career', playerHint: 'derrick henry' },
  { label: 'nfl slot · MNF td2', command: 'nspe nfl derrick henry -mnf -td2 -ov -career', playerHint: 'derrick henry' },
  { label: 'nfl slot · SNF yds', command: 'nspe nfl mahomes -snf -yds300 -ov -career' },
  { label: 'nfl slot · TNF combined td', command: 'nspe nfl cmac any -tnf -td2 -ov -career' },
  { label: 'nfl slot · MNF rush+rec td', command: 'nspe nfl cmac rushrec -mnf -td2 -ov -career' },
  // League leaderboards filtered by slot (slots can be combined; -topN):
  { label: 'nfl slot leaderboard · MNF', command: 'nspe nfl pass -yds300 -mnf -leaderboard -career' },
  { label: 'nfl slot leaderboard · primetime', command: 'nspe nfl pass -yds300 -prime -leaderboard -career -top10' },
  { label: 'nfl slot leaderboard · SNF+TNF', command: 'nspe nfl pass -yds300 -snf -tnf -leaderboard 2025' },
  { label: 'nfl slot leaderboard · rush', command: 'nspe nfl rush -yds100 -snf -leaderboard -career' },
  { label: 'nfl slot leaderboard · rec', command: 'nspe nfl rec -yds100 -mnf -leaderboard -career -top10' },
  // Team records by slot (one team also lists each game):
  { label: 'nfl team slot · MNF', command: 'nspe nfl team -mnf -career' },
  { label: 'nfl team slot · SNF', command: 'nspe nfl team -snf -career' },
  { label: 'nfl team slot · TNF', command: 'nspe nfl team -tnf -career' },
  { label: 'nfl team slot · 1PM', command: 'nspe nfl team -1pm -career' },
  { label: 'nfl team slot · 4PM', command: 'nspe nfl team -4pm -career' },
  { label: 'nfl team slot · primetime', command: 'nspe nfl team KC -prime -career' },
  { label: 'nfl team slot · range', command: 'nspe nfl team dal -tnf 2020-2025' },
  // Player legs — every candidate parlay leg for one NFL player this week.
  // playerHint makes it surface for whichever NFL player is searched.
  { label: 'nfl player legs', command: `nspe nfl jonathan taylor -week${PARLAY_WEEK} -legs`, playerHint: 'jonathan taylor' },
  // h2h — divisional opponent (WSH is a real NFC East rival of DAL)
  { label: 'nfl h2h (career)', command: 'nspe nfl dak vs wsh -career', playerHint: 'dak' },
  // "-week" — career performance in one week number across every season,
  // a different concept from h2h (opponent) despite reusing the same
  // totals/games rendering. Confirmed live against a real backend response.
  { label: 'nfl career · week 1', command: 'nspe nfl dak -week1 -career', playerHint: 'dak', qbOnly: true },
]

const MLB_COMMANDS: SampleQuery[] = [
  // trend
  { label: 'mlb trend/yst · hits', command: 'nspe mlb -hits1 -yst' },
  { label: 'mlb trend/yst · hits', command: 'nspe mlb -hits2 -yst' },
  { label: 'mlb trend/yst · hits', command: 'nspe mlb -hits3 -yst' },
  { label: 'mlb trend/yst · tb', command: 'nspe mlb -tb2 -yst' },
  { label: 'mlb trend/yst · hr', command: 'nspe mlb -hr1 -yst' },
  { label: 'mlb trend/yst · runs', command: 'nspe mlb -runs1 -yst' },
  { label: 'mlb trend/yst · runs', command: 'nspe mlb -runs2 -yst' },
  { label: 'mlb trend/yst · rbi', command: 'nspe mlb -rbi2 -yst' },
  { label: 'mlb trend/yst · rbi', command: 'nspe mlb -rbi1 -yst' },
  { label: 'mlb trend · hits', command: 'nspe mlb -hits1 -last3/5' },
  { label: 'mlb trend · hits', command: 'nspe mlb -hits2 -last3/5' },
  { label: 'mlb trend · hits', command: 'nspe mlb -hits3 -last3/5' },
  { label: 'mlb trend · hr', command: 'nspe mlb -hr1 -last1/1' },
  { label: 'mlb trend · hr', command: 'nspe mlb -hr2 -last1/1' },
  { label: 'mlb trend · rbi', command: 'nspe mlb -rbi1 -last3/5' },
  { label: 'mlb trend · rbi', command: 'nspe mlb -rbi2 -last3/5' },
  { label: 'mlb trend · rbi', command: 'nspe mlb -rbi3 -last3/5' },
  { label: 'mlb trend · runs', command: 'nspe mlb -runs1 -last2/5' },
  { label: 'mlb trend · runs', command: 'nspe mlb -runs2 -last2/5' },
  { label: 'mlb trend · runs', command: 'nspe mlb -runs3 -last2/5' },
  { label: 'mlb trend · tb', command: 'nspe mlb -tb1 -last4/5' },
  { label: 'mlb trend · tb', command: 'nspe mlb -tb2 -last4/5' },
  { label: 'mlb trend · tb', command: 'nspe mlb -tb3 -last4/5' },
  { label: 'mlb trend · doubles', command: 'nspe mlb -dub1 -last2/5' },
  { label: 'mlb trend · doubles', command: 'nspe mlb -dub2 -last2/5' },
  { label: 'mlb trend · steals', command: 'nspe mlb -sb1 -last1/1' },
  { label: 'mlb trend · steals', command: 'nspe mlb -sb2 -last1/1' },
  { label: 'mlb trend · walks', command: 'nspe mlb -bb1 -last3/5' },
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
  // Restored 2026-09-21 after prod got data/output/mlb_hr_tracker.json (it was
  // gitignored, so every `mlb long -hr...` returned zero rows). Pinned to the
  // middle of the ordered list (placement: 'middle', see sampleQueries.ts)
  // rather than promoted to the front like other `long` commands.
  { label: 'mlb explosive · hr distance', command: 'nspe mlb long -hr350 -last1/5', placement: 'middle' },
  { label: 'mlb explosive compute · hr distance', command: 'nspe mlb long -hr min800 -last10', placement: 'middle' },
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
  // -staff — season vs the team + career vs their CURRENT pitching staff
  // (engines/mlb/bvp.py). Backend only has per-pitcher data for a tracked
  // set of batters, so each entry is pinned to its player via onlyFor.
  { label: 'mlb h2h · staff', command: 'nspe mlb rafael devers vs bos -staff', playerHint: 'rafael devers', onlyFor: 'rafael devers' },
  { label: 'mlb h2h · staff', command: 'nspe mlb aaron judge vs bos -staff', playerHint: 'aaron judge', onlyFor: 'aaron judge' },
  { label: 'mlb h2h · staff', command: 'nspe mlb shohei ohtani vs sf -staff', playerHint: 'shohei ohtani', onlyFor: 'shohei ohtani' },
  { label: 'mlb h2h · staff', command: 'nspe mlb yordan alvarez vs bos -staff', playerHint: 'yordan alvarez', onlyFor: 'yordan alvarez' },
  { label: 'mlb h2h · staff', command: 'nspe mlb juan soto vs atl -staff', playerHint: 'juan soto', onlyFor: 'juan soto' },
  { label: 'mlb h2h · staff', command: 'nspe mlb pete alonso vs bos -staff', playerHint: 'pete alonso', onlyFor: 'pete alonso' },
  { label: 'mlb h2h · staff', command: 'nspe mlb pete crow armstrong vs stl -staff', playerHint: 'pete crow armstrong', onlyFor: 'pete crow armstrong' },
]

const NBA_COMMANDS: SampleQuery[] = [
  // trend
  { label: 'nba trend · pts', command: 'nspe nba -pts20 -last3/5' },
  { label: 'nba trend · pts', command: 'nspe nba -pts25 -last3/5' },
  { label: 'nba trend · pts', command: 'nspe nba -pts30 -last3/5' },
  { label: 'nba trend · reb', command: 'nspe nba -reb6 -last2/5' },
  { label: 'nba trend · reb', command: 'nspe nba -reb8 -last2/5' },
  { label: 'nba trend · reb', command: 'nspe nba -reb10 -last2/5' },
  { label: 'nba trend · reb', command: 'nspe nba -reb12 -last2/5' },
  { label: 'nba trend · ast', command: 'nspe nba -ast6 -last6/10' },
  { label: 'nba trend · ast', command: 'nspe nba -ast8 -last6/10' },
  { label: 'nba trend · ast', command: 'nspe nba -ast10 -last6/10' },
  { label: 'nba trend · 3pm', command: 'nspe nba -tpm2 -last1/1' },
  { label: 'nba trend · 3pm', command: 'nspe nba -tpm3 -last1/1' },
  { label: 'nba trend · 3pm', command: 'nspe nba -tpm4 -last1/1' },
  { label: 'nba trend · 3pm', command: 'nspe nba -tpm5 -last1/1' },
  { label: 'nba trend · blk', command: 'nspe nba -blk1 -last2/4' },
  { label: 'nba trend · blk', command: 'nspe nba -blk2 -last2/4' },
  { label: 'nba trend · blk', command: 'nspe nba -blk3 -last2/4' },
  { label: 'nba trend · blk', command: 'nspe nba -blk4 -last2/4' },
  { label: 'nba trend · stl', command: 'nspe nba -stl2 -last3/5' },
  { label: 'nba trend · stl', command: 'nspe nba -stl3 -last3/5' },
  { label: 'nba trend · stl', command: 'nspe nba -stl4 -last3/5' },
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
  { label: 'nhl trend · goals', command: 'nspe nhl -g2 -last2/5' },
  // Real token is -ast, not -a — confirmed live against utils/nspe_cli.py;
  // -a1 errored ("Unrecognized token for compute parser: a") on the actual
  // backend. See nspedev-next-session-punchlist-2026-09-17 item 7.
  { label: 'nhl trend · assists', command: 'nspe nhl -ast1 -last2/5' },
  { label: 'nhl trend · assists', command: 'nspe nhl -ast2 -last2/5' },
  { label: 'nhl trend · points', command: 'nspe nhl -pts1 -last3/5' },
  { label: 'nhl trend · points', command: 'nspe nhl -pts2 -last3/5' },
  { label: 'nhl trend · points', command: 'nspe nhl -pts3 -last3/5' },
  { label: 'nhl trend · shots on goal', command: 'nspe nhl -sog3 -last3/5' },
  { label: 'nhl trend · shots on goal', command: 'nspe nhl -sog4 -last3/5' },
  { label: 'nhl trend · shots on goal', command: 'nspe nhl -sog5 -last3/5' },
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
  ...buildParlayCommands(),
  ...MLB_COMMANDS,
  ...NBA_COMMANDS,
  ...NHL_COMMANDS,
]
