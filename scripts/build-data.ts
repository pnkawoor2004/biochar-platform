// Builds versioned JSON from the raw research rows: validates, de-duplicates, scores data gaps,
// generates DEMO lots, and writes data/SOURCES.md. Run: npm run data
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { producers, SRC } from "../data/raw/producers";
import { buyers, partners, partnerGaps } from "../data/raw/demand";
import { RANGES } from "../config/property-ranges";
import type { Org, Lot, PsdPoint, PropValue, Verification, FeedClass, SizeClass } from "../lib/domain/types";

const orgSchema = z.object({
  id: z.string().min(2), name: z.string().min(2), type: z.string(), source_url: z.string().min(5), source_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provenance: z.enum(["published", "interview", "estimate", "demo"]), confidence: z.enum(["high", "medium", "low"]),
  sites: z.array(z.object({ city: z.string(), state: z.string(), lat: z.number().nullable(), lng: z.number().nullable(), coord_precision: z.string() })).min(1),
}).passthrough();

function check(list: Org[], label: string) {
  const seen = new Map<string, string>();
  for (const o of list) {
    orgSchema.parse(o);
    const key = o.name.toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + (o.sites[0].state || "");
    if (seen.has(key)) throw new Error(`${label}: duplicate ${o.name}`);
    if ([...seen.values()].includes(o.id)) throw new Error(`${label}: duplicate id ${o.id}`);
    seen.set(key, o.id);
  }
}

const GAP_FIELDS: [string, (o: Org) => boolean][] = [
  ["Particle size data", (o) => o.products.some((p) => !!p.psd && /mm|µm|sieve/i.test(p.psd))],
  ["Whether a coarse grade exists", (o) => o.products.some((p) => (p.sizes?.length ?? 0) > 0)],
  ["Lab values", (o) => o.products.some((p) => !!p.properties)],
  ["Certifications", (o) => o.certifications.length > 0],
  ["Packaging / minimum order", (o) => o.products.some((p) => !!p.packaging || !!p.min_order)],
  ["Price", (o) => o.products.some((p) => !!p.list_price)],
  ["Capacity or volume", (o) => !!o.capacity_t_yr || !!o.delivered_t],
  ["Feedstock", (o) => !!o.feedstock],
];
function scoreGaps(o: Org): Org {
  const gaps = GAP_FIELDS.filter(([, has]) => !has(o)).map(([n]) => n);
  const sizes = [...new Set(o.products.flatMap((p) => p.sizes ?? []))] as SizeClass[];
  return { ...o, gaps, data_gap_score: Math.round((gaps.length / GAP_FIELDS.length) * 100) / 100, sizes, coarse_offered: sizes.length ? sizes.includes("coarse") : null };
}

