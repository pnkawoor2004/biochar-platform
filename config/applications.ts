// Application profiles drive the RFQ wizard, the hard filters and the scoring weights.
import type { FeedClass, Packaging } from "@/lib/domain/types";

export interface Question { key: string; label: string; type: "select" | "multi" | "number"; options?: string[]; unit?: string; help?: string; }
export interface Weights { landed: number; size: number; verification: number; longevity: number; consistency: number; capacity: number; lead: number; credit: number; feed: number; }
export interface AppProfile {
  id: string; label: string; short: string; evidence: "proven" | "emerging" | "speculative"; fit: "beachhead" | "follow-on" | "weak" | "exploratory";
  who_buys: string; decision_maker: string; grades: string[]; feed: FeedClass[]; strict_verification: boolean; needs_dry: boolean;
  weights: Weights; questions: Question[]; typical_order: string; packaging: Packaging[]; price_range: string; price_basis: "sourced" | "team" | "estimate";
  credit: string; safety: string[]; evidence_docs: string[]; why_charlink: string; what_matters: string[]; risks: string[]; dose?: string;
}
const W = (landed: number, size: number, verification: number, longevity: number, consistency: number, capacity: number, lead: number, credit: number, feed: number): Weights => ({ landed, size, verification, longevity, consistency, capacity, lead, credit, feed });
const SELF_HEAT = "Biochar can self-heat in bulk. Ship with a UN N.4 test result and an SDS; keep dry and away from ignition sources.";
const DUST = "Fine char is a combustible dust (NFPA 652/654 apply at the hub). Use dust control when handling.";

