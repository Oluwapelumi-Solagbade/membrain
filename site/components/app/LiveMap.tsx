"use client";

// A real map of the UAE (Leaflet, OpenStreetMap tiles in a soft grey) with MemBrain's own markers: a count
// bubble per place, coloured by the most urgent level there. Leaflet is loaded in the browser only.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

export type MapPoint = { id: string; lat: number; lon: number; count: number; color: string; label: string; selected?: boolean; kind?: "bubble" | "pin" };

const UAE_BOUNDS: [[number, number], [number, number]] = [[22.6, 51.5], [26.2, 56.45]];

function drawMarkers(lf: typeof Leaflet, lg: Leaflet.LayerGroup, points: MapPoint[], pick: (id: string) => void) {
  lg.clearLayers();
  const max = Math.max(1, ...points.map((p) => p.count));
  for (const p of points) {
    const size = p.kind === "pin" ? 30 : Math.round(30 + (p.count / max) * 22);
    const html = p.kind === "pin"
      ? `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${p.color};box-shadow:0 6px 14px -4px rgba(0,0,0,.4);border:2.5px solid #fff;display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font:700 12px/1 system-ui">${p.count}</span></div>`
      : `<div style="position:relative;width:${size}px;height:${size}px">
           <div style="position:absolute;inset:-8px;border-radius:50%;background:${p.color};opacity:${p.selected ? 0.28 : 0.16}"></div>
           <div style="position:absolute;inset:0;border-radius:50%;background:${p.count ? p.color : "#9aa7a1"};border:3px solid #fff;box-shadow:0 8px 20px -6px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${size > 40 ? 15 : 13}px/1 system-ui">${p.count}</div>
         </div>`;
    const icon = lf.divIcon({ html, className: "mb-marker", iconSize: [size, size], iconAnchor: p.kind === "pin" ? [15, 30] : [size / 2, size / 2] });
    lf.marker([p.lat, p.lon], { icon, title: p.label, keyboard: true }).on("click", () => pick(p.id)).addTo(lg);
  }
}

export function LiveMap({ points, onSelect, height = 300 }: { points: MapPoint[]; onSelect: (id: string | null) => void; height?: number }) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const pick = useRef(onSelect);
  const latest = useRef(points);
  useEffect(() => {
    pick.current = onSelect;
    latest.current = points;
  });

  useEffect(() => {
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead || !el.current || map.current) return;
      const lf = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = lf;
      const m = lf.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
      // OpenStreetMap's standard tiles, softened by CSS (.mb-map .leaflet-tile-pane). Fine for a demo with attribution;
      // a production deployment should use a licensed tile provider (OSM's tile policy forbids heavy use).
      lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      m.fitBounds(UAE_BOUNDS, { padding: [8, 8] });
      m.zoomControl.setPosition("bottomright");
      m.on("click", () => pick.current(null));
      layer.current = lf.layerGroup().addTo(m);
      map.current = m;
      drawMarkers(lf, layer.current, latest.current, (id) => pick.current(id));
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (L.current && layer.current) drawMarkers(L.current, layer.current, points, (id) => pick.current(id));
  }, [points]);

  return <div ref={el} className="mb-map overflow-hidden rounded-[22px] border border-[#e3e6e1] bg-[#eef2ee]" style={{ height }} role="region" aria-label="Map of the United Arab Emirates" />;
}

/** Where things are: emirates, and the places in the service directory. */
export const PLACES: Record<string, { lat: number; lon: number; ar: string }> = {
  "Abu Dhabi": { lat: 24.4539, lon: 54.3773, ar: "أبوظبي" },
  "Abu Dhabi City": { lat: 24.4539, lon: 54.3773, ar: "مدينة أبوظبي" },
  "Al Ain": { lat: 24.2075, lon: 55.7447, ar: "العين" },
  "Al Dhafra": { lat: 23.6544, lon: 53.7052, ar: "الظفرة" },
  Dubai: { lat: 25.2048, lon: 55.2708, ar: "دبي" },
  Sharjah: { lat: 25.3463, lon: 55.4209, ar: "الشارقة" },
  Ajman: { lat: 25.4052, lon: 55.5136, ar: "عجمان" },
  "Umm Al Quwain": { lat: 25.5647, lon: 55.5552, ar: "أم القيوين" },
  "Ras Al Khaimah": { lat: 25.8007, lon: 55.9762, ar: "رأس الخيمة" },
  Fujairah: { lat: 25.1288, lon: 56.3265, ar: "الفجيرة" },
};
export const EMIRATE_KEYS = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
