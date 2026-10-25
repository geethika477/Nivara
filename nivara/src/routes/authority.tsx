import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { T, useLanguage } from "@/lib/language";
import { Button } from "@/components/ui/button";
import { WeatherPanel } from "@/components/WeatherPanel";
import { WaterFlowLayer } from "@/components/WaterFlowLayer";
import { Header } from "@/components/Header";
import { LeafletMap, TILES, REF_OVERLAYS } from "@/components/LeafletMap";
import { RouteNavigator } from "@/components/RouteNavigator";
import { InfraModule } from "@/components/InfraModule";
import india from "@/data/india.json";
import {
  applyScenario, elevationGrid, fetchPlaces, geocodeDistrict, liveRain, riskColor, riskLabel, GRID,
  type Cell, type District, type Place, type Scenario,
} from "@/lib/geo";
import { AlertsPanel } from "@/components/AlertsPanel";
import { OpsAlerts } from "@/components/OpsPanels";
import { buildZones, enrichPlaces, fmtMin, safeZones, type Zone } from "@/lib/engine";

export const Route = createFileRoute("/authority")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Authority Command — Nivara" },
      { name: "description", content: "Flood risk map, prioritised evacuation zones and infrastructure response for disaster management teams." },
      { property: "og:title", content: "Authority Command — Nivara" },
      { property: "og:description", content: "Flood risk map, evacuation zones and infrastructure response for rescue teams." },
    ],
  }),
  component: Authority,
});

const STATES = india as Record<string, string[]>;
type Layers = { risk: boolean; flow: boolean; terrain: boolean; suscept: boolean };

