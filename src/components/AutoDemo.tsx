import React, { useEffect, useRef, useState } from 'react'
import demoData from '@/assets/data/demo-results.json'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  surface: 'oklch(0.12 0 0)',
  surface2: 'oklch(0.17 0 0)',
  border: 'oklch(0.25 0 0)',
  textDim: 'oklch(0.48 0 0)',
  textBright: 'oklch(0.88 0 0)',
  green: 'oklch(0.85 0.15 145)',
  amber: 'oklch(0.80 0.18 60)',
  blue: 'oklch(0.75 0.08 220)',
}

const MAX_ROWS = 6
const CHAR_MS = 95
const RESULTS_HOLD_MS = 5000

interface DemoEntry {
  command: string
  caption: string
  results: unknown[]
}

const DEMOS: DemoEntry[] = demoData as DemoEntry[]

function splitCamel(s: string): string {
  if (!s || s.includes(' ')) return s
  return s.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function StandardRow({ row }: { row: Record<string, unknown> }) {
  const player = String(row.player ?? '')
  const met = Number(row.met ?? 0)
  const last = Number(row.last ?? row.window ?? 0)
  const threshold = row.threshold != null ? Number(row.threshold) : null
  type MatchItem = { val?: unknown; date?: unknown; date_raw?: unknown }
  const match: MatchItem[] = Array.isArray(row.match) ? (row.match as MatchItem[]) : []
  const recent = match.slice(0, 3)
  return (
    <div className="py-1.5 border-b font-mono text-[12px]" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between">
        <span style={{ color: C.accent }}>{player}</span>
        <span>
          <span className="font-bold" style={{ color: C.green }}>{met}</span>
          {last > 0 && <span style={{ color: C.textDim }}>/{last}</span>}
          {threshold != null && <span style={{ color: C.textDim }}> · ≥{threshold}</span>}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="flex gap-2 mt-0.5 flex-wrap">
          {recent.map((m, i) => (
            <span key={i} style={{ color: C.textDim }}>
              <span style={{ color: C.textBright }}>{String(m.val ?? '')}</span>
              {' '}
              <span style={{ color: 'oklch(0.38 0 0)' }}>{String(m.date_raw ?? m.date ?? '')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function NflTrendRow({ row }: { row: Record<string, unknown> }) {
  const player = String(row.player ?? '')
  const metCount = Number(row.met_count ?? row.met ?? 0)
  const window_ = row.window != null ? Number(row.window) : null
  type MatchItem = { yards?: unknown; touchdown?: unknown; opponent?: unknown }
  const matches: MatchItem[] = Array.isArray(row.matches) ? (row.matches as MatchItem[]) : []
  const recent = matches.slice(0, 3)
  return (
    <div className="py-1.5 border-b font-mono text-[12px]" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between">
        <span style={{ color: C.accent }}>{player}</span>
        <span>
          <span className="font-bold" style={{ color: C.green }}>{metCount}</span>
          {window_ != null && <span style={{ color: C.textDim }}>/{window_}</span>}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="flex gap-3 mt-0.5 flex-wrap">
          {recent.map((m, i) => (
            <span key={i} style={{ color: C.textDim }}>
              <span style={{ color: C.textBright }}>{String(m.yards ?? '')}yds</span>
              {m.touchdown && <span style={{ color: C.amber }}> TD</span>}
              {m.opponent && <span style={{ color: C.blue }}> vs {String(m.opponent)}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function NflComputeRow({ row }: { row: Record<string, unknown> }) {
  const player = String(row.player ?? '')
  return (
    <div className="py-1.5 border-b font-mono text-[12px]" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between gap-4">
        <span style={{ color: C.accent }}>{splitCamel(player)}</span>
        <span className="flex items-center gap-3 shrink-0">
          <span>
            <span className="font-bold" style={{ color: C.green }}>{Number(row.yards ?? row.value ?? 0).toLocaleString()}</span>
            <span style={{ color: C.textDim }}> yds</span>
          </span>
          <span style={{ color: C.textDim }}>{String(row.games ?? '')} gp</span>
        </span>
      </div>
    </div>
  )
}

function ResultRows({ results }: { results: unknown[] }) {
  if (results.length === 0) {
    return <div className="font-mono text-[12px]" style={{ color: C.textDim }}>— no results cached yet —</div>
  }
  const rows = results.slice(0, MAX_ROWS)
  const overflow = results.length - MAX_ROWS
  const renderRow = (row: unknown, i: number) => {
    if (!row || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    if (Array.isArray(r.matches)) return <NflTrendRow key={i} row={r} />
    if (r.value != null && r.games != null) return <NflComputeRow key={i} row={r} />
    return <StandardRow key={i} row={r} />
  }
  return (
    <div>
      {rows.map(renderRow)}
      {overflow > 0 && <div className="pt-1.5 font-mono text-[11px]" style={{ color: C.textDim }}>+ {overflow} more</div>}
    </div>
  )
}

export interface AutoDemoProps {
  open: boolean
  onClose: () => void
  renderResults?: (results: unknown[], command: string) => React.ReactNode
}

type Phase = 'typing' | 'results' | 'fading'

export function AutoDemo({ open, onClose, renderResults }: AutoDemoProps) {
  const [demoIdx, setDemoIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => { if (timerRef.current != null) clearTimeout(timerRef.current) }

  useEffect(() => {
    if (!open) return
    setCharIdx(0)
    setPhase('typing')
    setIsPaused(false)
  }, [open, demoIdx])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') { e.preventDefault(); setIsPaused((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || isPaused) return
    clearTimer()
    const demo = DEMOS[demoIdx]
    if (phase === 'typing') {
      if (charIdx < demo.command.length) {
        timerRef.current = setTimeout(() => setCharIdx((c) => c + 1), CHAR_MS)
      } else {
        timerRef.current = setTimeout(() => setPhase('results'), 400)
      }
    } else if (phase === 'results') {
      timerRef.current = setTimeout(() => setPhase('fading'), RESULTS_HOLD_MS)
    } else if (phase === 'fading') {
      timerRef.current = setTimeout(() => setDemoIdx((i) => (i + 1) % DEMOS.length), 300)
    }
    return clearTimer
  }, [open, isPaused, phase, charIdx, demoIdx])

  if (!open) return null

  const demo = DEMOS[demoIdx]
  const typedCmd = demo.command.slice(0, charIdx)
  const showResults = phase === 'results' || phase === 'fading'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[600px] rounded-lg overflow-hidden shadow-2xl"
        style={{
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          fontFamily: 'monospace',
          opacity: phase === 'fading' ? 0 : 1,
          transition: 'opacity 0.3s ease',
        }}
        onClick={(e) => { e.stopPropagation(); setIsPaused((p) => !p) }}
        title={isPaused ? 'click to resume' : 'click to pause'}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}
        >
          <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>
            {'{sample}'}
            <span className="ml-2 font-normal text-[11px]" style={{ color: C.textDim }}>
              {demoIdx + 1}/{DEMOS.length}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: isPaused ? C.green : C.textDim }}>
              {isPaused ? '❙❙ paused' : '▶ live'}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: C.accent }}
              aria-label="Close"
            >✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="font-mono text-[11px]" style={{ color: C.textDim }}>{demo.caption}</div>
          <div
            className="rounded px-4 py-3 font-mono text-[14px]"
            style={{ backgroundColor: 'oklch(0.09 0 0)', border: `1px solid ${C.border}` }}
          >
            <span style={{ color: C.textDim }}>$ </span>
            <span style={{ color: C.textBright }}>{typedCmd}</span>
            {phase === 'typing' && (
              <span
                className="inline-block w-[8px] h-[14px] ml-0.5 align-middle"
                style={{ backgroundColor: C.accent, animation: 'pulse 1s step-end infinite' }}
              />
            )}
          </div>
          {showResults && (
            <div className="rounded overflow-hidden" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface2 }}>
              <div className="px-4 py-3 max-h-[340px] overflow-y-auto">
                {renderResults
                  ? renderResults(demo.results, demo.command)
                  : <ResultRows results={demo.results} />}
              </div>
            </div>
          )}
        </div>

        <div style={{ height: '2px', backgroundColor: 'oklch(0.20 0 0)' }}>
          <div style={{ height: '100%', backgroundColor: C.accent, width: `${(demoIdx / DEMOS.length) * 100}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>
    </div>
  )
}
