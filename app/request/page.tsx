"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { APPLICATIONS, appById } from "@/config/applications";
import { gradeByCode } from "@/config/grades";
import { useStore, setState } from "@/lib/store";
import { createRfq } from "@/lib/store/actions";
import { normalizeQty, num } from "@/lib/domain/units";
import { truckCapacity } from "@/lib/logistics/freight";
import { PLACES } from "@/lib/providers";
import { producers } from "@/lib/data";
import type { Packaging, QtyUnit, Rfq } from "@/lib/domain/types";
import { Badge, Card } from "@/components/ui";
import { now } from "@/components/Page";

const PACK: Record<Packaging, string> = { bulk_ftl: "Bulk, full truckload", supersack: "1 m³ supersacks", bag: "Small bags (15 kg)", cartridge: "Pre-filled cartridges" };
const UNITS: Record<QtyUnit, string> = { t: "tonnes", m3: "m³", yd3: "cubic yards", supersack: "supersacks" };
const FIT = { beachhead: "ok", "follow-on": "info", weak: "warn", exploratory: "warn" } as const;

export default function RequestPage() {
  const s = useStore(); const router = useRouter(); const [step, setStep] = useState(1);
  const [appId, setAppId] = useState("stormwater_filtration"); const app = appById(appId);
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [qty, setQty] = useState(4); const [unit, setUnit] = useState<QtyUnit>("t");
  const [place, setPlace] = useState("Madison, WI"); const [needBy, setNeedBy] = useState("");
  const [packaging, setPackaging] = useState<Packaging>("supersack"); const [sample, setSample] = useState(true);
  const [supplier, setSupplier] = useState(""); const [budget, setBudget] = useState(""); const [buyer, setBuyer] = useState(s.buyerName);
  const q = useMemo(() => normalizeQty(qty || 0, unit, s.A.defaultBulkDensity, s.A), [qty, unit, s.A]);
  const cap = truckCapacity(s.A.defaultBulkDensity, s.A); const trucks = q.tonnes / cap.tPerTruck;
  const set = (k: string, v: string | number | string[]) => setAnswers((a) => ({ ...a, [k]: v }));
  const perYear = typeof answers.units === "number" && typeof answers.media_per_unit_kg === "number" ? (answers.units * answers.media_per_unit_kg * (typeof answers.changes_per_year === "number" ? answers.changes_per_year : 1)) / 1000 : null;
  const dest = PLACES.find((p) => p.label === place) ?? PLACES[0];
  const pickApp = (id: string) => { setAppId(id); setAnswers({}); const a = appById(id); if (!a.packaging.includes(packaging)) setPackaging(a.packaging[0]); };
  function submit() {
    const input: Omit<Rfq, "id" | "created" | "status"> = { buyer_name: buyer || "Buyer", application: appId, answers, qty, qty_unit: unit, tonnes: q.tonnes, m3: q.m3, dest: { label: dest.label, lat: dest.lat, lng: dest.lng }, need_by: needBy || undefined, packaging, sample_first: sample, current_supplier_org_id: supplier || undefined, budget_per_t: budget ? Number(budget) : undefined };
    let rid = ""; setState((x) => { const [n, r] = createRfq({ ...x, buyerName: buyer }, input, now()); rid = r; return n; }); router.push(`/rfq?id=${rid}`);
  }
  return (<>
    <h1>Request biochar</h1><p className="lead">Tell us the use. We ask only what that use needs, then match you to lots that meet the grade and price the delivery.</p>
    <ol className="steps" aria-label="Steps">{["Application", "Requirements", "Quantity and delivery", "Review"].map((l, i) => <li key={l} className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""} aria-current={step === i + 1 ? "step" : undefined}>{i + 1}. {l}</li>)}</ol>
    {step === 1 && <Card title="What is the biochar for?"><div className="cols3" role="radiogroup" aria-label="Application">
      {APPLICATIONS.map((a) => <button key={a.id} role="radio" aria-checked={appId === a.id} className={`wizard-opt ${appId === a.id ? "on" : ""}`} onClick={() => pickApp(a.id)}><b>{a.label}</b><span className="small">{a.short}</span><br /><Badge kind={FIT[a.fit]}>{a.fit}</Badge> <Badge>{a.evidence}</Badge></button>)}</div>
      {app.fit === "weak" && <p className="callout warn" style={{ marginTop: 12 }}>Our interviews say biochar is a weak fit for green roofs: fines blow away and specs are weight-driven. You can still request it.</p>}
      {app.id === "metallurgical" && <p className="callout warn" style={{ marginTop: 12 }}>Steel use burns the carbon, so it earns no removal credits.</p>}
      {app.evidence === "speculative" && app.fit === "exploratory" && <p className="callout warn" style={{ marginTop: 12 }}>Exploratory: we have no evidence for this market yet.</p>}
    </Card>}
    {step === 2 && <Card title={`${app.label}: requirements`}><p className="small">What matters here: {app.what_matters.join("; ")}.</p><div className="form">
      {app.questions.map((qn) => <div key={qn.key}><label htmlFor={`q-${qn.key}`}>{qn.label}{qn.unit ? ` (${qn.unit})` : ""}</label>
        {qn.type === "select" && <select id={`q-${qn.key}`} value={(answers[qn.key] as string) ?? ""} onChange={(e) => set(qn.key, e.target.value)}><option value="">Select…</option>{qn.options!.map((o) => <option key={o} value={o}>{qn.key === "grade" ? `${o}: ${gradeByCode(o).name} (${gradeByCode(o).band_mm.join("–")} mm)` : o}</option>)}</select>}
        {qn.type === "number" && <input id={`q-${qn.key}`} type="number" min="0" value={(answers[qn.key] as number) ?? ""} onChange={(e) => set(qn.key, e.target.value === "" ? "" : Number(e.target.value))} />}
        {qn.type === "multi" && <div id={`q-${qn.key}`} className="row" role="group" aria-label={qn.label}>{qn.options!.map((o) => { const cur = (answers[qn.key] as string[]) ?? []; const on = cur.includes(o); return <button key={o} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set(qn.key, on ? cur.filter((x) => x !== o) : [...cur, o])}>{o}</button>; })}</div>}
        {qn.help && <small>{qn.help}</small>}</div>)}</div>
      {perYear != null && perYear > 0 && <p className="callout">That is about <b>{num(perYear, 2)} t of media per year</b> ({num(perYear * 1000)} kg). <button className="btn small" onClick={() => { setQty(Math.round(perYear * 100) / 100); setUnit("t"); }}>Use this as the quantity</button></p>}
      {app.safety.map((x) => <p key={x} className="callout warn">{x}</p>)}
    </Card>}
    {step === 3 && <Card title="Quantity and delivery"><div className="form">
      <div><label htmlFor="qty">Quantity</label><input id="qty" type="number" min="0" step="0.1" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
      <div><label htmlFor="unit">Unit</label><select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as QtyUnit)}>{Object.entries(UNITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label htmlFor="place">Deliver to</label><select id="place" value={place} onChange={(e) => setPlace(e.target.value)}>{PLACES.map((p) => <option key={p.label}>{p.label}</option>)}</select></div>
      <div><label htmlFor="need">Need by (optional)</label><input id="need" type="date" value={needBy} onChange={(e) => setNeedBy(e.target.value)} /></div>
      <div><label htmlFor="pack">Packaging</label><select id="pack" value={packaging} onChange={(e) => setPackaging(e.target.value as Packaging)}>{app.packaging.map((p) => <option key={p} value={p}>{PACK[p]}</option>)}</select></div>
      <div><label htmlFor="supplier">Current supplier (optional)</label><select id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">None / not sure</option>{producers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div><label htmlFor="budget">Target $ per tonne delivered (optional)</label><input id="budget" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
      <div><label htmlFor="buyer">Your organization</label><input id="buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} /></div>
    </div>
      <label className="check"><input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} /> Send a sample before I order</label>
      <p className="callout" style={{ marginTop: 12 }}>{num(q.tonnes, 2)} t ≈ {num(q.m3, 1)} m³ ≈ {num(q.yd3, 1)} yd³ ≈ <b>{q.supersacks} supersack{q.supersacks === 1 ? "" : "s"}</b> ≈ <b>{trucks < 0.1 ? "a pallet or two" : `${num(trucks, 1)} truckload${trucks > 1.05 ? "s" : ""}`}</b> at {s.A.defaultBulkDensity} kg/m³.
        {cap.cubeLimited ? ` A trailer fills by volume at ${num(cap.tPerTruck, 1)} t (cube-limited).` : ` Lighter char (below 200 kg/m³) fills a trailer by volume before the ${s.A.truckWeightCapT} t weight limit.`} The exact figure uses each lot's own bulk density.</p>
    </Card>}
    {step === 4 && <Card title="Review"><dl className="kv">
      <dt>Application</dt><dd>{app.label}</dd><dt>Requirements</dt><dd>{Object.entries(answers).filter(([, v]) => v !== "" && !(Array.isArray(v) && !v.length)).map(([k, v]) => `${app.questions.find((x) => x.key === k)?.label ?? k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ") || "Defaults for this application"}</dd>
      <dt>Quantity</dt><dd>{qty} {UNITS[unit]} ({num(q.tonnes, 2)} t, {q.supersacks} supersacks)</dd><dt>Deliver to</dt><dd>{dest.label}{needBy ? `, by ${needBy}` : ""}</dd><dt>Packaging</dt><dd>{PACK[packaging]}</dd><dt>Sample first</dt><dd>{sample ? "Yes" : "No"}</dd>
      {supplier && <><dt>Current supplier</dt><dd>{producers.find((p) => p.id === supplier)?.name}</dd></>}{budget && <><dt>Target</dt><dd>${budget}/t delivered</dd></>}</dl>
      <p className="small" style={{ marginTop: 10 }}>Requests are free. You pay only when you accept a quote.</p></Card>}
    <div className="row" style={{ marginTop: 16 }}>
      {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
      {step < 4 ? <button className="btn primary" onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn primary" onClick={submit} disabled={!(q.tonnes > 0)}>Submit request and see matches</button>}
    </div>
  </>);
}
