// Digit grid (0-9 + backspace + clear) for custom numeric entry. Only ever
// rendered as CalcNumSelect's "Other…" fallback — the preset dropdown is the
// primary/default input method, not this. See CalcNumSelect.tsx.
import { C } from './theme'

export interface NumpadProps {
  value: string
  onChange: (v: string) => void
  maxLength?: number
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']

export function Numpad({ value, onChange, maxLength = 5 }: NumpadProps) {
  const handlePress = (key: string) => {
    if (key === 'C') {
      onChange('')
      return
    }
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (value.length >= maxLength) return
    // Avoid leading zeros like "007" while still allowing a bare "0".
    const next = value === '0' ? key : value + key
    onChange(next.replace(/^0+(?=\d)/, ''))
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {DIGITS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handlePress(key)}
          className="font-mono text-[18px] rounded-xl border min-h-[52px] select-none"
          style={{
            backgroundColor: C.surface2,
            color: key === 'C' || key === '⌫' ? C.textDim : C.textBright,
            borderColor: C.border,
          }}
        >
          {key}
        </button>
      ))}
    </div>
  )
}
