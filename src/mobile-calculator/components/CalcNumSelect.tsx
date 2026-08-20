// Mobile preset selector: CLOSED by default (a single compact button showing
// the current value, or a placeholder), same width as everything else on
// screen — tapping it opens either the preset grid or, if the current value
// is already custom, straight back into the numpad. Selecting a preset
// auto-collapses. The open preset grid is height-capped and scrolls instead
// of pushing the rest of the screen down, since a long option list
// (WINDOW_LAST_PRESETS etc.) shouldn't dominate a screen this size.
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

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setCustomEntry(isCustomValue)
          setExpanded(true)
        }}
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
    )
  }

  if (customEntry) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.textDim }}>
            {label ?? 'custom value'}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="font-mono text-[10px] px-2 py-1 rounded border"
            style={{ backgroundColor: C.surface2, borderColor: C.border, color: accent }}
          >
            done ✓
          </button>
        </div>
        <div
          className="font-mono text-[20px] text-center mb-2 rounded border py-2"
          style={{ backgroundColor: 'oklch(0.10 0 0)', borderColor: C.border, color: accent }}
        >
          {value || '—'}
        </div>
        <Numpad value={value} onChange={onChange} />
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-2" style={{ borderColor: C.border, backgroundColor: 'oklch(0.10 0 0)' }}>
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: C.textDim }}>
          select
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="font-mono text-[10px]"
          style={{ color: C.textDim }}
        >
          close ✕
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 max-h-[124px] overflow-y-auto pr-0.5">
        {options.map((n) => (
          <CalcButton
            key={n}
            selected={String(n) === value}
            onClick={() => {
              onChange(String(n))
              setExpanded(false)
            }}
            accentColor={accentColor}
            accentTextColor={accentTextColor}
            className="w-full min-h-[40px] text-[13px]"
          >
            {n}
          </CalcButton>
        ))}
        <CalcButton
          selected={isCustomValue}
          onClick={() => setCustomEntry(true)}
          accentColor={accentColor}
          accentTextColor={accentTextColor}
          className="w-full min-h-[40px] text-[11px]"
        >
          Other…
        </CalcButton>
      </div>
    </div>
  )
}
