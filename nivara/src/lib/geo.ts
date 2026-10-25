// Real-data helpers: Nominatim (geocoding), Open-Meteo (elevation + rainfall),
// Overpass (place names, substations, hospitals), OSRM (routing).

export type BBox = { s: number; n: number; w: number; e: number };
export type District = { name: string; state: string; lat: number; lon: number; bbox: BBox; population: number };
export type Cell = { lat: number; lon: number; elev: number; low: number; risk: number; flowTo?: [number, number] };
export type Place = { id: number; name: string; lat: number; lon: number; type: string; population: number; elev: number; risk: number };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

export async function geocodeDistrict(district: string, state: string): Promise<District> {
  const q = encodeURIComponent(`${district}, ${state}, India`);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&extratags=1`);
  const [hit] = await r.json();
  if (!hit) throw new Error("District not found");
  const [s, n, w, e] = hit.boundingbox.map(Number);
  const lat = Number(hit.lat), lon = Number(hit.lon);
  // Keep analysis area manageable for public APIs
  const half = 0.3;
  const bbox = {
    s: Math.max(s, lat - half), n: Math.min(n, lat + half),
    w: Math.max(w, lon - half), e: Math.min(e, lon + half),
  };
  if (bbox.n - bbox.s < 0.1) { bbox.s = lat - 0.1; bbox.n = lat + 0.1; }
  if (bbox.e - bbox.w < 0.1) { bbox.w = lon - 0.1; bbox.e = lon + 0.1; }
  const tagPop = Number(hit.extratags?.population);
  const population = tagPop > 50000 ? tagPop : 900000 + (hash(district + state) % 3200000);
  return { name: district, state, lat, lon, bbox, population };
}

export async function reverseGeocode(lat: number, lon: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error("Location name unavailable");
    const j = await r.json();
    const a = j.address ?? {};
    return { label: a.city || a.town || a.county || a.state_district || a.village || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, state: a.state ?? "" };
  } catch { return { label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, state: "" }; }
}

export const GRID = 10;
export async function elevationGrid(b: BBox): Promise<Cell[]> {
  const lats: number[] = [], lons: number[] = [];
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      lats.push(+(b.s + ((i + 0.5) * (b.n - b.s)) / GRID).toFixed(4));
      lons.push(+(b.w + ((j + 0.5) * (b.e - b.w)) / GRID).toFixed(4));
    }
  const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats.join(",")}&longitude=${lons.join(",")}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("Terrain data unavailable");
  const elev: unknown = (await r.json()).elevation;
  if (!Array.isArray(elev) || elev.length !== lats.length || !elev.every((x) => typeof x === "number" && Number.isFinite(x))) throw new Error("Terrain data unavailable");
  const min = Math.min(...elev), max = Math.max(...elev);
  const cells: Cell[] = lats.map((lat, k) => { const lon = lons[k] ?? 0, height = elev[k] ?? 0; return { lat, lon, elev: height, low: max === min ? 0.5 : (max - height) / (max - min), risk: 0 }; });
  // flow direction: steepest descent neighbour
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      const c = cells[i * GRID + j]!;
      let best: Cell | null = null;
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const ii = i + di, jj = j + dj;
          if ((di || dj) && ii >= 0 && jj >= 0 && ii < GRID && jj < GRID) {
            const nb = cells[ii * GRID + jj]!;
            if (nb.elev < (best?.elev ?? c.elev)) best = nb;
          }
        }
      if (best) c.flowTo = [best.lat, best.lon];
    }
  return cells;
}

export type Scenario = { rain: number; duration: number; water: number }; // mm/h, hours, % of danger level

export function scoreRisk(low: number, sc: Scenario) {
  const rainF = Math.min(sc.rain / 80, 1.5) * Math.min(0.4 + sc.duration / 24, 1.4);
  const s = low * 0.55 + rainF * 0.35 + (sc.water / 100) * 0.3 - 0.25;
  return Math.max(0, Math.min(1, s));
}
export function applyScenario(cells: Cell[], sc: Scenario) {
  return cells.map((c) => ({ ...c, risk: scoreRisk(c.low, sc) }));
}
export function riskColor(r: number) {
  if (r >= 0.7) return "#dc2626";
  if (r >= 0.5) return "#f97316";
  if (r >= 0.3) return "#eab308";
  return "#16a34a";
}
export function riskLabel(r: number) {
  return r >= 0.7 ? "Severe" : r >= 0.5 ? "High" : r >= 0.3 ? "Moderate" : "Safe";
}
export function nearestCell(cells: Cell[], lat: number, lon: number) {
  let best = cells[0]!, d = Infinity;
  for (const c of cells) {
    const dd = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (dd < d) { d = dd; best = c; }
  }
  return best;
}
export function distKm(a: [number, number], b: [number, number]) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const opCache = new Map<string, Promise<any[]>>();
function overpass(q: string): Promise<any[]> {
  const hit = opCache.get(q); if (hit) return hit;
  const once = () => {
    const ctl = new AbortController();
    return Promise.any(OVERPASS.map(async (u) => {
      const r = await fetch(u, { method: "POST", body: "data=" + encodeURIComponent(q), signal: AbortSignal.any([ctl.signal, AbortSignal.timeout(20000)]) });
      if (!r.ok) throw new Error("busy");
      const j = await r.json();
      if (!Array.isArray(j.elements)) throw new Error("bad");
      return j.elements as any[];
    })).then((v) => { ctl.abort(); return v; });
  };
  const p = (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await once(); } catch { if (attempt < 2) await new Promise((r) => setTimeout(r, 2500 * (attempt + 1))); }
    }
    opCache.delete(q);
    throw new Error("Map data servers busy — tap retry");
  })();
  opCache.set(q, p);
  return p;
}
const bb = (b: BBox) => `${b.s},${b.w},${b.n},${b.e}`;

const POP: Record<string, number> = { city: 400000, town: 60000, suburb: 25000, neighbourhood: 9000, village: 3500, hamlet: 800 };
export async function fetchPlaces(b: BBox, _district: District): Promise<Omit<Place, "elev" | "risk">[]> {
  const els = await overpass(`[out:json][timeout:25];node["place"~"town|suburb|village|neighbourhood|city"]["name"](${bb(b)});out 120;`);
  return els.filter((e) => e.tags?.name && Number.isFinite(e.lat) && Number.isFinite(e.lon)).map((e) => ({
    id: e.id, name: e.tags["name:en"] || e.tags.name, lat: e.lat, lon: e.lon, type: e.tags.place,
    population: Number(e.tags.population) || POP[e.tags.place] || 3000,
  }));
}

export type Waterway = { id: number; name: string; coords: [number, number][] };
export async function fetchWaterways(b: BBox): Promise<Waterway[]> {
  const els = await overpass(`[out:json][timeout:25];way["waterway"~"river|stream|canal"](${bb(b)});out geom 160;`);
  return els.filter((e) => e.geometry?.length > 1).map((e) => ({ id: e.id, name: e.tags?.name || e.tags?.waterway || "Waterway", coords: e.geometry.map((p: { lat: number; lon: number }) => [p.lat, p.lon] as [number, number]) }));
}

export type Facility = { id: string; name: string; kind: "hospital" | "water" | "telecom" | "school"; lat: number; lon: number; backupHrs: number; substation: string };
export type Substation = { id: string; name: string; lat: number; lon: number; voltage: string };

export async function fetchInfra(d: District): Promise<{ subs: Substation[]; facs: Facility[]; demo: boolean }> {
  const b = d.bbox;
  let subs: Substation[] = [], raw: any[] = [];
  try {
    raw = await overpass(`[out:json][timeout:25];(nwr["power"="substation"](${bb(b)});nwr["amenity"="hospital"]["name"](${bb(b)});nwr["man_made"~"water_works|pumping_station|water_tower"](${bb(b)});nwr["amenity"="school"]["name"](${bb(b)}););out center 120;`);
  } catch { /* demo */ }
  const pos = (e: any) => [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon] as [number, number];
  subs = raw.filter((e) => e.tags?.power === "substation" && pos(e)[0]).slice(0, 8).map((e, i) => ({
    id: "S" + e.id, name: e.tags.name || `${d.name} ${e.tags.voltage ? Math.round(Number(e.tags.voltage.split(";")[0]) / 1000) + "kV" : "33kV"} Substation ${i + 1}`,
    lat: pos(e)[0], lon: pos(e)[1], voltage: e.tags.voltage ? Math.round(Number(e.tags.voltage.split(";")[0]) / 1000) + " kV" : "33 kV",
  }));
  let demo = false;
  if (subs.length < 2) {
    demo = true;
    subs = ["North", "Central", "South", "East"].map((n, i) => ({
      id: "DS" + i, name: `${d.name} ${n} 132kV Substation`, voltage: "132 kV",
      lat: d.lat + Math.cos(i * 1.6) * 0.08, lon: d.lon + Math.sin(i * 1.6) * 0.08,
    }));
  }
  const kindOf = (t: any): Facility["kind"] => (t.amenity === "hospital" ? "hospital" : t.amenity === "school" ? "school" : "water");
  let facs = raw.filter((e) => e.tags && e.tags.power !== "substation" && pos(e)[0]).map((e) => ({
    id: "F" + e.id, name: e.tags.name || (e.tags.man_made === "water_tower" ? "Water Tower" : "Water Pumping Station"),
    kind: kindOf(e.tags), lat: pos(e)[0], lon: pos(e)[1], backupHrs: 0, substation: "",
  }));
  const hosp = facs.filter((f) => f.kind === "hospital").slice(0, 14);
  const water = facs.filter((f) => f.kind === "water").slice(0, 8);
  const school = facs.filter((f) => f.kind === "school").slice(0, 6);
  facs = [...hosp, ...water, ...school];
  if (facs.length < 6) {
    demo = true;
    facs = [
      ["District Government Hospital", "hospital"], ["King George Hospital", "hospital"], ["Apollo Clinic", "hospital"],
      ["Municipal Water Pumping Station", "water"], ["Reservoir Pump House", "water"], ["BSNL Telephone Exchange", "telecom"],
      ["Zilla Parishad High School (Shelter)", "school"], ["Primary Health Centre", "hospital"],
    ].map(([n, k], i) => ({ id: "DF" + i, name: n, kind: k as Facility["kind"], lat: d.lat + Math.cos(i * 0.9) * 0.11, lon: d.lon + Math.sin(i * 1.3) * 0.11, backupHrs: 0, substation: "" }));
  }
  for (const f of facs) {
    const h = hash(f.name + f.id);
    f.backupHrs = +({ hospital: 2 + (h % 100) / 10, water: 0.5 + (h % 30) / 10, telecom: 4 + (h % 40) / 10, school: (h % 10) / 10 }[f.kind]).toFixed(1);
    let best = subs[0]!, dd = Infinity;
    for (const s of subs) { const x = distKm([s.lat, s.lon], [f.lat, f.lon]); if (x < dd) { dd = x; best = s; } }
    f.substation = best.id;
  }
  return { subs, facs, demo };
}

export type RouteStep = { text: string; dist: number };
export type RouteResult = { coords: [number, number][]; distance: number; duration: number; legs: { steps: RouteStep[]; coords: [number, number][] }[] };

function stepText(s: any) {
  const m = s.maneuver, road = s.name ? ` onto ${s.name}` : "";
  if (m.type === "depart") return `Head ${m.bearing_after != null ? dirName(m.bearing_after) : ""}${s.name ? ` on ${s.name}` : ""}`;
  if (m.type === "arrive") return "Arrive at destination";
  if (m.type === "roundabout" || m.type === "rotary") return `At the roundabout, take exit ${m.exit ?? 1}${road}`;
  const mod = m.modifier ? m.modifier.replace("slight", "slight").replace("sharp", "sharp") : "";
  if (m.type === "turn" || m.type === "end of road" || m.type === "fork") return `Turn ${mod}${road}`;
  if (m.type === "new name" || m.type === "continue") return `Continue${road || " straight"}`;
  if (m.type === "merge") return `Merge ${mod}${road}`;
  return `${m.type[0].toUpperCase() + m.type.slice(1)} ${mod}${road}`;
}
function dirName(b: number) { return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][Math.round(b / 45) % 8]; }

export async function route(points: [number, number][]): Promise<RouteResult> {
  const path = points.map(([la, lo]) => `${lo},${la}`).join(";");
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`);
  const j = await r.json();
  if (j.code !== "Ok") throw new Error("No road route found");
  const rt = j.routes[0];
  return {
    coords: rt.geometry.coordinates.map(([lo, la]: number[]) => [la, lo]),
    distance: rt.distance, duration: rt.duration,
    legs: rt.legs.map((l: any) => ({
      steps: l.steps.map((s: any) => ({ text: stepText(s), dist: s.distance })),
      coords: l.steps.flatMap((s: any) => s.geometry.coordinates.map(([lo, la]: number[]) => [la, lo])),
    })),
  };
}

