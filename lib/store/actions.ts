// State transitions for the demo store. Each takes the state and returns a new one, so the seed and the UI share the same code paths.
import type { State, Role } from "./index";
import type { Rfq, Quote, Order, Lot, QuoteOption, Payment, Shipment, PsdPoint, PropValue, Org } from "@/lib/domain/types";
import { appById } from "@/config/applications";
import { evaluate, proposeBlend, closerSource, pickGrade, type Match, type Blend } from "@/lib/match";
import { estimateDistances } from "@/lib/logistics/distances";
import type { Distances } from "@/lib/logistics/quote";
import { apply, money, STATE_LABEL } from "@/lib/orders/machine";
import { co2ePerTonne } from "@/lib/credits";
import { blendPsd, screenedPsd, sizePath } from "@/lib/match/psd";
import { allOrgs } from "@/lib/data";
import { emailProvider, paymentsProvider } from "@/lib/providers";

const orgs = (s: State): Org[] => [...allOrgs, ...s.extraOrgs];
const id = (s: State, p: string): [State, string] => [{ ...s, seq: s.seq + 1 }, `${p}-${s.seq + 1}`];
export const lotById = (s: State, lotId: string) => s.lots.find((l) => l.id === lotId);

export function notify(s: State, role: Role, text: string, href: string, at: string): State {
  return { ...s, notifications: [{ id: `N-${s.notifications.length + 1}`, role, text, href, at, read: false }, ...s.notifications] };
}
export function email(s: State, to: string, subject: string, body: string, event: string, at: string): State {
  const e = emailProvider().send({ to, subject, body, event, at });
  return { ...s, outbox: [{ id: `E-${s.outbox.length + 1}`, ...e }, ...s.outbox] };
}
const tell = (s: State, role: Role, subject: string, body: string, href: string, event: string, at: string) =>
  email(notify(s, role, subject, href, at), role === "buyer" ? "buyer@demo.charlink.example" : role === "producer" ? "producer@demo.charlink.example" : "ops@demo.charlink.example", subject, body, event, at);

export function createRfq(s0: State, input: Omit<Rfq, "id" | "created" | "status">, at: string): [State, string] {
  let [s, rid] = id(s0, "RFQ");
  s = { ...s, rfqs: [{ ...input, id: rid, created: at, status: "submitted" }, ...s.rfqs] };
  s = tell(s, "ops", `New request ${rid}: ${appById(input.application).label}, ${input.tonnes.toFixed(1)} t to ${input.dest.label}`, `${input.buyer_name} asked for ${input.tonnes.toFixed(1)} t.`, `/rfq?id=${rid}`, "rfq_received", at);
  s = email(s, "buyer@demo.charlink.example", `We received your request ${rid}`, "We are matching your request to verified lots. You will see ranked matches right away and a landed-cost quote next.", "rfq_received", at);
  return [s, rid];
}
export interface MatchResult { matches: Match[]; blend: Blend | null; swap: ReturnType<typeof closerSource>; dist: Distances; grade: ReturnType<typeof pickGrade> }
export function runMatch(s: State, rfq: Rfq, dist?: Distances, opts?: { model?: "agent" | "principal"; creditShare?: boolean }): MatchResult {
  const app = appById(rfq.application); const lots = s.lots.filter((l) => !l.lineage);
  const d = dist ?? estimateDistances(lots, orgs(s), rfq.dest, s.A);
  const ctx = { rfq, app, lots, orgs: orgs(s), dist: d, A: s.A, model: opts?.model, creditShare: opts?.creditShare };
  const matches = evaluate(ctx);
  return { matches, blend: proposeBlend(matches, ctx), swap: closerSource(matches, rfq.current_supplier_org_id), dist: d, grade: pickGrade(rfq, app) };
}
export function setRfqStatus(s: State, rfqId: string, status: Rfq["status"]): State { return { ...s, rfqs: s.rfqs.map((r) => (r.id === rfqId ? { ...r, status } : r)) }; }

