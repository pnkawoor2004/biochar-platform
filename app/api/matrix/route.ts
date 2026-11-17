import { NextResponse } from "next/server";
import { z } from "zod";
import { estimatedRoadMiles } from "@/lib/logistics/geo";
import { DEFAULTS } from "@/config/assumptions";
// Road miles from many sources to one destination with OpenRouteService truck routing (driving-hgv).
// Falls back to an estimate when ORS_API_KEY is missing or the service fails, and says so.
const Pt = z.object({ lat: z.number(), lng: z.number() });
const Body = z.object({ sources: z.array(Pt.extend({ id: z.string() })).max(200), destination: Pt });
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sources, destination } = parsed.data; const key = process.env.ORS_API_KEY;
  const fallback = (reason: string) => NextResponse.json({ live: false, reason, results: sources.map((s) => ({ id: s.id, miles: estimatedRoadMiles(s, destination, DEFAULTS), hours: null })) });
  if (!key) return fallback("No routing key configured; showing estimated road miles.");
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-hgv", { method: "POST", headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ locations: [...sources.map((s) => [s.lng, s.lat]), [destination.lng, destination.lat]], sources: sources.map((_, i) => i), destinations: [sources.length], metrics: ["distance", "duration"], units: "mi" }) });
    if (!res.ok) return fallback(`Routing service returned ${res.status}; showing estimated road miles.`);
    const data = await res.json();
    return NextResponse.json({ live: true, results: sources.map((s, i) => { const miles = data.distances?.[i]?.[0]; const secs = data.durations?.[i]?.[0]; return miles == null ? { id: s.id, miles: estimatedRoadMiles(s, destination, DEFAULTS), hours: null, estimated: true } : { id: s.id, miles, hours: secs / 3600 }; }) });
  } catch { return fallback("Routing service unreachable; showing estimated road miles."); }
}
