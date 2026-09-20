// Current NFL week for the {nfl.season} page and the weekly matchup slate.
// worldcup.json's own current_week is null in the bundled snapshot (which is
// why the page opened on week 1), and nfl_schedule.json carries only weekday
// names, no calendar dates — so the week is derived from the season opener:
// week N is "active" from the Tuesday before its games until the next
// Tuesday (games run through Monday night, so the week doesn't advance until
// Tuesday, matching the backend's rollover).
//
// BUMP EACH SEASON: set SEASON_FIRST_TUESDAY to the Tuesday of opening week
// (2026 opener is Wed 9/9, so Tue 9/8). A non-null current_week from the
// data file always wins over this.
const SEASON_FIRST_TUESDAY = new Date(2026, 8, 8) // local time; month is 0-based

export function getCurrentNflWeek(totalWeeks: number, dataCurrentWeek: number | null | undefined): number {
  if (typeof dataCurrentWeek === 'number') return Math.min(Math.max(dataCurrentWeek, 1), totalWeeks)
  const now = new Date()
  const days = Math.floor((now.getTime() - SEASON_FIRST_TUESDAY.getTime()) / 86_400_000)
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), totalWeeks)
}