export function requestSample(s: State, rfqId: string, lotId: string, at: string): State {
  s = { ...s, rfqs: s.rfqs.map((r) => (r.id === rfqId ? { ...r, status: r.status === "submitted" || r.status === "matched" ? "sampling" : r.status, sample: { lot_id: lotId, status: "requested", date: at } } : r)) };
  s = tell(s, "ops", `Sample requested for ${rfqId} from lot ${lotId}`, "Ship a 5-gallon sample to the buyer.", `/rfq?id=${rfqId}`, "sample_requested", at);
  return s;
}
export function advanceSample(s: State, rfqId: string, at: string): State {
  const r = s.rfqs.find((x) => x.id === rfqId); if (!r?.sample) return s;
  const next = r.sample.status === "requested" ? "shipped" : "received";
  s = { ...s, rfqs: s.rfqs.map((x) => (x.id === rfqId ? { ...x, sample: { ...x.sample!, status: next, date: at } } : x)) };
  return next === "shipped" ? tell(s, "buyer", `Sample shipped for ${rfqId}`, `A sample of lot ${r.sample.lot_id} is on its way.`, `/rfq?id=${rfqId}`, "sample_shipped", at) : s;
}

export function createQuote(s0: State, rfqId: string, options: QuoteOption[], model: Quote["model"], creditShare: boolean, at: string, status: Quote["status"] = "sent"): [State, string] {
  let [s, qid] = id(s0, "Q");
  const valid = new Date(new Date(at).getTime() + 14 * 864e5).toISOString();
  const q: Quote = { id: qid, rfq_id: rfqId, created: at, valid_until: valid, model, fee_pct: model === "agent" ? s.A.agentFeePct : s.A.principalMarginPct, credit_share: creditShare, options, status };
  s = setRfqStatus({ ...s, quotes: [q, ...s.quotes] }, rfqId, "quoted");
  if (status === "sent") s = tell(s, "buyer", `Quote ${qid} is ready for ${rfqId}`, `${options.length} option${options.length > 1 ? "s" : ""}, from $${Math.min(...options.map((o) => o.per_t))}/t delivered. Valid 14 days.`, `/quote?id=${qid}`, "quote_sent", at);
  return [s, qid];
}

export function acceptQuote(s0: State, quoteId: string, optionId: string, at: string): [State, string] {
  const q = s0.quotes.find((x) => x.id === quoteId)!; const opt = q.options.find((o) => o.id === optionId)!;
  let [s, oid] = id(s0, "ORD");
  const credit = opt.lots.reduce((sum, l) => sum + l.tonnes * co2ePerTonne(lotById(s, l.lot_id) ?? null, s.A).value, 0);
  const order: Order = { id: oid, rfq_id: q.rfq_id, quote_id: q.id, option: opt, created: at, state: "po_issued", events: [{ state: "po_issued", at, actor: "buyer", note: "Quote accepted; purchase order issued" }], payments: [],
    deposit_pct: s.A.depositPct, total: opt.total, fee_usd: opt.fee_usd, producer_payout: opt.producer_payout, credit_t_co2e: Math.round(credit * 10) / 10, finishing_needed: opt.kind !== "direct" };
  s = { ...s, orders: [order, ...s.orders], quotes: s.quotes.map((x) => (x.id === quoteId ? { ...x, status: "accepted", selected: optionId } : x)),
    lots: s.lots.map((l) => { const used = opt.lots.find((u) => u.lot_id === l.id); return used ? { ...l, quantity_t: Math.max(0, Math.round((l.quantity_t - used.tonnes) * 10) / 10), status: l.quantity_t - used.tonnes <= 0.05 ? "sold" as const : l.status } : l; }) };
  s = setRfqStatus(s, q.rfq_id, "ordered");
  s = tell(s, "ops", `Quote ${q.id} accepted: order ${oid} created`, `Total $${opt.total.toLocaleString()}. Deposit due.`, `/order?id=${oid}`, "quote_accepted", at);
  s = tell(s, "producer", `New order ${oid} for your lot ${opt.lots.map((l) => l.lot_id).join(", ")}`, "Please confirm the lot and a pickup window once the deposit clears.", `/order?id=${oid}`, "quote_accepted", at);
  return [s, oid];
}

