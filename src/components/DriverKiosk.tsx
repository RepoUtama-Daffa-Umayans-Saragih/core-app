"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Navigation,
  Play,
  CheckCircle,
  Radio,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCore, type DispatchCode } from "@/context/CoreContext";
import { useToast } from "@/components/ToastProvider";
import DriverMockMap, { type MapPoint, type HUDUpdateData } from "@/components/DriverMockMap";
import { AMBULANCE_ROUTES_POOL } from "@/utils/AmbulanceRoutesPool";
import * as turf from "@turf/turf";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusBadge from "@/components/ui/StatusBadge";

function ContextualStatusChip({ status }: { status: DispatchCode | undefined }) {
  if (status === "DISPATCHED_WAITING") {
    return (
      <div className="pointer-events-auto flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border border-[#B45309]/30 bg-[#FEF3C7] text-[#92400E] shadow-sm text-[11px] md:text-xs font-semibold animate-pulse">
        <span className="w-2 h-2 rounded-full bg-[#B45309]" />
        <span>Menunggu Konfirmasi</span>
      </div>
    );
  }

  if (status === "EN_ROUTE" || status === "CODE_RED" || status === "CODE_YELLOW") {
    return (
      <div className="pointer-events-auto flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full bg-[#0F766E] text-white shadow-sm text-[11px] md:text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>Green Wave Aktif</span>
      </div>
    );
  }

  if (status === "ARRIVED") {
    return (
      <div className="pointer-events-auto flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border border-[#0F766E]/30 bg-[#ECFDF5] text-[#065F46] shadow-sm text-[11px] md:text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-[#0F766E]" />
        <span>Tiba di Tujuan</span>
      </div>
    );
  }

  // Default: STANDBY / IDLE
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border border-[#D8E0EA] bg-white/90 text-[#334155] shadow-sm text-[11px] md:text-xs font-semibold">
      <span className="w-2 h-2 rounded-full bg-[#738396]" />
      <span>Siaga di Pangkalan</span>
    </div>
  );
}

