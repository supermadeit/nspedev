// Module-level holder for the current Supabase access token (JWT).
//
// App.tsx runs its /run fetch from module-scope helpers that live outside the
// React tree, so they can't read auth context directly. The AuthProvider keeps
// this store in sync with the current session, and the fetch helpers read from
// it to attach `Authorization: Bearer <jwt>` headers.

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

/** Returns an Authorization header object when a token is present, else {}. */
export function authHeader(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}
