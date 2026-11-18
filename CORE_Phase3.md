# 📱 C.O.R.E. MVP — Tahap 3: Mode 2 — Driver Kiosk

> [!IMPORTANT]
> Tahap ini membuat **2 file baru** dan **mengupdate 1 file** (`page.tsx`).

---

## File yang dibuat di Tahap ini

```
src/
└── components/
    ├── DriverMockMap.tsx     ← Peta khusus driver: animasi ambulans bergerak
    └── DriverKiosk.tsx       ← Komponen utama Mode 2 (layar supir)
src/app/
    └── page.tsx              ← Update: import DriverKiosk
```

---

## ① `src/components/DriverMockMap.tsx`

Peta driver: fokus pada rute, visibilitas tinggi, ambulans bergerak.

```tsx
// src/components/DriverMockMap.tsx
"use client";

import React from "react";
import { type DispatchCode } from "@/context/CoreContext";

// Posisi dalam koordinat SVG viewBox 0-100
export type MapPoint = { x: number; y: number };

const HOSPITAL: MapPoint  = { x: 50, y: 42 };

// Jalur jalan utama (Utara-Selatan & Barat-Timur)
const ROADS = [
  { x1: 50, y1: 0,  x2: 50,  y2: 100 },
  { x1: 0,  y1: 42, x2: 100, y2: 42  },
  { x1: 10, y1: 65, x2: 50,  y2: 42  },
  { x1: 50, y1: 42, x2: 85,  y2: 20  },
];

// Lampu lalu lintas
const LIGHTS = [
  { x: 50, y: 28 },
  { x: 50, y: 56 },
  { x: 35, y: 42 },
  { x: 65, y: 42 },
];

type Props = {
  ambPos:       MapPoint;
  startPos:     MapPoint;
  progress:     number;       // 0.0 → 1.0
  dispatchCode: DispatchCode;
  journeyActive: boolean;
};

export default function DriverMockMap({
  ambPos,
  startPos,
  progress,
  dispatchCode,
  journeyActive,
}: Props) {
  const isCodeRed = dispatchCode === "CODE_RED";
  const routeColor = isCodeRed ? "#FF4C4C" : "#FFC107";
  const glowColor  = isCodeRed ? "#FF4C4C" : "#FFC107";

  // Hitung arah panah (heading) supir berdasarkan posisi ke hospital
  const dx = HOSPITAL.x - ambPos.x;
  const dy = HOSPITAL.y - ambPos.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div
      className="relative w-full h-full overflow-hidden rounded-2xl"
      style={{
        background: "radial-gradient(ellipse at center, #0D0330 0%, #060117 100%)",
        border: `1px solid ${routeColor}22`,
        boxShadow: `0 0 40px ${glowColor}11, inset 0 0 60px #00000066`,
      }}
    >
      {/* ── Grid Layer ── */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]">
        <defs>
          <pattern id="driver-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#929BEC" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#driver-grid)" />
      </svg>

      {/* ── SVG Peta ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Jalan - shadow gelap */}
        {ROADS.map((r, i) => (
          <line
            key={`road-shadow-${i}`}
            x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="#000" strokeWidth="6" strokeLinecap="round"
          />
        ))}
        {/* Jalan - aspal */}
        {ROADS.map((r, i) => (
          <line
            key={`road-${i}`}
            x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="#1A0A4A"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        ))}
        {/* Marka putus-putus */}
        {ROADS.map((r, i) => (
          <line
            key={`mark-${i}`}
            x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="#929BEC22"
            strokeWidth="0.3"
            strokeDasharray="2 3"
          />
        ))}

        {/* ── Rute aktif dari start → hospital ── */}
        <line
          x1={startPos.x} y1={startPos.y}
          x2={HOSPITAL.x} y2={HOSPITAL.y}
          stroke={routeColor}
          strokeWidth="0.8"
          strokeDasharray="2.5 1.5"
          opacity="0.3"
        />

        {/* Rute yang sudah dilalui (progress) */}
        {journeyActive && progress > 0 && (
          <line
            x1={startPos.x} y1={startPos.y}
            x2={ambPos.x}   y2={ambPos.y}
            stroke={routeColor}
            strokeWidth="1.2"
            opacity="0.9"
            style={{ filter: `drop-shadow(0 0 2px ${glowColor})` }}
          />
        )}

        {/* Rute sisa (ambulans → tujuan) */}
        {journeyActive && (
          <line
            x1={ambPos.x}   y1={ambPos.y}
            x2={HOSPITAL.x} y2={HOSPITAL.y}
            stroke={routeColor}
            strokeWidth="1.4"
            strokeDasharray="3 1.5"
            opacity="0.7"
            style={{ filter: `drop-shadow(0 0 3px ${glowColor})` }}
          />
        )}

        {/* Rute penuh saat dispatch belum mulai */}
        {!journeyActive && (
          <line
            x1={ambPos.x}   y1={ambPos.y}
            x2={HOSPITAL.x} y2={HOSPITAL.y}
            stroke={routeColor}
            strokeWidth="1.4"
            strokeDasharray="3 1.5"
            opacity="0.6"
            style={{ filter: `drop-shadow(0 0 3px ${glowColor})` }}
          />
        )}

        {/* ── Lampu Lalu Lintas ── */}
        {LIGHTS.map((tl, i) => (
          <circle
            key={i}
            cx={tl.x} cy={tl.y}
            r="1.5"
            fill="#00FF9C"
            opacity={journeyActive ? 1 : 0.4}
            style={{
              filter: journeyActive ? "drop-shadow(0 0 4px #00FF9C)" : "none",
              transition: "all 0.5s",
            }}
          />
        ))}

        {/* ── Ikon Rumah Sakit (Destinasi) ── */}
        <g>
          {/* Ring pulsing */}
          <circle cx={HOSPITAL.x} cy={HOSPITAL.y} r="7"
            fill="none" stroke={routeColor} strokeWidth="0.4"
            opacity="0.4" strokeDasharray="2 2" />
          <circle cx={HOSPITAL.x} cy={HOSPITAL.y} r="5"
            fill="#1F027F"
            stroke="#495AEE" strokeWidth="0.8"
            style={{ filter: "drop-shadow(0 0 6px #495AEE99)" }} />
          <text
            x={HOSPITAL.x} y={HOSPITAL.y + 1.5}
            fontSize="4.5" textAnchor="middle"
            fill="#DCE2F4" fontWeight="bold" fontFamily="monospace"
          >H</text>
          <text
            x={HOSPITAL.x} y={HOSPITAL.y + 9.5}
            fontSize="2" textAnchor="middle"
            fill="#929BEC" opacity="0.9" fontFamily="monospace"
          >RSUD Cipto</text>
        </g>

        {/* ── Ambulans (bergerak) ── */}
        <g style={{ transition: "all 0.9s cubic-bezier(0.4,0,0.2,1)" }}>
          {/* Aura luar */}
          <circle
            cx={ambPos.x} cy={ambPos.y} r="5.5"
            fill={routeColor} opacity="0.08"
          />
          {/* Ring tengah */}
          <circle
            cx={ambPos.x} cy={ambPos.y} r="3.5"
            fill="none" stroke={routeColor} strokeWidth="0.4"
            opacity={journeyActive ? 0.8 : 0.4}
          />
          {/* Badan ambulans */}
          <rect
            x={ambPos.x - 2.8} y={ambPos.y - 1.8}
            width="5.6" height="3.6"
            rx="0.8"
            fill={isCodeRed ? "#FF4C4C" : "#FFC107"}
            style={{
              filter: `drop-shadow(0 0 ${journeyActive ? "4" : "2"}px ${glowColor})`,
            }}
          />
          {/* Palang putih */}
          <line x1={ambPos.x - 1}  y1={ambPos.y}
                x2={ambPos.x + 1}  y2={ambPos.y}
                stroke="white" strokeWidth="0.9" strokeLinecap="round" />
          <line x1={ambPos.x} y1={ambPos.y - 1}
                x2={ambPos.x} y2={ambPos.y + 1}
                stroke="white" strokeWidth="0.9" strokeLinecap="round" />
        </g>

        {/* ── Titik asal (ghost) ── */}
        {journeyActive && progress > 0.05 && (
          <circle
            cx={startPos.x} cy={startPos.y} r="1"
            fill="#929BEC" opacity="0.3"
          />
        )}
      </svg>

      {/* ── Heading Arrow (overlay HTML) ── */}
      <div
        className="absolute top-4 right-4 w-12 h-12 rounded-full
                   border border-accent/30 bg-panel/70 backdrop-blur
                   flex items-center justify-center"
        style={{ transform: "none" }}
      >
        <div
          className="text-xl transition-transform duration-700"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          ➤
        </div>
      </div>

      {/* ── Progress bar bawah ── */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-panel/30">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width:      `${progress * 100}%`,
            background: `linear-gradient(90deg, ${routeColor}88, ${routeColor})`,
            boxShadow:  `0 0 8px ${glowColor}`,
          }}
        />
      </div>

      {/* ── Vignette ── */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, #060117cc 100%)",
        }}
      />
    </div>
  );
}
```

---

## ② `src/components/DriverKiosk.tsx`

Komponen utama layar supir — 3 state: Standby → Dispatched → En Route.

```tsx
// src/components/DriverKiosk.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Navigation, Siren, AlertTriangle,
  Play, CheckCircle, Radio, Wifi, Clock,
} from "lucide-react";
import { useCore, type DispatchCode } from "@/context/CoreContext";
import { useToast } from "@/components/ToastProvider";
import DriverMockMap, { type MapPoint } from "@/components/DriverMockMap";

