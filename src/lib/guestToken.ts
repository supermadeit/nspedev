// The guest allowance's per-browser rollover token — see the backend spec
// this was built against (guest_token.py / POST /account/claim-guest-credits).
// Separate from the IP-based 25/day cap, which is untouched by any of this:
// this token just tracks "how many of today's 25 this browser didn't use,"
// so that count can be claimed once as a credit at signup/login. Stored in
// localStorage (not a React state) because it has to survive a full page
// navigation to /signup and a reload, and because non-React call sites
// (runQuery, the mobile hook, WorldCupApp) all need to read/write it too.
import { authHeader } from './auth-token'
import {
  API_BASE_CANDIDATES,
  fetchFirstSuccessful,
  joinUrl,
  parseApiPayload,
  QueryGateError,
} from './nspe-api'

const STORAGE_KEY = 'nspe.guestToken'

export function getGuestToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setGuestToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode, quota) — the rollover claim is
    // simply skipped this session, nothing else depends on this succeeding.
  }
}

/** Attached to every /run request so the backend can track this browser's
 * unused guest allowance. Empty once a token hasn't arrived yet (first-ever
 * request) — harmless either way, since the backend's IP cap is what
 * actually enforces the limit. */
export function guestTokenHeader(): Record<string, string> {
  const token = getGuestToken()
  return token ? { 'X-Guest-Token': token } : {}
}

// One-shot: claims whatever the token has left as an account credit and
// clears it locally regardless of outcome, so a redeemed/expired/invalid
// token is never retried on every subsequent login. The backend guards
// replay server-side too (a second claim credits 0), so this is a courtesy
// to avoid a wasted call, not the only thing preventing double-crediting.
// Returns true if a claim call was actually made (not necessarily that it
// credited anything > 0 — the backend doesn't promise the amount back).
export async function claimGuestCreditsIfAny(): Promise<boolean> {
  const token = getGuestToken()
  if (!token) return false
  setGuestToken(null)
  try {
    const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/account/claim-guest-credits'))
    const { response } = await fetchFirstSuccessful(
      urls,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ token }),
      },
      10000,
    )
    await parseApiPayload(response).catch(() => null)
    return true
  } catch (err) {
    // A gate error here would be surprising (this call is auth-required, and
    // we only reach it once signed in) — logged either way, never surfaced
    // to the visitor, since a missed rollover credit isn't worth interrupting
    // the sign-in flow over.
    if (!(err instanceof QueryGateError)) console.error('Failed to claim guest credits:', err)
    return false
  }
}