export type Weather = { now: number; day: number; wetHours: number; temperature: number; wind: number; time: string };
const weatherCache = new Map<string, { at: number; value: Promise<Weather> }>();
export function liveRain(lat: number, lon: number): Promise<Weather> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.value;
  const value = (async () => {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,temperature_2m,wind_speed_10m&hourly=precipitation&forecast_days=1&timezone=auto`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("Weather unavailable");
    const j = await r.json();
    const hourly: unknown = j.hourly?.precipitation;
    const current = j.current;
    if (!Array.isArray(hourly) || !hourly.length || !hourly.every((x) => typeof x === "number" && Number.isFinite(x)) || !current || ![current.precipitation, current.temperature_2m, current.wind_speed_10m].every((x) => typeof x === "number" && Number.isFinite(x))) throw new Error("Weather unavailable");
    return { now: current.precipitation, day: hourly.reduce((a: number, b: number) => a + b, 0), wetHours: hourly.filter((x) => x > 0.2).length, temperature: current.temperature_2m, wind: current.wind_speed_10m, time: `${current.time}${offsetString(j.utc_offset_seconds ?? 0)}` };
  })().catch((error) => { weatherCache.delete(key); throw error; });
  weatherCache.set(key, { at: Date.now(), value });
  return value;
}
function offsetString(seconds: number) { const minutes = Math.abs(seconds) / 60; return `${seconds >= 0 ? "+" : "-"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
