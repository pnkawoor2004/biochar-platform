"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
export interface Pin { id: string; lat: number; lng: number; color: string; ring?: boolean; radius?: number; html: string; approx?: boolean }
export interface Route { coords: [number, number][]; color?: string; dash?: string; weight?: number }
// Generic map: filled dots for supply, rings for demand, a labeled hub, optional routes. Clusters are not needed below ~500 pins with canvas rendering.
export default function Map({ pins = [], hub, routes = [], height = 520, fit = false }: { pins?: Pin[]; hub?: { lat: number; lng: number; name: string }; routes?: Route[]; height?: number; fit?: boolean }) {
  const el = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null); const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (map.current || !el.current) return;
    map.current = L.map(el.current, { scrollWheelZoom: false, preferCanvas: true }).setView([39.5, -96], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>', maxZoom: 18 }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const g = layer.current; if (!g || !map.current) return; g.clearLayers();
    routes.forEach((r) => L.polyline(r.coords, { color: r.color || "#2a6b46", weight: r.weight || 4, opacity: 0.85, dashArray: r.dash }).addTo(g));
    pins.forEach((p) => L.circleMarker([p.lat, p.lng], p.ring ? { radius: p.radius ?? 7, color: p.color, weight: 3, fillColor: "#fff", fillOpacity: 1 } : { radius: p.radius ?? 6, color: "#fff", weight: 1.5, fillColor: p.color, fillOpacity: p.approx ? 0.45 : 0.9 }).bindPopup(p.html).addTo(g));
    if (hub) L.marker([hub.lat, hub.lng], { icon: L.divIcon({ className: "hub-icon", html: "<span>HUB</span>", iconSize: [38, 20] }) }).bindPopup(`<b>${hub.name}</b>`).addTo(g);
    const all: [number, number][] = fit ? [...routes.flatMap((r) => r.coords), ...(routes.length ? [] : pins.map((p) => [p.lat, p.lng] as [number, number]))] : [];
    if (all.length > 1) map.current.fitBounds(all, { padding: [30, 30], maxZoom: 9 });
  }, [pins, hub, routes, fit]);
  return <div ref={el} style={{ height, width: "100%" }} className="map" />;
}
