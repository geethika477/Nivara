import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ZoneUpdate = Tables<"zone_updates">;
export type Drain = Tables<"drain_reports">;
export const TEAMS = ["Rescue Team Alpha", "Rescue Team Bravo", "Drainage Crew 1", "Drainage Crew 2", "Fire & Rescue Unit"];

function useLive<T extends { id: string }>(table: "zone_updates" | "drain_reports") {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    supabase.from(table).select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => setRows((data ?? []) as unknown as T[]));
    const ch = supabase.channel(table + Math.random()).on("postgres_changes", { event: "*", schema: "public", table }, (p) => {
      const row = p.new as T;
      setRows((a) => [row, ...a.filter((x) => x.id !== row.id)]);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table]);
  return [rows, setRows] as const;
}
export const useZoneUpdates = () => useLive<ZoneUpdate>("zone_updates");
export const useDrains = () => useLive<Drain>("drain_reports");

const ZLABEL: Record<string, string> = { evacuated: "✅ Evacuated", in_progress: "🟠 Evacuation in progress", not_evacuated: "🚨 Not evacuated" };

/** Authority: rescue team zone updates + drainage clog reports with team assignment. */
export function OpsAlerts() {
  const [zones] = useZoneUpdates();
  const [drains, setDrains] = useDrains();
  async function assign(d: Drain, team: string) {
    await supabase.from("drain_reports").update({ team, status: "assigned" }).eq("id", d.id);
    setDrains((a) => a.map((x) => (x.id === d.id ? { ...x, team, status: "assigned" } : x)));
  }
  const open = drains.filter((d) => d.status !== "cleared");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-3 font-bold text-deep">🚤 Rescue team zone updates <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{zones.length}</span></div>
        <div className="max-h-64 divide-y overflow-y-auto border-t">
          {!zones.length && <p className="px-5 py-3 text-sm text-muted-foreground">No updates yet. Rescue teams post evacuation status from their dashboard.</p>}
          {zones.map((z) => (
            <div key={z.id} className="px-5 py-2.5 text-sm">
              <div className="font-semibold">{z.area} · <span className={z.status === "evacuated" ? "text-safe" : z.status === "not_evacuated" ? "text-severe" : "text-moderate"}>{ZLABEL[z.status] ?? z.status}</span></div>
              <div className="text-xs text-muted-foreground">{z.team} · {new Date(z.created_at).toLocaleTimeString()} {z.note && `· ${z.note}`}</div>
            </div>
          ))}
        </div>
      </div>
      <div className={`card-surface overflow-hidden ${open.some((d) => d.status === "open") ? "border-severe" : ""}`}>
        <div className="px-5 py-3 font-bold text-deep">🕳 Drainage clog reports <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{open.length}</span></div>
        <div className="max-h-64 divide-y overflow-y-auto border-t">
          {!open.length && <p className="px-5 py-3 text-sm text-muted-foreground">No open drainage reports.</p>}
          {open.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
              <div className="min-w-[160px] flex-1">
                <div className="font-semibold">{d.area || "Unknown area"}</div>
                <div className="text-xs text-muted-foreground">📍 {d.lat.toFixed(4)}, {d.lon.toFixed(4)} · {new Date(d.created_at).toLocaleTimeString()}</div>
              </div>
              {d.status === "assigned" ? <span className="text-xs font-semibold text-moderate">Assigned: {d.team}</span> : (
                <select defaultValue="" onChange={(e) => e.target.value && assign(d, e.target.value)} className="rounded-lg border bg-card px-2 py-1.5 text-xs">
                  <option value="" disabled>Assign team…</option>
                  {TEAMS.map((t) => <option key={t}>{t}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
