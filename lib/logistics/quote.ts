// Landed-cost quote engine. Pure function of lots, distances and assumptions, so it runs the same in the browser, the API and tests.
import type { Lot, QuoteOption, LineItem, Packaging } from "@/lib/domain/types";
import type { AssumptionMap } from "@/config/assumptions";
import type { SizePath, HubOp } from "@/lib/match/psd";
import { bestLeg, ftl, type Leg } from "./freight";
import { co2ePerTonne } from "@/lib/credits";
import { verRank } from "@/config/grades";

export interface Distances { direct: Record<string, number>; toHub: Record<string, number>; hubToBuyer: number; live: boolean }
export interface Part { lot: Lot; outTonnes: number; path: SizePath; extraOps: HubOp[] }
export interface QuoteInput { id: string; label: string; parts: Part[]; packaging: Packaging; sampleFirst: boolean; dist: Distances; A: AssumptionMap; model: "agent" | "principal"; feePct?: number; creditShare: boolean; forceHub?: boolean; includeTesting?: boolean }
const OP_COST: Record<HubOp, keyof AssumptionMap> = { screen: "screenUsdPerT", crush: "crushUsdPerT", mill: "millUsdPerT", dry: "dryUsdPerT", blend: "blendUsdPerT", bag: "hubHandlingUsdPerT" };
const bd = (lot: Lot, A: AssumptionMap) => (typeof lot.properties.bulk_density?.value === "number" ? (lot.properties.bulk_density.value as number) : A.defaultBulkDensity);

export function packagingCost(tonnes: number, m3: number, p: Packaging, A: AssumptionMap): LineItem | null {
  if (p === "bulk_ftl") return null;
  if (p === "supersack") { const n = Math.ceil(m3 / A.supersackM3 - 1e-9); return { key: "packaging", label: `Packaging: ${n} supersack${n > 1 ? "s" : ""}`, usd: n * A.supersackUsd }; }
  if (p === "bag") { const n = Math.ceil((tonnes * 1000) / A.bagKg - 1e-9); return { key: "packaging", label: `Packaging: ${n} bags (${A.bagKg} kg)`, usd: n * A.bagUsd }; }
  const n = Math.ceil((tonnes * 1000) / A.cartridgeKg - 1e-9); return { key: "packaging", label: `Packaging: ${n} pre-filled cartridges`, usd: n * A.cartridgeUsd };
}

