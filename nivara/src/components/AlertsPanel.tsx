import { T } from "@/lib/language";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Alert = Tables<"sos_alerts">;

/** Live "I am not safe" alerts from citizens, shown to authorities. */
export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    supabase.from("sos_alerts").select("*").neq("status", "resolved").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setAlerts(data ?? []));
    const ch = supabase.channel("sos").on("postgres_changes", { event: "*", schema: "public", table: "sos_alerts" }, (p) => {
      const row = p.new as Alert;
      setAlerts((a) => {
        const rest = a.filter((x) => x.id !== row.id);
        return row.status === "resolved" ? rest : [row, ...rest];
      });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function setStatus(id: string, status: "responding" | "resolved") {
    await supabase.from("sos_alerts").update({ status }).eq("id", id);
    setAlerts((a) => status === "resolved" ? a.filter((x) => x.id !== id) : a.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  return (
    <div className={`card-surface overflow-hidden ${alerts.some((a) => a.status === "open") ? "border-severe" : ""}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-3">
        <span className="flex items-center gap-2 font-bold text-deep">
          🔔 Citizen SOS alerts
          <span className={`rounded-full px-2 py-0.5 text-xs ${alerts.length ? "bg-severe text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{alerts.length}</span>
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="max-h-64 divide-y overflow-y-auto border-t">
          {alerts.length === 0 && <p className="px-5 py-3 text-sm text-muted-foreground"><T text={'No active alerts. Citizens who tap "I am not safe" will appear here instantly.'}/></p>}
          {alerts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${a.status === "open" ? "animate-pulse bg-severe" : "bg-moderate"}`} />
              <div className="min-w-[200px] flex-1">
                <div className="font-semibold">{a.area || "Unknown area"} <span className="text-xs font-normal text-muted-foreground">· {new Date(a.created_at).toLocaleTimeString()}</span></div>
                <div className="text-xs text-muted-foreground">📍 {a.lat.toFixed(5)}, {a.lon.toFixed(5)} {a.note && `· ${a.note}`}</div>
              </div>
              <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lon}&travelmode=driving`} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"><T text={'🗺 Navigate'}/></a>
              {a.status === "open" && <button onClick={() => setStatus(a.id, "responding")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><T text={'Send team'}/></button>}
              <button onClick={() => setStatus(a.id, "resolved")} className="rounded-lg bg-deep px-3 py-1.5 text-xs font-semibold text-primary-foreground"><T text={'✓ Rescued'}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
