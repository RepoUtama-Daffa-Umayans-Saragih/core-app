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
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${
        code === "CODE_RED"    ? "bg-alert-red animate-pulse" :
        code === "CODE_YELLOW" ? "bg-alert-yellow animate-pulse" :
        code === "EN_ROUTE"    ? "bg-neon-green animate-pulse" :
        code === "ARRIVED"     ? "bg-neon-green" :
        "bg-accent-soft/40"
      }`} />
      <span className={isActive ? "text-text-light font-semibold" : "text-accent-soft/60"}>
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
    <span className="font-mono text-xs text-accent-soft/80 hidden lg:block tabular-nums">
      {time}
    </span>
  );
}

export default function Navbar() {
  const { state, setMode } = useCore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16
                    bg-[#0B0227]/95 backdrop-blur-lg
                    border-b border-[#495AEE]/20
                    flex items-center justify-between px-6
                    shadow-[0_4px_30px_rgba(73,90,238,0.15)]">

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
      <div className="flex items-center gap-1 bg-[#1F027F]/40 p-1 rounded-xl border border-accent/20">
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
                  ? "bg-accent text-white shadow-[0_0_20px_rgba(73,90,238,0.5)]"
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
        <LiveClock />
      </div>
    </nav>
  );
}
