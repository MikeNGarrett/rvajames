interface Resource {
  id: string;
  title: string;
  url: string;
  kind: 'official' | 'parks' | 'safety' | 'community';
  sort_order: number;
}

interface Props {
  resources: Resource[];
}

const KIND_LABELS: Record<Resource['kind'], string> = {
  official: 'Official',
  parks:    'James River Park System',
  safety:   'Safety & Data',
  community: 'Community',
};

const KIND_ICON: Record<Resource['kind'], string> = {
  official:  '🏛',
  parks:     '🌿',
  safety:    '🛡',
  community: '🤝',
};

const KIND_ORDER: Resource['kind'][] = ['parks', 'safety', 'official', 'community'];

export function ResourceList({ resources }: Props) {
  if (!resources.length) return null;

  // Group by kind, in specified display order
  const grouped = KIND_ORDER
    .map((kind) => ({
      kind,
      items: resources
        .filter((r) => r.kind === kind)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <section id="resources" aria-label="Official resources">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
        Resources & links
      </h2>

      <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
        {grouped.map((group, gi) => (
          <div key={group.kind} className={gi > 0 ? 'border-t border-border' : ''}>
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-1.5">
              <span aria-hidden>{KIND_ICON[group.kind]}</span>
              {KIND_LABELS[group.kind]}
            </p>
            {group.items.map((resource, i) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between gap-2 px-4 py-3 touch-target hover:bg-surface transition-colors ${
                  i < group.items.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <span className="text-sm font-medium text-rva-blue leading-snug">
                  {resource.title}
                </span>
                <span className="text-text-muted text-xs flex-shrink-0" aria-hidden>↗</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
