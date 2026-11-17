// Freight model. Biochar is light, so a trailer usually fills by volume before it reaches its weight limit ("cubes out").
import { LTL_BANDS, type AssumptionMap } from "@/config/assumptions";
export function truckCapacity(bulkDensity: number, A: AssumptionMap) {
  const byVolume = (A.trailerM3 * bulkDensity) / 1000;
  const tPerTruck = Math.min(A.truckWeightCapT, byVolume);
  return { tPerTruck, cubeLimited: byVolume < A.truckWeightCapT, byVolume };
}
export interface Leg { mode: "FTL" | "LTL" | "parcel" | "van"; usd: number; trucks: number; truckMiles: number; co2Kg: number; tPerTruck: number; cubeLimited: boolean; note: string }
export function ftl(miles: number, tonnes: number, bulkDensity: number, A: AssumptionMap): Leg {
  const cap = truckCapacity(bulkDensity, A);
  const trucks = Math.max(1, Math.ceil(tonnes / cap.tPerTruck - 1e-9));
  const truckMiles = trucks * miles;
  return { mode: "FTL", usd: Math.max(truckMiles * A.usdPerTruckMile, trucks * A.ftlMinUsd), trucks, truckMiles, co2Kg: truckMiles * A.kgCo2PerTruckMile, ...cap,
    note: `${trucks} truck${trucks > 1 ? "s" : ""} × ${Math.round(miles)} mi; ${cap.tPerTruck.toFixed(1)} t per truck${cap.cubeLimited ? " (cube-limited)" : ""}` };
}
export function ltl(miles: number, tonnes: number, A: AssumptionMap): Leg {
  const pallets = Math.max(1, Math.ceil((tonnes * 1000) / A.ltlPalletKg - 1e-9));
  const rate = LTL_BANDS.find((b) => miles <= b.maxMiles)!.usd;
  // LTL shares a truck: attribute CO2 by the share of a 26-pallet trailer.
  const share = Math.min(1, pallets / 26);
  return { mode: "LTL", usd: pallets * rate, trucks: 0, truckMiles: miles * share, co2Kg: miles * share * A.kgCo2PerTruckMile, tPerTruck: 0, cubeLimited: false, note: `${pallets} pallet${pallets > 1 ? "s" : ""} × $${rate}` };
}
export function parcel(tonnes: number, A: AssumptionMap): Leg {
  return { mode: "parcel", usd: tonnes * 1000 * A.parcelUsdPerKg, trucks: 0, truckMiles: 0, co2Kg: 0, tPerTruck: 0, cubeLimited: false, note: `${Math.round(tonnes * 1000)} kg by parcel` };
}
export function van(miles: number, A: AssumptionMap): Leg {
  return { mode: "van", usd: miles * A.vanUsdPerMile, trucks: 0, truckMiles: miles, co2Kg: miles * 0.4, tPerTruck: 0, cubeLimited: false, note: `Service van, ${Math.round(miles)} mi` };
}
// Cheapest sensible mode for a shipment. Bulk packaging always goes by full truck.
export function bestLeg(miles: number, tonnes: number, bulkDensity: number, bulkOnly: boolean, A: AssumptionMap): Leg {
  const f = ftl(miles, tonnes, bulkDensity, A);
  if (bulkOnly) return f;
  if (tonnes <= 0.07) return parcel(tonnes, A);
  const l = ltl(miles, tonnes, A);
  return l.usd < f.usd ? l : f;
}
