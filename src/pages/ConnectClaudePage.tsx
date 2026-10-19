// {b.y.o.c} — "Connect your Claude." nspe as an MCP server for the user's
// OWN Claude (Desktop/Code/claude.ai), rather than nspe hosting the model
// itself. Owner framing (2026-10-19), load-bearing for the copy below: a
// visitor already paying for Claude isn't paying nspe for AI usage a second
// time by connecting — what their nspe plan/tier controls is how much of
// nspe's own data/tools (team.metrics, power.rankings, leaderboard, and
// more as those commercialize) their Claude gets to call.
//
// Open to every signed-in tier, not just paying ones (free users can try it
// against their 20/day cap, per backend) — just needs a session, same bar
// as /account, not a plan-gated route.
//
// The API key box is deliberately NOT wired to a live fetch yet — there's
// no account-API-key endpoint anywhere in this codebase to call, and
// backend's own description of "the existing one-active-key flow" doesn't
// give an actual contract (path/method/shape) to build against. Rather than
// guess one and ship a broken fetch, this holds that one piece as a visible
// placeholder until backend confirms it — same "don't wire it until it's
// confirmed" pattern used elsewhere this build (see TeamMetricsPage's held
// last-N constant). Everything else below (the value-prop copy, the three
// client setup snippets) doesn't depend on that and is real/live now.
import { useState } from 'react'
import { PageShell } from './PageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const MCP_URL = 'https://api.nspe.dev/mcp'

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative">
      <pre
        className="whitespace-pre-wrap break-all rounded-lg px-4 py-3 text-[12px] leading-relaxed"
        style={{ backgroundColor: 'oklch(0.08 0 0)', border: '1px solid oklch(0.25 0 0)', color: 'oklch(0.90 0 0)' }}
      >
        {text}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          } catch {
            // Clipboard API unavailable — the block itself is selectable text,
            // so a manual copy still works.
          }
        }}
        className="absolute top-2 right-2 font-mono text-[10px] underline hover:opacity-80 transition-opacity"
        style={{ color: 'oklch(0.85 0.15 195)' }}
      >
        {copied ? 'copied ✓' : 'copy'}
      </button>
    </div>
  )
}

export default function ConnectClaudePage() {
  return (
    <PageShell
      title="Connect your Claude"
      subtitle="Plug nspe's data and tools into the Claude you already use — you don't pay nspe for AI usage to do it."
      maxWidth="max-w-2xl"
    >
      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>How this works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm" style={{ color: 'oklch(0.90 0 0)' }}>
          <p>
            Connecting doesn't put AI usage on your nspe bill — you're already paying for your own Claude
            access (or using the free tier of it), and that's what answers your questions once connected.
            What your nspe plan/tier controls is which of nspe's own tools and how much of its knowledge
            base your Claude is allowed to call — right now that's {'{team.metrics}'}, and more as other
            features (power rankings, leaderboard, and whatever else we commercialize) open up to this
            over time.
          </p>
          <p style={{ color: 'oklch(0.70 0 0)' }}>
            Every plan can try this, including free — connected calls share the same daily cap your account
            already has; a paid tier raises that cap rather than unlocking the feature itself.
          </p>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Your API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Held pending backend's actual key-issuance contract — see file
              header comment. Not a loading spinner (there's nothing in
              flight to wait on) and not an error (nothing's broken) — a
              plain "not wired up yet" state. */}
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ border: '1px dashed oklch(0.35 0 0)', color: 'oklch(0.70 0 0)' }}
          >
            Key generation is being finalized on our end — check back shortly and your key will show up
            here. Once it does, drop it into the <code>&lt;YOUR_NSPE_API_KEY&gt;</code> placeholder in any
            of the setups below.
          </div>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Claude Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>
            Add nspe as a project-level MCP server (<code>.mcp.json</code> at your project root), or run the
            equivalent <code>claude mcp add</code> command:
          </p>
          <CopyBlock
            text={`{
  "mcpServers": {
    "nspe": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": {
        "X-API-Key": "<YOUR_NSPE_API_KEY>"
      }
    }
  }
}`}
          />
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Claude Desktop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>
            Settings → Connectors → Add custom connector. Name it <code>nspe</code>, paste the URL below,
            and add the header with your key:
          </p>
          <CopyBlock text={MCP_URL} />
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>
            Header: <code>X-API-Key: &lt;YOUR_NSPE_API_KEY&gt;</code>
          </p>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>claude.ai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>
            Settings → Connectors → Add custom connector — same URL and header as Claude Desktop above.
          </p>
          <CopyBlock text={MCP_URL} />
        </CardContent>
      </Card>

      <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>
        Exact menu names may shift slightly as Claude's own connector settings evolve — this page will stay
        current.
      </p>

      <Button asChild variant="secondary">
        <a href="/account">Back to account</a>
      </Button>
    </PageShell>
  )
}
