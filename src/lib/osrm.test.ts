// @ts-expect-error - bun:test types not installed (test-only)
import { describe, expect, it } from "bun:test";
import {
  BORDEAUX_AIRPORT_EXACT_KM,
  calibrateKm,
  calibrationFactor,
  getRouteAlternatives,
  isBordeauxAirportRoute,
  isBordeauxAirportRouteText,
  labelForAlternative,
} from "./osrm";

describe("calibrationFactor (per-bucket)", () => {
  it("centre-ville < 5 km → 1.06", () => {
    expect(calibrationFactor(1)).toBe(1.06);
    expect(calibrationFactor(4.99)).toBe(1.06);
  });
  it("urbain élargi 5–12 km → 1.08", () => {
    expect(calibrationFactor(5)).toBe(1.08);
    expect(calibrationFactor(11.99)).toBe(1.08);
  });
  it("mixte rocade 12–25 km → 1.10", () => {
    expect(calibrationFactor(12)).toBe(1.10);
    expect(calibrationFactor(17.4)).toBe(1.10);
    expect(calibrationFactor(24.99)).toBe(1.10);
  });
  it("interurbain 25–60 km → 1.11", () => {
    expect(calibrationFactor(25)).toBe(1.11);
    expect(calibrationFactor(59.99)).toBe(1.11);
  });
  it("longue distance ≥ 60 km → 1.08", () => {
    expect(calibrationFactor(60)).toBe(1.08);
    expect(calibrationFactor(200)).toBe(1.08);
  });
});

describe("calibrateKm — calibration générique avant override exact", () => {
  // Les trajets métier connus sont corrigés ensuite par BORDEAUX_AIRPORT_EXACT_KM.
  it("court 14.7 → ~16 km (Google)", () => {
    expect(calibrateKm(14.7)).toBeCloseTo(16.17, 1);
  });
  it("intermédiaire 17.4 → ~19 km (Google)", () => {
    expect(calibrateKm(17.4)).toBeCloseTo(19.14, 1);
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
    expect(isBordeauxAirportRouteText("Rue Charles Domercq, Bordeaux", "Aéroport Bordeaux-Mérignac Hall A")).toBe(true);
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

  it("force exactement 17 / 20 / 24 km via détection texte même si les coordonnées géocodées sont approximatives", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          routes: [
            {
              distance: 13600,
              duration: 1200,
              geometry: { coordinates: [[-0.57, 44.84], [-0.7028, 44.8291]] },
            },
            {
              distance: 17500,
              duration: 1560,
              geometry: { coordinates: [[-0.57, 44.84], [-0.62, 44.82], [-0.7028, 44.8291]] },
            },
            {
              distance: 20600,
              duration: 1860,
              geometry: { coordinates: [[-0.57, 44.84], [-0.63, 44.8066], [-0.7028, 44.8291]] },
            },
          ],
        }),
      )) as typeof fetch;

    try {
      const approximateGare: [number, number] = [44.84, -0.57];
      const alts = await getRouteAlternatives(approximateGare, airport, true);
      expect(alts.map((a) => a.distanceKm)).toEqual([17, 20, 24]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
