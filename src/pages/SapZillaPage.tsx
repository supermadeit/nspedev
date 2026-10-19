// {sap.zilla} — the "saps to sharps" backtest lab (owner-named, 2026-10-19).
// Pure historical counts, never a price: "how often has this actually
// happened," no odds/edge/value language anywhere on this page, matching
// the backend's own refusal to emit those words (see labApi.ts). Styled
// like {team.metrics} (full-height dark terminal page, bordered cards, no
// PageShell/shadcn chrome) per the owner's inclination — not a hard
// instruction, just where this naturally landed.
//
// Two ways in, one endpoint: typed legs (free, no auth — a picker builds
// the common case, a raw box covers anything the picker doesn't) and a
// screenshot of a real slip (signed in, costs a free question or a
// credit — the model reads legs out of the image, returned as editable
// text so a misread leg can be fixed and re-run free as a typed one).
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { C } from '@/components/ProfileSections'
import { HomeLogoLink } from '@/components/HomeLogoLink'
import { loadPlayerIndex, searchPlayers, type PlayerMatch } from '@/lib/playerSearch'
import { teamRoster } from '@/lib/teamNicknames'
import {
  LAB_SPORTS,
  LAB_STATS,
  LAB_NFL_SCOPES,
  LAB_SYNTAX_EXAMPLES,
  buildPlayerLeg,
  buildTeamLeg,
  type LabSport,
  type LabScope,
} from '@/lib/labLegs'
import { runLabLegs, runLabImage, LabError_, type LabResult, type LabImageResult } from '@/lib/labApi'
import madeitLogo from '@/assets/images/madeit-tech-logo-v2.jpeg'

const MAX_LEGS = 12
const MAX_IMAGE_BYTES = 6 * 1024 * 1024

function fieldStyle(): CSSProperties {
  return { backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.textBright }
}

