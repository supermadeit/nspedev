// Pockets — saved query results. A pocket is the command plus a snapshot of
// the /run payload as it looked when saved, so a shared link shows what the
// sharer actually saw (with a "re-run live" option) rather than whatever the
// data says today. Table + RLS + the per-user cap live in supabase/pockets.sql.
//
// Also now the save mechanism behind team.metrics' single-stat "shareables"
// (owner ask, 2026-10-19) — same table, same RLS/limit/share plumbing, just
// a different `payload` shape and a `kind` tag so the two don't get
// mixed up on replay (see TeamMetricsStatSnapshot/saveTeamMetricsStatPocket
// below, and TeamMetricsStatSharePage for how a shared one actually renders —
// deliberately NOT the generic CLI-results replay this file's query pockets
// use, since "a stat someone shares to get people curious" reads better as
// its own poster-style page than as a replayed terminal session).
import { supabase } from '@/lib/supabase'
import type { ApiPayload } from '@/lib/nspe-api'
import type { TeamMetricsAllowsEntry, TeamMetricsWindow } from '@/lib/databaseApi'

// Display value only — the real cap is enforced by a trigger in the database
// (see supabase/pockets.sql), so raising it means changing it there too.
export const POCKET_LIMIT = 10

// Refuse oversized snapshots before sending (the table has a matching CHECK).
const MAX_PAYLOAD_CHARS = 350_000

/** A single opponent-allowed-threshold stat, saved on its own rather than as
 * part of a full query result — the "cool stat someone discovers and
 * shares" unit, scoped to exactly one team/window/threshold so the shared
 * page can stay a clean one-stat poster instead of a full page replay. */
export interface TeamMetricsStatSnapshot {
  sport: 'nfl' | 'nba' | 'nhl' | 'mlb'
  team: string
  teamLabel: string
  window: TeamMetricsWindow
  games: number
  stat: TeamMetricsAllowsEntry
}

export interface Pocket {
  id: string
  command: string
  title: string | null
  payload: ApiPayload | TeamMetricsStatSnapshot
  /** Absent/null for the original query-result pockets; 'team_metrics_stat'
   * for a single-stat team.metrics snapshot. Anything reading `payload`
   * should branch on this rather than guess from shape. */
  kind?: string | null
  is_public: boolean
  created_at: string
}

export type PocketSummary = Omit<Pocket, 'payload'>

export class PocketError extends Error {
  code: 'limit' | 'too_large' | 'not_setup' | 'auth' | 'other'
  constructor(code: PocketError['code'], message: string) {
    super(message)
    this.code = code
  }
}

function toPocketError(err: { code?: string; message?: string } | null): PocketError {
  const msg = err?.message ?? 'Something went wrong.'
  if (msg.includes('pocket_limit_reached')) {
    return new PocketError('limit', `Pocket limit reached (${POCKET_LIMIT}) — delete one in {pockets} first.`)
  }
  // Table not created yet (PostgREST / Postgres "undefined table").
  if (err?.code === 'PGRST205' || err?.code === '42P01' || /pockets/.test(msg) && /schema cache|does not exist/.test(msg)) {
    return new PocketError('not_setup', 'Pockets are not set up on the server yet.')
  }
  if (err?.code === '42501' || /row-level security|jwt/i.test(msg)) {
    return new PocketError('auth', 'Log in to use pockets.')
  }
  return new PocketError('other', msg)
}

export async function savePocket(command: string, payload: ApiPayload): Promise<Pocket> {
  if (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) {
    throw new PocketError('too_large', 'This result is too large to save as a pocket.')
  }
  const { data, error } = await supabase
    .from('pockets')
    .insert({ command, title: command, payload })
    .select()
    .single()
  if (error) throw toPocketError(error)
  return data as Pocket
}

/** Saves one opponent-allowed-threshold stat as its own shareable pocket —
 * always public from the moment it's saved (unlike a regular pocket, which
 * starts private until the owner flips it on in {pockets}). The whole point
 * of this button is "share this in one click," so a save-then-separately-
 * share-it detour would undercut that; nothing sensitive enough here to
 * default to private (it's already-public team data, not a saved query a
 * user might not want seen). Returns the pocket so the caller can copy its
 * share link immediately. */
export async function saveTeamMetricsStatPocket(snapshot: TeamMetricsStatSnapshot): Promise<Pocket> {
  if (JSON.stringify(snapshot).length > MAX_PAYLOAD_CHARS) {
    throw new PocketError('too_large', 'This stat is too large to save as a pocket.')
  }
  const title = `${snapshot.teamLabel} — ${snapshot.stat.label}`
  const { data, error } = await supabase
    .from('pockets')
    .insert({ command: title, title, payload: snapshot, kind: 'team_metrics_stat', is_public: true })
    .select()
    .single()
  if (error) throw toPocketError(error)
  return data as Pocket
}

export async function listPockets(): Promise<PocketSummary[]> {
  const { data, error } = await supabase
    .from('pockets')
    .select('id, command, title, kind, is_public, created_at')
    .order('created_at', { ascending: false })
  if (error) throw toPocketError(error)
  return (data ?? []) as PocketSummary[]
}

/** Loads one pocket — the public share RPC first (works for anyone), then the
 * owner's own row (private pockets). Null when neither exists. */
export async function getPocket(id: string): Promise<Pocket | null> {
  const { data: shared } = await supabase.rpc('get_public_pocket', { p_id: id })
  if (Array.isArray(shared) && shared.length > 0) return shared[0] as Pocket
  const { data, error } = await supabase.from('pockets').select('*').eq('id', id).maybeSingle()
  if (error) throw toPocketError(error)
  return (data as Pocket | null) ?? null
}

export async function deletePocket(id: string): Promise<void> {
  const { error } = await supabase.from('pockets').delete().eq('id', id)
  if (error) throw toPocketError(error)
}

export async function setPocketShared(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from('pockets').update({ is_public: isPublic }).eq('id', id)
  if (error) throw toPocketError(error)
}

export function pocketShareUrl(id: string, kind?: string | null): string {
  // Single-stat snapshots get their own poster-style share page (see
  // TeamMetricsStatSharePage) rather than replaying into the full CLI
  // results panel like a regular pocket — different route entirely.
  return kind === 'team_metrics_stat' ? `${window.location.origin}/p/stat/${id}` : `${window.location.origin}/p/${id}`
}
