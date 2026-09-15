// Curated defaults — real commands confirmed as "reasonable, actionable
// prompts that yield results but not too many." Replaces the generic
// smallest-preset/met3-last5 (trend) or min-of-smallest-preset/-last10
// (compute) fallback in useCalculatorQuery.ts's auto-default effect for
// anything listed here. Safe to extend incrementally — anything not listed
// still falls back to the generic default, so partial coverage is fine.

// Trend: [threshold, met, last] — e.g. `pts: [25, 3, 5]` means
// "nspe nba -pts25 -last3/5". Period-scoped stats (currently only NBA's 1h)
// use a compound key `${stat}_${period}` (e.g. "pts_1h") checked before the
// plain stat key. NFL is additionally split by yds/td type, e.g.
// "pass_yds" — see useCalculatorQuery.ts's lookup for the exact precedence.
export const CURATED_TREND_DEFAULTS: Record<string, Record<string, [threshold: number, met: number, last: number]>> = {
  nba: {
    pts: [25, 3, 5],
    reb: [12, 2, 5],
    tpm: [4, 1, 1],
    ast: [8, 6, 10],
    blk: [3, 2, 4],
    stl: [3, 3, 5],
    total: [50, 1, 3],
    pts_1h: [20, 2, 3],
  },
  mlb: {
    hits: [2, 3, 5],
    rbi: [2, 3, 5],
    runs: [2, 2, 5],
    hr: [1, 1, 1],
    tb: [2, 4, 5],
  },
  // met/last pinned to 1/1 for every NFL entry — the season just started, so
  // a 3/5 or similar multi-game window would be asking for more games than
  // any player has actually played yet. Revisit once there's enough season
  // depth for a wider window to make sense again.
  nfl: {
    pass_yds: [300, 1, 1],
    rush_yds: [100, 1, 1],
    // "-total" (pass+rush / rush+rec combo) — only the threshold is curated,
    // met/last follow the same season-start 1/1 pin as the rest of NFL.
    // rush and rec share the same threshold since they both resolve to the
    // same rush+rec combo stat.
    pass_total: [250, 1, 1],
    rush_total: [100, 1, 1],
    rec_total: [100, 1, 1],
  },
}

// Compute: min value + window. `window: '-last'` pairs with `windowN`;
// `window: '-season'` needs no count. E.g. `runs: {min:20, window:'-last',
// windowN:25}` means "nspe mlb -runs min20 -last25".
export const CURATED_COMPUTE_DEFAULTS: Record<
  string,
  Record<string, { min: number; window: '-last' | '-season'; windowN?: number }>
> = {
  mlb: {
    runs: { min: 20, window: '-last', windowN: 25 },
    rbi: { min: 10, window: '-last', windowN: 10 },
    tb: { min: 100, window: '-season' },
  },
}

// Explosive mode trend defaults, keyed by league then play type (NFL only
// for now — MLB explosive has no play-type dimension). met/last pinned to
// 1/1 for NFL, same season-start reasoning as CURATED_TREND_DEFAULTS.nfl
// above — revisit once there's enough season depth for a wider window.
export const CURATED_EXPLOSIVE_TREND_DEFAULTS: Record<string, Record<string, [threshold: number, met: number, last: number]>> = {
  nfl: {
    pass: [30, 1, 1],
  },
}

// Team mode compute defaults, keyed by teamStat ('runs' | 'allowed') — same
// shape as CURATED_COMPUTE_DEFAULTS above, just not sport-nested since team
// mode is MLB-only.
export const CURATED_TEAM_COMPUTE_DEFAULTS: Record<string, { min: number; window: '-last' | '-season'; windowN?: number }> = {
  runs: { min: 120, window: '-last', windowN: 25 },
  allowed: { min: 500, window: '-season' },
}