function Authority() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"flood" | "infra">("flood");
  const [stateName, setStateName] = useState("Andhra Pradesh");
  const [districtName, setDistrictName] = useState("Visakhapatnam");
  const [district, setDistrict] = useState<District | null>(null);
  const [cellsBase, setCellsBase] = useState<Cell[]>([]);
  const [rawPlaces, setRawPlaces] = useState<Omit<Place, "elev" | "risk">[]>([]);
  const [loading, setLoading] = useState("");
  const [sc, setSc] = useState<Scenario>({ rain: 45, duration: 8, water: 55 });
  const [layers, setLayers] = useState<Layers>({ risk: true, flow: false, terrain: false, suscept: false });
  const [evac, setEvac] = useState<Zone | null>(null);
  const [status, setStatus] = useState<Record<string, "pending" | "enroute" | "done">>({});
  const [me, setMe] = useState<[number, number] | null>(null);
  const [live, setLive] = useState<string>("");

  useEffect(() => {
    if (!districtName) return;
    let off = false;
    setLoading("Locating district…"); setEvac(null); setStatus({});
    (async () => {
      try {
        const d = await geocodeDistrict(districtName, stateName);
        if (off) return;
        setDistrict(d); setLoading("Reading terrain elevation…");
        const cells = await elevationGrid(d.bbox);
        if (off) return;
        setCellsBase(cells); setLoading("Mapping localities…");
        const pl = await fetchPlaces(d.bbox, d);
        if (!off) { setRawPlaces(pl); setLoading(""); }
      } catch (e: any) { if (!off) setLoading("⚠ " + e.message); }
    })();
    return () => { off = true; };
  }, [districtName, stateName]);

  const cells = useMemo(() => applyScenario(cellsBase, sc), [cellsBase, sc]);
  const places = useMemo(() => (cells.length ? enrichPlaces(rawPlaces, cells) : []), [rawPlaces, cells]);
  const zones = useMemo(() => buildZones(places, sc), [places, sc]);
  const safe = useMemo(() => safeZones(places, 8), [places]);
  const atRiskPop = zones.reduce((s, z) => s + z.population, 0);

  async function useLive() {
    if (!district) return;
    setLive("Fetching…");
    try {
      const r = await liveRain(district.lat, district.lon);
      const rain = Math.max(0, Math.round(r.wetHours ? r.day / r.wetHours : r.now));
      setSc((s) => ({ ...s, rain: Math.min(150, rain), duration: Math.max(1, r.wetHours) }));
      setLive(`Live: ${r.day.toFixed(1)} mm forecast today over ${r.wetHours}h`);
    } catch { setLive("Live data unavailable"); }
  }

  function startEvac(z: Zone) {
    setEvac(z);
    setStatus((s) => ({ ...s, [z.id]: "enroute" }));
    if (!me) navigator.geolocation?.getCurrentPosition((p) => setMe([p.coords.latitude, p.coords.longitude]), () => {}, { timeout: 8000 });
    setTimeout(() => document.getElementById("evac")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  return (
    <div className="min-h-screen pb-16">
      <Header right={<span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-deep"><T text={'● Authority access'}/></span>} />
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 pt-5">
        {/* Filters */}
        <div className="card-surface flex flex-wrap items-end gap-4 p-4">
          <Field label="State">
            <select className="sel" value={stateName} onChange={(e) => { setStateName(e.target.value); setDistrictName(STATES[e.target.value]?.[0] ?? ""); }}>
              {Object.keys(STATES).map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="District">
            <select className="sel" value={districtName} onChange={(e) => setDistrictName(e.target.value)}>
              {(STATES[stateName] ?? []).map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Stat label="District population" value={district ? district.population.toLocaleString("en-IN") : "—"} />
          <Stat label="Population at risk" value={atRiskPop.toLocaleString("en-IN")} {...(atRiskPop ? { tone: "text-severe" } : {})} />
          <Stat label="Evacuation zones" value={String(zones.length)} />
          <div className="ml-auto flex rounded-xl bg-secondary p-1">
            {(["flood", "infra"] as const).map((t) => (
              <Button variant="ghost" key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? "bg-card text-deep shadow" : "text-muted-foreground"}`}>
                {<T text={t === "flood" ? "Module 1 · Flood & Evacuation" : "Module 2 · Infrastructure"} />}
              </Button>
            ))}
          </div>
        </div>
        <style>{`.sel{min-width:200px;border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--card);font-size:14px}`}</style>

        <AlertsPanel />
        <OpsAlerts />
        {tab === "flood" ? (
          <>
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="relative">
                <FloodMap district={district} cells={cells} places={places} zones={zones} safe={safe} layers={layers} />
                {loading && <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow">{loading}</div>}
                <Legend />
              </div>
              <div className="space-y-4">
                {district && <WeatherPanel lat={district.lat} lon={district.lon} area={district.name} />}
                <div className="card-surface p-4">
                  <h3 className="font-bold text-deep"><T text={'Map layers'}/></h3>
                  <div className="mt-3 space-y-2.5">
                    <Toggle label="Flood risk zones" hint="Red · orange · yellow · green" on={layers.risk} set={(v) => setLayers({ ...layers, risk: v })} />
                    <Toggle label="Water flow direction" hint="Mapped waterways · animated flow" on={layers.flow} set={(v) => setLayers({ ...layers, flow: v })} />
                    <Toggle label="Terrain data" hint="Contours & elevation shading" on={layers.terrain} set={(v) => setLayers({ ...layers, terrain: v })} />
                    <Toggle label="Flood susceptibility" hint="Low-lying land (simulated)" on={layers.suscept} set={(v) => setLayers({ ...layers, suscept: v })} />
                  </div>
                </div>
                <div className="card-surface p-4">
                  <h3 className="font-bold text-deep"><T text={'Rainfall simulation'}/></h3>
                  <Slider label="Rainfall intensity" unit="mm/h" min={0} max={150} v={sc.rain} set={(rain) => setSc({ ...sc, rain })} />
                  <Slider label="Duration" unit="hours" min={1} max={72} v={sc.duration} set={(duration) => setSc({ ...sc, duration })} />
                  <Slider label="River / reservoir level" unit="% of danger mark" min={0} max={120} v={sc.water} set={(water) => setSc({ ...sc, water })} />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    {[["Normal", 10, 3, 30], ["Heavy", 60, 12, 70], ["Cyclone", 130, 36, 110]].map(([n, r, d, w]) => (
                      <Button variant="ghost" key={n as string} onClick={() => setSc({ rain: r as number, duration: d as number, water: w as number })} className="rounded-lg border py-1.5 font-semibold hover:bg-secondary"><T text={String(n)}/></Button>
                    ))}
                  </div>
                  <Button variant="ghost" onClick={useLive} className="mt-2 w-full rounded-lg bg-deep py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><T text={'☁ Use live rainfall forecast'}/></Button>
                  {live && <p className="mt-1 text-xs text-muted-foreground">{live}</p>}
                </div>
              </div>
            </div>

            {/* Decision engine */}
            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <div className="card-surface overflow-hidden">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-deep"><T text={'Decision engine · Evacuation priority'}/></h2>
                    <p className="text-xs text-muted-foreground">Ranked by population ÷ flood arrival time · {district?.name ?? ""}</p>
                  </div>
                </div>
                {zones.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">{loading ? t(loading) : "No areas currently at risk under this scenario. Increase rainfall or water level to simulate."}</p>
                ) : (
                  <div className="divide-y">
                    {zones.map((z, i) => (
                      <div key={z.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl font-display text-lg font-bold text-primary-foreground" style={{ background: riskColor(z.risk) }}>{z.id}</div>
                        <div className="min-w-[220px] flex-1">
                          <div className="font-semibold">{z.places.map((p) => p.name).slice(0, 2).join(" & ")} <span className="ml-1 text-xs font-medium text-muted-foreground">Priority #{i + 1} · {riskLabel(z.risk)}</span></div>
                          <div className="text-sm text-muted-foreground">Areas: {z.places.map((p) => p.name).join(", ")}</div>
                          <div className="text-xs text-muted-foreground">~{z.population.toLocaleString("en-IN")} people</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground"><T text={'Flood arrival'}/></div>
                          <div className="font-display text-xl font-bold text-severe">{fmtMin(z.arrivalMin)}</div>
                        </div>
                        {status[z.id] === "done" ? (
                          <span className="rounded-lg bg-primary-soft px-4 py-2 text-sm font-semibold text-deep"><T text={'✓ Evacuated'}/></span>
                        ) : (
                          <Button variant="ghost" onClick={() => startEvac(z)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                            {t(status[z.id] === "enroute" ? "Resume route" : `Evacuate ${z.places[0]?.name ?? ""}`)}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-surface p-5">
                <h2 className="text-lg font-bold text-deep"><T text={'Safe zones'}/></h2>
                <p className="text-xs text-muted-foreground"><T text={'Highest ground with lowest flood risk'}/></p>
                <ul className="mt-3 space-y-2">
                  {!safe.length && <li className="py-3 text-sm text-muted-foreground">{t("No lower-risk locations available in this area.")}</li>}
                  {safe.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg bg-primary-soft px-3 py-2 text-sm">
                      <span className="font-semibold text-deep">🟢 {s.name}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(s.elev)} m</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {evac && district && safe[0] && (
              <div id="evac" className="card-surface p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-deep">Evacuation route · {evac.places.map((p) => p.name).join(", ")}</h2>
                    <p className="text-sm text-muted-foreground">{me ? "From your current location" : "From district control room"} → {evac.places[0]!.name} → {nearestSafe(evac.places[0]!, safe)!.name}</p>
                  </div>
                  <Button variant="ghost" onClick={() => setEvac(null)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-secondary"><T text={'Close'}/></Button>
                </div>
                <RouteNavigator
                  stops={[
                    { lat: me?.[0] ?? district.lat, lon: me?.[1] ?? district.lon, label: me ? "You" : "Control room", color: "#2563eb" },
                    { lat: evac.places[0]!.lat, lon: evac.places[0]!.lon, label: `Flood area: ${evac.places[0]!.name}`, color: "#dc2626" },
                    { lat: nearestSafe(evac.places[0]!, safe)!.lat, lon: nearestSafe(evac.places[0]!, safe)!.lon, label: `Safe: ${nearestSafe(evac.places[0]!, safe)!.name}`, color: "#16a34a" },
                  ]}
                  legNames={["1 · To flood zone", "2 · To safe zone"]}
                  footer={(leg, setLeg) => leg === 0 ? (
                    <Button variant="ghost" onClick={() => setLeg(1)} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground">✓ Arrived at {evac.places[0]!.name} — route to safe zone</Button>
                  ) : (
                    <Button variant="ghost" onClick={() => { setStatus((s) => ({ ...s, [evac.id]: "done" })); setEvac(null); }} className="w-full rounded-lg bg-deep py-2.5 text-sm font-semibold text-primary-foreground">✓ Mark {evac.places[0]!.name} evacuated</Button>
                  )}
                />
              </div>
            )}
          </>
        ) : district ? (
          <InfraModule district={district} />
        ) : <p className="text-muted-foreground"><T text={'Select a district first.'}/></p>}
      </div>
    </div>
  );
}

function nearestSafe(p: Place, safe: Place[]) {
  return safe.reduce<Place>((b, s) => ((s.lat - p.lat) ** 2 + (s.lon - p.lon) ** 2 < (b.lat - p.lat) ** 2 + (b.lon - p.lon) ** 2 ? s : b), safe[0]!);
}

function FloodMap({ district, cells, places, zones, safe, layers }: { district: District | null; cells: Cell[]; places: Place[]; zones: Zone[]; safe: Place[]; layers: Layers }) {
  const c = useRef<{ L: typeof Leaflet; map: Leaflet.Map; base?: Leaflet.TileLayer; ref?: Leaflet.LayerGroup; g?: Leaflet.LayerGroup } | null>(null);
  const [ready, setReady] = useState(false);
  const last = useRef("");

  useEffect(() => {
    const x = c.current; if (!x || !ready) return;
    x.base?.remove(); x.ref?.remove();
    const t = layers.terrain ? TILES.terrain : TILES.light;
    x.base = x.L.tileLayer(t.url, { attribution: t.attr, maxZoom: 18 }).addTo(x.map);
    x.base.bringToBack();
    if (!layers.terrain) {
      x.ref = x.L.layerGroup(REF_OVERLAYS.map((u) => x.L.tileLayer(u, { maxZoom: 18, attribution: "Labels © Esri" }))).addTo(x.map);
    }
  }, [layers.terrain, ready]);

  useEffect(() => {
    const x = c.current; if (!x || !ready || !district) return;
    if (last.current !== district.name + district.state) {
      last.current = district.name + district.state;
      x.map.flyToBounds([[district.bbox.s, district.bbox.w], [district.bbox.n, district.bbox.e]], { duration: 1.5 });
    }
  }, [district, ready]);

  useEffect(() => {
    const x = c.current; if (!x || !ready || !district || !cells.length) return;
    x.g?.remove();
    const g = x.L.layerGroup().addTo(x.map); x.g = g;
    const b = district.bbox, dLat = (b.n - b.s) / GRID, dLon = (b.e - b.w) / GRID;
    for (const cell of cells) {
      const bounds: Leaflet.LatLngBoundsExpression = [[cell.lat - dLat / 2, cell.lon - dLon / 2], [cell.lat + dLat / 2, cell.lon + dLon / 2]];
      if (layers.risk) x.L.rectangle(bounds, { stroke: false, fillColor: riskColor(cell.risk), fillOpacity: 0.2 })
        .bindTooltip(`${riskLabel(cell.risk)} risk · ${Math.round(cell.risk * 100)}% · ${Math.round(cell.elev)} m`).addTo(g);
      if (layers.suscept) x.L.rectangle(bounds, { stroke: cell.risk >= 0.5, color: "#991b1b", weight: 1, fillColor: cell.risk >= 0.5 ? "#dc2626" : cell.risk >= 0.3 ? "#f97316" : "#fca5a5", fillOpacity: Math.min(0.75, cell.low * 0.4 + cell.risk * 0.45) })
        .bindTooltip(`Susceptibility ${Math.round((cell.low * 0.5 + cell.risk * 0.5) * 100)}% · ${Math.round(cell.elev)} m`).addTo(g);

    }
    const zoneOf = new Map<number, Zone>();
    zones.forEach((z) => z.places.forEach((p) => zoneOf.set(p.id, z)));
    const safeIds = new Set(safe.map((s) => s.id));
    for (const p of places) {
      const z = zoneOf.get(p.id);
      if (z) x.L.marker([p.lat, p.lon], { icon: x.L.divIcon({ className: "", html: `<div class="pin" style="background:${riskColor(z.risk)}">${z.id}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
        .bindPopup(`<b>${p.name}</b><br/>Priority ${z.id} · ${riskLabel(p.risk)} risk · ~${p.population.toLocaleString("en-IN")} people`).addTo(g);
      else if (safeIds.has(p.id)) x.L.marker([p.lat, p.lon], { icon: x.L.divIcon({ className: "", html: `<div class="pin" style="background:#16a34a">✓</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
        .bindPopup(`<b>${p.name}</b><br/>Safe zone · ${Math.round(p.elev)} m`).addTo(g);
      else x.L.circleMarker([p.lat, p.lon], { radius: 3, color: "#334155", weight: 1, fillOpacity: 0.6 }).bindTooltip(p.name).addTo(g);
    }
  }, [cells, places, zones, safe, layers.risk, layers.flow, layers.suscept, ready, district]);

  return <><LeafletMap center={[17.6868, 83.2185]} zoom={11} className="h-[620px] overflow-hidden rounded-lg border" onReady={({ L, map }) => { c.current = { L, map }; setReady(true); }} /><WaterFlowLayer context={ready ? c.current : null} district={district} cells={cells} enabled={layers.flow} /></>;
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] rounded-xl bg-card/95 p-3 text-xs shadow">
      {[["#dc2626", "Severe"], ["#f97316", "High"], ["#eab308", "Moderate"], ["#16a34a", "Safe"]].map(([c, l]) => (
        <div key={l} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: c }} /><T text={l ?? ""}/></div>
      ))}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-muted-foreground"><div className="mb-1"><T text={label}/></div>{children}</label>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="px-2"><div className="text-xs text-muted-foreground"><T text={label}/></div><div className={`font-display text-xl font-bold ${tone ?? "text-deep"}`}>{value}</div></div>;
}
function Toggle({ label, hint, on, set }: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <Button variant="ghost" onClick={() => set(!on)} className="flex w-full items-center justify-between text-left">
      <span><span className="block text-sm font-medium"><T text={label}/></span><span className="text-xs text-muted-foreground"><T text={hint}/></span></span>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </Button>
  );
}
function Slider({ label, unit, min, max, v, set }: { label: string; unit: string; min: number; max: number; v: number; set: (n: number) => void }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-sm"><span className="font-medium"><T text={label}/></span><span className="font-semibold text-deep">{v} <span className="text-xs font-normal text-muted-foreground">{unit}</span></span></div>
      <input type="range" min={min} max={max} value={v} onChange={(e) => set(+e.target.value)} className="mt-1 w-full accent-[var(--primary)]" />
    </div>
  );
}
