# 14 Additional Locations — Research Tracker

**Started:** 2026-06-04
**Author:** Claude (with Mike Garrett driving)
**Status:** Research complete 2026-06-04. User decisions captured below. Migration 0017 ships next.

## User decisions (2026-06-04 / 2026-06-05)

Final scope after research + Q&A:

- **12 locations to seed** (dropped 2 of the original 14):
  - Cluster A (6): `canal-walk`, `manchester-floodwall-walk`, `virginia-capital-trail`, `dock-street-park`, `reedy-creek`, `the-wetlands`
  - Cluster B (3): `tredegar-boat-ramp`, `ancarrows-landing`, `huguenot-flatwater`
  - Cluster C (3): `tredegar-rope-swing`, `manchester-climbing-wall`, `chapel-island`
- **Dropped from this round:**
  - **14th Street Takeout** — expert whitewater exit, not a family destination. Skip entirely (not even `published=false`).
  - **Riverside Meadows / Williams Island Dam Park** — user chose not to publish a location card; instead document the dams on /safety.
- **New activity slug: `kayak-flatwater`** — calm-water paddling. Min age 6 with USCG PFD. Surfaces on Huguenot Flatwater and Chapel Island. `kayak-rapids` remains as-is for whitewater.
- **Tredegar Rope Swing posture:** publish with strong warnings — `min_age 14`, hazard banner naming the documented 2009 / 2011 / 2026 incidents, automatic close at Westham gauge ≥ 5 ft. Rope swing itself surfaced via flavor + warning copy (not via a new slug — `swim` activity with elevated-risk framing).
- **Dam hazards → /safety** (separate commit): Z-Dam, Williams Island Dam, Bosher's Dam each documented as low-head-dam drowning hazards with the citation set the Cluster C agent assembled.

### Defaults the agent applied where the user didn't explicitly answer

These are reasonable defaults — push back during migration review if you disagree:

- **Wetlands disambiguation:** seeded as JRPS "The Wetlands" off Landria Dr (3395 Landria Dr). Only JRPS-named "wetlands" entity with a dedicated Explore the Park page.
- **Reedy Creek scope:** seeded as a separate `reedy-creek` location representing the JRPS meadow/HQ node. Buttermilk Trail stays as-is (already in DB). Tile copy will route walkers to Buttermilk via `location_resources`.
- **Virginia Capital Trail scope:** seeded as full 52-mile trail with Richmond-terminus framing in flavor copy + lat/lng at Great Shiplock Park (the Richmond mile-zero).
- **Dock Street Park flood threshold:** conservative 12 ft Westham (outside the floodwall, no published threshold).
- **Floodwall Park length:** 2.0 mi (the south-bank walk number).
- **Ancarrow's gauge wiring:** primary USGS 02037705 (City Locks); NOAA 8638495 (Richmond Locks tides) as supplement. Westham (02037500) is NOT the primary for this site.
- **Ancarrow's water-quality:** surfaced as "no on-site bacteria data — tidal industrial corridor, not recommended for swim/wade."
- **Tredegar Beach vs Boat Ramp:** modeled as one location (`tredegar-boat-ramp`) with NO swim activity. Tile flavor copy notes the adjacent JRA-tested beach.
- **Huguenot Flatwater address:** 8600 Riverside Drive (JRPS primary listing). Lat/lng pending OSM cross-check.
- **Z Dam / Bosher's Dam downstream warning on Huguenot:** YES, hazard line in flavor + warning copy.
- **Manchester Climbing Wall age floor:** 8 with "adult belayer required, gear supplied" copy.
- **Z-Dam high-water threshold copy on /safety:** general framing ("hazard at any stage, worse at high water"). The specific 6–7 ft Westham figure is single-source (2017 WTVR firefighter interview) and the agent recommended general framing.
- **Coordinates:** I'll do OSM cross-checks before the migration ships rather than asking you for each one.
- **Restroom data:** where unconfirmed, the location card says "restrooms not confirmed — check before visit" rather than asserting yes/no.

## Round goal

Validate and seed 14 additional James River–adjacent locations that the user surfaced during the 2026-06-02 redesign thread. Each candidate needs enough verified data to ship a tile on the homepage without inventing facts: official source, lat/lng, parking notes, applicable activities, age guidance, and (for water-access points) the flood-stage threshold at which the site closes.

This is a multi-session round. The agents below execute one cluster at a time; their outputs land here as appendices before any migration ships.

## Existing locations (do not duplicate)

Currently in the database (from migrations 0001, 0003, 0010, 0016):

| Slug | Name | Status |
|---|---|---|
| `belle-isle` | Belle Isle | published |
| `pony-pasture` | Pony Pasture | published |
| `texas-beach` | Texas Beach | published |
| `browns-island` | Brown's Island | published |
| `shiplock-trail` | Great Shiplock Trail | published |
| `north-bank-trail` | North Bank Trail | published |
| `buttermilk-trail` | Buttermilk Trail | published |
| `pump-house` | Pump House (Park HQ) | published |
| `pipeline-trail` | Pipeline Trail | published |
| `mayo-island` | Mayo Island | **unpublished** (Oct 2026 CRLC timeline) |

## Candidate list (14 new)

Grouped by research methodology so parallel agents can work efficiently. Each candidate is tagged with the source the user gave us (the 2026-06-02 redesign thread).

### Cluster A — Trail / pedestrian-only

These sites are walking-only — no swim, no kayak, no rock-hop. Research focus: family suitability, surface, length, parking, restrooms, age guidance from NPS / trail-difficulty norms. Flood thresholds usually N/A (paved walks built above the floodplain) but worth confirming for the riverside walks.

