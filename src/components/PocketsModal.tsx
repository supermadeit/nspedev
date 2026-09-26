// {pockets} — the signed-in user's saved results. Open one to replay its
// snapshot in the normal results panel, toggle a public share link, or delete.
import { useEffect, useState } from 'react'
import {
  POCKET_LIMIT,
  PocketError,
  deletePocket,
  getPocket,
  listPockets,
  pocketShareUrl,
  setPocketShared,
  type Pocket,
  type PocketSummary,
} from '@/lib/pockets'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.78 0.18 145)',
  surface: 'oklch(0.13 0 0)',
  surface2: 'oklch(0.18 0 0)',
  border: 'oklch(0.30 0 0)',
  textDim: 'oklch(0.55 0 0)',
  textBright: 'oklch(0.90 0 0)',
  danger: 'oklch(0.70 0.18 25)',
}

interface PocketsModalProps {
  open: boolean
  onClose: () => void
  onOpenPocket: (pocket: Pocket) => void
  /** Bumped by the parent after a save so an open list refreshes. */
  refreshKey: number
}

function formatSaved(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' })
}

export function PocketsModal({ open, onClose, onOpenPocket, refreshKey }: PocketsModalProps) {
  const [items, setItems] = useState<PocketSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setError(null)
    listPockets()
      .then((rows) => active && setItems(rows))
      .catch((e) => {
        if (!active) return
        setItems([])
        setError(e instanceof PocketError ? e.message : 'Could not load pockets.')
      })
    return () => {
      active = false
    }
  }, [open, refreshKey])

  if (!open) return null

  async function run<T>(id: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusyId(id)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof PocketError ? e.message : 'Something went wrong.')
      return undefined
    } finally {
      setBusyId(null)
    }
  }

  async function handleOpen(id: string) {
    const pocket = await run(id, () => getPocket(id))
    if (pocket) {
      onOpenPocket(pocket)
      onClose()
    } else if (pocket === null) {
      setError('That pocket no longer exists.')
    }
  }

  async function handleShare(p: PocketSummary) {
    const next = !p.is_public
    const ok = await run(p.id, async () => {
      await setPocketShared(p.id, next)
      return true
    })
    if (!ok) return
    setItems((prev) => prev?.map((x) => (x.id === p.id ? { ...x, is_public: next } : x)) ?? prev)
    if (next) await copyLink(p.id)
  }

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(pocketShareUrl(id))
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800)
    } catch {
      setError(`Copy failed — link: ${pocketShareUrl(id)}`)
    }
  }

  async function handleDelete(id: string) {
    const ok = await run(id, async () => {
      await deletePocket(id)
      return true
    })
    if (ok) setItems((prev) => prev?.filter((x) => x.id !== id) ?? prev)
  }

  const linkBtn = 'font-mono text-[12px] underline hover:opacity-80 transition-opacity whitespace-nowrap disabled:opacity-40'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'oklch(0 0 0 / 0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[80dvh] flex flex-col rounded-lg"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 flex-none" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="font-bold text-[14px]" style={{ color: C.accent }}>
            {'{pockets}'}
            <span className="ml-2 font-normal text-[11px]" style={{ color: C.textDim }}>
              {items ? `${items.length}/${POCKET_LIMIT}` : ''}
            </span>
          </span>
          <button onClick={onClose} className="text-[14px] hover:opacity-70 transition-opacity" style={{ color: C.accent }}>
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-3 space-y-2">
          {error && (
            <div className="text-[12px] rounded px-3 py-2" style={{ color: C.danger, border: `1px solid ${C.danger}` }}>
              {error}
            </div>
          )}
          {items === null ? (
            <div className="text-[13px] py-6 text-center" style={{ color: C.textDim }}>
              loading…
            </div>
          ) : items.length === 0 && !error ? (
            <div className="text-[13px] py-6 text-center" style={{ color: C.textDim }}>
              Nothing saved yet — run a query and hit {'{pocket}'} on the results.
            </div>
          ) : (
            items.map((p) => (
              <div
                key={p.id}
                className="rounded-lg px-3 py-2.5"
                style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}
              >
                <div className="text-[13px] break-all" style={{ color: C.textBright }}>
                  {p.command}
                </div>
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  <span className="text-[11px]" style={{ color: C.textDim }}>
                    {formatSaved(p.created_at)}
                    {p.is_public ? ' · shared' : ''}
                  </span>
                  <span className="flex items-center gap-4 ml-auto">
                    <button className={linkBtn} style={{ color: C.green }} disabled={busyId === p.id} onClick={() => handleOpen(p.id)}>
                      open
                    </button>
                    <button className={linkBtn} style={{ color: C.accent }} disabled={busyId === p.id} onClick={() => handleShare(p)}>
                      {p.is_public ? 'unshare' : 'share'}
                    </button>
                    {p.is_public && (
                      <button className={linkBtn} style={{ color: C.accent }} onClick={() => copyLink(p.id)}>
                        {copiedId === p.id ? 'copied ✓' : 'copy link'}
                      </button>
                    )}
                    <button className={linkBtn} style={{ color: C.danger }} disabled={busyId === p.id} onClick={() => handleDelete(p.id)}>
                      delete
                    </button>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
