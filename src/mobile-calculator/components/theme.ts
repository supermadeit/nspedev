// Shared design tokens for the mobile calculator UI. Re-exports desktop's
// `C` (single source of truth for the cyan accent + neutrals) and adds
// `explosiveAccent` — a desaturated, darker green used ONLY for the
// `explosive` mode chip's selected state. It must read as "present but
// toned down," not as a third fully-saturated accent color competing with
// cyan — do not reuse this for anything else, and do not brighten it to
// match the other accents.
import { C } from '@/components/QueryBuilder'

export { C }

export const explosiveAccent = 'oklch(0.55 0.08 145)'
export const explosiveAccentDim = 'oklch(0.32 0.05 145)'
