"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore, setState } from "@/lib/store";
import { acceptQuote } from "@/lib/store/actions";
import { appById } from "@/config/applications";
import { num, usd } from "@/lib/domain/units";
import { Badge, Card, Demo, fmtDate } from "@/components/ui";
import Thread from "@/components/Thread";
import { withSuspense, now } from "@/components/Page";

function QuotePage() {
  const s = useStore(); const router = useRouter(); const id = useSearchParams().get("id"); const q = s.quotes.find((x) => x.id === id); const [sel, setSel] = useState<string | null>(null);
  if (!q) return <Card title="Quote not found"><p><Link href="/account">See all requests</Link>.</p></Card>;
  const rfq = s.rfqs.find((r) => r.id === q.rfq_id)!; const order = s.orders.find((o) => o.quote_id === q.id); const chosen = sel ?? q.selected ?? q.options[0].id; const best = Math.min(...q.options.map((o) => o.per_t));
  const accept = () => { let oid = ""; setState((x) => { const [n, o] = acceptQuote(x, q.id, chosen, now()); oid = o; return n; }); router.push(`/order?id=${oid}`); };
  return (<div className="stack">
    <div className="row between"><div><h1>Quote {q.id} {rfq.demo && <Demo />}</h1><p className="lead" style={{ margin: 0 }}>For <Link href={`/rfq?id=${rfq.id}`}>{rfq.id}</Link>: {appById(rfq.application).label}, {num(rfq.tonnes, 2)} t delivered to {rfq.dest.label} · valid until {fmtDate(q.valid_until)}</p></div>
      <div className="row noprint"><Badge kind={q.status === "accepted" ? "ok" : "info"}>{q.status}</Badge><Link className="btn" href={`/doc?type=quote&id=${q.id}`}>Quote PDF</Link>{order && <Link className="btn primary" href={`/order?id=${order.id}`}>Open order {order.id}</Link>}</div></div>
    <p className="small">Landed cost = char + freight + finishing + packaging + testing + CharLink's {q.model === "agent" ? `${q.fee_pct}% commission (agent model)` : `margin (${q.fee_pct}% of price, principal model)`}. {q.credit_share ? "Credit-share pricing is on." : ""} Char prices are DEMO; freight and finishing rates are planning estimates until real quotes exist.</p>
    <div className={q.options.length > 2 ? "cols3" : "cols2"}>
      {q.options.map((o) => (<div key={o.id} className={`optcard ${chosen === o.id ? "sel" : ""}`}>
        <div className="row between"><h3 style={{ margin: 0 }}>{o.label}</h3><Badge kind={o.kind === "direct" ? "ok" : o.kind === "blend" ? "info" : "gold"}>{o.kind.replace("_", " ")}</Badge></div>
        <div className="big" style={{ margin: "8px 0 0" }}>{usd(o.per_t)}<span style={{ fontSize: 14, fontWeight: 400 }}> /t delivered</span></div>
        <p className="small">{usd(o.total, 2)} total · {usd(o.per_m3)}/m³ {o.per_t === best && q.options.length > 1 && <Badge kind="ok">lowest</Badge>}</p>
        <dl className="kv" style={{ fontSize: 13 }}><dt>Lots</dt><dd>{o.lots.map((l) => <span key={l.lot_id}><Link href={`/lot?id=${l.lot_id}`}>{l.lot_id}</Link> ({l.tonnes} t) </span>)}</dd><dt>Freight</dt><dd>{o.mode}, {num(o.miles)} truck-miles{o.trucks ? `, ${o.trucks} load${o.trucks > 1 ? "s" : ""}` : ""}</dd>
          <dt>Transport CO₂</dt><dd>{num(o.co2_kg)} kg</dd><dt>Lead time</dt><dd>about {o.lead_days} days</dd></dl>
        <table style={{ marginTop: 8 }}><tbody>{o.items.map((i) => <tr key={i.key} className="plain"><td className="wrap">{i.label}{i.note && <><br /><span className="small">{i.note}</span></>}</td><td className="num">{usd(i.usd, 2)}</td></tr>)}
          <tr className="plain"><td><b>Total</b></td><td className="num"><b>{usd(o.total, 2)}</b></td></tr></tbody></table>
        {o.notes.map((n) => <p key={n} className={`callout ${n.startsWith("Cube") ? "info" : "warn"}`} style={{ marginTop: 8, fontSize: 13 }}>{n}</p>)}
        {q.status !== "accepted" && <label className="check noprint" style={{ marginTop: 10 }}><input type="radio" name="opt" checked={chosen === o.id} onChange={() => setSel(o.id)} /> Choose this option</label>}
        {q.selected === o.id && <p style={{ marginTop: 8 }}><Badge kind="ok">Accepted</Badge></p>}
      </div>))}
    </div>
    {q.status !== "accepted" && <Card title="Accept"><p>Accepting issues a purchase order. A {s.A.depositPct}% deposit is due at PO and held until you confirm delivery; the balance is due after delivery. <b>Payments are simulated: no real money moves.</b></p>
      <button className="btn primary" onClick={accept}>Accept {q.options.find((o) => o.id === chosen)?.kind.replace("_", " ")} option and issue PO</button></Card>}
    <Card title="Messages"><Thread thread={rfq.id} /></Card>
  </div>);
}
export default withSuspense(QuotePage);
