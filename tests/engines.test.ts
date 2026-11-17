import { describe, it, expect } from "vitest";
import { DEFAULTS as A } from "@/config/assumptions";
import { normalizeQty } from "@/lib/domain/units";
import { truckCapacity, ftl, ltl, bestLeg } from "@/lib/logistics/freight";
import { passingAt, sizePath, blendPsd, dValue } from "@/lib/match/psd";
import { gradeByCode } from "@/config/grades";
import { appById, APPLICATIONS } from "@/config/applications";
import { evaluate, proposeBlend, closerSource } from "@/lib/match";
import { estimateDistances } from "@/lib/logistics/distances";
import { buildOption } from "@/lib/logistics/quote";
import { apply, available, money, HAPPY_PATH } from "@/lib/orders/machine";
import { co2ePerTonne, registryEligibility } from "@/lib/credits";
import { seedLots, allOrgs } from "@/lib/data";
import type { Rfq, Order } from "@/lib/domain/types";

const lot = (id: string) => seedLots.find((l) => l.id === id)!;
const rfq = (o: Partial<Rfq>): Rfq => ({ id: "R", created: "2026-11-17", buyer_name: "T", application: "natural_pools", answers: {}, qty: 4, qty_unit: "t", tonnes: 4, m3: 16, dest: { label: "Madison, WI", lat: 43.07, lng: -89.4 }, packaging: "supersack", sample_first: true, status: "submitted", ...o });
const run = (r: Rfq) => { const app = appById(r.application); const dist = estimateDistances(seedLots, allOrgs, r.dest, A); const ctx = { rfq: r, app, lots: seedLots, orgs: allOrgs, dist, A }; return { ctx, matches: evaluate(ctx) }; };