export function buildOption(q: QuoteInput): QuoteOption {
  const { parts, A, dist } = q;
  const out = parts.reduce((s, p) => s + p.outTonnes, 0);
  const viaHub = q.forceHub || parts.length > 1 || parts.some((p) => p.path.path !== "direct" || p.extraOps.length > 0);
  const kind: QuoteOption["kind"] = parts.length > 1 ? "blend" : viaHub ? "via_hub" : "direct";
  const items: LineItem[] = []; const notes: string[] = []; const legs: Leg[] = [];
  let charCost = 0, m3 = 0;
  for (const p of parts) {
    const y = viaHub ? p.path.yield : 1; const input = p.outTonnes / y; const density = bd(p.lot, A);
    m3 += (p.outTonnes * 1000) / density;
    charCost += input * p.lot.price_ask_per_t;
    items.push({ key: `char:${p.lot.id}`, label: `Char: ${p.lot.id}, ${input.toFixed(1)} t × $${p.lot.price_ask_per_t}/t`, usd: input * p.lot.price_ask_per_t, note: y < 1 ? `Buy ${input.toFixed(1)} t to get ${p.outTonnes.toFixed(1)} t in grade (${Math.round(y * 100)}% yield)` : "Producer ask (DEMO price)" });
    if (viaHub) {
      const leg = input < 3 ? bestLeg(dist.toHub[p.lot.id] ?? 0, input, density, false, A) : ftl(dist.toHub[p.lot.id] ?? 0, input, density, A); legs.push(leg);
      items.push({ key: `inbound:${p.lot.id}`, label: `Freight to hub (${leg.mode}): ${p.lot.id}`, usd: leg.usd, note: leg.note });
      const ops = [...p.path.ops, ...p.extraOps];
      const fin = ops.reduce((s, o) => s + input * A[OP_COST[o]], 0) + input * A.hubHandlingUsdPerT;
      items.push({ key: `finish:${p.lot.id}`, label: `Hub finishing: ${ops.length ? ops.join(" + ") : "receive and test"}`, usd: fin, note: "Estimate: no toll-finishing quote yet" });
      if (input - p.outTonnes > 0.05) items.push({ key: `fines:${p.lot.id}`, label: `Credit for off-spec fines (${(input - p.outTonnes).toFixed(1)} t to soil/ag)`, usd: -(input - p.outTonnes) * A.finesSalvageUsdPerT, note: "Estimate" });
    }
  }
  if (parts.length > 1) items.push({ key: "blend", label: "Hub: blend lots to one grade", usd: out * A.blendUsdPerT, note: "Estimate" });
  const avgDensity = (out * 1000) / m3;
  const outMiles = viaHub ? dist.hubToBuyer : dist.direct[parts[0].lot.id] ?? 0;
  const outLeg = bestLeg(outMiles, out, avgDensity, q.packaging === "bulk_ftl", A); legs.push(outLeg);
  items.push({ key: "outbound", label: `Freight ${viaHub ? "hub" : "producer"} → buyer (${outLeg.mode})`, usd: outLeg.usd, note: outLeg.note });
  const pack = packagingCost(out, m3, q.packaging, A); if (pack) items.push({ ...pack, note: "Estimate" });
  if (q.sampleFirst) items.push({ key: "sample", label: "Sample shipping", usd: A.sampleShipUsd, note: "Estimate" });
  const untested = parts.filter((p) => verRank(p.lot.verification) < verRank("third_party"));
  if (q.includeTesting !== false && untested.length) { items.push({ key: "testing", label: `Third-party lab panel + sieve analysis (${untested.length} lot${untested.length > 1 ? "s" : ""})`, usd: untested.length * (A.testPanelUsd + A.psdTestUsd), note: "Lots below third-party verification are tested before shipping. Estimate." }); }
  const cost = items.reduce((s, i) => s + i.usd, 0);
  const feePct = q.feePct ?? (q.model === "agent" ? A.agentFeePct : A.principalMarginPct);
  const fee = q.model === "agent" ? (cost * feePct) / 100 : (cost * (feePct / 100)) / (1 - feePct / 100);
  items.push({ key: "fee", label: q.model === "agent" ? `CharLink commission (${feePct}%)` : `CharLink margin (${feePct}% of price)`, usd: fee, note: q.model === "agent" ? "Agent model: producer invoices the buyer" : "Principal model: CharLink buys and resells" });
  const credit = parts.reduce((s, p) => s + p.outTonnes * co2ePerTonne(p.lot, A).value, 0);
  if (q.creditShare && credit > 0) items.push({ key: "credit", label: `Credit-share price reduction (${A.creditSharePct}% of ~${credit.toFixed(1)} t CO₂e × $${A.creditUsdPerT})`, usd: -(credit * A.creditUsdPerT * A.creditSharePct) / 100, note: "Producer lowers the char price because CharLink documents a creditable end use. Estimate; depends on registry." });
  const total = items.reduce((s, i) => s + i.usd, 0);
  const miles = legs.reduce((s, l) => s + l.truckMiles, 0);
  if (outLeg.cubeLimited && outLeg.mode === "FTL") notes.push(`Cube-limited: a 53 ft trailer fills at ${outLeg.tPerTruck.toFixed(1)} t of this char, below the ${A.truckWeightCapT} t weight limit.`);
  if (!dist.live) notes.push("Road miles are estimated (straight line × 1.25). Add ORS_API_KEY for truck routing.");
  return {
    id: q.id, label: q.label, kind, lots: parts.map((p) => ({ lot_id: p.lot.id, tonnes: Math.round((p.outTonnes / (viaHub ? p.path.yield : 1)) * 10) / 10 })), mode: outLeg.mode,
    miles: Math.round(miles), trucks: legs.reduce((s, l) => s + l.trucks, 0), cube_limited: outLeg.cubeLimited && outLeg.mode === "FTL", t_per_truck: outLeg.tPerTruck, co2_kg: Math.round(legs.reduce((s, l) => s + l.co2Kg, 0)),
    items: items.map((i) => ({ ...i, usd: Math.round(i.usd * 100) / 100 })), total: Math.round(total * 100) / 100, per_t: Math.round(total / out), per_m3: Math.round(total / m3), fee_usd: Math.round(fee * 100) / 100,
    producer_payout: Math.round(charCost * 100) / 100, lead_days: Math.max(...parts.map((p) => p.lot.lead_time_days)) + (viaHub ? 4 : 0) + Math.ceil(outMiles / 500), live_routing: dist.live, notes,
  };
}
