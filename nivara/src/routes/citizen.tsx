import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WeatherPanel } from "@/components/WeatherPanel";
import { T, useLanguage } from "@/lib/language";
import { Header } from "@/components/Header";
import { RouteNavigator } from "@/components/RouteNavigator";
import { elevationGrid, fetchPlaces, liveRain, nearestCell, reverseGeocode, applyScenario, riskLabel, distKm, type Weather, type Place } from "@/lib/geo";
import { enrichPlaces, safeZones } from "@/lib/engine";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/citizen")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Citizen Safety — Check Flood Risk Near You | Nivara" },
      { name: "description", content: "Share your location to see the flood risk in your area and get directions to the nearest safe zone." },
      { property: "og:title", content: "Citizen Safety — Nivara" },
      { property: "og:description", content: "Check flood risk at your location and navigate to a safe zone." },
    ],
  }),
  component: Citizen,
});

type Result = { lat: number; lon: number; area: string; risk: number | null; rainDay: number | null; weather: Weather | null; safe: Place | null; candidates: Place[]; warning: string };

function SosButton({ lat, lon, area }: { lat: number; lon: number; area: string }) {
  const { t } = useLanguage();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function send() {
    setState("sending");
    const { error } = await supabase.from("sos_alerts").insert({ lat, lon, area });
    setState(error ? "error" : "sent");
  }
  if (state === "sent") return <span className="rounded-lg bg-severe/10 px-3 py-2 text-sm font-semibold text-severe"><T text={'🚨 Help alerted — stay where you are safe'}/></span>;
  return (
    <Button onClick={send} disabled={state === "sending"} className="rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:opacity-90">
      {t(state === "sending" ? "Sending…" : state === "error" ? "Retry — I am not safe" : "🚨 I am not safe")}
    </Button>
  );
}

