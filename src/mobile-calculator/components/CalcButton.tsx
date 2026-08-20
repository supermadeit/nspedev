// Rectangular grid button primitive used for category/stat/modifier
// selection throughout the calculator builder screen.
//
// GUARDRAIL: `selected` MUST be derived from controlled parent state (the
// same model QueryBuilder.tsx's `Pill` uses — `someValue === thisValue`),
// never from transient `onMouseDown`/`onTouchStart`/`onPointerDown` visual
// state. A real calculator's digit buttons flash momentarily on press; this
// button does NOT — it stays highlighted until the parent state changes
// (e.g. NFL's category + type buttons must both stay visibly selected
// simultaneously, all the way through picking a threshold and window, up
// until the query actually runs). Implementing this with press/release
// state instead of controlled `selected` will silently break that
// requirement, so don't do it.
//
// SIZING: `className`, when passed, REPLACES the default sizing classes
// entirely (not just appends) — so a caller that wants a non-full-width
// button (e.g. a flex-wrap chip) must be explicit and NOT rely on any
// default leaking through. If a custom className needs the button to still
// fill its grid cell, include `w-full` in it explicitly.
import type { ReactNode } from 'react'
import { C } from './theme'

export interface CalcButtonProps {
  children: ReactNode
  selected: boolean
  onClick: () => void
  disabled?: boolean
  /** Accent color to use when selected. Defaults to the shared cyan accent —
   * override only for the explosive mode's muted variant. */
  accentColor?: string
  accentTextColor?: string
  className?: string
  /** Corner radius class. Defaults to the standard rounded-xl look used
   * everywhere else — override only where a flatter, more rectangular look
   * is specifically wanted (e.g. the numeric preset grid in CalcNumSelect). */
  rounded?: string
}

export function CalcButton({
  children,
  selected,
  onClick,
  disabled,
  accentColor = C.accent,
  accentTextColor = C.accentDark,
  className = '',
  rounded = 'rounded-xl',
}: CalcButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`font-mono ${rounded} border select-none transition-colors ${className || 'w-full text-[15px] px-2 min-h-[52px]'}`}
      style={{
        backgroundColor: selected ? accentColor : C.surface2,
        color: selected ? accentTextColor : disabled ? C.textDim : C.textBright,
        borderColor: selected ? accentColor : C.border,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: selected ? 700 : 500,
      }}
    >
      {children}
    </button>
  )
}
