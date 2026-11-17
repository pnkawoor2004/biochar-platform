// CharLink Grade standard, DRAFT v0.1. Each threshold says where it comes from.
// status "sourced": taken from a published spec or guidance. "draft": CharLink's working number, to confirm with Tim (Mississippi State),
// the Bio Pod team or a lab partner before anyone relies on it.
export interface Limit { prop: string; sieve_mm?: number; op: "<=" | ">="; value: number; unit: string; status: "sourced" | "team" | "draft"; source: string; }
export interface Grade { code: string; name: string; use: string; band_mm: [number, number]; limits: Limit[]; min_verification: "self_reported" | "coa_uploaded" | "third_party" | "charlink_tested"; cdr: boolean; notes: string; }

const USBI_SW = "USBI stormwater guidance (Myles Gray, Minnesota Biochar Initiative talk, Sep 2023): percent passing #8 90–100, #40 0–20";
const CHES = "Chesapeake Bay Program draft biochar-enhanced bioretention memo: wood-based, pH <11, surface area ≥325 m²/g, nothing >6 mm";
const UIUC = "UIUC (Reddy et al.) stormwater filter study used biochar with D10 2.1 mm and D50 ~3 mm";
const IBI = "IBI Biochar Standards v2.1 (maximum of allowed range; recalled, verify against the standard)";
const TEAM_CONC = "Team research (UNIDO, Puro): concrete filler ground <75 µm, 3–5% replacement";
const IDOT = "IDOT materials engineer interview (Nov 2026): moisture in additives foams in binder stored above 100 °C";
const TBD = "CharLink draft. TBD: confirm with Tim / lab partner";

export const METALS_MAX: Limit[] = [
  ["As", 100], ["Cd", 39], ["Cr", 1200], ["Cu", 6000], ["Pb", 300], ["Hg", 17], ["Ni", 420], ["Zn", 7400],
].map(([m, v]) => ({ prop: `metal_${m}`, op: "<=" as const, value: v as number, unit: "mg/kg", status: "sourced" as const, source: IBI }));
const HC: Limit = { prop: "h_corg", op: "<=", value: 0.7, unit: "molar", status: "sourced", source: "IBI and EBC: H:Corg ≤ 0.7" };

export const GRADES: Grade[] = [
  { code: "CL-FC", name: "Filtration Coarse", use: "Filter socks, catch-basin inserts, cartridges, natural pools", band_mm: [2, 12.5], min_verification: "third_party", cdr: true,
    limits: [
      { prop: "psd", sieve_mm: 2, op: "<=", value: 10, unit: "% passing", status: "draft", source: `${TBD}. Basis: interviews (market char too fine for socks) and ${UIUC}` },
      { prop: "psd", sieve_mm: 12.5, op: ">=", value: 95, unit: "% passing", status: "draft", source: TBD },
      { prop: "psd", sieve_mm: 0.425, op: "<=", value: 3, unit: "% passing", status: "draft", source: `${TBD}. Fines clog media and wash out (USBI guidance: rinse or sieve for high-flow use)` },
      { prop: "ph", op: "<=", value: 11, unit: "pH", status: "sourced", source: CHES }, HC, ...METALS_MAX,
    ], notes: "The grade interviews say is missing from the market. Longevity (column breakthrough) data is optional but decides the sale." },
  { code: "CL-FM", name: "Filtration Medium", use: "Media filters and vaults, polishing layers", band_mm: [1, 4], min_verification: "third_party", cdr: true,
    limits: [
      { prop: "psd", sieve_mm: 4, op: ">=", value: 90, unit: "% passing", status: "draft", source: `${TBD}. Chesapeake draft lists a 1–4 mm fraction` },
      { prop: "psd", sieve_mm: 1, op: "<=", value: 20, unit: "% passing", status: "draft", source: TBD },
      { prop: "ph", op: "<=", value: 11, unit: "pH", status: "sourced", source: CHES }, HC, ...METALS_MAX,
    ], notes: "Between coarse sock media and bioretention amendment." },
  { code: "CL-BR", name: "Bioretention Amendment", use: "Bioretention and engineered soil blends", band_mm: [0.425, 2.36], min_verification: "coa_uploaded", cdr: true,
    limits: [
      { prop: "psd", sieve_mm: 2.36, op: ">=", value: 90, unit: "% passing", status: "sourced", source: USBI_SW },
      { prop: "psd", sieve_mm: 0.425, op: "<=", value: 20, unit: "% passing", status: "sourced", source: USBI_SW },
      { prop: "ph", op: "<=", value: 11, unit: "pH", status: "sourced", source: CHES },
      { prop: "surface_area", op: ">=", value: 325, unit: "m²/g", status: "sourced", source: CHES }, HC, ...METALS_MAX,
    ], notes: "Follows published stormwater guidance. Overly coarse particles remove little; fines migrate and clog (USBI)." },
  { code: "CL-HP", name: "Horticulture / Peat Replacement", use: "Potting mixes, greenhouse media", band_mm: [0.425, 6.3], min_verification: "coa_uploaded", cdr: true,
    limits: [
      { prop: "psd", sieve_mm: 6.3, op: ">=", value: 95, unit: "% passing", status: "draft", source: TBD },
      { prop: "ec", op: "<=", value: 4, unit: "dS/m", status: "draft", source: `${TBD}. Salt-sensitive seedlings` }, HC, ...METALS_MAX,
    ], notes: "Price-sensitive: about $300–400/t (interview estimate)." },
  { code: "CL-CF", name: "Concrete Fine", use: "Filler / partial cement replacement, 3–5%", band_mm: [0, 0.075], min_verification: "third_party", cdr: true,
    limits: [
      { prop: "psd", sieve_mm: 0.075, op: ">=", value: 95, unit: "% passing", status: "sourced", source: TEAM_CONC },
      { prop: "moisture", op: "<=", value: 5, unit: "% wt", status: "draft", source: `${TBD}. Water demand matters in mix design` }, HC, ...METALS_MAX,
    ], notes: "Batch-to-batch consistency is the selling point (concrete interview). Non-structural uses first." },
  { code: "CL-AS", name: "Asphalt Modifier", use: "Binder modification", band_mm: [0, 0.425], min_verification: "third_party", cdr: true,
    limits: [
      { prop: "psd", sieve_mm: 0.425, op: ">=", value: 95, unit: "% passing", status: "draft", source: TBD },
      { prop: "moisture", op: "<=", value: 1, unit: "% wt", status: "draft", source: `${TBD}. Safety-critical: ${IDOT}` }, HC, ...METALS_MAX,
    ], notes: "Follow-on market. Route to market is the IDOT qualified list, through a binder supplier." },
  { code: "CL-AG", name: "Soil / Ag Bulk", use: "Field application, compost blending", band_mm: [0, 12.5], min_verification: "self_reported", cdr: true,
    limits: [HC, ...METALS_MAX], notes: "No size limit. Most established credit pathway." },
  { code: "CL-MT", name: "Metallurgical", use: "EAF carbon raiser, PCI substitute", band_mm: [0, 25], min_verification: "third_party", cdr: false,
    limits: [
      { prop: "fixed_carbon", op: ">=", value: 80, unit: "% dry", status: "team", source: "Team research (UNIDO): fixed carbon typically >80%" },
      { prop: "ash", op: "<=", value: 5, unit: "% dry", status: "draft", source: `${TBD}. Low ash, low alkali, P, S, Cl` },
    ], notes: "The carbon is burned, so this is not carbon removal and earns no removal credits." },
];
export const gradeByCode = (c: string) => GRADES.find((g) => g.code === c)!;

