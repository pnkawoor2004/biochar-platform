import { NextResponse } from "next/server";

// Truck route geometry for drawing on the map. Accepts 2+ waypoints [{lat,lng}].
export async function POST(req) {
  const { points } = await req.json();
  const key = process.env.ORS_API_KEY;
  const straight = { live: false, coords: points.map((p) => [p.lat, p.lng]) };
  if (!key) return NextResponse.json(straight);

  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]), units: "mi" }),
    });
    if (!res.ok) return NextResponse.json({ ...straight, reason: `Routing service returned ${res.status}` });
    const data = await res.json();
    const f = data.features?.[0];
    return NextResponse.json({
      live: true,
      coords: f.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      miles: f.properties?.summary?.distance,
      hours: (f.properties?.summary?.duration || 0) / 3600,
    });
  } catch (e) {
    return NextResponse.json({ ...straight, reason: "Routing service unreachable" });
  }
}
