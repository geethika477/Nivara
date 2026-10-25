import { T } from "@/lib/language";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { LeafletMap, TILES, REF_OVERLAYS } from "./LeafletMap";
import { fetchInfra, type District, type Facility, type Substation } from "@/lib/geo";
import { rankDependents } from "@/lib/engine";

const ICON: Record<Facility["kind"], string> = { hospital: "🏥", water: "💧", telecom: "📡", school: "🏫" };
const KIND: Record<Facility["kind"], string> = { hospital: "Hospital", water: "Water plant", telecom: "Telecom", school: "School / shelter" };
type Job = "dispatched" | "done";
const SPEED = 60; // simulation: 1 real second = 1 minute

export function InfraModule({ district }: { district: District }) {
  const [data, setData] = useState<{ subs: Substation[]; facs: Facility[]; demo: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failures, setFailures] = useState<Record<string, number>>({}); // subId -> failure timestamp
  const [jobs, setJobs] = useState<Record<string, Job>>({}); // facilityId or subId
  const [now, setNow] = useState(Date.now());
  const c = useRef<{ L: typeof Leaflet; map: Leaflet.Map; g?: Leaflet.LayerGroup } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(null); setSelected(null); setFailures({}); setJobs({});
    fetchInfra(district).then(setData);
  }, [district]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const isDown = (subId: string) => failures[subId] != null && jobs[subId] !== "done";
  const minsLeft = (f: Facility) => {
    const t0 = failures[f.substation];
    if (t0 == null) return f.backupHrs * 60;
    return Math.max(0, f.backupHrs * 60 - ((now - t0) / 1000) * (SPEED / 60));
  };
  const deps = useMemo(() => (data && selected ? rankDependents(data.facs.filter((f) => f.substation === selected)) : []), [data, selected]);
  const sub = data?.subs.find((s) => s.id === selected);
  const allAffected = useMemo(() => (data ? rankDependents(data.facs.filter((f) => isDown(f.substation) && jobs[f.id] !== "done")) : []), [data, failures, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const x = c.current; if (!x || !ready || !data) return;
    x.g?.remove();
    const g = x.L.layerGroup().addTo(x.map); x.g = g;
    const subById = new Map(data.subs.map((s) => [s.id, s]));
    for (const f of data.facs) {
      const s = subById.get(f.substation)!;
      const down = isDown(f.substation) && jobs[f.id] !== "done";
      const critical = down && minsLeft(f) < 60;
      x.L.polyline([[s.lat, s.lon], [f.lat, f.lon]], { color: down ? "#dc2626" : "#2E8B57", weight: down ? 3 : 1.5, dashArray: down ? "6 6" : undefined, opacity: 0.85 }).addTo(g);
      x.L.marker([f.lat, f.lon], { icon: x.L.divIcon({ className: "", html: `<div style="font-size:20px;${critical ? "filter:drop-shadow(0 0 6px #dc2626)" : ""}">${ICON[f.kind]}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }) })
        .bindTooltip(`${f.name} · ${KIND[f.kind]} · backup ${f.backupHrs}h`).addTo(g);
    }
    for (const s of data.subs) {
      x.L.marker([s.lat, s.lon], { icon: x.L.divIcon({ className: "", html: `<div class="pin" style="background:${isDown(s.id) ? "#dc2626" : "#1f6f5c"}">⚡</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
        .bindTooltip(`${s.name} (${s.voltage})`).on("click", () => setSelected(s.id)).addTo(g);
    }
    if (!selected) x.map.fitBounds(x.L.latLngBounds([...data.subs, ...data.facs].map((p) => [p.lat, p.lon])), { padding: [30, 30] });
  }, [data, failures, jobs, ready, Math.floor(now / 10000)]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (m: number) => (m <= 0 ? "POWER LOST" : m < 60 ? `${Math.round(m)} min left` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m left`);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_440px]">
        <div className="card-surface overflow-hidden">
          <div className="border-b px-5 py-3">
            <h2 className="text-lg font-bold text-deep">Infrastructure dependency graph · {district.name}, {district.state}</h2>
            <p className="text-xs text-muted-foreground">
              {data ? `${data.subs.length} substations · ${data.facs.length} connected facilities ${data.demo ? "(demo network)" : "(real locations from OpenStreetMap)"}` : "Loading substations & facilities…"} · Backup levels are demo data · 1 s = 1 min
            </p>
          </div>
          <LeafletMap className="h-[560px]" onReady={({ L, map }) => { L.tileLayer(TILES.light.url, { attribution: TILES.light.attr }).addTo(map); REF_OVERLAYS.forEach((u) => L.tileLayer(u, { attribution: "Labels © Esri" }).addTo(map)); c.current = { L, map }; setReady(true); }} />
        </div>
        <div className="space-y-4">
          <div className="card-surface p-4">
            <h3 className="font-bold text-deep"><T text={'Substations (nodes)'}/></h3>
            <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto">
              {data?.subs.map((s) => {
                const n = data.facs.filter((f) => f.substation === s.id).length;
                return (
                  <button key={s.id} onClick={() => setSelected(s.id)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${selected === s.id ? "border-primary bg-primary-soft" : "hover:bg-secondary"}`}>
                    <span><span className="font-semibold">{s.name}</span><span className="block text-xs text-muted-foreground">{s.voltage} · {n} dependents</span></span>
                    <span className={`text-xs font-semibold ${isDown(s.id) ? "text-severe" : jobs[s.id] === "done" ? "text-safe" : "text-muted-foreground"}`}>{isDown(s.id) ? "● FAILED" : jobs[s.id] === "done" ? "Restored" : "Online"}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {sub && (
            <div className="card-surface p-4">
              <h3 className="font-bold text-deep">{sub.name}</h3>
              <p className="text-xs text-muted-foreground">{deps.length} dependent facilities · ranked hospitals first, then least backup time</p>
              {!isDown(sub.id) ? (
                <button onClick={() => { setFailures({ ...failures, [sub.id]: Date.now() }); const j = { ...jobs }; delete j[sub.id]; deps.forEach((d) => delete j[d.id]); setJobs(j); }} className="mt-3 w-full rounded-lg bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"><T text={'⚡ Simulate failure'}/></button>
              ) : (
                <>
                  <ol className="mt-3 space-y-2">
                    {deps.map((f, i) => {
                      const m = minsLeft(f), done = jobs[f.id] === "done";
                      return (
                        <li key={f.id} className={`rounded-lg px-3 py-2 ${done ? "bg-primary-soft" : m < 60 ? "bg-severe/10" : "bg-secondary"}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-bold text-muted-foreground">#{i + 1}</span>
                            <span className="text-lg">{ICON[f.kind]}</span>
                            <span className="flex-1 text-sm"><span className="font-semibold">{f.name}</span><span className="block text-xs text-muted-foreground">{KIND[f.kind]} · backup {f.backupHrs} h</span></span>
                            <span className={`text-xs font-bold ${done ? "text-safe" : m < 60 ? "text-severe" : "text-deep"}`}>{done ? "✓ Powered" : fmt(m)}</span>
                          </div>
                          {!done && (
                            <div className="mt-2 flex gap-2">
                              {jobs[f.id] !== "dispatched" ? (
                                <button onClick={() => setJobs({ ...jobs, [f.id]: "dispatched" })} className="flex-1 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground"><T text={'🔧 Send repair team'}/></button>
                              ) : (
                                <>
                                  <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}&travelmode=driving`} className="flex-1 rounded-md border py-1.5 text-center text-xs font-semibold hover:bg-card"><T text={'🗺 Route team'}/></a>
                                  <button onClick={() => setJobs({ ...jobs, [f.id]: "done" })} className="flex-1 rounded-md bg-deep py-1.5 text-xs font-semibold text-primary-foreground"><T text={'✓ Mark complete'}/></button>
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${sub.lat},${sub.lon}&travelmode=driving`} className="rounded-lg border py-2 text-center text-sm font-semibold hover:bg-secondary"><T text={'🗺 To substation'}/></a>
                    <button onClick={() => { const j: Record<string, Job> = { ...jobs, [sub.id]: "done" }; deps.forEach((d) => (j[d.id] = "done")); setJobs(j); }} className="rounded-lg bg-deep py-2 text-sm font-semibold text-primary-foreground"><T text={'✓ Substation repaired'}/></button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {allAffected.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="text-lg font-bold text-deep"><T text={'Repair priority queue · all failures'}/></h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {allAffected.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="font-bold text-muted-foreground">#{i + 1}</span>{ICON[f.kind]}
                <span className="flex-1 truncate font-medium">{f.name}</span>
                <span className="text-xs font-bold text-severe">{fmt(minsLeft(f))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
