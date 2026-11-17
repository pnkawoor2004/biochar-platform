"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore, setState } from "@/lib/store";
import { appById } from "@/config/applications";
import { STATE_LABEL } from "@/lib/orders/machine";
import { num, usd } from "@/lib/domain/units";
import { Badge, Card, Demo, Empty, LinkBtn, fmtDate } from "@/components/ui";
import { withSuspense } from "@/components/Page";

function Account() {
  const s = useStore(); const router = useRouter(); const tab = useSearchParams().get("tab") ?? "requests";
  const mine = s.role === "buyer" ? s.rfqs.filter((r) => r.buyer_name === s.buyerName) : s.rfqs; const ids = new Set(mine.map((r) => r.id));
  const notes = s.notifications.filter((n) => n.role === s.role);
  const go = (t: string) => router.push(`/account?tab=${t}`);
  return (<div className="stack">
    <div className="row between"><div><h1>{s.role === "buyer" ? s.buyerName : s.role === "ops" ? "All buyer activity" : "Producer view"}</h1><p className="lead" style={{ margin: 0 }}>{s.role === "buyer" ? "Your requests, quotes, orders and alerts." : "Switch to the Buyer view to see one buyer's account."}</p></div>
      {s.role === "buyer" && <div className="row"><label htmlFor="who" className="small" style={{ margin: 0 }}>Demo buyer</label><select id="who" style={{ width: "auto" }} value={s.buyerName} onChange={(e) => setState((x) => ({ ...x, buyerName: e.target.value }))}>{[...new Set(s.rfqs.map((r) => r.buyer_name))].map((b) => <option key={b}>{b}</option>)}</select><LinkBtn href="/request" primary>New request</LinkBtn></div>}</div>
    <div className="tabs" role="tablist">{[["requests", `Requests (${mine.length})`], ["orders", `Orders (${s.orders.filter((o) => ids.has(o.rfq_id)).length})`], ["notifications", `Alerts (${notes.filter((n) => !n.read).length} new)`]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => go(k)}>{l}</button>)}</div>
    {tab === "requests" && <Card>{mine.length === 0 ? <Empty>No requests yet. <Link href="/request">Request biochar</Link>.</Empty> : <div className="table-wrap"><table><thead><tr><th>Request</th><th>Application</th><th className="num">Quantity</th><th>Deliver to</th><th>Status</th><th>Next</th></tr></thead><tbody>
      {mine.map((r) => { const q = s.quotes.find((x) => x.rfq_id === r.id); const o = s.orders.find((x) => x.rfq_id === r.id);
        return <tr key={r.id} className="plain"><td><Link href={`/rfq?id=${r.id}`}>{r.id}</Link> {r.demo && <Demo />}<br /><span className="small">{fmtDate(r.created)}</span></td><td>{appById(r.application).label}</td><td className="num">{num(r.tonnes, 2)} t</td><td>{r.dest.label}</td><td><Badge kind="info">{r.status}</Badge></td>
          <td>{o ? <Link href={`/order?id=${o.id}`}>Order {o.id}</Link> : q ? <Link href={`/quote?id=${q.id}`}>Review quote {q.id}</Link> : <Link href={`/rfq?id=${r.id}`}>See matches</Link>}</td></tr>; })}</tbody></table></div>}</Card>}
    {tab === "orders" && <Card>{s.orders.filter((o) => ids.has(o.rfq_id)).length === 0 ? <Empty>No orders yet.</Empty> : <div className="table-wrap"><table><thead><tr><th>Order</th><th>Lots</th><th className="num">Total</th><th>State</th><th>Documents</th></tr></thead><tbody>
      {s.orders.filter((o) => ids.has(o.rfq_id)).map((o) => <tr key={o.id} className="plain"><td><Link href={`/order?id=${o.id}`}>{o.id}</Link><br /><span className="small">{fmtDate(o.created)}</span></td><td>{o.option.lots.map((l) => l.lot_id).join(", ")}</td><td className="num">{usd(o.total, 2)}</td><td><Badge kind={o.state === "closed" ? "ok" : "info"}>{STATE_LABEL[o.state]}</Badge></td>
        <td><Link href={`/doc?type=invoice&id=${o.id}`}>Invoice</Link> · <Link href={`/doc?type=certificate&id=${o.output_lot_id ?? o.option.lots[0].lot_id}`}>Certificate</Link></td></tr>)}</tbody></table></div>}</Card>}
    {tab === "notifications" && <Card right={<button className="btn small" onClick={() => setState((x) => ({ ...x, notifications: x.notifications.map((n) => (n.role === x.role ? { ...n, read: true } : n)) }))}>Mark all read</button>}>
      {notes.length === 0 ? <Empty>No alerts for this role.</Empty> : <ul className="timeline">{notes.slice(0, 40).map((n) => <li key={n.id} className={n.read ? "todo" : ""}><Link href={n.href}>{n.text}</Link> <span className="small">· {fmtDate(n.at)}</span></li>)}</ul>}
      <p className="small">Every alert is also an email. In this build emails go to the <Link href="/ops/outbox">outbox</Link> instead of being sent.</p></Card>}
  </div>);
}
export default withSuspense(Account);
