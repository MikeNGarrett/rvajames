# JRPS Location & Threshold Validation — 2026-06-02

Deep-research workflow run against the 9 seeded James River Park System
locations to validate the activity matrix and access thresholds before
the home-tile redesign. Spawned via the `deep-research` skill on the
question: *"Validate the activity-availability matrix and accessibility
thresholds for 9 specific JRPS locations in Richmond, Virginia."*

**Stats:** 105 agents, 23 sources, 73 falsifiable claims extracted,
25 verified via adversarial 3-vote (need 2/3 refutes to kill), 22
confirmed, 3 killed, 12 in final synthesis.

## Headline findings

### 1. Westham 5.0 ft is a park-wide PFD threshold, not a Belle Isle closure (confidence: high)
Primary source jamesriverpark.org/park-rules-safety/ states verbatim:
*"Lifejackets must be worn when the River is at or above 5 feet."* The
riversafety page adds *"At 5 feet and below, it is safe to tube. Above
5 feet requires a life jacket or flotation device."* This is a City of
Richmond ordinance covering ALL water-contact, not a soft guideline,
and not specific to Belle Isle.

The original codebase modeled this as Belle Isle's `south_channel_close_ft
= 5.0` — wrong both in location-scope and in semantics (it's a PFD
trigger, not a closure).

**Action taken (migration 0016, thresholds.json):** removed
`south_channel_close_ft` from Belle Isle. Added a new
`globalRules.pfdRequiredAboveGageFt: 5.0` to thresholds.json for use in
a future UI PFD-required overlay across all water-contact activities.

### 2. The Potterfield Memorial Bridge "closes at 10 ft" assumption was very wrong (confidence: high)
Primary source jamesriverpark.org/t-tyler-potterfield-memorial-bridge/
documents the deck at 20 ft above the river and that *"historic storms
like Hurricane Agnes raised the river above the current bridge level"*
— Hurricane Agnes (1972) crested at ~26 ft in Richmond. Independent
contractor (Shockey Builds) corroborates ~20 ft elevation. At 16 ft
moderate-flood crest (2019, highest in the bridge's lifetime up to
that point), the bridge remained open with people standing on it
watching the rapids. No public source documents a Potterfield closure
between 10–16 ft gauge.

**Action taken (thresholds.json):** removed `flood_close_ft: 10.0`
from Browns Island and Shiplock Trail. Raised
`activities.bridge_crossing.gage_deny_above_ft` from 10.0 → 22.0 with
a citation, framed as a conservative record-flood estimate pending
actual closure-event verification.

### 3. Swimming at Belle Isle is not on the official JRPS activity list (confidence: high)
Primary source jamesriverpark.org/explore-the-park-belle-isle/ lists 9
activities for Belle Isle: paddle sports, biking, mountain biking,
fishing, hiking/walking, scenic views, picnics, rock climbing, bird
watching. **Swimming is not included.** Adversarial reporting from
April 2026 documents a fatal drowning on the island (21-year-old man,
no lifeguards present, many swimmers without PFDs).

**User correction during review:** swimming and wading do happen at
Belle Isle and are common, but JRPS does not endorse swimming as a
recommended activity. The codebase should treat Belle Isle swim as
older-age-only (10+) with PFD overlay, while wading remains open to
all ages.

**Action taken (migration 0016):** Belle Isle retains `swim` with a
per-location `min_age_override = 10`; adds `wade` (min_age 0); adds
`rock-climbing`, `fishing`, `bird-watching`; removes `bridge-crossing`
(that activity refers to Potterfield, not Belle Isle).

### 4. Pony Pasture and Texas Beach are the two officially-recommended family swim/wade entries (confidence: high)
Primary source jamesriverpark.org/swimming-in-the-james-river-park/:
*"Spots like Texas Beach and Pony Pasture offer easy access points to
walk into the water."* Friends of James River Park separately describes
Texas Beach as *"one of the safest access points to the James River."*
Pony Pasture is Class II rapids (family-friendly); the more dangerous
Class III–IV stuff (Hollywood, Pipeline) is downstream.

**Action taken (migration 0016):** Pony Pasture activity list expanded
to include `wade`, `fishing`, `snorkeling`, `tubing`, `bird-watching`.
Texas Beach adds `wade`.

### 5. Buttermilk is 2.5 miles (not 1.7), and North Bank + Buttermilk are advanced/technical with heavy MTB traffic (confidence: high)
Primary source jamesriverpark.org/explore-the-park-buttermilk/ confirms
*"considered the most difficult of the different sections of the James
River Park System"* and explicit MTB-share warning. North Bank is
similarly *"an advanced trail that is technical, rocky and rugged in
spots"* with a *"be alert for fast-moving cyclists"* warning. Belle
Isle is *"Easy-Moderate"* — most family-friendly trail set.

**Action taken (docs/audit-reconciliation.md):** queued an "MTB-share
quirk surfacing" follow-up so the tile redesign can flag this on the
two advanced trails. No data-layer change needed today (the seed
length of 1.7 mi was in a previous draft of the plan; the rules engine
doesn't store trail length).

### 6. Pump House: open trails + monthly guided tours, restoration ongoing (confidence: high)
Friends of Pump House (friendsofpumphouse.org/faq.html): the City of
Richmond owns the building; tours are held once per month March–November
(~30 min, announced via FB + mailing list); full restoration would
exceed $10M; building is not yet event-suitable (no restrooms, no HVAC,
no ADA, 20-person hardhat cap). The adjacent Pump House Park trails
and Dogwood Dell are open year-round.

**Action taken (migration 0016, thresholds.json):** Pump House
activity list reduced to `hike` only (`swim` and `beach-access`
removed; cove access is not for general public). Flavor note updated
to *"Park trails + monthly tours Mar–Nov. Restoration ongoing."*

### 7. Mayo Island: limited public access since 2022 Capital Region Land Conservancy acquisition (confidence: medium)
The deep-research pass surfaced general context (CRLC acquired the
island in 2022 for future public-park development) but no validated
activity matrix or current access details.

**Action taken (migration 0016):** Mayo Island row preserved
(`UPDATE locations SET published = false`) so historical data tied
to it stays queryable. Public-facing queries (homepage grid, sitemap,
location detail page) now filter `.eq('published', true)` and exclude
it.

## Refuted claims (killed by adversarial verification)

1. *"Swimming, kayaking/paddling, hiking on designated trails, and
   biking on designated trails are permitted activities within James
   River Park."* — vote 1-2. Source listed permitted activities at the
   park-system level, not per-location. Too coarse to ground per-
   location decisions.
2. *"Personal flotation devices are recommended for boating, fishing,
   or rock-hopping once water levels reach 5 feet or more."* — vote
   1-2. The actual rule is "required" not "recommended," and applies
   to swimmers/boaters, not specifically fishing/rock-hopping.
3. *"Belle Isle's rock hopping is concentrated on the south side of the
   island, and the island is accessed via a pedestrian suspension
   bridge beneath the Lee Bridge (constructed 1988)."* — vote 0-3.
   The 1988 date couldn't be verified; the actual claim conflated two
   independent facts.

## Open questions (queued for direct outreach in audit-reconciliation.md)

1. Specific Westham gauge values that make Belle Isle south-channel
   rock crossing, Pony Pasture beach, Brown's Island riverbank, and
   Shiplock Trail walkway unusable. No primary source publishes
   per-location thresholds. Direct outreach to JRPS, Friends of James
   River Park, or local outfitters needed.
2. Has Potterfield Memorial Bridge ever been formally closed since its
   2016 opening, and at what Westham value? User intuition: no, it
   hasn't been open long enough. A definitive closure event would let
   us pin a hard threshold.
3. Mayo Island public-access timeline post-CRLC 2022 acquisition.
4. JRPS or City of Richmond published age guidance for the Bicycle
   Skills Area, paddle launches, swim entries. None exists today; any
   ages in the dashboard must be framed as derived from USCG/AAP, not
   as JRPS rules.

## Primary sources

| URL | Quality | Used for |
|---|---|---|
| jamesriverpark.org/park-rules-safety/ | primary | 5 ft PFD rule, permitted activities |
| jamesriverpark.org/riversafety/ | primary | Tubing/PFD threshold, river-safety guidance |
| jamesriverpark.org/swimming-in-the-james-river-park/ | primary | Pony Pasture + Texas Beach recommendations |
| jamesriverpark.org/explore-the-park-belle-isle/ | primary | Belle Isle activity inventory |
| jamesriverpark.org/explore-the-park-pony-pasture/ | primary | Pony Pasture activity inventory |
| jamesriverpark.org/explore-the-park-north-bank-trail/ | primary | North Bank difficulty + MTB warning |
| jamesriverpark.org/explore-the-park-buttermilk/ | primary | Buttermilk difficulty + length |
| jamesriverpark.org/t-tyler-potterfield-memorial-bridge/ | primary | 20-ft deck height, Hurricane Agnes overtop |
| jamesriverpark.org/trails/ | primary | Trail difficulty ratings |
| friendsofpumphouse.org/faq.html | primary | Pump House restoration + tour status |
| waterdata.usgs.gov/monitoring-location/USGS-02037500 | primary | Westham gauge data |
| water.noaa.gov/gauges/rmdv2 | primary | NWS flood-stage thresholds |
| wtvr.com (April 2026 Belle Isle drowning) | secondary | Drowning incident |
| 12onyourside.com (April 2026) | secondary | Drowning incident corroboration |
| richmondmagazine.com (Wild in the City feature) | secondary | Local color, swim-spot characterization |
| fredericksburg.com (2019 high-water reporting) | unreliable | Anecdotal Potterfield-bridge-open-at-16-ft observation |

## What this report does not cover

Three of the nine locations remain unvalidated against primary sources:
**Shiplock Trail**, **North Bank Trail and Buttermilk** access logistics
beyond their difficulty ratings, and **Pump House** beyond the
restoration/tours framing. The user's June 2026 message also surfaced
~14 additional adjacent locations (RVA Free Climbing wall, Canal Walk,
Tredegar rope swing, Manchester floodwall walk, 14th Street takeout,
Tredegar boat ramp, Chapel Island, Dock Street Park, Ancarrow's
Landing, Virginia Capital Trail, Reedy Creek Trail, wetlands trails,
Williams Island, Huguenot flatwater) — none have been researched.
All queued in audit-reconciliation.md for a future research pass.
