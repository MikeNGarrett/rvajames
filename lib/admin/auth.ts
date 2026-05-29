import { headers } from 'next/headers';
import { getAllowedAdminEmails } from '@/lib/env';

/**
 * Reads the Cloudflare Access header to identify the authenticated admin.
 *
 * Returns the email address if:
 *   1. The `cf-access-authenticated-user-email` header is present (set by the
 *      Cloudflare Access JWT middleware at the edge), AND
 *   2. The email appears in the `ALLOWED_ADMIN_EMAILS` env var allowlist.
 *
 * Returns null in all other cases.
 *
 * In local `next dev` (no Cloudflare edge), the header won't be present.
 * Set `ALLOWED_ADMIN_EMAILS` in `.env.development.local` (Wrangler reads it via
 * the `.dev.vars` symlink) and pass the email via curl/Postman.
 * See DEPLOYMENT.md § Local admin testing.
 */
export async function getAdminEmail(): Promise<string | null> {
  const headersList = await headers();
  const email = headersList.get('cf-access-authenticated-user-email');
  if (!email) return null;

  const allowedEmails = await getAllowedAdminEmails();
  if (!allowedEmails.includes(email.toLowerCase())) return null;

  return email;
}

/**
 * Same as getAdminEmail() but throws a 403 response if not authorized.
 * Use in admin Server Components that should never render to unauthorized users.
 */
export async function requireAdminEmail(): Promise<string> {
  const email = await getAdminEmail();
  if (!email) {
    // In practice, Cloudflare Access blocks unauthenticated requests at the
    // edge before they reach the Worker. This is a defence-in-depth check.
    throw new Response('Forbidden — admin access required', { status: 403 });
  }
  return email;
}
