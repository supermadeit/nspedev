// Presentational player-search results list. Purely a renderer for
// `PlayerMatch[]` from `lib/playerSearch.ts` — it doesn't own an input or
// decide when to search, so both desktop's CLI (as a dropdown anchored
// under the input) and mobile's dedicated search field (however it chooses
// to lay it out) can mount this same component and just wire their own
// input's onChange/onKeyDown into `searchPlayers()` + keyboard nav.
import { C } from './QueryBuilder'
import type { PlayerIndexEntry, PlayerMatch } from '@/lib/playerSearch'

export interface PlayerSearchDropdownProps {
  matches: PlayerMatch[]
  activeIndex?: number
  onSelect: (entry: PlayerIndexEntry) => void
  onHoverIndex?: (index: number) => void
  emptyMessage?: string
}

// Bold + accent-color the matched prefix within the name, so it's visually
// obvious *why* a row matched what was typed (matters most once two names
// share a prefix, e.g. "Jo" -> "Jordan Love" / "Joe Burrow").
function HighlightedName({ name, prefix }: { name: string; prefix: string }) {
  const lower = name.toLowerCase()
  const idx = lower.indexOf(prefix.toLowerCase())
  if (!prefix || idx === -1) return <>{name}</>
  return (
    <>
      {name.slice(0, idx)}
      <span style={{ color: C.accent, fontWeight: 700 }}>{name.slice(idx, idx + prefix.length)}</span>
      {name.slice(idx + prefix.length)}
    </>
  )
}

export function PlayerSearchDropdown({
  matches,
  activeIndex = -1,
  onSelect,
  onHoverIndex,
  emptyMessage,
}: PlayerSearchDropdownProps) {
  if (matches.length === 0) {
    if (!emptyMessage) return null
    return (
      <div
        className="font-mono text-[12px] px-3 py-2.5 rounded-lg border"
        style={{ backgroundColor: C.surface2, borderColor: C.border, color: C.textDim }}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className="flex flex-col rounded-lg border overflow-hidden"
      style={{ backgroundColor: C.surface2, borderColor: C.border }}
      role="listbox"
    >
      {matches.map((m, i) => (
        <button
          key={m.entry.slug}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => onHoverIndex?.(i)}
          onClick={() => onSelect(m.entry)}
          className="flex items-center justify-between gap-3 px-3 py-2 text-left font-mono text-[13px] transition-colors"
          style={{
            backgroundColor: i === activeIndex ? C.accentDark : 'transparent',
            color: C.textBright,
            borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
          }}
        >
          <span className="truncate">
            <HighlightedName name={m.entry.name} prefix={m.matchedPrefix} />
          </span>
          <span className="font-mono text-[10px] flex-none" style={{ color: C.textDim }}>
            {m.entry.position} · {m.entry.team}
          </span>
        </button>
      ))}
    </div>
  )
}
