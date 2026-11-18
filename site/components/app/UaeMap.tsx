"use client";

// A stylised map of the UAE (simplified outline, not for navigation) with one marker per emirate.
import type { ReactNode } from "react";

export const EMIRATES: { key: string; name: string; ar: string; lon: number; lat: number }[] = [
  { key: "Abu Dhabi", name: "Abu Dhabi", ar: "أبوظبي", lon: 54.37, lat: 24.45 },
  { key: "Dubai", name: "Dubai", ar: "دبي", lon: 55.27, lat: 25.2 },
  { key: "Sharjah", name: "Sharjah", ar: "الشارقة", lon: 55.42, lat: 25.33 },
  { key: "Ajman", name: "Ajman", ar: "عجمان", lon: 55.52, lat: 25.42 },
  { key: "Umm Al Quwain", name: "Umm Al Quwain", ar: "أم القيوين", lon: 55.6, lat: 25.55 },
  { key: "Ras Al Khaimah", name: "Ras Al Khaimah", ar: "رأس الخيمة", lon: 55.95, lat: 25.78 },
  { key: "Fujairah", name: "Fujairah", ar: "الفجيرة", lon: 56.33, lat: 25.12 },
];

// Simplified outline (longitude, latitude), clockwise from the Saudi border on the western coast.
const OUTLINE: [number, number][] = [
  [51.58, 24.26], [51.9, 24.0], [52.6, 24.2], [53.4, 24.1], [53.9, 24.15], [54.25, 24.32], [54.45, 24.55], [54.7, 24.78], [55.0, 25.0],
  [55.25, 25.25], [55.45, 25.38], [55.62, 25.58], [55.85, 25.72], [56.02, 25.93], [56.08, 26.05], [56.15, 25.75], [56.27, 25.62],
  [56.37, 25.5], [56.36, 25.1], [56.33, 24.95], [56.05, 24.85], [55.95, 24.6], [55.8, 24.25], [55.95, 24.05], [55.6, 23.85],
  [55.5, 23.4], [55.2, 22.7], [54.1, 22.75], [52.6, 22.95], [51.6, 24.0],
];
const W = 360, H = 260;
const LON0 = 51.4, LON1 = 56.6, LAT0 = 22.5, LAT1 = 26.2;
export const project = (lon: number, lat: number): [number, number] => [((lon - LON0) / (LON1 - LON0)) * W, H - ((lat - LAT0) / (LAT1 - LAT0)) * H];
const path = OUTLINE.map(([a, b], i) => `${i ? "L" : "M"}${project(a, b).map((v) => v.toFixed(1)).join(",")}`).join("") + "Z";

export type Marker = { key: string; count: number; color: string; label: string };

export function UaeMap({ markers, selected, onSelect, footer }: { markers: Marker[]; selected: string | null; onSelect: (k: string | null) => void; footer?: ReactNode }) {
  const max = Math.max(1, ...markers.map((m) => m.count));
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#dfe6df] bg-[linear-gradient(160deg,#dcecf2_0%,#e8f1ee_55%,#eef2e6_100%)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Map of the United Arab Emirates with one marker per emirate">
        <defs>
          <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbf6ea" />
            <stop offset="1" stopColor="#f1e6cd" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f3f2c" floodOpacity="0.12" />
          </filter>
        </defs>
        {[40, 80, 120, 160, 200].map((y) => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.6" />)}
        <path d={path} fill="url(#land)" stroke="#c9b88f" strokeWidth="1.2" filter="url(#soft)" />
        <text x="18" y="40" className="fill-[#5f8aa0]" fontSize="10" fontStyle="italic" letterSpacing="2">ARABIAN GULF</text>
        <text x="354" y="200" className="fill-[#5f8aa0]" fontSize="8" fontStyle="italic" letterSpacing="1.5" transform="rotate(-90 354 200)">GULF OF OMAN</text>
        {markers.map((m) => {
          const e = EMIRATES.find((x) => x.key === m.key);
          if (!e) return null;
          const [x, y] = project(e.lon, e.lat);
          const r = 6 + (m.count / max) * 11;
          const on = selected === m.key;
          return (
            <g key={m.key} onClick={() => onSelect(on ? null : m.key)} className="cursor-pointer" role="button" aria-label={`${e.name}: ${m.label}`}>
              {m.count > 0 && <circle cx={x} cy={y} r={r + 7} fill={m.color} opacity={on ? 0.28 : 0.14} />}
              <circle cx={x} cy={y} r={m.count > 0 ? r : 4} fill={m.count > 0 ? m.color : "#b7c2bc"} stroke="#fff" strokeWidth={on ? 3 : 2} />
              {m.count > 0 && <text x={x} y={y + 3.6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{m.count}</text>}
            </g>
          );
        })}
      </svg>
      {footer && <div className="absolute inset-x-3 bottom-3">{footer}</div>}
    </div>
  );
}
