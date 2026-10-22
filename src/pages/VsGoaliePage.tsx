// {skater.vs.goalie} (branded {vs.goalie} until 2026-10-28, renamed per
// owner ask — route/file/module names below are unchanged, this is a
// display-label-only rename) — NHL skater-vs-goalie top rankings. Pick a
// goalie, see the
// top skaters who've produced against them; pick a skater, see the top
// goalies they've produced against. Same visual family as {team.metrics}
// (full-height dark terminal page, bordered cards, no PageShell/shadcn
// chrome) and replaces the role "opponent thresholds allowed" plays there,
// in spirit only — team.metrics itself isn't touched.
//
// Owner ask, 2026-10-27: no footnote about retired goalies being
// unavailable ("retired goalies wont be offered and shouldnt be
// expected") — the picker list is sourced from the live goalies endpoint,
// which structurally only ever contains currently-rostered goalies (the
// scrape never captured retired ones in the first place), so there's
// nothing to caveat.
//
// Route is wrapped in <ProtectedRoute> (main.tsx) for the sign-in gate;
// the Pro-plan gate is a 402 the backend itself returns (see
// vsGoalieApi.ts) — gate is OFF until ~10/25 per the owner's team.metrics
// timeline, so this renders real data for any signed-in user until then.
import { useEffect, useMemo, useState } from 'react'
import { HomeLogoLink } from '@/components/HomeLogoLink'
import { C } from '@/components/ProfileSections'
import { loadPlayerIndex, searchPlayers, PLAYER_INDEX, type PlayerIndexEntry, type PlayerMatch } from '@/lib/playerSearch'
import {
  fetchVsGoalieGoalies,
  fetchVsGoalieRankForGoalie,
  fetchVsGoalieRankForSkater,
  fetchVsGoalieGames,
  VsGoalieError,
  type VsGoalieListing,
  type VsGoalieRankResult,
  type VsGoalieGamesResult,
  type VsGoalieSort,
} from '@/lib/vsGoalieApi'

type Direction = 'goalie' | 'skater'

const SORTS: { key: VsGoalieSort; label: string }[] = [
  { key: 'pts', label: 'points' },
  { key: 'g', label: 'goals' },
  { key: 'sog', label: 'SOG' },
]

const TOP_DEFAULT = 10
const TOP_STEP = 20
const TOP_MAX = 100

function fieldStyle(): React.CSSProperties {
  return { backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.textBright }
}

