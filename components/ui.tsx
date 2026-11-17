"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PsdPoint, Verification, Provenance } from "@/lib/domain/types";
import { VERIFICATION_LADDER, verRank } from "@/config/grades";
import type { Criterion } from "@/lib/match";

export const Demo = ({ label = "DEMO" }: { label?: string }) => <span className="badge demo" title="Fictional data for the demo">{label}</span>;
export const Badge = ({ kind = "", children }: { kind?: string; children: ReactNode }) => <span className={`badge ${kind}`}>{children}</span>;
export const Prov = ({ p }: { p: Provenance }) => p === "demo" ? <Demo /> : <Badge kind={p === "published" ? "ok" : p === "interview" ? "info" : "warn"}>{p}</Badge>;
export function VerBadge({ v }: { v: Verification }) {
  const r = verRank(v); return <Badge kind={r >= 2 ? "ok" : r === 1 ? "gold" : "warn"}>{VERIFICATION_LADDER[r].label}</Badge>;
}
export const Card = ({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`panel ${className}`}>{(title || right) && <div className="row between" style={{ marginBottom: 10 }}>{title && <h2 style={{ margin: 0 }}>{title}</h2>}{right}</div>}{children}</section>
);
export const Stat = ({ v, l }: { v: ReactNode; l: ReactNode }) => <div className="stat"><b>{v}</b><span>{l}</span></div>;
export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
export const Src = ({ url }: { url: string }) => url.startsWith("http") ? <a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname.replace("www.", "")}</a> : <span title={url}>{url.startsWith("project:") ? "team research doc" : url.startsWith("repo:") ? "CharLink v0.1 research" : url}</span>;

export function ScoreBreakdown({ items }: { items: Criterion[] }) {
  return <div>{items.map((c) => (
    <div className="scoreline" key={c.key}><span>{c.label}</span><span className="bar" aria-hidden><i style={{ width: `${(c.score / c.max) * 100}%` }} /></span><span style={{ fontVariantNumeric: "tabular-nums" }}>{c.score}/{c.max}</span><span className="why">{c.why}</span></div>
  ))}</div>;
}
// Cumulative particle-size chart: percent passing vs sieve size (log scale), with the grade band shaded.
export function PsdChart({ series, band, height = 220 }: { series: { name: string; psd: PsdPoint[]; color?: string }[]; band?: [number, number]; height?: number }) {
  const W = 520, H = height, L = 44, R = 12, T = 10, B = 34; const min = 0.05, max = 20;
  const x = (mm: number) => L + ((Math.log10(Math.max(mm, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * (W - L - R);
  const y = (p: number) => T + (1 - p / 100) * (H - T - B);
  const ticks = [0.075, 0.425, 1, 2, 4, 9.5]; const colors = ["#2a6b46", "#b5562a", "#2f5f8f", "#8a6d1a"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Particle size distribution: percent passing by sieve size" style={{ width: "100%", height: "auto", maxWidth: W }}>
      {band && <rect x={x(Math.max(band[0], min))} y={T} width={x(Math.min(band[1], max)) - x(Math.max(band[0], min))} height={H - T - B} fill="#e3efe7" />}
      {[0, 25, 50, 75, 100].map((p) => <g key={p}><line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="#e0ddd4" /><text x={L - 6} y={y(p) + 4} fontSize="11" textAnchor="end" fill="#5e665f">{p}%</text></g>)}
      {ticks.map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} stroke="#eeece5" /><text x={x(t)} y={H - B + 14} fontSize="11" textAnchor="middle" fill="#5e665f">{t}</text></g>)}
      <text x={(W + L) / 2} y={H - 4} fontSize="11" textAnchor="middle" fill="#5e665f">Sieve size (mm, log scale){band ? " · shaded = grade band" : ""}</text>
      {series.map((s, i) => { const pts = [...s.psd].sort((a, b) => a.sieve_mm - b.sieve_mm); const c = s.color ?? colors[i % colors.length];
        return <g key={s.name}><polyline fill="none" stroke={c} strokeWidth="2" points={pts.map((p) => `${x(p.sieve_mm)},${y(p.pct_passing)}`).join(" ")} />{pts.map((p) => <circle key={p.sieve_mm} cx={x(p.sieve_mm)} cy={y(p.pct_passing)} r="3" fill={c}><title>{`${s.name}: ${p.pct_passing}% passing ${p.sieve_mm} mm`}</title></circle>)}
          {series.length > 1 && <text x={W - R - 4} y={T + 14 + i * 14} fontSize="11" textAnchor="end" fill={c}>{s.name}</text>}</g>; })}
    </svg>
  );
}
export function Bars({ data, unit = "", height = 150 }: { data: { label: string; value: number }[]; unit?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1); const W = 520, H = height, B = 26, bw = (W - 20) / data.length;
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart" style={{ width: "100%", height: "auto", maxWidth: W }}>
    {data.map((d, i) => { const h = ((H - B - 16) * d.value) / max; return <g key={d.label}><rect x={10 + i * bw + 6} y={H - B - h} width={bw - 12} height={h} fill="#2a6b46" rx="3"><title>{`${d.label}: ${unit}${Math.round(d.value).toLocaleString()}`}</title></rect>
      <text x={10 + i * bw + bw / 2} y={H - B - h - 4} fontSize="11" textAnchor="middle" fill="#1d211e">{unit}{Math.round(d.value).toLocaleString()}</text><text x={10 + i * bw + bw / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="#5e665f">{d.label}</text></g>; })}
  </svg>;
}
export const LinkBtn = ({ href, children, primary, small }: { href: string; children: ReactNode; primary?: boolean; small?: boolean }) => <Link href={href} className={`btn ${primary ? "primary" : ""} ${small ? "small" : ""}`}>{children}</Link>;
export const Empty = ({ children }: { children: ReactNode }) => <p className="small" style={{ padding: "12px 0" }}>{children}</p>;
