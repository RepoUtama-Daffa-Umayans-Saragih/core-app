# 🚨 C.O.R.E. MVP — Tahap 1: Project Init, UI Shell & State Management

> [!IMPORTANT]
> Eksekusi setiap blok kode secara berurutan. Jangan skip langkah.

---

## ① Inisiasi Project (Terminal)

```bash
# 1. Buat project Next.js dengan App Router
npx create-next-app@latest core-dashboard \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

# 2. Masuk ke folder project
cd core-dashboard

# 3. Install dependency tambahan (ikon & font)
npm install lucide-react
npm install @fontsource/orbitron @fontsource/inter

# 4. Jalankan dev server
npm run dev
```

> [!NOTE]
> Gunakan **TypeScript** agar autocomplete lebih baik, tapi semua kode di bawah bisa dipakai di `.js` juga — cukup hapus tipe datanya.

---

## ② `tailwind.config.ts` — Odyssey Palette

Ganti isi file `tailwind.config.ts` di root project dengan ini:

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "deep-space":   "#0B0227",   // Latar belakang utama
        "panel":        "#1F027F",   // Cards, sidebars
        "accent":       "#495AEE",   // Tombol aktif, rute
        "accent-soft":  "#929BEC",   // Hover, border, teks sekunder
        "text-light":   "#DCE2F4",   // Tipografi utama
        "alert-red":    "#FF4C4C",   // Code Red / darurat
        "alert-yellow": "#FFC107",   // Code Yellow
        "neon-green":   "#00FF9C",   // Lampu hijau simulasi
      },
      fontFamily: {
        display: ["Orbitron", "sans-serif"],
        body:    ["Inter", "sans-serif"],
      },
      animation: {
        "pulse-red":  "pulse-red 1s cubic-bezier(0.4,0,0.6,1) infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
        "slide-in":   "slideIn 0.3s ease-out",
      },
      keyframes: {
        "pulse-red": {
          "0%, 100%": { backgroundColor: "#FF4C4C33" },
          "50%":      { backgroundColor: "#FF4C4C99" },
        },
        glow: {
          from: { boxShadow: "0 0 10px #495AEE66" },
          to:   { boxShadow: "0 0 25px #495AEEBB, 0 0 50px #495AEE44" },
        },
        slideIn: {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## ③ `src/app/globals.css`

```css
/* src/app/globals.css */
@import "@fontsource/orbitron/400.css";
@import "@fontsource/orbitron/700.css";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/600.css";

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body {
    @apply bg-deep-space text-text-light font-body;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Scrollbar custom agar sesuai tema */
  ::-webkit-scrollbar       { width: 6px; }
  ::-webkit-scrollbar-track { background: #0B0227; }
  ::-webkit-scrollbar-thumb { background: #495AEE; border-radius: 3px; }
}

@layer components {
  /* Kartu glass morphism */
  .glass-card {
    @apply bg-panel/60 backdrop-blur-md border border-accent-soft/20 rounded-xl;
  }

  /* Badge status */
  .status-badge {
    @apply px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase;
  }

  /* Tombol utama */
  .btn-primary {
    @apply bg-accent hover:bg-accent/80 text-white font-semibold
           px-5 py-2.5 rounded-lg transition-all duration-200
           shadow-[0_0_15px_#495AEE55] hover:shadow-[0_0_25px_#495AEEBB]
           active:scale-95;
  }

  .btn-danger {
    @apply bg-alert-red hover:bg-alert-red/80 text-white font-semibold
           px-5 py-2.5 rounded-lg transition-all duration-200
           shadow-[0_0_15px_#FF4C4C55] hover:shadow-[0_0_25px_#FF4C4CBB]
           active:scale-95;
  }

  .btn-warning {
    @apply bg-alert-yellow hover:bg-alert-yellow/80 text-deep-space font-semibold
           px-5 py-2.5 rounded-lg transition-all duration-200
           active:scale-95;
  }
}
```

---

## ④ State Management — `src/context/CoreContext.tsx`

Buat folder `src/context/` lalu buat file berikut:

```tsx
// src/context/CoreContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";

// ─── Tipe Data ────────────────────────────────────────────────────────────────

export type DispatchCode = "IDLE" | "CODE_RED" | "CODE_YELLOW" | "EN_ROUTE" | "ARRIVED";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Ambulance = {
  id:       string;
  callSign: string;        // Contoh: "AMB-01"
  status:   DispatchCode;
  location: Coordinates;   // Posisi real-time (simulasi)
  target:   Coordinates | null;  // Tujuan yang di-set operator
  radiusKm: number;        // 1.0 = Code Red, 0.7 = Code Yellow
};

export type CoreState = {
  activeMode:    "command" | "driver" | "simulation";
  ambulances:    Ambulance[];
  selectedAmbId: string | null;   // Ambulans yang dipilih operator
  dispatchCode:  DispatchCode;
  journeyActive: boolean;         // Driver sudah tekan "Mulai Perjalanan"
  simulationRunning: boolean;     // Mode 3 canvas berjalan
};

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_AMBULANCES: Ambulance[] = [
  {
    id: "amb-01", callSign: "AMB-01", status: "IDLE",
    location: { lat: -6.2000, lng: 106.8166 },
    target: null, radiusKm: 1.0,
  },
  {
    id: "amb-02", callSign: "AMB-02", status: "IDLE",
    location: { lat: -6.1950, lng: 106.8200 },
    target: null, radiusKm: 1.0,
  },
  {
    id: "amb-03", callSign: "AMB-03", status: "IDLE",
    location: { lat: -6.2050, lng: 106.8120 },
    target: null, radiusKm: 0.7,
  },
];

const initialState: CoreState = {
  activeMode:        "command",
  ambulances:        INITIAL_AMBULANCES,
  selectedAmbId:     null,
  dispatchCode:      "IDLE",
  journeyActive:     false,
  simulationRunning: false,
};

// ─── Action Types ─────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_MODE";           payload: CoreState["activeMode"] }
  | { type: "SELECT_AMBULANCE";   payload: string }
  | { type: "SET_TARGET";         payload: { ambId: string; coords: Coordinates } }
  | { type: "DISPATCH";           payload: { ambId: string; code: "CODE_RED" | "CODE_YELLOW" } }
  | { type: "START_JOURNEY" }
  | { type: "UPDATE_LOCATION";    payload: { ambId: string; coords: Coordinates } }
  | { type: "ARRIVE" }
  | { type: "TOGGLE_SIMULATION";  payload: boolean }
  | { type: "RESET_DISPATCH" };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function coreReducer(state: CoreState, action: Action): CoreState {
  switch (action.type) {

    case "SET_MODE":
      return { ...state, activeMode: action.payload };

    case "SELECT_AMBULANCE":
      return { ...state, selectedAmbId: action.payload };

    case "SET_TARGET":
      return {
        ...state,
        ambulances: state.ambulances.map((a) =>
          a.id === action.payload.ambId
            ? { ...a, target: action.payload.coords }
            : a
        ),
      };

    case "DISPATCH": {
      const { ambId, code } = action.payload;
      const radiusKm = code === "CODE_RED" ? 1.0 : 0.7;
      return {
        ...state,
        dispatchCode: code,
        ambulances: state.ambulances.map((a) =>
          a.id === ambId
            ? { ...a, status: code, radiusKm }
            : a
        ),
      };
    }

    case "START_JOURNEY":
      return { ...state, journeyActive: true, dispatchCode: "EN_ROUTE" };

    case "UPDATE_LOCATION":
      return {
        ...state,
        ambulances: state.ambulances.map((a) =>
          a.id === action.payload.ambId
            ? { ...a, location: action.payload.coords }
            : a
        ),
      };

    case "ARRIVE":
      return {
        ...state,
        journeyActive: false,
        dispatchCode:  "ARRIVED",
        ambulances: state.ambulances.map((a) =>
          a.id === state.selectedAmbId
            ? { ...a, status: "ARRIVED", target: null }
            : a
        ),
      };

    case "TOGGLE_SIMULATION":
      return { ...state, simulationRunning: action.payload };

    case "RESET_DISPATCH":
      return {
        ...state,
        dispatchCode:  "IDLE",
        journeyActive: false,
        ambulances: state.ambulances.map((a) => ({ ...a, status: "IDLE", target: null })),
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type CoreContextValue = {
  state:    CoreState;
  dispatch: React.Dispatch<Action>;
  // Helper actions (sugar coat agar komponen tidak nulis action manual)
  setMode:         (mode: CoreState["activeMode"]) => void;
  selectAmb:       (id: string) => void;
  setTarget:       (ambId: string, coords: Coordinates) => void;
  triggerDispatch: (ambId: string, code: "CODE_RED" | "CODE_YELLOW") => void;
  startJourney:    () => void;
  updateLocation:  (ambId: string, coords: Coordinates) => void;
  resetDispatch:   () => void;
};

const CoreContext = createContext<CoreContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(coreReducer, initialState);

  const setMode         = useCallback((mode: CoreState["activeMode"]) =>
    dispatch({ type: "SET_MODE", payload: mode }), []);

  const selectAmb       = useCallback((id: string) =>
    dispatch({ type: "SELECT_AMBULANCE", payload: id }), []);

  const setTarget       = useCallback((ambId: string, coords: Coordinates) =>
    dispatch({ type: "SET_TARGET", payload: { ambId, coords } }), []);

  const triggerDispatch = useCallback((ambId: string, code: "CODE_RED" | "CODE_YELLOW") =>
    dispatch({ type: "DISPATCH", payload: { ambId, code } }), []);

  const startJourney    = useCallback(() =>
    dispatch({ type: "START_JOURNEY" }), []);

  const updateLocation  = useCallback((ambId: string, coords: Coordinates) =>
    dispatch({ type: "UPDATE_LOCATION", payload: { ambId, coords } }), []);

  const resetDispatch   = useCallback(() =>
    dispatch({ type: "RESET_DISPATCH" }), []);

  return (
    <CoreContext.Provider value={{
      state, dispatch,
      setMode, selectAmb, setTarget,
      triggerDispatch, startJourney,
      updateLocation, resetDispatch,
    }}>
      {children}
    </CoreContext.Provider>
  );
}

// ─── Custom Hook ──────────────────────────────────────────────────────────────

export function useCore() {
  const ctx = useContext(CoreContext);
  if (!ctx) throw new Error("useCore must be used inside <CoreProvider>");
  return ctx;
}
```

---

## ⑤ Navbar Component — `src/components/Navbar.tsx`

Buat folder `src/components/` lalu buat file ini:

```tsx
// src/components/Navbar.tsx
"use client";

import { useCore } from "@/context/CoreContext";
import {
  MonitorDot,
  Tablet,
  Activity,
  Siren,
  Wifi,
} from "lucide-react";

type Mode = "command" | "driver" | "simulation";

const MODES: { id: Mode; label: string; sublabel: string; Icon: React.ElementType }[] = [
  {
    id:       "command",
    label:    "Command Center",
    sublabel: "Operator RS",
    Icon:     MonitorDot,
  },
  {
    id:       "driver",
    label:    "Driver Kiosk",
    sublabel: "Layar Supir",
    Icon:     Tablet,
  },
  {
    id:       "simulation",
    label:    "Live Simulation",
    sublabel: "Traffic Engine",
    Icon:     Activity,
  },
];

function StatusPulse({ code }: { code: string }) {
  const isActive = code !== "IDLE";
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${
        code === "CODE_RED"    ? "bg-alert-red animate-pulse" :
        code === "CODE_YELLOW" ? "bg-alert-yellow animate-pulse" :
        code === "EN_ROUTE"    ? "bg-neon-green animate-pulse" :
        code === "ARRIVED"     ? "bg-neon-green" :
        "bg-accent-soft/40"
      }`} />
      <span className={isActive ? "text-text-light" : "text-accent-soft/60"}>
        {code === "IDLE"         ? "STANDBY"       :
         code === "CODE_RED"     ? "⚡ CODE RED"    :
         code === "CODE_YELLOW"  ? "⚠ CODE YELLOW" :
         code === "EN_ROUTE"     ? "🚑 EN ROUTE"   :
         "✓ ARRIVED"}
      </span>
    </span>
  );
}

