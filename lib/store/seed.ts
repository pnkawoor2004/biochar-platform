// Deterministic demo seed: six scenarios at different stages, built with the same actions the UI uses. All fictional and badged DEMO.
import type { State } from "./index";
import type { Rfq, Org, QuoteOption, ServiceSite, ServiceUnit } from "@/lib/domain/types";
import { createRfq, runMatch, createQuote, acceptQuote, orderAction, sendMessage, requestSample, advanceSample } from "./actions";
import { DEFAULTS } from "@/config/assumptions";

const T = (d: string, h = 9) => `2026-${d}T${String(h).padStart(2, "0")}:00:00.000Z`;
type In = Omit<Rfq, "id" | "created" | "status" | "tonnes" | "m3"> & { tonnes: number };
const mk = (r: In): Omit<Rfq, "id" | "created" | "status"> => ({ ...r, demo: true, m3: (r.tonnes * 1000) / DEFAULTS.defaultBulkDensity });
const HUB_ORG: Org = { id: "charlink-hub", name: "CharLink Chicago hub (planned)", type: "producer", sites: [{ city: "Chicago", state: "IL", lat: 41.75, lng: -87.8, coord_precision: "city" }], status: "planned", certifications: [], products: [], source_url: "demo:seed", source_date: "2026-11-16", provenance: "demo", confidence: "high", review_depth: "listing", notes: "Finishing hub: sieve, crush, dry, blend, bag. Planned; DEMO in this build." };

