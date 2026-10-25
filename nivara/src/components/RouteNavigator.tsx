import { Button } from "@/components/ui/button";
import { T, useLanguage } from "@/lib/language";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { LeafletMap, TILES } from "./LeafletMap";
import { route, type RouteResult } from "@/lib/geo";

export type Stop = { lat: number; lon: number; label: string; color: string };

/** Google-Maps-style navigator: draws the road route through `stops` and lists turn-by-turn steps per leg. */
export function RouteNavigator({ stops, legNames, onLegChange, footer }: {
  stops: Stop[]; legNames: string[]; onLegChange?: (leg: number) => void; footer?: (leg: number, setLeg: (n: number) => void) => React.ReactNode;
}) {
  const { t } = useLanguage();
  const origin = stops[0], destination = stops.at(-1);
  const ctx = useRef<{ L: typeof Leaflet; map: Leaflet.Map; group?: Leaflet.LayerGroup } | null>(null);
  const [ready, setReady] = useState(false);
  const [res, setRes] = useState<RouteResult | null>(null);
  const [err, setErr] = useState("");
  const [leg, setLegState] = useState(0);
  const setLeg = (n: number) => { setLegState(n); onLegChange?.(n); };
  const key = stops.map((s) => `${s.lat},${s.lon}`).join("|");

  useEffect(() => {
    setRes(null); setErr(""); setLegState(0);
    if (stops.length < 2) return;
    let off = false;
    route(stops.map((s) => [s.lat, s.lon])).then((r) => { if (!off) setRes(r); }).catch((e) => { if (!off) setErr(e.message); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const c = ctx.current;
    if (!c || !ready) return;
    c.group?.remove();
    const g = c.L.layerGroup().addTo(c.map);
    c.group = g;
    stops.forEach((s, i) =>
      c.L.marker([s.lat, s.lon], { icon: c.L.divIcon({ className: "", html: `<div class="pin" style="background:${s.color}">${i === 0 ? "●" : String.fromCharCode(64 + i)}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
        .bindTooltip(s.label, { permanent: i > 0, direction: "top", offset: [0, -14] }).addTo(g));
    if (res) {
      res.legs.forEach((l, i) =>
        c.L.polyline(l.coords, { color: i === 0 ? "#2563eb" : "#16a34a", weight: i === leg ? 7 : 4, opacity: i === leg ? 0.95 : 0.4 }).addTo(g));
      c.map.fitBounds(c.L.latLngBounds(res.legs[leg]?.coords.length ? res.legs[leg].coords : res.coords), { padding: [40, 40] });
    } else if (stops.length > 1) c.map.fitBounds(c.L.latLngBounds(stops.map((s) => [s.lat, s.lon])), { padding: [40, 40] });
    else if (origin) c.map.setView([origin.lat, origin.lon], 14);
  }, [res, leg, ready, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = res?.legs[leg];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <LeafletMap className="h-[480px] overflow-hidden rounded-lg border"
        onReady={({ L, map }) => { L.tileLayer(TILES.street.url, { attribution: TILES.street.attr }).addTo(map); ctx.current = { L, map }; setReady(true); }} />
      <div className="card-surface flex max-h-[480px] flex-col overflow-hidden">
        <div className="flex gap-1 border-b p-2">
          {legNames.map((n, i) => (
            <Button variant="ghost" key={n} onClick={() => setLeg(i)} className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold ${leg === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{n}</Button>
          ))}
        </div>
        {err && <p className="p-4 text-sm text-destructive">Road directions unavailable ({err}). No safe road route has been verified.</p>}
        {stops.length > 1 && !res && !err && <p className="p-4 text-sm text-muted-foreground"><T text="Calculating road route…"/></p>}
        {cur && (
          <>
            <div className="bg-primary-soft px-4 py-3">
              <div className="text-2xl font-bold text-deep">{Math.round(cur.steps.reduce((s, x) => s + x.dist, 0) / 100) / 10} km</div>
              <div className="text-xs text-muted-foreground">{stops[leg]?.label} → {stops[leg + 1]?.label}</div>
            </div>
            <ol className="flex-1 divide-y overflow-y-auto text-sm">
              {cur.steps.map((s, i) => (
                <li key={i} className="flex gap-3 px-4 py-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">{i + 1}</span>
                  <span className="flex-1">{t(s.text)}</span>
                  <span className="text-xs text-muted-foreground">{s.dist >= 1000 ? `${(s.dist / 1000).toFixed(1)} km` : `${Math.round(s.dist)} m`}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        {stops.length > 1 && origin && destination && (
          <a target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destination.lat},${destination.lon}${stops.length > 2 ? `&waypoints=${stops.slice(1, -1).map((s) => `${s.lat},${s.lon}`).join("|")}` : ""}&travelmode=driving`}
            className="m-3 mb-0 rounded-lg border border-primary py-2.5 text-center text-sm font-semibold text-deep hover:bg-primary-soft">
            <T text="🗺 Show in Google Maps"/>
          </a>
        )}
        {footer && <div className="border-t p-3">{footer(leg, setLeg)}</div>}
      </div>
    </div>
  );
}
