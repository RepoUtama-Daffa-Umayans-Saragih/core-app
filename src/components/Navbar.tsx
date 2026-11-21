"use client";

import React, { useState, useEffect } from "react";
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
    <span className="flex items-center gap-1.5 text-xs bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60 font-medium">
      <span className={`w-2 h-2 rounded-full ${
        code === "CODE_RED"    ? "bg-red-500 animate-pulse" :
        code === "CODE_YELLOW" ? "bg-amber-500 animate-pulse" :
        code === "EN_ROUTE"    ? "bg-emerald-500 animate-pulse" :
        code === "ARRIVED"     ? "bg-blue-500" :
        "bg-slate-400"
      }`} />
      <span className={isActive ? "text-slate-900 font-semibold" : "text-slate-500"}>
        {code === "IDLE"         ? "STANDBY"       :
         code === "CODE_RED"     ? "⚡ CODE RED"    :
         code === "CODE_YELLOW"  ? "⚠ CODE YELLOW" :
         code === "EN_ROUTE"     ? "🚑 EN ROUTE"   :
         "✓ ARRIVED"}
      </span>
    </span>
  );
}

function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString("id-ID", { hour12: false }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs text-slate-500 hidden lg:block tabular-nums bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
      {time}
    </span>
  );
}

export default function Navbar() {
  const { state, setMode } = useCore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16
                    bg-white/85 backdrop-blur-md
                    border-b border-slate-200/60
                    flex items-center justify-between px-6
                    shadow-xs">

      {/* Brand & Logo */}
      <div className="flex items-center gap-4 select-none">
        <div className="relative flex items-center shrink-0">
          <img
            src="/image_36.png"
            alt="C.O.R.E. Logo"
            className="h-10 w-auto object-contain cursor-pointer"
          />
          {state.dispatchCode !== "IDLE" && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping border-2 border-white" />
          )}
        </div>

        <div className="border-l-2 border-slate-200 pl-4 hidden sm:block">
          <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest leading-tight max-w-[200px]">
            CLEARANCE OPTIMIZATION &amp; ROUTING ENGINE
          </div>
        </div>
      </div>

      {/* 3-Mode Segmented Tabs */}
      <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
        {MODES.map(({ id, label, sublabel, Icon }) => {
          const isActive = state.activeMode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`
                flex items-center gap-2.5 px-4 py-1.5 rounded-lg
                transition-all duration-200 cursor-pointer
                ${isActive
                  ? "bg-white text-blue-600 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.2 : 1.7} />
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold leading-tight">{label}</div>
                <div className={`text-[10px] leading-none mt-0.5 ${
                  isActive ? "text-blue-500" : "text-slate-400"
                }`}>{sublabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Telemetry Status Bar */}
      <div className="flex items-center gap-3">
        <StatusPulse code={state.dispatchCode} />
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline font-mono">EDGE ONLINE</span>
        </div>
        <LiveClock />
      </div>
    </nav>
  );
}
