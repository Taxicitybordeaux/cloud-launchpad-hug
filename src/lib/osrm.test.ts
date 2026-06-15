// @ts-expect-error - bun:test types not installed (test-only)
import { describe, expect, it } from "bun:test";
import { calibrateKm, calibrationFactor, labelForAlternative } from "./osrm";

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

describe("calibrateKm — référence Gare St-Jean ↔ Aéroport (Google source of truth)", () => {
  // Tolérance ±0.5 km : OSRM peut renvoyer 14.5–14.9 / 17.2–17.6 / 21.8–22.2
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
