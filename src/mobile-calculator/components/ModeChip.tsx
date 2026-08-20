// Top mode-chip row (trend / compute / explosive / team / h2h). All chips
// share the single cyan accent when selected EXCEPT explosive, which takes
// `variant="explosive"` and resolves to the muted `explosiveAccent` instead
// — it should read as present but toned-down, not equally loud as the rest.
import { C, explosiveAccent } from './theme'

export interface ModeChipProps {
  children: string
  selected: boolean
  onClick: () => void
  variant?: 'accent' | 'explosive'
}

export function ModeChip({ children, selected, onClick, variant = 'accent' }: ModeChipProps) {
  const accentColor = variant === 'explosive' ? explosiveAccent : C.accent
  const textColor = variant === 'explosive' ? 'oklch(0.98 0 0)' : C.accentDark

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-[64px] py-2.5 text-[11px] font-bold rounded-lg border uppercase tracking-wider transition-colors select-none"
      style={{
        backgroundColor: selected ? accentColor : C.surface2,
        color: selected ? textColor : variant === 'explosive' ? explosiveAccent : C.accentDim,
        borderColor: selected ? accentColor : C.border,
      }}
    >
      {children}
    </button>
  )
}
