import { NextResponse } from "next/server";
import { z } from "zod";
// Truck route geometry for drawing on the map. Accepts 2+ waypoints.
const Body = z.object({ points: z.array(z.object({ lat: z.number(), lng: z.number() })).min(2).max(10) });
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { points } = parsed.data; const key = process.env.ORS_API_KEY; const straight = { live: false, coords: points.map((p) => [p.lat, p.lng]) };
  if (!key) return NextResponse.json(straight);
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", { method: "POST", headers: { Authorization: key, "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]), units: "mi" }) });
    if (!res.ok) return NextResponse.json({ ...straight, reason: `Routing service returned ${res.status}` });
    const f = (await res.json()).features?.[0];
    return NextResponse.json({ live: true, coords: f.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]), miles: f.properties?.summary?.distance, hours: (f.properties?.summary?.duration || 0) / 3600 });
  } catch { return NextResponse.json({ ...straight, reason: "Routing service unreachable" }); }
}
