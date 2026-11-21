"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Navigation,
  Play,
  CheckCircle,
  Radio,
  Clock,
} from "lucide-react";
import { useCore, HOSPITAL_LOCATION } from "@/context/CoreContext";
import { useToast } from "@/components/ToastProvider";
import DriverMockMap, { type MapPoint, type HUDUpdateData } from "@/components/DriverMockMap";
import { AMBULANCE_ROUTES_POOL } from "@/utils/AmbulanceRoutesPool";
import * as turf from "@turf/turf";

// ─── KOMPONEN UTAMA DRIVER KIOSK ──────────────────────────────────────────────

export default function DriverKiosk() {
  const {
    state,
    setActiveAmbulanceId,
    selectAmb,
    resetDispatch,
    startJourney,
  } = useCore();
  const { addToast } = useToast();

  // 1. CARI AMBULANS YANG SEDANG DISOROT
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
    eta: "MENUNGGU INSTRUKSI DISPATCH",
    distanceKm: "--",
    speedKmh: 0,
    progress: activeAmb?.progress ?? 0,
  });

  // Toggle model visual marker: 'ambulance' atau 'arrow' (default 'arrow' Google Maps style)
  const [markerModel, setMarkerModel] = useState<"ambulance" | "arrow">("arrow");

  const handleHUDUpdate = useCallback((data: HUDUpdateData) => {
    setHUD(data);
  }, []);

  const handleReset = useCallback(() => {
    setHUD({
      eta: "MENUNGGU INSTRUKSI DISPATCH",
      distanceKm: "--",
      speedKmh: 0,
      progress: 0,
    });
    resetDispatch();
  }, [resetDispatch]);

  const isStandby = !activeAmb || activeAmb.status === "STANDBY" || activeAmb.status === "IDLE";
  const isDispatchedWaiting = activeAmb?.status === "DISPATCHED_WAITING";
  const isEnRoute = activeAmb?.status === "EN_ROUTE" || activeAmb?.status === "CODE_RED";
  const isCodeYellow = activeAmb?.status === "CODE_YELLOW";
  const isArrived = activeAmb?.status === "ARRIVED";

  const etaDisplay = isStandby
    ? "MENUNGGU INSTRUKSI DISPATCH"
    : isDispatchedWaiting
    ? "SIAP - MENUNGGU DRIVER"
    : isArrived
    ? "TIBA DI RUMAH SAKIT"
    : hud.eta;

  const distanceDisplay = isStandby
    ? "-- KM (STANDBY)"
    : isDispatchedWaiting
    ? `${routeTotalKm.toFixed(2)} KM (READY)`
    : isArrived
    ? "0.00 KM"
    : `${hud.distanceKm} KM`;

  const progressPercent = isStandby || isDispatchedWaiting
    ? 0
    : isArrived
    ? 100
    : Math.round(hud.progress * 100);

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 text-slate-900 select-none font-sans">
      <div className="flex flex-col h-full">
        {/* HEADER: Banner Atas Berdasarkan Status Ambulans & CallSign */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-slate-200/60 bg-white/85 backdrop-blur-md shadow-xs z-10">
          <div className="flex items-center gap-3">
            {isStandby ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium text-xs bg-slate-100 border border-slate-200/80 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>STANDBY - MENUNGGU DISPATCH</span>
              </div>
            ) : isDispatchedWaiting ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium text-xs bg-amber-50 border border-amber-300 text-amber-800 shadow-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>DISPATCH DITERIMA — MENUNGGU KONFIRMASI DRIVER</span>
              </div>
            ) : isEnRoute ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium text-xs bg-red-50 border border-red-300 text-red-700 shadow-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                <span>EN ROUTE — C.O.R.E. AKTIF</span>
              </div>
            ) : isCodeYellow ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium text-xs bg-amber-50 border border-amber-300 text-amber-700 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>CODE YELLOW — CLEARANCE</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>TIBA DI RUMAH SAKIT</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-100/80 px-3 py-1 rounded-full border border-slate-200/60">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">KORIDOR:</span>
              <span className="text-blue-600 font-semibold">SALEMBA RAYA (RSCM)</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-slate-800 tracking-tight leading-none">
              {activeAmb?.callSign ?? "AMB-01"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {activeAmb?.location
                ? `${activeAmb.location.lat.toFixed(4)}°S, ${activeAmb.location.lng.toFixed(4)}°E`
                : "Tracking 60 FPS"}
            </div>
          </div>
        </div>

        {/* Linear Progress Bar for activeAmb */}
        <div className="w-full bg-slate-200/60 h-1 relative overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isStandby || isDispatchedWaiting
                ? "bg-slate-300 w-0"
                : "bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* AREA PETA DENGAN FLOATING HUD POV SELECTOR */}
        <div className="relative flex-1 min-h-0 p-2 sm:p-3">
          {/* PANEL HUD POV SELECTOR MENGAMBANG (SUDUT KIRI ATAS - GLASSMORPHISM) */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-xs pointer-events-none">
            <div className="bg-white/85 backdrop-blur-md border border-white/40 text-slate-900 rounded-2xl p-3.5 shadow-lg pointer-events-auto">
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-700">
                    C.O.R.E. FLEET POV
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700">
                  {state.ambulances.length} UNITS
                </span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {state.ambulances.map((amb) => {
                  const isActive = amb.id === activeAmb?.id;
                  const ambWaiting = amb.status === "DISPATCHED_WAITING";
                  const ambEnRoute = amb.status === "EN_ROUTE" || amb.status === "CODE_RED";

                  return (
                    <button
                      key={amb.id}
                      onClick={() => {
                        setActiveAmbulanceId(amb.id);
                        selectAmb(amb.id);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-blue-50/80 border-transparent shadow-inner text-slate-900"
                          : "bg-white/60 border border-slate-200/60 hover:bg-white/90 text-slate-700 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: amb.color || (isActive ? "#2563EB" : "#94A3B8"),
                          }}
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            POV: {amb.callSign}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            {amb.hospitalName || "RSUD Dr. Cipto"}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isActive ? (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium px-2 py-0.5 rounded-full text-[10px]">
                            TRACKING
                          </span>
                        ) : ambWaiting ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 font-medium px-2 py-0.5 rounded-full text-[10px] animate-pulse">
                            DISPATCHED
                          </span>
                        ) : ambEnRoute ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium px-2 py-0.5 rounded-full text-[10px]">
                            EN ROUTE
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full text-[10px]">
                            STANDBY
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── TOGGLE MODEL MARKER: AMBULANS vs PANAH NAVIGASI ── */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/50">
                <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-1.5 flex items-center justify-between">
                  <span>MODEL KENDARAAN:</span>
                  <span className="text-blue-600 text-[10px] font-bold">
                    {markerModel === "ambulance" ? "Ambulans 3D" : "Panah Nav"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setMarkerModel("ambulance")}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      markerModel === "ambulance"
                        ? "bg-white text-red-600 shadow-xs border border-slate-200/80 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                    }`}
                  >
                    <span>🚑</span>
                    <span>Ambulans</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkerModel("arrow")}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      markerModel === "arrow"
                        ? "bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                    }`}
                  >
                    <span>➤</span>
                    <span>Panah Nav</span>
                  </button>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>Klik unit untuk ganti POV</span>
                <span className="text-blue-600 font-semibold">60 FPS WebGL</span>
              </div>
            </div>
          </div>

          {/* PETA 3D COCKPIT DENGAN 60 FPS WEBGL DIRECT BUFFERING */}
          <DriverMockMap
            startPos={startPos}
            onHUDUpdate={handleHUDUpdate}
            markerModel={markerModel}
          />
        </div>

        {/* PANEL NAVIGASI BAWAH (GLASSMORPHISM APPLE MAPS STYLE) */}
        <div className="shrink-0 px-6 pb-4 pt-3 bg-white/85 backdrop-blur-md border-t border-white/40 shadow-lg space-y-3 z-10">
          <div className="grid grid-cols-3 gap-3 text-center">
            {/* Kartu Tujuan Medis */}
            <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 p-2.5 rounded-xl shadow-xs">
              <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-0.5">
                Tujuan Medis
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-800 leading-tight truncate">
                {activeAmb?.hospitalName || "RSUD Dr. Cipto"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate font-medium">
                {poolRoute.startName || "Jl. Salemba Raya"}
              </div>
            </div>

            {/* Kartu ETA */}
            <div
              className={`p-2.5 rounded-xl border backdrop-blur-sm shadow-xs ${
                isStandby
                  ? "bg-white/70 border-slate-200/60"
                  : isDispatchedWaiting
                  ? "bg-amber-50/80 border-amber-200"
                  : isEnRoute
                  ? "bg-red-50/80 border-red-200"
                  : isArrived
                  ? "bg-emerald-50/80 border-emerald-200"
                  : "bg-amber-50/80 border-amber-200"
              }`}
            >
              <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-0.5">
                <Clock className="inline w-3 h-3 mr-1 text-slate-400" />
                Estimasi Tiba (ETA)
              </div>
              <div
                className={`tracking-tight ${
                  isStandby || isDispatchedWaiting
                    ? "text-xs sm:text-xs text-amber-700 font-semibold py-1"
                    : isArrived
                    ? "text-2xl font-bold text-emerald-600"
                    : "text-2xl font-bold text-red-600"
                }`}
              >
                {etaDisplay}
              </div>
            </div>

            {/* Kartu Sisa Jarak */}
            <div className="bg-white/70 backdrop-blur-sm border border-slate-200/60 p-2.5 rounded-xl shadow-xs">
              <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-0.5">
                Sisa Jarak
              </div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight">
                {distanceDisplay}
              </div>
            </div>
          </div>

          {/* 1. Status Standby */}
          {isStandby && (
            <div className="w-full py-3 px-4 rounded-xl font-medium text-xs sm:text-sm tracking-normal flex items-center justify-center gap-2 border border-slate-200/60 text-slate-600 bg-white/70 backdrop-blur-sm shadow-xs">
              <Radio className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
              <span>{activeAmb?.callSign} STANDBY DI PANGKALAN · Menunggu Dispatch dari Command Center</span>
            </div>
          )}

          {/* 2. Tombol Besar Berkedip: TERIMA & MULAI JALAN (DISPATCHED_WAITING) */}
          {isDispatchedWaiting && (
            <button
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
              className="w-full py-3.5 px-6 rounded-xl font-bold text-base sm:text-lg tracking-wide flex items-center justify-center gap-3 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md hover:shadow-lg active:scale-[0.99] transition-all border border-red-600/80 cursor-pointer animate-pulse"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>TERIMA &amp; MULAI JALAN</span>
              <span className="text-xs font-semibold bg-red-800/60 px-2.5 py-0.5 rounded-full border border-red-400/40">
                CODE RED DISPATCH
              </span>
            </button>
          )}

          {/* 3. Status En Route */}
          {isEnRoute && (
            <div className="w-full py-3 px-4 rounded-xl font-semibold text-sm sm:text-base tracking-normal flex items-center justify-center gap-3 border border-red-200/80 text-red-700 bg-red-50/80 backdrop-blur-sm shadow-xs">
              <Navigation className="w-4 h-4 animate-pulse text-red-600" />
              <span>{activeAmb?.callSign} EN ROUTE MENUJU {activeAmb?.hospitalName || "RSUD Dr. Cipto"}</span>
              <span className="text-xs font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded-md ml-1">
                {progressPercent}%
              </span>
            </div>
          )}

          {/* 4. Status Tiba di Rumah Sakit */}
          {isArrived && (
            <div className="flex items-center justify-between gap-3 p-2.5 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/80 rounded-xl shadow-xs">
              <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold pl-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>{activeAmb?.callSign} TELAH TIBA DI RUMAH SAKIT</span>
              </div>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Selesai &amp; Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
