// Core domain types for CharLink v1. Every researched record carries provenance fields.
export type Provenance = "published" | "interview" | "estimate" | "demo";
export type Confidence = "high" | "medium" | "low";
export type CoordPrecision = "site" | "city" | "state" | "none";
export type FeedClass = "wood" | "ag" | "manure" | "biosolids" | "bone" | "mixed" | "unknown";
export type SizeClass = "fine" | "medium" | "coarse";
export type OrgType = "producer" | "distributor" | "blender" | "product_maker" | "buyer" | "segment" | "lab" | "registry" | "standards" | "software" | "competitor" | "hauler" | "landfill" | "research" | "gatekeeper";
export type OrgStatus = "operating" | "planned" | "pilot" | "lead" | "unknown";

export interface Sourced { source_url: string; source_date: string; provenance: Provenance; confidence: Confidence; }

export interface Site { label?: string; city: string; state: string; lat: number | null; lng: number | null; coord_precision: CoordPrecision; }

export interface Product { name: string; psd?: string; sizes?: SizeClass[]; properties?: string; packaging?: string; min_order?: string; list_price?: string; }

export interface Org extends Sourced {
  id: string; name: string; type: OrgType; website?: string; sites: Site[];
  feedstock?: string; feedClass?: FeedClass; process?: string; capacity_t_yr?: number | null; delivered_t?: number | null;
  status: OrgStatus; certifications: string[]; products: Product[]; sells_credits?: boolean | null;
  channels?: string[]; applications?: string[]; decision_maker?: string; why_buy?: string; need_t_yr?: number | null;
  review_depth: "product_page" | "listing" | "project_research"; extra_sources?: string[]; notes?: string;
  // computed by scripts/build-data.ts
  data_gap_score?: number; gaps?: string[]; sizes?: SizeClass[]; coarse_offered?: boolean | null;
}

export type Verification = "self_reported" | "coa_uploaded" | "third_party" | "charlink_tested" | "field_proven";
export interface PropValue { value: number | string; unit?: string; method?: string; lab?: string; date?: string; verification: Verification; }
export interface PsdPoint { sieve_mm: number; pct_passing: number; }

export interface Lot {
  id: string; demo: true | false; org_id: string; site_index: number; name: string; grade_code?: string; feedstock: string; feedClass: FeedClass;
  process?: string; production_date: string; quantity_t: number; price_ask_per_t: number; price_provenance: Provenance;
  properties: Record<string, PropValue>; psd: PsdPoint[]; packaging: string[]; lead_time_days: number;
  status: "available" | "reserved" | "sold" | "quarantine"; verification: Verification; coa_date?: string;
  longevity?: { pollutant: string; bed_volumes: number; note: string } | null; certifications: string[];
  lineage?: string[]; notes?: string; custody?: { date: string; event: string; actor: string }[];
}

export type Packaging = "bulk_ftl" | "supersack" | "bag" | "cartridge";
export type QtyUnit = "t" | "m3" | "yd3" | "supersack";

export interface Rfq {
  id: string; demo?: boolean; created: string; buyer_name: string; buyer_org_id?: string; application: string; answers: Record<string, string | number | string[]>;
  qty: number; qty_unit: QtyUnit; tonnes: number; m3: number; dest: { label: string; lat: number; lng: number };
  need_by?: string; packaging: Packaging; sample_first: boolean; current_supplier_org_id?: string; budget_per_t?: number;
  status: "submitted" | "qualified" | "matched" | "sampling" | "quoted" | "ordered" | "delivered" | "closed";
  sample?: { lot_id: string; status: "requested" | "shipped" | "received"; date: string } | null;
}

export interface LineItem { key: string; label: string; usd: number; note?: string; }
export interface QuoteOption {
  id: string; label: string; kind: "direct" | "via_hub" | "blend"; lots: { lot_id: string; tonnes: number }[]; mode: "FTL" | "LTL" | "parcel" | "van";
  miles: number; trucks: number; cube_limited: boolean; t_per_truck: number; co2_kg: number; items: LineItem[]; total: number; per_t: number; per_m3: number;
  fee_usd: number; producer_payout: number; lead_days: number; live_routing: boolean; notes: string[];
}
export interface Quote {
  id: string; rfq_id: string; created: string; valid_until: string; model: "agent" | "principal"; fee_pct: number; credit_share: boolean;
  options: QuoteOption[]; selected?: string; status: "draft" | "sent" | "accepted" | "expired" | "declined"; overrides?: Record<string, number>;
}

export type OrderState = "po_issued" | "deposit_paid" | "producer_confirmed" | "finishing" | "ready_to_ship" | "in_transit" | "delivered" | "pod_confirmed" | "disputed" | "payment_released" | "docs_issued" | "closed";
export interface OrderEvent { state: OrderState; at: string; actor: "buyer" | "producer" | "ops" | "carrier" | "system"; note?: string; }
export interface Payment { id: string; kind: "deposit" | "balance" | "payout" | "refund"; usd: number; method: string; status: "pending" | "succeeded" | "refunded"; at: string; provider: string; }
export interface Shipment { mode: string; carrier: string; carrier_demo: true; pickup: string; eta: string; bol_no: string; events: { at: string; text: string }[]; compliance: Record<string, boolean>; takeback: boolean; }
export interface Order {
  id: string; rfq_id: string; quote_id: string; option: QuoteOption; created: string; state: OrderState; events: OrderEvent[]; payments: Payment[];
  shipment?: Shipment; deposit_pct: number; total: number; fee_usd: number; producer_payout: number; credit_t_co2e: number; finishing_needed: boolean; output_lot_id?: string; demo?: boolean;
}

export interface Message { id: string; thread: string; from: "buyer" | "producer" | "ops"; text: string; at: string; }
export interface Notification { id: string; role: "buyer" | "producer" | "ops"; text: string; href: string; at: string; read: boolean; }
export interface OutboxEmail { id: string; to: string; subject: string; body: string; at: string; event: string; provider: string; }

export interface ServiceUnit { id: string; type: "catch_basin_insert" | "filter_sock" | "cartridge"; media_kg: number; change_months: number; last_change: string; lot_id?: string; }
export interface ServiceSite { id: string; demo: true; name: string; address: string; lat: number; lng: number; units: ServiceUnit[]; contract_usd_month: number; }
export interface Visit { id: string; site_id: string; date: string; tech: string; units_swapped: number; spent_kg: number; notes: string; }
export interface SpentBatch { id: string; site_id: string; lot_tag: string; kg: number; picked_up: string; tclp?: { result: "pass" | "fail"; date: string; lab: string; metals: Record<string, number> } | null; decision?: "landscape_reuse" | "landfill" | "permanent_sink" | null; disposal?: { date: string; where: string; manifest: string } | null; }
export interface HubItem { lot_id: string; grade: string; supersacks: number; tonnes: number; received: string; }
export interface FinishingJob { id: string; inputs: { lot_id: string; tonnes: number }[]; ops: string[]; output_lot_id: string; status: "queued" | "running" | "done"; date: string; yield_pct: number; order_id?: string; }
export interface Offer { id: string; rfq_id: string; org_id: string; lot_id: string; price_per_t: number; tonnes: number; at: string; status: "sent" | "accepted" | "declined"; }