export function buildSeed(s: State): State {
  s = { ...s, extraOrgs: [HUB_ORG] };
  const quote = (rfqId: string, at: string, pick: (opts: { single: QuoteOption[]; blend: QuoteOption | null }) => QuoteOption[], creditShare = false) => {
    const rfq = s.rfqs.find((r) => r.id === rfqId)!; const res = runMatch(s, rfq, undefined, { creditShare });
    const single = res.matches.filter((m) => m.feasible && m.option).map((m) => ({ ...m.option!, label: `${m.option!.label}: ${m.lot.id}` }));
    let qid: string; [s, qid] = createQuote(s, rfqId, pick({ single, blend: res.blend?.option ?? null }), "principal", creditShare, at); return qid;
  };
  const run = (oid: string, steps: [string, string][]) => { for (const [a, at] of steps) s = orderAction(s, oid, a, at); };
  let r: string, q: string, o: string;

  // 5. Closed order (history for the dashboards): coarse filter media to a product maker
  [s, r] = createRfq(s, mk({ buyer_name: "Great Lakes Filter Media (DEMO buyer)", buyer_org_id: "demo-filter", application: "stormwater_filtration", answers: { grade: "CL-FC", pollutants: ["Zinc", "Copper"], system: "Filter sock", longevity_months: 12 }, qty: 6, qty_unit: "t", tonnes: 6, dest: { label: "Milwaukee, WI", lat: 43.04, lng: -87.91 }, packaging: "supersack", sample_first: true }), T("09-08"));
  q = quote(r, T("09-10"), ({ single }) => [single.find((x) => x.lots[0].lot_id === "LOT-MTZ-01")!, single.find((x) => x.kind === "via_hub")!]);
  [s, o] = acceptQuote(s, q, s.quotes.find((x) => x.id === q)!.options[0].id, T("09-12"));
  run(o, [["pay_deposit", T("09-13")], ["producer_confirm", T("09-14")], ["ready", T("09-16")], ["ship", T("09-17")], ["deliver", T("09-19")], ["confirm_pod", T("09-20")], ["release", T("09-21")], ["issue_docs", T("09-22")], ["close", T("09-23")]]);

  // In transit: horticulture truckload
  [s, r] = createRfq(s, mk({ buyer_name: "Fox Valley Engineered Soils (DEMO buyer)", buyer_org_id: "demo-blender", application: "horticulture", answers: { blend_pct: 10, organic: "Yes" }, qty: 20, qty_unit: "t", tonnes: 20, dest: { label: "Aurora, IL", lat: 41.76, lng: -88.32 }, packaging: "bulk_ftl", sample_first: false }), T("10-28"));
  q = quote(r, T("10-29"), ({ single }) => [single.find((x) => x.lots[0].lot_id === "LOT-PCW-01") ?? single[0], single.find((x) => x.lots[0].lot_id === "LOT-WKF-01") ?? single[1]], true);
  [s, o] = acceptQuote(s, q, s.quotes.find((x) => x.id === q)!.options[0].id, T("10-30"));
  run(o, [["pay_deposit", T("10-31")], ["producer_confirm", T("11-03")], ...(s.orders.find((x) => x.id === o)!.finishing_needed ? [["start_finishing", T("11-05")] as [string, string]] : []), ["ready", T("11-12")], ["ship", T("11-14")]]);

  // 4. Concrete pilot: fine grade with a moisture limit; now finishing at the hub (mill + dry)
  [s, r] = createRfq(s, mk({ buyer_name: "Prairie State Ready-Mix (DEMO buyer)", buyer_org_id: "demo-readymix", application: "concrete", answers: { fineness: "<75 µm", replacement_pct: 4, moisture_max: 5, batches: 5 }, qty: 5, qty_unit: "t", tonnes: 5, dest: { label: "Joliet, IL", lat: 41.53, lng: -88.08 }, packaging: "supersack", sample_first: true }), T("11-03"));
  q = quote(r, T("11-04"), ({ single }) => [single.find((x) => x.lots[0].lot_id === "LOT-ABC-02")!, single.find((x) => x.lots[0].lot_id === "LOT-WKF-02")!]);
  [s, o] = acceptQuote(s, q, s.quotes.find((x) => x.id === q)!.options[0].id, T("11-06"));
  run(o, [["pay_deposit", T("11-07")], ["producer_confirm", T("11-10")], ["start_finishing", T("11-13")]]);
  s = sendMessage(s, o, "buyer", "Can you send the moisture reading for each supersack with the batch certificates?", T("11-13", 14));
  s = sendMessage(s, o, "ops", "Yes. Each supersack gets its own label and a line on the batch certificate: moisture, fineness and bulk density.", T("11-13", 15));

  // 3. Industrial stormwater service media: delivered, waiting for the buyer to confirm
  [s, r] = createRfq(s, mk({ buyer_name: "Lakeshore Galvanizing (DEMO buyer)", buyer_org_id: "demo-galv", application: "industrial_stormwater", answers: { grade: "CL-FM", pollutants: ["Zinc", "Copper"], units: 12, cartridges: 2, changes_per_year: 2, takeback: "Yes" }, qty: 0.3, qty_unit: "t", tonnes: 0.3, dest: { label: "Cicero, IL", lat: 41.845, lng: -87.76 }, packaging: "cartridge", sample_first: false }), T("11-04"));
  q = quote(r, T("11-05"), ({ single }) => single.slice(0, 1), true);
  [s, o] = acceptQuote(s, q, s.quotes.find((x) => x.id === q)!.options[0].id, T("11-06"));
  run(o, [["pay_deposit", T("11-06", 15)], ["producer_confirm", T("11-07")], ...(s.orders.find((x) => x.id === o)!.finishing_needed ? [["start_finishing", T("11-10")] as [string, string]] : []), ["ready", T("11-12")], ["ship", T("11-13")], ["deliver", T("11-14")]]);

  // 2. Bioretention blend for a Chicago-area blender: quoted, with a blend option
  [s, r] = createRfq(s, mk({ buyer_name: "Fox Valley Engineered Soils (DEMO buyer)", buyer_org_id: "demo-blender", application: "bioretention", answers: { blend_pct: 10, spec: "USBI stormwater guidance", max_miles: 150 }, qty: 55, qty_unit: "t", tonnes: 55, dest: { label: "Aurora, IL", lat: 41.76, lng: -88.32 }, need_by: "2027-04-15", packaging: "bulk_ftl", sample_first: false }), T("11-12"));
  q = quote(r, T("11-13"), ({ single, blend }) => [...(blend ? [blend] : []), ...single.slice(0, 1)]);

  // 1. Coarse char for a natural-pool filter: quoted, sample received; the buyer accepts live in the demo
  [s, r] = createRfq(s, mk({ buyer_name: "Clearwater Natural Pools (DEMO buyer)", buyer_org_id: "demo-pools", application: "natural_pools", answers: { system: "Filter sock", rinse: "Yes" }, qty: 4, qty_unit: "t", tonnes: 4, dest: { label: "Madison, WI", lat: 43.07, lng: -89.4 }, need_by: "2027-03-01", packaging: "supersack", sample_first: true }), T("11-10"));
  s = requestSample(s, r, "LOT-MTZ-01", T("11-10", 11)); s = advanceSample(s, r, T("11-11")); s = advanceSample(s, r, T("11-13"));
  q = quote(r, T("11-14"), ({ single }) => [single.find((x) => x.lots[0].lot_id === "LOT-MTZ-01")!, single.find((x) => x.lots[0].lot_id === "LOT-TCH-01")!]);
  s = sendMessage(s, r, "buyer", "The sample looks right: chunky and clean. Does the hub option come rinsed?", T("11-14", 13));
  s = sendMessage(s, r, "ops", "Yes. Hub-finished lots are screened at 2 mm and rinsed, then re-tested before they ship.", T("11-14", 14));

  // 6. Same char, closer source: new request from a buyer who currently ships from Oregon
  [s, r] = createRfq(s, mk({ buyer_name: "Great Lakes Filter Media (DEMO buyer)", buyer_org_id: "demo-filter", application: "stormwater_filtration", answers: { grade: "CL-FM", pollutants: ["Copper", "Zinc"], system: "Cartridge / vault", longevity_months: 12 }, qty: 18, qty_unit: "t", tonnes: 18, dest: { label: "Milwaukee, WI", lat: 43.04, lng: -87.91 }, packaging: "supersack", sample_first: true, current_supplier_org_id: "obs" }), T("11-15"));

  // Service module: asset registry, visits and spent media (scenario 3)
  const units = (n: number, type: ServiceUnit["type"], kg: number, months: number, last: string, lot: string, p: string): ServiceUnit[] => Array.from({ length: n }, (_, i) => ({ id: `${p}-${type === "cartridge" ? "C" : "I"}${i + 1}`, type, media_kg: kg, change_months: months, last_change: last, lot_id: lot }));
  const site = (id: string, name: string, address: string, lat: number, lng: number, u: ServiceUnit[]): ServiceSite => ({ id, demo: true, name, address, lat, lng, units: u, contract_usd_month: DEFAULTS.serviceUsdPerSiteMonth });
  const sites: ServiceSite[] = [
    site("SITE-1", "Lakeshore Galvanizing (DEMO)", "Cicero, IL", 41.845, -87.76, [...units(12, "catch_basin_insert", 6, 6, "2026-05-14", "LOT-GLN-01", "LG"), ...units(2, "cartridge", 40, 12, "2026-05-14", "LOT-GLN-01", "LG")]),
    site("SITE-2", "Calumet Foundry (DEMO)", "Chicago, IL (South Deering)", 41.70, -87.56, units(8, "catch_basin_insert", 6, 6, "2026-06-02", "LOT-MTZ-01", "CF")),
    site("SITE-3", "Stockyards Metal Recycling (DEMO)", "Chicago, IL (Back of the Yards)", 41.81, -87.66, [...units(10, "catch_basin_insert", 9, 4, "2026-08-20", "LOT-MTZ-01", "SM"), ...units(1, "cartridge", 40, 12, "2026-03-11", "LOT-GLN-01", "SM")]),
    site("SITE-4", "Franklin Park Plating (DEMO)", "Franklin Park, IL", 41.93, -87.87, units(6, "filter_sock", 12, 6, "2026-06-18", "LOT-MTZ-01", "FP")),
    site("SITE-5", "Elk Grove Fabricators (DEMO)", "Elk Grove Village, IL", 42.0, -87.97, units(5, "catch_basin_insert", 6, 6, "2026-07-09", "LOT-GLN-01", "EG")),
    site("SITE-6", "Bedford Park Steel Service (DEMO)", "Bedford Park, IL", 41.76, -87.79, units(7, "catch_basin_insert", 6, 6, "2026-05-28", "LOT-MTZ-01", "BP")),
  ];
  s = { ...s, sites,
    visits: [
      { id: "V-1", site_id: "SITE-1", date: "2026-05-14", tech: "Tech A (DEMO)", units_swapped: 14, spent_kg: 0, notes: "Initial install: 12 inserts, 2 cartridges." },
      { id: "V-2", site_id: "SITE-3", date: "2026-08-20", tech: "Tech A (DEMO)", units_swapped: 10, spent_kg: 84, notes: "Swap; oily sheen on 2 inserts." },
      { id: "V-3", site_id: "SITE-2", date: "2026-06-02", tech: "Tech B (DEMO)", units_swapped: 8, spent_kg: 0, notes: "Initial install." },
    ],
    spent: [
      { id: "SP-1", site_id: "SITE-3", lot_tag: "LOT-MTZ-01 / SM", kg: 84, picked_up: "2026-08-20", tclp: { result: "pass", date: "2026-09-02", lab: "Environmental lab (DEMO result)", metals: { As: 0.02, Ba: 0.4, Cd: 0.01, Cr: 0.05, Pb: 0.3, Hg: 0.001, Se: 0.01, Ag: 0.01 } }, decision: "landfill", disposal: { date: "2026-09-30", where: "Subtitle D landfill (DEMO)", manifest: "IL-SW-DEMO-0001" } },
      { id: "SP-2", site_id: "SITE-1", lot_tag: "LOT-GLN-01 / LG", kg: 72, picked_up: "2026-11-14", tclp: null, decision: null, disposal: null },
    ],
    hub: [...s.hub, { lot_id: "LOT-ABC-01", grade: "raw", supersacks: 16, tonnes: 4, received: T("10-20") }, { lot_id: "LOT-MTZ-01", grade: "CL-FC", supersacks: 8, tonnes: 2, received: T("10-22") }],
  };
  return { ...s, notifications: s.notifications.map((n, i) => ({ ...n, read: i > 7 })) };
}