const avgProp = (lots: { lot: Lot; t: number }[], key: string): PropValue | null => {
  const xs = lots.filter((x) => typeof x.lot.properties[key]?.value === "number"); if (!xs.length) return null;
  const t = xs.reduce((a, x) => a + x.t, 0);
  return { value: Math.round((xs.reduce((a, x) => a + (x.lot.properties[key].value as number) * x.t, 0) / t) * 100) / 100, unit: xs[0].lot.properties[key].unit, verification: "charlink_tested", lab: "Mass-weighted from input COAs (DEMO)", date: undefined };
};
function makeOutputLot(s: State, order: Order, at: string): Lot {
  const rfq = s.rfqs.find((r) => r.id === order.rfq_id)!; const grade = pickGrade(rfq, appById(rfq.application));
  const ins = order.option.lots.map((u) => ({ lot: lotById(s, u.lot_id)!, t: u.tonnes }));
  const parts = ins.map(({ lot, t }) => { const p = sizePath(lot, grade, s.A); const y = p.path === "via_hub" ? p.yield : 1; return { psd: p.path === "via_hub" && p.ops[0] !== "mill" ? screenedPsd(lot.psd, grade.band_mm) : lot.psd, tonnes: t * y, milled: p.ops[0] === "mill" }; });
  let psd: PsdPoint[] = blendPsd(parts); if (parts.some((p) => p.milled)) psd = psd.map((p) => ({ sieve_mm: p.sieve_mm, pct_passing: p.sieve_mm >= grade.band_mm[1] ? Math.max(97, p.pct_passing) : p.pct_passing }));
  const props: Record<string, PropValue> = {};
  for (const k of new Set(ins.flatMap((x) => Object.keys(x.lot.properties)))) { const v = avgProp(ins, k); if (v) props[k] = v; }
  const moist = grade.limits.find((l) => l.prop === "moisture"); if (moist && typeof props.moisture?.value === "number" && props.moisture.value > moist.value) props.moisture = { value: Math.max(0.5, moist.value - 0.5), unit: "% wt", verification: "charlink_tested", lab: "Hub moisture balance after drying (DEMO)", date: at.slice(0, 10) };
  const out = Math.round(parts.reduce((a, p) => a + p.tonnes, 0) * 10) / 10;
  return { id: `LOT-HUB-${order.id.replace("ORD-", "")}`, demo: true, org_id: "charlink-hub", site_index: 0, name: `${grade.name}, finished for ${order.id}`, grade_code: grade.code, feedstock: [...new Set(ins.map((x) => x.lot.feedstock))].join(" + "), feedClass: ins[0].lot.feedClass,
    process: `Finished at the Chicago hub (DEMO)`, production_date: at.slice(0, 10), quantity_t: out, price_ask_per_t: Math.round(order.total / out), price_provenance: "demo", properties: props, psd, packaging: [rfq.packaging], lead_time_days: 0, status: "sold",
    verification: "charlink_tested", coa_date: at.slice(0, 10), longevity: null, certifications: [], lineage: ins.map((x) => x.lot.id), notes: `Made from ${ins.map((x) => `${x.t} t of ${x.lot.id}`).join(" and ")}.`,
    custody: [...ins.map((x) => ({ date: at.slice(0, 10), event: `Received ${x.t} t of ${x.lot.id} at hub`, actor: "CharLink hub" })), { date: at.slice(0, 10), event: `Finished and re-tested (sieve, moisture, density)`, actor: "CharLink hub" }] };
}
const addCustody = (s: State, lotIds: string[], event: string, actor: string, at: string): State => ({ ...s, lots: s.lots.map((l) => (lotIds.includes(l.id) ? { ...l, custody: [...(l.custody ?? []), { date: at.slice(0, 10), event, actor }] } : l)) });

