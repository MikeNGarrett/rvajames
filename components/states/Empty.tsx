export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-6 text-center text-text-muted text-sm">
      {message ?? 'No data available for this date. Check back after the daily conditions run.'}
    </div>
  );
}
