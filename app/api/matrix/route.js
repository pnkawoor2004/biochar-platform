import { NextResponse } from "next/server";
import { estimatedRoadMiles } from "../../../lib/logistics";

// Road distances (miles) and drive times (hours) from many sources to one destination,
// using OpenRouteService heavy-goods-vehicle routing. Falls back to an estimate if the key
// is missing or the service fails, and says so in the response.
export async function POST(req) {
  const { sources, destination } = await req.json();
  const key = process.env.ORS_API_KEY;

  const fallback = (reason) =>
    NextResponse.json({
      live: false,
      reason,
      results: sources.map((s) => ({ id: s.id, miles: estimatedRoadMiles(s, destination), hours: null })),
    });

  if (!key) return fallback("No routing key configured; showing estimated road miles.");

  try {
    const locations = [...sources.map((s) => [s.lng, s.lat]), [destination.lng, destination.lat]];
    const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-hgv", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        locations,
        sources: sources.map((_, i) => i),
        destinations: [sources.length],
        metrics: ["distance", "duration"],
        units: "mi",
      }),
    });
    if (!res.ok) return fallback(`Routing service returned ${res.status}; showing estimated road miles.`);
    const data = await res.json();
    return NextResponse.json({
      live: true,
      results: sources.map((s, i) => {
        const miles = data.distances?.[i]?.[0];
        const secs = data.durations?.[i]?.[0];
        return miles == null
          ? { id: s.id, miles: estimatedRoadMiles(s, destination), hours: null, estimated: true }
          : { id: s.id, miles, hours: secs / 3600 };
      }),
    });
  } catch (e) {
    return fallback("Routing service unreachable; showing estimated road miles.");
  }
}