// ─── Posisi awal ambulans di koordinat SVG (harus sama dengan MockMap) ────────
const AMB_START_POSITIONS: Record<string, MapPoint> = {
  "amb-01": { x: 60, y: 55 },
  "amb-02": { x: 30, y: 35 },
  "amb-03": { x: 70, y: 25 },
};
const HOSPITAL_POS: MapPoint = { x: 50, y: 42 };

// ─── Hitung jarak Euclidean antara 2 titik SVG ───────────────────────────────
function svgDistance(a: MapPoint, b: MapPoint) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// ─── Lerp antara dua titik ───────────────────────────────────────────────────
function lerp(a: MapPoint, b: MapPoint, t: number): MapPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

// ─── ETA formatter ───────────────────────────────────────────────────────────
function formatETA(remainingProgress: number, totalSecs: number): string {
  const secs = Math.round(remainingProgress * totalSecs);
  if (secs <= 0) return "TIBA";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}d`;
}

// ─── LAYAR STANDBY ────────────────────────────────────────────────────────────

function StandbyScreen() {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10
                    bg-deep-space select-none">

      {/* Logo ambulans besar */}
      <div className="relative">
        <div
          className="w-36 h-36 rounded-full flex items-center justify-center"
          style={{
            background:
              "radial-gradient(circle, #1F027F 0%, #0B022799 70%, transparent 100%)",
            boxShadow: "0 0 60px #495AEE22, 0 0 120px #495AEE11",
          }}
        >
          <Siren
            className="w-16 h-16 text-accent-soft/40"
            strokeWidth={1}
          />
        </div>
        {/* Ping rings */}
        <div className="absolute inset-0 rounded-full border border-accent/10 animate-ping"
             style={{ animationDuration: "2s" }} />
        <div className="absolute inset-[-12px] rounded-full border border-accent/5 animate-ping"
             style={{ animationDuration: "2.5s" }} />
      </div>

      {/* Teks standby */}
      <div className="text-center space-y-4 px-8">
        <div
          className={`font-display text-3xl font-bold tracking-widest transition-opacity duration-700 ${
            blink ? "opacity-100" : "opacity-30"
          }`}
          style={{ color: "#929BEC" }}
        >
          MENUNGGU INSTRUKSI
        </div>
        <div className="text-lg text-accent-soft/40 font-mono tracking-wider">
          Operator belum mengirim dispatch
        </div>
        <div className="text-sm text-accent-soft/25 font-mono">
          Layar akan otomatis berubah saat Code Red / Code Yellow diterima
        </div>
      </div>

      {/* Status bar bawah */}
      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2 text-sm text-neon-green font-mono">
          <Wifi className="w-4 h-4" />
          <span>EDGE TERHUBUNG</span>
        </div>
        <div className="w-px h-5 bg-accent-soft/20" />
        <div className="flex items-center gap-2 text-sm text-accent-soft/40 font-mono">
          <Radio className="w-4 h-4" />
          <span>MENDENGARKAN...</span>
        </div>
      </div>

      {/* Hint untuk demo */}
      <div className="absolute bottom-6 text-center">
        <div className="text-[11px] text-accent-soft/20 font-mono tracking-wider px-4">
          💡 Pindah ke tab Command Center → pilih ambulans → tekan Dispatch
        </div>
      </div>
    </div>
  );
}

// ─── BADGE KODE DISPATCH ──────────────────────────────────────────────────────

function DispatchBadge({ code }: { code: DispatchCode }) {
  const isRed = code === "CODE_RED" || code === "EN_ROUTE";
  return (
    <div
      className={`
        inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-display
        font-bold tracking-widest text-xl border-2
        ${code === "CODE_RED"    ? "bg-alert-red/20   border-alert-red   text-alert-red   shadow-[0_0_30px_#FF4C4C44]" :
          code === "CODE_YELLOW" ? "bg-alert-yellow/20 border-alert-yellow text-alert-yellow shadow-[0_0_30px_#FFC10744]" :
          code === "EN_ROUTE"    ? "bg-neon-green/20  border-neon-green  text-neon-green  shadow-[0_0_30px_#00FF9C44]" :
          code === "ARRIVED"     ? "bg-accent/20      border-accent      text-accent      shadow-[0_0_30px_#495AEE44]" :
          "bg-panel border-accent-soft/30 text-accent-soft"
        }
      `}
    >
      <span className={`w-3 h-3 rounded-full bg-current ${
        code !== "ARRIVED" ? "animate-pulse" : ""
      }`} />
      {code === "CODE_RED"    ? "⚡ CODE RED"       :
       code === "CODE_YELLOW" ? "⚠ CODE YELLOW"    :
       code === "EN_ROUTE"    ? "🚑 EN ROUTE"       :
       code === "ARRIVED"     ? "✓ TIBA DI TUJUAN" : "STANDBY"}
    </div>
  );
}

// ─── LAYAR TIBA ───────────────────────────────────────────────────────────────

function ArrivedScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 select-none">
      <div
        className="w-40 h-40 rounded-full flex items-center justify-center"
        style={{
          background: "radial-gradient(circle, #00FF9C22 0%, transparent 70%)",
          boxShadow:  "0 0 60px #00FF9C33",
        }}
      >
        <CheckCircle className="w-20 h-20 text-neon-green" strokeWidth={1.5} />
      </div>

      <div className="text-center space-y-3">
        <div className="font-display text-5xl font-bold text-neon-green tracking-widest">
          TIBA
        </div>
        <div className="text-2xl text-text-light/80 font-semibold">
          RSUD Cipto Mangunkusumo
        </div>
        <div className="text-accent-soft/60 font-mono text-sm">
          C.O.R.E. berhasil membersihkan jalur • Misi selesai
        </div>
      </div>

      <button
        onClick={onReset}
        className="mt-4 px-10 py-4 rounded-2xl bg-accent/15 border-2 border-accent/40
                   text-accent font-semibold text-lg tracking-wider
                   hover:bg-accent/25 transition-all active:scale-95"
      >
        Kembali ke Standby
      </button>
    </div>
  );
}

// ─── KOMPONEN UTAMA ────────────────────────────────────────────────────────────

export default function DriverKiosk() {
  const { state, startJourney, updateLocation, dispatch, resetDispatch } = useCore();
  const { addToast } = useToast();

  // Ambil ambulans yang sedang dipilih operator
  const selectedAmb = state.ambulances.find((a) => a.id === state.selectedAmbId);
  const ambId       = state.selectedAmbId ?? "amb-01";
  const startPos    = AMB_START_POSITIONS[ambId] ?? { x: 60, y: 55 };

  // ── State lokal animasi ──
  const [ambPos,   setAmbPos]   = useState<MapPoint>(startPos);
  const [progress, setProgress] = useState(0);       // 0 → 1
  const [flashActive, setFlashActive] = useState(false);  // efek flash saat dispatch masuk
  const [justDispatched, setJustDispatched] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevCodeRef = useRef<DispatchCode>("IDLE");

  const TOTAL_STEPS   = 45;   // ~45 detik untuk sampai
  const STEP_INTERVAL = 1000; // 1Hz telemetri

  // ── Reset posisi saat ambulans atau dispatch berubah ──
  useEffect(() => {
    setAmbPos(startPos);
    setProgress(0);
  }, [ambId, startPos]);

  // ── Flash alert saat dispatch baru masuk ──
  useEffect(() => {
    const prevCode = prevCodeRef.current;
    const curCode  = state.dispatchCode;

    if (prevCode === "IDLE" && (curCode === "CODE_RED" || curCode === "CODE_YELLOW")) {
      setFlashActive(true);
      setJustDispatched(true);
      setAmbPos(startPos);
      setProgress(0);

      // Matikan flash setelah 1.5 detik
      const t = setTimeout(() => setFlashActive(false), 1500);
      return () => clearTimeout(t);
    }

    // Reset animasi kalau dispatch direset
    if (curCode === "IDLE") {
      setJustDispatched(false);
      setProgress(0);
      setAmbPos(startPos);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    prevCodeRef.current = curCode;
  }, [state.dispatchCode, startPos]);

  // ── Cleanup interval saat unmount ──
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Handler: Mulai Perjalanan ─────────────────────────────────────────────
  const handleStartJourney = useCallback(() => {
    if (intervalRef.current) return; // Jangan start dua kali

    startJourney();

    addToast({
      type:    "success",
      title:   "🚑 Perjalanan Dimulai",
      message: `${selectedAmb?.callSign ?? "Ambulans"} dalam perjalanan. C.O.R.E. mengambil alih lampu.`,
      duration: 4000,
    });

    let step = 0;

    intervalRef.current = setInterval(() => {
      step += 1;
      const t = Math.min(step / TOTAL_STEPS, 1);
      setProgress(t);

      const newPos = lerp(startPos, HOSPITAL_POS, t);
      setAmbPos(newPos);

      // Update context dengan koordinat simulasi
      // (mapping dari SVG % ke lat/lng sederhana)
      const lat = -6.2050 + (HOSPITAL_POS.y - newPos.y) * 0.001;
      const lng = 106.812 + (newPos.x - startPos.x)     * 0.001;
      updateLocation(ambId, { lat, lng });

      // Ambulans tiba
      if (t >= 1) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        dispatch({ type: "ARRIVE" });

        addToast({
          type:     "success",
          title:    "✅ Ambulans Tiba",
          message:  "Misi selesai. Semua lampu kembali ke siklus normal.",
          duration: 6000,
        });
      }
    }, STEP_INTERVAL);
  }, [startJourney, updateLocation, addToast, ambId, startPos, selectedAmb]);

  // ── Handler: Reset ──────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
    setAmbPos(startPos);
    setJustDispatched(false);
    resetDispatch();
  }, [resetDispatch, startPos]);

  // ── Hitung ETA ─────────────────────────────────────────────────────────────
  const etaString   = formatETA(1 - progress, TOTAL_STEPS);
  const distanceKm  = ((1 - progress) * (state.dispatchCode === "CODE_RED" ? 1.0 : 0.7)).toFixed(2);

  // ════════════════════════════════════
  //   RENDER
  // ════════════════════════════════════

  const isIdle     = state.dispatchCode === "IDLE";
  const isArrived  = state.dispatchCode === "ARRIVED";
  const isEnRoute  = state.journeyActive;
  const isDispatch = !isIdle && !isArrived && !isEnRoute;

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-deep-space select-none">

      {/* ── Flash overlay saat dispatch masuk ── */}
      {flashActive && (
        <div
          className="absolute inset-0 z-50 pointer-events-none animate-pulse"
          style={{
            background:
              state.dispatchCode === "CODE_RED"
                ? "rgba(255,76,76,0.25)"
                : "rgba(255,193,7,0.2)",
          }}
        />
      )}

      {/* ══════════════ LAYAR STANDBY ══════════════ */}
      {isIdle && <StandbyScreen />}

      {/* ══════════════ LAYAR TIBA ══════════════ */}
      {isArrived && <ArrivedScreen onReset={handleReset} />}

      {/* ══════════════ LAYAR AKTIF (DISPATCH / EN ROUTE) ══════════════ */}
      {!isIdle && !isArrived && (
        <div className="flex flex-col h-full">

          {/* ── HEADER: Badge Kode + Info Unit ── */}
          <div
            className="shrink-0 flex items-center justify-between px-6 py-4
                       border-b border-accent/10 backdrop-blur"
            style={{
              background:
                state.dispatchCode === "CODE_RED"
                  ? "linear-gradient(135deg, #FF4C4C0A 0%, transparent 100%)"
                  : "linear-gradient(135deg, #FFC1070A 0%, transparent 100%)",
            }}
          >
            <DispatchBadge code={state.dispatchCode} />

            <div className="text-right font-mono">
              <div className="text-2xl font-bold text-text-light">
                {selectedAmb?.callSign ?? "AMB-??"}
              </div>
              <div className="text-xs text-accent-soft/50 mt-0.5">
                {selectedAmb?.location
                  ? `${selectedAmb.location.lat.toFixed(4)}°S`
                  : "Menunggu GPS..."}
              </div>
            </div>
          </div>

          {/* ── PETA (area tengah, fleksibel) ── */}
          <div className="flex-1 min-h-0 p-3">
            <DriverMockMap
              ambPos={ambPos}
              startPos={startPos}
              progress={progress}
              dispatchCode={state.dispatchCode}
              journeyActive={isEnRoute}
            />
          </div>

          {/* ── PANEL BAWAH: Navigasi & Tombol ── */}
          <div
            className="shrink-0 px-6 pb-6 pt-4 border-t border-accent/10 space-y-4"
            style={{ background: "linear-gradient(0deg, #0B0227 0%, transparent 100%)" }}
          >
            {/* Info navigasi — teks besar untuk supir */}
            <div className="grid grid-cols-3 gap-4 text-center">
              {/* Tujuan */}
              <div className="glass-card p-4">
                <div className="text-[11px] text-accent-soft/50 font-mono uppercase tracking-wider mb-1">
                  Tujuan
                </div>
                <div className="text-base font-bold text-text-light leading-tight">
                  RSUD Cipto
                </div>
                <div className="text-[10px] text-accent-soft/40 mt-1">
                  Jl. Diponegoro No.71
                </div>
              </div>

              {/* ETA */}
              <div
                className="glass-card p-4"
                style={{
                  borderColor:
                    state.dispatchCode === "CODE_RED" ? "#FF4C4C33" : "#FFC10733",
                }}
              >
                <div className="text-[11px] text-accent-soft/50 font-mono uppercase tracking-wider mb-1">
                  <Clock className="inline w-3 h-3 mr-1" />
                  ETA
                </div>
                <div
                  className="text-2xl font-bold font-mono"
                  style={{
                    color:
                      state.dispatchCode === "CODE_RED" ? "#FF4C4C" : "#FFC107",
                  }}
                >
                  {isEnRoute ? etaString : "--:--"}
                </div>
              </div>

              {/* Jarak */}
              <div className="glass-card p-4">
                <div className="text-[11px] text-accent-soft/50 font-mono uppercase tracking-wider mb-1">
                  Sisa Jarak
                </div>
                <div className="text-2xl font-bold text-text-light font-mono">
                  {isEnRoute ? `${distanceKm}` : (state.dispatchCode === "CODE_RED" ? "1.00" : "0.70")}
                  <span className="text-sm font-normal text-accent-soft/60 ml-1">KM</span>
                </div>
              </div>
            </div>

            {/* Status C.O.R.E. */}
            <div
              className="flex items-center justify-center gap-3 py-3 rounded-xl
                         border border-neon-green/20 bg-neon-green/5"
            >
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <span className="text-neon-green font-mono text-sm font-semibold">
                C.O.R.E. AKTIF — {isEnRoute ? "4/4 Simpang Terklear" : "Siap mengambil alih lampu"}
              </span>
            </div>

            {/* Tombol RAKSASA — hanya tampil saat dispatch tapi belum mulai */}
            {isDispatch && (
              <button
                onClick={handleStartJourney}
                className="w-full py-6 rounded-2xl font-display font-bold text-2xl
                           tracking-widest transition-all duration-200
                           active:scale-[0.98] flex items-center justify-center gap-4
                           animate-slide-in"
                style={{
                  background:
                    state.dispatchCode === "CODE_RED"
                      ? "linear-gradient(135deg, #FF4C4C, #CC0000)"
                      : "linear-gradient(135deg, #FFC107, #CC9900)",
                  color: state.dispatchCode === "CODE_RED" ? "white" : "#0B0227",
                  boxShadow:
                    state.dispatchCode === "CODE_RED"
                      ? "0 0 40px #FF4C4C55, 0 8px 32px #FF4C4C33"
                      : "0 0 40px #FFC10755, 0 8px 32px #FFC10733",
                }}
              >
                <Play className="w-8 h-8 fill-current" />
                MULAI PERJALANAN
              </button>
            )}

            {/* Status En Route */}
            {isEnRoute && (
              <div
                className="w-full py-5 rounded-2xl font-display font-bold text-xl
                           tracking-widest flex items-center justify-center gap-4
                           border-2 border-neon-green/40 text-neon-green bg-neon-green/5"
              >
                <Navigation className="w-6 h-6 animate-pulse" />
                DALAM PERJALANAN
                <span className="font-mono text-lg font-normal text-neon-green/70 ml-2">
                  {Math.round(progress * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## ③ Update `src/app/page.tsx`

Ganti placeholder `DriverKioskView` dengan import komponen nyata:

```tsx
// src/app/page.tsx
"use client";

