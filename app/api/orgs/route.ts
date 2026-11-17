import { NextResponse } from "next/server";
import { producers, buyers, partners, stats } from "@/lib/data";
// Read-only dataset API. ?type=producers|buyers|partners&state=IL&format=csv
export async function GET(req: Request) {
  const u = new URL(req.url); const type = u.searchParams.get("type") ?? "producers"; const st = u.searchParams.get("state");
  let rows = type === "buyers" ? buyers : type === "partners" ? partners : producers;
  if (st) rows = rows.filter((o) => o.sites.some((s) => s.state === st));
  if (u.searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["id", "name", "type", "city", "state", "lat", "lng", "coord_precision", "feedstock", "status", "capacity_t_yr", "certifications", "data_gap_score", "source_url", "source_date", "provenance", "confidence"];
    const csv = [head.join(","), ...rows.map((o) => [o.id, o.name, o.type, o.sites[0].city, o.sites[0].state, o.sites[0].lat, o.sites[0].lng, o.sites[0].coord_precision, o.feedstock, o.status, o.capacity_t_yr, o.certifications.join("; "), o.data_gap_score, o.source_url, o.source_date, o.provenance, o.confidence].map(esc).join(","))].join("\n");
    return new NextResponse(csv, { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="charlink-${type}.csv"` } });
  }
  return NextResponse.json({ stats, count: rows.length, rows });
}
