import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

type Ctx = { L: typeof Leaflet; map: Leaflet.Map };

/** Client-only Leaflet map. `onReady` gets the Leaflet module + map instance once. */
export function LeafletMap({ onReady, className, center = [22.5, 79], zoom = 5 }: {
  onReady: (ctx: Ctx) => void; className?: string; center?: [number, number]; zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let map: Leaflet.Map | undefined;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !ref.current) return;
        map = L.map(ref.current, { zoomControl: true }).setView(center, zoom);
        onReady({ L, map });
        setTimeout(() => map?.invalidateSize(), 200);
      } catch { setErr(true); }
    })();
    return () => { cancelled = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={className}>
      {err && <p className="p-4 text-sm text-muted-foreground">Map failed to load.</p>}
    </div>
  );
}

// Esri basemaps: no key needed, verified to render real labelled tiles (incl. over Visakhapatnam).
// CARTO raster tiles returned an "API KEY REQUIRED" placeholder even with a key, so they are not used.
export const TILES = {
  street: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", attr: "© Esri, © OpenStreetMap contributors" },
  terrain: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", attr: "© Esri, © OpenStreetMap contributors" },
  light: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community" },
};

/** Transparent label/road overlays (verified 200 PNG) drawn above satellite imagery. */
export const REF_OVERLAYS = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
];
