"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useCore } from "@/context/CoreContext";
import {
  MonitorDot,
  Tablet,
  Activity,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

type Mode = "command" | "driver" | "simulation";

const MODES: { id: Mode; label: string; Icon: React.ElementType }[] = [
  {
    id: "command",
    label: "Command Center",
    Icon: MonitorDot,
  },
  {
    id: "driver",
    label: "Driver Kiosk",
    Icon: Tablet,
  },
  {
    id: "simulation",
    label: "Live Simulation",
    Icon: Activity,
  },
];

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
    <span className="telemetry-num text-xs text-[#556578] hidden lg:block bg-[#EEF2F6] px-2.5 py-1 rounded-md border border-[#D8E0EA]">
      {time}
    </span>
  );
}

export default function Navbar() {
  const { state, setMode } = useCore();

  // Status kanan dibaca secara read-only langsung dari armada ambulans
  // Sinkron dengan unit yang sedang aktif di Driver Kiosk / Command Center
  const activeAmb = useMemo(() => {
    return (
      state.ambulances.find((a) => a.id === state.activeAmbulanceId && a.active) ||
      state.ambulances.find((a) => a.status === "EN_ROUTE" || a.status === "CODE_RED") ||
      state.ambulances.find((a) => a.status === "DISPATCHED_WAITING") ||
      state.ambulances.find((a) => a.status === "CODE_YELLOW") ||
      state.ambulances.find((a) => a.id === state.selectedAmbId) ||
      state.ambulances[0]
    );
  }, [state.ambulances, state.activeAmbulanceId, state.selectedAmbId]);

  const effectiveStatus = activeAmb ? activeAmb.status : state.dispatchCode;
  const isStandby = !activeAmb || effectiveStatus === "STANDBY" || effectiveStatus === "IDLE";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#D8E0EA] flex items-center justify-between px-5 shadow-xs select-none">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <img
          src="/image_36.png"
          alt="C.O.R.E. Logo"
          className="h-8 w-auto object-contain cursor-pointer"
        />
        <div className="border-l border-[#D8E0EA] pl-3 hidden sm:block">
          <div className="text-[11px] font-bold text-[#556578] tracking-wider uppercase leading-tight">
            City Optimized Rescue Edge
          </div>
          <div className="text-[9px] text-[#738396] font-mono leading-none mt-0.5">
            Clearance Optimization &amp; Routing Engine
          </div>
        </div>
      </div>

      {/* 3-Mode Segmented Tabs */}
      <div className="flex items-center bg-[#EEF2F6] p-0.5 rounded-lg border border-[#D8E0EA]/70">
        {MODES.map(({ id, label, Icon }) => {
          const isActive = state.activeMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`
                flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs transition-all duration-150 cursor-pointer
                ${
                  isActive
                    ? "bg-white text-[#072F5F] shadow-xs font-semibold"
                    : "text-[#556578] hover:text-[#0F172A] hover:bg-white/50 font-medium"
                }
              `}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#072F5F]" : "text-[#738396]"}`} />
              <span className="hidden md:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Telemetry Status Bar */}
      <div className="flex items-center gap-2.5">
        <StatusBadge
          status={effectiveStatus}
          prefix={!isStandby && activeAmb ? activeAmb.callSign : undefined}
          size="sm"
        />

        <div className="flex items-center gap-1.5 text-xs text-[#065F46] font-medium bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#0F766E]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E] shrink-0" />
          <span className="hidden sm:inline font-mono tracking-tight text-[11px]">EDGE ONLINE</span>
        </div>

        <LiveClock />
      </div>
    </nav>
  );
}
