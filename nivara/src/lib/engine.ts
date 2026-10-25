import { distKm, nearestCell, type Cell, type Place, type Scenario } from "./geo";

export type Zone = { id: string; label: string; places: Place[]; arrivalMin: number; population: number; risk: number };

/** Minutes until floodwater reaches a place: higher risk and heavier rain = sooner. */
export function arrivalMinutes(risk: number, rain: number) {
  const rainF = Math.sqrt(40 / Math.max(rain, 5));
  return Math.max(10, Math.round(15 + (1 - risk) * 300 * rainF));
}

export function enrichPlaces(raw: Omit<Place, "elev" | "risk">[], cells: Cell[]): Place[] {
  return raw.map((p) => {
    const c = nearestCell(cells, p.lat, p.lon);
    return { ...p, elev: c?.elev ?? 0, risk: c?.risk ?? 1 };
  });
}

/** Decision engine: prioritise at-risk places by population ÷ arrival time, then group into zones A, B, C… */
export function buildZones(places: Place[], sc: Scenario, perZone = 3, maxZones = 8): Zone[] {
  const atRisk = places
    .filter((p) => p.risk >= 0.3)
    .map((p) => ({ p, arr: arrivalMinutes(p.risk, sc.rain) }))
    .sort((a, b) => b.p.population / b.arr - a.p.population / a.arr);
  const zones: Zone[] = [];
  for (let i = 0; i < atRisk.length && zones.length < maxZones; i += perZone) {
    const chunk = atRisk.slice(i, i + perZone);
    const letter = String.fromCharCode(65 + zones.length);
    zones.push({
      id: letter, label: `Zone ${letter}`, places: chunk.map((c) => c.p),
      arrivalMin: Math.min(...chunk.map((c) => c.arr)),
      population: chunk.reduce((s, c) => s + c.p.population, 0),
      risk: Math.max(...chunk.map((c) => c.p.risk)),
    });
  }
  return zones;
}

export function safeZones(places: Place[], n = 8, origin?: [number, number]): Place[] {
  const unique = [...new Map(places.filter((p) => p.risk < 0.3 && Number.isFinite(p.elev)).map((p) => [p.id, p])).values()];
  return unique.sort((a, b) => origin ? distKm(origin, [a.lat, a.lon]) - distKm(origin, [b.lat, b.lon]) : b.elev - a.elev).slice(0, n);
}

export function fmtMin(m: number) {
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Infrastructure: hospitals first, then least backup time. */
export function rankDependents<T extends { kind: string; backupHrs: number }>(facs: T[]): T[] {
  return [...facs].sort((a, b) => (a.kind === "hospital" ? 0 : 1) - (b.kind === "hospital" ? 0 : 1) || a.backupHrs - b.backupHrs);
}
