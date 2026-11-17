// Application-weighted matching. Extends v0.1 (feedstock, size path, distance, scale) with hard filters, verification,
// longevity, consistency, lead time and credit eligibility. Every score comes with a reason.
import type { Lot, Org, Rfq, QuoteOption, PsdPoint } from "@/lib/domain/types";
import { type AppProfile } from "@/config/applications";
import { type Grade, METALS_MAX, verRank, gradeByCode, VERIFICATION_LADDER } from "@/config/grades";
import type { AssumptionMap } from "@/config/assumptions";
import { sizePath, checkLimits, blendPsd, screenedPsd, type SizePath, type HubOp, type LimitResult } from "./psd";
import { buildOption, type Distances, type Part } from "@/lib/logistics/quote";
import { co2ePerTonne } from "@/lib/credits";

export interface Criterion { key: string; label: string; score: number; max: number; why: string }
export interface Match {
  lot: Lot; org: Org | undefined; feasible: boolean; fixable: boolean; hardFails: string[]; missing: string[]; path: SizePath; extraOps: HubOp[];
  availableOut: number; fillTonnes: number; option: QuoteOption | null; perT: number; breakdown: Criterion[]; score: number; limits: LimitResult[];
}
export const pickGrade = (rfq: Pick<Rfq, "answers">, app: AppProfile): Grade => gradeByCode(typeof rfq.answers.grade === "string" && app.grades.includes(rfq.answers.grade) ? rfq.answers.grade : app.grades[0]);
const monthsSince = (d: string | undefined, now: string) => (d ? (new Date(now).getTime() - new Date(d).getTime()) / (30.44 * 864e5) : Infinity);
const VER_SCORE: Record<string, number> = { self_reported: 0, coa_uploaded: 0.45, third_party: 0.8, charlink_tested: 0.92, field_proven: 1 };

export interface MatchCtx { rfq: Rfq; app: AppProfile; lots: Lot[]; orgs: Org[]; dist: Distances; A: AssumptionMap; model?: "agent" | "principal"; creditShare?: boolean; now?: string }