export const APPLICATIONS: AppProfile[] = [
  { id: "stormwater_filtration", label: "Stormwater filtration media", short: "Inserts, socks, cartridges", evidence: "emerging", fit: "beachhead",
    who_buys: "Stormwater product makers and filter-media companies; they sell to installers who bid to site owners", decision_maker: "Product engineer; civil site engineers specify; MS4 approval matters",
    grades: ["CL-FC", "CL-FM"], feed: ["wood", "ag"], strict_verification: false, needs_dry: false, weights: W(22, 22, 14, 16, 8, 6, 4, 4, 4),
    questions: [
      { key: "pollutants", label: "Target pollutants", type: "multi", options: ["Copper", "Zinc", "Phosphorus", "TSS", "Oils"] },
      { key: "system", label: "System type", type: "select", options: ["Catch-basin insert", "Filter sock", "Cartridge / vault", "Downspout filter"] },
      { key: "grade", label: "Particle size needed", type: "select", options: ["CL-FC", "CL-FM"], help: "Coarse (2–12.5 mm) stays in socks and bags; medium (1–4 mm) suits packed cartridges." },
      { key: "units", label: "Number of units", type: "number" },
      { key: "media_per_unit_kg", label: "Media per unit", type: "number", unit: "kg" },
      { key: "changes_per_year", label: "Media changes per year", type: "number" },
      { key: "longevity_months", label: "Media must last at least", type: "number", unit: "months", help: "Agencies inspect yearly, so 12 months is the usual floor." },
    ],
    typical_order: "Product makers: 5–40 t per order. Per site: 0.05–1.5 t/yr.", packaging: ["supersack", "bag", "cartridge", "bulk_ftl"], price_range: "$800–2,500 per ton for filtration-grade bulk (Nebraska Forest Service fact sheet)", price_basis: "sourced",
    credit: "CAR lists stormwater management as an eligible end use. Puro and Isometric do not name filter use: verify per registry.", safety: [SELF_HEAT, "Rinse or sieve to remove fines before high-flow use; raw fines clog media and can leach (USBI guidance)."],
    evidence_docs: ["interview-synthesis-nov5", "per-client-volume-shipping-inventory-oct28", "bulk-biochar-buyers-oct28"],
    why_charlink: "Coarse, consistent char is hard to find, and nobody publishes longevity data. CharLink finds or finishes the grade and attaches lot data.",
    what_matters: ["Particle size band and low fines", "Longevity: at least a year in service", "Lot-to-lot consistency", "Metals and pH of the char itself"], risks: ["Wood char is weaker on copper per gram than engineered media; field data is mixed", "Tiny volume per site; sell bulk to product makers"] },
  { id: "bioretention", label: "Bioretention and engineered soil blends", short: "Blenders, rain gardens, bioswales", evidence: "emerging", fit: "beachhead",
    who_buys: "Engineered-soil blenders and landscape suppliers", decision_maker: "Blender's technical lead; the landscape architect or civil engineer writes the spec",
    grades: ["CL-BR"], feed: ["wood"], strict_verification: false, needs_dry: false, weights: W(34, 16, 12, 4, 12, 10, 6, 3, 3),
    questions: [
      { key: "blend_pct", label: "Biochar share of the blend", type: "number", unit: "% by volume", help: "Organics are usually capped near 15% of media (interview)." },
      { key: "spec", label: "Specification to meet", type: "select", options: ["USBI stormwater guidance", "Project-specific spec", "Chesapeake draft memo", "None yet"] },
      { key: "max_miles", label: "Preferred sourcing radius", type: "number", unit: "miles", help: "Blenders want about 100 miles; freight is a serious cost." },
    ],
    typical_order: "1–5 truckloads per project; one-time per site 0.5–2 t", packaging: ["bulk_ftl", "supersack"], price_range: "~$50–300 per cubic yard (USBI stormwater talk, 2023)", price_basis: "sourced",
    credit: "Soil-type end use: eligible under most registries (verify).", safety: [SELF_HEAT, "Overly alkaline biochar is not recommended in bioretention (USBI)."],
    evidence_docs: ["interview-greg-raymond", "interview-synthesis-nov5"],
    why_charlink: "The blender is the buyer of certificates and has no storage. CharLink delivers a consistent grade with a COA, by the truckload, from the nearest qualified source.",
    what_matters: ["Landed cost per cubic yard", "Consistent particle size within the spec band", "COA per lot", "Just-in-time delivery"], risks: ["Specs are still being written", "MWRD promotes biosolids as a competing amendment in Chicago"] },
  { id: "natural_pools", label: "Natural pools and water features", short: "Premium filtration niche", evidence: "emerging", fit: "beachhead",
    who_buys: "Natural-pool builders", decision_maker: "Owner / designer", grades: ["CL-FC"], feed: ["wood"], strict_verification: false, needs_dry: false, weights: W(14, 28, 14, 14, 10, 4, 8, 2, 6),
    questions: [
      { key: "system", label: "Filter format", type: "select", options: ["Filter sock", "Gravel-bed zone", "Canister"] },
      { key: "rinse", label: "Pre-rinsed media required", type: "select", options: ["Yes", "No"] },
    ],
    typical_order: "0.5–5 t per season", packaging: ["supersack", "bag"], price_range: "Premium; ~$1,000+/t (v0.1 working figure)", price_basis: "estimate",
    credit: "Filter use is not named by most registries; spent char reused in beds may qualify as soil use (verify).", safety: [SELF_HEAT, "Rinse before use: fines cloud the water."],
    evidence_docs: ["interview-synthesis-nov5"], why_charlink: "Bionova liked samples but they were too fine for socks. CharLink screens to a chunky grade and sends a sample first.",
    what_matters: ["Chunky particles that stay in the sock", "Clean, rinsed, low ash", "Small lots with fast delivery"], risks: ["Small market", "No published performance standard"] },
  { id: "industrial_stormwater", label: "Industrial stormwater Cu/Zn service", short: "Media swaps and take-back", evidence: "emerging", fit: "beachhead",
    who_buys: "Metal-handling permittees: foundries, galvanizers, fabricators, scrap recyclers", decision_maker: "EHS manager; the SWPPP consultant specifies",
    grades: ["CL-FC", "CL-FM"], feed: ["wood", "ag"], strict_verification: true, needs_dry: false, weights: W(12, 20, 18, 22, 10, 4, 6, 4, 4),
    questions: [
      { key: "pollutants", label: "Benchmarks exceeded", type: "multi", options: ["Copper", "Zinc", "Aluminum", "TSS"] },
      { key: "units", label: "Catch-basin inserts", type: "number" },
      { key: "cartridges", label: "Cartridges / vault units", type: "number" },
      { key: "changes_per_year", label: "Swaps per year", type: "number" },
      { key: "takeback", label: "Take back spent media", type: "select", options: ["Yes", "No"] },
    ],
    typical_order: "0.05–1.5 t of media per site per year, inside a ~$1,750/month service contract", packaging: ["cartridge", "bag"], price_range: "Service ~$18–24k per site per year; media is a small part", price_basis: "team",
    credit: "CAR: stormwater management and landfill disposal are eligible; credits are claimed once.", safety: [SELF_HEAT, "Spent media carries metals. Test (TCLP 8 RCRA metals + totals) before reuse or disposal; Illinois special-waste rules likely apply."],
    evidence_docs: ["finish-depot-placement-amc-model-nov2", "phase1-integrator-capex-logistics-beachhead-pnl-nov2", "spent-media-burial-credit-share-nov2"],
    why_charlink: "Sites buy compliance, not char. CharLink schedules swaps, tracks every lot into and out of each unit, and documents disposal.",
    what_matters: ["Proof the media holds for the permit period", "Scheduled swaps and records", "Disposal paperwork"], risks: ["Incumbent swap networks (Contech, Xylem)", "Illinois tightening may wait until 2028", "Needs column and field pilots"] },
  { id: "horticulture", label: "Horticulture and peat replacement", short: "Potting mixes, growers", evidence: "proven", fit: "follow-on",
    who_buys: "Potting-mix makers, greenhouse growers, tree-care companies", decision_maker: "Grower or product formulator", grades: ["CL-HP"], feed: ["wood", "ag"], strict_verification: false, needs_dry: false, weights: W(42, 10, 10, 0, 12, 12, 6, 4, 4),
    questions: [{ key: "blend_pct", label: "Share of mix", type: "number", unit: "% by volume" }, { key: "organic", label: "OMRI listing needed", type: "select", options: ["Yes", "No"] }],
    typical_order: "Truckloads, repeat", packaging: ["bulk_ftl", "supersack"], price_range: "$300–400/t ceiling for peat replacement (interview); premium horticulture $600–1,200/t (team research)", price_basis: "team",
    credit: "Soil end use: eligible under most registries.", safety: [SELF_HEAT, "Check pH and salts for seedlings."], evidence_docs: ["interview-greg-raymond", "bulk-biochar-buyers-oct28"],
    why_charlink: "Volume outlet for medium grades and for fines left over from filtration finishing.", what_matters: ["Delivered price", "Steady supply", "pH and salts"], risks: ["Low price: bought-in char loses money without credits"] },
  { id: "concrete", label: "Concrete", short: "Fine filler, 3–5%", evidence: "emerging", fit: "follow-on",
    who_buys: "Ready-mix producers and admixture makers", decision_maker: "QC manager / mix designer", grades: ["CL-CF"], feed: ["wood", "ag", "biosolids"], strict_verification: true, needs_dry: true, weights: W(20, 14, 18, 0, 26, 10, 4, 6, 2),
    questions: [
      { key: "fineness", label: "Grind fineness", type: "select", options: ["<75 µm", "<150 µm"] },
      { key: "replacement_pct", label: "Cement replacement", type: "number", unit: "%" },
      { key: "moisture_max", label: "Maximum moisture", type: "number", unit: "% wt" },
      { key: "batches", label: "Batches in the pilot", type: "number" },
    ],
    typical_order: "Pilot: 1–10 t in supersacks; then repeat batches", packaging: ["supersack", "bulk_ftl"], price_range: "$300–700/t (team research); works with credits", price_basis: "team",
    credit: "Durable end use under Puro: product sale and credits stack.", safety: [SELF_HEAT, DUST], evidence_docs: ["biochar-concrete-steel-markets", "interview-synthesis-nov5"], dose: "Typically 3–5% as filler or partial cement replacement, ground below 75 µm",
    why_charlink: "Dose differs per batch, so buyers need a certificate per batch and one consistent feedstock. CharLink mills, dries and certifies each batch.",
    what_matters: ["Batch-to-batch consistency", "Fineness and moisture", "Cost", "No effect on strength at the chosen dose"], risks: ["Slow qualification; non-structural uses first", "Water absorption changes the mix"] },
  { id: "asphalt", label: "Asphalt binder modification", short: "Follow-on, via binder suppliers", evidence: "emerging", fit: "follow-on",
    who_buys: "Binder suppliers and modifier companies (not IDOT)", decision_maker: "Supplier's technical manager; IDOT qualified lists gate the market", grades: ["CL-AS"], feed: ["wood", "ag"], strict_verification: true, needs_dry: true, weights: W(20, 14, 20, 0, 24, 10, 4, 6, 2),
    questions: [{ key: "moisture_max", label: "Maximum moisture", type: "number", unit: "% wt", help: "Moisture foams in binder stored above 100 °C." }, { key: "dose_pct", label: "Dose in binder", type: "number", unit: "%" }],
    typical_order: "Lab and trial quantities first", packaging: ["supersack"], price_range: "Not established; v0.1 working floor $300/t", price_basis: "estimate",
    credit: "Asphalt is treated as a durable use by some programs (Verde/Ergon example); verify.", safety: ["Moisture is safety-critical: wet additives cause foaming and boil-over in hot binder. Dry and seal every lot.", DUST], evidence_docs: ["interview-idot-materials-engineer-nov12", "bulk-biochar-buyers-oct28"],
    why_charlink: "The supplier carries the burden of proof. CharLink supplies dried, tested lots and the test file a qualification needs.", what_matters: ["Moisture", "Consistency across lots", "Test data for qualification"], risks: ["Slow, research-led spec changes", "Verde's supply is locked to one producer"] },
  { id: "soil_ag", label: "Soil and agriculture", short: "Bulk field application", evidence: "proven", fit: "follow-on",
    who_buys: "Farms, co-ops, compost makers", decision_maker: "Grower / agronomist", grades: ["CL-AG"], feed: ["wood", "ag", "manure"], strict_verification: false, needs_dry: false, weights: W(50, 0, 8, 0, 6, 16, 6, 10, 4),
    questions: [{ key: "acres", label: "Acres", type: "number" }, { key: "rate_t_acre", label: "Application rate", type: "number", unit: "t/acre" }, { key: "nrcs", label: "Using NRCS Code 336 cost share", type: "select", options: ["Yes", "No", "Not sure"] }],
    typical_order: "Truckloads", packaging: ["bulk_ftl", "supersack"], price_range: "$300–500/t Midwest commodity (team research)", price_basis: "team",
    credit: "The most established credit pathway.", safety: [SELF_HEAT], evidence_docs: ["bulk-biochar-buyers-oct28"], why_charlink: "Outlet for off-spec char and fines; nearest-source matching cuts freight.", what_matters: ["Delivered price", "Volume"], risks: ["Thin margin"] },
  { id: "green_roof", label: "Green roof media", short: "Weak fit", evidence: "speculative", fit: "weak",
    who_buys: "Green-roof installers through their blender", decision_maker: "Blender", grades: ["CL-BR"], feed: ["wood"], strict_verification: false, needs_dry: false, weights: W(34, 16, 12, 4, 12, 10, 6, 3, 3),
    questions: [{ key: "blend_pct", label: "Share of media", type: "number", unit: "% by volume" }],
    typical_order: "Per project", packaging: ["supersack", "bulk_ftl"], price_range: "Not established", price_basis: "estimate", credit: "Soil-type use (verify).", safety: [SELF_HEAT],
    evidence_docs: ["interview-greg-raymond"], why_charlink: "Listed for completeness. Our interview says it is a weak fit.", what_matters: ["Weight (most important)", "Porosity", "Particle size within range"], risks: ["Fines blow off the roof; chunky char makes little sense (Greg Raymond)", "No recurring demand"] },
  { id: "metallurgical", label: "Metallurgical / steel", short: "High fixed carbon; not CDR", evidence: "emerging", fit: "exploratory",
    who_buys: "EAF steelmakers", decision_maker: "Raw materials procurement", grades: ["CL-MT"], feed: ["wood"], strict_verification: true, needs_dry: true, weights: W(30, 6, 18, 0, 20, 22, 2, 0, 2),
    questions: [{ key: "fc_min", label: "Minimum fixed carbon", type: "number", unit: "%" }, { key: "form", label: "Form", type: "select", options: ["Lump", "Briquette", "Powder (PCI)"] }],
    typical_order: "Thousands of tonnes per year", packaging: ["bulk_ftl"], price_range: "Not researched", price_basis: "estimate", credit: "None. The carbon is burned: an emissions reduction, not a removal.", safety: [SELF_HEAT, DUST],
    evidence_docs: ["biochar-concrete-steel-markets"], why_charlink: "Listed so buyers are routed correctly; volumes are far above what the platform handles today.", what_matters: ["Fixed carbon >80%", "Low ash, alkali, P, S, Cl", "Large consistent supply"], risks: ["Too large and too tightly specified for early CharLink", "Aymium/SDI self-supply"] },
  { id: "produced_water", label: "Industrial wastewater and produced water", short: "Exploratory", evidence: "speculative", fit: "exploratory",
    who_buys: "Not established", decision_maker: "Not established", grades: ["CL-FM"], feed: ["wood", "ag", "bone"], strict_verification: true, needs_dry: false, weights: W(14, 20, 20, 24, 10, 4, 4, 0, 4),
    questions: [{ key: "contaminant", label: "Target contaminant", type: "select", options: ["Metals", "Organics", "Other"] }],
    typical_order: "Not established", packaging: ["supersack"], price_range: "Not established", price_basis: "estimate", credit: "Unlikely to be eligible; spent media may be hazardous.", safety: [SELF_HEAT, "Spent media from industrial water is likely a regulated waste."],
    evidence_docs: [], why_charlink: "No evidence gathered yet. Included only to route enquiries; no sources were found tonight to support a market claim.", what_matters: ["Pilot data for the specific water"], risks: ["No research done; activated carbon is the incumbent"] },
];
export const appById = (id: string) => APPLICATIONS.find((a) => a.id === id)!;
