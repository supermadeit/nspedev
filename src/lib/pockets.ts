// Pockets — saved query results. A pocket is the command plus a snapshot of
// the /run payload as it looked when saved, so a shared link shows what the
// sharer actually saw (with a "re-run live" option) rather than whatever the
// data says today. Table + RLS + the per-user cap live in supabase/pockets.sql.
import { supabase } from '@/lib/supabase'
import type { ApiPayload } from '@/lib/nspe-api'

// Display value only — the real cap is enforced by a trigger in the database
// (see supabase/pockets.sql), so raising it means changing it there too.
export const POCKET_LIMIT = 10

// Refuse oversized snapshots before sending (the table has a matching CHECK).
const MAX_PAYLOAD_CHARS = 350_000

export interface Pocket {
  id: string
  command: string
  title: string | null
  payload: ApiPayload
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

export async function listPockets(): Promise<PocketSummary[]> {
  const { data, error } = await supabase
    .from('pockets')
    .select('id, command, title, is_public, created_at')
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

export function pocketShareUrl(id: string): string {
  return `${window.location.origin}/p/${id}`
}