describe("units", () => {
  it("converts between tonnes, m³, yd³ and supersacks using bulk density", () => {
    expect(normalizeQty(5, "t", 250, A)).toMatchObject({ tonnes: 5, m3: 20, supersacks: 20 });
    expect(normalizeQty(10, "m3", 200, A).tonnes).toBeCloseTo(2);
    expect(normalizeQty(10, "yd3", 250, A).m3).toBeCloseTo(7.64555);
    expect(normalizeQty(8, "supersack", 250, A).tonnes).toBeCloseTo(2);
  });
});
describe("freight", () => {
  it("cubes out for light char and weighs out for dense material", () => {
    expect(truckCapacity(150, A)).toMatchObject({ tPerTruck: 15, cubeLimited: true });
    expect(truckCapacity(250, A)).toMatchObject({ tPerTruck: 20, cubeLimited: false });
  });
  it("prices full truckloads by truck-miles", () => {
    const leg = ftl(1000, 20, 250, A);
    expect(leg.trucks).toBe(1); expect(leg.usd).toBe(3000); expect(ftl(50, 20, 250, A).usd).toBe(850); expect(leg.co2Kg).toBeCloseTo(1570);
    expect(ftl(100, 45, 150, A).trucks).toBe(3);
  });
  it("uses LTL for small loads and FTL for bulk", () => {
    expect(bestLeg(200, 1, 250, false, A).mode).toBe("LTL");
    expect(bestLeg(200, 1, 250, true, A).mode).toBe("FTL");
    expect(ltl(200, 1, A).usd).toBe(4 * 190);
    expect(bestLeg(200, 0.05, 250, false, A).mode).toBe("parcel");
  });
});
describe("particle size", () => {
  it("interpolates percent passing and d-values", () => {
    const p = lot("LOT-MTZ-01").psd;
    expect(passingAt(p, 2)).toBe(8); expect(passingAt(p, 3)).toBeGreaterThan(12); expect(passingAt(p, 3)).toBeLessThan(45);
    expect(dValue(p, 50)).toBeGreaterThan(4);
  });
  it("coarse lot ships direct for the coarse grade", () => expect(sizePath(lot("LOT-MTZ-01"), gradeByCode("CL-FC"), A).path).toBe("direct"));
  it("unscreened lot goes via the hub with a yield loss", () => {
    const s = sizePath(lot("LOT-TCH-01"), gradeByCode("CL-FC"), A);
    expect(s.path).toBe("via_hub"); expect(s.ops).toEqual(["screen"]); expect(s.yield).toBeCloseTo(0.76, 2);
    expect(sizePath(lot("LOT-ABC-01"), gradeByCode("CL-FC"), A).path).toBe("infeasible"); // only 45% is coarser than 2 mm
    expect(sizePath(lot("LOT-ABC-01"), gradeByCode("CL-BR"), A)).toMatchObject({ path: "via_hub", ops: ["crush", "screen"] });
  });
  it("fine char can never become coarse", () => expect(sizePath(lot("LOT-WKF-01"), gradeByCode("CL-FC"), A).path).toBe("infeasible"));
  it("any char can be milled fine for concrete", () => expect(sizePath(lot("LOT-MTZ-01"), gradeByCode("CL-CF"), A)).toMatchObject({ path: "via_hub", ops: ["mill"] }));
  it("blends PSDs by mass", () => {
    const b = blendPsd([{ psd: [{ sieve_mm: 1, pct_passing: 0 }, { sieve_mm: 2, pct_passing: 100 }], tonnes: 1 }, { psd: [{ sieve_mm: 1, pct_passing: 100 }, { sieve_mm: 2, pct_passing: 100 }], tonnes: 3 }]);
    expect(b[0].pct_passing).toBe(75);
  });
});
describe("matching", () => {
  it("scenario 1: only a few lots qualify for coarse natural-pool media; fine lots are ruled out with a reason", () => {
    const { matches } = run(rfq({}));
    const ok = matches.filter((m) => m.feasible);
    expect(ok.length).toBeGreaterThanOrEqual(3); expect(ok.length).toBeLessThanOrEqual(9);
    expect(ok.some((m) => m.path.path === "direct")).toBe(true); expect(ok.some((m) => m.path.path === "via_hub")).toBe(true);
    const fine = matches.find((m) => m.lot.id === "LOT-WKF-01")!; expect(fine.feasible).toBe(false); expect(fine.hardFails[0]).toMatch(/Too fine/);
    expect(matches[0].feasible).toBe(true);
    for (const m of matches) expect(Math.round(m.breakdown.reduce((s, c) => s + c.max, 0))).toBe(100);
  });
  it("rejects the lot that fails metals and flags the stale COA", () => {
    const { matches } = run(rfq({ application: "soil_ag", tonnes: 20, qty: 20 }));
    expect(matches.find((m) => m.lot.id === "LOT-PCW-03")!.hardFails.join(" ")).toMatch(/Pb 410/);
    expect(matches.find((m) => m.lot.id === "LOT-ARTI-01")!.missing.join(" ")).toMatch(/older than 24 months/);
  });
  it("scenario 2: proposes a blend when no single lot covers a bioretention order", () => {
    const { ctx, matches } = run(rfq({ application: "bioretention", tonnes: 55, qty: 55, packaging: "bulk_ftl", sample_first: false, dest: { label: "Aurora, IL", lat: 41.76, lng: -88.32 } }));
    const blend = proposeBlend(matches, ctx)!;
    expect(blend).toBeTruthy(); expect(blend.parts.length).toBeGreaterThanOrEqual(2); expect(blend.covers).toBe(true); expect(blend.meets).toBe(true);
    expect(blend.option.kind).toBe("blend");
  });
  it("scenario 4: concrete needs milling, and damp lots get a drying step", () => {
    const { matches } = run(rfq({ application: "concrete", tonnes: 5, qty: 5, dest: { label: "Joliet, IL", lat: 41.53, lng: -88.08 } }));
    const damp = matches.find((m) => m.lot.id === "LOT-PCW-04")!; expect(damp.extraOps).toContain("dry"); expect(damp.path.ops).toContain("mill");
    expect(matches.find((m) => m.lot.id === "LOT-WKF-02")!.path.path).toBe("direct");
  });
  it("scenario 6: suggests a closer source with lower CO₂", () => {
    const { matches } = run(rfq({ application: "stormwater_filtration", answers: { grade: "CL-FM" }, tonnes: 18, qty: 18, dest: { label: "Milwaukee, WI", lat: 43.04, lng: -87.91 } }));
    const s = closerSource(matches, "obs")!;
    expect(s.better).toBeTruthy(); expect(s.savedCo2Kg).toBeGreaterThan(0); expect(s.savedMiles).toBeGreaterThan(500);
  });
  it("every application profile has weights that sum to 100", () => { for (const a of APPLICATIONS) expect(Object.values(a.weights).reduce((s, v) => s + v, 0)).toBe(100); });
});
describe("quote", () => {
  it("line items add up, and the fee follows the business model", () => {
    const l = lot("LOT-MTZ-01"); const dist = { direct: { [l.id]: 600 }, toHub: { [l.id]: 580 }, hubToBuyer: 150, live: false };
    const base = { id: "o", label: "x", parts: [{ lot: l, outTonnes: 4, path: sizePath(l, gradeByCode("CL-FC"), A), extraOps: [] }], packaging: "supersack" as const, sampleFirst: false, dist, A, creditShare: false };
    const agent = buildOption({ ...base, model: "agent" }); const principal = buildOption({ ...base, model: "principal" });
    expect(agent.items.reduce((s, i) => s + i.usd, 0)).toBeCloseTo(agent.total, 1);
    const cost = agent.total - agent.fee_usd;
    expect(agent.fee_usd).toBeCloseTo(cost * 0.08, 1);
    expect(principal.fee_usd / principal.total).toBeCloseTo(0.2, 2);
    expect(agent.producer_payout).toBe(4 * 980); expect(agent.kind).toBe("direct");
    const withCredit = buildOption({ ...base, model: "agent", creditShare: true }); expect(withCredit.total).toBeLessThan(agent.total);
  });
  it("via-hub options buy extra input to cover the yield loss", () => {
    const l = lot("LOT-TCH-01"); const p = sizePath(l, gradeByCode("CL-FC"), A); const dist = { direct: { [l.id]: 200 }, toHub: { [l.id]: 100 }, hubToBuyer: 150, live: false };
    const o = buildOption({ id: "o", label: "x", parts: [{ lot: l, outTonnes: 7.6, path: p, extraOps: [] }], packaging: "supersack", sampleFirst: true, dist, A, model: "principal", creditShare: false });
    expect(o.kind).toBe("via_hub"); expect(o.lots[0].tonnes).toBeCloseTo(10, 0); expect(o.items.some((i) => i.key.startsWith("fines"))).toBe(true);
  });
});
describe("orders", () => {
  const base: Order = { id: "O", rfq_id: "R", quote_id: "Q", option: {} as any, created: "t", state: "po_issued", events: [], payments: [], deposit_pct: 30, total: 10000, fee_usd: 1500, producer_payout: 6000, credit_t_co2e: 8, finishing_needed: false };
  it("walks the happy path and blocks illegal moves", () => {
    let o = base;
    expect(() => apply(o, "ship", "t")).toThrow();
    for (const a of ["pay_deposit", "producer_confirm", "ready", "ship", "deliver", "confirm_pod", "release", "issue_docs", "close"]) o = apply(o, a, "t");
    expect(o.state).toBe("closed"); expect(o.events.length).toBe(9);
    expect(() => apply(base, "start_finishing", "t")).toThrow();
  });
  it("requires finishing before shipping when the order goes via the hub", () => {
    let o: Order = apply(apply({ ...base, finishing_needed: true }, "pay_deposit", "t"), "producer_confirm", "t");
    expect(available(o).map((t) => t.action)).toEqual(["start_finishing"]);
    o = apply(o, "start_finishing", "t"); expect(available(o).map((t) => t.action)).toEqual(["ready"]);
  });
  it("supports a dispute path", () => {
    let o = base; for (const a of ["pay_deposit", "producer_confirm", "ready", "ship", "deliver", "dispute", "resolve"]) o = apply(o, a, "t");
    expect(o.state).toBe("pod_confirmed");
  });
  it("splits money into deposit, balance, payout, fee and pass-through", () => {
    expect(money(base)).toEqual({ deposit: 3000, balance: 7000, payout: 6000, fee: 1500, passThrough: 2500 });
    expect(HAPPY_PATH[0]).toBe("po_issued");
  });
});
describe("credits", () => {
  it("estimates CO₂e from carbon content and H:Corg", () => {
    const r = co2ePerTonne({ properties: { c_org: { value: 80, verification: "third_party" }, h_corg: { value: 0.3, verification: "third_party" }, moisture: { value: 10, verification: "third_party" } } }, A);
    expect(r.value).toBeCloseTo(0.9 * 0.8 * 0.7 * (44 / 12), 2);
    expect(co2ePerTonne({ properties: { c_org: { value: 80, verification: "third_party" }, h_corg: { value: 0.9, verification: "third_party" } } }, A).eligible).toBe(false);
    expect(co2ePerTonne(null, A).value).toBe(2.15);
  });
  it("marks steel as not eligible and stormwater as eligible under CAR", () => {
    expect(registryEligibility("metallurgical").registries.every((r) => r.status === "not eligible")).toBe(true);
    expect(registryEligibility("stormwater_filtration").registries.find((r) => r.name.startsWith("Climate"))!.status).toBe("eligible");
  });
});
