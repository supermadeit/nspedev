// Mobile preset selector: shows a horizontal row of preset-value CalcButtons
// by default (dropdown-first UX, mirroring QueryBuilder.tsx's NumSelect
// preset+custom-fallback pattern) and only reveals the <Numpad/> when the
// user taps "Other…" — the numpad is a fallback, never the primary input.
import { useState } from 'react'
import { CalcButton } from './CalcButton'
import { Numpad } from './Numpad'
import { C } from './theme'

export interface CalcNumSelectProps {
  value: string
  onChange: (v: string) => void
  options: number[]
  /** Label shown above the "Other…" custom entry field, e.g. "single play ≥". */
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
  const [showCustom, setShowCustom] = useState(isCustomValue)

  if (showCustom) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.textDim }}>
              {label}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setShowCustom(false)
              onChange('')
            }}
            className="font-mono text-[10px] px-2 py-1 rounded border"
            style={{ backgroundColor: C.surface2, borderColor: C.border, color: C.textDim }}
          >
            back to presets
          </button>
        </div>
        <div
          className="font-mono text-[20px] text-center mb-2 rounded border py-2"
          style={{ backgroundColor: 'oklch(0.10 0 0)', borderColor: C.border, color: accentColor ?? C.accent }}
        >
          {value || '—'}
        </div>
        <Numpad value={value} onChange={onChange} />
      </div>
    )
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((n) => (
        <CalcButton
          key={n}
          selected={String(n) === value}
          onClick={() => onChange(String(n))}
          accentColor={accentColor}
          accentTextColor={accentTextColor}
          className="min-w-[58px] min-h-[48px] flex-none px-3"
        >
          {n}
        </CalcButton>
      ))}
      <CalcButton
        selected={isCustomValue}
        onClick={() => setShowCustom(true)}
        accentColor={accentColor}
        accentTextColor={accentTextColor}
        className="min-w-[70px] min-h-[48px] flex-none px-3 text-[12px]"
      >
        {isCustomValue ? value : 'Other…'}
      </CalcButton>
    </div>
  )
}