export default function SapZillaPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // ---- composer state ----
  const [sport, setSport] = useState<LabSport>('nfl')
  const [kind, setKind] = useState<'player' | 'team'>('player')
  const [playerQuery, setPlayerQuery] = useState('')
  const [playerMatches, setPlayerMatches] = useState<PlayerMatch[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [teamCode, setTeamCode] = useState('')
  const [stat, setStat] = useState(LAB_STATS.nfl[0].value)
  const [scope, setScope] = useState<LabScope>('season')
  const [num, setNum] = useState(100)
  const [legs, setLegs] = useState<string[]>([])
  const [rawLegsText, setRawLegsText] = useState('')

  // ---- window options ----
  const [since, setSince] = useState(2018)
  const [post, setPost] = useState(false)
  const [seasonOnly, setSeasonOnly] = useState(false)

  // ---- screenshot ----
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageDataUri, setImageDataUri] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  // ---- run state ----
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [result, setResult] = useState<LabResult | LabImageResult | null>(null)

  useEffect(() => {
    loadPlayerIndex()
  }, [])

  useEffect(() => {
    setStat(LAB_STATS[sport][0].value)
    if (sport !== 'nfl') {
      setKind('player')
      setScope('season')
    }
  }, [sport])

  useEffect(() => {
    if (!playerQuery.trim()) {
      setPlayerMatches([])
      return
    }
    setPlayerMatches(searchPlayers(playerQuery, 6, sport))
  }, [playerQuery, sport])

  function addLegFromPicker() {
    if (legs.length >= MAX_LEGS) return
    const built =
      kind === 'player'
        ? selectedPlayer
          ? buildPlayerLeg(sport, selectedPlayer, stat, scope, num)
          : null
        : teamCode.trim()
          ? buildTeamLeg(teamCode, num)
          : null
    if (!built) return
    // Dedupe on add — caught live (owner screenshot, 2026-10-19): clicking
    // "+ add leg" twice on the same selection silently added the same leg
    // twice rather than refusing or no-opping.
    setLegs((prev) => (prev.includes(built) ? prev : [...prev, built]))
  }

  function removeLeg(i: number) {
    setLegs((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleFile(file: File) {
    setImageError(null)
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.type)) {
      setImageError('Screenshot must be a PNG, JPEG, WebP, or GIF.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Screenshot is too large (6 MB max).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageDataUri(reader.result as string)
      setImageName(file.name)
    }
    reader.onerror = () => setImageError("Couldn't read that file.")
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageDataUri(null)
    setImageName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function run() {
    setRunError(null)
    if (imageDataUri) {
      if (!user) {
        navigate(`/login?redirect=${encodeURIComponent('/sap.zilla')}`)
        return
      }
      setRunning(true)
      try {
        const res = await runLabImage(imageDataUri, { since, post, season: seasonOnly })
        setResult(res)
        // Read legs come back as editable text, per the contract's own UX
        // ask — pre-fill the raw box so a misread leg can be fixed and
        // re-run free as typed legs, rather than re-uploading the image.
        setRawLegsText(res.read_from_image.legs.join('\n'))
        setLegs([])
      } catch (e) {
        setRunError(e instanceof LabError_ ? e.message : 'Could not read that screenshot.')
      } finally {
        setRunning(false)
      }
      return
    }

    const rawLines = rawLegsText.split('\n').map((l) => l.trim()).filter(Boolean)
    const allLegs = [...legs, ...rawLines].slice(0, MAX_LEGS)
    if (allLegs.length === 0) {
      setRunError('Add at least one leg first.')
      return
    }
    setRunning(true)
    try {
      const res = await runLabLegs(allLegs, { since, post, season: seasonOnly })
      setResult(res)
    } catch (e) {
      setRunError(e instanceof LabError_ ? e.message : 'Something went wrong.')
    } finally {
      setRunning(false)
    }
  }

  const imageResult = result && 'read_from_image' in result ? (result as LabImageResult) : null

  return (
    <div className="min-h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-[15px] rounded px-2 py-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}>
            {'{sap.zilla}'}
          </span>
          <span className="font-mono text-[12px]" style={{ color: C.textDim }}>
            how often has this actually happened — counts only, never a price
          </span>
        </div>
        <HomeLogoLink fontSizePx={13} />
      </div>

      <div className="px-6 py-6 max-w-3xl mx-auto space-y-5">
        <div className="rounded-lg p-4 font-mono text-[13px] space-y-2" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.textBright }}>
            Build a ticket — a player prop, a team line, or a few stacked together — and {'{sap.zilla}'} counts up every
            game it's actually happened, going back as far as you want. No odds in, no odds out: just "0 of 131" or
            "87 of 138," so you're looking at the real history before anyone else's price on it.
          </p>
          <p style={{ color: C.textDim }}>
            Think of it as the proof.zilla to whatever you were about to take on faith.
          </p>
        </div>

        {/* ---- composer ---- */}
        <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: C.textDim }}>build a leg</div>

          <div className="flex flex-wrap gap-2">
            {LAB_SPORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSport(s.value)}
                className="font-mono text-[12px] font-bold px-3 py-1.5 rounded"
                style={{
                  border: `1px solid ${sport === s.value ? C.accent : C.border}`,
                  color: sport === s.value ? C.accent : C.textDim,
                }}
              >
                {s.label}
              </button>
            ))}
            {sport === 'nfl' && (
              <>
                <span className="w-px self-stretch" style={{ backgroundColor: C.border }} />
                {(['player', 'team'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className="font-mono text-[12px] font-bold px-3 py-1.5 rounded"
                    style={{ border: `1px solid ${kind === k ? C.accent : C.border}`, color: kind === k ? C.accent : C.textDim }}
                  >
                    {k === 'player' ? 'player' : 'team (points only)'}
                  </button>
                ))}
              </>
            )}
          </div>

          {kind === 'player' ? (
            <div className="relative">
              <input
                value={selectedPlayer ?? playerQuery}
                onChange={(e) => {
                  setSelectedPlayer(null)
                  setPlayerQuery(e.target.value)
                }}
                placeholder="search a player…"
                className="w-full rounded px-3 py-2 font-mono text-[13px]"
                style={fieldStyle()}
              />
              {!selectedPlayer && playerMatches.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-10 mt-1 rounded overflow-hidden"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
                >
                  {playerMatches.map((m) => (
                    <button
                      key={m.entry.slug}
                      type="button"
                      onClick={() => {
                        setSelectedPlayer(m.entry.name)
                        setPlayerQuery('')
                        setPlayerMatches([])
                      }}
                      className="block w-full text-left px-3 py-1.5 font-mono text-[12px] hover:opacity-80"
                      style={{ color: C.textBright }}
                    >
                      {m.entry.name} <span style={{ color: C.textDim }}>{m.entry.team}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <select value={teamCode} onChange={(e) => setTeamCode(e.target.value)} className="w-full rounded px-3 py-2 font-mono text-[13px]" style={fieldStyle()}>
              <option value="">select a team…</option>
              {teamRoster('nfl').map((t) => (
                <option key={t.code} value={t.code}>{t.nickname} ({t.code})</option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            {kind === 'player' ? (
              <select value={stat} onChange={(e) => setStat(e.target.value)} className="rounded px-2 py-1.5 font-mono text-[12px]" style={fieldStyle()}>
                {LAB_STATS[sport].map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ) : (
              <span className="font-mono text-[12px]" style={{ color: C.textDim }}>points</span>
            )}
            {kind === 'player' && sport === 'nfl' && (
              <select value={scope} onChange={(e) => setScope(e.target.value as LabScope)} className="rounded px-2 py-1.5 font-mono text-[12px]" style={fieldStyle()}>
                {LAB_NFL_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            )}
            <span className="font-mono text-[12px]" style={{ color: C.textDim }}>at least</span>
            <input
              type="number"
              value={num}
              onChange={(e) => setNum(Number(e.target.value) || 0)}
              className="w-20 rounded px-2 py-1.5 font-mono text-[12px]"
              style={fieldStyle()}
            />
            <button
              type="button"
              onClick={addLegFromPicker}
              disabled={legs.length >= MAX_LEGS || (kind === 'player' ? !selectedPlayer : !teamCode)}
              className="font-mono text-[12px] font-bold px-3 py-1.5 rounded disabled:opacity-40"
              style={{ border: `1px solid ${C.accent}`, color: C.accent }}
            >
              + add leg
            </button>
          </div>

          {legs.length > 0 && (
            <div className="space-y-1.5">
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded px-2.5 py-1.5" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                  <span className="font-mono text-[12px]" style={{ color: C.textBright }}>{leg}</span>
                  <button type="button" onClick={() => removeLeg(i)} className="font-mono text-[12px]" style={{ color: C.textDim }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: C.textDim }}>
              or type legs directly ({legs.length + (rawLegsText.trim() ? rawLegsText.split('\n').filter((l) => l.trim()).length : 0)}/{MAX_LEGS})
            </div>
            <textarea
              value={rawLegsText}
              onChange={(e) => setRawLegsText(e.target.value)}
              placeholder={LAB_SYNTAX_EXAMPLES.join('\n')}
              rows={3}
              className="w-full rounded px-3 py-2 font-mono text-[12px]"
              style={fieldStyle()}
            />
          </div>
        </div>

        {/* ---- screenshot ---- */}
        <div
          className="rounded-lg p-4 space-y-2 text-center"
          style={{ backgroundColor: C.surface2, border: `1px dashed ${C.border}` }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) handleFile(f)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          {imageDataUri ? (
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-[12px]" style={{ color: C.textBright }}>{imageName}</span>
              <button type="button" onClick={clearImage} className="font-mono text-[12px] underline" style={{ color: C.accent }}>remove</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="font-mono text-[12px]" style={{ color: C.textDim }}>
              drop a screenshot of a slip here, or click to choose one — {user ? 'free question or 1 credit' : 'sign in required'}
            </button>
          )}
          {imageError && <div className="font-mono text-[11px]" style={{ color: 'oklch(0.75 0.15 30)' }}>{imageError}</div>}
        </div>

        {/* ---- window ---- */}
        <div className="flex flex-wrap items-center gap-4 font-mono text-[12px]" style={{ color: C.textDim }}>
          <label className="flex items-center gap-1.5">
            since
            <select value={since} onChange={(e) => setSince(Number(e.target.value))} className="rounded px-2 py-1" style={fieldStyle()}>
              {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> include postseason
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={seasonOnly} onChange={(e) => setSeasonOnly(e.target.checked)} /> this season only
          </label>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={running}
          className="w-full font-mono font-bold text-[14px] py-2.5 rounded disabled:opacity-50"
          style={{ border: `1px solid ${C.accent}`, color: C.accent }}
        >
          {running ? 'running…' : imageDataUri ? 'read my screenshot' : 'run it'}
        </button>

        {runError && (
          <div className="rounded px-3 py-2 font-mono text-[12px]" style={{ border: '1px solid oklch(0.6 0.2 25)', color: 'oklch(0.85 0.15 25)' }}>
            {runError}
          </div>
        )}

        {/* ---- results ---- */}
        {result && <LabResults result={result} imageResult={imageResult} />}
      </div>
    </div>
  )
}

function LabResults({ result, imageResult }: { result: LabResult; imageResult: LabImageResult | null }) {
  const showIndependent = result.joint.clusters.some((c) => c.method !== 'single') && result.joint.method !== 'single'
  return (
    <div className="space-y-4">
      {imageResult && (
        <div className="rounded-lg p-4 font-mono text-[12px] space-y-1.5" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <div className="uppercase tracking-widest text-[10px]" style={{ color: C.textDim }}>read from your screenshot</div>
          {imageResult.read_from_image.legs.map((l, i) => <div key={i} style={{ color: C.textBright }}>{l}</div>)}
          {imageResult.read_from_image.unreadable.length > 0 && (
            <div style={{ color: 'oklch(0.75 0.15 30)' }}>
              couldn't read: {imageResult.read_from_image.unreadable.join(', ')}
            </div>
          )}
          <div style={{ color: C.textDim }}>
            {imageResult.quota.kind === 'free' ? `${imageResult.quota.remaining} free questions left today` : `${imageResult.quota.remaining} credits left`}
            {imageResult.credits_charged > 0 ? ` · ${imageResult.credits_charged} credit charged` : ' · free hit'}
          </div>
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="rounded-lg p-4 font-mono text-[12px] space-y-1" style={{ border: '1px solid oklch(0.6 0.2 25)' }}>
          {result.errors.map((e, i) => (
            <div key={i} style={{ color: 'oklch(0.85 0.15 25)' }}>
              <span style={{ color: C.textDim }}>{e.leg}:</span> {e.error}
            </div>
          ))}
        </div>
      )}

      {result.legs.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          {result.legs.map((leg, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[13px]"
              style={{ borderBottom: i === result.legs.length - 1 ? 'none' : `1px solid ${C.border}` }}
            >
              <span style={{ color: C.textBright }}>{leg.text}</span>
              <span className="whitespace-nowrap font-bold" style={{ color: C.accent }}>
                {leg.hits} of {leg.n} <span className="font-normal" style={{ color: C.textDim }}>({(leg.pct * 100).toFixed(0)}%)</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {result.card.together && (
        <div className="rounded-lg p-4 font-mono text-[13px] space-y-1" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.textBright }}>{result.card.together}</div>
          {showIndependent && (
            <div style={{ color: C.textDim }}>if independent: {(result.joint.independent_pct * 100).toFixed(0)}%</div>
          )}
        </div>
      )}

      {/* Share card — {sap.zilla}'s own poster, same bottom-left brand mark
          as {team.metrics}' single-stat shareables. No persisted share
          link yet (that's a fast-follow, same as team.metrics got one
          after its own base page shipped) — this is the "good enough to
          screenshot" version for now. */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
        <div className="px-5 py-5 text-center">
          <div className="font-mono font-bold text-[18px]" style={{ color: C.accent }}>{result.card.headline}</div>
          <div className="mt-3 space-y-1">
            {result.card.lines.map((l, i) => (
              <div key={i} className="font-mono text-[13px]" style={{ color: C.textBright }}>{l}</div>
            ))}
          </div>
        </div>
        <div className="flex justify-start px-5 pb-4">
          <img src={madeitLogo} alt="nspe" className="pointer-events-none" style={{ width: '22px', height: '36px', objectFit: 'contain' }} />
        </div>
      </div>
    </div>
  )
}
