import { describe, it, expect } from "vitest";
import { buildZones, rankDependents } from "@/lib/engine";
import type { Place } from "@/lib/geo";

const p = (name: string, population: number, risk: number): Place => ({ id: 1, name, lat: 0, lon: 0, type: "town", population, elev: 0, risk });

describe("decision engine", () => {
  it("ranks zones by population and flood arrival time", () => {
    const zones = buildZones([p("small-late", 1000, 0.4), p("big-soon", 90000, 0.9), p("safe", 50000, 0.1)], { rain: 60, duration: 12, water: 50 }, 1);
    expect(zones.map((z) => z.places[0]!.name)).toEqual(["big-soon", "small-late"]);
    expect(zones[0]!.label).toBe("Zone A");
  });
  it("puts hospitals first, then least backup", () => {
    const r = rankDependents([{ kind: "water", backupHrs: 0.5 }, { kind: "hospital", backupHrs: 6 }, { kind: "hospital", backupHrs: 2 }]);
    expect(r.map((x) => x.backupHrs)).toEqual([2, 6, 0.5]);
  });
});
