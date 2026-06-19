import { useMemo, useState } from 'react'
import { StarsBackground } from '@/components/StarsBackground'
import worldcupData from '@/assets/data/worldcup.json'

// ---------------- types ----------------

type CurrentStage = 'pre' | 'group' | 'R32' | 'R16' | 'QF' | 'SF' | 'F' | 'complete'
type GroupTeamStatus = 'advancing' | 'eliminated' | 'pending'
type MatchStatus = 'scheduled' | 'complete'

interface Tournament {
  tournament_name: string
  year: number
  start_date: string
  end_date: string
  competition_id: string
  season_id: string
  host_countries: string[]
  current_stage: CurrentStage
}

interface GroupTeam {
  team_code: string
  display_name: string
  P: number
  W: number
  D: number
  L: number
  GF: number
  GA: number
  GD: number
  Pts: number
  status: GroupTeamStatus
}

interface Group {
  group_letter: string
  teams: GroupTeam[]
}

type RoundToken = 'R32' | 'R16' | 'QF' | 'SF' | '3rd' | 'F'

interface KnockoutMatch {
  match_id: string
  round_token: RoundToken
  bracket_slot: string
  match_number: number
  side_a: string
  side_b: string
  score_a: number | null
  score_b: number | null
  pens_score_a: number | null
  pens_score_b: number | null
  match_status: MatchStatus
  kickoff_datetime: string | null
  venue: string | null
}

interface WorldCupData {
  last_updated?: string
  tournament: Tournament
  groups: Group[]
  knockout: KnockoutMatch[]
}

// ---------------- design tokens ----------------

const C = {
  label: 'oklch(0.55 0 0)',
  value: 'oklch(0.88 0 0)',
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  border: 'oklch(0.28 0 0)',
  panel: 'oklch(0.13 0 0)',
  panel2: 'oklch(0.18 0 0)',
  dim: 'oklch(0.40 0 0)',
}

// ---------------- helpers ----------------

function isResolvedTeam(ref: string): boolean {
  // Resolved team codes are 3 uppercase letters (FIFA codes).
  return /^[A-Z]{3}$/.test(ref)
}

function formatKickoff(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${m}/${day} ${hh}:${mm}`
}

function formatUpdated(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${m}/${day} ${hh}:${mm}`
}

// Returns 'a' | 'b' | null for the winning side (handles pens fallback).
function matchWinner(m: KnockoutMatch): 'a' | 'b' | null {
  if (m.match_status !== 'complete') return null
  if (m.score_a == null || m.score_b == null) return null
  if (m.score_a > m.score_b) return 'a'
  if (m.score_b > m.score_a) return 'b'
  if (m.pens_score_a != null && m.pens_score_b != null) {
    if (m.pens_score_a > m.pens_score_b) return 'a'
    if (m.pens_score_b > m.pens_score_a) return 'b'
  }
  return null
}

// ---------------- group panel ----------------