import { useCore } from "@/context/CoreContext";
import CommandCenter from "@/components/CommandCenter";
import DriverKiosk   from "@/components/DriverKiosk";

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
      {state.activeMode === "driver"     && <DriverKiosk />}
      {state.activeMode === "simulation" && <SimulationView />}
    </>
  );
}
```

---

## ④ Tambahkan ke `tailwind.config.ts` (animasi flash)

Tambahkan keyframe baru di dalam `extend.keyframes`:

```ts
// Di dalam keyframes: { ... }
"flash-red": {
  "0%, 100%": { backgroundColor: "transparent" },
  "50%":      { backgroundColor: "#FF4C4C33" },
},
```

Dan di `extend.animation`:

```ts
"flash-red": "flash-red 0.4s ease-in-out 3",
```

---

## ✅ Alur Demo yang Harus Dicoba

```
1. Buka tab "Driver Kiosk"
   → Layar standby besar, teks berkedip "MENUNGGU INSTRUKSI"

2. Pindah ke tab "Command Center"
   → Pilih AMB-01 → Tekan "Dispatch Code Red"
   → Toast merah muncul

3. Langsung pindah ke tab "Driver Kiosk"
   → Layar FLASH merah sesaat
   → Badge "⚡ CODE RED" muncul di atas
   → Peta driver muncul dengan rute putus-putus
   → 3 kartu info: Tujuan / ETA / Jarak
   → Tombol raksasa "MULAI PERJALANAN" merah