// ---------- DEMO lots ----------
function rng(seed: string) { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const SIEVES = [0.075, 0.425, 1, 2, 2.36, 4, 6.3, 9.5, 12.5];
const PSD: Record<string, number[]> = {
  coarse: [0.3, 1.5, 4, 8, 12, 45, 78, 96, 100],
  coarse_unrinsed: [2, 7, 14, 24, 29, 55, 80, 95, 100],
  medium: [1, 5, 15, 55, 66, 94, 100, 100, 100],
  bioretention: [3, 14, 48, 88, 93, 100, 100, 100, 100],
  unscreened: [6, 18, 35, 55, 60, 78, 90, 97, 100],
  fine: [35, 80, 96, 100, 100, 100, 100, 100, 100],
  powder: [97, 100, 100, 100, 100, 100, 100, 100, 100],
};
const psd = (k: string): PsdPoint[] => SIEVES.map((s, i) => ({ sieve_mm: s, pct_passing: PSD[k][i] }));
const LABS = ["Control Laboratories (DEMO report)", "Producer in-house (DEMO)"];

interface L { id: string; org: string; site?: number; name: string; grade?: string; psd: string; feed: FeedClass; feedstock: string; qty: number; price: number; ver: Verification; coa?: string; lead?: number;
  moisture?: number; fc?: number; pb?: number; sa?: number; longevity?: Lot["longevity"]; pack?: string[]; certs?: string[]; notes?: string; process?: string; }
const lotRows: L[] = [
  // Coarse filtration lots are rare on purpose: interviews say the market is too fine.
  { id: "LOT-MTZ-01", org: "metzler", name: "Stormwater media, coarse", grade: "CL-FC", psd: "coarse", feed: "wood", feedstock: "Forestry wood", qty: 18, price: 980, ver: "third_party", longevity: { pollutant: "Zinc", bed_volumes: 2400, note: "DEMO column result at pH 7; not a real test" }, pack: ["supersack", "bag"] },
  { id: "LOT-BLC-01", org: "biologicalcarbon", name: "Custom filter char, 2–10 mm", grade: "CL-FC", psd: "coarse", feed: "wood", feedstock: "Douglas fir", qty: 12, price: 1050, ver: "coa_uploaded", pack: ["supersack"] },
  { id: "LOT-GLN-01", org: "glanris", name: "Rice-hull granular media", grade: "CL-FM", psd: "medium", feed: "ag", feedstock: "Rice hulls", qty: 40, price: 640, ver: "third_party", pack: ["supersack", "bag"], longevity: { pollutant: "Copper", bed_volumes: 1500, note: "DEMO column result; not a real test" } },
  { id: "LOT-ABC-01", org: "amerbiochar", name: "Unscreened kiln char", psd: "unscreened", feed: "wood", feedstock: "Hardwood", qty: 26, price: 420, ver: "coa_uploaded", pack: ["bulk_ftl", "supersack"], notes: "Wide size range: screen at the hub for coarse or medium grades." },
  { id: "LOT-ABC-02", org: "amerbiochar", name: "Bioretention-size char", grade: "CL-BR", psd: "bioretention", feed: "wood", feedstock: "Hardwood", qty: 24, price: 465, ver: "third_party", sa: 410, pack: ["bulk_ftl", "supersack"], certs: ["IBI (DEMO)"] },
  { id: "LOT-TCH-01", org: "terrachar", name: "High-carbon lump char", psd: "coarse_unrinsed", feed: "wood", feedstock: "Oak and hickory", qty: 60, price: 520, ver: "coa_uploaded", fc: 90, pack: ["bulk_ftl", "supersack"], notes: "High fixed carbon. Unrinsed: fines must be screened out for filter use." },
  { id: "LOT-TCH-02", org: "terrachar", name: "Soil-grade char", grade: "CL-AG", psd: "fine", feed: "wood", feedstock: "Mixed hardwood", qty: 80, price: 360, ver: "self_reported", pack: ["bulk_ftl"] },
  { id: "LOT-GQ-01", org: "greenquest", name: "Screened char, 0.4–2.4 mm", grade: "CL-BR", psd: "bioretention", feed: "wood", feedstock: "Wood chips", qty: 20, price: 480, ver: "coa_uploaded", sa: 365, pack: ["supersack", "bulk_ftl"] },
  { id: "LOT-BWS-01", org: "blackwood", name: "Mobile carbonizer char, unscreened", psd: "unscreened", feed: "wood", feedstock: "Land-clearing wood", qty: 35, price: 310, ver: "self_reported", pack: ["bulk_ftl"], notes: "No COA. Sample and hub test required before sale." },
  { id: "LOT-ARTI-01", org: "arti", name: "Fine char", grade: "CL-AG", psd: "fine", feed: "wood", feedstock: "Wood chips", qty: 45, price: 380, ver: "coa_uploaded", coa: "2024-03-12", pack: ["bulk_ftl", "supersack"], notes: "COA is more than two years old." },
  { id: "LOT-LIF-01", org: "liferaft", name: "Ag-residue char", grade: "CL-AG", psd: "fine", feed: "ag", feedstock: "Corn stover", qty: 120, price: 300, ver: "coa_uploaded", pack: ["bulk_ftl"] },
  { id: "LOT-WKF-01", org: "wakefield", name: "Premium-type char, <2 mm", grade: "CL-HP", psd: "fine", feed: "wood", feedstock: "Pine", qty: 200, price: 410, ver: "third_party", pack: ["supersack", "bulk_ftl"], certs: ["OMRI (DEMO)"] },
  { id: "LOT-WKF-02", org: "wakefield", name: "Micronized carbon, <50 µm", grade: "CL-CF", psd: "powder", feed: "wood", feedstock: "Pine", qty: 30, price: 690, ver: "third_party", moisture: 3, pack: ["supersack"] },
  { id: "LOT-PAC-01", org: "pacific", site: 1, name: "Sawmill-residue char", grade: "CL-AG", psd: "fine", feed: "wood", feedstock: "Sawmill residues", qty: 300, price: 340, ver: "third_party", pack: ["bulk_ftl", "supersack"], certs: ["EBC (DEMO)"] },
  { id: "LOT-OBS-01", org: "obs", name: "Screened char, 1–4 mm", grade: "CL-FM", psd: "medium", feed: "wood", feedstock: "Forest residues", qty: 90, price: 560, ver: "third_party", pack: ["supersack", "bulk_ftl"], certs: ["Puro (DEMO)"] },
  { id: "LOT-OBS-02", org: "obs", name: "Coarse char, 2–10 mm", grade: "CL-FC", psd: "coarse", feed: "wood", feedstock: "Forest residues", qty: 40, price: 640, ver: "third_party", pack: ["supersack", "bulk_ftl"] },
  { id: "LOT-SUP-01", org: "supreme", name: "Stormwater-mix type char", grade: "CL-BR", psd: "bioretention", feed: "wood", feedstock: "Softwood", qty: 55, price: 590, ver: "coa_uploaded", pack: ["supersack", "bag"] },
  { id: "LOT-CSP-01", org: "coldsteppe", name: "Rice-hull char", grade: "CL-AG", psd: "fine", feed: "ag", feedstock: "Rice hulls", qty: 400, price: 290, ver: "coa_uploaded", pack: ["bulk_ftl"] },
  { id: "LOT-STD-01", org: "standard", name: "Spruce-fir char, fine", psd: "fine", feed: "wood", feedstock: "Spruce and fir", qty: 25, price: 520, ver: "third_party", pack: ["supersack"] },
  { id: "LOT-BCN-01", org: "biocharnow", name: "Chunk char, unscreened", psd: "coarse_unrinsed", feed: "wood", feedstock: "Beetle-kill pine", qty: 70, price: 450, ver: "coa_uploaded", pack: ["supersack", "bulk_ftl"] },
  { id: "LOT-SWV-01", org: "swva", name: "Compost-blend char", grade: "CL-AG", psd: "unscreened", feed: "wood", feedstock: "Virginia hardwood", qty: 30, price: 400, ver: "self_reported", pack: ["bulk_ftl"] },
  { id: "LOT-GSB-01", org: "greenstate", name: "Phosphorus-filter char", grade: "CL-FM", psd: "medium", feed: "wood", feedstock: "Vermont hardwood", qty: 8, price: 940, ver: "coa_uploaded", pack: ["supersack", "bag"] },
  // DEMO producer used for the producer-portal persona and for the failing lot
  { id: "LOT-PCW-01", org: "demo-prairie", name: "Oak char, unscreened", psd: "unscreened", feed: "wood", feedstock: "Urban oak and ash", qty: 50, price: 400, ver: "coa_uploaded", pack: ["bulk_ftl", "supersack"] },
  { id: "LOT-PCW-02", org: "demo-prairie", name: "Coarse screened char", grade: "CL-FC", psd: "coarse", feed: "wood", feedstock: "Urban oak and ash", qty: 6, price: 900, ver: "self_reported", pack: ["supersack"], notes: "Self-reported only: needs a COA before it can be sold as filtration grade." },
  { id: "LOT-PCW-03", org: "demo-prairie", name: "Char from reclaimed timber (FAILS metals)", psd: "unscreened", feed: "wood", feedstock: "Reclaimed painted timber", qty: 15, price: 250, ver: "third_party", pb: 410, pack: ["bulk_ftl"], notes: "Lead above the IBI maximum. Quarantined: shown to demonstrate the contaminant filter." },
  { id: "LOT-PCW-04", org: "demo-prairie", name: "Fine char, damp", psd: "fine", feed: "wood", feedstock: "Urban oak and ash", qty: 40, price: 330, ver: "coa_uploaded", moisture: 28, pack: ["bulk_ftl", "supersack"], notes: "High moisture: must be dried for concrete or asphalt." },
];

function makeLot(r: L): Lot {
  const rand = rng(r.id); const R = (RANGES as any)[r.feed] ?? RANGES.wood; const pick = (k: string, d = 1) => { const [a, b] = R[k]; return Math.round((a + rand() * (b - a)) * d) / d; };
  const date = r.coa ?? `2026-${String(6 + Math.floor(rand() * 5)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 27)).padStart(2, "0")}`;
  const lab = r.ver === "self_reported" ? undefined : r.ver === "coa_uploaded" ? LABS[1] : LABS[0];
  const v = (value: number | string, unit?: string): PropValue => ({ value, unit, lab, date: r.ver === "self_reported" ? undefined : date, verification: r.ver });
  const c = pick("c_org", 10); const ash = pick("ash", 10);
  const props: Record<string, PropValue> = {
    bulk_density: v(pick("bulk_density"), "kg/m³"), moisture: v(r.moisture ?? Math.round(8 + rand() * 10), "% wt"), ash: v(ash, "% dry"), c_org: v(c, "% dry"),
    fixed_carbon: v(r.fc ?? Math.round(c - 4 - rand() * 4), "% dry"), h_corg: v(pick("h_corg", 100), "molar"), ph: v(pick("ph", 10), ""),
  };
  if (r.ver !== "self_reported") {
    Object.assign(props, { ec: v(pick("ec", 10), "dS/m"), cec: v(pick("cec"), "cmol/kg"), surface_area: v(r.sa ?? pick("surface_area"), "m²/g"), whc: v(pick("whc"), "% wt") });
    const metals: Record<string, [number, number]> = { As: [1, 8], Cd: [0.1, 1.2], Cr: [5, 60], Cu: [8, 90], Pb: [2, 40], Hg: [0.01, 0.3], Ni: [3, 35], Zn: [20, 260] };
    for (const [m, [a, b]] of Object.entries(metals)) props[`metal_${m}`] = v(m === "Pb" && r.pb ? r.pb : Math.round((a + rand() * (b - a)) * 100) / 100, "mg/kg");
  }
  if (r.ver === "third_party" || r.ver === "charlink_tested") Object.assign(props, { pah16: v(Math.round((1 + rand() * 4) * 10) / 10, "mg/kg"), self_heating: v("Negative (not self-heating)", ""), ksat: v(Math.round(60 + rand() * 500), "cm/h") });
  return {
    id: r.id, demo: true, org_id: r.org, site_index: r.site ?? 0, name: r.name, grade_code: r.grade, feedstock: r.feedstock, feedClass: r.feed, process: r.process ?? `Slow pyrolysis, ~${550 + Math.floor(rand() * 4) * 50} °C (DEMO)`,
    production_date: date, quantity_t: r.qty, price_ask_per_t: r.price, price_provenance: "demo", properties: props, psd: psd(r.psd), packaging: r.pack ?? ["bulk_ftl"], lead_time_days: r.lead ?? 5 + Math.floor(rand() * 12),
    status: r.pb ? "quarantine" : "available", verification: r.ver, coa_date: r.ver === "self_reported" ? undefined : date, longevity: r.longevity ?? null, certifications: r.certs ?? [], notes: r.notes,
    custody: [{ date, event: "Produced and sampled", actor: "Producer" }, ...(r.ver !== "self_reported" ? [{ date, event: "COA issued", actor: lab! }] : [])],
  };
}

// DEMO organizations (fictional). Used for personas so no real company is shown acting on the platform.
const demoSrc = { source_url: "demo:seed", source_date: "2026-11-16", provenance: "demo" as const, confidence: "high" as const, review_depth: "listing" as const, certifications: [], products: [] };
const demoOrgs: Org[] = [
  { ...demoSrc, id: "demo-prairie", name: "Prairie Carbon Works (DEMO producer)", type: "producer", status: "operating", feedstock: "Urban wood waste", feedClass: "wood", capacity_t_yr: 900, sites: [{ city: "Rockford", state: "IL", lat: 42.27, lng: -89.09, coord_precision: "city" }], sells_credits: true, notes: "Fictional producer for the producer-portal demo." },
  { ...demoSrc, id: "demo-pools", name: "Clearwater Natural Pools (DEMO buyer)", type: "buyer", status: "operating", applications: ["natural_pools"], sites: [{ city: "Madison", state: "WI", lat: 43.07, lng: -89.40, coord_precision: "city" }] },
  { ...demoSrc, id: "demo-blender", name: "Fox Valley Engineered Soils (DEMO buyer)", type: "blender", status: "operating", applications: ["bioretention"], sites: [{ city: "Aurora", state: "IL", lat: 41.76, lng: -88.32, coord_precision: "city" }] },
  { ...demoSrc, id: "demo-galv", name: "Lakeshore Galvanizing (DEMO buyer)", type: "buyer", status: "operating", applications: ["industrial_stormwater"], sites: [{ city: "Cicero", state: "IL", lat: 41.845, lng: -87.76, coord_precision: "city" }] },
  { ...demoSrc, id: "demo-readymix", name: "Prairie State Ready-Mix (DEMO buyer)", type: "buyer", status: "operating", applications: ["concrete"], sites: [{ city: "Joliet", state: "IL", lat: 41.53, lng: -88.08, coord_precision: "city" }] },
  { ...demoSrc, id: "demo-filter", name: "Great Lakes Filter Media (DEMO buyer)", type: "product_maker", status: "operating", applications: ["stormwater_filtration"], sites: [{ city: "Milwaukee", state: "WI", lat: 43.04, lng: -87.91, coord_precision: "city" }] },
];

check(producers, "producers"); check(buyers, "buyers"); check(partners, "partners");
const prod = producers.map(scoreGaps);
const lots = lotRows.map(makeLot);
for (const l of lots) if (![...prod, ...demoOrgs].some((o) => o.id === l.org_id)) throw new Error(`lot ${l.id}: unknown org ${l.org_id}`);

const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {} as Record<string, number>);
const real = prod.filter((o) => o.type !== "research");
const stats = {
  generated: "2026-11-17", producers: prod.length, buyers: buyers.length, partners: partners.length, demo_lots: lots.length, demo_orgs: demoOrgs.length,
  by_state: count(prod, (o) => o.sites[0].state || "n/s"), by_feed: count(prod, (o) => o.feedClass ?? "unknown"), by_status: count(prod, (o) => o.status),
  by_depth: count(prod, (o) => o.review_depth), by_confidence: count(prod, (o) => o.confidence), by_precision: count(prod, (o) => o.sites[0].coord_precision),
  buyers_by_provenance: count(buyers, (o) => o.provenance), buyers_by_type: count(buyers, (o) => o.type), partners_by_type: count(partners, (o) => o.type),
  publishes_psd: real.filter((o) => !o.gaps!.includes("Particle size data")).length, publishes_lab: real.filter((o) => !o.gaps!.includes("Lab values")).length,
  publishes_price: real.filter((o) => !o.gaps!.includes("Price")).length, coarse_known: real.filter((o) => o.coarse_offered === true).length,
  has_certs: real.filter((o) => o.certifications.length > 0).length, avg_gap: Math.round((real.reduce((s, o) => s + o.data_gap_score!, 0) / real.length) * 100) / 100,
};

