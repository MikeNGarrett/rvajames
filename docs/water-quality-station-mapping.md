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
| James River 42nd Street Access | 0.82 mi | main river |
| **Reedy Creek** | **1.19 mi** | ← assigned (user-confirmed) |
| Pony Pasture | 2.19 mi | — |

**Rationale:** User-confirmed: Reedy Creek. The Reedy Creek tributary confluence is the
most representative station for the Buttermilk Trail entrance area.

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

### Belle Isle (`belle-isle`)

| Station | Distance | Relationship |
|---|---|---|
| **Reedy Creek** | **0.53 mi** | ← assigned (user-confirmed) |
| James River 42nd Street Access | 0.78 mi | main river, upriver |
| Rope Swing at Tredegar | 0.98 mi | main river, downriver |

**Rationale:** User-confirmed: Reedy Creek (0.53 mi, closest station).

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
| Rope Swing at Tredegar | 0.25 mi | — |
| **14th Street** | **0.70 mi** | ← assigned (user-confirmed) |
| Rockett's Landing | 1.75 mi | — |

**Rationale:** User-confirmed: 14th Street (0.70 mi). Mayo Island is in the lower rapids
near the 14th Street bridge area.

---

### Shiplock Trail / Canal Walk East (`shiplock-trail`)

| Station | Distance | Relationship |
|---|---|---|
| Rope Swing at Tredegar | 0.41 mi | — |
| 14th Street | 0.45 mi | — |
| **Chapel Island (J41)** | **1.06 mi** | ← assigned (user-confirmed) |
| Rockett's Landing | 1.52 mi | — |

**Rationale:** User-confirmed: Chapel Island. This is JRA station code J41 at coordinates
37.5254, -77.4217. The StationName field is null in the ArcGIS FeatureServer — identified
by the `name` code "J41" and by coordinates. The CollectionDate field is also null for J41
records; the `creationdate` epoch-ms field carries the sample timestamp. Recent E. coli
readings observed (e.g., 111.8 CFU/100mL, May 2026).

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

## Final mapping summary

| Access point | Station | Distance | How confirmed |
|---|---|---|---|
| pump-house | Pony Pasture | 0.76 mi | Distance + local proximity |
| pony-pasture | Pony Pasture | 0.82 mi | Direct name match |
| texas-beach | James River 42nd Street Access | 1.36 mi | Across the river — user confirmed |
| buttermilk-trail | Reedy Creek | 1.19 mi | User-confirmed |
| north-bank-trail | James River 42nd Street Access | 0.73 mi | Closest station |
| belle-isle | Reedy Creek | 0.53 mi | User-confirmed |
| browns-island | Rope Swing at Tredegar | 0.25 mi | Adjacent rapids complex |
| mayo-island | 14th Street | 0.70 mi | User-confirmed |
| shiplock-trail | Chapel Island (J41) | 1.06 mi | User-confirmed by ObjectID |
| pipeline-trail | 14th Street | 0.49 mi | Closest station (location is closed) |

---

## Advisory kind decision

The plan (sub-goal 70) references `kind='bacterial'` for derived advisories, and claims
"bacterial is already a valid kind from Round 1 schema." Both are incorrect.

The actual `advisory_kind` DB enum is:
`{flood_watch, flood_warning, flood_advisory, cso_overflow, water_quality, swim_closure, general}`

**User-confirmed decision: use `water_quality`** — there is currently no other source
of water quality data, so a separate `bacterial` enum value is unnecessary. All JRA-derived
advisories in sub-goals 69–70 will use `kind = 'water_quality'`. No enum migration needed.
