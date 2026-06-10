import Link from 'next/link';

/**
 * Rendered by Next's forbidden() auth interrupt with an HTTP 403 — currently
 * only reachable from the /admin guard (requireAdminPage in lib/admin/auth.ts)
 * when a request carries no valid Cloudflare Access identity.
 */
export default function Forbidden() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-text mb-2">403 — Access denied</h1>
        <p className="text-sm text-text-secondary mb-4 max-w-prose">
          This area requires an authenticated admin session.
        </p>
        <Link href="/" className="text-sm text-rva-blue underline touch-target">
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
