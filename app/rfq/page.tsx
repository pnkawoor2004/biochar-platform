"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore, setState, orgsOf } from "@/lib/store";
import { runMatch, createQuote, requestSample, advanceSample } from "@/lib/store/actions";
import { getDistances } from "@/lib/providers";
import type { Distances } from "@/lib/logistics/quote";
import { lotOrigin } from "@/lib/logistics/distances";
import { appById } from "@/config/applications";
import { HUB } from "@/config/assumptions";
import { num, usd } from "@/lib/domain/units";
import { Badge, Card, Demo, PsdChart, ScoreBreakdown, Stat, VerBadge, fmtDate } from "@/components/ui";
import Thread from "@/components/Thread";
import { withSuspense, now } from "@/components/Page";
import type { QuoteOption } from "@/lib/domain/types";
const Map = dynamic(() => import("@/components/Map"), { ssr: false });

function RfqPage() {
  const s = useStore(); const router = useRouter(); const rid = useSearchParams().get("id"); const rfq = s.rfqs.find((r) => r.id === rid);
  const [dist, setDist] = useState<Distances | undefined>(); const [open, setOpen] = useState<string | null>(null); const [picked, setPicked] = useState<string[] | null>(null);
  const [model, setModel] = useState<"agent" | "principal">("principal"); const [creditShare, setCreditShare] = useState(false); const [showAll, setShowAll] = useState(false);
  const lotKey = s.lots.length;
  useEffect(() => { if (!rfq) return; let live = true; getDistances(s.lots.filter((l) => !l.lineage), orgsOf(s), rfq.dest, s.A).then((d) => live && setDist(d)); return () => { live = false; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rid, lotKey]);
  const res = useMemo(() => (rfq ? runMatch(s, rfq, dist, { model, creditShare }) : null), [s, rfq, dist, model, creditShare]);
  if (!rfq || !res) return <Card title="Request not found"><p>It may have been cleared by a demo reset. <Link href="/account">See all requests</Link>.</p></Card>;
  const app = appById(rfq.application); const { matches, blend, swap, grade } = res; const feasible = matches.filter((m) => m.feasible);
  const defaults = feasible.slice(0, 2).map((m) => m.lot.id); const sel = picked ?? defaults; const quote = s.quotes.find((q) => q.rfq_id === rfq.id); const order = s.orders.find((o) => o.rfq_id === rfq.id);
  const shown = showAll ? matches : matches.filter((m) => m.feasible || m.fixable).concat(matches.filter((m) => !m.feasible && !m.fixable).slice(0, 3));
  const top = feasible[0]; const o = top && lotOrigin(top.lot, orgsOf(s));
  const pins = [...feasible.map((m) => { const p = lotOrigin(m.lot, orgsOf(s)); return p && { id: m.lot.id, ...p, color: m.path.path === "direct" ? "#2a6b46" : "#d98b2b", html: `<b>${m.lot.id}</b><br>${m.org?.name ?? ""}<br>Score ${m.score}` }; }).filter(Boolean) as any[], { id: "buyer", lat: rfq.dest.lat, lng: rfq.dest.lng, color: "#2f7dd1", ring: true, html: `<b>${rfq.buyer_name}</b><br>${rfq.dest.label}` }];
  const routes = o ? (top.path.path === "direct" && !top.extraOps.length ? [{ coords: [[o.lat, o.lng], [rfq.dest.lat, rfq.dest.lng]] as [number, number][], color: "#2a6b46", dash: "6 6" }] : [{ coords: [[o.lat, o.lng], [HUB.lat, HUB.lng], [rfq.dest.lat, rfq.dest.lng]] as [number, number][], color: "#d98b2b", dash: "6 6" }]) : [];
  function makeQuote() {
    const opts: QuoteOption[] = [...(blend ? [blend.option] : []), ...feasible.filter((m) => sel.includes(m.lot.id) && m.option).map((m) => ({ ...m.option!, label: `${m.option!.label}: ${m.lot.id}` }))].slice(0, 4);
    if (!opts.length) return; let qid = ""; setState((x) => { const [n, q] = createQuote(x, rfq!.id, opts, model, creditShare, now()); qid = q; return n; }); router.push(`/quote?id=${qid}`);
  }
  return (<div className="stack">
    <div className="row between"><div><h1>{rfq.id}: {app.label} {rfq.demo && <Demo />}</h1><p className="lead" style={{ margin: 0 }}>{rfq.buyer_name} · {num(rfq.tonnes, 2)} t ({rfq.qty} {rfq.qty_unit}) to {rfq.dest.label} · grade {grade.code} ({grade.band_mm.join("–")} mm){rfq.need_by ? ` · needed by ${rfq.need_by}` : ""}</p></div>
      <div className="row"><Badge kind="info">{rfq.status}</Badge>{quote && <Link className="btn" href={`/quote?id=${quote.id}`}>Open quote {quote.id}</Link>}{order && <Link className="btn" href={`/order?id=${order.id}`}>Open order {order.id}</Link>}</div></div>
    <div className="stats"><Stat v={`${feasible.length} of ${matches.length}`} l="lots meet every hard requirement" /><Stat v={feasible.filter((m) => m.path.path === "direct").length} l="ship direct, already in grade" /><Stat v={feasible.filter((m) => m.path.path === "via_hub").length} l="need hub finishing" /><Stat v={top ? usd(top.perT) + "/t" : "—"} l="best-match landed cost" /><Stat v={res.dist.live ? "Truck routes" : "Estimated"} l="road miles" /></div>
    {feasible.length === 0 && <p className="callout bad">No lot meets every requirement for {grade.code}. Lots marked "fixable" can qualify after a lab test or sample.</p>}
    {swap?.better && <div className="callout"><b>Same char, closer source.</b> Your current supplier ({swap.current.org?.name}, lot {swap.current.lot.id}) would move this order {num(swap.current.option!.miles)} truck-miles. Lot <Link href={`/lot?id=${swap.better.lot.id}`}>{swap.better.lot.id}</Link> from {swap.better.org?.name} meets the same grade and saves <b>{num(swap.savedMiles)} truck-miles</b>, <b>{num(swap.savedCo2Kg / 1000, 1)} t CO₂</b>{swap.savedUsd > 0 ? <> and <b>{usd(swap.savedUsd)}</b> ({usd(swap.savedUsd / rfq.tonnes)}/t)</> : <>, at {usd(-swap.savedUsd)} more</>}.</div>}
    {blend && <Card title="No single nearby lot covers this order: blend at the hub" right={<Badge kind={blend.meets ? "ok" : "bad"}>{blend.meets ? `Blend meets ${grade.code}` : "Blend misses the size band"}</Badge>}>
      <div className="cols2"><div><p>{blend.parts.map((p) => <span key={p.lot.id}><Link href={`/lot?id=${p.lot.id}`}>{p.lot.id}</Link> ({num(p.outTonnes, 1)} t in grade{p.path.ops.length ? `, ${p.path.ops.join(" + ")}` : ""}){" "}</span>)}</p>
        <dl className="kv"><dt>Delivered</dt><dd><b>{usd(blend.option.per_t)}/t</b> · {usd(blend.option.total)} total</dd><dt>Trucks</dt><dd>{blend.option.trucks} loads{blend.option.cube_limited ? `, cube-limited at ${num(blend.option.t_per_truck, 1)} t per truck` : ""}</dd><dt>Covers</dt><dd>{blend.covers ? "The full quantity" : "Part of the quantity"}</dd><dt>Size check</dt><dd>{blend.limits.map((l) => `${l.value?.toFixed(0)}% passing ${l.limit.sieve_mm} mm (${l.limit.op} ${l.limit.value}) ${l.ok ? "✓" : "✗"}`).join(" · ")}</dd></dl>
        <p className="small">The blended lot gets its own passport, with lineage back to each input lot.</p></div>
        <PsdChart series={[{ name: "Blend", psd: blend.psd }]} band={grade.band_mm} height={190} /></div></Card>}
    <div className="cols-side">
      <Card title="Ranked matches" right={s.role === "ops" && <div className="row small"><label className="check"><input type="checkbox" checked={creditShare} onChange={(e) => setCreditShare(e.target.checked)} /> Credit-share pricing</label>
        <select aria-label="Business model" value={model} onChange={(e) => setModel(e.target.value as any)} style={{ width: "auto" }}><option value="principal">Principal ({s.A.principalMarginPct}% margin)</option><option value="agent">Agent ({s.A.agentFeePct}% commission)</option></select></div>}>
        <div className="table-wrap"><table><thead><tr><th>Quote</th><th>Lot <Demo /></th><th>Size path</th><th>Verification</th><th className="num">Delivered</th><th className="num">Score</th></tr></thead><tbody>
          {shown.map((m) => (<FragmentRow key={m.lot.id}>
            <tr className={`${open === m.lot.id ? "pick" : ""} ${!m.feasible ? "dim" : ""}`} onClick={() => setOpen(open === m.lot.id ? null : m.lot.id)}>
              <td onClick={(e) => e.stopPropagation()}>{m.feasible && <input type="checkbox" aria-label={`Include ${m.lot.id} in the quote`} style={{ width: "auto" }} checked={sel.includes(m.lot.id)} onChange={(e) => setPicked(e.target.checked ? [...sel, m.lot.id] : sel.filter((x) => x !== m.lot.id))} />}</td>
              <td><b>{m.lot.id}</b><br /><span className="small">{m.org?.name} · {m.lot.name}</span></td>
              <td><span className={`pill ${m.path.path === "direct" ? "direct" : m.path.path === "via_hub" ? "hub" : "infeasible"}`}>{m.path.path === "direct" && !m.extraOps.length ? "Direct" : m.path.path === "infeasible" ? "Too fine" : `Hub: ${[...m.path.ops, ...m.extraOps].join(" + ")}`}</span></td>
              <td><VerBadge v={m.lot.verification} /></td><td className="num">{m.option ? `${usd(m.perT)}/t` : "—"}{m.fillTonnes < rfq.tonnes - 0.01 && m.option ? <><br /><span className="small">covers {num(m.fillTonnes, 1)} t</span></> : null}</td>
              <td className="num"><b>{m.feasible ? m.score : m.fixable ? "fixable" : "—"}</b></td></tr>
            {open === m.lot.id && <tr className="plain"><td colSpan={6} className="wrap">
              {m.hardFails.map((h) => <p key={h} className="callout bad">{h}</p>)}
              <ScoreBreakdown items={m.breakdown} />
              {m.missing.length > 0 && <p className="small" style={{ marginTop: 8 }}><b>Missing or to check:</b> {m.missing.join("; ")}.</p>}
              <div className="row" style={{ marginTop: 8 }}><Link className="btn small" href={`/lot?id=${m.lot.id}`}>Lot passport</Link>
                {m.path.path !== "infeasible" && <button className="btn small" disabled={rfq.sample?.lot_id === m.lot.id} onClick={() => setState((x) => requestSample(x, rfq.id, m.lot.id, now()))}>{rfq.sample?.lot_id === m.lot.id ? `Sample ${rfq.sample.status}` : "Request a sample"}</button>}</div>
            </td></tr>}
          </FragmentRow>))}</tbody></table></div>
        <div className="row between" style={{ marginTop: 12 }}><button className="btn small" onClick={() => setShowAll(!showAll)}>{showAll ? "Hide ruled-out lots" : `Show all ${matches.length} lots, including ruled-out`}</button>
          <button className="btn primary" onClick={makeQuote} disabled={!feasible.length}>{quote ? "Create a new landed-cost quote" : "Get landed-cost quote"}</button></div>
        <p className="small" style={{ marginTop: 8 }}>Click a row to see why it scored as it did. Lots, prices and lab values are DEMO data attached to real, sourced organizations.</p>
      </Card>
      <div className="stack">
        <Card title="Route (best match)"><Map pins={pins} hub={HUB} routes={routes} height={280} fit /><p className="small" style={{ marginTop: 6 }}>Green: direct. Orange: through the Chicago hub. Dashed lines are straight; truck-route geometry needs ORS_API_KEY.</p></Card>
        {rfq.sample && <Card title="Sample"><p>Lot <Link href={`/lot?id=${rfq.sample.lot_id}`}>{rfq.sample.lot_id}</Link>: <Badge kind="info">{rfq.sample.status}</Badge> {fmtDate(rfq.sample.date)}</p>{s.role === "ops" && rfq.sample.status !== "received" && <button className="btn small" onClick={() => setState((x) => advanceSample(x, rfq.id, now()))}>Mark sample {rfq.sample.status === "requested" ? "shipped" : "received"}</button>}</Card>}
        {s.offers.filter((f) => f.rfq_id === rfq.id).length > 0 && s.role === "ops" && <Card title="Producer offers">{s.offers.filter((f) => f.rfq_id === rfq.id).map((f) => <p key={f.id}>{f.lot_id}: {f.tonnes} t at ${f.price_per_t}/t <Badge>{f.status}</Badge></p>)}</Card>}
        <Card title="Messages"><Thread thread={rfq.id} /></Card>
      </div>
    </div>
  </div>);
}
function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export default withSuspense(RfqPage);
