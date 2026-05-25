# Agent Read-Only Production Access — Setup

One-time setup that gives agents two capabilities:

1. **Direct read** against production: `pnpm query:prod "<sql>"`
2. **Snapshot prod → local**: `pnpm sync:prod-to-local`

**Both are one-way by Postgres-role construction.** The `agent_reader` role has `SELECT`-only on the `public` schema. INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER are rejected by Postgres at the role level — not by application code, not by trust, not by belt-and-suspenders regex. The wall is the database itself.

---

## 1. Create the `agent_reader` role in production

In **Supabase Studio → SQL Editor** (production project), run:

```sql
-- Generate password locally first:
--   openssl rand -hex 32
-- Paste the resulting 64-char hex below.

CREATE ROLE agent_reader WITH LOGIN PASSWORD '<paste-64-char-hex>';

GRANT USAGE ON SCHEMA public TO agent_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_reader;

-- Auto-grant SELECT on future tables created in public
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO agent_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO agent_reader;

-- Bypass RLS so the agent can read every row (drafts, audit logs, etc.)
-- AND so pg_dump doesn't abort on RLS-protected tables.
-- Writes are still rejected: the SELECT-only column grants above are the wall.
ALTER ROLE agent_reader BYPASSRLS;
```

### Why BYPASSRLS?

Postgres has two independent permission layers:

| Layer | Controls | `agent_reader` |
|---|---|---|
| `GRANT SELECT/INSERT/...` | Whether the role can touch a table at all | ✅ SELECT only |
| Row-Level Security policies | Which *rows* the role sees once the table is accessible | Bypasses (sees all) |

Without `BYPASSRLS`, `pg_dump` aborts with "query would be affected by row-level security policy" — its safety default when reading RLS-protected tables, to prevent silent partial dumps. Either the role bypasses RLS, or per-table policies must explicitly grant SELECT to `agent_reader`. BYPASSRLS is the simpler choice and aligns with what we actually want: agent verification needs to see drafts, audit logs, and any other RLS-hidden rows.

The write-prevention guarantee is unaffected. `agent_reader` has SELECT-only at the column-grant layer, and INSERT/UPDATE/DELETE return "permission denied" regardless of RLS. `service_role` has both BYPASSRLS *and* write privileges; `agent_reader` has BYPASSRLS *only*. That asymmetry is the security boundary.

## 2. Get the Session pooler connection string

**Use Session mode, NOT Direct.** Supabase migrated the direct connection hostname (`db.<ref>.supabase.co`) to IPv6-only in 2024. Most home/office networks are IPv4, so direct connections fail with DNS resolution errors. The Session pooler is IPv4-compatible and supports all the session-level features `pg_dump` and ad-hoc queries need.

**Supabase Dashboard → Project Settings → Database → Connection string** → switch the dropdown to **"Session"** mode (NOT "Transaction" or "Direct").

You'll get a URI like:
```
postgres://postgres.<project-ref>:<password>@aws-<N>-<region>.pooler.supabase.com:5432/postgres
```

Replace:
- `postgres.<project-ref>` (user) → `agent_reader.<project-ref>` (keep the project-ref suffix — the pooler uses it to route)
- `<password>` → the hex you generated in step 1
- Append `?sslmode=require` if not already present

Final URL:
```
postgres://agent_reader.<project-ref>:<hex>@aws-<N>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

**Don't use port 6543 (Transaction mode).** Transaction-mode pooling breaks `pg_dump` — it relies on session-level features (consistent snapshots, prepared transactions) that transaction-mode doesn't preserve across queries. Session mode (port 5432) behaves like a direct connection from the client's perspective.

### Why not Direct mode

Supabase migrated direct connections to IPv6-only addresses in 2024. If you're on an IPv4-only network (most home/office), DNS resolution of `db.<ref>.supabase.co` fails before any connection attempt. Symptom: `psql: error: could not translate host name "db.<ref>.supabase.co" to address`. The Session pooler avoids this entirely.

If you specifically need Direct mode (e.g., your network has IPv6 connectivity and you want lower latency), Supabase offers an "IPv4 add-on" (~$4/month) that restores an IPv4 record on the direct hostname. For agent verification workloads, Session pooler is fine.

## 3. Store in `.dev.vars`

`.dev.vars` is gitignored. Add:

```
AGENT_READ_DATABASE_URL=postgres://agent_reader:<hex>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

## 4. Install Postgres client tools

`psql` and `pg_dump` ship with Postgres client libraries:

```bash
brew install libpq
brew link --force libpq
```

About 30 MB. Verify:

```bash
psql --version
pg_dump --version
```

## 5. Verify the setup

```bash
# Read should succeed
pnpm query:prod "select count(*) from locations"

# Write should fail with "permission denied"
pnpm query:prod "drop table locations"

# Snapshot should work end-to-end
supabase start                  # if not already running
pnpm sync:prod-to-local --yes   # --yes skips the confirmation prompt
```

If the read succeeds, the write fails with `ERROR: permission denied`, and the sync completes — you're done.

---

## Password rotation

Every 90 days as hygiene:

```sql
-- In Supabase Studio SQL Editor
ALTER USER agent_reader WITH PASSWORD '<new-64-char-hex>';
```

Update `.dev.vars` with the new password. No other changes needed.

## What's safe with this credential

| Operation | Result |
|---|---|
| `SELECT * FROM ...` | ✓ Works |
| `pg_dump --data-only` | ✓ Works |
| `INSERT/UPDATE/DELETE` | ✗ `permission denied` |
| `DROP/TRUNCATE/ALTER` | ✗ `permission denied` |
| `CREATE TABLE/INDEX/FUNCTION` | ✗ `permission denied` |
| Access `auth.users` or other non-public schemas | ✗ `permission denied` (USAGE not granted on those schemas) |

## What's NOT safe

- ✗ Committing `.dev.vars` to git (it's gitignored — keep it that way)
- ✗ Pasting the connection string into shared docs or chat
- ✗ Reusing the credential across machines without rotation

The connection string is still a credential. If it leaks, an attacker gets read access to data that's mostly public-derived (USGS, NWS, JRA, rva.gov are public sources) but still shouldn't be exposed casually. Rotate via the SQL above and update `.dev.vars`.

## Why not use the Supabase CLI for this?

The CLI's `supabase db dump --linked` and `supabase db query` authenticate via your personal Supabase account session — full project access including writes. There's no codepath that says "do this as `agent_reader`."

To enforce read-only **by construction** rather than **by trust**, the agent must authenticate via a connection string scoped to a read-only Postgres role. `psql` and `pg_dump` are the right tools at that layer.

The Supabase CLI continues to handle what it's designed for: local lifecycle (`supabase start`/`stop`/`status`), migrations (`db reset`/`db push`), type generation. Just not the agent's read/sync path.

## How the sync script works

`scripts/sync-prod-to-local.sh`:

1. **Dump** — `pg_dump --no-acl --no-owner --data-only --schema=public` against `AGENT_READ_DATABASE_URL`. Read-only by role. Schema is skipped (local has it via migrations).
2. **Reset local** — `supabase db reset --no-seed` re-applies `supabase/migrations/*.sql`, truncating local data.
3. **Restore** — `psql` into the local DB URL (which you fully own), single-transaction so a partial failure rolls back.
4. **Record** — writes `.local-snapshot-info` so the next session knows how fresh the local data is.

There is no code path in the script that writes to production. Even if you modified the script with bad intent, `agent_reader` would refuse.
