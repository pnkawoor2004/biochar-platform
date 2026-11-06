"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { segmentColors } from "../lib/data";

const FEED_COLORS = { wood: "#8b5a2b", ag: "#c9a227", biosolids: "#7b5ea7" };

// Interactive map of producers, buyers, the hub and optional routes.
export default function Map({ producers = [], buyers = [], hub, routes = [], height = 520, onPick }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    if (map.current) return;
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView([39.5, -96], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();

    routes.forEach((r) => {
      L.polyline(r.coords, { color: r.color || "#2a6b46", weight: r.weight || 4, opacity: 0.85, dashArray: r.dash }).addTo(g);
    });

    producers.forEach((p) => {
      const scale = p.capacityTpy || p.deliveredT || 0;
      const radius = scale ? Math.min(16, 5 + Math.sqrt(scale) / 25) : 6;
      L.circleMarker([p.lat, p.lng], {
        radius, color: "#fff", weight: 1.5, fillColor: FEED_COLORS[p.feedClass] || "#555", fillOpacity: 0.9,
      })
        .bindPopup(
          `<b>${p.name}</b><br>${p.city}<br>Feedstock: ${p.feedstock}<br>` +
            `${p.capacityTpy ? `Capacity: ${p.capacityTpy.toLocaleString()} t/yr<br>` : ""}` +
            `${p.deliveredT ? `Credits delivered: ${p.deliveredT.toLocaleString()} t<br>` : ""}` +
            `Sizes sold: ${p.sizes.length ? p.sizes.join(", ") : "not published"}`
        )
        .on("click", () => onPick && onPick({ type: "producer", item: p }))
        .addTo(g);
    });

    buyers.forEach((b) => {
      L.circleMarker([b.lat, b.lng], {
        radius: 7, color: segmentColors[b.segment] || "#333", weight: 3, fillColor: "#fff", fillOpacity: 1,
      })
        .bindPopup(`<b>${b.name}</b><br>${b.city}<br>Segment: ${b.segment}<br>Status: ${b.status}`)
        .on("click", () => onPick && onPick({ type: "buyer", item: b }))
        .addTo(g);
    });

    if (hub) {
      L.marker([hub.lat, hub.lng], {
        icon: L.divIcon({ className: "hub-icon", html: "<span>HUB</span>", iconSize: [38, 20] }),
      })
        .bindPopup(`<b>${hub.name}</b><br>${hub.city}`)
        .addTo(g);
    }

    if (routes.length) {
      const all = routes.flatMap((r) => r.coords);
      if (all.length) map.current.fitBounds(all, { padding: [30, 30] });
    }
  }, [producers, buyers, hub, routes, onPick]);

  return <div ref={el} style={{ height, width: "100%" }} className="map" />;
}