export function orderAction(s: State, orderId: string, action: string, at: string, note?: string): State {
  const o0 = s.orders.find((o) => o.id === orderId)!; let o = apply(o0, action, at, note); const m = money(o); const href = `/order?id=${orderId}`;
  const pay = (kind: Payment["kind"], usd: number, method: string): Payment => paymentsProvider().charge({ id: `PAY-${orderId}-${kind}`, kind, usd, method, at });
  const shipLots = o.output_lot_id ? [o.output_lot_id] : o.option.lots.map((l) => l.lot_id);
  switch (action) {
    case "pay_deposit": o = { ...o, payments: [...o.payments, pay("deposit", m.deposit, "ACH (test)")] };
      s = tell(s, "producer", `Deposit received for ${orderId}`, "Please confirm the lot and pickup window.", href, "payment_received", at); s = tell(s, "ops", `Deposit of $${m.deposit.toLocaleString()} received for ${orderId}`, "Held in escrow until delivery is confirmed.", href, "payment_received", at); break;
    case "producer_confirm": s = tell(s, "buyer", `Producer confirmed order ${orderId}`, o.finishing_needed ? "The lot ships to the Chicago hub for finishing." : "The lot ships direct to you.", href, "producer_confirmed", at); break;
    case "start_finishing": {
      const rfq = s.rfqs.find((r) => r.id === o.rfq_id)!; const grade = pickGrade(rfq, appById(rfq.application));
      const ops = [...new Set(o.option.lots.flatMap((u) => { const l = lotById(s, u.lot_id)!; const p = sizePath(l, grade, s.A); const moist = grade.limits.find((x) => x.prop === "moisture"); return [...p.ops, ...(moist && typeof l.properties.moisture?.value === "number" && (l.properties.moisture.value as number) > moist.value ? ["dry"] : []), ...(o.option.lots.length > 1 ? ["blend"] : [])]; }))];
      const out = `LOT-HUB-${orderId.replace("ORD-", "")}`;
      s = { ...s, jobs: [{ id: `JOB-${orderId.replace("ORD-", "")}`, inputs: o.option.lots.map((u) => ({ lot_id: u.lot_id, tonnes: u.tonnes })), ops, output_lot_id: out, status: "running", date: at, yield_pct: 0, order_id: orderId }, ...s.jobs],
        hub: [...o.option.lots.map((u) => ({ lot_id: u.lot_id, grade: lotById(s, u.lot_id)?.grade_code ?? "raw", supersacks: Math.ceil(u.tonnes * 4), tonnes: u.tonnes, received: at })), ...s.hub] };
      s = addCustody(s, o.option.lots.map((u) => u.lot_id), `Shipped to CharLink hub for ${orderId}`, "Carrier (DEMO)", at); break; }
    case "ready": {
      if (o.finishing_needed) { const lot = makeOutputLot(s, o, at); o = { ...o, output_lot_id: lot.id };
        const inT = o.option.lots.reduce((a, u) => a + u.tonnes, 0);
        s = { ...s, lots: [lot, ...s.lots.filter((l) => l.id !== lot.id)], jobs: s.jobs.map((j) => (j.order_id === orderId ? { ...j, status: "done", yield_pct: Math.round((lot.quantity_t / inT) * 100) } : j)), hub: s.hub.filter((h) => !o.option.lots.some((u) => u.lot_id === h.lot_id && h.received === s.jobs.find((j) => j.order_id === orderId)?.date)) }; }
      const rfq = s.rfqs.find((r) => r.id === o.rfq_id)!; const eta = new Date(new Date(at).getTime() + Math.max(1, Math.ceil(o.option.miles / Math.max(o.option.trucks, 1) / 500)) * 864e5).toISOString();
      const sh: Shipment = { mode: o.option.mode, carrier: o.option.mode === "FTL" ? "Midwest Bulk Freight (DEMO carrier)" : o.option.mode === "LTL" ? "Lakes LTL (DEMO carrier)" : o.option.mode === "van" ? "CharLink service van" : "Parcel (DEMO)", carrier_demo: true, pickup: at, eta, bol_no: `BOL-${orderId.replace("ORD-", "")}`,
        events: [{ at, text: "Shipment booked; BOL issued" }], compliance: { "UN N.4 self-heating test on file": true, "SDS attached": true, "Lot QR label on every package": true, "Moisture checked (dry lots sealed)": true, "Packing list matches PO": true }, takeback: rfq.answers.takeback === "Yes" };
      o = { ...o, shipment: sh }; s = tell(s, "buyer", `Order ${orderId} is ready to ship`, `Carrier booked. Estimated delivery ${eta.slice(0, 10)}.`, href, "ready", at); break; }
    case "ship": o = { ...o, shipment: { ...o.shipment!, events: [...o.shipment!.events, { at, text: `Picked up at ${o.finishing_needed ? "Chicago hub" : "producer"}` }, { at, text: "In transit" }] } };
      s = addCustody(s, shipLots, `Shipped to buyer on ${o.shipment!.bol_no}`, o.shipment!.carrier, at); s = tell(s, "buyer", `Order ${orderId} has shipped`, `Track it on the order page. BOL ${o.shipment!.bol_no}.`, href, "shipped", at); break;
    case "deliver": o = { ...o, shipment: { ...o.shipment!, events: [...o.shipment!.events, { at, text: `Delivered${o.shipment!.takeback ? "; spent media picked up on the same truck" : ""}` }] } };
      s = addCustody(s, shipLots, `Delivered to buyer`, o.shipment!.carrier, at); s = tell(s, "buyer", `Order ${orderId} was delivered`, "Please confirm delivery (POD) or raise a dispute.", href, "delivered", at); s = setRfqStatus(s, o.rfq_id, "delivered"); break;
    case "confirm_pod": s = addCustody(s, shipLots, "Buyer confirmed receipt (POD)", "Buyer", at); s = tell(s, "ops", `Delivery confirmed for ${orderId}`, "Release the balance and the producer payout.", href, "pod", at); break;
    case "dispute": s = tell(s, "ops", `Dispute raised on ${orderId}`, note ?? "Buyer reported a problem with the delivery.", href, "dispute", at); break;
    case "release": o = { ...o, payments: [...o.payments, pay("balance", m.balance, "ACH (test)"), pay("payout", m.payout, "Payout to producer (test)")] };
      s = tell(s, "producer", `Payout of $${m.payout.toLocaleString()} released for ${orderId}`, "Paid after the buyer confirmed delivery.", href, "payout", at); break;
    case "issue_docs": s = tell(s, "buyer", `Documents ready for ${orderId}`, "Lot certificate, chain of custody and the credit end-use statement are on the order page.", href, "docs_ready", at);
      s = tell(s, "producer", `Credit end-use statement ready for ${orderId}`, `About ${o.credit_t_co2e} t CO₂e documented for your registry claim.`, `/doc?type=credit&id=${orderId}`, "docs_ready", at); break;
    case "close": s = setRfqStatus(s, o.rfq_id, "closed"); break;
  }
  return { ...s, orders: s.orders.map((x) => (x.id === orderId ? o : x)) };
}
export const orderStateLabel = (o: Order) => STATE_LABEL[o.state];

