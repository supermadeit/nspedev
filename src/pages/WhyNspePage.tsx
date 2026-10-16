// {why.nspe} — showcase/value-prop page (2026-10-16, owner ask). Different
// job from {sample-queries} (a literal reference list of runnable commands)
// and {learn.nspe} (instructional — how the syntax/assistant mechanically
// work): this one makes the case for why the underlying data access is
// different at all, aimed at a visitor who hasn't signed up yet.
//
// Layout per the owner's explicit spec: the homepage's starry background,
// with a solid-bordered panel holding all the text so the starfield only
// shows in the margins around it, not behind/distracting from the copy.
// Header/nav chrome inside the panel borrows PageShell's own pattern
// (nspe.dev home link + {pricing}/{account}) rather than reusing PageShell
// itself, since PageShell's shell has no starfield at all — this page needed
// its own wrapper, not a variant of that one.
//
// Copy is a first draft, not final — explicitly scoped that way by the
// owner ("we can refine the text as we move along"). Every example command
// shown is one already confirmed live this session (not invented for this
// page) except the skater-vs-goalie mention, which is clearly labeled
// "coming soon" since that syntax is still being built backend-side as of
// this writing — nothing here claims it's usable yet.
import { Link } from 'react-router-dom'
import { Starfield } from '@/components/Starfield'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  surface: 'oklch(0.10 0 0)',
  surface2: 'oklch(0.16 0 0)',
  border: 'oklch(0.26 0 0)',
  textDim: 'oklch(0.90 0 0)',
  textBright: 'oklch(0.92 0 0)',
}

interface Angle {
  title: string
  body: string
  example?: { label: string; command: string }
}

const ANGLES: Angle[] = [
  {
    title: 'Matchup & situational splits',
    body:
      'Primetime splits, which teams allow the most of a given stat, a batter against the opposing team’s current pitching staff, a skater against a specific goalie (coming soon) — the situational breakdowns a box score never shows.',
  },
  {
    title: 'Quarter & half-scoped search',
    body: 'Not just season totals — ask how a player performs in the first quarter, the first half, any period the game tracks.',
    example: { label: 'nba · 1h overview', command: 'nspe nba brunson 1h -pts20 -ov -last20' },
  },
  {
    title: 'Ask "how often," any stat, any window',
    body:
      'Pick a stat and a threshold, pick a window — last 10, last 20, a full career — and nspe counts exactly how often it happened. One shape, every sport — arguably the most useful command in the system.',
    example: { label: 'mlb · overview', command: 'nspe mlb judge -hr1 -ov -career' },
  },
  {
    title: 'Ask it like a person',
    body: 'Type a real question in plain English and the assistant reads it, runs the right command, and answers — no syntax required.',
    example: { label: 'ask the assistant', command: 'what team does luka doncic score the most against' },
  },
]

function AngleCard({ angle }: { angle: Angle }) {
  const { copied, copy } = useCopyToClipboard()
  return (
    <div className="rounded-lg p-4 flex flex-col" style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}>
      <div className="font-mono font-bold text-[14px] mb-1.5" style={{ color: C.accent }}>
        {angle.title}
      </div>
      <p className="font-mono text-[12.5px] leading-relaxed flex-1" style={{ color: C.textDim }}>
        {angle.body}
      </p>
      {angle.example && (
        <button
          type="button"
          onClick={() => copy(angle.example!.command)}
          className="mt-3 w-full text-left rounded px-3 py-2 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: C.surface, border: `1px solid ${copied ? C.green : C.border}` }}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: C.textDim }}>
              {angle.example.label}
            </span>
            <span className="font-mono text-[11px] flex-none" style={{ color: copied ? C.green : C.textDim }}>
              {copied ? '{copied}' : '{copy}'}
            </span>
          </div>
          <div className="font-mono text-[12px] whitespace-nowrap overflow-x-auto" style={{ color: C.textBright }}>
            {angle.example.command}
          </div>
        </button>
      )}
    </div>
  )
}

export default function WhyNspePage() {
  return (
    <div className="relative w-screen h-dvh overflow-y-auto" style={{ backgroundColor: 'oklch(0.06 0 0)' }}>
      <Starfield />
      <div className="relative z-10 min-h-full flex justify-center px-4 py-10 sm:py-16">
        <div
          className="w-full max-w-3xl rounded-xl p-6 sm:p-10 h-fit"
          style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        >
          <header
            className="flex items-center justify-between mb-10 pb-4"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <Link
              to="/"
              className="font-mono font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
              style={{ color: C.textBright }}
            >
              nspe.dev
            </Link>
            <nav className="flex items-center gap-4 text-[13px] font-mono font-bold">
              <Link to="/refill" className="underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
                {'{pricing}'}
              </Link>
              <Link to="/account" className="underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
                {'{account}'}
              </Link>
            </nav>
          </header>

          <div className="space-y-2 mb-8">
            <h1
              className="font-mono font-bold text-2xl sm:text-3xl tracking-tight"
              style={{ color: C.textBright }}
            >
              SEARCH STATS LIKE THE PROS
            </h1>
            <p className="font-mono text-[14px]" style={{ color: C.textDim }}>
              The kind of matchup detail teams and insiders actually use — now yours to search.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            {ANGLES.map((a) => (
              <AngleCard key={a.title} angle={a} />
            ))}
          </div>

          <div className="flex items-center gap-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <Link
              to="/signup"
              className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity"
              style={{ color: C.accent }}
            >
              {'{sign-up}'}
            </Link>
            <Link
              to="/"
              className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity"
              style={{ color: C.textDim }}
            >
              {'{try it free}'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
