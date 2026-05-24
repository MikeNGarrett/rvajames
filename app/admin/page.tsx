import { redirect } from 'next/navigation';

/** /admin has no content of its own — redirect to the closures list. */
export default function AdminRootPage() {
  redirect('/admin/closures');
}