export default function VsGoaliePage() {
  const [direction, setDirection] = useState<Direction>('goalie')
  const [isIntroOpen, setIsIntroOpen] = useState(false)

  // ---- goalie-direction picker (goalie is the subject, skaters rank) ----
  const [goalies, setGoalies] = useState<VsGoalieListing[] | null>(null)
  const [goaliesError, setGoaliesError] = useState<VsGoalieError | null>(null)
  const [goalieQuery, setGoalieQuery] = useState('')
  const [selectedGoalie, setSelectedGoalie] = useState<VsGoalieListing | null>(null)

  // ---- skater-direction picker (skater is the subject, goalies rank) ----
  // Reuses the same shared player index sap.zilla's own picker reads from,
  // filtered to nhl — no separate "list of skaters" endpoint needed, unlike
  // goalies (there's no equivalent homepage/sap.zilla search surface for
  // goalies specifically, which is exactly the gap /nhl/vs-goalie/goalies
  // was built to close).
  const [indexReady, setIndexReady] = useState(PLAYER_INDEX.length > 0)
  const [skaterQuery, setSkaterQuery] = useState('')
  const [skaterMatches, setSkaterMatches] = useState<PlayerMatch[]>([])
  const [selectedSkater, setSelectedSkater] = useState<PlayerIndexEntry | null>(null)

  const [sort, setSort] = useState<VsGoalieSort>('pts')
  const [minGpText, setMinGpText] = useState('3')
  const [top, setTop] = useState(TOP_DEFAULT)

  const [rank, setRank] = useState<VsGoalieRankResult | null>(null)
  const [rankLoading, setRankLoading] = useState(false)
  const [rankError, setRankError] = useState<VsGoalieError | null>(null)

  const [drillSubject, setDrillSubject] = useState<{ skater: string; goalie: string } | null>(null)
  const [games, setGames] = useState<VsGoalieGamesResult | null>(null)
  const [gamesLoading, setGamesLoading] = useState(false)
  const [gamesError, setGamesError] = useState<string | null>(null)

  const minGp = minGpText === '' ? 0 : parseInt(minGpText, 10) || 0

  useEffect(() => {
    if (indexReady) return
    loadPlayerIndex().then(() => setIndexReady(true))
  }, [indexReady])

  useEffect(() => {
    if (!skaterQuery.trim()) {
      setSkaterMatches([])
      return
    }
    // Team-code search (owner ask, 2026-10-28): "EDM" should surface every
    // Oilers skater, not just whoever's name happens to contain those
    // letters. searchPlayers() (the shared, name-only matcher) has no team
    // concept, so this is a local supplement rather than a change to that
    // shared utility — an exact team-code hit takes over the dropdown
    // entirely; otherwise it's the normal name search.
    const q = skaterQuery.trim().toLowerCase()
    const byTeam = PLAYER_INDEX.filter((e) => e.sport === 'nhl' && e.team.toLowerCase() === q)
    if (byTeam.length > 0) {
      setSkaterMatches(byTeam.slice(0, 30).map((entry) => ({ entry, matchedOn: 'other', matchedPrefix: q })))
      return
    }
    setSkaterMatches(searchPlayers(skaterQuery, 6, 'nhl'))
  }, [skaterQuery])

  // Fetching the picker list doubles as this page's own sign-in/Pro gate
  // check — no separate "am I allowed in" call needed.
  useEffect(() => {
    if (goalies || goaliesError) return
    fetchVsGoalieGoalies()
      .then((res) => setGoalies(res.goalies))
      .catch((err) => setGoaliesError(err instanceof VsGoalieError ? err : new VsGoalieError(0, 'Something went wrong.')))
  }, [goalies, goaliesError])

  const goalieMatches = useMemo(() => {
    if (!goalies || !goalieQuery.trim()) return []
    const q = goalieQuery.trim().toLowerCase()
    // Team-code search, same idea as the skater picker below: "EDM" shows
    // every Oilers goalie on file instead of a name substring match.
    const byTeam = goalies.filter((g) => g.team.toLowerCase() === q)
    if (byTeam.length > 0) return byTeam
    return goalies.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 8)
  }, [goalies, goalieQuery])

  const subject = direction === 'goalie' ? selectedGoalie : selectedSkater
  const subjectReady = !!subject

  useEffect(() => {
    if (!subjectReady) {
      setRank(null)
      setRankError(null)
      return
    }
    let cancelled = false
    setRankLoading(true)
    setRankError(null)
    const req =
      direction === 'goalie'
        ? fetchVsGoalieRankForGoalie(selectedGoalie!.key, sort, top, minGp)
        : fetchVsGoalieRankForSkater(selectedSkater!.name, sort, top, minGp)
    req
      .then((res) => {
        if (!cancelled) setRank(res)
      })
      .catch((err) => {
        if (!cancelled) setRankError(err instanceof VsGoalieError ? err : new VsGoalieError(0, 'Something went wrong.'))
      })
      .finally(() => {
        if (!cancelled) setRankLoading(false)
      })
    return () => {
      cancelled = true
    }
    // selectedGoalie/selectedSkater are read via direction, which is already a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, selectedGoalie, selectedSkater, sort, top, minGp, subjectReady])

  function resetPickers() {
    setSelectedGoalie(null)
    setGoalieQuery('')
    setSelectedSkater(null)
    setSkaterQuery('')
    setTop(TOP_DEFAULT)
    setRank(null)
  }

  function openDrillIn(rowName: string) {
    const skater = direction === 'goalie' ? rowName : selectedSkater!.name
    const goalie = direction === 'goalie' ? selectedGoalie!.key : rowName
    setDrillSubject({ skater, goalie })
    setGamesLoading(true)
    setGamesError(null)
    setGames(null)
    fetchVsGoalieGames(skater, goalie)
      .then(setGames)
      .catch((err) => setGamesError(err instanceof Error ? err.message : 'Something went wrong.'))
      .finally(() => setGamesLoading(false))
  }

  const isPro402 = goaliesError?.status === 402 || rankError?.status === 402
  const needsSignIn = goaliesError?.status === 401 || rankError?.status === 401

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background" style={{ color: C.textBright, fontFamily: 'monospace' }}>
      {/* Two stacked rows (owner ask, 2026-10-28): nspe.dev top-left on its
          own row, {skater.vs.goalie} + {how.to.use} sharing the row below
          it — previously all three (badge, a tagline, the logo) crammed
          into one items-center row, which is exactly the "button text reads
          as part of the sentence" jumbling reported elsewhere this same
          round once the tagline got long enough to wrap on a phone. The
          static tagline itself is gone — {how.to.use} opens IntroModal with
          the same explanation instead of it always sitting in the header. */}
      <div className="flex flex-col gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <HomeLogoLink fontSizePx={13} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono font-bold text-[15px] rounded px-2 py-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}>
            {'{skater.vs.goalie}'}
          </span>
          <button
            type="button"
            onClick={() => setIsIntroOpen(true)}
            className="font-mono font-bold text-[12px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.78 0.18 145)' }}
          >
            {'{how.to.use}'}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-3xl mx-auto space-y-5">
        {needsSignIn ? (
          <GatePanel kind="signin" />
        ) : isPro402 ? (
          <GatePanel kind="pro" message={goaliesError?.message ?? rankError?.message} />
        ) : (
          <>
            <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
              <div className="flex flex-wrap gap-2">
                {(['goalie', 'skater'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDirection(d)
                      resetPickers()
                    }}
                    className="font-mono text-[12px] font-bold px-3 py-1.5 rounded"
                    style={{ border: `1px solid ${direction === d ? C.accent : C.border}`, color: direction === d ? C.accent : C.textDim }}
                  >
                    {d === 'goalie' ? 'pick a goalie → top skaters' : 'pick a skater → top goalies'}
                  </button>
                ))}
              </div>

              {direction === 'goalie' ? (
                <div className="relative">
                  <input
                    value={selectedGoalie ? selectedGoalie.name : goalieQuery}
                    onChange={(e) => {
                      setSelectedGoalie(null)
                      setGoalieQuery(e.target.value)
                    }}
                    placeholder={goalies ? 'search a goalie…' : 'loading goalies…'}
                    disabled={!goalies}
                    className="w-full rounded px-3 py-2 font-mono text-[13px]"
                    style={fieldStyle()}
                  />
                  {!selectedGoalie && goalieMatches.length > 0 && (
                    <div className="absolute left-0 right-0 z-10 mt-1 rounded overflow-hidden" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                      {goalieMatches.map((g) => (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => {
                            setSelectedGoalie(g)
                            setGoalieQuery('')
                            setTop(TOP_DEFAULT)
                          }}
                          className="block w-full text-left px-3 py-1.5 font-mono text-[12px] hover:opacity-80"
                          style={{ color: C.textBright }}
                        >
                          {g.name} <span style={{ color: C.textDim }}>{g.team}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    value={selectedSkater ? selectedSkater.name : skaterQuery}
                    onChange={(e) => {
                      setSelectedSkater(null)
                      setSkaterQuery(e.target.value)
                    }}
                    placeholder={indexReady ? 'search a skater…' : 'loading players…'}
                    className="w-full rounded px-3 py-2 font-mono text-[13px]"
                    style={fieldStyle()}
                  />
                  {!selectedSkater && skaterMatches.length > 0 && (
                    <div className="absolute left-0 right-0 z-10 mt-1 rounded overflow-hidden" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                      {skaterMatches.map((m) => (
                        <button
                          key={m.entry.slug}
                          type="button"
                          onClick={() => {
                            setSelectedSkater(m.entry)
                            setSkaterQuery('')
                            setSkaterMatches([])
                            setTop(TOP_DEFAULT)
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
              )}

              <div className="flex flex-wrap items-center gap-3 font-mono text-[12px]" style={{ color: C.textDim }}>
                <span>sort by</span>
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSort(s.key)}
                    className="px-2.5 py-1 rounded"
                    style={{ border: `1px solid ${sort === s.key ? C.accent : C.border}`, color: sort === s.key ? C.accent : C.textDim }}
                  >
                    {s.label}
                  </button>
                ))}
                <label className="flex items-center gap-1.5">
                  min GP
                  <input
                    value={minGpText}
                    onChange={(e) => setMinGpText(e.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    className="w-14 rounded px-2 py-1 font-mono text-[12px] text-center"
                    style={fieldStyle()}
                  />
                </label>
              </div>
            </div>

            {rankError && !isPro402 && !needsSignIn && (
              <div className="rounded-lg p-4 font-mono text-[12px]" style={{ border: '1px solid oklch(0.6 0.2 25)', color: 'oklch(0.85 0.15 25)' }}>
                {rankError.message}
              </div>
            )}

            {rankLoading && <div className="font-mono text-[12px]" style={{ color: C.textDim }}>loading…</div>}

            {rank && (
              <div className="rounded-lg overflow-hidden" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="font-mono text-[13px]" style={{ color: C.textBright }}>
                    {direction === 'goalie' ? 'top skaters vs. ' : 'top goalies vs. '}
                    <span style={{ color: C.accent }}>{rank.subject}</span>
                    {direction === 'goalie' && selectedGoalie ? <span style={{ color: C.textDim }}> ({selectedGoalie.team})</span> : null}
                    {direction === 'skater' && selectedSkater ? <span style={{ color: C.textDim }}> ({selectedSkater.team})</span> : null}
                  </span>
                  <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
                    showing {rank.count}{typeof rank.total === 'number' ? ` of ${rank.total}` : ''}
                  </span>
                </div>
                <table className="w-full font-mono text-[12px]">
                  <thead>
                    <tr style={{ color: C.textDim }}>
                      <th className="text-left px-4 py-1.5">{direction === 'goalie' ? 'skater' : 'goalie'}</th>
                      <th className="text-left px-2 py-1.5">team</th>
                      <th className="text-right px-2 py-1.5">GP</th>
                      <th className="text-right px-2 py-1.5">G</th>
                      <th className="text-right px-2 py-1.5">A</th>
                      <th className="text-right px-2 py-1.5">PTS</th>
                      <th className="text-right px-2 py-1.5">SOG</th>
                      <th className="text-right px-4 py-1.5">PTS/GM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rank.rows.map((r, i) => (
                      <tr
                        key={i}
                        onClick={() => openDrillIn(r.name)}
                        className="cursor-pointer hover:opacity-80"
                        style={{ borderTop: `1px solid ${C.border}` }}
                      >
                        <td className="px-4 py-1.5" style={{ color: C.textBright }}>{r.name}</td>
                        <td className="px-2 py-1.5" style={{ color: C.textDim }}>{r.team}</td>
                        <td className="text-right px-2 py-1.5">{r.gp}</td>
                        <td className="text-right px-2 py-1.5">{r.g}</td>
                        <td className="text-right px-2 py-1.5">{r.a}</td>
                        <td className="text-right px-2 py-1.5 font-bold" style={{ color: C.accent }}>{r.pts}</td>
                        <td className="text-right px-2 py-1.5">{r.sog}</td>
                        <td className="text-right px-4 py-1.5">{r.pts_per_gm.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {typeof rank.total === 'number' && rank.total > rank.rows.length && top < TOP_MAX && (
                  <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                    <button
                      type="button"
                      onClick={() => setTop((t) => Math.min(TOP_MAX, t + TOP_STEP))}
                      className="font-mono text-[12px] underline hover:opacity-80"
                      style={{ color: C.accent }}
                    >
                      show more
                    </button>
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </div>

      {drillSubject && (
        <GamesOverlay
          subject={drillSubject}
          games={games}
          loading={gamesLoading}
          error={gamesError}
          onClose={() => setDrillSubject(null)}
        />
      )}

      <IntroModal open={isIntroOpen} onClose={() => setIsIntroOpen(false)} />
    </div>
  )
}

// Owner ask, 2026-10-28: the page's own explanation moved out of an
// always-on header tagline (which jumbled on mobile once it ran long
// enough to wrap) and into this on-demand modal, reached via {how.to.use}
// — same role as {query builder}'s own {build.tutorial} button. Also makes
// the old "pick a goalie to see who produces against them" hint under the
// picker redundant, so that's gone too rather than saying the same thing
// twice in two places.
function IntroModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[480px] rounded-lg overflow-hidden shadow-2xl"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}>
          <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>{'{how.to.use}'}</span>
          <button type="button" onClick={onClose} className="font-mono text-[14px] hover:opacity-70 transition-opacity" style={{ color: C.accent }} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 font-mono text-[13px]" style={{ color: C.textBright }}>
          <p>welcome to {'{skater vs goalie}'} — select a skater to see their history vs goalies</p>
          <p style={{ color: C.textDim }}>alternatively, select a goalie to see their history vs skaters</p>
        </div>
      </div>
    </div>
  )
}

function GatePanel({ kind, message }: { kind: 'signin' | 'pro'; message?: string }) {
  return (
    <div className="rounded-lg p-5 font-mono text-[13px] space-y-2" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
      <div style={{ color: C.textBright }}>
        {kind === 'signin' ? 'sign in to use {skater.vs.goalie}.' : (message || 'Skater vs goalie is a Pro page.')}
      </div>
      <a
        href={kind === 'signin' ? '/login?redirect=%2Fnhl.vs.goalie' : '/refill'}
        className="inline-block font-mono text-[12px] underline"
        style={{ color: C.accent }}
      >
        {kind === 'signin' ? 'sign in' : 'see plans'}
      </a>
    </div>
  )
}

function GamesOverlay({
  subject,
  games,
  loading,
  error,
  onClose,
}: {
  subject: { skater: string; goalie: string }
  games: VsGoalieGamesResult | null
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[640px] max-h-[85vh] rounded-lg overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 flex-none" style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}>
          <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>
            {games ? games.skater : subject.skater} vs {games ? games.goalie : subject.goalie}
          </span>
          <button type="button" onClick={onClose} className="font-mono text-[14px] hover:opacity-70 transition-opacity" style={{ color: C.accent }} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto">
          {loading && <div className="px-5 py-4 font-mono text-[12px]" style={{ color: C.textDim }}>loading…</div>}
          {error && <div className="px-5 py-4 font-mono text-[12px]" style={{ color: 'oklch(0.85 0.15 25)' }}>{error}</div>}
          {games && (
            <>
              <div className="px-5 py-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px]" style={{ borderBottom: `1px solid ${C.border}`, color: C.textDim }}>
                <span>GP <span style={{ color: C.textBright }}>{games.summary.GP}</span></span>
                <span>G <span style={{ color: C.textBright }}>{games.summary.G}</span></span>
                <span>A <span style={{ color: C.textBright }}>{games.summary.A}</span></span>
                <span>PTS <span style={{ color: C.textBright }}>{games.summary.PTS}</span></span>
                <span>SOG <span style={{ color: C.textBright }}>{games.summary.SOG}</span></span>
                <span>multi-goal games <span style={{ color: C.textBright }}>{games.summary.multi_goal_games}</span></span>
                <span>blank games <span style={{ color: C.textBright }}>{games.summary.blank_games}</span></span>
              </div>
              <table className="w-full font-mono text-[12px]">
                <thead>
                  <tr style={{ color: C.textDim }}>
                    <th className="text-left px-5 py-1.5">date</th>
                    <th className="text-left px-2 py-1.5">opp</th>
                    <th className="text-left px-2 py-1.5">result</th>
                    <th className="text-right px-2 py-1.5">G</th>
                    <th className="text-right px-2 py-1.5">A</th>
                    <th className="text-right px-2 py-1.5">PTS</th>
                    <th className="text-right px-2 py-1.5">SOG</th>
                    {/* The goalie's own decision for that game, independent of
                        the skater's team result just to its left — easy to
                        misread as the same thing (flagged by backend), so
                        it's labeled "goalie dec." rather than just "dec." */}
                    <th className="text-right px-5 py-1.5">goalie dec.</th>
                  </tr>
                </thead>
                <tbody>
                  {games.games.map((g, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td className="px-5 py-1.5" style={{ color: C.textBright }}>{g.date}</td>
                      <td className="px-2 py-1.5" style={{ color: C.textDim }}>{g.opponent}</td>
                      <td className="px-2 py-1.5" style={{ color: C.textDim }}>{g.result}</td>
                      <td className="text-right px-2 py-1.5">{g.G}</td>
                      <td className="text-right px-2 py-1.5">{g.A}</td>
                      <td className="text-right px-2 py-1.5 font-bold" style={{ color: C.accent }}>{g.PTS}</td>
                      <td className="text-right px-2 py-1.5">{g.SOG}</td>
                      <td className="text-right px-5 py-1.5" style={{ color: C.textDim }}>
                        {g.goalie.started ? `${g.goalie.decision} (${g.goalie.saves}/${g.goalie.shots_against})` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
