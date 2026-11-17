"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useStore, orgsOf } from "@/lib/store";
import { GRADES, PROPERTY_FIELDS, VERIFICATION_LADDER, verRank, METHOD_NOTE, gradeByCode } from "@/config/grades";
import { checkLimits, dValue } from "@/lib/match/psd";
import { co2ePerTonne, registryEligibility } from "@/lib/credits";
import { Badge, Card, Demo, PsdChart, Src, VerBadge, fmtDate } from "@/components/ui";
import { withSuspense } from "@/components/Page";
import { usd } from "@/lib/domain/units";

function LotPage() {
  const s = useStore(); const id = useSearchParams().get("id"); const lot = s.lots.find((l) => l.id === id); const [qr, setQr] = useState("");
  useEffect(() => { if (lot) QRCode.toString(`${window.location.origin}${window.location.pathname}?id=${lot.id}`, { type: "svg", margin: 0 }).then(setQr).catch(() => {}); }, [lot]);
  if (!lot) return <Card title="Lot not found"><p>It may have been cleared by a demo reset. <Link href="/">Back to the map</Link>.</p></Card>;
  const org = orgsOf(s).find((o) => o.id === lot.org_id); const grade = lot.grade_code ? gradeByCode(lot.grade_code) : null; const limits = grade ? checkLimits(lot, grade.limits) : [];
  const fits = GRADES.filter((g) => checkLimits(lot, g.limits.filter((l) => l.prop === "psd")).every((r) => r.ok)); const cr = co2ePerTonne(lot, s.A); const r = verRank(lot.verification);
  const app = lot.grade_code?.startsWith("CL-F") ? "stormwater_filtration" : lot.grade_code === "CL-CF" ? "concrete" : lot.grade_code === "CL-MT" ? "metallurgical" : "bioretention"; const reg = registryEligibility(app);
  const stale = lot.coa_date && (Date.now() - new Date(lot.coa_date).getTime()) / 864e5 > 730;
  return (<div className="stack">
    <div className="row between"><div><h1>Lot passport: {lot.id} {lot.demo && <Demo />}</h1><p className="lead" style={{ margin: 0 }}>{lot.name} · {org?.name}{org?.sites[lot.site_index] ? `, ${org.sites[lot.site_index].city}, ${org.sites[lot.site_index].state}` : ""}</p></div>
      <div className="row noprint"><Link className="btn" href={`/doc?type=certificate&id=${lot.id}`}>Lot certificate (PDF)</Link></div></div>
    {lot.demo && <p className="callout warn">DEMO lot. The organization is real and sourced; this lot, its price and its lab values are fictional, generated from literature ranges to show how a passport works.</p>}
    {lot.status === "quarantine" && <p className="callout bad">Quarantined: this lot fails a contaminant limit and cannot be sold.</p>}
    {stale && <p className="callout warn">The COA is more than two years old ({lot.coa_date}). Re-test before sale.</p>}
    <div className="cols-side">
      <div className="stack">
        <Card title="Summary"><dl className="kv">
          <dt>Grade</dt><dd>{grade ? <><b>{grade.code}</b> {grade.name} {limits.every((l) => l.ok !== false) ? <Badge kind="ok">within limits reported</Badge> : <Badge kind="bad">outside a limit</Badge>}</> : <>Ungraded. Size fits: {fits.length ? fits.map((g) => g.code).join(", ") : "no CharLink grade as-is (needs finishing)"}</>}</dd>
          <dt>Feedstock</dt><dd>{lot.feedstock}</dd><dt>Process</dt><dd>{lot.process}</dd><dt>Produced</dt><dd>{fmtDate(lot.production_date)}</dd><dt>Available</dt><dd>{lot.quantity_t} t · {lot.status}</dd>
          <dt>Ask</dt><dd>{usd(lot.price_ask_per_t)}/t at origin <Demo label="DEMO price" /></dd><dt>Packaging</dt><dd>{lot.packaging.join(", ").replace("bulk_ftl", "bulk truckload")}</dd><dt>Lead time</dt><dd>{lot.lead_time_days} days</dd>
          {lot.certifications.length > 0 && <><dt>Certifications</dt><dd>{lot.certifications.join(", ")}</dd></>}{lot.lineage && <><dt>Made from</dt><dd>{lot.lineage.map((x) => <Link key={x} href={`/lot?id=${x}`} style={{ marginRight: 8 }}>{x}</Link>)}</dd></>}
          {lot.notes && <><dt>Notes</dt><dd>{lot.notes}</dd></>}</dl></Card>
        <Card title="Particle size" right={<span className="small">d10 {dValue(lot.psd, 10).toFixed(2)} mm · d50 {dValue(lot.psd, 50).toFixed(2)} mm · d90 {dValue(lot.psd, 90).toFixed(2)} mm</span>}>
          <PsdChart series={[{ name: lot.id, psd: lot.psd }]} band={grade?.band_mm} />
          <div className="table-wrap"><table><thead><tr><th>Sieve (mm)</th>{lot.psd.map((p) => <th key={p.sieve_mm} className="num">{p.sieve_mm}</th>)}</tr></thead><tbody><tr className="plain"><td>% passing</td>{lot.psd.map((p) => <td key={p.sieve_mm} className="num">{p.pct_passing}</td>)}</tr></tbody></table></div></Card>
        <Card title="Properties" right={<span className="small">Each value carries its own method, lab, date and verification</span>}>
          <div className="table-wrap"><table><thead><tr><th>Property</th><th className="num">Value</th><th>Limit ({grade?.code ?? "no grade"})</th><th>Method</th><th>Lab · date</th><th>Verification</th></tr></thead><tbody>
            {PROPERTY_FIELDS.map((f) => { const v = lot.properties[f.key]; const lim = limits.find((l) => l.limit.prop === f.key);
              return <tr key={f.key} className="plain"><td>{f.label}</td><td className="num">{v ? <b>{v.value}</b> : <span className="small">not reported</span>} {v && f.unit}</td>
                <td>{lim ? <>{lim.limit.op} {lim.limit.value} {lim.ok === false ? <Badge kind="bad">fails</Badge> : lim.ok ? <Badge kind="ok">ok</Badge> : <Badge kind="warn">no data</Badge>} {lim.limit.status === "draft" && <Badge>draft limit</Badge>}</> : ""}</td>
                <td className="wrap small">{f.method}</td><td className="small">{v ? `${v.lab ?? "—"}${v.date ? ` · ${v.date}` : ""}` : ""}</td><td>{v && <VerBadge v={v.verification} />}</td></tr>; })}</tbody></table></div>
          <p className="small" style={{ marginTop: 8 }}>{METHOD_NOTE}</p></Card>
      </div>
      <div className="stack">
        <Card title="Verification ladder"><ul className="timeline">{VERIFICATION_LADDER.map((v, i) => <li key={v.key} className={i <= r ? "" : "todo"}><b>{v.label}</b>{i === r && <> <Badge kind="ok">current</Badge></>}<br /><span className="small">{v.desc}</span></li>)}</ul></Card>
        <Card title="Longevity evidence">{lot.longevity ? <p><b>{lot.longevity.bed_volumes.toLocaleString()} bed volumes</b> to {lot.longevity.pollutant} breakthrough. <span className="small">{lot.longevity.note}</span></p> : <p className="small">No column or field data yet. For filtration buyers this is the hardest proof to get, and the most valuable. CharLink's planned column rig fills this in.</p>}</Card>
        <Card title="Safety"><ul style={{ margin: 0, paddingLeft: 18 }}><li>Self-heating (UN N.4): {lot.properties.self_heating ? String(lot.properties.self_heating.value) : "not tested: required before bulk shipping"}</li><li>SDS: {r >= 1 ? "on file (DEMO)" : "not provided"}</li><li>Moisture {lot.properties.moisture ? `${lot.properties.moisture.value}%` : "not reported"}: dry and seal for asphalt or concrete use.</li><li>Fines are a combustible dust; handle with dust control.</li></ul></Card>
        <Card title="Carbon and credits"><p><b>~{cr.value} t CO₂e per tonne</b> <span className="small">(estimate)</span></p><p className="small">{cr.method}. The producer's registry decides what is issued.</p>
          <table><tbody>{reg.registries.map((x) => <tr key={x.name} className="plain"><td>{x.name}</td><td><Badge kind={x.status === "eligible" ? "ok" : x.status === "not eligible" ? "bad" : "warn"}>{x.status}</Badge></td><td className="wrap small">{x.note}</td></tr>)}</tbody></table>
          <p className="small" style={{ marginTop: 6 }}>For {app.replace("_", " ")} use. {reg.once} Source: {reg.source}</p></Card>
        <Card title="Chain of custody"><ul className="timeline">{(lot.custody ?? []).map((c, i) => <li key={i}><b>{c.event}</b><br /><span className="small">{c.date} · {c.actor}</span></li>)}</ul></Card>
        <Card title="Share"><div className="row"><div className="qr" aria-label="QR code linking to this passport" dangerouslySetInnerHTML={{ __html: qr }} /><p className="small" style={{ flex: 1 }}>This QR code goes on every supersack and bag. Scanning it opens this passport.{org && <><br />Producer source: <Src url={org.source_url} /></>}</p></div></Card>
      </div>
    </div>
  </div>);
}
export default withSuspense(LotPage);