4. Tekan "MULAI PERJALANAN"
   → Tombol berubah jadi bar "DALAM PERJALANAN X%"
   → Ikon ambulans di peta bergerak tiap 1 detik
   → Progress bar bawah peta mengisi
   → ETA countdown berjalan
   → Setelah ~45 detik → layar "TIBA ✓" muncul
```

---

## ✅ Verifikasi Tahap 3

| Test | Expected |
|------|----------|
| Buka Driver Kiosk tanpa dispatch | Layar standby teks berkedip ✅ |
| Dispatch dari Command Center → pindah ke Driver | Flash merah + badge CODE RED ✅ |
| Peta menampilkan rute putus-putus merah | ✅ |
| Tekan MULAI PERJALANAN | Tombol berubah, ambulans bergerak ✅ |
| Ambulans bergerak tiap ~1 detik | Smooth lerp animation ✅ |
| Lampu lalu lintas di peta jadi hijau semua | ✅ (C.O.R.E. override) |
| Setelah 45 detik → layar TIBA | ✅ |
| Tekan "Kembali ke Standby" → reset semua | ✅ |

---

*Apakah Tahap 3 sudah berjalan dengan baik? Ketik **"Lanjut"** untuk menuju Tahap 4+5+6 — **Mode 3: Live 2D Simulation** dengan HTML5 Canvas, NPC traffic, traffic lights, dan C.O.R.E. ambulance geofence override.*
