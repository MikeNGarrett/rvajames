# howsthejamesrva.com Investigation

**Sub-goal 41 — Read-only audit, 2026-05-24**

---

## Site description

**URL:** https://howsthejamesrva.com  
**Operator:** Outside Tech Solutions — part of the Terrain360 river monitoring network.  
**Related properties:** Paddle the James (paddlethejames.com), How's Your River (multi-river platform).

How's the James is a single-page river dashboard for the Richmond Fall Line. It shows a consolidated view of current conditions, float time estimates, water quality thresholds, and multi-day forecasts for the metropolitan Richmond reach — roughly Pony Pasture to the 14th St Takeout. It is **not** an access-point-level guide; it does not have per-location pages for any of our 9 spots.

Update frequency: gauge data refreshes every 15 minutes from USGS. Page conditions re-analyzed with each load (AI analysis).

---

## What they show

| Section | Details |
|---|---|
| Current conditions | Stage (ft), flow (CFS), water temp from Westham USGS gauge |
| Gauges | 4 stations: Westham (02037500), Cartersville, Kanawha Canal, Tidewater |
| Float time calculator | Pony Pasture → Reedy Creek; Reedy Creek → 14th St Takeout. CFS-velocity model with wind adjustment |
| Water quality | E. coli threshold (235 cfu/100mL) and Enterococcus (104 cfu/100mL) from James River Watch samples |
| Forecast | NOAA AHPS stage/flow forecasts, 3–5 day horizon, with a 7-day Westham stage chart |
| Weather | AccuWeather + NWS hourly, wind speed/direction |
| AI River Analysis | Generated narrative about paddling safety |
| Live feeds | Osprey cam, Dock Street Locks visibility |
| Alerts | SMS/push subscription with Google/Apple auth |

---

## Tech inspection

### Data feeds
No public API. `/api/*` paths return 403 Forbidden. The sitemap.xml does not enumerate app routes. Page content loads dynamically; endpoint URLs are not exposed in markup.

### Terms of Service
Explicitly prohibit:
- Systematic data retrieval to build compilations, databases, or directories without written permission.
- Automated use of the system (scripts, bots).
- Commercial use not specifically endorsed by them.

**Bottom line: their data is not consumable.** Anything they show, however, is derived from the same upstream public sources we use (USGS, NOAA, NWS, James River Watch) — so there is nothing to consume that isn't already available at the source.

### robots.txt
Not accessible (redirects to HTML homepage).

### Structured data / RSS
None detected.

---

## Overlap analysis

### Gauges
| Gauge | Us | Them |
|---|---|---|
| USGS 02037500 (Westham) | ✅ primary | ✅ primary |
| USGS 02037705 (City Locks tidal) | ✅ secondary | ❌ not shown |
| USGS Cartersville (02035000) | ❌ | ✅ |
| Kanawha Canal | ❌ | ✅ |
| Tidewater | ❌ | ✅ |

### Access points
| Our location | Their coverage |
|---|---|
| pony-pasture | Named as float launch — no per-location page |
| belle-isle | Implied by "14th St Takeout" section — no per-location page |
| texas-beach | Not specifically named |
| browns-island | Not specifically named |
| mayo-island | Not specifically named |
| shiplock-trail | Not specifically named |
| north-bank-trail | Not specifically named |
| buttermilk-trail | Not specifically named |
| pump-house | Not specifically named |

They cover the Richmond corridor as a river segment, not as a set of named land-side access points.

### Conditions we show that they don't
- Per-location deterministic safety status (safe / caution / danger) for each of our 9 spots
- Age-bucketed recommendations (toddlers, youth, adults)
- Specific activity status: swimming, rock-hopping, kayaking, hiking — per location
- Closures and operational status (planned: sub-goals 43–46)
- Location detail pages with resources, parking, tags

### Conditions they show that we don't (yet)
- Float time calculator with CFS-velocity model
- Water quality (E. coli / Enterococcus) — from James River Watch
- SMS/push alerts
- Live camera feeds
- Multi-gauge 7-day trend charts
- 3–5 day NOAA AHPS forecast (sub-goal 42 adds this)
- Cartersville and upstream gauges

---

## Relationship assessment

**Commercial competitor or partner?** Neither. How's the James is a general-purpose river dashboard with a regional scope; we're an access-point safety guide for the urban corridor. Different primary use cases, different audiences, no obvious data-sharing opportunity.

**Abandoned?** No. Copyright shows "© 2026"; SMS alerts imply active users; site is live and maintained.

**Useful as a data source?** No. ToS prohibits systematic retrieval. All underlying data (USGS, NOAA, James River Watch) is available directly from the authoritative source.

**Anything to learn from?** Three things worth noting for our roadmap:
1. **James River Watch water quality integration** — they show E. coli and Enterococcus levels. James River Watch publishes sample data; this could become a future finding in our evaluation (not a current priority).
2. **Float time estimates** — useful for kayaking / paddling users. Out of scope for now, but a plausible future feature.
3. **Multi-gauge trend charts** — they show a 7-day Westham stage sparkline. Our forecast work (sub-goal 42) covers the forward-looking piece; historical trend is not currently a gap.

---

## Recommendation

**Learn-from, no action required.**

No public data feed exists to consume, and their ToS explicitly prohibits scraping. Everything they display originates from the same upstream public APIs we already use. There is no coordination or integration opportunity at this time. Proceed with sub-goals 42–47 as planned.
