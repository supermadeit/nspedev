// Presentational command-syntax suggestion list — the green sibling of
// PlayerSearchDropdown (which stays cyan/blue), per the design discussion
// this was built from: predicted players and predicted syntax need to read
// as visually distinct at a glance since they can both live under the same
// CLI input. Selecting a row fills the input with the full command text to
// edit and run manually — it never auto-runs, unlike player selection which
// navigates immediately.
import { C } from './QueryBuilder'
import type { SyntaxMatch } from '@/lib/syntaxSuggestions'

const GREEN = 'oklch(0.85 0.15 145)'
const GREEN_DARK = 'oklch(0.10 0.02 145)'

export interface SyntaxSuggestionDropdownProps {
  matches: SyntaxMatch[]
  activeIndex?: number
  onSelect: (command: string) => void
  onHoverIndex?: (index: number) => void
}

// Bold + green the matched prefix within the command, mirroring
// PlayerSearchDropdown's HighlightedName treatment (same idea, different
// accent color) so it's obvious why a row matched what was typed.
function HighlightedCommand({ command, prefix }: { command: string; prefix: string }) {
  const lower = command.toLowerCase()
  const idx = lower.indexOf(prefix.toLowerCase())
  if (!prefix || idx === -1) return <>{command}</>
  return (
    <>
      {command.slice(0, idx)}
      <span style={{ color: GREEN, fontWeight: 700 }}>{command.slice(idx, idx + prefix.length)}</span>
      {command.slice(idx + prefix.length)}
    </>
  )
}

export function SyntaxSuggestionDropdown({ matches, activeIndex = -1, onSelect, onHoverIndex }: SyntaxSuggestionDropdownProps) {
  if (matches.length === 0) return null

  return (
    <div
      className="flex flex-col rounded-lg border overflow-hidden"
      style={{ backgroundColor: C.surface2, borderColor: C.border }}
      role="listbox"
    >
      {matches.map((m, i) => (
        <button
          key={m.query.command}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => onHoverIndex?.(i)}
          onClick={() => onSelect(m.query.command)}
          className="flex flex-col gap-0.5 px-3 py-2 text-left font-mono transition-colors"
          style={{
            backgroundColor: i === activeIndex ? GREEN_DARK : 'transparent',
            borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
          }}
        >
          <span className="text-[9px] uppercase tracking-widest" style={{ color: C.textDim }}>
            {m.query.label}
          </span>
          <span className="text-[13px] truncate" style={{ color: C.textBright }}>
            <HighlightedCommand command={m.query.command} prefix={m.matchedPrefix} />
          </span>
        </button>
      ))}
    </div>
  )
}
