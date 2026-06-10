# Agent guardrails — hard blocks on production actions

**Purpose:** make it *impossible* — not merely discouraged — for an AI coding
agent (Claude Code) to run production-mutating or irreversible commands in this
project. Deploys, remote-database writes, secret changes, and `git push` are
human-operator actions. This replaces "the agent is instructed not to" (soft,
defeasible by model judgment) with "the harness refuses to run it" (hard).

Created 2026-06-09 after the agent ran `pnpm deploy:cf` against production when
it should have prepped the deploy and handed off.

---

## Why hooks, not instructions or permissions

Three layers exist in Claude Code, in increasing order of strength:

1. **Memory / CLAUDE.md / system rules** — the agent *chooses* to follow them.
   A persuasive in-the-moment instruction ("let's push and deploy") can be
   read as an override. This is what failed.

2. **`permissions.deny` in settings.json** — the harness pattern-matches the
   command and denies it. Stronger, but Bash matching is prefix/glob-based and
   can be evaded by compound commands (`cd x && pnpm deploy:cf`), env-var
   prefixes, or `pnpm run` vs `pnpm` forms. Useful as a first layer; not
   airtight on its own.

3. **`PreToolUse` hook** — the harness runs a script *before every matching
   tool call*, passing the full command on stdin. The script inspects the
   real command string and can block with exit code 2. **This is the only
   layer that is 100%**, for two reasons:
   - It sees the *entire* normalized command, so compound/obfuscated forms
     don't evade it.
   - **Hooks fire even in `accept-edits` / `--dangerously-skip-permissions`
     (bypass) mode.** Bypass mode skips permission *prompts*; it does **not**
     skip hooks. So there is no agent setting that turns this off.

This project uses layer 3 (the robust block) and recommends adding layer 2 as
cheap defense-in-depth.

---

## What gets blocked

`/.claude/hooks/block-prod-actions.sh` (matcher: `Bash`) blocks:

| Class | Example commands blocked |
|---|---|
| Cloudflare deploy | `wrangler deploy`, `opennextjs-cloudflare deploy`, `pnpm deploy:cf`, `pnpm run deploy`, `bun deploy:cf` |
| Cloudflare secrets/resources | `wrangler secret put/delete/bulk`, `wrangler kv/r2/d1/queues … create/delete` |
| Remote DB writes | `supabase db push`, `supabase db reset --linked`, `supabase migration up --linked`, `supabase link` |
| Version control push | `git push …` |

**Intentionally allowed** (local / non-destructive, the agent needs these):

- `supabase db reset` *without* `--linked` — resets the **local** dev DB only
- `pnpm build:cf` — builds the worker bundle; does not deploy
- `pnpm vitest run`, `pnpm tsc`, `pnpm lint`, `git commit`, `git status`
- `pnpm query:prod …` — read-only (the `agent_reader` Postgres role is
  SELECT-only at the database level, so reads are safe to allow)

`/.claude/hooks/protect-guardrails.sh` (matcher: `Write|Edit|MultiEdit`) blocks
the agent from editing the hook scripts or the settings files themselves — so
the agent can't disable its own guardrail and then proceed.

---

## Files

```
.claude/hooks/block-prod-actions.sh   # denylist (Bash PreToolUse)
.claude/hooks/protect-guardrails.sh   # anti-tamper (Write/Edit PreToolUse)
```

Both are committed, version-controlled, and self-tested (see "Verify" below).

---

## Activation — wire the hooks into settings

The hooks are inert until referenced from a settings file. **You should do this
step yourself** — the agent is intentionally not wiring in its own restraints,
and placement matters (see "Make it tamper-resistant").

### Option A — project settings (team-shared, version-controlled)

