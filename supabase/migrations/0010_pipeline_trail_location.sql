-- Migration 0010: Add Pipeline Trail as the 10th James River access point.
--
-- Pipeline Trail has been closed since September 13, 2024 following a
-- sewage-pipe failure under the trail. The City of Richmond Department of
-- Public Utilities (DPU) closed it for safety reasons; closure expected to
-- remain in effect pending infrastructure decisions.
--
-- References:
--   https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-closure-update
--   https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-faqs
--   https://jamesriverpark.org/whats-going-on-with-pipeline/

-- ─── Location row ────────────────────────────────────────────────────────────

insert into public.locations (slug, name, lat, lng, kind, tags)
values (
  'pipeline-trail',
  'Pipeline Trail',
  37.524000,
  -77.434000,
  'access_point',
  array['trail', 'closed', 'historical']
);

-- ─── Permanent closed_indefinite status row ──────────────────────────────────

insert into public.location_status (
  location_id,
  kind,
  state,
  affects,
  reason,
  source,
  source_url,
  effective_from,
  effective_to,
  next_review_at,
  created_by
)
select
  l.id,
  'closed_indefinite',
  'active',
  'Entire trail',
  'Closed by City of Richmond Department of Public Utilities since September 13, 2024 due to safety concerns following a sewage-pipe failure. Closure expected to remain in effect pending infrastructure decisions.',
  'City of Richmond DPU',
  'https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-closure-update',
  '2024-09-13 00:00:00+00',
  null,
  '2027-01-01 00:00:00+00',
  'admin'
from public.locations l
where l.slug = 'pipeline-trail';

-- ─── Location resources ───────────────────────────────────────────────────────

insert into public.location_resources (location_id, title, url, kind, sort_order)
select l.id, r.title, r.url, r.kind::resource_kind, r.ord
from public.locations l, (values
  ('Pipeline Trail Closure Update — City of Richmond DPU', 'https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-closure-update', 'official', 1),
  ('Pipeline Trail FAQs — City of Richmond DPU',           'https://www.rva.gov/press-releases-and-announcements-public-utilities/news/pipeline-trail-faqs',              'official', 2),
  ('What''s Going On With Pipeline? — Friends of JRPS',    'https://jamesriverpark.org/whats-going-on-with-pipeline/',                                                   'parks',    3)
) as r(title, url, kind, ord)
where l.slug = 'pipeline-trail';
