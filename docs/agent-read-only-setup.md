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
```

## 2. Get the direct connection string

**Supabase Dashboard → Project Settings → Database → Connection string** → "URI" tab → **Direct connection** (port 5432, NOT the pooler).

You'll get a URI like:
```
postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Replace:
- `postgres:` (user) → `agent_reader:`
- `<password>` → the hex you generated in step 1
- Append `?sslmode=require` if not already present

Final URL:
```
postgres://agent_reader:<hex>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

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
