"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore, setState, type Role } from "@/lib/store";
import { orderAction } from "@/lib/store/actions";
import { available, money, HAPPY_PATH, STATE_LABEL, paid } from "@/lib/orders/machine";
import { stripeEnabled } from "@/lib/providers";
import { num, usd } from "@/lib/domain/units";
import { Badge, Card, Demo, fmtDate } from "@/components/ui";
import Thread from "@/components/Thread";
import { withSuspense, now } from "@/components/Page";

const ACTOR_ROLE: Record<string, Role> = { buyer: "buyer", producer: "producer", ops: "ops", carrier: "ops", system: "ops" };
const DOCS: [string, string, (st: string[]) => boolean][] = [
  ["po", "Purchase order", () => true], ["invoice", "Invoice", () => true], ["bol", "Bill of lading", (st) => st.includes("ready_to_ship")], ["packing", "Packing list", (st) => st.includes("ready_to_ship")],
  ["certificate", "Lot certificate(s)", () => true], ["sds", "Safety data sheet", () => true], ["pod", "Proof of delivery", (st) => st.includes("delivered")], ["credit", "Credit end-use statement", (st) => st.includes("pod_confirmed")],
];
function OrderPage() {
  const s = useStore(); const id = useSearchParams().get("id"); const o = s.orders.find((x) => x.id === id);
  if (!o) return <Card title="Order not found"><p><Link href="/account">See all orders</Link>.</p></Card>;
  const rfq = s.rfqs.find((r) => r.id === o.rfq_id)!; const m = money(o); const acts = available(o); const done = o.events.map((e) => e.state); const path = HAPPY_PATH.filter((st) => st !== "finishing" || o.finishing_needed);
  const act = (a: string) => setState((x) => orderAction(x, o.id, a, now(), a === "dispute" ? "Buyer reported a problem with the delivery (demo)." : undefined));
  async function stripe() { const r = await fetch("/api/payments/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: o!.id, kind: "deposit", usd: m.deposit, origin: window.location.origin }) }); const j = await r.json(); if (j.url) window.location.href = j.url; else window.alert(j.error ?? j.reason ?? "Stripe is not configured"); }
  const certLot = o.output_lot_id ?? o.option.lots[0].lot_id;
  return (<div className="stack">
    <div className="row between"><div><h1>Order {o.id} {rfq.demo && <Demo />}</h1><p className="lead" style={{ margin: 0 }}>{rfq.buyer_name} · {num(rfq.tonnes, 2)} t to {rfq.dest.label} · from quote <Link href={`/quote?id=${o.quote_id}`}>{o.quote_id}</Link></p></div><Badge kind={o.state === "disputed" ? "bad" : o.state === "closed" ? "ok" : "info"}>{STATE_LABEL[o.state]}</Badge></div>
    <Card title="Next step">
      {acts.length === 0 ? <p>This order is complete.</p> : <div className="row">{acts.map((t) => { const role = ACTOR_ROLE[t.actor]; const mine = role === s.role;
        return <button key={t.action} className={`btn ${mine ? "primary" : ""}`} onClick={() => act(t.action)}>{mine ? t.label : `Simulate: ${t.label} (${t.actor})`}</button>; })}
        {o.state === "po_issued" && stripeEnabled() && <button className="btn" onClick={stripe}>Pay deposit with Stripe (test mode)</button>}</div>}
      <p className="small" style={{ marginTop: 8 }}>In the demo you can play every party. Buttons marked "Simulate" belong to another role. Payments use the mock provider: <b>no real money moves</b>.</p></Card>
    <div className="cols-side">
      <div className="stack">
        <Card title="Timeline"><ul className="timeline">
          {o.events.map((e, i) => <li key={i}><b>{STATE_LABEL[e.state]}</b> <span className="small">· {fmtDate(e.at)} · {e.actor}</span>{e.note && <><br /><span className="small">{e.note}</span></>}</li>)}
          {o.state !== "disputed" && path.slice(path.indexOf(o.state) + 1).map((st) => <li key={st} className="todo">{STATE_LABEL[st]}</li>)}</ul></Card>
        {o.shipment && <Card title="Shipment" right={<Badge>{o.shipment.mode}</Badge>}>
          <dl className="kv"><dt>Carrier</dt><dd>{o.shipment.carrier}</dd><dt>BOL</dt><dd>{o.shipment.bol_no}</dd><dt>Pickup</dt><dd>{fmtDate(o.shipment.pickup)}</dd><dt>ETA</dt><dd>{fmtDate(o.shipment.eta)}</dd><dt>Take-back</dt><dd>{o.shipment.takeback ? "Spent media rides back on the same truck" : "None on this delivery"}</dd></dl>
          <h3 style={{ marginTop: 12 }}>Tracking <span className="small">(simulated)</span></h3><ul className="timeline">{o.shipment.events.map((e, i) => <li key={i}>{e.text} <span className="small">· {fmtDate(e.at)}</span></li>)}</ul>
          <h3>Compliance pack</h3>{Object.entries(o.shipment.compliance).map(([k, v]) => <div key={k} className="check"><span aria-hidden>{v ? "✓" : "○"}</span> {k}</div>)}</Card>}
        <Card title="Messages"><Thread thread={o.id} /></Card>
      </div>
      <div className="stack">
        <Card title="Money"><dl className="kv"><dt>Order total</dt><dd><b>{usd(o.total, 2)}</b></dd><dt>Deposit ({o.deposit_pct}%)</dt><dd>{usd(m.deposit, 2)} {paid(o.payments, "deposit") > 0 ? <Badge kind="ok">paid, in escrow</Badge> : <Badge kind="warn">due</Badge>}</dd>
          <dt>Balance</dt><dd>{usd(m.balance, 2)} {paid(o.payments, "balance") > 0 ? <Badge kind="ok">paid</Badge> : <Badge>after delivery</Badge>}</dd>
          {s.role !== "buyer" && <><dt>Producer payout</dt><dd>{usd(m.payout, 2)} {paid(o.payments, "payout") > 0 ? <Badge kind="ok">released</Badge> : <Badge>after POD</Badge>}</dd></>}
          {s.role === "ops" && <><dt>CharLink fee</dt><dd>{usd(m.fee, 2)} ({num((m.fee / o.total) * 100, 1)}% of total)</dd><dt>Pass-through</dt><dd>{usd(m.passThrough, 2)} (freight, finishing, packaging, tests)</dd></>}</dl>
          {o.payments.length > 0 && <table style={{ marginTop: 8 }}><tbody>{o.payments.map((p) => <tr key={p.id} className="plain"><td>{p.kind}</td><td className="num">{usd(p.usd, 2)}</td><td className="small">{p.method} · {p.provider}</td></tr>)}</tbody></table>}</Card>
        <Card title="Lots"><p>{o.option.lots.map((l) => <span key={l.lot_id}><Link href={`/lot?id=${l.lot_id}`}>{l.lot_id}</Link> ({l.tonnes} t) </span>)}</p>
          {o.finishing_needed && <p className="small">{o.output_lot_id ? <>Finished at the hub into <Link href={`/lot?id=${o.output_lot_id}`}>{o.output_lot_id}</Link>, a new lot with its own passport and lineage.</> : "Goes through the Chicago hub for finishing; a new lot passport is issued when it is ready."}</p>}
          <p className="small">Estimated removal documented: ~{o.credit_t_co2e} t CO₂e (belongs to the producer's registry claim).</p></Card>
        <Card title="Documents">{DOCS.map(([type, label, ready]) => ready(done) ? <div key={type}><Link href={`/doc?type=${type}&id=${type === "certificate" || type === "sds" ? certLot : o.id}`}>{label}</Link></div> : <div key={type} className="small">{label} (issued later)</div>)}</Card>
      </div>
    </div>
  </div>);
}
export default withSuspense(OrderPage);
