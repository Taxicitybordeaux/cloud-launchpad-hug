// @ts-expect-error - bun:test types not installed (test-only)
import { describe, expect, it } from "bun:test";
import {
  BORDEAUX_AIRPORT_EXACT_KM,
  calibrateKm,
  calibrationFactor,
  getRouteAlternatives,
  isBordeauxAirportRoute,
  labelForAlternative,
} from "./osrm";

describe("calibrationFactor (per-bucket)", () => {
  it("urbain court < 10 km → 1.08", () => {
    expect(calibrationFactor(3)).toBe(1.08);
    expect(calibrationFactor(9.99)).toBe(1.08);
  });
  it("mixte 10–20 km → 1.09", () => {
    expect(calibrationFactor(10)).toBe(1.09);
    expect(calibrationFactor(17.4)).toBe(1.09);
    expect(calibrationFactor(19.99)).toBe(1.09);
  });
  it("long / rocade ≥ 20 km → 1.10", () => {
    expect(calibrationFactor(20)).toBe(1.10);
    expect(calibrationFactor(22)).toBe(1.10);
    expect(calibrationFactor(80)).toBe(1.10);
  });
});

describe("calibrateKm — calibration générique avant override exact", () => {
  // Les trajets métier connus sont corrigés ensuite par BORDEAUX_AIRPORT_EXACT_KM.
  it("court 14.7 → ~16 km (Google)", () => {
    expect(calibrateKm(14.7)).toBeCloseTo(16.02, 1);
  });
  it("intermédiaire 17.4 → ~19 km (Google)", () => {
    expect(calibrateKm(17.4)).toBeCloseTo(18.97, 1);
  });
  it("rocade 22 → ~24 km (Google)", () => {
    expect(calibrateKm(22)).toBeCloseTo(24.2, 1);
  });
});

describe("labelForAlternative", () => {
  it("3 alts → court / intermédiaire / rocade", () => {
    expect(labelForAlternative(0, 3)).toBe("court");
    expect(labelForAlternative(1, 3)).toBe("intermédiaire");
    expect(labelForAlternative(2, 3)).toBe("rocade");
  });
  it("2 alts → court / rocade", () => {
    expect(labelForAlternative(0, 2)).toBe("court");
    expect(labelForAlternative(1, 2)).toBe("rocade");
  });
  it("1 alt → court", () => {
    expect(labelForAlternative(0, 1)).toBe("court");
  });
  it("4 alts → premier court, dernier rocade, milieu intermédiaire", () => {
    expect(labelForAlternative(0, 4)).toBe("court");
    expect(labelForAlternative(1, 4)).toBe("intermédiaire");
    expect(labelForAlternative(2, 4)).toBe("intermédiaire");
    expect(labelForAlternative(3, 4)).toBe("rocade");
  });
});

describe("Gare St-Jean ↔ Aéroport Hall A exact route distances", () => {
  const gare: [number, number] = [44.8265, -0.5569];
  const airport: [number, number] = [44.8291, -0.7028];

  it("reconnaît le trajet dans les deux sens", () => {
    expect(isBordeauxAirportRoute(gare, airport)).toBe(true);
    expect(isBordeauxAirportRoute(airport, gare)).toBe(true);
  });

  it("force exactement 17 / 20 / 24 km même si OSRM renvoie moins", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          routes: [
            {
              distance: 13600,
              duration: 1200,
              geometry: { coordinates: [[-0.5569, 44.8265], [-0.7028, 44.8291]] },
            },
            {
              distance: 17500,
              duration: 1560,
              geometry: { coordinates: [[-0.5569, 44.8265], [-0.62, 44.82], [-0.7028, 44.8291]] },
            },
            {
              distance: 20600,
              duration: 1860,
              geometry: { coordinates: [[-0.5569, 44.8265], [-0.63, 44.8066], [-0.7028, 44.8291]] },
            },
          ],
        }),
      )) as typeof fetch;

    try {
      const alts = await getRouteAlternatives(gare, airport);
      expect(alts.map((a) => a.distanceKm)).toEqual([
        BORDEAUX_AIRPORT_EXACT_KM.court,
        BORDEAUX_AIRPORT_EXACT_KM["intermédiaire"],
        BORDEAUX_AIRPORT_EXACT_KM.rocade,
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
