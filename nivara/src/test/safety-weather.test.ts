import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeZones } from '@/lib/engine';
import { elevationGrid, fetchPlaces, liveRain, type Place } from '@/lib/geo';
const place = (id: number, lat: number, risk = .1, elev = 100): Place => ({ id, name: `Locality ${id}`, lat, lon: 83, risk, elev, population: 1000, type: 'town' });
afterEach(() => { vi.unstubAllGlobals(); });
describe('safe-zone rules', () => {
  it('provides eight eligible zones, more than three', () => { expect(safeZones(Array.from({ length: 12 }, (_, i) => place(i, 17 + i / 100)))).toHaveLength(8); });
  it('finds the nearest before limiting rather than only comparing the highest places', () => { const far = Array.from({ length: 10 }, (_, i) => place(i, 18 + i / 10, .1, 500)); expect(safeZones([...far, place(20, 17.001, .1, 10)], 8, [17, 83])[0]?.id).toBe(20); });
  it('does not label higher-risk places safe when no eligible places exist', () => { expect(safeZones([place(1, 17, .3), place(2, 17, .9)])).toEqual([]); });
  it('does not fabricate or duplicate zones to reach eight', () => { const p = place(1, 17); expect(safeZones([p, p, place(2, 17.1)])).toHaveLength(2); });
});
describe('live-data integrity', () => {
  it('reports unavailable weather rather than a fabricated zero rainfall', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false })); await expect(liveRain(17.123, 83.123)).rejects.toThrow('Weather unavailable'); });
  it('reads current local weather and actual daily rainfall', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ current: { precipitation: 2, temperature_2m: 28, wind_speed_10m: 14, time: '2026-10-10T13:00' }, hourly: { precipitation: [0, 2, 3] }, utc_offset_seconds: 19800 }) })); expect(await liveRain(17.124, 83.124)).toEqual({ now: 2, day: 5, wetHours: 2, temperature: 28, wind: 14, time: '2026-10-10T13:00+05:30' }); });
  it('does not invent elevation if terrain is missing', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })); await expect(elevationGrid({ s: 17, n: 18, w: 82, e: 83 })).rejects.toThrow('Terrain data unavailable'); });
  it('does not invent localities if mapped places are missing', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [] }) })); const bbox = { s: 17, n: 18, w: 82, e: 83 }; expect(await fetchPlaces(bbox, { bbox, name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.68, lon: 83.21, population: 0 })).toEqual([]); });
});