export function evaluate(ctx: MatchCtx): Match[] {
  const { rfq, app, lots, orgs, dist, A } = ctx; const now = ctx.now ?? "2026-11-17"; const grade = pickGrade(rfq, app);
  const first: Match[] = lots.map((lot) => {
    const org = orgs.find((o) => o.id === lot.org_id);
    const hardFails: string[] = []; const missing: string[] = []; let fixable = true;
    const path = sizePath(lot, grade, A);
    if (path.path === "infeasible") { hardFails.push(path.reason); fixable = false; }
    if (lot.status === "quarantine") { hardFails.push("Lot is quarantined"); fixable = false; }
    if (lot.status === "sold") { hardFails.push("Lot is sold"); fixable = false; }
    const metals = checkLimits(lot, METALS_MAX);
    for (const m of metals) if (m.ok === false) { hardFails.push(`${m.limit.prop.replace("metal_", "")} ${m.value} mg/kg exceeds the ${m.limit.value} mg/kg maximum`); fixable = false; }
    if (metals.some((m) => m.ok == null)) { missing.push("No metals data: lab panel required"); if (app.strict_verification) hardFails.push("No metals data (required for this application)"); }
    const extraOps: HubOp[] = [];
    const moistLimit = grade.limits.find((l) => l.prop === "moisture"); const moist = lot.properties.moisture?.value;
    if (moistLimit && typeof moist === "number" && moist > moistLimit.value) extraOps.push("dry");
    if (moistLimit && typeof moist !== "number") missing.push("Moisture not reported");
    const others = checkLimits(lot, grade.limits.filter((l) => l.prop !== "psd" && l.prop !== "moisture" && !l.prop.startsWith("metal_")));
    for (const r of others) {
      if (r.ok === false && r.limit.prop !== "h_corg") { hardFails.push(`${r.limit.prop} ${r.value} ${r.limit.op === "<=" ? "above" : "below"} the ${r.limit.value} ${r.limit.unit} limit${r.limit.status === "draft" ? " (draft limit)" : ""}`); fixable = false; }
      if (r.ok == null) missing.push(`${r.limit.prop} not reported`);
    }
    if (app.strict_verification && verRank(lot.verification) < verRank(grade.min_verification)) hardFails.push(`Needs ${VERIFICATION_LADDER[verRank(grade.min_verification)].label.toLowerCase()} before sale for this application`);
    else if (verRank(lot.verification) < verRank(grade.min_verification)) missing.push(`Below the grade's minimum verification (${VERIFICATION_LADDER[verRank(grade.min_verification)].label}): sample and test first`);
    if (monthsSince(lot.coa_date, now) > 24 && lot.coa_date) missing.push("COA is older than 24 months: re-test");
    if (!lot.longevity && app.weights.longevity > 0) missing.push("No longevity (column) data");
    if (!app.feed.includes(lot.feedClass)) missing.push(`Feedstock class "${lot.feedClass}" is unusual for this application`);
    const viaHub = path.path !== "direct" || extraOps.length > 0;
    const availableOut = lot.quantity_t * (viaHub ? path.yield : 1);
    const fillTonnes = Math.min(rfq.tonnes, availableOut);
    const feasible = hardFails.length === 0;
    const option = path.path !== "infeasible" && fillTonnes > 0 && dist.direct[lot.id] != null
      ? buildOption({ id: `opt-${lot.id}`, label: viaHub ? "Via Chicago hub" : "Direct from producer", parts: [{ lot, outTonnes: fillTonnes, path, extraOps }], packaging: rfq.packaging, sampleFirst: rfq.sample_first, dist, A, model: ctx.model ?? "principal", creditShare: !!ctx.creditShare }) : null;
    return { lot, org, feasible, fixable: !feasible && fixable && hardFails.length > 0, hardFails, missing, path, extraOps, availableOut, fillTonnes, option, perT: option?.per_t ?? Infinity, breakdown: [], score: 0, limits: [...checkLimits(lot, grade.limits)] };
  });
  const best = Math.min(...first.filter((m) => m.feasible).map((m) => m.perT), Infinity);
  const w = app.weights;
  for (const m of first) {
    const lot = m.lot; const sib = lots.filter((l) => l.org_id === lot.org_id).map((l) => l.properties.c_org?.value).filter((v): v is number => typeof v === "number");
    const mean = sib.reduce((s, v) => s + v, 0) / (sib.length || 1); const cv = sib.length > 1 ? Math.sqrt(sib.reduce((s, v) => s + (v - mean) ** 2, 0) / sib.length) / mean : null;
    const days = rfq.need_by ? (new Date(rfq.need_by).getTime() - new Date(now).getTime()) / 864e5 : null; const lead = m.option?.lead_days ?? lot.lead_time_days;
    const hc = lot.properties.h_corg?.value; const cr = co2ePerTonne(lot, A);
    const c = (key: string, label: string, max: number, frac: number, why: string): Criterion => ({ key, label, max, score: Math.round(max * Math.max(0, Math.min(1, frac)) * 10) / 10, why });
    m.breakdown = [
      c("landed", "Landed cost", w.landed, isFinite(m.perT) && isFinite(best) ? 1 - (m.perT - best) / best : 0, isFinite(m.perT) ? `$${m.perT}/t delivered${isFinite(best) ? ` vs best $${best}/t` : ""}; ${Math.round(m.option?.miles ?? 0)} truck-miles` : "No route"),
      c("size", "Size fit", w.size, m.path.path === "direct" ? 1 : m.path.path === "via_hub" ? 0.35 + 0.45 * m.path.yield : 0, m.path.reason),
      c("verification", "Verification", w.verification, VER_SCORE[lot.verification], VERIFICATION_LADDER[verRank(lot.verification)].label),
      c("longevity", "Longevity evidence", w.longevity, lot.longevity ? 1 : 0, lot.longevity ? `${lot.longevity.bed_volumes} bed volumes to ${lot.longevity.pollutant} breakthrough` : "No column data"),
      c("consistency", "Lot consistency", w.consistency, cv == null ? 0.5 : 1 - cv / 0.15, cv == null ? "Only one lot from this producer: unknown" : `Organic-carbon variation across ${sib.length} lots: ${(cv * 100).toFixed(1)}%`),
      c("capacity", "Covers the quantity", w.capacity, m.availableOut / rfq.tonnes, `${m.availableOut.toFixed(1)} t in grade available vs ${rfq.tonnes.toFixed(1)} t needed`),
      c("lead", "Lead time", w.lead, days != null ? (lead <= days ? 1 : 0.25) : 1 - lead / 30, days != null ? `${lead} days vs ${Math.round(days)} days until needed` : `${lead} days`),
      c("credit", "Credit eligibility", w.credit, cr.eligible && typeof hc === "number" ? 1 : 0, typeof hc === "number" ? `H:Corg ${hc}; ~${cr.value} t CO₂e per tonne` : "H:Corg not reported"),
      c("feed", "Feedstock fit", w.feed, app.feed.includes(lot.feedClass) ? 1 : 0, lot.feedstock),
    ].filter((x) => x.max > 0);
    m.score = Math.round(m.breakdown.reduce((s, x) => s + x.score, 0));
  }
  return first.sort((a, b) => Number(b.feasible) - Number(a.feasible) || Number(b.fixable) - Number(a.fixable) || b.score - a.score);
}

