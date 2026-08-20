// Mobile-facing wrapper around the same "/run" dispatch chain App.tsx's
// `runQuery` uses (App.tsx:1890 onward), collapsed into a single
// discriminated-union `result` instead of ~13 separate useState calls.
//
// The dispatch ORDER below mirrors App.tsx exactly — do not reorder it. Each
// extractXPayload is a first-match-wins check against the raw API payload;
// changing the order changes which engine a given response is attributed to.

import { useCallback, useState } from 'react'
import { authHeader } from '@/lib/auth-token'
import {
  RUN_ENDPOINTS,
  fetchFirstSuccessful,
  formatQueryError,
  getPayloadError,
  parseApiPayload,
  sanitizeQueryForApi,
} from '@/lib/nspe-api'
import {
  extractH2hPayload,
  extractMlbBatTeamPayload,
  extractMlbFirstPaTrendPayload,
  extractMlbHrPayload,
  extractMlbPitchFpvPayload,
  extractMlbPitchH2hPayload,
  extractMlbPlayerReportPayload,
  extractMlbReportLeaderboardPayload,
  extractMlbTeamOverviewPayload,
  extractMlbTeamRunsPayload,
  isNflExplosivePayload,
  normalizeQueryResults,
  PLAYER_TEAM_MAP,
  type H2hPayload,
  type MlbBatTeamPayload,
  type MlbFirstPaTrendPayload,
  type MlbHrPayload,
  type MlbPitchFpvPayload,
  type MlbPitchH2hPayload,
  type MlbPlayerReportPayload,
  type MlbReportLeaderboardPayload,
  type MlbTeamOverviewPayload,
  type MlbTeamRunsPayload,
  type NflExplosivePayload,
  type QueryResult,
} from '@/lib/nspe-payloads'

// Discriminated union covering every payload type nspe-payloads.ts exports,
// plus a `generic` fallback for the normalizeQueryResults path. Leaves room
// for future leaderboard `kind`s in Phase 2 — they'll reuse the existing
// `mlb_hr` / `mlb_first_pa` / `mlb_team_runs` kinds once those payloads'
// `engine` unions widen to accept `_leaderboard` values, so no new kind is
// needed here yet.
export type NspeResult =
  | { kind: 'h2h'; payload: H2hPayload }
  | { kind: 'mlb_pitch_h2h'; payload: MlbPitchH2hPayload }
  | { kind: 'mlb_pitch_fpv'; payload: MlbPitchFpvPayload }
  | { kind: 'mlb_bat_team'; payload: MlbBatTeamPayload }
  | { kind: 'mlb_team_overview'; payload: MlbTeamOverviewPayload }
  | { kind: 'mlb_report_leaderboard'; payload: MlbReportLeaderboardPayload }
  | { kind: 'mlb_player_report'; payload: MlbPlayerReportPayload }
  | { kind: 'mlb_hr'; payload: MlbHrPayload }
  | { kind: 'mlb_first_pa'; payload: MlbFirstPaTrendPayload }
  | { kind: 'mlb_team_runs'; payload: MlbTeamRunsPayload }
  | { kind: 'nfl_explosive'; payload: NflExplosivePayload }
  | { kind: 'generic'; rows: QueryResult[] }

export interface UseNspeQueryReturn {
  run: (query: string) => Promise<void>
  isLoading: boolean
  error: string | null
  result: NspeResult | null
}

export function useNspeQuery(): UseNspeQueryReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NspeResult | null>(null)

  const run = useCallback(async (query: string) => {
    const sanitizedQuery = sanitizeQueryForApi(query)

    setIsLoading(true)
    setError(null)
    setResult(null)

    if (!sanitizedQuery) {
      setError('Enter a valid query.')
      setIsLoading(false)
      return
    }

    try {
      const { response, url } = await fetchFirstSuccessful(
        RUN_ENDPOINTS,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader(),
          },
          body: JSON.stringify({ query: sanitizedQuery }),
        },
        12000,
      )

      const payload = await parseApiPayload(response)
      console.log('Query response:', payload, 'via', url)

      const h2hPayload = extractH2hPayload(payload)
      if (h2hPayload) {
        setResult({ kind: 'h2h', payload: h2hPayload })
        return
      }

      const pitchPayload = extractMlbPitchH2hPayload(payload)
      if (pitchPayload) {
        setResult({ kind: 'mlb_pitch_h2h', payload: pitchPayload })
        return
      }

      const fpvPayload = extractMlbPitchFpvPayload(payload)
      if (fpvPayload) {
        setResult({ kind: 'mlb_pitch_fpv', payload: fpvPayload })
        return
      }

      const batTeamPayload = extractMlbBatTeamPayload(payload)
      if (batTeamPayload) {
        setResult({ kind: 'mlb_bat_team', payload: batTeamPayload })
        return
      }

      const teamOverviewPayload = extractMlbTeamOverviewPayload(payload)
      if (teamOverviewPayload) {
        setResult({ kind: 'mlb_team_overview', payload: teamOverviewPayload })
        return
      }

      const reportLeaderboardPayload = extractMlbReportLeaderboardPayload(payload)
      if (reportLeaderboardPayload) {
        setResult({ kind: 'mlb_report_leaderboard', payload: reportLeaderboardPayload })
        return
      }

      const playerReportPayload = extractMlbPlayerReportPayload(payload)
      if (playerReportPayload) {
        setResult({ kind: 'mlb_player_report', payload: playerReportPayload })
        return
      }

      const hrPayload = extractMlbHrPayload(payload)
      if (hrPayload) {
        setResult({ kind: 'mlb_hr', payload: hrPayload })
        return
      }

      const firstPaPayload = extractMlbFirstPaTrendPayload(payload)
      if (firstPaPayload) {
        setResult({ kind: 'mlb_first_pa', payload: firstPaPayload })
        return
      }

      const teamRunsPayload = extractMlbTeamRunsPayload(payload)
      if (teamRunsPayload) {
        setResult({ kind: 'mlb_team_runs', payload: teamRunsPayload })
        return
      }

      // NFL explosive (play-by-play long plays)
      if (isNflExplosivePayload(payload)) {
        setResult({ kind: 'nfl_explosive', payload })
        return
      }

      const normalized = normalizeQueryResults(payload, sanitizedQuery)
      const enriched = normalized.map((r) =>
        r.team ? r : { ...r, team: PLAYER_TEAM_MAP.get(r.player.toLowerCase()) || undefined },
      )
      const payloadError = getPayloadError(payload)
      setResult({ kind: 'generic', rows: enriched })

      if (payloadError) {
        setError(payloadError)
      } else if (normalized.length === 0) {
        const rec = (payload && typeof payload === 'object' && !Array.isArray(payload))
          ? (payload as Record<string, unknown>)
          : null
        const stdout = rec && typeof rec.output === 'string' ? rec.output.trim() : ''
        setError(stdout || 'Connected to API, but response contained no recognizable result rows.')
      }
    } catch (err) {
      console.error('Query error:', err)
      setResult(null)
      setError(formatQueryError(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { run, isLoading, error, result }
}
