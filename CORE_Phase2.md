# 🖥️ C.O.R.E. MVP — Tahap 2: Mode 1 — Command Center

> [!IMPORTANT]
> Tahap ini membuat **4 file baru** dan **mengupdate 1 file** (`page.tsx`). Ikuti urutan di bawah.

---

## File yang dibuat di Tahap ini

```
src/
├── components/
│   ├── MockMap.tsx           ← Komponen peta mockup gelap Odyssey
│   ├── ToastProvider.tsx     ← Sistem notifikasi toast global
│   └── CommandCenter.tsx     ← Layout utama Mode 1 (BARU)
└── app/
    ├── page.tsx              ← Update: import CommandCenter
    └── layout.tsx            ← Update: tambah ToastProvider
```

---

## ① `src/components/ToastProvider.tsx`

Buat file ini **pertama** karena dipakai komponen lain.

```tsx
// src/components/ToastProvider.tsx
"use client";

import React, {
  createContext, useContext, useState, useCallback, useEffect
} from "react";
import { X, CheckCircle2, AlertTriangle, Siren, Info } from "lucide-react";

// ─── Tipe ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "danger" | "warning" | "info";

type Toast = {
  id:      string;
  type:    ToastType;
  title:   string;
  message: string;
  duration?: number;
};

type ToastContextValue = {
  addToast: (toast: Omit<Toast, "id">) => void;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Single Toast Item ────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  danger:  Siren,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastType, string> = {
  success: "border-neon-green/40  bg-neon-green/10  shadow-[0_0_20px_#00FF9C22]",
  danger:  "border-alert-red/50   bg-alert-red/10   shadow-[0_0_30px_#FF4C4C33]",
  warning: "border-alert-yellow/40 bg-alert-yellow/10 shadow-[0_0_20px_#FFC10722]",
  info:    "border-accent/40      bg-accent/10      shadow-[0_0_20px_#495AEE22]",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "text-neon-green",
  danger:  "text-alert-red animate-pulse",
  warning: "text-alert-yellow",
  info:    "text-accent",
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[toast.type];

  // mount → slide in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const dur = toast.duration ?? 4500;
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(toast.id), 300);
    }, dur);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md
        transition-all duration-300 w-80
        ${STYLES[toast.type]}
        ${visible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-8"}
      `}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${ICON_STYLES[toast.type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-light leading-tight">
          {toast.title}
        </p>
        <p className="text-xs text-accent-soft/70 mt-0.5 leading-snug">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-accent-soft/40 hover:text-text-light transition-colors mt-0.5 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}

      {/* Toast Stack — pojok kanan atas */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={remove} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
```

---

## ② Update `src/app/layout.tsx`

Tambahkan `<ToastProvider>` **di dalam** `<CoreProvider>`:

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { CoreProvider } from "@/context/CoreContext";
import { ToastProvider } from "@/components/ToastProvider";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title:       "C.O.R.E. — Clearance Optimization & Routing Engine",
  description: "Emergency Vehicle Traffic Clearance System — Huawei ICT Competition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-deep-space text-text-light font-body antialiased">
        <CoreProvider>
          <ToastProvider>
            <Navbar />
            <main className="pt-16 min-h-screen">
              {children}
            </main>
          </ToastProvider>
        </CoreProvider>
      </body>
    </html>
  );
}
```

---

## ③ `src/components/MockMap.tsx`

Peta mockup SVG + animasi — tanpa API key apapun.

```tsx
// src/components/MockMap.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useCore } from "@/context/CoreContext";
import { MapPin, Building2, Radio } from "lucide-react";

// ─── Titik-titik di peta (dalam %) ───────────────────────────────────────────

const HOSPITAL = { x: 50, y: 42, label: "RSUD Cipto" };

const INTERSECTIONS = [
  { x: 50, y: 42 },   // Pusat (RS)
  { x: 50, y: 20 },   // Utara
  { x: 50, y: 65 },   // Selatan
  { x: 25, y: 42 },   // Barat
  { x: 75, y: 42 },   // Timur
];

// Jalur utama (garis jalan)
const ROADS = [
  // Jalan Utara-Selatan
  { x1: 50, y1: 0, x2: 50, y2: 100 },
  // Jalan Barat-Timur
  { x1: 0, y1: 42, x2: 100, y2: 42 },
  // Diagonal kiri bawah
  { x1: 10, y1: 65, x2: 50, y2: 42 },
  // Diagonal kanan atas
  { x1: 50, y1: 42, x2: 85, y2: 20 },
];

// Lampu merah (posisi %)
const TRAFFIC_LIGHTS = [
  { x: 50, y: 28, label: "TL-N" },
  { x: 50, y: 56, label: "TL-S" },
  { x: 35, y: 42, label: "TL-W" },
  { x: 65, y: 42, label: "TL-E" },
];

// Ambulans mockup positions
const AMB_POSITIONS: Record<string, { x: number; y: number }> = {
  "amb-01": { x: 60, y: 55 },
  "amb-02": { x: 30, y: 35 },
  "amb-03": { x: 70, y: 25 },
};

// ─── Komponen ─────────────────────────────────────────────────────────────────

type TrafficState = "red" | "yellow" | "green";

export default function MockMap() {
  const { state } = useCore();
  const [lightState, setLightState] = useState<TrafficState>("red");
  const [tick, setTick] = useState(0);
  const cycleRef = useRef<NodeJS.Timeout | null>(null);

  // Siklus lampu merah otomatis
  useEffect(() => {
    const CYCLE: TrafficState[] = ["red", "yellow", "green", "green", "yellow"];
    let idx = 0;
    cycleRef.current = setInterval(() => {
      idx = (idx + 1) % CYCLE.length;
      setLightState(CYCLE[idx]);
      setTick((t) => t + 1);
    }, 2000);
    return () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
    };
  }, []);

  // Override lampu jika dispatch aktif
  const isDispatched = state.dispatchCode !== "IDLE";
  const effectiveLightState: TrafficState = isDispatched ? "green" : lightState;

  const lightColor = {
    red:    "#FF4C4C",
    yellow: "#FFC107",
    green:  "#00FF9C",
  }[effectiveLightState];

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl bg-[#060117]
                    border border-accent/15 select-none">

      {/* ── Grid layer (simulasi tile peta) ── */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#929BEC" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* ── SVG Layer utama (jalan + lampu + rute) ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Jalan utama */}
        {ROADS.map((r, i) => (
          <line
            key={i}
            x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="#1F027F"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}

        {/* Garis marka jalan (putus-putus) */}
        {ROADS.map((r, i) => (
          <line
            key={`mark-${i}`}
            x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="#929BEC"
            strokeWidth="0.3"
            strokeDasharray="2 3"
            opacity="0.4"
          />
        ))}

        {/* Rute aktif saat dispatch */}
        {isDispatched && (
          <line
            x1={AMB_POSITIONS[state.selectedAmbId ?? "amb-01"]?.x ?? 60}
            y1={AMB_POSITIONS[state.selectedAmbId ?? "amb-01"]?.y ?? 55}
            x2={HOSPITAL.x} y2={HOSPITAL.y}
            stroke={state.dispatchCode === "CODE_RED" ? "#FF4C4C" : "#FFC107"}
            strokeWidth="1.2"
            strokeDasharray="3 2"
            opacity="0.9"
          />
        )}

        {/* Radius geofence (animasi ring) */}
        {isDispatched && (
          <>
            <circle
              cx={HOSPITAL.x} cy={HOSPITAL.y}
              r={state.dispatchCode === "CODE_RED" ? 18 : 12}
              fill="none"
              stroke={state.dispatchCode === "CODE_RED" ? "#FF4C4C" : "#FFC107"}
              strokeWidth="0.4"
              strokeDasharray="3 2"
              opacity="0.5"
            />
            <circle
              cx={HOSPITAL.x} cy={HOSPITAL.y}
              r={state.dispatchCode === "CODE_RED" ? 18 : 12}
              fill={state.dispatchCode === "CODE_RED" ? "#FF4C4C" : "#FFC107"}
              opacity="0.04"
            />
          </>
        )}

        {/* Lampu lalu lintas */}
        {TRAFFIC_LIGHTS.map((tl) => (
          <g key={tl.label}>
            <circle
              cx={tl.x} cy={tl.y} r="1.6"
              fill={effectiveLightState === "green" && isDispatched
                ? (tl.label === "TL-N" ? "#00FF9C" : "#FF4C4C")
                : lightColor}
              style={{
                filter: `drop-shadow(0 0 3px ${lightColor})`,
                transition: "fill 0.3s, filter 0.3s",
              }}
            />
          </g>
        ))}

        {/* Persimpangan bulat */}
        {INTERSECTIONS.map((p, i) => (
          <circle
            key={i}
            cx={p.x} cy={p.y} r="1"
            fill="#929BEC"
            opacity="0.3"
          />
        ))}

        {/* Ikon Ambulans */}
        {state.ambulances.map((amb) => {
          const pos = AMB_POSITIONS[amb.id] ?? { x: 50, y: 50 };
          const isSelected = amb.id === state.selectedAmbId;
          const isActive = amb.status !== "IDLE";

          return (
            <g key={amb.id}>
              {/* Ping ring saat aktif */}
              {isActive && (
                <circle
                  cx={pos.x} cy={pos.y}
                  r="4"
                  fill="none"
                  stroke={amb.status === "CODE_RED" ? "#FF4C4C" : "#FFC107"}
                  strokeWidth="0.5"
                  opacity="0.6"
                />
              )}
              {/* Ikon ambulans (kotak putih kecil) */}
              <rect
                x={pos.x - 2.2} y={pos.y - 1.5}
                width="4.4" height="3"
                rx="0.6"
                fill={isSelected ? "#495AEE" : "#929BEC"}
                stroke={isActive ? (amb.status === "CODE_RED" ? "#FF4C4C" : "#FFC107") : "transparent"}
                strokeWidth="0.5"
                style={{ filter: isSelected ? "drop-shadow(0 0 3px #495AEE)" : "none" }}
              />
              {/* Palang merah */}
              <line x1={pos.x - 0.8} y1={pos.y} x2={pos.x + 0.8} y2={pos.y}
                    stroke="#FF4C4C" strokeWidth="0.6" />
              <line x1={pos.x} y1={pos.y - 0.8} x2={pos.x} y2={pos.y + 0.8}
                    stroke="#FF4C4C" strokeWidth="0.6" />
              {/* Label */}
              <text
                x={pos.x} y={pos.y + 4}
                fontSize="2.2" textAnchor="middle"
                fill="#DCE2F4" opacity="0.8"
                fontFamily="monospace"
              >
                {amb.callSign}
              </text>
            </g>
          );
        })}

        {/* Ikon Rumah Sakit */}
        <g>
          <circle
            cx={HOSPITAL.x} cy={HOSPITAL.y} r="4.5"
            fill="#1F027F"
            stroke="#495AEE"
            strokeWidth="0.6"
            style={{ filter: "drop-shadow(0 0 6px #495AEE88)" }}
          />
          {/* Simbol H */}
          <text
            x={HOSPITAL.x} y={HOSPITAL.y + 1.2}
            fontSize="4" textAnchor="middle"
            fill="#DCE2F4" fontWeight="bold"
            fontFamily="monospace"
          >
            H
          </text>
          <text
            x={HOSPITAL.x} y={HOSPITAL.y + 7}
            fontSize="2.2" textAnchor="middle"
            fill="#929BEC" opacity="0.9"
            fontFamily="monospace"
          >
            {HOSPITAL.label}
          </text>
        </g>
      </svg>

      {/* ── Overlay Label Sudut ── */}
      <div className="absolute top-3 left-3 font-mono text-[9px] text-accent-soft/50 space-y-0.5">
        <div>LAT  -6.2050° S</div>
        <div>LNG 106.8120° E</div>
        <div className="mt-1 text-accent/60">
          ZOOM 15 | {isDispatched ? "ROUTE ACTIVE" : "STANDBY"}
        </div>
      </div>

      {/* ── Compass ── */}
      <div className="absolute top-3 right-3 w-10 h-10 rounded-full border border-accent/20
                      bg-panel/60 backdrop-blur flex items-center justify-center">
        <div className="text-[9px] font-mono text-accent-soft/60 text-center leading-none">
          <div className="text-text-light/80">N</div>
          <div className="rotate-180">↑</div>
        </div>
      </div>

      {/* ── Lampu indicator bawah ── */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs font-mono">
        <span
          className="w-2.5 h-2.5 rounded-full transition-colors duration-500"
          style={{
            backgroundColor: lightColor,
            boxShadow: `0 0 8px ${lightColor}`,
          }}
        />
        <span className="text-accent-soft/70 text-[10px]">
          TRAFFIC {effectiveLightState.toUpperCase()}
          {isDispatched && " (C.O.R.E. OVERRIDE)"}
        </span>
      </div>

      {/* ── Peta Label ── */}
      <div className="absolute bottom-3 right-3 text-[9px] font-mono text-accent-soft/30">
        PETAL MAPS™ MOCK ENGINE v1.0
      </div>

      {/* ── Vignette sudut ── */}
      <div className="absolute inset-0 rounded-xl pointer-events-none"
           style={{
             background:
               "radial-gradient(ellipse at center, transparent 50%, #0B022799 100%)",
           }}
      />
    </div>
  );
}
```

---

## ④ `src/components/CommandCenter.tsx`

Komponen utama Mode 1 — layout sidebar + peta.

```tsx
// src/components/CommandCenter.tsx
"use client";

import React, { useState } from "react";
import {
  Ambulance, Radio, MapPin, Siren,
  AlertTriangle, CheckCircle2, Clock,
  ChevronRight, Zap, RotateCcw,
} from "lucide-react";
import { useCore, type Ambulance as AmbType, type DispatchCode } from "@/context/CoreContext";
import { useToast } from "@/components/ToastProvider";
import MockMap from "@/components/MockMap";

// ─── Helper: warna badge status ──────────────────────────────────────────────

function statusStyle(status: DispatchCode) {
  switch (status) {
    case "CODE_RED":    return "bg-alert-red/20 text-alert-red border-alert-red/30";
    case "CODE_YELLOW": return "bg-alert-yellow/20 text-alert-yellow border-alert-yellow/30";
    case "EN_ROUTE":    return "bg-neon-green/20 text-neon-green border-neon-green/30";
    case "ARRIVED":     return "bg-accent/20 text-accent border-accent/30";
    default:            return "bg-accent-soft/10 text-accent-soft/60 border-accent-soft/20";
  }
}

function statusLabel(status: DispatchCode) {
  switch (status) {
    case "CODE_RED":    return "⚡ CODE RED";
    case "CODE_YELLOW": return "⚠ CODE YELLOW";
    case "EN_ROUTE":    return "🚑 EN ROUTE";
    case "ARRIVED":     return "✓ TIBA";
    default:            return "STANDBY";
  }
}

// ─── Kartu Ambulans di Sidebar ────────────────────────────────────────────────

function AmbulanceCard({ amb }: { amb: AmbType }) {
  const { state, selectAmb } = useCore();
  const isSelected = state.selectedAmbId === amb.id;
  const isActive   = amb.status !== "IDLE";

  return (
    <button
      onClick={() => selectAmb(amb.id)}
      className={`
        w-full text-left p-3 rounded-lg border transition-all duration-200
        ${isSelected
          ? "bg-accent/15 border-accent/40 shadow-[0_0_15px_#495AEE22]"
          : "bg-panel/30 border-accent-soft/10 hover:bg-accent/5 hover:border-accent-soft/25"
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Icon ambulans */}
          <div className={`
            w-9 h-9 rounded-lg flex items-center justify-center shrink-0
            ${isActive
              ? (amb.status === "CODE_RED"
                  ? "bg-alert-red/15 border border-alert-red/30"
                  : "bg-alert-yellow/15 border border-alert-yellow/30")
              : "bg-accent/10 border border-accent/20"
            }
          `}>
            <Ambulance className={`w-4.5 h-4.5 ${
              isActive
                ? (amb.status === "CODE_RED" ? "text-alert-red" : "text-alert-yellow")
                : "text-accent"
            }`} />
          </div>

          <div>
            <div className="text-sm font-semibold text-text-light font-mono">
              {amb.callSign}
            </div>
            <div className="text-[10px] text-accent-soft/60 mt-0.5">
              {amb.location.lat.toFixed(4)}° S, {amb.location.lng.toFixed(4)}° E
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={`
            status-badge text-[9px] border
            ${statusStyle(amb.status)}
          `}>
            {statusLabel(amb.status)}
          </span>
          {isSelected && (
            <ChevronRight className="w-3 h-3 text-accent" />
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Panel Dispatch ────────────────────────────────────────────────────────────

function DispatchPanel() {
  const { state, triggerDispatch, resetDispatch } = useCore();
  const { addToast } = useToast();
  const [isDispatchingRed, setIsDispatchingRed] = useState(false);
  const [isDispatchingYellow, setIsDispatchingYellow] = useState(false);

  const selectedAmb = state.ambulances.find((a) => a.id === state.selectedAmbId);
  const hasSelection = !!selectedAmb;
  const isActive     = state.dispatchCode !== "IDLE";

  async function handleDispatch(code: "CODE_RED" | "CODE_YELLOW") {
    if (!hasSelection) {
      addToast({
        type:    "warning",
        title:   "Tidak Ada Ambulans Dipilih",
        message: "Pilih ambulans dari daftar armada terlebih dahulu.",
      });
      return;
    }

    const setter = code === "CODE_RED" ? setIsDispatchingRed : setIsDispatchingYellow;
    setter(true);

    // Simulasi delay komunikasi edge (UI feedback)
    await new Promise((r) => setTimeout(r, 600));

    triggerDispatch(state.selectedAmbId!, code);

    setter(false);

    if (code === "CODE_RED") {
      addToast({
        type:     "danger",
        title:    "🚨 DISPATCH CODE RED AKTIF",
        message:  `${selectedAmb!.callSign} dikirim. Radius geofence 1KM. C.O.R.E. mengambil alih lampu lalu lintas.`,
        duration: 6000,
      });
    } else {
      addToast({
        type:     "warning",
        title:    "⚠️ DISPATCH CODE YELLOW AKTIF",
        message:  `${selectedAmb!.callSign} dikirim. Radius geofence 700M. Prioritas medium.`,
        duration: 5000,
      });
    }
  }

  function handleReset() {
    resetDispatch();
    addToast({
      type:    "info",
      title:   "Dispatch Direset",
      message: "Semua unit kembali ke status STANDBY.",
    });
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-text-light">Panel Dispatch</h3>
      </div>

      {/* Info ambulans terpilih */}
      {selectedAmb ? (
        <div className="bg-accent/5 border border-accent/15 rounded-lg p-3">
          <div className="text-xs text-accent-soft/60 mb-1">Unit Terpilih:</div>
          <div className="font-mono font-bold text-text-light">{selectedAmb.callSign}</div>
          <div className="text-[10px] text-accent-soft/50 mt-0.5">
            Status saat ini: {statusLabel(selectedAmb.status)}
          </div>
        </div>
      ) : (
        <div className="bg-panel/30 border border-dashed border-accent-soft/20 rounded-lg p-3
                        text-center text-xs text-accent-soft/40">
          ← Pilih ambulans dari daftar
        </div>
      )}

      {/* Tombol Dispatch */}
      <div className="space-y-2">
        <button
          onClick={() => handleDispatch("CODE_RED")}
          disabled={isDispatchingRed || (isActive && state.dispatchCode !== "CODE_RED")}
          className={`
            w-full flex items-center justify-center gap-2.5
            font-semibold text-sm py-3 px-4 rounded-xl
            transition-all duration-200 active:scale-[0.98]
            ${isActive && state.dispatchCode === "CODE_RED"
              ? "bg-alert-red/20 border-2 border-alert-red text-alert-red cursor-default animate-pulse"
              : "bg-alert-red hover:bg-alert-red/85 text-white border-2 border-transparent"
            }
            shadow-[0_0_20px_#FF4C4C33] hover:shadow-[0_0_30px_#FF4C4C55]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          `}
        >
          <Siren className={`w-4 h-4 ${isDispatchingRed ? "animate-spin" : ""}`} />
          {isDispatchingRed
            ? "Mengirim sinyal..."
            : isActive && state.dispatchCode === "CODE_RED"
              ? "⚡ CODE RED — AKTIF"
              : "Dispatch Code Red  (Radius 1KM)"}
        </button>

        <button
          onClick={() => handleDispatch("CODE_YELLOW")}
          disabled={isDispatchingYellow || (isActive && state.dispatchCode !== "CODE_YELLOW")}
          className={`
            w-full flex items-center justify-center gap-2.5
            font-semibold text-sm py-3 px-4 rounded-xl
            transition-all duration-200 active:scale-[0.98]
            ${isActive && state.dispatchCode === "CODE_YELLOW"
              ? "bg-alert-yellow/20 border-2 border-alert-yellow text-alert-yellow cursor-default animate-pulse"
              : "bg-alert-yellow hover:bg-alert-yellow/85 text-deep-space border-2 border-transparent"
            }
            shadow-[0_0_20px_#FFC10722] hover:shadow-[0_0_30px_#FFC10744]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          `}
        >
          <AlertTriangle className={`w-4 h-4 ${isDispatchingYellow ? "animate-spin" : ""}`} />
          {isDispatchingYellow
            ? "Mengirim sinyal..."
            : isActive && state.dispatchCode === "CODE_YELLOW"
              ? "⚠ CODE YELLOW — AKTIF"
              : "Dispatch Code Yellow (Radius 700M)"}
        </button>
      </div>

      {/* Tombol Reset */}
      {isActive && (
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 text-xs
                     text-accent-soft/50 hover:text-text-light py-2 rounded-lg
                     border border-dashed border-accent-soft/20 hover:border-accent-soft/40
                     transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          Reset & Kembali Standby
        </button>
      )}
    </div>
  );
}

// ─── Metric cards kecil ────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass-card p-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                       ${accent ? "bg-accent/15" : "bg-panel/60"}`}>
        <Icon className={`w-4 h-4 ${accent ? "text-accent" : "text-accent-soft/60"}`} />
      </div>
      <div>
        <div className="text-[10px] text-accent-soft/50 leading-none">{label}</div>
        <div className="text-sm font-semibold text-text-light mt-0.5 font-mono">{value}</div>
      </div>
    </div>
  );
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────

export default function CommandCenter() {
  const { state } = useCore();

  const activeUnits  = state.ambulances.filter((a) => a.status !== "IDLE").length;
  const dispatchTime = state.dispatchCode !== "IDLE"
    ? new Date().toLocaleTimeString("id-ID", { hour12: false })
    : "--:--:--";

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ═══════════════════════════════
              SIDEBAR KIRI
      ═══════════════════════════════ */}
      <aside className="w-80 shrink-0 flex flex-col gap-3 p-4 overflow-y-auto
                        border-r border-accent/10 bg-deep-space/80 backdrop-blur">

        {/* Header sidebar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-text-light tracking-wider">
              ARMADA AKTIF
            </h2>
            <p className="text-[10px] text-accent-soft/50 mt-0.5">
              {state.ambulances.length} unit terdaftar · {activeUnits} aktif
            </p>
          </div>
          <div className={`
            w-2.5 h-2.5 rounded-full
            ${activeUnits > 0 ? "bg-alert-red animate-pulse" : "bg-neon-green"}
          `} />
        </div>

        {/* Metric mini */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard icon={Radio}        label="Unit Aktif"    value={`${activeUnits}/3`} accent />
          <MetricCard icon={Clock}        label="Dispatch"      value={dispatchTime} />
          <MetricCard icon={MapPin}       label="Radius C.O.R.E" value={
            state.dispatchCode === "CODE_RED" ? "1.0 KM" :
            state.dispatchCode === "CODE_YELLOW" ? "700 M" : "— M"
          } />
          <MetricCard icon={CheckCircle2} label="Simpang Terklear" value={
            state.dispatchCode !== "IDLE" ? "4/4" : "0/4"
          } accent={state.dispatchCode !== "IDLE"} />
        </div>

        {/* Daftar ambulans */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-accent-soft/40 tracking-widest uppercase px-1">
            Daftar Unit
          </div>
          {state.ambulances.map((amb) => (
            <AmbulanceCard key={amb.id} amb={amb} />
          ))}
        </div>

        {/* Panel Dispatch */}
        <DispatchPanel />

        {/* Legenda */}
        <div className="glass-card p-3 space-y-1.5">
          <div className="text-[10px] text-accent-soft/40 tracking-widest uppercase">Legenda</div>
          {[
            { color: "bg-alert-red",    label: "Code Red  — Prioritas Darurat" },
            { color: "bg-alert-yellow", label: "Code Yellow — Prioritas Medium" },
            { color: "bg-neon-green",   label: "En Route / C.O.R.E. Aktif" },
            { color: "bg-accent-soft",  label: "Standby / Tersedia" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 text-[10px] text-accent-soft/60">
              <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </aside>

      {/* ═══════════════════════════════
              AREA PETA KANAN
      ═══════════════════════════════ */}
      <main className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">

        {/* Header area peta */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="font-display text-sm font-bold text-text-light tracking-wider">
              PETA OPERASIONAL
            </span>
            <span className="text-[10px] font-mono text-accent-soft/50 ml-2">
              Jakarta Pusat — Coverage Area
            </span>
          </div>

          {/* Status bar dispatch */}
          {state.dispatchCode !== "IDLE" && (
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold
              animate-slide-in
              ${state.dispatchCode === "CODE_RED"
                ? "bg-alert-red/15 border-alert-red/40 text-alert-red"
                : "bg-alert-yellow/15 border-alert-yellow/40 text-alert-yellow"
              }
            `}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              C.O.R.E. ACTIVE —{" "}
              {state.ambulances.find((a) => a.id === state.selectedAmbId)?.callSign}
              {" "}→ RSUD Cipto
            </div>
          )}
        </div>

        {/* Peta Mockup — mengisi sisa ruang */}
        <div className="flex-1 min-h-0">
          <MockMap />
        </div>

        {/* Footer peta */}
        <div className="shrink-0 flex items-center justify-between text-[10px] font-mono
                        text-accent-soft/40 px-1">
          <span>Engine: Petal Maps Mock v1.0 | Proyeksi: Mercator</span>
          <span>Update: 1Hz GPS Telemetry Simulation</span>
        </div>
      </main>
    </div>
  );
}
```

---

## ⑤ Update `src/app/page.tsx`

Ganti placeholder `CommandCenterView` dengan import komponen nyata:

```tsx
// src/app/page.tsx
"use client";

import { useCore } from "@/context/CoreContext";
import CommandCenter from "@/components/CommandCenter";

// Placeholder untuk Mode 2 & 3 (akan dibuat di tahap berikutnya)
function DriverKioskView() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="glass-card p-10 text-center animate-slide-in">
        <div className="text-5xl mb-4">📱</div>
        <h1 className="font-display text-2xl text-text-light mb-2">Driver Kiosk</h1>
        <p className="text-accent-soft/70 text-sm">Layar Supir Ambulans — Zero-Friction UX</p>
        <div className="mt-4 text-xs text-accent-soft/40 font-mono">[ Tahap 3 akan mengisi view ini ]</div>
      </div>
    </div>
  );
}

function SimulationView() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="glass-card p-10 text-center animate-slide-in">
        <div className="text-5xl mb-4">🚦</div>
        <h1 className="font-display text-2xl text-text-light mb-2">Live 2D Simulation</h1>
        <p className="text-accent-soft/70 text-sm">Traffic Engine Canvas — C.O.R.E. AI Override</p>
        <div className="mt-4 text-xs text-accent-soft/40 font-mono">[ Tahap 4-6 akan mengisi view ini ]</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { state } = useCore();

  return (
    <>
      {state.activeMode === "command"    && <CommandCenter />}
      {state.activeMode === "driver"     && <DriverKioskView />}
      {state.activeMode === "simulation" && <SimulationView />}
    </>
  );
}
```

---

## ⑥ Pastikan `globals.css` punya class ini

Kalau belum ada di `globals.css`, tambahkan:

```css
/* Tambahkan di dalam @layer components { ... } */

/* Untuk Ambulance icon size */
.w-4\.5 { width: 1.125rem; }
.h-4\.5 { height: 1.125rem; }
```

---

## ✅ Verifikasi Tahap 2

Setelah save semua file, buka `http://localhost:3000`:

| Test | Expected |
|------|----------|
| Sidebar kiri terlihat dengan 3 kartu ambulans | ✅ |
| Klik kartu AMB-01 → kartu highlight biru | ✅ |
| Klik tombol **Code Red** tanpa pilih ambulans → toast warning muncul | ✅ |
| Klik tombol **Code Red** setelah pilih AMB-01 → toast merah muncul | ✅ |
| Peta mockup menampilkan jalan, lampu lalu lintas, ikon H RS | ✅ |
| Saat dispatch aktif → garis rute merah putus-putus muncul di peta | ✅ |
| Saat dispatch aktif → ring geofence animasi muncul di peta | ✅ |
| Tombol di navbar **Driver Kiosk** masih berfungsi pindah view | ✅ |

---

*Apakah Tahap 2 sudah berjalan dengan baik? Ketik **"Lanjut"** untuk menuju Tahap 3 — **Driver Kiosk**: layar supir yang bereaksi terhadap dispatch, flash alert, dan tombol "Mulai Perjalanan".*
