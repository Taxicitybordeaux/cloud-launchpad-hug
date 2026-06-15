import { describe, expect, it } from "bun:test";
import { buildPriceUpdatePush } from "../src/lib/push-messages";

describe("buildPriceUpdatePush — multilingual price update copy", () => {
  const CLIENT = "Marie";
  const PRICE = 42.5;
  const KM = 12.3;

  it("FR uses '💶 Prix mis à jour' and mentions the chosen route", () => {
    const m = buildPriceUpdatePush("fr", CLIENT, PRICE, KM);
    expect(m.title).toBe("💶 Prix mis à jour");
    expect(m.body).toContain("Marie");
    expect(m.body).toContain("itinéraire");
    expect(m.body).toContain("12.3");
    expect(m.body).toContain("42.50");
  });

  it("EN uses 'Price updated' and mentions the route", () => {
    const m = buildPriceUpdatePush("en", CLIENT, PRICE, KM);
    expect(m.title).toBe("💶 Price updated");
    expect(m.body).toContain("route");
    expect(m.body).toContain("€42.50");
    expect(m.body).toContain("12.3");
  });

  it("ES uses 'Precio actualizado'", () => {
    const m = buildPriceUpdatePush("es", CLIENT, PRICE, KM);
    expect(m.title).toBe("💶 Precio actualizado");
    expect(m.body).toContain("itinerario");
    expect(m.body).toContain("42.50");
  });

  it("PT uses 'Preço atualizado'", () => {
    const m = buildPriceUpdatePush("pt", CLIENT, PRICE, KM);
    expect(m.title).toBe("💶 Preço atualizado");
    expect(m.body).toContain("itinerário");
    expect(m.body).toContain("42.50");
  });

  it("IT uses 'Prezzo aggiornato'", () => {
    const m = buildPriceUpdatePush("it", CLIENT, PRICE, KM);
    expect(m.title).toBe("💶 Prezzo aggiornato");
    expect(m.body).toContain("itinerario");
    expect(m.body).toContain("42.50");
  });

  it("AR uses Arabic title and body", () => {
    const m = buildPriceUpdatePush("ar", CLIENT, PRICE, KM);
    expect(m.title).toBe("💶 تم تحديث السعر");
    expect(m.body).toContain("سائقك");
    expect(m.body).toContain("42.50");
    expect(m.body).toContain("12.3");
  });

  it("falls back to FR when lang is unknown / null", () => {
    const m1 = buildPriceUpdatePush(null, CLIENT, PRICE, KM);
    const m2 = buildPriceUpdatePush("zz", CLIENT, PRICE, KM);
    expect(m1.title).toBe("💶 Prix mis à jour");
    expect(m2.title).toBe("💶 Prix mis à jour");
  });

  it("uses 'Client' fallback when name is empty", () => {
    const m = buildPriceUpdatePush("fr", "", PRICE, KM);
    expect(m.body).toContain("Client");
  });
});