export function sendMessage(s: State, thread: string, from: Role, text: string, at: string): State {
  s = { ...s, messages: [...s.messages, { id: `M-${s.messages.length + 1}`, thread, from, text, at }] };
  const href = thread.startsWith("ORD") ? `/order?id=${thread}` : thread.startsWith("Q") ? `/quote?id=${thread}` : `/rfq?id=${thread}`;
  // Ops mediates: buyers and producers both talk to ops until an order exists.
  for (const r of (["buyer", "producer", "ops"] as Role[]).filter((r) => r !== from && (from === "ops" || r === "ops" || thread.startsWith("ORD")))) s = notify(s, r, `New message on ${thread}`, href, at);
  return s;
}
export function addLot(s: State, lot: Lot, at: string): State { return tell({ ...s, lots: [lot, ...s.lots] }, "ops", `New lot listed: ${lot.id}`, `${lot.name}, ${lot.quantity_t} t. Review in the data-quality queue.`, `/lot?id=${lot.id}`, "lot_listed", at); }
export function submitOffer(s: State, rfqId: string, lotId: string, price: number, tonnes: number, at: string): State {
  s = { ...s, offers: [{ id: `OFF-${s.offers.length + 1}`, rfq_id: rfqId, org_id: s.producerOrgId, lot_id: lotId, price_per_t: price, tonnes, at, status: "sent" }, ...s.offers] };
  return tell(s, "ops", `Offer on ${rfqId}: lot ${lotId} at $${price}/t`, "Review and add to the quote.", `/rfq?id=${rfqId}`, "offer", at);
}
export function requestVerification(s: State, lotId: string, at: string): State {
  s = { ...s, verifyRequests: [{ lot_id: lotId, at, status: "requested" }, ...s.verifyRequests.filter((v) => v.lot_id !== lotId)] };
  return tell(s, "ops", `Verification requested for lot ${lotId}`, "Send sampling instructions; route the sample to the partner lab.", `/lot?id=${lotId}`, "verify", at);
}
export function completeVerification(s: State, lotId: string, at: string): State {
  s = { ...s, verifyRequests: s.verifyRequests.map((v) => (v.lot_id === lotId ? { ...v, status: "verified" } : v)),
    lots: s.lots.map((l) => (l.id === lotId ? { ...l, verification: "third_party", coa_date: at.slice(0, 10), properties: Object.fromEntries(Object.entries(l.properties).map(([k, v]) => [k, { ...v, verification: "third_party" as const, lab: "Partner lab (DEMO result)", date: at.slice(0, 10) }])), custody: [...(l.custody ?? []), { date: at.slice(0, 10), event: "Third-party lab verified", actor: "Partner lab (DEMO)" }] } : l)) };
  return tell(s, "producer", `Lot ${lotId} is now third-party verified`, "The verified badge is live on the lot passport.", `/lot?id=${lotId}`, "verified", at);
}
