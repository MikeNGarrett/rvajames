import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin/auth';
import { ToastProvider } from '@/components/admin/ToastProvider';

export const dynamic = 'force-dynamic';

/**
 * Admin layout — defence-in-depth auth check.
 *
 * Cloudflare Access blocks unauthenticated requests at the edge (see
 * DEPLOYMENT.md). This layout is a second check: confirms the email header
 * is present AND in the ALLOWED_ADMIN_EMAILS allowlist.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await requireAdminPage();

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-rva-navy text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold">RVA James Admin</h1>
          <p className="text-xs text-white/70 mt-0.5">Signed in as {email}</p>
        </div>
        <Link
          href="/"
          className="text-xs text-white/70 hover:text-white underline"
        >
          ← Back to site
        </Link>
      </header>
      <ToastProvider>
        <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
      </ToastProvider>
    </div>
  );
}