function ClogButton({ lat, lon, area }: { lat: number; lon: number; area: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function send() {
    setState("sending");
    const { error } = await supabase.from("drain_reports").insert({ lat, lon, area });
    setState(error ? "error" : "sent");
  }
  if (state === "sent") return <span className="rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-deep">🕳 Clog reported to authorities</span>;
  return <Button variant="outline" onClick={send} disabled={state === "sending"} className="rounded-lg px-4 py-2 text-sm font-semibold">{state === "sending" ? "Sending…" : state === "error" ? "Retry — report clog" : "🕳 Report drainage clog"}</Button>;
}

function Citizen() {
  const { t } = useLanguage();
  const [stage, setStage] = useState<"ask" | "loading" | "done" | "denied">("ask");
  const [res, setRes] = useState<Result | null>(null);
  const [msg, setMsg] = useState("");

  function locate() {
    if (!navigator.geolocation) { setStage("denied"); return; }
    setStage("loading"); setMsg("Getting your location…");
    navigator.geolocation.getCurrentPosition(async (p) => {
      try {
        const lat = p.coords.latitude, lon = p.coords.longitude;
        const bbox = { s: lat - 0.12, n: lat + 0.12, w: lon - 0.12, e: lon + 0.12 };
        setMsg("Checking rainfall and terrain…");
        const [geo, weatherResult, terrainResult] = await Promise.all([reverseGeocode(lat, lon), liveRain(lat, lon).then((value) => ({ value })).catch(() => ({ value: null })), elevationGrid(bbox).then((value) => ({ value })).catch(() => ({ value: null }))]);
        const rain = weatherResult.value;
        const cells0 = terrainResult.value;
        let risk: number | null = null;
        let candidates: Place[] = [];
        let warning = "";
        if (rain && cells0) {
          const sc = { rain: rain.wetHours ? rain.day / rain.wetHours : rain.now, duration: Math.max(1, rain.wetHours), water: 40 + Math.min(60, rain.day) };
          const cells = applyScenario(cells0, sc);
          risk = nearestCell(cells, lat, lon)?.risk ?? null;
          setMsg("Finding the nearest safe zone…");
          try {
            const pl = enrichPlaces(await fetchPlaces(bbox, { name: geo.label, state: geo.state, lat, lon, bbox, population: 0 }), cells);
            candidates = safeZones(pl, 8, [lat, lon]);
          } catch { warning = "Locality data unavailable. No safe-zone recommendation can be made."; }
        } else { warning = "Live weather or terrain unavailable. Flood risk and safe zones cannot be assessed; follow local emergency advice."; }
        setRes({ lat, lon, area: geo.label, risk, rainDay: rain?.day ?? null, weather: rain, safe: candidates[0] ?? null, candidates, warning });
        setStage("done");
      } catch { setMsg("Couldn't reach live data. Please try again."); setStage("ask"); }
    }, () => setStage("denied"), { enableHighAccuracy: true, timeout: 15000 });
  }

  const level = res?.risk == null ? "unknown" : res.risk >= 0.5 ? "high" : res.risk >= 0.3 ? "medium" : (res.rainDay ?? 0) > 0 ? "low" : "none";

  return (
    <div className="min-h-screen pb-16">
      <Header />
      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-8">
        {stage !== "done" && (
          <div className="card-surface mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl"><T text={'📍'}/></div>
            <h1 className="mt-4 text-2xl font-bold text-deep"><T text={'Is my area safe from floods?'}/></h1>
            <p className="mt-2 text-muted-foreground"><T text={'Nivara needs your location to check live rainfall and terrain around you.'}/></p>
            {stage === "denied" && <p className="mt-3 rounded-lg bg-severe/10 px-3 py-2 text-sm text-severe"><T text={'Location permission was blocked. Please allow location in your browser settings and try again.'}/></p>}
            <Button onClick={locate} disabled={stage === "loading"} className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {t(stage === "loading" ? msg : "Allow location & check")}
            </Button>
            {stage === "ask" && msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
          </div>
        )}

        {stage === "done" && res && (
          <>
            <div className={`card-surface p-6 ${level === "high" ? "border-severe" : ""}`}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-4xl">{level === "none" ? "✅" : level === "low" ? "🟡" : level === "medium" ? "🟠" : "🚨"}</div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-deep">
                    {t(level === "unknown" ? "Flood risk unavailable — follow local emergency advice." : level === "none" ? "Lower estimated flood risk in your area." : level === "low" ? "Flood risk is low in your area." : level === "medium" ? "Moderate flood risk near you." : "High estimated flood risk — follow local emergency advice.")}
                  </h1>
                  <p className="text-sm text-muted-foreground">{res.area} · {t("Today’s forecast")}: {res.rainDay?.toFixed(1) ?? "—"} mm · {res.risk == null ? "—" : t(riskLabel(res.risk))}</p>
                </div>
                <Button onClick={locate} className="rounded-lg border px-3 py-2 text-sm hover:bg-secondary"><T text={'↻ Refresh'}/></Button>
                <ClogButton lat={res.lat} lon={res.lon} area={res.area} />
                <SosButton lat={res.lat} lon={res.lon} area={res.area} />
              </div>
            </div>
            <WeatherPanel lat={res.lat} lon={res.lon} area={res.area} weather={res.weather} />
            {res.warning && <p className="border-l-2 border-moderate pl-3 text-sm text-muted-foreground">{t(res.warning)}</p>}
            <section className="py-3">
              <h2 className="text-lg font-bold text-deep">{t("Nearby safe-zone candidates")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("Nearest first · estimated risk, not verified shelters")}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {res.candidates.map((place, i) => <Button key={place.id} variant="outline" onClick={() => setRes((prev) => prev ? { ...prev, safe: place } : prev)} aria-pressed={res.safe?.id === place.id} className={`h-auto min-h-20 justify-between whitespace-normal text-left ${res.safe?.id === place.id ? "border-primary bg-primary-soft" : ""}`}>
                  <span className="min-w-0"><span className="block font-semibold">{place.name}</span><span className="mt-1 block text-xs text-muted-foreground">{distKm([res.lat, res.lon], [place.lat, place.lon]).toFixed(1)} km · {Math.round(place.elev)} m{ i === 0 ? ` · ${t("Nearest")}` : ""}</span></span><span aria-hidden="true">→</span>
                </Button>)}
              </div>
              {!res.candidates.length && <p className="py-4 text-sm text-muted-foreground">{t("No lower-risk locations available in this area.")}</p>}
            </section>
            <RouteNavigator
              stops={res.safe ? [{ lat: res.lat, lon: res.lon, label: t("You"), color: "var(--primary)" }, { lat: res.safe.lat, lon: res.safe.lon, label: t(`Safe zone: ${res.safe.name}`), color: "var(--safe)" }] : [{ lat: res.lat, lon: res.lon, label: t("You"), color: "var(--primary)" }]}
              legNames={[res.safe ? t(`Route to ${res.safe.name}`) : t("Your location")]}
            />
          </>
        )}
      </main>
    </div>
  );
}