function GroupTable({ group }: { group: Group }) {
  return (
    <div
      className="rounded p-2"
      style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: C.label }}>
        group {group.group_letter.toLowerCase()}
      </div>
      <div className="font-mono text-[11px]">
        <div
          className="grid items-center gap-x-2 pb-1 mb-1 border-b"
          style={{
            gridTemplateColumns: '14px 36px 1fr 50px 24px 28px',
            color: C.label,
            borderColor: C.border,
          }}
        >
          <span></span>
          <span>team</span>
          <span></span>
          <span className="text-right">w-d-l</span>
          <span className="text-right">gd</span>
          <span className="text-right">pts</span>
        </div>
        {group.teams.map((t, i) => {
          const rank = i + 1
          const isAdv = t.status === 'advancing' || (t.status === 'pending' && rank <= 2)
          const isElim = t.status === 'eliminated'
          const dot = t.status === 'advancing' ? '●' : t.status === 'eliminated' ? '×' : '○'
          const dotColor = isAdv ? C.accent : isElim ? C.dim : C.label
          const rowOpacity = isElim ? 0.45 : 1
          return (
            <div
              key={t.team_code}
              className="grid items-center gap-x-2 py-[2px]"
              style={{
                gridTemplateColumns: '14px 36px 1fr 50px 24px 28px',
                color: C.value,
                opacity: rowOpacity,
              }}
            >
              <span style={{ color: dotColor }}>{dot}</span>
              <span style={{ color: isAdv ? C.value : C.label }}>{t.team_code}</span>
              <span className="truncate" style={{ color: C.label }}>{t.display_name}</span>
              <span className="text-right tabular-nums" style={{ color: C.label }}>{t.W}-{t.D}-{t.L}</span>
              <span className="text-right tabular-nums" style={{ color: t.GD > 0 ? C.green : t.GD < 0 ? C.dim : C.label }}>{t.GD > 0 ? `+${t.GD}` : t.GD}</span>
              <span className="text-right tabular-nums font-bold" style={{ color: isAdv ? C.accent : C.value }}>{t.Pts}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- match cell ----------------

function MatchCell({
  match,
  groups,
  isChampion = false,
}: {
  match: KnockoutMatch
  groups: Group[]
  isChampion?: boolean
}) {
  const winner = matchWinner(match)
  const hasPens = match.pens_score_a != null && match.pens_score_b != null

  // Whether a side is eliminated (lost this match).
  const aEliminated = winner === 'b'
  const bEliminated = winner === 'a'

  const isLeftRoom = match.bracket_slot.includes('-M1') ||
    match.bracket_slot.includes('-M2') ||
    match.bracket_slot.includes('-M3') ||
    match.bracket_slot.includes('-M4') ||
    match.bracket_slot.includes('-M5') ||
    match.bracket_slot.includes('-M6') ||
    match.bracket_slot.includes('-M7') ||
    match.bracket_slot.includes('-M8')
  void isLeftRoom // currently unused; reserved for future connector logic

  const isTeamEliminatedInGroup = (ref: string): boolean => {
    if (!isResolvedTeam(ref)) return false
    for (const g of groups) {
      const t = g.teams.find((x) => x.team_code === ref)
      if (t) return t.status === 'eliminated'
    }
    return false
  }

  const renderSide = (ref: string, score: number | null, pens: number | null, eliminated: boolean) => {
    const resolved = isResolvedTeam(ref)
    const elimInGroup = isTeamEliminatedInGroup(ref)
    const isWinner = winner != null && ((ref === match.side_a && winner === 'a') || (ref === match.side_b && winner === 'b'))
    const dim = eliminated || elimInGroup
    return (
      <div
        className="flex items-center justify-between gap-2 px-1.5 py-[2px]"
        style={{
          color: resolved ? C.value : C.label,
          opacity: dim ? 0.4 : 1,
          fontWeight: isWinner ? 600 : 400,
        }}
      >
        <span
          className="font-mono text-[12px] tabular-nums"
          style={{ color: isWinner ? C.accent : resolved ? C.value : C.label }}
        >
          {ref}
        </span>
        <span className="font-mono text-[12px] tabular-nums" style={{ color: isWinner ? C.accent : C.value }}>
          {score != null ? (
            <>
              {score}
              {hasPens && pens != null ? <span style={{ color: C.label }}> ({pens})</span> : null}
            </>
          ) : (
            <span style={{ color: C.label }}>—</span>
          )}
        </span>
      </div>
    )
  }

  const kickoff = formatKickoff(match.kickoff_datetime)

  const championBoxStyle = isChampion
    ? {
      borderColor: C.accent,
      boxShadow: `0 0 0 1px ${C.accent}, 0 0 18px oklch(0.85 0.15 195 / 0.35)`,
    }
    : {}

  return (
    <div
      className="rounded"
      style={{
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        minWidth: 130,
        ...championBoxStyle,
      }}
    >
      {renderSide(match.side_a, match.score_a, match.pens_score_a, aEliminated)}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        {renderSide(match.side_b, match.score_b, match.pens_score_b, bEliminated)}
      </div>
      <div
        className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-[2px]"
        style={{ color: C.label, borderTop: `1px solid ${C.border}` }}
      >
        {match.match_status === 'scheduled' ? (kickoff || 'tbd') : (kickoff || 'final')}
      </div>
    </div>
  )
}

// ---------------- bracket ----------------

function Bracket({ knockout, groups, currentStage }: { knockout: KnockoutMatch[]; groups: Group[]; currentStage: CurrentStage }) {
  const bySlot = useMemo(() => {
    const m = new Map<string, KnockoutMatch>()
    for (const k of knockout) m.set(k.bracket_slot, k)
    return m
  }, [knockout])

  const get = (slot: string): KnockoutMatch | null => bySlot.get(slot) ?? null

  const final = get('F-M1')
  const isComplete = currentStage === 'complete' && final != null
  const finalWinner = final ? matchWinner(final) : null

  // Helpers for rendering a side.
  const Round = ({ label, n }: { label: string; n: number }) => (
    <div className="font-mono text-[10px] uppercase tracking-widest text-center" style={{ color: C.label }}>
      {label} <span style={{ color: C.dim }}>· {n}</span>
    </div>
  )

  const Col = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col justify-around h-full">
      {children}
    </div>
  )

  // Column gap sizes: each higher round is centered between two of the previous round's gaps.
  // R32 has 8 cells per side; choose a base row height implicitly via flex justify-around.
  // We'll let cells size naturally and use `justify-around` to space them.

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Round headers */}
      <div className="grid items-center" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: 8 }}>
        <Round label="R32" n={8} />
        <Round label="R16" n={4} />
        <Round label="QF" n={2} />
        <Round label="SF" n={1} />
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.accent }}>final</div>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: C.label }}>3rd place</div>
        </div>
        <Round label="SF" n={1} />
        <Round label="QF" n={2} />
        <Round label="R16" n={4} />
        <Round label="R32" n={8} />
      </div>

      {/* Bracket body */}
      <div
        className="grid items-stretch flex-1 min-h-0"
        style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: 8 }}
      >
        {/* R32 left: M1..M8 */}
        <Col>
          {Array.from({ length: 8 }, (_, i) => `R32-M${i + 1}`).map((slot) => {
            const m = get(slot)
            return m ? <MatchCell key={slot} match={m} groups={groups} /> : <div key={slot} />
          })}
        </Col>
        {/* R16 left: M1..M4 */}
        <Col>
          {['R16-M1', 'R16-M2', 'R16-M3', 'R16-M4'].map((slot) => {
            const m = get(slot)
            return m ? <MatchCell key={slot} match={m} groups={groups} /> : <div key={slot} />
          })}
        </Col>
        {/* QF left: M1..M2 */}
        <Col>
          {['QF-M1', 'QF-M2'].map((slot) => {
            const m = get(slot)
            return m ? <MatchCell key={slot} match={m} groups={groups} /> : <div key={slot} />
          })}
        </Col>
        {/* SF left: M1 */}
        <div className="flex flex-col justify-center">
          {(() => {
            const m = get('SF-M1')
            return m ? <MatchCell match={m} groups={groups} /> : null
          })()}
        </div>
        {/* Final + 3rd place */}
        <div className="flex flex-col items-stretch justify-center gap-3">
          {final && (
            <div>
              <MatchCell match={final} groups={groups} isChampion={isComplete} />
              {isComplete && finalWinner && (
                <div
                  className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-center"
                  style={{ color: C.accent, textShadow: `0 0 10px ${C.accent}` }}
                >
                  champion · {finalWinner === 'a' ? final.side_a : final.side_b}
                </div>
              )}
            </div>
          )}
          {(() => {
            const m = get('3rd-M1')
            if (!m) return null
            return (
              <div className="opacity-80">
                <div className="font-mono text-[9px] uppercase tracking-widest text-center mb-1" style={{ color: C.label }}>
                  3rd place
                </div>
                <MatchCell match={m} groups={groups} />
              </div>
            )
          })()}
        </div>
        {/* SF right: M2 */}
        <div className="flex flex-col justify-center">
          {(() => {
            const m = get('SF-M2')
            return m ? <MatchCell match={m} groups={groups} /> : null
          })()}
        </div>
        {/* QF right: M3..M4 */}
        <Col>
          {['QF-M3', 'QF-M4'].map((slot) => {
            const m = get(slot)
            return m ? <MatchCell key={slot} match={m} groups={groups} /> : <div key={slot} />
          })}
        </Col>
        {/* R16 right: M5..M8 */}
        <Col>
          {['R16-M5', 'R16-M6', 'R16-M7', 'R16-M8'].map((slot) => {
            const m = get(slot)
            return m ? <MatchCell key={slot} match={m} groups={groups} /> : <div key={slot} />
          })}
        </Col>
        {/* R32 right: M9..M16 */}
        <Col>
          {Array.from({ length: 8 }, (_, i) => `R32-M${i + 9}`).map((slot) => {
            const m = get(slot)
            return m ? <MatchCell key={slot} match={m} groups={groups} /> : <div key={slot} />
          })}
        </Col>
      </div>
    </div>
  )
}

