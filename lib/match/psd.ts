// Particle-size logic: does a lot meet a grade, and if not, can the hub make it meet it?
// Fine char can never become coarse. Coarse char can be screened, or crushed and screened, at a cost and a yield loss.
import type { Lot, PsdPoint } from "@/lib/domain/types";
import type { Grade, Limit } from "@/config/grades";
import type { AssumptionMap } from "@/config/assumptions";

export function passingAt(psd: PsdPoint[], mm: number): number {
  if (!psd.length) return NaN;
  const p = [...psd].sort((a, b) => a.sieve_mm - b.sieve_mm);
  if (mm <= 0) return 0;
  if (mm <= p[0].sieve_mm) return (p[0].pct_passing * mm) / p[0].sieve_mm;
  if (mm >= p[p.length - 1].sieve_mm) return p[p.length - 1].pct_passing;
  const i = p.findIndex((x) => x.sieve_mm >= mm);
  const a = p[i - 1], b = p[i];
  const t = (Math.log(mm) - Math.log(a.sieve_mm)) / (Math.log(b.sieve_mm) - Math.log(a.sieve_mm));
  return a.pct_passing + t * (b.pct_passing - a.pct_passing);
}
export const dValue = (psd: PsdPoint[], pct: number): number => {
  const p = [...psd].sort((a, b) => a.sieve_mm - b.sieve_mm);
  if (pct <= p[0].pct_passing) return p[0].sieve_mm * (pct / Math.max(p[0].pct_passing, 1e-9));
  for (let i = 1; i < p.length; i++) if (p[i].pct_passing >= pct) { const a = p[i - 1], b = p[i]; const t = (pct - a.pct_passing) / Math.max(b.pct_passing - a.pct_passing, 1e-9); return Math.exp(Math.log(a.sieve_mm) + t * (Math.log(b.sieve_mm) - Math.log(a.sieve_mm))); }
  return p[p.length - 1].sieve_mm;
};
const cmp = (v: number, l: Limit) => (l.op === "<=" ? v <= l.value + 1e-9 : v >= l.value - 1e-9);
export interface LimitResult { limit: Limit; value: number | null; ok: boolean | null }
export function checkLimits(lot: Pick<Lot, "psd" | "properties">, limits: Limit[]): LimitResult[] {
  return limits.map((l) => {
    if (l.prop === "psd") { const v = passingAt(lot.psd, l.sieve_mm!); return { limit: l, value: isNaN(v) ? null : v, ok: isNaN(v) ? null : cmp(v, l) }; }
    const pv = lot.properties[l.prop]; const v = pv && typeof pv.value === "number" ? pv.value : null;
    return { limit: l, value: v, ok: v == null ? null : cmp(v, l) };
  });
}
export type HubOp = "screen" | "crush" | "mill" | "dry" | "blend" | "bag";
export interface SizePath { path: "direct" | "via_hub" | "infeasible"; ops: HubOp[]; yield: number; reason: string }
export function sizePath(lot: Pick<Lot, "psd" | "properties">, grade: Grade, A: AssumptionMap): SizePath {
  const psdLimits = grade.limits.filter((l) => l.prop === "psd");
  const res = checkLimits(lot, psdLimits);
  if (res.every((r) => r.ok)) return { path: "direct", ops: [], yield: 1, reason: "Already in the size band" };
  const [lo, hi] = grade.band_mm;
  if (lo === 0) return { path: "via_hub", ops: ["mill"], yield: 0.97, reason: `Mill to below ${hi} mm at the hub` }; // any char can be ground finer
  const inBand = (passingAt(lot.psd, hi) - passingAt(lot.psd, lo)) / 100;
  const oversize = 1 - passingAt(lot.psd, hi) / 100;
  if (inBand >= A.minScreenYield && oversize < 0.05) return { path: "via_hub", ops: ["screen"], yield: inBand, reason: `Screen to ${lo}–${hi} mm: ${Math.round(inBand * 100)}% of the lot is in band` };
  const withCrush = inBand + A.crushYield * oversize;
  if (oversize >= 0.05 && withCrush >= A.minScreenYield) return { path: "via_hub", ops: ["crush", "screen"], yield: withCrush, reason: `Crush oversize and screen to ${lo}–${hi} mm: about ${Math.round(withCrush * 100)}% yield` };
  return { path: "infeasible", ops: [], yield: Math.max(inBand, 0), reason: `Too fine: only ${Math.round(Math.max(inBand, 0) * 100)}% of the lot is coarser than ${lo} mm. Fine char cannot be made coarse.` };
}
// PSD of what leaves the hub after screening a lot to a band (renormalized to the in-band fraction).
export function screenedPsd(psd: PsdPoint[], band: [number, number]): PsdPoint[] {
  const lo = passingAt(psd, band[0]), hi = passingAt(psd, band[1]);
  return psd.map((p) => ({ sieve_mm: p.sieve_mm, pct_passing: Math.round(Math.min(100, Math.max(0, ((passingAt(psd, Math.min(Math.max(p.sieve_mm, band[0]), band[1])) - lo) / Math.max(hi - lo, 1e-9)) * 100)) * 10) / 10 }));
}
export function blendPsd(parts: { psd: PsdPoint[]; tonnes: number }[]): PsdPoint[] {
  const total = parts.reduce((s, p) => s + p.tonnes, 0);
  const sieves = [...new Set(parts.flatMap((p) => p.psd.map((x) => x.sieve_mm)))].sort((a, b) => a - b);
  return sieves.map((s) => ({ sieve_mm: s, pct_passing: Math.round((parts.reduce((sum, p) => sum + passingAt(p.psd, s) * p.tonnes, 0) / total) * 10) / 10 }));
}
