import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin/auth';
import { createServerClient } from '@/lib/supabase/server';
import { ClosureForm } from '@/components/admin/ClosureForm';
import { createClosure } from '../actions';

export default async function NewClosurePage() {
  await requireAdminPage();
  const supabase = await createServerClient('service');

  const { data: locationRows } = await supabase
    .from('locations')
    .select('id, name, slug')
    .eq('kind', 'access_point')
    .order('name');

  const locations = (locationRows ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
        <Link href="/admin/closures" className="hover:text-text underline">
          Closures
        </Link>
        <span aria-hidden="true" className="mx-2">›</span>
        <span className="text-text font-medium">New closure</span>
      </nav>

      {/* Heading */}
      <div>
        <h2 className="text-lg font-bold text-text">New closure</h2>
        <p className="text-sm text-text-secondary mt-0.5">
          Creates an active closure immediately. Required fields are marked{' '}
          <span aria-hidden="true" className="text-status-danger font-medium">*</span>.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-lg border border-border bg-surface-raised p-6">
        <ClosureForm
          locations={locations}
          saveAction={createClosure}
          saveLabel="Create closure"
        />
      </div>
    </div>
  );
}