writeFileSync("data/dataset.json", JSON.stringify({ stats, sources: SRC, producers: prod, buyers, partners, partnerGaps, demoOrgs }, null, 1));
writeFileSync("data/demo-lots.json", JSON.stringify(lots, null, 1));

const tbl = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join("\n");
writeFileSync("data/SOURCES.md", `# CharLink dataset: sources and coverage

Generated ${stats.generated} by \`scripts/build-data.ts\` from \`data/raw/\`. Built independently; no data from the teammate's U.S. Biochar Atlas.

## Method
- Start: the 26 producers in CharLink v0.1 (team research, Oct–Nov 2026: CDR.fyi, company and press pages).
- Nov 16, 2026 web research: US Biochar Initiative supplier list and directory (by state and sector), American Biochar Institute directory, company bulk/product pages, state and university publications, trade news.
- Access limit: this session could open only pages returned by web search, not arbitrary company sites. So most new producers are **listing-level** records (name, location, what they sell). Only a few have product-page depth. The app shows which is which.
- Nothing is invented. A missing field means "not found published" and counts toward the producer's data-gap score.
- Locations: city-level unless marked. "state" precision means only the state is known (sometimes inferred from a phone area code, noted on the record); those pins are approximate.
- DEMO lots (${stats.demo_lots}) and DEMO organizations (${stats.demo_orgs}) are fictional and badged in the app. Property values come from literature ranges in \`config/property-ranges.ts\`.

## Counts
- Supply organizations: **${stats.producers}** (target was 100+)
- Demand organizations and segments: **${stats.buyers}** (target 40–60)
- Labs, registries, standards bodies, software, competitors: **${stats.partners}** (target 15–30). Logistics partners near Chicago are **not** sourced yet: see the gap list in \`data/raw/demand.ts\`.

### Supply by review depth
| Depth | Count |\n|---|---|\n${tbl(stats.by_depth)}

### Supply by state (first site)
| State | Count |\n|---|---|\n${tbl(stats.by_state)}

### Supply by feedstock class
| Feedstock | Count |\n|---|---|\n${tbl(stats.by_feed)}

### Supply by status
| Status | Count |\n|---|---|\n${tbl(stats.by_status)}

### Supply by confidence
| Confidence | Count |\n|---|---|\n${tbl(stats.by_confidence)}

### Demand by provenance
| Provenance | Count |\n|---|---|\n${tbl(stats.buyers_by_provenance)}

## What producers publish (the gap CharLink closes)
Of ${real.length} producers and suppliers:
- Particle size data found: **${stats.publishes_psd}**
- Any lab values found: **${stats.publishes_lab}**
- A public bulk price found: **${stats.publishes_price}**
- A coarse (>2 mm) product known: **${stats.coarse_known}**
- Any certification found: **${stats.has_certs}**
- Average data-gap score: **${stats.avg_gap}** (share of 8 key fields not found)

Caveat: for listing-level records the product pages were not read, so "not found" partly reflects our access limit, not only what the producer publishes. The verification calls will settle it.

## Main sources
${Object.entries(SRC).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
- Product pages read: wakefieldbiochar.com (bulk), environmental-expert.com (Black Owl stormwater mix), shop.urbanwormcompany.com (truckload price), biochar.org (Terra Char entry)
- Guidance used for grades: USBI stormwater talk (Gray, 2023), Chesapeake Bay Program draft memo, Nebraska Forest Service stormwater fact sheet, UIUC filter study
`);
console.log(JSON.stringify(stats, null, 1));
