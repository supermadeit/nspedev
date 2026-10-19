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
// STATUS (2026-10-19): /account/api-key, /plans and /mcp are confirmed live
// (curl'd directly — GET /plans returns the real catalog, POST /mcp without
// a key 401s, GET /mcp 405s, GET /account/api-key without auth 401s). The
// signed-in create/rotate/revoke round trip and a real run_nspe call with a
// freshly-minted key still need an actual logged-in browser session to
// verify, which this agent has no way to produce (no test credentials in
// this repo) — that part is still unverified pending someone with a real
// account clicking through it.
import { useEffect, useState } from 'react'
import { PageShell } from './PageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getApiKey, createOrRotateApiKey, revokeApiKey, type ApiKeyInfo } from '@/lib/apiKey'
import { fetchPlansCatalog } from '@/lib/plans'

const MCP_URL = 'https://api.nspe.dev/mcp'
const KEY_PLACEHOLDER = 'nspe_YOUR_KEY'

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

type KeyState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'none' }
  | { status: 'masked'; info: ApiKeyInfo }
  | { status: 'revealed'; raw: string; prefix: string; created_at: string; rotated: boolean }

function ApiKeyCard({ onKeyRevealed }: { onKeyRevealed: (key: string) => void }) {
  const [state, setState] = useState<KeyState>({ status: 'loading' })
  const [confirmingRotate, setConfirmingRotate] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setState({ status: 'loading' })
    getApiKey()
      .then((info) => setState(info ? { status: 'masked', info } : { status: 'none' }))
      .catch((e) => setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load your key.' }))
  }

  useEffect(load, [])

  async function handleCreateOrRotate() {
    setBusy(true)
    setConfirmingRotate(false)
    try {
      const result = await createOrRotateApiKey()
      setState({ status: 'revealed', raw: result.api_key, prefix: result.key_prefix, created_at: result.created_at, rotated: result.rotated })
      onKeyRevealed(result.api_key)
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not create a key.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke() {
    setBusy(true)
    try {
      await revokeApiKey()
      setState({ status: 'none' })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not revoke your key.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-neutral-800 bg-neutral-950">
      <CardHeader>
        <CardTitle>Your API key</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === 'loading' && (
          <div className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>loading…</div>
        )}

        {state.status === 'error' && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ border: '1px solid oklch(0.6 0.2 25)', color: 'oklch(0.85 0.15 25)' }}>
            {state.message}
            <button type="button" onClick={load} className="ml-2 underline" style={{ color: 'oklch(0.85 0.15 195)' }}>
              retry
            </button>
          </div>
        )}

        {state.status === 'none' && (
          <>
            <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>No active key yet.</p>
            <Button onClick={handleCreateOrRotate} disabled={busy}>
              {busy ? 'Creating…' : 'Create key'}
            </Button>
          </>
        )}

        {state.status === 'masked' && (
          <>
            <div className="font-mono text-sm" style={{ color: 'oklch(0.90 0 0)' }}>
              {state.info.key_prefix}••••••••
            </div>
            <div className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>
              created {new Date(state.info.created_at).toLocaleDateString()}
              {state.info.last_used ? ` · last used ${new Date(state.info.last_used).toLocaleDateString()}` : ' · never used'}
            </div>
            {!confirmingRotate ? (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setConfirmingRotate(true)} disabled={busy}>
                  Rotate key
                </Button>
                <Button variant="secondary" onClick={handleRevoke} disabled={busy}>
                  Revoke
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg px-4 py-3" style={{ border: '1px solid oklch(0.6 0.2 25)' }}>
                <p className="text-sm" style={{ color: 'oklch(0.85 0.15 25)' }}>
                  Your current key stops working immediately — anything using it (Claude Code, Desktop, etc.) will need the new one.
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleCreateOrRotate} disabled={busy}>
                    {busy ? 'Rotating…' : 'Yes, rotate'}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingRotate(false)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {state.status === 'revealed' && (
          <>
            <p className="text-sm font-semibold" style={{ color: 'oklch(0.78 0.18 145)' }}>
              {state.rotated ? 'New key created — your old one no longer works.' : 'Key created.'}
            </p>
            <CopyBlock text={state.raw} />
            <p className="text-xs" style={{ color: 'oklch(0.70 0 0)' }}>
              You won't see this again — copy it now and drop it into the setup below. We only keep a
              one-way hash, so even we can't show it to you a second time.
            </p>
            <Button
              variant="secondary"
              onClick={() => setState({ status: 'masked', info: { key_prefix: state.prefix, created_at: state.created_at, last_used: null } })}
            >
              Done, hide it
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function ConnectClaudePage() {
  // Config snippets below drop in the real key right after it's minted
  // (one-time reveal), falling back to a placeholder the rest of the time —
  // no reason to make someone retype it by hand if we already have it.
  const [liveKey, setLiveKey] = useState<string | null>(null)
  const key = liveKey ?? KEY_PLACEHOLDER

  // The free tier's actual daily caps, pulled from the same /plans catalog
  // /refill uses — backend's ask (2026-10-19): the free allowances belong
  // here as the "try it first" line, not on /refill (that page is for
  // paying). Null until loaded; falls back to generic wording rather than
  // blocking the page on this one fetch.
  const [freeCaps, setFreeCaps] = useState<{ questionsDay: number; callsDay: number } | null>(null)
  useEffect(() => {
    fetchPlansCatalog()
      .then((catalog) => {
        const free = catalog.plans.find((p) => p.slug === 'free')
        if (free && free.connect_calls_day != null) {
          setFreeCaps({ questionsDay: free.free_questions_day, callsDay: free.connect_calls_day })
        }
      })
      .catch(() => {
        // Generic fallback copy below covers this — not worth an error banner
        // for a single descriptive line.
      })
  }, [])

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
            {freeCaps
              ? `Every plan can try this, including free — ${freeCaps.questionsDay} questions a day on the site, ${freeCaps.callsDay} connected calls a day from your own Claude. A paid tier raises that cap rather than unlocking the feature itself.`
              : 'Every plan can try this, including free — connected calls share the same daily cap your account already has; a paid tier raises that cap rather than unlocking the feature itself.'}
          </p>
          <p style={{ color: 'oklch(0.70 0 0)' }}>
            Four tools once connected: run any builder command (e.g. <code>nspe nhl mackinnon -pts2 -ov -season</code>),
            player search, the per-sport syntax cheat sheet, and team.metrics. A few owner-only commands
            politely decline for everyone else.
          </p>
        </CardContent>
      </Card>

      <ApiKeyCard onKeyRevealed={setLiveKey} />

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Claude Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>One command, native HTTP transport:</p>
          <CopyBlock text={`claude mcp add --transport http nspe ${MCP_URL} --header "X-API-Key: ${key}"`} />
          <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>
            Then in any session: "ask nspe how many 300-yard games Mahomes has this season."
          </p>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Claude Desktop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>
            Settings → Developer → Edit Config (<code>claude_desktop_config.json</code>). Needs Node installed:
          </p>
          <CopyBlock
            text={`{
  "mcpServers": {
    "nspe": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${MCP_URL}", "--header", "X-API-Key:\${NSPE_API_KEY}"],
      "env": { "NSPE_API_KEY": "${key}" }
    }
  }
}`}
          />
          <p className="text-xs" style={{ color: 'oklch(0.55 0 0)' }}>
            The env-var indirection is on purpose — the header value can't contain a space otherwise.
          </p>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>claude.ai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>
            Coming soon — claude.ai's custom connectors currently only support OAuth, not a static key.
            Claude Code and Desktop both work today.
          </p>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Other MCP clients (Cursor, etc.)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" style={{ color: 'oklch(0.70 0 0)' }}>
            Server type <code>streamable-http</code>, URL and header below:
          </p>
          <CopyBlock text={`${MCP_URL}\nX-API-Key: ${key}`} />
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