// If no single lot covers the quantity, combine the best lots at the hub and check the blended material against the grade.
export interface Blend { parts: Part[]; option: QuoteOption; psd: PsdPoint[]; limits: LimitResult[]; meets: boolean; covers: boolean }
export function proposeBlend(matches: Match[], ctx: MatchCtx, maxLots = 4): Blend | null {
  const { rfq, app, A, dist } = ctx; const grade = pickGrade(rfq, app);
  const pool = matches.filter((m) => m.feasible).sort((a, b) => a.perT - b.perT);
  if (!pool.length || pool[0].availableOut >= rfq.tonnes - 0.01) return null; // the cheapest lot covers it alone
  let need = rfq.tonnes; const parts: Part[] = [];
  for (const m of pool.slice(0, maxLots)) { if (need <= 0.01) break; const t = Math.min(need, m.availableOut); parts.push({ lot: m.lot, outTonnes: t, path: m.path, extraOps: m.extraOps }); need -= t; }
  if (parts.length < 2) return null;
  const psd = blendPsd(parts.map((p) => ({ psd: p.path.path === "direct" || p.path.ops[0] === "mill" ? p.lot.psd : screenedPsd(p.lot.psd, grade.band_mm), tonnes: p.outTonnes })));
  const limits = checkLimits({ psd, properties: {} }, grade.limits.filter((l) => l.prop === "psd"));
  const option = buildOption({ id: "opt-blend", label: `Blend of ${parts.length} lots at the Chicago hub`, parts, packaging: rfq.packaging, sampleFirst: rfq.sample_first, dist, A, model: ctx.model ?? "principal", creditShare: !!ctx.creditShare, forceHub: true });
  return { parts, option, psd, limits, meets: limits.every((l) => l.ok), covers: need <= 0.01 };
}

// "Same char, closer source": an equally suitable lot with lower transport emissions than the buyer's current supplier.
export function closerSource(matches: Match[], currentOrgId: string | undefined) {
  if (!currentOrgId) return null;
  const tier = (m: Match) => (m.path.path === "direct" ? 2 : m.path.path === "via_hub" ? 1 : 0);
  const current = matches.filter((m) => m.lot.org_id === currentOrgId && m.option).sort((a, b) => tier(b) - tier(a) || a.perT - b.perT)[0];
  if (!current?.option) return null;
  const better = matches.filter((m) => m.feasible && m.option && m.lot.org_id !== currentOrgId && tier(m) >= tier(current) && m.option.co2_kg < current.option!.co2_kg && m.fillTonnes >= current.fillTonnes - 0.01)
    .sort((a, b) => a.option!.co2_kg - b.option!.co2_kg)[0];
  if (!better?.option) return { current, better: null as Match | null, savedCo2Kg: 0, savedUsd: 0, savedMiles: 0 };
  return { current, better, savedCo2Kg: current.option.co2_kg - better.option.co2_kg, savedUsd: current.option.total - better.option.total, savedMiles: current.option.miles - better.option.miles };
}
