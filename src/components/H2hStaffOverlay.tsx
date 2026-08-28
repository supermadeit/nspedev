// {h2h -staff} full-screen overlay — same "dark backdrop + centered panel"
// chrome as SampleQueriesModal/QueryBuilderTutorial (not a popup, not a
// routed page), just wider to fit the pitcher-by-pitcher table. Reuses the
// section-driven renderer built for /database (ProfileSections.tsx) rather
// than growing the small floating query-results panel — that panel stays
// exactly as-is for plain h2h, which already reads fine there; only the
// `-staff` variant (superset payload with a real table's worth of extra
// data) escalates to this treatment.
import { formatBattingAvg, type H2hPayload } from '@/lib/nspe-payloads'
import {
  C,
  SectionStack,
  type FlatTotalsSection,
  type MatchListSection,
  type ProfileSection,
  type StatTableSection,
} from '@/components/ProfileSections'

export interface H2hStaffOverlayProps {
  open: boolean
  onClose: () => void
  payload: H2hPayload | null
}

const STAFF_TABLE_COLUMNS = [
  { key: 'AB', label: 'AB' },
  { key: 'H', label: 'H' },
  { key: '2B', label: '2B' },
  { key: '3B', label: '3B' },
  { key: 'HR', label: 'HR' },
  { key: 'RBI', label: 'RBI' },
  { key: 'BB', label: 'BB' },
  { key: 'K', label: 'K' },
  { key: 'AVG', label: 'AVG' },
  { key: 'OBP', label: 'OBP' },
  { key: 'SLG', label: 'SLG' },
  { key: 'OPS', label: 'OPS' },
] as const

function buildSections(payload: H2hPayload): ProfileSection[] {
  const t = payload.totals ?? {}
  const games = payload.games ?? []
  const staff = payload.staff_breakdown

  const totals: FlatTotalsSection = {
    type: 'flat_totals',
    label: 'Totals vs opponent',
    entries: [
      { key: 'avg', label: 'AVG', value: formatBattingAvg(t.AVG) },
      { key: 'obp', label: 'OBP', value: formatBattingAvg(t.OBP) },
      { key: 'slg', label: 'SLG', value: formatBattingAvg(t.SLG) },
      { key: 'ops', label: 'OPS', value: formatBattingAvg(t.OPS) },
      { key: 'g', label: 'G', value: t.games ?? 0 },
      { key: 'ab', label: 'AB', value: t.AB ?? 0 },
      { key: 'h', label: 'H', value: t.H ?? 0 },
      { key: 'hr', label: 'HR', value: t.HR ?? 0, accent: (t.HR ?? 0) > 0 },
      { key: 'rbi', label: 'RBI', value: t.RBI ?? 0 },
      { key: 'bb', label: 'BB', value: t.BB ?? 0 },
      { key: 'so', label: 'SO', value: t.SO ?? 0 },
      { key: 'sb', label: 'SB', value: t.SB ?? 0 },
    ],
  }

  const gameLog: MatchListSection = {
    type: 'match_list',
    label: 'Game log',
    rows: games.map((g) => ({
      date: g.date_iso ?? g.date ?? '',
      opponent: g.venue === 'away' ? `@ ${g.opponent ?? ''}` : g.venue === 'home' ? `vs ${g.opponent ?? ''}` : g.opponent,
      fields: [
        { label: ' AB', value: g.AB ?? 0 },
        { label: ' H', value: g.H ?? 0 },
        ...(g.HR ? [{ label: ' HR', value: g.HR }] : []),
        ...(g.RBI ? [{ label: ' RBI', value: g.RBI }] : []),
        ...(g.BB ? [{ label: ' BB', value: g.BB }] : []),
        ...(g.SO ? [{ label: ' SO', value: g.SO }] : []),
      ],
    })),
  }

  const sections: ProfileSection[] = [totals, gameLog]

  if (staff) {
    const staffTable: StatTableSection = {
      type: 'stat_table',
      label: `vs ${staff.team} pitching staff`,
      columns: STAFF_TABLE_COLUMNS.map((c) => ({ key: c.key, label: c.label })),
      rows: staff.pitchers.map((p) => ({
        key: p.pitcher,
        label: p.pitcher,
        values: STAFF_TABLE_COLUMNS.map((c) => {
          const v = p[c.key]
          if (v == null) return '—'
          return c.key === 'AVG' || c.key === 'OBP' || c.key === 'SLG' || c.key === 'OPS' ? formatBattingAvg(v) : v
        }),
      })),
      totalsRow: {
        key: 'totals',
        label: 'Staff totals',
        values: STAFF_TABLE_COLUMNS.map((c) => {
          const v = staff.totals[c.key]
          if (v == null) return '—'
          return c.key === 'AVG' || c.key === 'OBP' || c.key === 'SLG' || c.key === 'OPS' ? formatBattingAvg(v) : v
        }),
      },
    }
    sections.push(staffTable)
  }

  return sections
}

export function H2hStaffOverlay({ open, onClose, payload }: H2hStaffOverlayProps) {
  if (!open || !payload) return null

  const q = payload.query ?? {}
  const playerLabel = q.player_display || q.player_query || 'player'
  const playerTeam = q.player_team || ''
  const opponent = q.opponent_code || ''
  const windowLabel = q.window_label || (q.year ? `(${q.year})` : '')
  const sections = buildSections(payload)

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
            {'{h2h -staff}'}
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

        <div className="px-5 py-3 flex-none" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="font-mono text-[15px] font-bold" style={{ color: C.textBright }}>
            {playerLabel}
          </span>
          {playerTeam && (
            <span className="font-mono text-[12px] ml-2" style={{ color: C.textDim }}>
              {playerTeam}
            </span>
          )}
          <span className="font-mono text-[13px]" style={{ color: C.textDim }}>
            {' vs '}
          </span>
          <span className="font-mono text-[15px] font-bold" style={{ color: C.accent }}>
            {opponent || '—'}
          </span>
          {windowLabel && (
            <span className="font-mono text-[12px] ml-2" style={{ color: C.textDim }}>
              {windowLabel}
            </span>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <SectionStack sections={sections} />
        </div>
      </div>
    </div>
  )
}
