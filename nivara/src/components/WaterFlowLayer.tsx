import { useEffect, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { fetchWaterways, nearestCell, type Cell, type District, type Waterway } from '@/lib/geo';
import { useLanguage } from '@/lib/language';
export function WaterFlowLayer({ context, district, cells, enabled }: { context: { L: typeof Leaflet; map: Leaflet.Map } | null; district: District | null; cells: Cell[]; enabled: boolean }) {
  const [waterways, setWaterways] = useState<Waterway[]>([]);
  const [status, setStatus] = useState('');
  const { language } = useLanguage();
  useEffect(() => {
    setWaterways([]); setStatus('');
    if (!district || !enabled) return;
    let off = false;
    setStatus('Loading mapped waterways…');
    fetchWaterways(district.bbox).then((data) => { if (!off) { setWaterways(data); setStatus(data.length ? '' : 'No mapped waterways available. Only simulated downhill paths are shown.'); } }).catch(() => { if (!off) setStatus('Waterway data unavailable. Only simulated downhill paths are shown.'); });
    return () => { off = true; };
  }, [district, enabled]);
  useEffect(() => {
    if (!context || !enabled) return;
    const { L, map } = context;
    const group = L.layerGroup().addTo(map);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--flow-water').trim();
    const severe = getComputedStyle(document.documentElement).getPropertyValue('--severe').trim();
    const addFlow = (coords: [number, number][], risk: number, real: boolean, name: string) => {
      L.polyline(coords, { color: real ? color : severe, weight: real ? 6 : 2, opacity: real ? .7 : .45, interactive: real }).bindTooltip(name + (real ? ' · Flow animation is illustrative, not measured current' : ' · Simulated downhill drainage')).addTo(group);
      const p = L.polyline(coords, { className: real ? 'river-current' : 'drainage-current', color: real ? color : severe, weight: real ? 3 : 2, dashArray: real ? '2 18' : '4 14', opacity: 1, interactive: false }).addTo(group);
      (p.getElement() as SVGElement | undefined)?.style.setProperty('--flow-speed', `${Math.max(.5, 2.8 - risk * 2.2)}s`);
    };
    for (const w of waterways) { const first = w.coords[0]; if (first) addFlow(w.coords, nearestCell(cells, first[0], first[1])?.risk ?? 0, true, w.name); }
    for (const cell of cells) if (cell.flowTo) addFlow([[cell.lat, cell.lon], cell.flowTo], cell.risk, false, 'Simulated drainage');
    return () => { group.remove(); };
  }, [context, waterways, cells, enabled, language]);
  return enabled && status ? <div className="absolute right-3 top-14 z-[1000] max-w-64 rounded-md border bg-card/95 p-2 text-xs text-muted-foreground">{status}</div> : null;
}
