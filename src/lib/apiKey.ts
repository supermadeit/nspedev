// {b.y.o.c}'s account API key — GET/POST/DELETE /account/api-key (backend
// contract confirmed 2026-10-19). Same base-URL-failover + authHeader()
// pattern every other authed backend call in this app uses (see
// AccountPage.tsx's username save). NOT LIVE as of this file's creation —
// backend says it's in the owner's pending push; every call here degrades
// to a plain error message rather than crashing until it is.
import { authHeader } from '@/lib/auth-token'
import { API_BASE_CANDIDATES, joinUrl } from '@/lib/nspe-api'

export interface ApiKeyInfo {
  key_prefix: string
  created_at: string
  last_used: string | null
}

export interface ApiKeyCreateResult {
  api_key: string
  key_prefix: string
  created_at: string
  rotated: boolean
}

async function tryEachBase<T>(path: string, init: RequestInit): Promise<T> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, path))
  let lastError: string | null = null
  for (const url of urls) {
    try {
      const res = await fetch(url, { ...init, headers: { ...authHeader(), ...(init.headers ?? {}) } })
      if (res.ok) return (await res.json()) as T
      const body = await res.json().catch(() => null)
      lastError = body?.detail || `HTTP ${res.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error'
    }
  }
  throw new Error(lastError || 'Something went wrong.')
}

/** Null when the account has no active key. The key is always masked here
 * (key_prefix only) — the full secret is only ever returned once, by
 * createOrRotateApiKey, right when it's minted. */
export async function getApiKey(): Promise<ApiKeyInfo | null> {
  const data = await tryEachBase<{ key: ApiKeyInfo | null }>('/account/api-key', { method: 'GET' })
  return data.key
}

/** Always mints a NEW key, whether or not one already existed — there's no
 * separate "create" vs "rotate" call, just this one, with `rotated` saying
 * which happened. The old key (if any) stops working immediately. */
export async function createOrRotateApiKey(): Promise<ApiKeyCreateResult> {
  return tryEachBase<ApiKeyCreateResult>('/account/api-key', { method: 'POST' })
}

export async function revokeApiKey(): Promise<boolean> {
  const data = await tryEachBase<{ revoked: boolean }>('/account/api-key', { method: 'DELETE' })
  return data.revoked
}
