import type { QtyUnit } from "./types";
import type { AssumptionMap } from "@/config/assumptions";
export const YD3_TO_M3 = 0.764555;
// Convert any quantity to tonnes and cubic metres using bulk density (kg/m³).
export function normalizeQty(qty: number, unit: QtyUnit, bulkDensity: number, A: AssumptionMap) {
  const m3 = unit === "t" ? (qty * 1000) / bulkDensity : unit === "m3" ? qty : unit === "yd3" ? qty * YD3_TO_M3 : qty * A.supersackM3;
  const tonnes = (m3 * bulkDensity) / 1000;
  return { tonnes, m3, yd3: m3 / YD3_TO_M3, supersacks: Math.ceil(m3 / A.supersackM3 - 1e-9) };
}
export const usd = (n: number, d = 0) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const num = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
