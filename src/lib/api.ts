// Resolves the nspe-v2 backend base URL, mirroring the resolution order used by
// App.tsx for /run. Keep these in sync if the App.tsx logic changes.
export function getApiBase(): string {
  const candidates = [
    (window as unknown as { NSPE_API_BASE?: string }).NSPE_API_BASE,
    import.meta.env.VITE_NSPE_API_BASE as string | undefined,
    'https://api.nspe.dev',
  ]
  for (const c of candidates) {
    if (c && c.trim()) return c.trim().replace(/\/$/, '')
  }
  return 'https://api.nspe.dev'
}

export function apiUrl(endpoint: string): string {
  const base = getApiBase()
  return `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
}
