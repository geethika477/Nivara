import { useEffect, useState } from 'react';
import { CloudRain, RefreshCw, Wind, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { liveRain, type Weather } from '@/lib/geo';
import { useLanguage } from '@/lib/language';
export function WeatherPanel({ lat, lon, area, weather }: { lat: number; lon: number; area: string; weather?: Weather | null }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<Weather | null>(weather ?? null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    let off = false;
    setData(weather ?? null); setError(false);
    if (weather && revision === 0) return;
    setLoading(true);
    liveRain(lat, lon).then((r) => { if (!off) setData(r); }).catch(() => { if (!off) setError(true); }).finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [lat, lon, weather, revision]);
  return <section className="weather-panel border-b border-border py-4" aria-label={t('Live weather')}>
    <div className="flex items-center gap-2"><CloudRain className="h-4 w-4 text-primary"/><h3 className="text-sm font-semibold">{t('Live weather')}</h3><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{area}</span><Button variant="ghost" size="icon" aria-label={t('Refresh weather')} title={t('Refresh weather')} disabled={loading} onClick={() => refresh((x) => x + 1)}><RefreshCw className={loading ? 'animate-spin' : ''}/></Button></div>
    {data ? <><div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
      <div><span className="text-xs text-muted-foreground">{t('Rain now')}</span><div className="font-display font-semibold">{data.now.toFixed(1)} mm/h</div></div>
      <div><span className="text-xs text-muted-foreground">{t('Today’s forecast')}</span><div className="font-display font-semibold">{data.day.toFixed(1)} mm</div></div>
      <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-high"/>{data.temperature.toFixed(1)} °C</div><div className="flex items-center gap-2"><Wind className="h-4 w-4 text-primary"/>{data.wind.toFixed(1)} km/h</div>
    </div><p className="mt-3 text-[11px] text-muted-foreground">Open-Meteo · {t('Updated')} {new Date(data.time).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}</p></> : <p className="py-2 text-sm text-muted-foreground">{t(error ? 'Weather unavailable' : 'Loading weather…')}</p>}
    {error && data && <p className="mt-2 text-xs text-destructive">{t('Weather unavailable')}</p>}
  </section>;
}