Add to `.claude/settings.json` (create it if absent):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-prod-actions.sh" }
        ]
      },
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-guardrails.sh" }
        ]
      }
    ]
  }
}
```

`$CLAUDE_PROJECT_DIR` is set by Claude Code to the project root for hook
commands.

### Option B — user settings (strongest; survives across projects)

Put the same `hooks` block in `~/.claude/settings.json` and copy the scripts to
`~/.claude/hooks/`, referencing them by absolute path
(`/Users/<you>/.claude/hooks/block-prod-actions.sh`). Because the agent works
inside the project tree, it is far less likely to ever touch `~/.claude`, and
the protection follows you into every project.

You can run both A and B together — hooks are additive.

---

## Make it tamper-resistant

A determined agent in a project-only setup could, in principle, edit
`.claude/settings.json` to remove the hook. Three mitigations, strongest last:

1. **`protect-guardrails.sh`** (included) blocks the agent from editing the hook
   scripts and `settings.json` / `settings.local.json` via the Write/Edit tools.
2. **Put the hooks in `~/.claude/settings.json`** (Option B) — outside the
   project the agent operates in.
3. **OS-level:** `chmod 0444` the settings file, or make it root-owned. The
   harness only needs to *read* it. This is the only mitigation the agent
   genuinely cannot undo (it lacks the privilege), and is the closest thing to
   a true 100% lock.

For this project: Option A + `protect-guardrails.sh` is enough for day-to-day.
Add Option B or the chmod if you want belt-and-suspenders.

---

## Optional layer 2 — `permissions.deny`

Cheap complementary denylist in the same `settings.json`. Not airtight (see
"Why hooks"), but it produces a cleaner denial for the obvious forms:

```json
{
  "permissions": {
    "deny": [
      "Bash(pnpm deploy:cf:*)",
      "Bash(pnpm run deploy:*)",
      "Bash(wrangler deploy:*)",
      "Bash(npx opennextjs-cloudflare deploy:*)",
      "Bash(supabase db push:*)",
      "Bash(git push:*)"
    ]
  }
}
```

---

## Verify

After wiring the hooks in, confirm in a live session by asking the agent to run
`pnpm deploy:cf` — it should be refused before executing, with the
`🚫 BLOCKED` message.

You can also test the scripts directly without a session:

```bash
# Should print 🚫 BLOCKED and exit 2:
echo '{"tool_input":{"command":"pnpm deploy:cf"}}' | .claude/hooks/block-prod-actions.sh; echo "exit=$?"

# Should be silent and exit 0:
echo '{"tool_input":{"command":"pnpm build:cf"}}' | .claude/hooks/block-prod-actions.sh; echo "exit=$?"

# Anti-tamper — should exit 2:
echo '{"tool_input":{"file_path":".claude/settings.json"}}' | .claude/hooks/protect-guardrails.sh; echo "exit=$?"
```

Verified passing at creation (2026-06-09): all deploy / `db push` /
`db reset --linked` / `git push` / `wrangler secret` forms block; local
`supabase db reset`, `build:cf`, tests, and `git commit` pass through; the
compound form `cd /tmp && pnpm run deploy:cf` is also caught.

---

## Adjusting the denylist

Edit the `check '<regex>' '<label>'` lines at the bottom of
`block-prod-actions.sh`. Patterns are case-insensitive extended regex matched
against the whitespace-normalized command string. To **stop** blocking `git
push` (e.g. if you later want the agent to push but never deploy), delete its
`check` line. To add a new blocked command, add a `check` line.

---

## Limitations (honest)

- A hook can only block tools the harness routes through it. These hooks cover
  `Bash`, `Write`, `Edit`, `MultiEdit`. If a future deploy path used a
  different tool (e.g. a deploy MCP server), add a matcher for it.
- If the scripts are deleted/renamed or made non-executable, the matching hook
  silently stops applying. `protect-guardrails.sh` defends the scripts from the
  *agent's* file tools; the OS-level chmod (mitigation 3) defends against
  everything else.
- This does not restrict *you*. It only constrains the agent's tool calls.
