// Carbon removal estimate and registry eligibility. Estimates only: the producer's registry decides what is issued.
import type { Lot } from "@/lib/domain/types";
import type { AssumptionMap } from "@/config/assumptions";
export function co2ePerTonne(lot: Pick<Lot, "properties"> | null, A: AssumptionMap) {
  const c = lot?.properties.c_org?.value, hc = lot?.properties.h_corg?.value, m = lot?.properties.moisture?.value;
  if (typeof c !== "number" || typeof hc !== "number") return { value: A.co2ePerTChar, method: `Default ${A.co2ePerTChar} t CO₂e per tonne (no carbon data for this lot)`, eligible: true };
  if (hc > 0.7) return { value: 0, method: "H:Corg above 0.7: not eligible as biochar under IBI/EBC thresholds", eligible: false };
  const stable = hc < 0.4 ? 0.7 : 0.5; // IBI stable-carbon factor by H:Corg class (recalled from the IBI method; verify)
  const dry = typeof m === "number" ? 1 - m / 100 : 1;
  const value = Math.round(dry * (c / 100) * stable * (44 / 12) * 100) / 100;
  return { value, method: `Dry mass ${(dry * 100).toFixed(0)}% × organic C ${c}% × stable fraction ${stable} (H:Corg ${hc}) × 44/12`, eligible: true };
}
export interface Registry { name: string; status: "eligible" | "not named" | "verify" | "not eligible"; note: string }
const SOURCE = "spent-media-burial-credit-share-nov2 (team research). Verify with each registry before relying on it.";
export function registryEligibility(appId: string): { registries: Registry[]; source: string; once: string } {
  const soil = ["bioretention", "horticulture", "soil_ag", "green_roof"].includes(appId);
  const filter = ["stormwater_filtration", "natural_pools", "industrial_stormwater", "produced_water"].includes(appId);
  const r: Registry[] = appId === "metallurgical"
    ? ["Puro.earth", "Isometric", "CAR", "EBC C-Sink"].map((name) => ({ name, status: "not eligible" as const, note: "Carbon is burned: an emissions reduction, not a removal." }))
    : [
      { name: "Climate Action Reserve", status: filter || soil ? "eligible" : "verify", note: filter ? "Eligible end-use list (Mar 2024) names stormwater management and landfill disposal." : soil ? "Soil application is eligible." : "Check the eligible end-use list." },
      { name: "Puro.earth", status: soil || appId === "concrete" ? "eligible" : filter ? "not named" : "verify", note: appId === "concrete" ? "Concrete counts as a durable end use." : soil ? "Soil use is covered." : "Filter use is not named." },
      { name: "Isometric", status: soil ? "eligible" : filter ? "not named" : "verify", note: soil ? "Soil is named." : "Filter use is not named; landfill is." },
      { name: "EBC C-Sink", status: soil ? "eligible" : filter ? "not named" : "verify", note: "Tracked by an accredited C-sink broker to the final sink." },
    ];
  return { registries: r, source: SOURCE, once: "Credits are claimed once. If the producer claims at installation, later burial secures permanence but creates no new credits." };
}
