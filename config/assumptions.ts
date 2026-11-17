// Every default the engines use, in one place. Each has a source note and a basis: "sourced", "team" (project research) or "estimate" (no quote yet).
export interface Assumption { key: string; label: string; value: number; unit: string; basis: "sourced" | "team" | "estimate"; source: string; }
const a = (key: string, label: string, value: number, unit: string, basis: Assumption["basis"], source: string): Assumption => ({ key, label, value, unit, basis, source });

export const ASSUMPTION_LIST: Assumption[] = [
  a("usdPerTruckMile", "Full-truckload rate", 3.0, "$/truck-mile", "team", "CharLink v0.1: typical FTL range $2.50–3.50"),
  a("truckWeightCapT", "Truck weight cap", 20, "t", "team", "CharLink v0.1; 20–22 t payload"),
  a("trailerM3", "53 ft trailer volume", 100, "m³", "team", "per-client-volume doc: 53' van ~100 m³"),
  a("kgCo2PerTruckMile", "Truck CO₂", 1.57, "kg CO₂/truck-mile", "team", "CharLink v0.1: ~10.2 kg CO₂/gal diesel at ~6.5 mpg"),
  a("roadFactor", "Straight-line to road factor", 1.25, "×", "team", "CharLink v0.1; used only without live routing"),
  a("distanceZeroScoreMiles", "Distance at which the distance score is zero", 2000, "mi", "team", "CharLink v0.1"),
  a("defaultBulkDensity", "Typical biochar bulk density", 250, "kg/m³", "team", "per-client-volume doc: 80–320 kg/m³, ~250 typical (Meva datasheet)"),
  a("supersackM3", "Supersack volume", 1, "m³", "team", "phase-1 transport protocol: 1 m³ supersacks"),
  a("supersackUsd", "Supersack (bag + filling)", 18, "$/sack", "estimate", "No supplier quote yet"),
  a("bagKg", "Small bag size", 15, "kg", "team", "phase-1 protocol: 25–40 lb bags"),
  a("bagUsd", "Small bag (bag + filling)", 1.6, "$/bag", "estimate", "No supplier quote yet"),
  a("cartridgeKg", "Media per pre-filled cartridge", 12, "kg", "estimate", "Varies by product; inserts hold 6–40 lb (team research)"),
  a("cartridgeUsd", "Cartridge filling", 9, "$/cartridge", "estimate", "No quote yet"),
  a("screenUsdPerT", "Hub: screening", 25, "$/t input", "estimate", "No toll-finishing quote yet"),
  a("crushUsdPerT", "Hub: crushing", 20, "$/t input", "estimate", "No toll-finishing quote yet"),
  a("dryUsdPerT", "Hub: drying", 45, "$/t input", "estimate", "No quote; gas dryer, no waste heat"),
  a("millUsdPerT", "Hub: fine milling (<75 µm)", 90, "$/t input", "estimate", "No quote yet"),
  a("blendUsdPerT", "Hub: blending lots", 12, "$/t input", "estimate", "No quote yet"),
  a("hubHandlingUsdPerT", "Hub: receiving and handling", 10, "$/t", "estimate", "No quote yet"),
  a("crushYield", "Share of oversize recovered into band after crushing", 0.7, "fraction", "estimate", "Rest becomes fines"),
  a("minScreenYield", "Minimum in-band yield for a hub path to be feasible", 0.35, "fraction", "estimate", "Below this the lot is treated as too fine"),
  a("finesSalvageUsdPerT", "Value of off-spec fines sold to soil/ag", 150, "$/t", "estimate", "Below Midwest ag price of $300–500/t (team research)"),
  a("ltlPalletKg", "Biochar per LTL pallet (one supersack)", 250, "kg", "estimate", "1 m³ at 250 kg/m³"),
  a("parcelUsdPerKg", "Parcel shipping", 2.4, "$/kg", "estimate", "No carrier quote"),
  a("vanUsdPerMile", "Service van", 2.0, "$/mile", "estimate", "Leased van, local routes"),
  a("sampleShipUsd", "Sample shipping", 45, "$", "estimate", "5-gallon pail by parcel"),
  a("testPanelUsd", "Lab panel per lot (properties + metals)", 650, "$", "estimate", "No lab quote yet"),
  a("psdTestUsd", "Sieve analysis per lot", 120, "$", "estimate", "No lab quote yet"),
  a("tclpUsd", "TCLP 8 RCRA metals + totals per spent batch", 350, "$", "estimate", "No lab quote yet"),
  a("agentFeePct", "Agent commission", 8, "%", "team", "US-Enchar plan: 5–10%"),
  a("principalMarginPct", "Principal gross margin", 20, "%", "team", "US-Enchar plan: 15–25%"),
  a("depositPct", "Buyer deposit at PO", 30, "%", "estimate", "Common trade term; confirm with counsel"),
  a("co2ePerTChar", "CO₂e removed per tonne of char", 2.15, "t CO₂e/t", "team", "spent-media doc; replaced by the formula when C and H:C are known"),
  a("creditUsdPerT", "Credit price", 140, "$/t CO₂e", "team", "spent-media doc; ~$150 index (credit landscape doc)"),
  a("creditSharePct", "CharLink share of credit value for enabling the end use", 20, "%", "team", "spent-media doc"),
  a("landfillTipUsdPerT", "Spent-media landfill tip fee", 75, "$/t", "team", "spent-media doc: $57–93/t"),
  a("verifiedListingUsd", "Producer verified-listing fee (per lot, incl. lab panel)", 950, "$", "estimate", "Lab panel + PSD + handling"),
  a("serviceUsdPerSiteMonth", "Service contract", 1750, "$/site/month", "team", "phase-1 P&L: AMC $1,750/site/mo"),
];
export type AssumptionMap = Record<string, number>;
export const DEFAULTS: AssumptionMap = Object.fromEntries(ASSUMPTION_LIST.map((x) => [x.key, x.value]));
// LTL per-pallet rate by distance band. Estimate until real quotes exist.
export const LTL_BANDS = [{ maxMiles: 150, usd: 180 }, { maxMiles: 500, usd: 320 }, { maxMiles: 1000, usd: 480 }, { maxMiles: Infinity, usd: 650 }];
export const HUB = { id: "hub-chicago", name: "CharLink finishing hub (planned)", city: "Chicago, IL", lat: 41.75, lng: -87.8 };
export const SEASONALITY = "Landscape and stormwater work runs May–October in the Midwest. Stock and finish November–April; deliver May–October (phase-1 transport protocol).";
