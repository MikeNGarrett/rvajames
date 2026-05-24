# Water Quality Station Mapping — RVA James

Maps each of the 10 RVA James access points to the nearest James River Watch (JRA)
sampling station. Produced during sub-goal 68 by computing great-circle distances
from each access point's DB coordinates to every JRA station in the Richmond reach
(lat 37.4–37.7, lng –77.7 to –77.1).

**Last verified: 2026-05-24**

---

## Richmond-area JRA stations (west to east)

| Station name | Lat | Lng | Org | Notes |
|---|---|---|---|---|
| Robious Landing Park | 37.5592 | –77.6467 | JRA | Suburban Chesterfield, upriver of JRPA |
| Huguenot Flatwater | 37.5605 | –77.5458 | JRA | Flatwater reach near Huguenot Bridge |
| Pony Pasture | 37.5516 | –77.5204 | JRA | On-site at Pony Pasture rapids |
| James River 42nd Street Access | 37.5268 | –77.4757 | JRA | Near 42nd St / Texas Beach corridor |
| Reedy Creek | 37.5244 | –77.4696 | JRA | Tributary confluence station |
| Rope Swing at Tredegar | 37.5344 | –77.4454 | JRA | On main James, north bank, Tredegar |
| 14th Street | 37.5309 | –77.4319 | JRA | Near 14th Street Bridge |
| Rockett's Landing | 37.5186 | –77.4166 | JRA | East Richmond waterfront |
| James River at Osborne Landing | 37.4010 | –77.3871 | JRA | Far downstream, Henrico |
| Deep Bottom Park | 37.4078 | –77.3043 | JRA | Far downstream, Henrico |
| Grapevine Bridge | 37.5520 | –77.2711 | JRA | Far east, Henrico |

> Note: "Rockett's Landing" in the ArcGIS API uses the Windows-1252 curly apostrophe
> (``). The `apiName` field in `lib/data/station-mapping.ts` stores the exact
> byte-accurate string for WHERE clause use; the display `name` uses a plain apostrophe.

---

## Access point → station mapping

### Pump House / JRPA HQ (`pump-house`)

| Station | Distance | Relationship |
|---|---|---|
| **Pony Pasture** | **0.76 mi** | ← assigned (closest; upstream neighbor) |
| Huguenot Flatwater | 1.31 mi | — |
| James River 42nd Street Access | 3.32 mi | — |

**Rationale:** The plan initially listed pump-house as "likely none / upstream of all Richmond
stations," but Pony Pasture at 0.76 mi is a reasonable proxy. Pump House sits just upriver of
Pony Pasture on the same reach; water quality there reflects the same upstream watershed.
Assigned.

---

### Pony Pasture Rapids (`pony-pasture`)

| Station | Distance | Relationship |
|---|---|---|
| **Pony Pasture** | **0.82 mi** | ← assigned (direct name match) |
| Huguenot Flatwater | 1.82 mi | — |

**Rationale:** Direct name match. The slight 0.82 mi offset is because the JRA station
coordinates sit in-river while our DB coordinates mark the parking/access area.
No ambiguity — this is the definitive station for Pony Pasture.

---

### Texas Beach (`texas-beach`)

| Station | Distance | Relationship |
|---|---|---|
| **James River 42nd Street Access** | **1.36 mi** | ← assigned (closest; semantic match) |
| Pony Pasture | 1.73 mi | — |
| Reedy Creek | 1.73 mi | — |

**Rationale:** "James River 42nd Street Access" is both the closest station and the
semantic match for the 42nd St corridor where Texas Beach sits. Texas Beach is between
Pony Pasture (upriver) and 42nd Street (downriver), so this station is a slight
downstream proxy — water that passes Texas Beach arrives at 42nd St shortly after.
Acceptable.

---

### Buttermilk Trail (`buttermilk-trail`)

| Station | Distance | Relationship |
|---|---|---|
| **James River 42nd Street Access** | **0.82 mi** | ← assigned (closest main-river) |
| Reedy Creek | 1.19 mi | tributary |
| Pony Pasture | 2.19 mi | — |

**Rationale:** The plan initially suggested "Reedy Creek" for Buttermilk Trail, but the
actual distance data shows 42nd Street Access is significantly closer (0.82 vs 1.19 mi).
More importantly, Reedy Creek is a tributary station — it measures creek water quality,
not the main James. 42nd Street Access is on the main James, upriver of the Buttermilk
trailhead. Reassigned to 42nd Street Access.

---

### North Bank Trail (`north-bank-trail`)

| Station | Distance | Relationship |
|---|---|---|
| **James River 42nd Street Access** | **0.73 mi** | ← assigned (closest) |
| Reedy Creek | 0.83 mi | tributary |
| Rope Swing at Tredegar | 1.37 mi | — |

**Rationale:** The plan initially suggested "Rope Swing at Tredegar" (1.37 mi), but 42nd
Street Access is nearly twice as close (0.73 mi). North Bank Trail runs along the north
bank in the 40s–50s street corridor; 42nd Street Access is the appropriate station.
Reedy Creek (0.83 mi) is closer than Tredegar but is a tributary. Reassigned.

---

### Belle Isle (`belle-isle`) ⚠️ USER CONFIRMATION REQUESTED

