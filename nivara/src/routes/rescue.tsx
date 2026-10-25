import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TEAMS, useDrains, useZoneUpdates } from "@/components/OpsPanels";

export const Route = createFileRoute("/rescue")({
  head: () => ({
    meta: [
      { title: "Rescue Teams — Evacuation Updates & Assigned Jobs | Nivara" },
      { name: "description", content: "Rescue teams report flood zone evacuation status and handle drainage jobs assigned by authorities." },
      { property: "og:title", content: "Rescue Teams — Nivara" },
      { property: "og:description", content: "Post evacuation updates and manage assigned rescue and drainage jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rescue,
});

function Rescue() {
  const [team, setTeam] = useState(TEAMS[0]!);
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [zones] = useZoneUpdates();
  const [drains, setDrains] = useDrains();

  async function post(status: string) {
    if (!area.trim()) { setMsg("Enter the flood zone / area name."); return; }
    const { error } = await supabase.from("zone_updates").insert({ area: area.trim(), team, status, note: note.trim() });
    setMsg(error ? "Couldn't send — try again." : "✓ Update sent to Authority Command");
    if (!error) { setArea(""); setNote(""); }
  }
  async function clear(id: string) {
    await supabase.from("drain_reports").update({ status: "cleared" }).eq("id", id);
    setDrains((a) => a.map((x) => (x.id === id ? { ...x, status: "cleared" } : x)));
  }
  const jobs = drains.filter((d) => d.status === "assigned" && d.team === team);

  return (
    <div className="min-h-screen pb-16">
      <Header />
      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-8">
        <div className="card-surface flex flex-wrap items-center gap-3 p-5">
          <h1 className="flex-1 text-2xl font-bold text-deep">Rescue team dashboard</h1>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-lg border bg-card px-3 py-2 text-sm">
            {TEAMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card-surface space-y-3 p-5">
            <h2 className="text-lg font-bold text-deep">Update flood zone status</h2>
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Zone / area (e.g. Gajuwaka)" className="w-full rounded-lg border bg-card px-3 py-2 text-sm" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional, e.g. 40 people moved)" className="w-full rounded-lg border bg-card px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={() => post("evacuated")} className="bg-safe text-primary-foreground">Evacuated</Button>
              <Button onClick={() => post("in_progress")} variant="outline">In progress</Button>
              <Button onClick={() => post("not_evacuated")} className="bg-destructive text-destructive-foreground">Not evacuated</Button>
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </div>
          <div className="card-surface p-5">
            <h2 className="text-lg font-bold text-deep">Assigned jobs · {team}</h2>
            <div className="mt-3 space-y-2">
              {!jobs.length && <p className="text-sm text-muted-foreground">No jobs assigned to this team right now.</p>}
              {jobs.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="flex-1"><span className="font-semibold">🕳 Drainage clog · {d.area || "Unknown area"}</span><span className="block text-xs text-muted-foreground">📍 {d.lat.toFixed(4)}, {d.lon.toFixed(4)}</span></span>
                  <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}&travelmode=driving`} className="rounded-md border px-2 py-1 text-xs font-semibold">🗺 Navigate</a>
                  <Button size="sm" onClick={() => clear(d.id)}>✓ Cleared</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card-surface p-5">
          <h2 className="text-lg font-bold text-deep">Recent zone updates</h2>
          <div className="mt-2 divide-y">
            {zones.slice(0, 15).map((z) => <div key={z.id} className="py-2 text-sm"><span className="font-semibold">{z.area}</span> · {z.status.replace("_", " ")} <span className="text-xs text-muted-foreground">· {z.team} · {new Date(z.created_at).toLocaleTimeString()}</span></div>)}
            {!zones.length && <p className="text-sm text-muted-foreground">No updates yet.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