export default function DriverKiosk() {
  const {
    state,
    setActiveAmbulanceId,
    selectAmb,
    resetDispatch,
    startJourney,
  } = useCore();
  const { addToast } = useToast();

  // 1. Cari ambulans yang sedang disorot POV
  const activeAmb = useMemo(() => {
    return (
      state.ambulances.find((a) => a.id === state.activeAmbulanceId) ||
      state.ambulances.find((a) => a.id === state.selectedAmbId) ||
      state.ambulances[0]
    );
  }, [state.ambulances, state.activeAmbulanceId, state.selectedAmbId]);

  // Ambil rute bawaan dari pool
  const poolRoute = useMemo(() => {
    if (!activeAmb) return AMBULANCE_ROUTES_POOL[0];
    return (
      AMBULANCE_ROUTES_POOL.find(
        (r) =>
          r.callSign.toLowerCase() === activeAmb.callSign.toLowerCase() ||
          r.id === activeAmb.id
      ) || AMBULANCE_ROUTES_POOL[0]
    );
  }, [activeAmb]);

  const startPos: MapPoint = useMemo(() => {
    return poolRoute.startCoords || { lat: -6.2115, lng: 106.8621 };
  }, [poolRoute]);

  const routeTotalKm = useMemo(() => {
    const routeLine = turf.feature(poolRoute.geometry);
    return turf.length(routeLine, { units: "kilometers" }) || 2.45;
  }, [poolRoute]);

  // State terpisah untuk UI Text yang di-throttle (1 detik sekali) dari WebGL Loop
  const [hud, setHUD] = useState<HUDUpdateData>({
    eta: "--:--",
    distanceKm: "--",
    speedKmh: 0,
    progress: activeAmb?.progress ?? 0,
  });

  // Toggle model visual marker: 'ambulance' atau 'arrow' (default 'arrow')
  const [markerModel, setMarkerModel] = useState<"ambulance" | "arrow">("arrow");

  // State lipat POV HUD (default terbuka)
  const [isPovCollapsed, setIsPovCollapsed] = useState(false);

  const handleHUDUpdate = useCallback((data: HUDUpdateData) => {
    setHUD(data);
  }, []);

  const handleReset = useCallback(() => {
    setHUD({
      eta: "--:--",
      distanceKm: "--",
      speedKmh: 0,
      progress: 0,
    });
    resetDispatch();
  }, [resetDispatch]);

  const isStandby = !activeAmb || activeAmb.status === "STANDBY" || activeAmb.status === "IDLE";
  const isDispatchedWaiting = activeAmb?.status === "DISPATCHED_WAITING";
  const isEnRoute = activeAmb?.status === "EN_ROUTE" || activeAmb?.status === "CODE_RED" || activeAmb?.status === "CODE_YELLOW";
  const isArrived = activeAmb?.status === "ARRIVED";

  const etaDisplay = isStandby
    ? "--:--"
    : isDispatchedWaiting
    ? "Siap"
    : isArrived
    ? "Tiba"
    : hud.eta;

  const distanceDisplay = isStandby
    ? "-- KM"
    : isDispatchedWaiting
    ? `${routeTotalKm.toFixed(2)} KM`
    : isArrived
    ? "0.00 KM"
    : `${hud.distanceKm} KM`;

  const progressPercent = isStandby || isDispatchedWaiting
    ? 0
    : isArrived
    ? 100
    : Math.round(hud.progress * 100);

  return (
    <div className="relative h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[#F4F6F8] flex flex-col font-sans select-none">
      {/* ── AREA PETA FULL-BLEED ── */}
      <div className="relative flex-1 w-full min-h-0">

        {/* ── OVERLAY KIRI ATAS: FLEET POV SWITCHER (CARD KACA / CHIP) ── */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          {isPovCollapsed ? (
            <button
              type="button"
              onClick={() => setIsPovCollapsed(false)}
              className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-md border border-[#D8E0EA] rounded-lg shadow-sm text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-all cursor-pointer"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeAmb?.color || "#0B5D7A" }}
              />
              <span>POV: {activeAmb?.callSign ?? "AMB-01"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#556578]" />
            </button>
          ) : (
            <div className="pointer-events-auto w-[calc(100vw-1.5rem)] sm:w-[252px] max-w-[252px] bg-white/90 backdrop-blur-md border border-[#D8E0EA] rounded-xl shadow-[0_8px_24px_rgba(15,23,42,0.08)] p-3 flex flex-col gap-2.5">
              {/* Header Kartu */}
              <div className="flex items-center justify-between border-b border-[#D8E0EA]/70 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#072F5F] animate-pulse shrink-0" />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#072F5F]">
                    FLEET POV
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#EEF2F6] text-[#556578]">
                    {state.ambulances.length} UNITS
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPovCollapsed(true)}
                    className="p-1 text-[#556578] hover:text-[#0F172A] hover:bg-[#EEF2F6] rounded transition-colors cursor-pointer"
                    title="Lipat Menu POV"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Daftar Unit AMB-01 s/d AMB-03 */}
              <div className="flex flex-col gap-1">
                {state.ambulances.map((amb) => {
                  const isSelected = amb.id === activeAmb?.id;
                  return (
                    <button
                      key={amb.id}
                      type="button"
                      onClick={() => {
                        setActiveAmbulanceId(amb.id);
                        selectAmb(amb.id);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#E6F4F8] border border-[#0B5D7A]/30 text-[#0F172A]"
                          : "hover:bg-white/80 border border-transparent text-[#556578]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: amb.color || (isSelected ? "#0B5D7A" : "#738396"),
                          }}
                        />
                        <span className={`text-xs ${isSelected ? "font-bold text-[#0B5D7A]" : "font-medium text-[#0F172A]"}`}>
                          {amb.callSign}
                        </span>
                      </div>

                      <StatusBadge status={amb.status} size="sm" showDot={false} />
                    </button>
                  );
                })}
              </div>

              {/* Toggle Model Kendaraan */}
              <div className="pt-2 border-t border-[#D8E0EA]/70 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#556578] uppercase tracking-wider">
                  <span>Model Kendaraan</span>
                </div>
                <SegmentedControl
                  fullWidth
                  size="sm"
                  value={markerModel}
                  onChange={(val) => setMarkerModel(val as "ambulance" | "arrow")}
                  options={[
                    { value: "ambulance", label: "Ambulans 3D" },
                    { value: "arrow", label: "Panah Nav" },
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── OVERLAY KANAN ATAS: FLOATING STATUS CHIP KONTEKSTUAL ── */}
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <ContextualStatusChip status={activeAmb?.status} />
        </div>

        {/* ── PETA 3D COCKPIT (MAPBOX WEBGL) ── */}
        <DriverMockMap
          startPos={startPos}
          onHUDUpdate={handleHUDUpdate}
          markerModel={markerModel}
        />
      </div>

      {/* ── UNIFIED BOTTOM COCKPIT DOCK (RESPONSIF MOBILE / DESKTOP) ── */}
      <div className="shrink-0 h-auto md:h-20 bg-white/95 backdrop-blur-md border-t border-[#D8E0EA] px-3.5 py-2.5 md:py-0 md:px-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-6 z-20 shadow-lg pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-0">

        {/* Baris Atas Mobile / Sektor Kiri & Tengah Desktop */}
        <div className="flex items-center justify-between gap-3 md:contents">
          {/* Sektor Kiri: Tujuan Medis & Koridor */}
          <div className="flex flex-col justify-center min-w-0 max-w-[190px] md:max-w-[280px]">
            <div className="text-[9px] md:text-[10px] font-bold tracking-wider uppercase text-[#556578] mb-0.5 truncate">
              TUJUAN MEDIS
            </div>
            <div className="text-xs md:text-sm font-bold text-[#0F172A] leading-tight truncate">
              {activeAmb?.hospitalName || "RSUD Dr. Cipto Mangunkusumo"}
            </div>
            <div className="text-[10px] md:text-[11px] text-[#556578] font-medium mt-0.5 truncate">
              Salemba Raya · {poolRoute.startName?.split(" ")[0] || "Matraman"}
            </div>
          </div>

          {/* Sektor Tengah: ETA dan Sisa Jarak Berdampingan */}
          <div className="flex items-center gap-3 md:gap-6 px-2.5 md:px-4 py-1 md:py-1.5 rounded-lg bg-[#F8FAFC] border border-[#D8E0EA]/60 shrink-0">
            {/* ETA */}
            <div className="flex flex-col items-center">
              <div className="text-[9px] md:text-[10px] font-bold tracking-wider uppercase text-[#556578] flex items-center gap-1 mb-0.5">
                <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#738396]" />
                <span>ETA</span>
              </div>
              <div className="text-sm md:text-xl font-extrabold text-[#0F172A] telemetry-num font-mono">
                {etaDisplay}
              </div>
            </div>

            {/* Garis Pemisah Vertikal Tipis */}
            <div className="h-6 md:h-8 w-px bg-[#D8E0EA]" />

            {/* Sisa Jarak */}
            <div className="flex flex-col items-center">
              <div className="text-[9px] md:text-[10px] font-bold tracking-wider uppercase text-[#556578] mb-0.5">
                JARAK
              </div>
              <div className="text-sm md:text-xl font-extrabold text-[#0F172A] telemetry-num font-mono">
                {distanceDisplay}
              </div>
            </div>
          </div>
        </div>

        {/* Sektor Kanan: Slot Aksi Tunggal Kontekstual */}
        <div className="flex items-center justify-end w-full md:w-auto md:min-w-[220px] md:max-w-[300px]">
          {isDispatchedWaiting ? (
            <button
              type="button"
              onClick={() => {
                if (activeAmb) {
                  startJourney(activeAmb.id);
                  addToast({
                    type: "success",
                    title: `🚀 ${activeAmb.callSign} MULAI PERJALANAN`,
                    message: `Driver menerima instruksi! Status EN ROUTE, prioritas lampu hijau C.O.R.E. aktif.`,
                    duration: 4000,
                  });
                }
              }}
              className="w-full md:w-auto flex items-center justify-center gap-2 py-2 md:py-2.5 px-4 md:px-5 rounded-lg font-bold text-xs whitespace-nowrap bg-[#C81E1E] hover:bg-[#B91C1C] text-white shadow-sm active:scale-[0.99] transition-all cursor-pointer animate-pulse"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>TERIMA &amp; MULAI JALAN</span>
            </button>
          ) : isEnRoute ? (
            <div className="flex flex-col w-full gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-[#0F766E] uppercase tracking-wide flex items-center gap-1">
                  <Navigation className="w-3 h-3 animate-pulse" />
                  <span>EN ROUTE</span>
                </span>
                <span className="font-mono font-bold telemetry-num text-[#0F172A] text-xs">
                  {progressPercent}%
                </span>
              </div>
              {/* Progress bar ramping */}
              <div className="w-full bg-[#EEF2F6] h-1.5 rounded-full overflow-hidden border border-[#D8E0EA]/60">
                <div
                  className="h-full bg-[#0F766E] transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : isArrived ? (
            <div className="flex items-center justify-between md:justify-end gap-3 w-full">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#065F46]">
                <CheckCircle className="w-4 h-4 text-[#0F766E]" />
                <span>Tiba di RS</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-1.5 bg-white border border-[#D8E0EA] hover:bg-[#F8FAFC] text-[#0F172A] font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer"
              >
                Selesai &amp; Reset
              </button>
            </div>
          ) : (
            /* STANDBY / IDLE */
            <div className="flex items-center justify-center gap-2 text-xs text-[#556578] font-medium bg-[#EEF2F6] px-3.5 py-1.5 md:py-2 rounded-lg border border-[#D8E0EA]/70 w-full md:w-auto">
              <Radio className="w-3.5 h-3.5 text-[#072F5F] shrink-0" />
              <span>Siaga di Pangkalan</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