| Station | Distance | Relationship |
|---|---|---|
| Reedy Creek | 0.53 mi | **tributary** — not the main James |
| **James River 42nd Street Access** | **0.78 mi** | ← recommended (closest main-river, upriver) |
| Rope Swing at Tredegar | 0.98 mi | main river, downriver (plan's original suggestion) |

**Rationale (three candidates):**
- **Reedy Creek (0.53 mi)** — physically closest, but measures a creek tributary, not
  the main James River. E. coli from Reedy Creek may not reflect swim conditions on
  Belle Isle where swimmers enter from the north bank bridge.
- **James River 42nd Street Access (0.78 mi)** — closest main-river station, slightly
  upriver of Belle Isle. Water quality here reflects conditions entering the Belle Isle
  rapids. The data from 42nd Street is protective: if bacteria levels are elevated
  upriver, they'll be present at Belle Isle too.
- **Rope Swing at Tredegar (0.98 mi)** — the plan's original suggestion; on the main
  James, but slightly downriver of Belle Isle. This station measures conditions *after*
  the water passes Belle Isle.

**My recommendation: James River 42nd Street Access** — closest main-river station, and
upriver orientation is more protective for a swim advisory context.

**⚠️ Please confirm:** Is James River 42nd Street Access the right choice for Belle Isle,
or would you prefer Rope Swing at Tredegar (the plan's original suggestion, which is
directly across the narrow channel from Belle Isle's north entrance)?

---

### Browns Island (`browns-island`)

| Station | Distance | Relationship |
|---|---|---|
| **Rope Swing at Tredegar** | **0.25 mi** | ← assigned (very close; same rapids complex) |
| 14th Street | 0.96 mi | — |

**Rationale:** At 0.25 mi, Rope Swing at Tredegar is the clear station for the downtown
rapids including Browns Island. The "Rope Swing" is on the north bank directly adjacent
to the Browns Island / Belle Isle rapids complex. This matches the plan exactly.

---

### Mayo Island (`mayo-island`)

| Station | Distance | Relationship |
|---|---|---|
| **Rope Swing at Tredegar** | **0.25 mi** | ← assigned (same rapids complex as Browns Island) |
| 14th Street | 0.70 mi | — |
| Rockett's Landing | 1.75 mi | — |

**Rationale:** Mayo Island is immediately adjacent to Browns Island in the same rapids
complex. Same station assignment. The plan originally suggested "Rocketts Landing as
nearest?" — but Rope Swing at Tredegar is 7× closer (0.25 vs 1.75 mi). Reassigned.

---

### Shiplock Trail / Canal Walk East (`shiplock-trail`)

| Station | Distance | Relationship |
|---|---|---|
| **Rope Swing at Tredegar** | **0.41 mi** | ← assigned (closest main-river) |
| 14th Street | 0.45 mi | nearly as close |
| Rockett's Landing | 1.52 mi | — |

**Rationale:** The plan originally suggested "Rocketts Landing as downriver-side proxy,"
but Rope Swing at Tredegar (0.41 mi) and 14th Street (0.45 mi) are both far closer.
Shiplock Trail is the eastern end of Canal Walk, near the 14th Street Bridge. Either
Tredegar or 14th Street would work; Tredegar is slightly closer at 0.41 mi. Assigned
Rope Swing at Tredegar.

---

### Pipeline Trail (`pipeline-trail`)

| Station | Distance | Relationship |
|---|---|---|
| **14th Street** | **0.49 mi** | ← assigned (closest; but note: location is permanently closed) |
| Rope Swing at Tredegar | 0.95 mi | — |
| Rockett's Landing | 1.02 mi | — |

**Rationale:** Pipeline Trail is permanently closed (DPU wastewater infrastructure,
since September 2024). A station is still assigned so that if a future season shows
elevated bacteria near the Pipeline corridor, the admin panel can display it in context.
14th Street (0.49 mi) is closest. The plan suggested Tredegar (0.95 mi), but 14th Street
is nearly twice as close. Reassigned.

---

## Plan corrections summary

The plan's original expected mappings were educated guesses before station data was queried.
Several were significantly off:

| Access point | Plan expected | Actual mapping | Key change |
|---|---|---|---|
| pump-house | "likely none" | Pony Pasture (0.76 mi) | Station does exist nearby |
| buttermilk-trail | Reedy Creek (1.19 mi) | 42nd Street Access (0.82 mi) | Closer + main-river station |
| north-bank-trail | Rope Swing at Tredegar (1.37 mi) | 42nd Street Access (0.73 mi) | Nearly 2× closer |
| belle-isle | Rope Swing at Tredegar (0.98 mi) | 42nd Street Access (0.78 mi) ← TBD | Closest main-river station |
| mayo-island | Rocketts Landing (1.75 mi) | Rope Swing at Tredegar (0.25 mi) | 7× closer |
| shiplock-trail | Rocketts Landing (1.52 mi) | Rope Swing at Tredegar (0.41 mi) | 3.7× closer |
| pipeline-trail | Rope Swing at Tredegar (0.95 mi) | 14th Street (0.49 mi) | Closer |

---

## Advisory kind note

The plan (sub-goal 70) references `kind='bacterial'` for derived advisories. The actual
`advisory_kind` DB enum is:
`{flood_watch, flood_warning, flood_advisory, cso_overflow, water_quality, swim_closure, general}`

`bacterial` is **not** a valid value. Sub-goal 69's migration `0011_water_quality_readings.sql`
should either:
- Add `'bacterial'` to the enum via `ALTER TYPE advisory_kind ADD VALUE 'bacterial'`, **or**
- Use the existing `'water_quality'` kind instead.

This needs a decision before sub-goal 70 proceeds. The plan's comment "bacterial is already
a valid kind from Round 1 schema" is incorrect.
