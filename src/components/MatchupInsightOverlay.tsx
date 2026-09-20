// `nfl matchup <A> vs <B>` full-screen overlay — purely descriptive, no
// trend/compute window, never a predictive-syntax sample (the entry point
// is a clickable {A vs B} button next to a real scheduled game, not typed).
// v1 layout: two tabs rather than one long scroll, since the team-history
// table and the per-player cards are different enough shapes that mixing
// them in one scroll read as cluttered — see the conversation this was
// designed in for the alternatives considered (a summary-card-then-expand
// version is a plausible v2 if this turns out too dense).
import { useState } from 'react'
import { extractDateToken, type MatchupInsightPayload, type MatchupPlayer, type MatchupPlayerSplit } from '@/lib/nspe-payloads'
import { C, MiniStat, SectionStack, type StatTableSection } from '@/components/ProfileSections'

export interface MatchupInsightOverlayProps {
  open: boolean
  onClose: () => void
  payload: MatchupInsightPayload | null
}

type Tab = 'history' | 'players'

function buildHistorySection(payload: MatchupInsightPayload): StatTableSection {
  const teamA = payload.query.team_a
  const teamB = payload.query.team_b
  return {
    type: 'stat_table',
    label: 'meeting history',
    columns: [
      { key: 'date', label: 'date' },
      { key: 'season', label: 'season' },
      { key: 'result', label: 'result' },
      { key: 'pf', label: 'pf' },
      { key: 'pa', label: 'pa' },
      { key: 'a_yds', label: `${teamA} yds` },
      { key: 'a_ypp', label: `${teamA} ypp` },
      { key: 'b_yds', label: `${teamB} yds` },
      { key: 'b_ypp', label: `${teamB} ypp` },
    ],
    rows: payload.meetings.map((m, i) => ({
      key: `${m.date_iso}-${i}`,
      label: extractDateToken(m.date_iso) ?? m.date_iso,
      values: [
        extractDateToken(m.date_iso) ?? m.date_iso,
        m.season,
        m.outcome,
        m.pts_for,
        m.pts_allowed,
        m.a_stats.total_yards,
        m.a_stats.yards_per_play.toFixed(1),
        m.b_stats.total_yards,
        m.b_stats.yards_per_play.toFixed(1),
      ],
    })),
  }
}

function getPlayerStatFields(category: string): { key: keyof MatchupPlayerSplit; label: string }[] {
  if (category === 'rush') {
    return [
      { key: 'games', label: 'g' },
      { key: 'attempts', label: 'att' },
      { key: 'yards', label: 'yds' },
      { key: 'td', label: 'td' },
      { key: 'long', label: 'lng' },
    ]
  }
  if (category === 'rec') {
    return [
      { key: 'games', label: 'g' },
      { key: 'attempts', label: 'tgt' },
      { key: 'completions', label: 'rec' },
      { key: 'pct', label: 'pct' },
      { key: 'yards', label: 'yds' },
      { key: 'td', label: 'td' },
      { key: 'long', label: 'lng' },
    ]
  }
  // pass (default)
  return [
    { key: 'games', label: 'g' },
    { key: 'attempts', label: 'att' },
    { key: 'completions', label: 'cmp' },
    { key: 'pct', label: 'pct' },
    { key: 'yards', label: 'yds' },
    { key: 'td', label: 'td' },
    { key: 'int', label: 'int' },
    { key: 'long', label: 'lng' },
  ]
}

function formatPlayerStatValue(key: string, value: number): string {
  if (key === 'pct') return `${value.toFixed(1)}%`
  if (key === 'long') return Number.isInteger(value) ? String(value) : value.toFixed(1)
  return String(value)
}

function SplitBlock({ label, split, category }: { label: string; split: MatchupPlayerSplit; category: string }) {
  const fields = getPlayerStatFields(category)
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {fields.map(({ key, label: fieldLabel }) => {
          const raw = split[key]
          if (typeof raw !== 'number') return null
          return <MiniStat key={key} label={fieldLabel} value={formatPlayerStatValue(key, raw)} />
        })}
      </div>
      {split.quarters && (
        <div className="flex gap-1.5 font-mono text-[10px]" style={{ color: C.textDim }}>
          {(['q1', 'q2', 'q3', 'q4', '1h', '2h'] as const).map((q) => (
            <span key={q}>
              {q}
              <span style={{ color: C.textBright }}> {split.quarters![q]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerCard({ player, opponent }: { player: MatchupPlayer; opponent: string }) {
  return (
    <div className="rounded p-3" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-[13px] font-bold" style={{ color: C.textBright }}>
          {player.player_name.replace(/([a-z])([A-Z])/g, '$1 $2')}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.accent }}>
          {player.category}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SplitBlock label={`vs ${opponent}`} split={player.vs_opponent} category={player.category} />
        <SplitBlock label="recent form" split={player.recent_form} category={player.category} />
      </div>
    </div>
  )
}

export function MatchupInsightOverlay({ open, onClose, payload }: MatchupInsightOverlayProps) {
  const [tab, setTab] = useState<Tab>('history')
  if (!open || !payload) return null

  const teamA = payload.query.team_a
  const teamB = payload.query.team_b
  const record = payload.team_record

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[960px] max-h-[90vh] rounded-lg overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 flex-none"
          style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}
        >
          <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>
            {teamA} vs {teamB} — matchup insight
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: C.accent }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 flex-none flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
          {/* record is teamA's wins-losses. The team AHEAD is named (with its
              own wins first), never teamA by default; equal wins reads
              "series even". */}
          <span className="font-mono text-[13px]" style={{ color: C.textBright }}>
            {record.wins === record.losses ? (
              <>series even </>
            ) : (
              <>{record.wins > record.losses ? teamA : teamB} leads series </>
            )}
            <span style={{ color: C.accent, fontWeight: 700 }}>
              {Math.max(record.wins, record.losses)}-{Math.min(record.wins, record.losses)}
              {record.ties ? `-${record.ties}` : ''}
            </span>
          </span>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setTab('history')}
              className="font-mono text-[12px] hover:opacity-80 transition-opacity"
              style={{ color: tab === 'history' ? C.accent : C.textDim, textDecoration: tab === 'history' ? 'underline' : 'none' }}
            >
              {'{team history}'}
            </button>
            <button
              type="button"
              onClick={() => setTab('players')}
              className="font-mono text-[12px] hover:opacity-80 transition-opacity"
              style={{ color: tab === 'players' ? C.accent : C.textDim, textDecoration: tab === 'players' ? 'underline' : 'none' }}
            >
              {'{player insights}'}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {tab === 'history' ? (
            <SectionStack sections={[buildHistorySection(payload)]} />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: C.textDim }}>
                  {teamA}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {payload.team_a.players.map((p) => (
                    <PlayerCard key={p.player_name} player={p} opponent={teamB} />
                  ))}
                </div>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: C.textDim }}>
                  {teamB}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {payload.team_b.players.map((p) => (
                    <PlayerCard key={p.player_name} player={p} opponent={teamA} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