1. **Canal Walk (downtown)** — paved canal walk along the Haxall + Kanawha canals, Riverfront Plaza to Tredegar/Tredegar Iron Works area
2. **Manchester Floodwall Walk** — pedestrian path on top of the Manchester floodwall, south side of the James between Mayo Bridge and Manchester Climbing Wall
3. **Virginia Capital Trail** — 52-mile paved multi-use trail Richmond ⇄ Jamestown; we'd seed the Richmond terminus segment
4. **Dock Street Park** — small park east of Mayo Bridge with viewing area
5. **Reedy Creek Trail** — JRPS trail connecting Forest Hill Park to Pony Pasture
6. **The wetlands trails** — needs disambiguation (Pony Pasture wetlands? Deepwater Terminal wetlands at Ancarrow's? Riverview/Reedy?)

### Cluster B — Boat ramps / water-access points

These sites have river-water contact, often via boat ramps or paddle launches. Research focus: USGS gauge applicability (most use Westham 02037500), flood-stage closure thresholds, JRA water-quality station coverage, parking, age guidance for paddling. Many will reuse the existing global gage-band rules.

7. **14th Street Takeout** — paddle takeout at 14th Street, downstream of Mayo Bridge (whitewater paddlers exit here after the Pipeline rapids)
8. **Tredegar Boat Ramp** — north-bank ramp at Tredegar Iron Works
9. **Ancarrow's Landing** — boat ramp at the Richmond Slave Trail terminus, downstream James in the brackish/tidal zone
10. **Huguenot Flatwater + Boat Ramp** — upstream flatwater near Huguenot Bridge / Pony Pasture (above the rapids — calm water)

### Cluster C — Sensitive / special-handling sites

Each needs careful framing — informal/dangerous sites should NOT just inherit the safe activity matrix.

11. **Tredegar Rope Swing** — informal rope swing site (likely Hollywood Rapids area); historically dangerous, multiple incidents on record. May warrant DENY-by-default for under-14 or "informal site — proceed at your own risk" framing rather than the normal activity grid.
12. **RVA Free Climbing Wall** — the Manchester Climbing Wall? Or the Belle Isle climbing area we already partially cover via the `rock-climbing` activity? Needs disambiguation. If it's the floodwall murals climbing wall: outdoor, traditional climbing, age-gated.
13. **Williams Island (+ two dams nearby)** — west of the metro, between Henrico and Powhite. Has Williams Island Dam Park access AND the Williams Island Dam (low-head dam) which is a recognized drowning hazard. Adjacent: Bosher's Dam fish ladder. Multi-stop site with serious infrastructure danger.
14. **Chapel Island** — small island adjacent to Great Shiplock Park; tidal-zone access, possibly via the canal flood lock. Needs clarification on whether public access is legally permitted (some adjacent CSX land is fenced).

## Research method

For each cluster, one agent runs in parallel. The agent's mandate:

- **Authoritative sources first.** JRPS (jamesriverpark.org), City of Richmond Parks & Rec, Capital Region Land Conservancy, Virginia Capital Trail Foundation, James River Association, USGS station catalog. Wikipedia is acceptable for context but not as primary source. Social media posts and informal blogs are background only.
- **No data without a URL.** Every claim (parking count, ramp closure stage, surface type, allowed activities) gets a cited link.
- **Coords from official source if available; else from OSM.** Cross-check with the user-known cluster (e.g. Tredegar Boat Ramp should be very close to Tredegar Iron Works coords).
- **Flag everything uncertain.** "Closes at gauge ≥ X" claims need explicit confirmation; if we can't find it, the threshold defaults to the global gage band rules and we note "no site-specific closure data."
- **Age guidance is grounded.** AAP for swim minimums, NPS difficulty norms for trails, USCG PFD rules for paddling. No inventing kid-safe ages without a source.

## Seed plan (post-research)

Once all three clusters have research appendices below, one migration ships:
- `supabase/migrations/0017_locations_2026_06_seed.sql`
- All 14 INSERTs into `locations` + matching `location_activities` rows
- `published=false` for sites we can't fully verify or that warrant the "Coming soon" treatment (the deferred follow-up from the audit)
- Optional `location_resources` rows for each (mirroring 0006's pattern)
- New thresholds in `lib/safety/thresholds.json` ONLY where we have an authoritative source

The migration is NOT applied to production by the agent — per the standing rule, only `supabase db push` against the local instance during validation. User applies to prod manually.

## Open questions for the user (will batch when research is done)

These will accumulate as research surfaces them; the user gets one consolidated batch at the end.

1. (placeholder for cluster-A disambiguation: which "wetlands trails"?)
2. (placeholder for cluster-C disambiguation: which climbing wall? Which dams?)
3. (placeholder for sensitivity decisions: do we even surface Tredegar Rope Swing? Or document its dangers without recommending?)

---

## Cluster A — research findings

_Research conducted 2026-06-04. Sources cited inline. Numeric claims trace to JRPS, Venture Richmond, Virginia Capital Trail Foundation, City of Richmond, Capital Region Land Conservancy, or NOAA/USGS as noted. Coordinates marked "OSM cross-check pending" are best-available decimal-degree estimates from search-surfaced sources — should be re-verified against OSM before the migration ships._

### 1. Canal Walk

- **Canonical name:** Riverfront Canal Walk
- **Suggested slug:** `canal-walk`
- **Lat/lng:** ~37.5340, -77.4400 (approximate centroid along Brown's Island / Haxall Canal stretch; Brown's Island anchor 37.5333, -77.4372 per HometownLocator / Latitude.to). Endpoints span ~5th St to ~17th St per [Venture Richmond](https://venturerichmond.com/explore-downtown/riverfront-canal-walk/).
- **Official URL:** https://venturerichmond.com/explore-downtown/riverfront-canal-walk/ (managed by Venture Richmond)
- **Surface:** Paved ("easy, paved path" — Venture Richmond / Landscape Performance Series case study)
- **Length:** 1.25 miles ([Venture Richmond](https://venturerichmond.com/explore-downtown/riverfront-canal-walk/))
- **Parking:** Multiple metered downtown lots/garages; no dedicated Canal Walk lot. Access points at every block 5th–17th. ADA-accessible entrances at 5th, 10th, 12th, 14th, 16th Sts. No published capacity figure.
- **Restrooms:** Not documented on Venture Richmond page. Public restrooms available at adjacent attractions (Brown's Island events, American Civil War Museum). Treat as **none / nearby only**.
- **Stroller-friendly:** Yes (paved, level, ADA entrances). Wheelchair accessible: Yes (per Venture Richmond + AccessibleVirginia).
- **Allowed activities:** `hike`, `bird-watching`
- **Age guidance:** 0+. Paved, flat, urban path — meets NPS "easy / accessible" criteria and AAP/stroller norms for infants.
- **Flood threshold:** Canal Walk runs inside the protected zone behind Richmond's 3.2-mile floodwall system (completed 1995, designed for the 1972 Agnes 28-ft stage). Floodgates close ahead of major events; Venture Richmond / City Public Utilities post closures. **No published Westham-gauge trigger** — defer to City of Richmond Public Utilities floodwall alerts ([rva.gov floodwall FAQ](https://www.rva.gov/public-utilities/news/floodwall-faqs)). Site-specific data: not published; global gage-band rules apply.
- **Flavor:** "A flat, paved mile and a quarter along the old canals — bridges, murals, and the easiest river walk downtown."
- **Open questions:** Confirm coordinates with OSM; confirm whether any public restroom exists directly on Canal Walk path (vs. only at adjacent venues).

### 2. Manchester Floodwall Walk

- **Canonical name:** Floodwall Park (City/JRPS canonical name; "Manchester Floodwall Walk" is common usage. JRPS page title: "Flood Wall Park.")
- **Suggested slug:** `floodwall-park`
- **Lat/lng:** ~37.5310, -77.4310 (parking lot at south end of Mayo / 14th St Bridge off Hull St). Address: 101 Hull St, Richmond, VA 23224 per [Visit Richmond](https://www.visitrichmondva.com/listing/floodwall-park/3301/). OSM cross-check pending.
- **Official URL:** https://jamesriverpark.org/explore-the-park-floodwall-park/
- **Surface:** Mixed — paved walkway atop the levee/wall, with dirt/gravel sections where the trail leaves the wall ([JRPS](https://jamesriverpark.org/explore-the-park-floodwall-park/); AllTrails confirms mixed paved + dirt).
- **Length:** The Floodwall structure is 3.2 mi total (1.2 mi north shore + 2.0 mi south shore per JRPS / [historical marker](https://www.hmdb.org/m.asp?m=23953)). The walkable Manchester (south-bank) portion is ~2 mi out-and-back from the 14th St Bridge parking area. One search result cited a "Floodwall Walk: 0.5 mi" figure but source is unclear — **treat the 2 mi south-bank figure as the seedable value** until JRPS publishes a trail-specific distance.
- **Parking:** Small lot at south end of 14th St Bridge off Hull St ([JRPS](https://jamesriverpark.org/explore-the-park-floodwall-park/)). No published capacity.
- **Restrooms:** Not documented. Treat as **none**.
- **Stroller-friendly:** Partial — paved levee top is wide enough but enclosed by double-railings and narrow per Explanders / Architecture Richmond. Some stair access at portals. Wheelchair: partial (gate/portal sections may obstruct). Flag as "stroller OK on top of wall; steps at some access points."
- **Allowed activities:** `hike`, `bird-watching` (JRPS lists swimming/fishing/paddle/snorkeling too — those don't apply since this is the wall walk, not water access)
- **Age guidance:** 4+. Elevated narrow path with railings; younger kids fine in stroller. NPS "easy" tier.
- **Flood threshold:** This *is* the floodwall — wall designed to a stage of ~32 ft per Explanders. Floodgates close before major events; walk closes when gates close. **No published Westham-gauge specific trigger; defer to City Public Utilities alerts**.
- **Flavor:** "A high, narrow walk on top of the floodwall — quiet skyline views, popular with runners, mostly stroller-friendly."
- **Open questions:** Confirm parking capacity. Resolve the 0.5 mi vs 2 mi length discrepancy with a JRPS map source.

### 3. Virginia Capital Trail (Richmond terminus)

- **Canonical name:** Virginia Capital Trail (seeded as Richmond entry — formal trailhead is Great Shiplock Park)
- **Suggested slug:** `virginia-capital-trail`
- **Lat/lng:** Richmond trailhead at Great Shiplock Park: **37.5260, -77.4217** (per Capital Trees / Yelp / Waze; address 2803 Dock St, Richmond, VA 23223)
- **Official URL:** https://www.virginiacapitaltrail.org/
- **Surface:** Paved (asphalt), with short wooden boardwalk sections ([TrailLink](https://www.traillink.com/trail/virginia-capital-trail/); [Wikipedia](https://en.wikipedia.org/wiki/Virginia_Capital_Trail) for context)
- **Length:** 51.7 mi total Jamestown ⇄ Richmond ([Wikipedia](https://en.wikipedia.org/wiki/Virginia_Capital_Trail) citing VCTF). For our purposes, seed the Richmond terminus segment (Great Shiplock Park → Four Mile Creek trailhead is the first published itinerary, ~7.5 mi out-and-back from the Richmond end).
- **Parking:** Free at Great Shiplock Park lot (unlit, not monitored overnight) per [VCTF parking page](https://www.virginiacapitaltrail.org/parking). Paid alternatives at Scott Lot (1504 E Cary, $5/12hr) per VCTF. No published capacity for Great Shiplock lot.
- **Restrooms:** VCTF describes restrooms along the trail. Specific availability at Great Shiplock trailhead not confirmed on VCTF page; portable toilets typical at JRPS sites.
- **Stroller-friendly:** Yes. Wheelchair accessible: Yes (VCTF: "largely rural, wheelchair-accessible path").
- **Allowed activities:** `hike`, `bird-watching` (also cycling/skating per VCTF — out of scope for our slugs)
- **Age guidance:** 0+. Paved, level, multi-use trail. Cycling traffic warrants stroller-side awareness but path qualifies as accessible.
- **Flood threshold:** Trail generally above floodplain near Richmond. Great Shiplock Park itself sits at the floodwall portal — closes when the City closes the floodgates. **No site-specific Westham-gauge data published**; global gage-band rules apply.
- **Flavor:** "Richmond's eastern gateway to a 52-mile paved trail — stroller-perfect, river-adjacent, goes all the way to Jamestown."
- **Open questions:** Confirm restroom presence at Great Shiplock trailhead specifically. Decide whether the location entity represents the full 52-mi trail (Richmond-terminus framing) or just a seedable Richmond segment.

### 4. Dock Street Park

- **Canonical name:** Dock Street Park
- **Suggested slug:** `dock-street-park`
- **Lat/lng:** ~37.5270, -77.4180 (between Great Shiplock Park 37.5260,-77.4217 and Rocketts Landing; addresses 3011 and 3021 Dock St per [CRLC](https://capitalregionland.org/projects/dock-street/) / [Conservation Fund](https://www.conservationfund.org/our-impact/news-insights/the-view-that-named-richmond-permanently-protected/)). OSM cross-check pending.
- **Official URL:** https://capitalregionland.org/projects/dock-street/ (CRLC project page; City/JRPS does not yet host a dedicated page — visitrichmondva.com listing is secondary)
- **Surface:** Walking trails through native vegetation (per CRLC / WTVR coverage); surface type not explicitly published. Treat as **mixed/unpaved** pending confirmation. Capital Trail re-route segment through the park is paved.
- **Length:** Not published. Site is 5.2 acres ([Conservation Fund](https://www.conservationfund.org/our-impact/news-insights/the-view-that-named-richmond-permanently-protected/)) and runs from Great Shiplock Park southeast toward Rocketts Landing; estimated ~0.3 mi end-to-end based on parcel length. **Length unverified.**
- **Parking:** None dedicated. Adjacent Great Shiplock Park lot serves the area.
- **Restrooms:** Not documented. James River Association river/education center planned here — restroom status TBD. Treat as **none currently**.
- **Stroller-friendly:** Likely yes on Capital Trail through-segment (paved); unpaved interior trails unclear. Wheelchair: partial.
- **Allowed activities:** `hike`, `bird-watching`
- **Age guidance:** 0+ on the VCT through-segment; 4+ if interior trails are uneven.
- **Flood threshold:** Site is at riverfront grade and sits *outside* the floodwall (downstream of the Great Shiplock floodgate). Will flood at lower stages than the protected downtown. **No published gauge threshold**; defer to global gage-band rules and treat as flood-sensitive.
- **Flavor:** "Richmond's newest riverfront park — the view that named the city, now a quiet green stop on the Capital Trail."
- **Open questions:** Confirm surface type. Confirm whether the JRA River Center has opened (status as of 2026-06). Confirm flood behavior — this site is **outside** the floodwall and may close at much lower stages than Canal Walk.

### 5. Reedy Creek Trail

- **Canonical name:** Reedy Creek (per JRPS page title "Explore the Park: Reedy Creek"). **The user-described "trail connecting Forest Hill Park to Pony Pasture" is most likely the Buttermilk Trail, already seeded in the DB as `buttermilk-trail`** — accessed from the Reedy Creek parking lot, running roughly 22nd St ⇄ Boulevard Bridge. The JRPS "Reedy Creek" entity is the **headquarters/parking section + meadow + boat launch node**, not a named hiking trail. **Flag this for user.**
- **Suggested slug:** `reedy-creek`
- **Lat/lng:** ~37.5407, -77.4848 (parking at 4190 Riverside Dr, Richmond VA 23225). OSM cross-check pending. JRPS HQ also listed at 4001 Riverside Dr in some sources; trailhead lot is 4190.
- **Official URL:** https://jamesriverpark.org/explore-the-park-reedy-creek/
- **Surface:** Mixed. Gravel access road south through the tunnel under Riverside Dr; singletrack dirt where Buttermilk Trail crosses ([JRPS trails page](https://jamesriverpark.org/trails/); [JRPS Reedy Creek page](https://jamesriverpark.org/explore-the-park-reedy-creek/)).
- **Length:** No "Reedy Creek Trail" length is published. JRPS lists Buttermilk and Forest Hill Park (3.2 mi) as the named trails accessed here. The Reedy Creek area itself is a node, not a measured trail.
- **Parking:** Three lots along Riverside Dr, 43rd St, and 22nd St — **up to 90 vehicles total** per [JRPS Reedy Creek page](https://jamesriverpark.org/explore-the-park-reedy-creek/).
- **Restrooms:** Yes — changing room, bathroom, and ADA-accessible Port-a-Potty at Reedy Creek headquarters ([JRPS](https://jamesriverpark.org/explore-the-park-reedy-creek/)).
- **Stroller-friendly:** Partial. Gravel access road through the tunnel is stroller-passable; Buttermilk singletrack is not. Wheelchair: limited (HQ area only is ADA).
- **Allowed activities:** `hike`, `bird-watching`
- **Age guidance:** 6+ if doing singletrack Buttermilk; 0+ for the gravel meadow / HQ area. NPS "moderate" for Buttermilk; "easy" for the meadow.
- **Flood threshold:** Parking and meadow flood at Westham ~16 ft (Riverside Dr sections close at this stage per [NOAA Westham gauge impact statement](https://water.noaa.gov/gauges/rmdv2)). **Use Westham 16 ft as the closure threshold for the Reedy Creek lot/meadow.**
- **Flavor:** "JRPS headquarters and meadow — bathrooms, a launch, and the gravel road that opens up the rest of the south-bank trail network."
- **Open questions:** **Critical** — confirm with user whether "Reedy Creek Trail" means (a) the Reedy Creek node/meadow/HQ as JRPS uses the term, (b) the Buttermilk Trail (already seeded), or (c) something else known locally by that name. Recommendation: seed as `reedy-creek` representing the meadow/HQ node, and link to the existing `buttermilk-trail` for hiking.

### 6. The Wetlands

- **Canonical name:** The Wetlands (JRPS official section name)
- **Suggested slug:** `wetlands`
- **Lat/lng:** ~37.5470, -77.5360 (parking cul-de-sac at end of Landria Dr; address 3395 Landria Dr per [JRPS](https://jamesriverpark.org/explore-the-park-wetlands/); 3330 Landria Dr per Yelp listing — use JRPS-published 3395). OSM cross-check pending.
- **Official URL:** https://jamesriverpark.org/explore-the-park-wetlands/
- **Surface:** Mixed — wide gravel paths predominantly; some narrow singletrack; footbridges over wet sections ([JRPS trails page](https://jamesriverpark.org/trails/); [JRPS Wetlands page](https://jamesriverpark.org/explore-the-park-wetlands/)).
- **Length:** 2.5 miles ([JRPS trails page](https://jamesriverpark.org/trails/), rated "Easy"). Contiguous with Pony Pasture via connector trail.
- **Parking:** ~7 cars on the street in the Landria Dr cul-de-sac (per [Virginia DWR Birding Trail listing](https://dwr.virginia.gov/vbwt/sites/the-wetlands-to-pony-pasture-rapids-james-river-park-system/)). Very limited — overflow at Pony Pasture.
- **Restrooms:** Not documented at Wetlands itself. Pony Pasture (~0.5 mi away on connector) has facilities.
- **Stroller-friendly:** Partial — wide gravel paths are stroller-OK with effort; singletrack and footbridges are not jogging-stroller-friendly. Wheelchair: limited.
- **Allowed activities:** `hike`, `bird-watching` (JRPS page also lists paddle/swim/snorkel for the connected river beach — those are out of scope for this trail entry)
- **Age guidance:** 0+ on gravel paths; 4+ for footbridge / singletrack sections. Bird-blind / pond destination is family-friendly.
- **Flood threshold:** Sits in the floodplain — access path to the river beach and lower bridges go underwater first. Conservatively: **use Westham ~12–14 ft as a flag-for-caution threshold** (Pony Pasture parking floods at 16 ft per NOAA; Wetlands trails inundate earlier as low-lying floodplain). **No site-specific published threshold** — defer to global gage-band rules with a flag.
- **Flavor:** "Quiet gravel trails, a pond with wildlife blinds, and a hidden river beach — Pony Pasture's calmer next-door neighbor."
- **Open questions:** The brief asked us to disambiguate "wetlands trails." Selected **The Wetlands** (JRPS official section, off Landria Dr) as the most likely candidate because: (a) it's the only JRPS section that uses "wetlands" in its canonical name, (b) it's the only candidate with a dedicated JRPS "Explore the Park" page, (c) it has documented trails, parking, and an address. The "Deepwater Terminal wetlands at Ancarrow's Landing" candidate isn't a named JRPS trail destination — Ancarrow's is a boat ramp (separately handled in Cluster B). A "Reedy Creek wetlands" doesn't exist as a named JRPS feature. **Confirm with user before migration.**

---

### Cluster A — OPEN QUESTIONS for user

1. **Wetlands disambiguation (CRITICAL):** Confirm we should seed JRPS "The Wetlands" off Landria Dr (3395 Landria Dr, parking for ~7) as the `wetlands` location. Alternates considered (Deepwater Terminal at Ancarrow's; a "Reedy Creek wetlands") do not appear to be JRPS-named trail destinations.
2. **Reedy Creek scope (CRITICAL):** "Reedy Creek Trail" is not a named JRPS trail. JRPS uses "Reedy Creek" for the parking/meadow/HQ node; the named hiking trail accessed there is Buttermilk (already in DB). Confirm: do we (a) seed `reedy-creek` as the meadow/HQ node and link to existing `buttermilk-trail`, or (b) skip a new entity and add Reedy Creek context to the existing `buttermilk-trail` record?
3. **Virginia Capital Trail scope:** Seed as the full 52-mi trail with Richmond-terminus (Great Shiplock Park) framing, or seed only the first ~5 mi Richmond segment? Affects how "length" displays on the tile.
4. **Dock Street Park flood behavior:** This site is *outside* the floodwall (downstream of the Great Shiplock floodgate). It will flood at much lower Westham stages than Canal Walk. No site-specific threshold is published — should we default to a conservative ~12 ft Westham flag, or wait for the James River Association river-center opening to publish guidance?
5. **Floodwall Park length:** JRPS doesn't publish a single trail length; sources cite 0.5 mi (Floodwall Walk) vs. 2.0 mi (south-bank wall) vs. 3.2 mi (entire floodwall system). Which value should the tile display?
6. **Coordinates:** Several lat/lngs above are best-available estimates from search-surfaced sources rather than direct OSM lookups (Nominatim/Bash were blocked from this agent's tooling). Recommend OSM cross-checks for: Floodwall Park, Dock Street Park, Reedy Creek, The Wetlands, and the Canal Walk centroid before the migration ships.
7. **Restrooms at Canal Walk, Floodwall Park, Wetlands:** Not documented on official pages. Confirm via on-the-ground knowledge before flagging "restrooms: yes" on tiles.

## Cluster B — research findings

_Researched 2026-06-04. All four sites verified against authoritative sources (JRPS, City of Richmond, JRA, USGS/NOAA). Numeric claims cited inline._

### Shared context (applies to all 4 sites unless overridden)

- **Primary gauge for Westham-upstream sites:** USGS 02037500 (James River near Richmond, "Westham") — [waterdata.usgs.gov/monitoring-location/USGS-02037500](https://waterdata.usgs.gov/monitoring-location/USGS-02037500/). Also NWS rendering at [water.noaa.gov/gauges/rmdv2](https://water.noaa.gov/gauges/rmdv2).
- **JRPS global gauge thresholds (from `howsthejamesrva.com` and JRPS):**
  - ≤ 5 ft Westham — tubing/swimming generally OK; PFD required *above* 5 ft per JRPS river-safety guidance ([jamesriverpark.org/riversafety](https://jamesriverpark.org/riversafety/)).
  - ≥ 7.5 ft Westham — `howsthejamesrva.com` flags day as **unsafe** for recreational paddling.
  - ≥ 9 ft Westham — expert paddlers only per JRPS posts ([Facebook 2016 alert](https://www.facebook.com/jamesriverpark/posts/the-river-level-at-the-westham-gauge-is-now-below-9-feet-which-means-you-no-long/10154608167097417/)).
  - ≥ 13.5 ft Westham — portions of Huguenot Flatwater begin to flood.
  - ≥ 16 ft Westham — Huguenot Flatwater and Pony Pasture parking lots flooded; Tredegar parking access closes ([WRIC 2025-02-17 closure report](https://www.wric.com/weather/severe-weather/high-water-levels-james-river-richmond/)).
- **USCG PFD rule (federal):** children under 13 must wear a USCG-approved PFD on any recreational vessel underway on federal waters, unless below deck. Enforced in VA. — [boat-ed.com VA / 33 CFR 175.15](https://www.boat-ed.com/virginia/studyGuide/Specific-PFD-Requirements/10104702_49798/), [USCG memo](https://www.uscg.mil/Portals/0/Headquarters/Legal/CGHO/Civil%20Penalty%20Articles/COMMERCIAL%20VESSEL%20SAFETY%20EQUIPMENT/CHILD%20WEAR%20OF%20PERSONAL%20FLOTATION%20DEVICE1.pdf). VA DWR: [dwr.virginia.gov/equipment-regulations](https://dwr.virginia.gov/equipment-regulations/).
- **JRA James River Watch:** weekly bacteria sampling Memorial Day → Labor Day at ~38 watershed stations; results posted Fridays. Index page: [thejamesriver.org/james-river-watch](https://thejamesriver.org/james-river-watch/).

---

### 1. 14th Street Takeout

- **Canonical name:** 14th Street Takeout (JRPS official; also styled "14th Street Take-out")
- **Suggested slug:** `14th-street-takeout`
- **Lat/lng:** **37.531365, -77.431793** (parking lot) — published by RichmondOutside via Friends of JRPS / JROC ([richmondoutside.com](http://www.richmondoutside.com/destination/14th-street-takeout-jrps/), confirmed via [American Whitewater #1952](https://www.americanwhitewater.org/content/River/view/river-detail/1952/main))
- **Official URL:** [jamesriverpark.org/explore-the-park-tredegar-street-put-in-14th-street-take-out](https://jamesriverpark.org/explore-the-park-tredegar-street-put-in-14th-street-take-out/) (same JRPS page covers both Tredegar put-in and 14th St takeout)
- **USGS gauge:** Westham 02037500. This is the standard reference for the upstream rapids the paddlers just ran. The takeout itself sits at the falls/tidal boundary — see "Tidal" note below.
- **Ramp closure threshold:** No site-specific closure threshold published. JRPS Facebook precedent: at ≥ 9 ft Westham, only expert paddlers should be on the rapids upstream — so practically this takeout sees expert traffic only. At ≥ ~16 ft Westham, the riverside-of-floodwall access road and parking flood (same regime as Tredegar). **Defer to global gage-band rules.**
- **JRA James River Watch coverage:** Not a JRA-listed station. The nearest tested sites are Tredegar Beach (just upstream) and Pony Pasture / Huguenot further upstream — see [thejamesriver.org/james-river-watch](https://thejamesriver.org/james-river-watch/).
- **Parking:** ~12 vehicles in the dedicated lot on the river side of the floodwall ([richmondoutside.com](http://www.richmondoutside.com/destination/14th-street-takeout-jrps/)). Lot lat/lng 37.531365, -77.431793.
- **Restrooms:** None on-site (per JRPS page; not listed).
- **Allowed activities (slugs):** `kayak-rapids` only — this is a whitewater EXIT, not a put-in or swim/wade site. Steps built 2005 by JROC + Friends of JRPS. No swim/wade/fish framing in JRPS copy.
- **Age guidance:** Whitewater exit after Class II–III rapids (Hollywood, Pipeline) ([American Whitewater #1952](https://www.americanwhitewater.org/content/River/view/river-detail/1952/main)). Not a family/kid destination — adults and experienced paddlers only. USCG under-13 PFD rule applies en route.
- **Tidal vs freshwater:** This is **the falls–tidal transition** ("the first takeout as the James turns tidal" — RichmondOutside). Technically the tidal estuary begins just below. For water-quality interpretation, treat as freshwater–tidal boundary.
- **Flavor description (≤140 char):** Where whitewater paddlers come ashore after running Hollywood and Pipeline. Not a hangout spot — a serious exit point.
- **Uncertainty / open questions:** (a) Whether to publish this at all for a family dashboard — it's an expert exit, not a kid spot. Recommend `published=false` or "Information only" framing. (b) Restroom confirmation — appears to be none.

---

### 2. Tredegar Boat Ramp

- **Canonical name:** Tredegar Street Put-in (JRPS official). Often referred to colloquially as "Tredegar Boat Ramp."
- **Suggested slug:** `tredegar-boat-ramp`
- **Lat/lng:** **37.53469, -77.44578** (paddling.com / Tredegar Area Landing entry; cross-checked vs JRPS description "east of the Belle Isle Pedestrian Bridge on Tredegar Street") — [paddling.com](https://paddling.com/paddle/locations/tredegar-area-landing)
- **Official URL:** [jamesriverpark.org/explore-the-park-tredegar-street-put-in-14th-street-take-out](https://jamesriverpark.org/explore-the-park-tredegar-street-put-in-14th-street-take-out/)
- **USGS gauge:** Westham 02037500.
- **Ramp closure threshold:** No publicly documented site-specific stage. Ramp rebuilt ~2023 (JRPS + City + JROC, $50k project) to serve Richmond Fire Dept swift-water rescue ([jamesriverpark.org/river-safety-improvements](https://jamesriverpark.org/river-safety-improvements/)). Parking on Tredegar St floods during high-water events per WRIC closure list. **Defer to global gage-band rules** (5 ft PFD, 7.5 ft unsafe, 9 ft expert-only, parking floods at high stages).
- **JRA James River Watch coverage:** Yes — **"Tredegar Beach"** is a JRA-tested station, weekly Memorial Day → Labor Day ([Swim Guide entry #7490](https://www.theswimguide.org/beach/7490), [thejamesriver.org/james-river-watch](https://thejamesriver.org/james-river-watch/)). Sampling location is the riverside flat just downstream of the ramp.
- **Parking:** Paid lot at American Civil War Museum at Historic Tredegar (per JRPS page); capacity not officially published. Some street parking on Tredegar St.
- **Restrooms:** Not on JRPS page; American Civil War Museum has restrooms during operating hours but those are not a JRPS facility.
- **Allowed activities (slugs):** `kayak-rapids`, `fishing` (bank/light). **Swimming explicitly NOT allowed at the boat ramp** per JRPS. ADA concrete walkway to first landing of the takeout.
- **Age guidance:** This is a serious-paddler put-in — JRPS copy: "for serious paddlers who can navigate the Hollywood rapids." Not a beginner launch. USCG under-13 PFD rule applies. AAP guidance: continuous adult touch-supervision for under-5 near any water access.
- **Tidal vs freshwater:** Freshwater (above the falls).
- **Flavor description (≤140 char):** The downtown launch where expert paddlers head into Hollywood Rapids. Rebuilt 2023 — same ramp the Fire Dept uses for rescues.
- **Uncertainty / open questions:** (a) Exact parking-lot capacity. (b) Whether "Tredegar Beach" (the JRA-tested swim spot) is the same point as the boat ramp or a sandy spot ~50 ft away — likely adjacent but worth confirming if we surface a swim activity here.

---

### 3. Ancarrow's Landing

- **Canonical name:** Ancarrow's Landing (per City of Richmond Parks & Rec and JRPS)
- **Suggested slug:** `ancarrows-landing`
- **Lat/lng:** **37.5083, -77.4272** (Google Maps centroid for "Ancarrow's Landing, Richmond, VA"; matches HMDB marker 37°31.188′N 77°25.141′W = 37.5198, -77.4190 for the historical-marker location nearby — coords vary because the park is large). Use **37.5083, -77.4272** for the boat ramp. ([Google Maps](https://www.google.com/maps/place/Ancarrow's+Landing,+Richmond,+VA/), [HMDB marker](https://www.hmdb.org/m.asp?m=133682))
- **Address:** 1400 Brander St, Richmond VA 23224 (Yelp/JRPS list 1200 vs 1400 Brander; City/Yelp authoritative on 1400)
- **Official URL:** [jamesriverpark.org/explore-the-park-ancarrows-landing-historic-manchester-slave-docks](https://jamesriverpark.org/explore-the-park-ancarrows-landing-historic-manchester-slave-docks/) (JRPS); also [rva.gov Parks & Rec](https://www.rva.gov/parks-recreation/james-river-park-system)
- **USGS gauge:** **Mixed.** The site is *below* the fall line so the Westham gauge (02037500) is upstream and doesn't directly describe local conditions. **Better references:**
  - USGS 02037705 — James River at City Locks at Richmond ([waterdata.usgs.gov/monitoring-location/USGS-02037705](https://waterdata.usgs.gov/monitoring-location/USGS-02037705/))
  - NOAA Tides & Currents Richmond River Locks, station **8638495** ([tidesandcurrents.noaa.gov/stationhome.html?id=8638495](https://tidesandcurrents.noaa.gov/stationhome.html?id=8638495))
- **Ramp closure threshold:** No site-specific stage published. Operates 24/7 year-round per City of Richmond. During Westham high-water events the upstream debris can affect motorized navigation; no formal closure threshold found. **Defer to NOAA tidal forecast + Westham flood warnings.**
- **JRA James River Watch coverage:** Search did not surface Ancarrow's as a named JRA station; the tidal Richmond sites covered by JRA tend to be downstream (Hopewell at Route 10, etc.). **Likely no direct JRA bacteria data — flag as "no on-site JRA station; tidal-zone water-quality dynamics differ from upstream."**
- **Parking:** Large lot with car/trailer spaces; overflow lines Brander St + under I-95 during shad run ([rvajamesriverfishingreport.com/ancarrows-landing](https://www.rvajamesriverfishingreport.com/ancarrows-landing)). Exact capacity not published.
- **Restrooms:** Per JRPS page — not explicitly listed; some sources mention seasonal port-a-johns. **Confirm with City Parks & Rec.**
- **Allowed activities (slugs):** `fishing` (shad, catfish — annual run draws crowds), `bird-watching` (wetlands adjacent), `hike` (Slave Trail terminus, mountain bike trail loop). **Motorized boating** — this is the only motorized launch in JRPS. No `swim` / `wade` recommended (tidal industrial-corridor water, near former chemical plant remediation site).
- **Age guidance:** USCG under-13 PFD rule applies for any boat ride. Not a swim/wade spot for kids. Slave Trail walk is suitable for all ages with adult.
- **Tidal vs freshwater:** **Tidal/brackish.** "Where the Falls of the James meet tidal waters." Bacterial dynamics differ from upstream freshwater — JRA notes brackish sites are tested for salinity in addition to bacteria. Different interpretive frame than Westham-keyed sites.
- **Flavor description (≤140 char):** Tidal-zone launch at the Slave Trail terminus. Motorboats, shad fishing in spring, wetlands birding — not a swim spot.
- **Uncertainty / open questions:** (a) Restrooms — seasonal port-a-johns? Confirm with City. (b) Whether to use NOAA 8638495 vs USGS 02037705 as the primary gauge for closure logic. (c) JRA testing status — appears not directly tested; flag as "no on-site bacteria data."

---

### 4. Huguenot Flatwater

- **Canonical name:** Huguenot Flatwater (JRPS official)
- **Suggested slug:** `huguenot-flatwater`
- **Lat/lng:** Approx **37.5645, -77.5614** (derived from "8600 Riverside Drive" / "8600 Southampton Rd" — JRPS sources give conflicting street addresses, both resolve to the same parcel just west of Huguenot Memorial Bridge). **Recommend verifying via OSM before seeding.**
- **Official URL:** [jamesriverpark.org/explore-the-park-huguenot-flatwater](https://jamesriverpark.org/explore-the-park-huguenot-flatwater/)
- **USGS gauge:** Westham 02037500 (upstream of the falls — Westham is the canonical reference).
- **Ramp closure threshold:** **Site-specific data available.** At ≥ 13.5 ft Westham, portions of Huguenot Flatwater begin to flood; at ≥ 16 ft, the parking lot floods and the lot closes (per [WRIC 2025-02-17](https://www.wric.com/weather/severe-weather/high-water-levels-james-river-richmond/)). Above the falls, calm flatwater paddling — but **Z Dam and Bosher's Dam are downstream and are recognized low-head drowning hazards** per JRPS.
- **JRA James River Watch coverage:** **Yes** — Huguenot Flatwater is a JRA-tested station, weekly Memorial Day → Labor Day ([Swim Guide entry #7489](https://www.theswimguide.org/beach/7489), [thejamesriver.org/james-river-watch](https://thejamesriver.org/james-river-watch/)).
- **Parking:** Sizeable shaded lot per JRPS; "fills quickly on sunny weekends" — exact capacity not published. ADA-compliant ramp renovated 2023 ([JROC universal-access project](https://jroc.net/universal-access-at-huguenot-flatwater/), [Timmons Group](https://www.timmons.com/project/huguenot-flatwater-accessible-launch/)).
- **Restrooms:** Port-a-potty on site (JRPS page). Seasonal availability not documented; treat as year-round portable.
- **Allowed activities (slugs):** `kayak` (flatwater — NOT `kayak-rapids`), `fishing` (bank), `swim` (JRA-tested, some swimmers; framing should warn about Z Dam / Bosher's downstream), `bird-watching`, `hike` (footpaths to shoreline). Calm water above the rapids — appropriate for beginners and families with strong supervision.
- **Age guidance:** Calmest paddling spot in JRPS — appropriate for kids in PFDs with adult paddler. USCG under-13 PFD rule applies. AAP "touch supervision" for under-5 near water. **Strong warning about drift-downstream danger:** Z Dam and Bosher's Dam are reachable from here by current.
- **Tidal vs freshwater:** Freshwater (well upstream of the fall line).
- **Flavor description (≤140 char):** The calm-water put-in upstream of the falls — kayaking, tubing, and Sunday paddles. Watch for Z Dam downstream.
- **Uncertainty / open questions:** (a) Authoritative lat/lng — JRPS lists two street addresses (8600 Riverside Dr vs 8600 Southampton Rd). Confirm via City GIS or OSM before seeding. (b) Parking capacity. (c) Whether the JRA-tested swim spot is the boat ramp itself or an adjacent informal beach.

---

### Open questions for the user (Cluster B)

1. **14th Street Takeout — publish or hide?** This is an expert whitewater exit, not a family destination. Recommend `published=false` or an "Information only / no kid activities" framing. Confirm.
2. **Ancarrow's gauge wiring.** Westham (02037500) doesn't describe tidal conditions at Ancarrow's. Should we (a) use NOAA Richmond River Locks 8638495 for the tidal forecast, (b) use USGS 02037705 (James at City Locks), or (c) both? Affects how the location-status row resolves for this site.
3. **Ancarrow's water-quality framing.** No JRA James River Watch station appears to be at Ancarrow's directly. Surface "no bacteria data — tidal industrial corridor; not recommended for swim/wade" or stay silent on water quality?
4. **Tredegar Beach swim status.** The JRA-tested "Tredegar Beach" appears to be adjacent to but distinct from the boat ramp ("swimming not allowed at the boat ramp" per JRPS). Do we model them as one location (`tredegar-boat-ramp` with a swim activity) or two?
5. **Huguenot Flatwater address.** JRPS uses 8600 Riverside Drive in one entry and 8600 Southampton Rd in another. Confirm canonical address before seeding lat/lng.
6. **Z Dam / Bosher's Dam downstream warning copy.** Huguenot Flatwater allows calm paddling but the dams downstream are killers. Should the location card carry a hard warning, or do we save dam-hazard framing for a future Williams Island / Bosher's location (Cluster C)?
7. **Restroom seasonality** at Ancarrow's and Tredegar — neither JRPS page lists year-round restrooms. Field-verify or mark "seasonal port-a-john, confirm before visit."

## Cluster C — research findings

_Researched 2026-06-04. All four sites carry safety framing, not just standard activity grids. Sources cited inline. Coordinates marked "OSM cross-check pending" are best-available decimal-degree estimates from search-surfaced sources — should be re-verified against OSM before the migration ships._

### Shared context for Cluster C

- **Low-head dam safety baseline:** Low-head dams trap victims in a "reverse roller" — water flows over the crest, dives, recirculates upstream at the boil zone, and re-submerges anything floating ([American Rivers low-head dam safety](https://www.americanrivers.org/low-head-dam-safety/); [NWS / NOAA Low Head Dam Safety Awareness Month](https://www.weather.gov/lmk/LowHeadDamPublicSafetyAwarenessMonth); [ASCE "Drowning Machines" 2021](https://www.asce.org/publications-and-news/civil-engineering-source/civil-engineering-magazine/article/2021/01/engineers-work-to-reduce-drowning-deaths-at-low-head-dams)). Approximately 50 fatalities per year nationally; ~10,000 such dams in the U.S. The hazard is invisible from upstream — flat water hides it.
- **JRPS official posture on the James dams:** JRPS [Use Caution on the River](https://jamesriverpark.org/use-caution-on-the-river/) explicitly calls out Z-Dam as "alone responsible for many drownings, and a feature commonly referred to as a 'Drowning Machine.'"
- **Climbing — youth guidance:** USA Climbing's U11 category (ages 9–10) has no minimum age and accepts younger participants in structured programs ([USA Climbing rules](https://usaclimbing.org/about/resources/policies/); [Climbing Business Journal on age categories](https://climbingbusinessjournal.com/changes-to-youth-age-categories/)). Most gyms accept supervised youth from ~age 4–5. Outdoor traditional/sport climbing typically requires belay-cert competency and is gym-graduates-only — no published authoritative minimum age for outdoor crags. Treat ages 8+ as the practical floor with adult-supervised top-rope; defer "lead" to teens.

---

### 1. Tredegar Rope Swing

- **Canonical name:** Tredegar Rope Swing (informal; no official designation by JRPS). Located in the "Tredegar Beach" eddy below the CSX railroad trestle between Brown's Island and Belle Isle.
- **Suggested slug:** `tredegar-rope-swing`
- **Lat/lng:** ~37.5345, -77.4400 (eddy below the CSX viaduct, riverside of 500-block Tredegar St). Coords inferred from JRPS Tredegar Beach / Brown's Island anchors; OSM cross-check pending.
- **Official URL:** **No authoritative URL — JRPS does not document the rope swing.** The closest official references are the [JRPS Tredegar Street put-in page](https://jamesriverpark.org/explore-the-park-tredegar-street-put-in-14th-street-take-out/) and the JRA [Tredegar Beach Swim Guide entry #7490](https://www.theswimguide.org/beach/7490) — neither acknowledges the swing as a sanctioned feature.
- **Owner / operator:** The eddy is City-owned (JRPS managed); the rope itself is hung informally from a CSX-owned railroad trestle. CSX has not sanctioned recreational use. No agency operates or inspects the swing.
- **Surface / type:** Sandy/rocky river beach in an eddy below Class II rapids. The swing hangs ~40 ft above the river per [WTVR 2013](https://www.wtvr.com/2013/08/10/holmberg-the-case-of-the-missing-rope-swing).
- **Parking:** Tredegar Street paid lot at American Civil War Museum (same as `tredegar-boat-ramp`); street parking on Tredegar.
- **Restrooms:** None on-site; museum restrooms only during operating hours.
- **Allowed activities (slugs):** `swim` only from the existing slug set. The rope swing itself is **not represented** by any current slug. **OPEN QUESTION:** add a new `rope-swing` slug or fold under `swim` with a hazard note? The brief flagged this — recommend NOT introducing a new slug; instead surface the swing in flavor copy + warning copy and tag activity as `swim` with elevated risk framing.
- **Age guidance with citation:** **Minimum 14, adult-supervised — recommended floor.** Justification: (a) AAP recommends no rope-swing or platform jumping into open water for children under their swim-competency threshold; (b) the eddy is adjacent to Class II rapids — drift from the eddy into current is a documented failure mode; (c) historical incident record (see below) clusters in young-adult demographic, not children. No authoritative single source publishes "min age for informal rope swings"; the 14 floor reflects USCG/AAP open-water swim guidance combined with the informal-site / no-lifeguard / no-inspected-rope reality.
- **Incident record (citations required for warning copy):**
  - **2009 May 31** — Adult male drowned after using the rope swing; landed in water, resurfaced briefly, submerged ([12 On Your Side](https://www.12onyourside.com/story/10971365/rescuers-warn-of-rope-swing-dangers/)).
  - **2009** — Second incident: adult male doing a back-flip off the swing went under; bystanders performed CPR ([12 On Your Side](https://www.12onyourside.com/story/10971365/rescuers-warn-of-rope-swing-dangers/)).
  - **2011** — Ashley Nicole Wallace, 24, of Midlothian, drowned in the same eddy in ~2 ft of water while swimming with friends ([WTVR / 12 On Your Side](https://www.12onyourside.com/story/15272615/body-of-woman-found-in-james-river/)).
  - **2026 April** — Pramanik Rukunuzzaman, 21, of Henrico, died in an apparent drowning at the 500 block of Tredegar Street ([rva.gov press release](https://rva.gov/press-releases-and-announcements/news/person-identified-apparent-drowning-james-river); [12 On Your Side](https://www.12onyourside.com/2026/04/19/richmond-police-investigate-drowning-james-river-officials-warn-water-safety/)).
  - **2013 WTVR feature** notes "three drownings in this eddy during the past decade" alone ([WTVR Holmberg 2013-08-10](https://www.wtvr.com/2013/08/10/holmberg-the-case-of-the-missing-rope-swing)).
- **Site-specific flood / closure threshold:** No site-specific published threshold. The eddy is on the river side of the floodwall and tracks Westham. At ≥ 5 ft Westham, JRPS requires PFDs; at ≥ 9 ft, only expert paddlers — informal swim/swing use becomes acutely dangerous. Conservatively recommend flagging the site as **closed for under-14 use whenever Westham ≥ 5 ft**; otherwise defer to Westham global rules.
- **Flavor (≤140 char):** "Informal rope swing in the eddy below the CSX trestle. Older kids only — no lifeguards, no inspection, real history of incidents."
- **Recommendation: publish or unpublished?** **Recommend `published=true` BUT with explicit framing:** (a) min_age 14; (b) hazard banner referencing 2009 / 2011 / 2026 incidents; (c) close at Westham ≥ 5 ft; (d) "informal site — no agency operates this" copy. Hiding it doesn't help — kids find the eddy via Belle Isle / Brown's Island anyway. Surfacing it with truthful framing is the more defensible posture.
- **Open questions:**
  - Confirm coordinates against OSM.
  - Decide: new `rope-swing` activity slug, or surface in copy only (recommended).
  - Decide whether the location entity is the rope swing specifically or the broader "Tredegar Beach" swim eddy (in which case it could be a JRA-tested swim spot, blurring the framing — see Cluster B open question on Tredegar Beach modeling).

---

### 2. Manchester Climbing Wall

- **Canonical name:** Manchester Climbing Wall (JRPS official). Also known as "Manchester Wall."
- **Suggested slug:** `manchester-climbing-wall`
- **Lat/lng:** ~37.5298, -77.4360 (south bank, southern end of T. Tyler Potterfield Memorial Bridge, accessible from Floodwall Park parking). OSM cross-check pending.
- **Official URL:** https://jamesriverpark.org/explore-the-park-manchester-climbing-wall/
- **Owner / operator:** City of Richmond / JRPS. Managed by Friends of James River Park ([JRPS](https://jamesriverpark.org/explore-the-park-manchester-climbing-wall/)). The wall itself is a granite remnant of the 1838 Richmond & Petersburg Railroad Bridge ([Bay Journal](https://www.bayjournal.com/travel/climb-up-a-piece-of-history-at-richmond-s-manchester-wall/article_4a7fe9d2-4534-11ef-bf45-f7a708e07185.html); [Mountain Project](https://www.mountainproject.com/area/106006682/manchester-wall)).
- **Surface / type:** ~60-foot granite wall, outdoor. 40+ established climbing routes per JRPS; Mountain Project catalogs 43 routes from 5.4 to 5.10d ([Mountain Project](https://www.mountainproject.com/area/106006682/manchester-wall)). Routes are bolted (sport) with anchors at top; supports top-rope, lead, and rappel practice. "The Ladder" (closest to the river) is the standard beginner route.
- **Permitted use:** Open to the public, no permit required, **sunrise to sunset every day** per [JRPS](https://jamesriverpark.org/explore-the-park-manchester-climbing-wall/). Closed in 2020 briefly for COVID per [WRIC](https://www.wric.com/news/local-news/richmond-closes-manchester-climbing-wall-stops-traffic-in-chimborazo-park-covid-19/); now reopened. No published restriction on traditional/top-rope use — the wall is fully sanctioned for climbing (distinct from many Manchester floodwall climbing access points historically restricted).
- **Equipment required:** Climber-supplied rope, harness, helmet, belay device, quickdraws. No on-site gear. Top-rope anchors and bolts are in place ([Mountain Project](https://www.mountainproject.com/area/106006682/manchester-wall); [PATC Mountaineering "Gym to Crag" event](https://potomacmountainclub.org/event/gym-to-crag-sport-climbing-at-manchester-wall-in-richmond/)).
- **Parking:** Floodwall Park lot at south end of 14th Street Bridge off Hull St ([JRPS Floodwall Park](https://jamesriverpark.org/explore-the-park-floodwall-park/)). Bike rack on-site at the wall. ~5–10 min walk from lot.
- **Restrooms:** Not on-site at the wall. None published for Floodwall Park.
- **Allowed activities (slugs):** `rock-climbing`, `bird-watching`, `hike` (Floodwall Walk approach). Note: `rock-climbing` already exists on `belle-isle` from migration 0016 — per the brief, keep that record AS-IS and add this as a separate, distinct location. Belle Isle's `rock-climbing` is bouldering on river rocks; Manchester is sanctioned top-rope/sport on a vertical 60-ft wall — meaningfully different activity context.
- **Age guidance with citation:** **Min age 8, adult-supervised top-rope only.** Justification: USA Climbing U11 category accepts ages 9–10 with younger participants permitted in structured programs ([USA Climbing rules](https://usaclimbing.org/about/resources/policies/)). U15 is top-rope-only for rope events. No authoritative minimum exists for outdoor crags; the 8+ floor reflects industry norm that gym-graduates can climb outdoor with competent adult belayer. **Recommend `min_age = 8` with explicit "adult belayer required" copy.** Lead climbing is teen+ at most facilities.
- **Site-specific flood / closure threshold:** Wall sits on south bank above floodplain at floodwall elevation. Not directly threatened by river stage; the approach (Floodwall Walk) closes when City closes floodgates. **Defer to Westham global gage-band rules + Floodwall Park closure status.**
- **Flavor (≤140 char):** "Sixty feet of granite from an 1838 railroad bridge — Richmond's only sanctioned outdoor climbing wall. Bring your own rope and a belayer."
- **Recommendation: publish or unpublished?** **Recommend `published=true`.** This is a fully sanctioned JRPS site with an "Explore the Park" page, official hours, established routes, and no historical access controversy. The Bay Journal travel feature and PATC's recurring "Gym to Crag" event confirm active, legitimate use. Frame as "adult-belayer required, gear-supplied, age 8+."
- **Open questions:**
  - Confirm OSM coordinates.
  - Confirm whether to introduce a sub-distinction (e.g. `top-rope-climbing` slug) to differentiate from Belle Isle's bouldering, or rely on flavor + age copy to convey the difference. Recommend the latter — no new slug.
  - One news report ([RVAHub 2018-01-08](https://rvahub.com/2018/01/08/man-injured-falling-manchester-climbing-wall/amp/)) references a 25–30 ft fall on the Manchester Climbing Wall area with non-life-threatening injuries — worth noting in safety copy that falls happen even at this sanctioned site.

---

### 3. Williams Island Dam Park

- **Canonical name:** **CRITICAL FINDING — no entity named "Williams Island Dam Park" appears in JRPS, City, or Henrico County records.** The user's framing maps to one of two plausible candidates:
  1. **Riverside Meadows** (JRPS) — 2-acre walk-in greenspace on Riverside Drive, west of Pony Pasture, with a walking trail and views of Williams Island and Z-Dam. **NO PARKING on-site; walk/bike-in only.** ([JRPS Riverside Meadows](https://jamesriverpark.org/explore-the-park-riverside-meadows/); [Visit Richmond](https://www.visitrichmondva.com/listing/riverside-meadows/4695/))
  2. **Williams Island itself** — 95-acre wildlife preserve owned by City of Richmond Public Utilities, operated by JRPS. **Boat-only access; no shore-side park.** ([JRPS Williams Island](https://jamesriverpark.org/explore-the-park-williams-island/))
- **Recommendation:** Seed **Riverside Meadows** as the public-access land entity. It is the only land-based public viewpoint of Williams Island Dam / Z-Dam, and JRPS has an "Explore the Park" page for it. Treat Williams Island and its dams as **hazards documented on /safety**, not as a published location card. Suggested slug: `riverside-meadows`.
- **Suggested slug:** `riverside-meadows`
- **Lat/lng:** ~37.5598, -77.5680 (Riverside Drive west of Pony Pasture, ~0.5 mi upstream of Pony Pasture parking; OSM cross-check pending — this is an estimate from the description "just west of Pony Pasture Rapids Park").
- **Official URL:** https://jamesriverpark.org/explore-the-park-riverside-meadows/
- **Owner / operator:** City of Richmond / JRPS (per Visit Richmond and JRPS).
- **Surface / type:** Walking trail through 2-acre meadow; surface not explicitly published — treat as **mixed/grass/dirt** pending confirmation.
- **Parking:** **None on-site.** Walk/bike-in from adjacent Pony Pasture parking (~0.3 mi east on Riverside Dr).
- **Restrooms:** None on-site; nearest at Pony Pasture.
- **Allowed activities (slugs):** `hike`, `bird-watching` (bald eagles, osprey, great blue herons, otters reported). **No swim / wade / kayak** — the meadow does not have safe river-access; the Williams Island side has Z-Dam.
- **Age guidance:** 0+ for the walking trail and viewpoint (stroller-passable on grass, with caveats). NPS "easy" tier. **Do NOT promote any river-water contact from this location** — the river view is across from Z-Dam.
- **Site-specific flood / closure threshold:** 2-acre meadow sits in the floodplain along Riverside Dr; lower portions inundate at Westham ~13–14 ft (Riverside Dr begins closing per NOAA gauge impacts at ~16 ft, with adjacent low-lying segments earlier). **Defer to Westham global gage-band rules.**
- **Flavor (≤140 char):** "A two-acre meadow with the best land view of Williams Island and Z-Dam. Walk-in only — no parking, no river access, just the view."
- **Recommendation: publish or unpublished?** **Recommend `published=true`** with low-key framing — quiet pedestrian site, no water hazard, viewpoint-only. **Critically, do NOT model this as offering swim/wade/kayak** even though those activities happen elsewhere on Williams Island — that misrepresents the access reality.
- **Open questions:**
  - **CRITICAL:** Confirm with user that "Williams Island Dam Park" → Riverside Meadows is the right mapping. If the user meant something else (e.g. a Henrico County park north of the river), that location does not appear in our sources.
  - Confirm OSM coordinates.
  - Confirm whether stroller-friendly framing holds (meadow surface is unverified).

#### Dam hazards — for /safety page

Three dams cluster in the upstream Richmond reach. Each is a documented drowning hazard. None should be modeled as recreation locations.

- **Z-Dam (Williams Island Z-Dam)**
  - **Coordinates:** ~37.5596, -77.5688 (south channel between Williams Island and the south bank, just upstream of Pony Pasture)
  - **Type / height:** Low-head dam, rebuilt 1932 (concrete); 30-foot notch added 1993 for fish passage. Height not explicitly published but consistent with the 7-foot low-head profile reported for the Williams Island system overall.
  - **Why dangerous:** Classic "drowning machine" reverse-roller hydraulic — invisible from upstream, water flowing over the crest dives, recirculates upstream at the boil zone, repeatedly resubmerges victims ([American Rivers](https://www.americanrivers.org/low-head-dam-safety/); [NWS LMK](https://www.weather.gov/lmk/LowHeadDamPublicSafetyAwarenessMonth)).
  - **Incident record:** "20 people have died at the Z-Dam in the past 20 years" per [WTVR 2017-06-19 firefighter feature](https://www.wtvr.com/2017/06/19/firefighter-points-out-deadliest-spot-on-the-james-river). [NBC12 2013](https://www.nbc12.com/story/22762244/4-people-rescued-from-james-at-z-dam/) documents a rescue of 4 stranded paddlers near Z-Dam.
  - **Threshold at which danger increases:** "Most dangerous when the water rises between six to seven feet" Westham per [WTVR](https://www.wtvr.com/2017/06/19/firefighter-points-out-deadliest-spot-on-the-james-river). At those stages the dam can become "invisible" — drowned in the smooth high-water surface — and the hydraulic intensifies. New warning signage installed after Memorial Day 2017 drowning per [WRIC](https://www.wric.com/news/local-news/chesterfield-county/after-tragic-memorial-day-drowning-dangerous-james-river-dam-gets-new-warning-signs/).
  - **JRPS posture:** Z-Dam explicitly called out in [Use Caution on the River](https://jamesriverpark.org/use-caution-on-the-river/) as "alone responsible for many drownings."

- **Williams Island Dam (north channel)**
  - **Coordinates:** ~37.5601, -77.5701 (north channel between Williams Island and Dead Man's Hill on the north bank)
  - **Type / height:** Gravity dam, 7 ft (2.1 m) per [Williams Island Dam Wikipedia](https://en.wikipedia.org/wiki/Williams_Island_Dam), built 1905 for City drinking-water diversion. Runs from northeast shore of the island to the north bank.
  - **Why dangerous:** Same low-head-dam hydraulics as Z-Dam. North channel is described as "much more peaceful and calm" — which is exactly the deceptive appearance that defines the drowning-machine pattern ([JRPS Williams Island](https://jamesriverpark.org/explore-the-park-williams-island/)).
  - **Incident record:** Sources do not separately tally Williams Island Dam deaths from Z-Dam deaths — the figures are often combined ("Bosher's and Z-Dam" or "the dams near Williams Island"). [WRIC's "drowning machines" feature](https://www.wric.com/news/virginia-news/why-low-head-dams-are-called-drowning-machines-and-how-many-are-in-virginia/) treats the cluster as a single threat zone.
  - **Threshold:** Same as Z-Dam — Westham ≥ 6 ft is the published red zone.

- **Bosher's Dam (~1 mile upstream of Williams Island)**
  - **Coordinates:** 37.5601, -77.5397 per [HometownLocator](https://virginia.hometownlocator.com/maps/feature-map,ftc,2,fid,1490072,n,bosher%20dam.cfm); also cited as 37.5601467, -77.5397089 in [Wikipedia](https://en.wikipedia.org/wiki/Bosher_Dam) summaries.
  - **Type / height:** 12-foot stone low-head dam, 1835 original / current iteration mid-19th century. Spans the river between Tuckahoe (Henrico) and west Richmond just upstream of the Edward E. Willey Bridge.
  - **Why dangerous:** Same drowning-machine hydraulic. Reported as having "caused a number of deaths" per encyclopedic sources. The 1999-opened fish ladder ([VA DWR Bosher's Dam fishway](https://dwr.virginia.gov/fishing/fish-passage/boshers/)) routes migratory shad/herring/striped bass around the dam — but does not reduce the dam's recreation hazard.
  - **Incident record:** [WRIC Memorial Day feature](https://www.wric.com/news/local-news/richmond/photos-what-happened-at-the-river-in-richmond-on-memorial-day/) documents a memorial-day drowning; sources combine Bosher's + Z-Dam tallies and reference "many drownings" without a per-dam count.
  - **Threshold:** Hazard increases at high flow when the dam crest becomes less visible from upstream. Westham gauge applies (Bosher's is upstream of Westham, so Westham figures lag Bosher's local conditions).

- **General /safety page citation set:**
  - [American Rivers — Low-Head Dam Safety](https://www.americanrivers.org/low-head-dam-safety/)
  - [NWS / NOAA — Low Head Dam Public Safety Awareness Month](https://www.weather.gov/lmk/LowHeadDamPublicSafetyAwarenessMonth)
  - [ASCE — Engineers work to reduce drowning deaths at low-head dams](https://www.asce.org/publications-and-news/civil-engineering-source/civil-engineering-magazine/article/2021/01/engineers-work-to-reduce-drowning-deaths-at-low-head-dams)
  - [WRIC — Why low-head dams are called drowning machines](https://www.wric.com/news/virginia-news/why-low-head-dams-are-called-drowning-machines-and-how-many-are-in-virginia/)
  - [JRPS — Use Caution on the River](https://jamesriverpark.org/use-caution-on-the-river/)
  - [WTVR — Firefighter points out deadliest spot on the James](https://www.wtvr.com/2017/06/19/firefighter-points-out-deadliest-spot-on-the-james-river)

---

### 4. Chapel Island

- **Canonical name:** Chapel Island (JRPS official; co-listed with Great Shiplock Park on the same JRPS page).
- **Suggested slug:** `chapel-island`
- **Lat/lng:** ~37.5260, -77.4195 (just downstream/east of Great Shiplock Park at 2803 Dock St; small island connected to Great Shiplock by a footbridge). OSM cross-check pending.
- **Official URL:** https://jamesriverpark.org/explore-the-park-great-shiplock-park-chapel-island/
- **Owner / operator:** **Public access is sanctioned and legally clear.** The island sits beneath CSX-owned railroad trestles ([CSX press release on the Low Line partnership](https://www.csx.com/index.cfm/about-us/media/press-releases/csx-capital-trees-and-the-city-of-richmond-partner-to-create-the-low-line-a-55-acre-environmental-and-beautification-project-along-the-virginia-capital-trail/)), but the island itself is part of the James River Park System. Capital Trees, in partnership with the City of Richmond and CSX, completed a 2013 renovation that built the trail network ([Capital Trees Low Line](https://capitaltrees.org/projects/low-line/); [rvaMORE Chapel Island trails](https://new.rvamore.org/trails/jrps/chapel-island/)). Subsequent habitat restoration ongoing via [JRA](https://thejamesriver.org/restoring-chapel-island-uncovering-history-and-restoring-habitat-along-the-james-river/).
- **Surface / type:** 11-acre island. ~0.5 mi gravel trail loop with interpretive signs ([rvaMORE](https://new.rvamore.org/trails/jrps/chapel-island/)); central gravel path continues west to the 14th Street boat take-out ([JRPS](https://jamesriverpark.org/explore-the-park-great-shiplock-park-chapel-island/)). Sandy beach and canoe/kayak launch on the island.
- **Parking:** None on Chapel Island itself. Use Great Shiplock Park lot (Dock & Pear Sts) — same lot as Virginia Capital Trail Richmond terminus.
- **Restrooms:** Not documented at Chapel Island or Great Shiplock specifically; portable toilets typical at JRPS sites.
- **Allowed activities (slugs):** `hike`, `fishing` (tidal shad, white perch, rockfish, smallmouth bass, herring, catfish per JRPS), `bird-watching`, `kayak-rapids` is **incorrect** here — this is a flatwater/tidal launch and a takeout, not whitewater. **`kayak` would be the appropriate slug**, but that slug doesn't exist in the current allowed set (only `kayak-rapids` is listed). **OPEN QUESTION:** introduce a `kayak-flatwater` or generic `kayak` slug, or omit paddle from this card and surface only via the adjacent `14th-street-takeout` location.
- **Age guidance:** 0+ on the gravel trail (stroller-passable on flat gravel). For fishing — adult supervision; USCG under-13 PFD if launching a vessel. For tidal water contact — JRA does not list Chapel Island as a tested bacteria station ([JRA James River Watch](https://thejamesriver.org/james-river-watch/)), and this is at the freshwater–tidal transition where water quality differs from upstream. **Recommend no swim activity** on the card.
- **Site-specific flood / closure threshold:** Chapel Island is at riverfront grade, *outside* the floodwall (downstream of the Great Shiplock floodgate). It will inundate at lower Westham stages than the protected downtown. No site-specific threshold published; **conservatively flag at Westham ~12 ft** and defer to global gage-band rules.
- **Flavor (≤140 char):** "A quiet eleven-acre island a footbridge from Great Shiplock — gravel trail, sandy beach, kayak launch, shipyard ruins."
- **Recommendation: publish or unpublished?** **Recommend `published=true`.** Public access is legally clear (JRPS-managed, sanctioned 2013 trail build via City + CSX + Capital Trees partnership). This is NOT one of the access-uncertain sites the brief flagged as risk — JRPS has a dedicated "Explore the Park" page that names Chapel Island in the title.
- **Open questions:**
  - Confirm OSM coordinates (the JRPS page anchors to Great Shiplock at 2803 Dock St; Chapel Island is the parcel immediately east).
  - **Slug question:** if we want to surface the kayak launch, we need a flatwater paddle slug. Either add `kayak` (generic) / `kayak-flatwater`, or describe paddle use in flavor only and route paddlers to `14th-street-takeout` for the activity tag.
  - Confirm whether the JRA river/education center planned at adjacent Dock Street Park changes Chapel Island's restroom / amenity profile by the time we ship.

---

### Cluster C — OPEN QUESTIONS for user

1. **Tredegar Rope Swing surfacing (CRITICAL):** The site has a documented 2009 / 2011 / 2026 incident record. Recommend publishing with min_age 14 + hazard framing + Westham ≥ 5 ft cutoff. Alternative is to hide. Hiding does not stop access (kids find the eddy via Belle Isle). Confirm posture.
2. **Tredegar Rope Swing slug shape:** New `rope-swing` activity slug, or surface in flavor + warning copy with `swim` only? Recommend latter.
3. **Williams Island Dam Park mapping (CRITICAL):** No entity by that name exists. Recommend `riverside-meadows` (JRPS walk-in viewpoint, no parking) as the published location, with Williams Island Dam + Z-Dam + Bosher's Dam documented on /safety as hazards. Confirm.
4. **Riverside Meadows parking copy:** Site has *no on-site parking* — visitors walk/bike from Pony Pasture lot ~0.3 mi away. Make sure the tile copy reflects this rather than inheriting Pony Pasture's parking record.
5. **Manchester Climbing Wall age floor:** Recommend min_age 8 with explicit "adult belayer required, gear-supplied" copy. No authoritative outdoor-crag minimum exists; the 8 floor reflects USA Climbing U11 norms and gym-to-crag practice. Confirm.
6. **Chapel Island paddle slug:** No flatwater paddle slug currently exists (`kayak-rapids` is whitewater-only). Either add `kayak-flatwater` / generic `kayak`, or describe the launch in flavor only. Same question affects Huguenot Flatwater (Cluster B).
7. **Coordinates:** All four lat/lngs above are best-available estimates. Recommend OSM cross-checks for the rope swing eddy, the climbing wall, Riverside Meadows, and Chapel Island before the migration ships.
8. **Z-Dam high-water threshold copy:** "Most dangerous between 6 and 7 ft Westham" per WTVR is a single-source claim from a 2017 firefighter interview. Should we surface that specific threshold on /safety, or stay general ("hazard at any stage; worse at high water")? Recommend general framing — the specific threshold is journalistically sourced rather than from an engineering study.