export const PROPERTY_FIELDS: { key: string; label: string; unit: string; method: string }[] = [
  { key: "bulk_density", label: "Bulk density", unit: "kg/m³", method: "ASTM D2854-type tap/pour (state which)" },
  { key: "moisture", label: "Moisture", unit: "% wt", method: "ASTM D1762-84 (105 °C)" },
  { key: "ash", label: "Ash", unit: "% dry", method: "ASTM D1762-84" },
  { key: "c_org", label: "Organic carbon", unit: "% dry", method: "Dry combustion (total C minus inorganic C), per IBI test methods" },
  { key: "fixed_carbon", label: "Fixed carbon", unit: "% dry", method: "ASTM D1762-84 (proximate)" },
  { key: "h_corg", label: "H:Corg", unit: "molar", method: "Dry combustion; IBI/EBC permanence indicator" },
  { key: "ph", label: "pH", unit: "", method: "1:20 dilution, per IBI test methods" },
  { key: "ec", label: "Electrical conductivity", unit: "dS/m", method: "1:20 dilution, per IBI test methods" },
  { key: "cec", label: "Cation exchange capacity", unit: "cmol/kg", method: "Ammonium acetate (state method)" },
  { key: "surface_area", label: "Surface area (BET)", unit: "m²/g", method: "ASTM D6556 (N₂ BET)" },
  { key: "whc", label: "Water holding capacity", unit: "% wt", method: "State method" },
  { key: "ksat", label: "Hydraulic conductivity", unit: "cm/h", method: "ASTM D2434 (constant head); verify for media" },
  { key: "pah16", label: "PAHs (EPA 16)", unit: "mg/kg", method: "Toluene extraction, GC-MS (EBC method)" },
  { key: "self_heating", label: "Self-heating (UN N.4)", unit: "", method: "UN Manual of Tests and Criteria, Test N.4" },
  ...["As", "Cd", "Cr", "Cu", "Pb", "Hg", "Ni", "Zn"].map((m) => ({ key: `metal_${m}`, label: `${m} (total)`, unit: "mg/kg", method: "Acid digestion, ICP (EPA 3050B/6010 or per ANSI S668)" })),
];
export const METHOD_NOTE = "Method names are the commonly cited ones for biochar. ANSI S668 (Methods for the Analysis and Testing of Biochar) is the US reference per stormwater guidance; confirm each method with the lab partner.";
export const VERIFICATION_LADDER = [
  { key: "self_reported", label: "Self-reported", desc: "Producer typed the values. No document." },
  { key: "coa_uploaded", label: "COA uploaded", desc: "Producer uploaded a lab report for this lot." },
  { key: "third_party", label: "Third-party lab verified", desc: "An independent lab tested a sample CharLink or the buyer pulled." },
  { key: "charlink_tested", label: "CharLink tested", desc: "CharLink re-tested at the hub (sieve, moisture, density) and matched the COA." },
  { key: "field_proven", label: "Field-proven", desc: "A buyer has run this grade in service and reported results (for example, a season in a filter)." },
] as const;
export const verRank = (v: string) => VERIFICATION_LADDER.findIndex((x) => x.key === v);
