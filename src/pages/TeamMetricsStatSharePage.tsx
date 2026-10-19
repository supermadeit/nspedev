// {pocket}'s single-stat team.metrics "shareable" — a dedicated poster-style
// page at /p/stat/:id, deliberately separate from /p/:id's generic
// pocket-replay (which dumps you into the full CLI results panel). Owner
// framing (2026-10-19): the actual marketing is people sharing a cool stat
// they found, so the shared link itself needs to read well on its own —
// team, the threshold, the number, who met it — not a terminal session
// someone else has to parse. Kept intentionally light (no auth/session
// chrome, no app shell) since this is the page a stranger clicking a shared
// link lands on cold.
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { C } from '@/components/ProfileSections'
import { normalizeAllowsInstance } from '@/lib/databaseApi'
import { getPocket, type TeamMetricsStatSnapshot } from '@/lib/pockets'
import madeitLogo from '@/assets/images/madeit-tech-logo-v2.jpeg'
import { metricsHrefFor } from '@/components/SportsSwitcher'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: TeamMetricsStatSnapshot }

export default function TeamMetricsStatSharePage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'error', message: 'No stat specified.' })
      return
    }
    let active = true
    getPocket(id)
      .then((pocket) => {
        if (!active) return
        if (!pocket || pocket.kind !== 'team_metrics_stat') {
          setState({ status: 'error', message: "This stat doesn't exist or isn't shared anymore." })
          return
        }
        setState({ status: 'ready', snapshot: pocket.payload as TeamMetricsStatSnapshot })
      })
      .catch(() => {
        if (active) setState({ status: 'error', message: "Couldn't load that stat." })
      })
    return () => {
      active = false
    }
  }, [id])

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: C.surface, fontFamily: 'monospace' }}
    >
      <div className="w-full max-w-md relative">
        <Link to="/" className="block text-center mb-6 font-mono text-[15px] font-bold tracking-wide" style={{ color: C.accent }}>
          {'{nspe}'}
        </Link>

        {state.status === 'loading' && (
          <div className="text-center font-mono text-[13px]" style={{ color: C.textDim }}>loading…</div>
        )}

        {state.status === 'error' && (
          <div className="rounded-lg px-5 py-8 text-center" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
            <div className="font-mono text-[13px] mb-4" style={{ color: C.textDim }}>{state.message}</div>
            <Link to="/" className="font-mono text-[12px] underline" style={{ color: C.accent }}>go to nspe.dev</Link>
          </div>
        )}

        {state.status === 'ready' && (
          <StatPoster snapshot={state.snapshot} />
        )}

        {/* Bottom-right brand mark (owner ask, 2026-10-19 — the same logo
            that sits bottom-left on the homepage, moved here so a shared
            link/screenshot carries the brand wherever it travels). */}
        <img
          src={madeitLogo}
          alt="nspe"
          className="absolute bottom-[-28px] right-0 pointer-events-none"
          style={{ width: '32px', height: '52px', maxWidth: '32px', maxHeight: '52px', objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}

function StatPoster({ snapshot }: { snapshot: TeamMetricsStatSnapshot }) {
  const { sport, teamLabel, window: win, games, stat } = snapshot
  const instances = stat.instances ?? []

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
      <div className="px-5 pt-5 pb-4 text-center" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="font-mono font-bold text-[16px]" style={{ color: C.accent }}>{`{${teamLabel}}`}</div>
        <div className="font-mono text-[11px] mt-0.5" style={{ color: C.textDim }}>
          {win.label} · {games} GM · {sport.toUpperCase()}
        </div>
      </div>

      <div className="px-5 py-6 text-center">
        <div className="font-mono text-[13px] mb-2" style={{ color: C.textBright }}>{stat.label}</div>
        <div className="font-mono font-bold text-[42px] leading-none" style={{ color: C.accent }}>{stat.pct}%</div>
        <div className="font-mono text-[12px] mt-1.5" style={{ color: C.textDim }}>{stat.count} of {stat.games} games</div>
      </div>

      {instances.length > 0 && (
        <div className="px-5 pb-5 space-y-1.5">
          <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: C.textDim }}>who did it</div>
          {instances.map((inst, i) => {
            const n = normalizeAllowsInstance(inst)
            return (
              <div key={i} className="flex items-baseline justify-between gap-3 font-mono text-[12px]" style={{ color: C.textBright }}>
                <span>{n.who}{inst.team ? ` (${inst.team})` : ''}</span>
                <span className="flex items-baseline gap-2" style={{ color: C.textDim }}>
                  {n.value != null && <span style={{ color: C.textBright }}>{n.value}</span>}
                  {n.date && <span>{n.date}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {metricsHrefFor(sport) && (
        <div className="px-5 py-3 text-center" style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
          <Link to={metricsHrefFor(sport)!} className="font-mono text-[11px] underline" style={{ color: C.accent }}>
            see the full breakdown →
          </Link>
        </div>
      )}
    </div>
  )
}
