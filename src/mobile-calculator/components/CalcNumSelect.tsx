// Mobile preset selector. The closed pill is always in normal document
// flow, at its original small size, unchanged whether or not it's expanded
// — layout never shifts. Tapping it opens a bottom-sheet OVERLAY (fixed to
// the viewport, ~22% of screen height, with a tap-to-close backdrop) rather
// than expanding inline — the old inline-expand pushed everything below it
// down the page, which meant the sheet itself could end up needing a
// scroll to reach. The overlay is shared by both sub-states: the preset
// grid, and (via "Other…") the numpad fallback.
import { useState } from 'react'
import { CalcButton } from './CalcButton'
import { Numpad } from './Numpad'
import { C } from './theme'

export interface CalcNumSelectProps {
  value: string
  onChange: (v: string) => void
  options: number[]
  /** Label shown above the custom-entry numpad, e.g. "single play ≥". */
  label?: string
  accentColor?: string
  accentTextColor?: string
}

// Preset grid is short enough at 22vh (small list, rarely needs its own
// scroll). The numpad needs real room — 4 digit rows plus the value
// readout don't fit in 22vh without an inner scroll of their own, which
// defeats the point of the sheet. ~50vh reaches roughly to where "min
// value" sits on the builder screen behind it.
const PRESET_SHEET_HEIGHT = '22vh'
const NUMPAD_SHEET_HEIGHT = '50vh'
const SHEET_MIN_HEIGHT = '210px'
const NUMPAD_SHEET_MIN_HEIGHT = '380px'

export function CalcNumSelect({
  value,
  onChange,
  options,
  label,
  accentColor,
  accentTextColor,
}: CalcNumSelectProps) {
  const isCustomValue = value !== '' && !options.includes(Number(value))
  const [expanded, setExpanded] = useState(false)
  const [customEntry, setCustomEntry] = useState(false)

  const accent = accentColor ?? C.accent
  const accentText = accentTextColor ?? C.accentDark

  const close = () => setExpanded(false)
  const open = () => {
    setCustomEntry(isCustomValue)
    setExpanded(true)
  }

  return (
    <>
      {/* Closed pill — same size/position whether or not the sheet is open. */}
      <button
        type="button"
        onClick={open}
        className="w-full flex items-center justify-between font-mono text-[15px] rounded-xl border px-4 min-h-[48px]"
        style={{
          backgroundColor: value ? accent : C.surface2,
          color: value ? accentText : C.textDim,
          borderColor: value ? accent : C.border,
          fontWeight: value ? 700 : 500,
        }}
      >
        <span>{value || 'select'}</span>
        <span style={{ opacity: 0.6, fontWeight: 400 }}>▾</span>
      </button>

      {expanded && (
        <>
          <div
            className="fixed inset-0 z-[55]"
            style={{ backgroundColor: 'oklch(0 0 0 / 0.55)' }}
            onClick={close}
            aria-hidden="true"
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[60] flex flex-col px-3 pt-3"
            style={{
              height: customEntry ? NUMPAD_SHEET_HEIGHT : PRESET_SHEET_HEIGHT,
              minHeight: customEntry ? NUMPAD_SHEET_MIN_HEIGHT : SHEET_MIN_HEIGHT,
              backgroundColor: 'oklch(0.12 0 0)',
              borderTop: `1px solid ${C.border}`,
              borderTopLeftRadius: '18px',
              borderTopRightRadius: '18px',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            }}
          >
            {customEntry ? (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between mb-2 flex-none">
                  <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.textDim }}>
                    {label ?? 'custom value'}
                  </span>
                  <button
                    type="button"
                    onClick={close}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded border"
                    style={{ backgroundColor: C.surface2, borderColor: C.border, color: accent }}
                  >
                    done ✓
                  </button>
                </div>
                <div
                  className="font-mono text-[22px] text-center mb-2 rounded border py-2 flex-none"
                  style={{ backgroundColor: 'oklch(0.10 0 0)', borderColor: C.border, color: accent }}
                >
                  {value || '—'}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <Numpad value={value} onChange={onChange} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between mb-2 flex-none">
                  <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.textDim }}>
                    select
                  </span>
                  <button
                    type="button"
                    onClick={close}
                    className="font-mono text-[11px] px-2.5 py-1.5 rounded border"
                    style={{ backgroundColor: C.surface2, borderColor: C.border, color: C.textDim }}
                  >
                    close ✕
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-4 gap-2 content-start pb-1">
                  {options.map((n) => (
                    <CalcButton
                      key={n}
                      selected={String(n) === value}
                      onClick={() => {
                        onChange(String(n))
                        close()
                      }}
                      accentColor={accentColor}
                      accentTextColor={accentTextColor}
                      rounded="rounded-md"
                      className="w-full min-h-[56px] text-[16px]"
                    >
                      {n}
                    </CalcButton>
                  ))}
                  <CalcButton
                    selected={isCustomValue}
                    onClick={() => setCustomEntry(true)}
                    accentColor={accentColor}
                    accentTextColor={accentTextColor}
                    rounded="rounded-md"
                    className="w-full min-h-[56px] text-[12px]"
                  >
                    Other…
                  </CalcButton>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
