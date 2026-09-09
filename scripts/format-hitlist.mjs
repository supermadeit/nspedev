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

function buildRawHeader({ sport, query, topN, windowLabel }) {
  const sportLabel = (sport || '').toUpperCase()
  const stat = String(query?.stat ?? query?.short ?? '').toLowerCase()
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
  const topN = payload.thresholds?.top_n
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