export default function Navbar() {
  const { state, setMode } = useCore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16
                    bg-deep-space/95 backdrop-blur-lg
                    border-b border-accent/20
                    flex items-center justify-between px-6
                    shadow-[0_4px_30px_#495AEE22]">

      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-3 select-none">
        <div className="relative">
          <Siren className="w-7 h-7 text-accent" strokeWidth={1.5} />
          {state.dispatchCode !== "IDLE" && (
            <span className="absolute -top-1 -right-1 w-3 h-3
                             bg-alert-red rounded-full animate-pulse" />
          )}
        </div>
        <div>
          <div className="font-display font-bold text-sm tracking-[0.15em] text-text-light leading-none">
            C.O.R.E.
          </div>
          <div className="text-[9px] tracking-widest text-accent-soft/70 leading-none mt-0.5">
            CLEARANCE OPTIMIZATION & ROUTING ENGINE
          </div>
        </div>
      </div>

      {/* ── Mode Tabs ── */}
      <div className="flex items-center gap-1 bg-panel/50 p-1 rounded-xl border border-accent/10">
        {MODES.map(({ id, label, sublabel, Icon }) => {
          const isActive = state.activeMode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`
                flex items-center gap-2.5 px-4 py-2 rounded-lg
                transition-all duration-300 cursor-pointer
                ${isActive
                  ? "bg-accent text-white shadow-[0_0_20px_#495AEE66]"
                  : "text-accent-soft/70 hover:text-text-light hover:bg-accent/10"
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold leading-none">{label}</div>
                <div className={`text-[9px] leading-none mt-0.5 ${
                  isActive ? "text-blue-200" : "text-accent-soft/50"
                }`}>{sublabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Status Bar ── */}
      <div className="flex items-center gap-4">
        <StatusPulse code={state.dispatchCode} />
        <div className="flex items-center gap-1.5 text-xs text-neon-green">
          <Wifi className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono">EDGE ONLINE</span>
        </div>
        {/* Clock */}
        <LiveClock />
      </div>
    </nav>
  );
}

// Jam real-time di navbar
function LiveClock() {
  const [time, setTime] = React.useState("");

  React.useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString("id-ID", { hour12: false }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs text-accent-soft/80 hidden lg:block tabular-nums">
      {time}
    </span>
  );
}
```

> [!NOTE]
> `React` dipakai di `LiveClock` — tambahkan `import React, { useState, useEffect } from "react"` di baris pertama file `Navbar.tsx`, atau cukup tambahkan: `import React from "react";`

---

## ⑥ Root Layout — `src/app/layout.tsx`

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { CoreProvider } from "@/context/CoreContext";
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
          <Navbar />
          {/* Offset konten agar tidak ketutup Navbar fixed */}
          <main className="pt-16 min-h-screen">
            {children}
          </main>
        </CoreProvider>
      </body>
    </html>
  );
}
```

---

## ⑦ Halaman Utama — `src/app/page.tsx`

Halaman ini bertugas sebagai **router** yang me-render view sesuai `activeMode`:

```tsx
// src/app/page.tsx
"use client";

import { useCore } from "@/context/CoreContext";

// Placeholder views — akan diganti di Tahap berikutnya
function CommandCenterView() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="glass-card p-10 text-center animate-slide-in">
        <div className="text-5xl mb-4">🖥️</div>
        <h1 className="font-display text-2xl text-text-light mb-2">Command Center</h1>
        <p className="text-accent-soft/70 text-sm">Operator Rumah Sakit — Mode Peta & Dispatch</p>
        <div className="mt-4 text-xs text-accent-soft/40 font-mono">[ Tahap 3 akan mengisi view ini ]</div>
      </div>
    </div>
  );
}

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
        <div className="mt-4 text-xs text-accent-soft/40 font-mono">[ Tahap 4 akan mengisi view ini ]</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { state } = useCore();

  return (
    <>
      {state.activeMode === "command"    && <CommandCenterView />}
      {state.activeMode === "driver"     && <DriverKioskView />}
      {state.activeMode === "simulation" && <SimulationView />}
    </>
  );
}
```

---

## ⑧ Struktur File Akhir Tahap 1

```
core-dashboard/
├── src/
│   ├── app/
│   │   ├── globals.css        ✅ Tailwind + Odyssey utilities
│   │   ├── layout.tsx         ✅ Root layout + CoreProvider + Navbar
│   │   └── page.tsx           ✅ Router view berdasarkan activeMode
│   ├── components/
│   │   └── Navbar.tsx         ✅ Navbar 3-mode + StatusPulse + LiveClock
│   └── context/
│       └── CoreContext.tsx    ✅ State global (ambulances, dispatch, mode)
├── tailwind.config.ts         ✅ Odyssey Palette lengkap
└── package.json
```

---

## ✅ Verifikasi Tahap 1

Setelah `npm run dev`, buka `http://localhost:3000`. Anda harus melihat:

- [x] Background gelap **#0B0227** (Deep Space)
- [x] Navbar fixed dengan logo **C.O.R.E.** dan ikon Siren
- [x] 3 tombol tab: **Command Center / Driver Kiosk / Live Simulation**
- [x] Klik setiap tab → konten berubah dengan animasi `slide-in`
- [x] Status **STANDBY** di kanan navbar, jam real-time berjalan
- [x] Indikator **EDGE ONLINE** berwarna hijau

---

*Apakah Tahap 1 sudah berjalan dengan baik? Ketik **"Lanjut"** untuk menuju Tahap 2 (Mode 1 — Command Center: Layout peta, daftar ambulans, dan tombol Dispatch).*