// ---------------- page ----------------

type ActiveView = 'groups' | 'knockout'

// Country flag color stripes used to letter the host country names in the header.
// Order matches the flag bands left→right (or hoist→fly), one color per character
// of the country name. Wraps if the name is longer than the band count.
const HOST_FLAG_COLORS: Record<string, string[]> = {
  USA: ['oklch(0.45 0.18 260)', 'oklch(0.60 0.22 25)', 'oklch(0.96 0 0)'],
  Mexico: ['oklch(0.55 0.18 145)', 'oklch(0.96 0 0)', 'oklch(0.60 0.22 25)'],
  Canada: ['oklch(0.60 0.22 25)', 'oklch(0.96 0 0)', 'oklch(0.60 0.22 25)'],
}

function FlagLetteredCountry({ name }: { name: string }) {
  const colors = HOST_FLAG_COLORS[name]
  if (!colors || colors.length === 0) {
    return <span>{name}</span>
  }
  return (
    <span>
      {Array.from(name).map((ch, i) => (
        <span key={i} style={{ color: colors[i % colors.length] }}>{ch}</span>
      ))}
    </span>
  )
}

export default function WorldCupApp() {
  const data = worldcupData as unknown as WorldCupData
  const t = data.tournament
  const groups = data.groups ?? []
  const knockout = data.knockout ?? []
  const stage = (t.current_stage ?? 'pre') as CurrentStage

  const [activeView, setActiveView] = useState<ActiveView>('groups')

  const stageLabel = stage === 'pre' ? 'pre-tournament'
    : stage === 'group' ? 'group stage'
    : stage === 'complete' ? 'complete'
    : `knockout · ${stage}`

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden">
      <StarsBackground density={180} />

      {/* Top bar */}
      <div className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between gap-6">
        <div className="flex flex-col">
          <a
            href="/"
            className="font-mono text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: C.label }}
          >
            ← nspe.dev
          </a>
          <div className="font-mono text-[18px] mt-1" style={{ color: C.value }}>
            <span style={{ color: C.accent }}>world.cup</span>
            <span style={{ color: C.label }}>{' · '}</span>
            <span style={{ color: C.green }}>{t.tournament_name}</span>
          </div>
          <div className="font-mono text-[11px] mt-0.5">
            {t.host_countries.map((country, i) => (
              <span key={country}>
                {i > 0 && <span style={{ color: C.label }}>{' · '}</span>}
                <FlagLetteredCountry name={country} />
              </span>
            ))}
            <span style={{ color: C.label }}>{` · ${stageLabel}`}</span>
          </div>
        </div>

        {/* Right-side action row: querybuilder link + view switcher */}
        <div className="flex items-center gap-5 pt-2">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="font-mono font-bold text-[14px] hover:opacity-80 transition-opacity whitespace-nowrap inline-flex items-baseline gap-1.5"
            style={{ color: C.dim, cursor: 'not-allowed' }}
            aria-disabled="true"
          >
            <span>{'{fifa.querybuilder}'}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>
              (coming soon)
            </span>
          </a>
          <button
            type="button"
            onClick={() => setActiveView('groups')}
            className="font-mono font-bold text-[14px] underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{
              color: activeView === 'groups' ? C.accent : C.label,
              textDecoration: activeView === 'groups' ? 'underline' : 'none',
            }}
          >
            {'{world.cup.bracket}'}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('knockout')}
            className="font-mono font-bold text-[14px] underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{
              color: activeView === 'knockout' ? C.accent : C.label,
              textDecoration: activeView === 'knockout' ? 'underline' : 'none',
            }}
          >
            {'{knockout.bracket}'}
          </button>
        </div>
      </div>

      <div className="relative z-10 h-full pt-28 pb-12 px-6 max-w-[1480px] mx-auto">
        {activeView === 'groups' ? (
          <section className="h-full flex flex-col">
            <div className="font-mono text-[11px] uppercase tracking-widest mb-3" style={{ color: C.label }}>
              groups
            </div>
            <div
              className="grid gap-3 flex-1 min-h-0"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gridAutoRows: 'minmax(0, 1fr)' }}
            >
              {groups.map((g) => <GroupTable key={g.group_letter} group={g} />)}
            </div>
          </section>
        ) : (
          <section className="h-full flex flex-col">
            <div className="font-mono text-[11px] uppercase tracking-widest mb-3" style={{ color: C.label }}>
              knockout bracket
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <Bracket knockout={knockout} groups={groups} currentStage={stage} />
            </div>
          </section>
        )}
      </div>

      {/* Updated caption */}
      <div className="fixed bottom-3 left-4 z-20 font-mono text-[11px]" style={{ color: C.label }}>
        updated · {formatUpdated(data.last_updated)}
      </div>
    </div>
  )
}
