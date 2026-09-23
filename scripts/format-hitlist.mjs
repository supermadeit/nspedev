#!/usr/bin/env node
// Convert backend-results.json into the hitlist.json shape consumed by the ticker.
//
// Usage:
//   node scripts/format-hitlist.mjs
//   node scripts/format-hitlist.mjs --in path/to/backend-results.json --out path/to/hitlist.json
//
// The input is the raw `*_stat_leaderboard` payload emitted by the backend
// (kind, query, thresholds, rows). The output is an array whose first element
// is a `{ raw }` header banner and remaining elements are per-player rows
// trimmed to { team, player, stat, threshold, games_meeting, window_games? }.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const defaultIn = resolve(repoRoot, 'src/assets/data/backend-results.json')
const defaultOut = resolve(repoRoot, 'src/assets/data/hitlist.json')

function parseArgs(argv) {
  const args = { in: defaultIn, out: defaultOut }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--in' || arg === '-i') args.in = resolve(argv[++i])
    else if (arg === '--out' || arg === '-o') args.out = resolve(argv[++i])
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/format-hitlist.mjs [--in <file>] [--out <file>]')
      process.exit(0)
    }
  }
  return args
}

function sportFromKind(kind) {
  if (typeof kind !== 'string') return ''
  const match = /^([a-z]+)_/i.exec(kind)
  return match ? match[1].toLowerCase() : ''
}

// Mirrors App.tsx's STAT_LABELS (src/App.tsx, ~line 179) — kept in sync by
// hand since this script runs standalone (no TS import). Only the header
// banner's own text needs this; each row's own `stat` field is left as the
// raw key (e.g. "rec_yds"), and App.tsx's STAT_LABELS maps that the same
// way when rendering the per-player line, so the header and the rows read
// the same unit ("100yds+" ... "{100yds 2G season}") instead of the header
// alone showing the raw "rec_yds".
const HEADER_STAT_LABELS = {
  pass_yds: 'yds',
  rush_yds: 'yds',
  rec_yds: 'yds',
  pass_td: 'td',
  rush_td: 'td',
  rec_td: 'td',
}

function buildRawHeader({ sport, query, topN, windowLabel }) {
  const sportLabel = (sport || '').toUpperCase()
  const rawStat = String(query?.stat ?? query?.short ?? '').toLowerCase()
  const stat = HEADER_STAT_LABELS[rawStat] || rawStat
  const threshold = query?.threshold
  const thresholdPart = threshold !== undefined && threshold !== null
    ? `${threshold}${stat}+`
    : `${stat}+`
  const topPart = topN ? ` {top${topN}}` : ''
  const windowPart = windowLabel ? ` {${windowLabel}}` : ''
  return `${sportLabel} ${thresholdPart}${topPart}${windowPart}`.trim()
}

function buildEntry(row, { stat, threshold, windowGames }) {
  // Different leaderboard engines name the "games meeting the threshold"
  // field differently — the MLB stat-leaderboard payload calls it
  // `games_meeting`, the NFL leaderboard payload calls it `count`. Same
  // meaning either way (Jared Goff's `count: 6` lines up with exactly 6
  // entries in his `matches` array), so prefer games_meeting when present
  // and fall back to count rather than requiring every engine to agree on
  // a field name.
  const gamesMeeting = typeof row.games_meeting === 'number' ? row.games_meeting : row.count

  const out = {
    team: row.team ?? '',
    player: row.player ?? '',
    stat,
    threshold,
    games_meeting: gamesMeeting,
  }
  if (typeof windowGames === 'number') {
    out.window_games = windowGames
  }

  // The specific game the player most recently hit this in — every
  // leaderboard engine seen so far sorts `matches` newest-first, so
  // matches[0] is the latest qualifying game. Field names vary by engine
  // (val/date for the NFL leaderboard, value/date_iso for some others), so
  // both are checked. Left off entirely when a row carries no matches (an
  // engine that only sends a bare count with no game-level detail).
  const latest = Array.isArray(row.matches) ? row.matches[0] : null
  if (latest) {
    const latestValue = latest.val ?? latest.value
    const latestDate = latest.date ?? latest.date_iso
    if (typeof latestValue === 'number') out.latest_value = latestValue
    if (typeof latestDate === 'string') out.latest_date = latestDate
  }

  return out
}

function transform(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Input must be a backend-results object with `kind`, `query`, and `rows`.')
  }
  const sport = sportFromKind(payload.kind)
  const query = payload.query ?? {}
  const stat = String(query.stat ?? query.short ?? '').toLowerCase()
  const threshold = query.threshold
  const lastN = typeof query.last_n === 'number' ? query.last_n : null
  const windowLabel = lastN ? `L${lastN}` : 'season'
  // MLB's stat-leaderboard payload nests the requested top-N under
  // `thresholds.top_n`; the NFL leaderboard payload has no `thresholds`
  // object at all and puts it directly on `query.top` instead.
  const topN = payload.thresholds?.top_n ?? query.top
  const rows = Array.isArray(payload.rows) ? payload.rows : []

  const header = { raw: buildRawHeader({ sport, query, topN, windowLabel }) }
  const entries = rows.map((row) =>
    buildEntry(row, { stat, threshold, windowGames: lastN ?? undefined }),
  )

  return [header, ...entries]
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const raw = readFileSync(args.in, 'utf8')
  const payload = JSON.parse(raw)
  const output = transform(payload)
  writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`Wrote ${output.length - 1} rows -> ${args.out}`)
  console.log(`Header: ${output[0].raw}`)
}

main()
