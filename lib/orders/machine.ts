// Order lifecycle: a small explicit state machine with escrow-style payments.
import type { Order, OrderState, OrderEvent, Payment } from "@/lib/domain/types";
export interface Transition { from: OrderState[]; to: OrderState; action: string; label: string; actor: OrderEvent["actor"]; needs?: (o: Order) => string | null }
export const TRANSITIONS: Transition[] = [
  { action: "pay_deposit", label: "Pay deposit", from: ["po_issued"], to: "deposit_paid", actor: "buyer" },
  { action: "producer_confirm", label: "Producer confirms lot and pickup", from: ["deposit_paid"], to: "producer_confirmed", actor: "producer" },
  { action: "start_finishing", label: "Start hub finishing", from: ["producer_confirmed"], to: "finishing", actor: "ops", needs: (o) => (o.finishing_needed ? null : "This order ships direct; no finishing step") },
  { action: "ready", label: "Mark ready to ship", from: ["producer_confirmed", "finishing"], to: "ready_to_ship", actor: "ops", needs: (o) => (o.finishing_needed && o.state === "producer_confirmed" ? "Finishing must run first" : null) },
  { action: "ship", label: "Dispatch shipment", from: ["ready_to_ship"], to: "in_transit", actor: "carrier" },
  { action: "deliver", label: "Mark delivered", from: ["in_transit"], to: "delivered", actor: "carrier" },
  { action: "confirm_pod", label: "Confirm delivery (POD)", from: ["delivered"], to: "pod_confirmed", actor: "buyer" },
  { action: "dispute", label: "Raise a dispute", from: ["delivered"], to: "disputed", actor: "buyer" },
  { action: "resolve", label: "Resolve dispute", from: ["disputed"], to: "pod_confirmed", actor: "ops" },
  { action: "release", label: "Collect balance and release payout", from: ["pod_confirmed"], to: "payment_released", actor: "system" },
  { action: "issue_docs", label: "Issue final documents", from: ["payment_released"], to: "docs_issued", actor: "ops" },
  { action: "close", label: "Close order", from: ["docs_issued"], to: "closed", actor: "ops" },
];
export const STATE_LABEL: Record<OrderState, string> = { po_issued: "PO issued", deposit_paid: "Deposit paid", producer_confirmed: "Producer confirmed", finishing: "Finishing at hub", ready_to_ship: "Ready to ship", in_transit: "In transit", delivered: "Delivered", pod_confirmed: "Delivery confirmed", disputed: "Disputed", payment_released: "Payment released", docs_issued: "Documents issued", closed: "Closed" };
export const HAPPY_PATH: OrderState[] = ["po_issued", "deposit_paid", "producer_confirmed", "finishing", "ready_to_ship", "in_transit", "delivered", "pod_confirmed", "payment_released", "docs_issued", "closed"];
export function available(o: Order): Transition[] { return TRANSITIONS.filter((t) => t.from.includes(o.state) && !(t.needs && t.needs(o))); }
export function apply(o: Order, action: string, at: string, note?: string): Order {
  const t = TRANSITIONS.find((x) => x.action === action);
  if (!t) throw new Error(`Unknown action ${action}`);
  if (!t.from.includes(o.state)) throw new Error(`Cannot ${action} from ${o.state}`);
  const blocked = t.needs?.(o); if (blocked) throw new Error(blocked);
  return { ...o, state: t.to, events: [...o.events, { state: t.to, at, actor: t.actor, note }] };
}
// Escrow-style money flow: deposit at PO, balance after delivery is confirmed, producer payout = char value, CharLink keeps its fee.
export function money(o: Pick<Order, "total" | "deposit_pct" | "producer_payout" | "fee_usd">) {
  const deposit = Math.round(o.total * o.deposit_pct) / 100;
  return { deposit, balance: Math.round((o.total - deposit) * 100) / 100, payout: o.producer_payout, fee: o.fee_usd, passThrough: Math.round((o.total - o.producer_payout - o.fee_usd) * 100) / 100 };
}
export const paid = (ps: Payment[], kind: Payment["kind"]) => ps.filter((p) => p.kind === kind && p.status === "succeeded").reduce((s, p) => s + p.usd, 0);
