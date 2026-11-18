"use client";

import React, { useState } from "react";
import {
  Radio, MapPin, Siren,
  AlertTriangle, CheckCircle2, Clock,
  ChevronRight, Zap, RotateCcw,
} from "lucide-react";
import { useCore, type Ambulance as AmbType, type DispatchCode } from "@/context/CoreContext";
import { useToast } from "@/components/ToastProvider";
import MockMap from "@/components/MockMap";
import StatusBadge from "@/components/ui/StatusBadge";

function statusLabel(status: DispatchCode) {
  switch (status) {
    case "DISPATCHED_WAITING": return "MENUNGGU DRIVER";
    case "CODE_RED":    return "CODE RED";
    case "CODE_YELLOW": return "CODE YELLOW";
    case "EN_ROUTE":    return "EN ROUTE";
    case "ARRIVED":     return "TIBA";
    default:            return "STANDBY";
  }
}

function getStatusDot(status: DispatchCode) {
  switch (status) {
    case "CODE_RED":
      return "bg-[#C81E1E] animate-pulse";
    case "DISPATCHED_WAITING":
    case "CODE_YELLOW":
      return "bg-[#B45309]";
    case "EN_ROUTE":
    case "ARRIVED":
      return "bg-[#0F766E]";
    default:
      return "bg-[#738396]";
  }
}

function AmbulanceCard({ amb }: { amb: AmbType }) {
  const { state, selectAmb } = useCore();
  const isSelected = state.selectedAmbId === amb.id;

  return (
    <button
      onClick={() => selectAmb(amb.id)}
      className={`
        w-full flex items-center justify-between px-3.5 py-2.5 transition-colors cursor-pointer text-left
        ${isSelected
          ? "bg-[#E6F4F8] border-l-[3px] border-l-[#0B5D7A] pl-[11px]"
          : "hover:bg-[#F8FAFC] border-l-[3px] border-l-transparent pl-[11px]"
        }
      `}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(amb.status)}`} />
        <div className="min-w-0">
          <div className="text-xs font-bold text-[#0F172A] leading-tight">
            {amb.callSign}
          </div>
          <div className="text-[10px] text-[#556578] mt-0.5 font-mono telemetry-num whitespace-nowrap">
            {amb.location.lat.toFixed(4)}° S, {amb.location.lng.toFixed(4)}° E
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <StatusBadge status={amb.status} size="sm" showDot={false} />
        {isSelected && (
          <ChevronRight className="w-3.5 h-3.5 text-[#0B5D7A]" />
        )}
      </div>
    </button>
  );
}

function DispatchPanel() {
  const { state, triggerDispatch, resetDispatch } = useCore();
  const { addToast } = useToast();
  const [isDispatchingRed, setIsDispatchingRed] = useState(false);
  const [isDispatchingYellow, setIsDispatchingYellow] = useState(false);

  const selectedAmb = state.ambulances.find((a) => a.id === state.selectedAmbId);
  const hasSelection = !!selectedAmb;
  const isUnitStandby = selectedAmb
    ? selectedAmb.status === "IDLE" || (selectedAmb.status as string) === "STANDBY"
    : false;
  const isUnitWaiting = selectedAmb?.status === "DISPATCHED_WAITING";
  const isUnitRed = selectedAmb?.status === "CODE_RED" || selectedAmb?.status === "EN_ROUTE";
  const isUnitYellow = selectedAmb?.status === "CODE_YELLOW";
  const anyUnitDispatched = state.ambulances.some(
    (a) => a.status !== "IDLE" && a.status !== "STANDBY"
  );

  async function handleDispatch(code: "CODE_RED" | "CODE_YELLOW") {
    if (!hasSelection || !selectedAmb) {
      addToast({
        type:    "warning",
        title:   "Tidak Ada Ambulans Dipilih",
        message: "Pilih ambulans dari daftar armada terlebih dahulu.",
      });
      return;
    }

    if (!isUnitStandby) {
      addToast({
        type:    "info",
        title:   `${selectedAmb.callSign} Sudah Berstatus Aktif`,
        message: `Unit ini sedang berjalan (${statusLabel(selectedAmb.status)}).`,
      });
      return;
    }

    const setter = code === "CODE_RED" ? setIsDispatchingRed : setIsDispatchingYellow;
    setter(true);

    await new Promise((r) => setTimeout(r, 400));

    triggerDispatch(selectedAmb.id, code);

    setter(false);

    if (code === "CODE_RED") {
      addToast({
        type:     "danger",
        title:    "🚨 DISPATCH CODE RED AKTIF",
        message:  `${selectedAmb.callSign} dikirim. Radius geofence 1KM. C.O.R.E. mengambil alih lampu lalu lintas.`,
        duration: 5000,
      });
    } else {
      addToast({
        type:     "warning",
        title:    "⚠️ DISPATCH CODE YELLOW AKTIF",
        message:  `${selectedAmb.callSign} dikirim. Radius geofence 700M. Prioritas medium.`,
        duration: 5000,
      });
    }
  }

  function handleReset() {
    resetDispatch();
    addToast({
      type:    "info",
      title:   "Dispatch Direset",
      message: "Semua unit armada kembali ke status STANDBY.",
    });
  }

  return (
    <div className="mt-auto bg-[#F4F6F8] p-3.5 border-t border-[#D8E0EA] flex flex-col gap-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#072F5F]" />
          <h3 className="text-[10px] font-bold text-[#556578] uppercase tracking-wider">PANEL DISPATCH</h3>
        </div>
        {selectedAmb && (
          <span className="text-[10px] font-mono font-bold text-[#0B5D7A] bg-[#E6F4F8] px-1.5 py-0.5 rounded border border-[#0B5D7A]/20">
            {selectedAmb.callSign}
          </span>
        )}
      </div>

      {/* Ringkasan target: 1 baris datar */}
      {selectedAmb ? (
        <div className="flex items-center justify-between py-1.5 px-2.5 bg-white border border-[#D8E0EA] rounded-md text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-bold text-[#556578] uppercase shrink-0">Target:</span>
            <span className="font-semibold text-[#0F172A] truncate">
              {selectedAmb.hospitalName || "RSUD Dr. Cipto (IGD)"}
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#556578] shrink-0 telemetry-num ml-2">
            {selectedAmb.radiusKm} KM
          </span>
        </div>
      ) : (
        <div className="py-2 px-2.5 bg-white/60 border border-dashed border-[#D8E0EA] rounded-md text-center text-xs text-[#556578]">
          ← Pilih ambulans dari daftar armada
        </div>
      )}

      {/* Tombol Dispatch Multi-Unit */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleDispatch("CODE_RED")}
          disabled={!hasSelection || isDispatchingRed || !isUnitStandby}
          className={`
            w-full flex items-center justify-center gap-2
            font-bold py-2.5 px-4 rounded-lg shadow-xs text-xs whitespace-nowrap
            transition-all active:scale-[0.99] cursor-pointer
            ${isUnitWaiting
              ? "bg-[#FEF3C7] border border-[#B45309]/30 text-[#92400E] cursor-default"
              : isUnitRed
              ? "bg-[#FEF2F2] border border-[#C81E1E]/30 text-[#991B1B] cursor-default"
              : "bg-[#C81E1E] hover:bg-[#B91C1C] text-white"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Siren className={`w-3.5 h-3.5 ${isDispatchingRed ? "animate-spin" : ""}`} />
          <span>
            {isDispatchingRed
              ? "Mengirim Sinyal..."
              : isUnitWaiting
              ? `Menunggu Driver (${selectedAmb?.callSign})`
              : isUnitRed
              ? `${selectedAmb?.callSign} Sedang Beroperasi`
              : isUnitYellow
              ? `${selectedAmb?.callSign} Sudah Code Yellow`
              : `Dispatch Code Red (${selectedAmb?.callSign ?? "Pilih Unit"})`}
          </span>
        </button>

        <button
          onClick={() => handleDispatch("CODE_YELLOW")}
          disabled={!hasSelection || isDispatchingYellow || !isUnitStandby}
          className={`
            w-full flex items-center justify-center gap-2
            bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/40 hover:bg-[#FDE68A]
            py-2 px-3 rounded-lg text-xs font-semibold whitespace-nowrap
            transition-all active:scale-[0.99] cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${isDispatchingYellow ? "animate-spin" : ""}`} />
          <span>
            {isDispatchingYellow
              ? "Mengirim Sinyal..."
              : isUnitYellow
              ? `${selectedAmb?.callSign} Sedang Code Yellow`
              : `Dispatch Code Yellow (${selectedAmb?.callSign ?? "Pilih Unit"})`}
          </span>
        </button>
      </div>

      {anyUnitDispatched && (
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-[#556578] hover:text-[#0F172A] py-1.5 rounded-md hover:bg-white border border-transparent hover:border-[#D8E0EA] transition-all font-semibold cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Semua Dispatch Armada
        </button>
      )}

      {/* Legenda 1 Baris Ringkas */}
      <div className="pt-2 border-t border-[#D8E0EA]/70 flex items-center justify-between text-[10px] text-[#556578]">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C81E1E]" />
          <span>Red</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
          <span>Yellow</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
          <span>En Route</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#738396]" />
          <span>Standby</span>
        </div>
      </div>
    </div>
  );
}

function MetricCell({
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
    <div className="flex flex-col p-3 bg-transparent">
      <div className="flex items-center gap-1.5 mb-1 min-w-0">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${accent ? "text-[#0B5D7A]" : "text-[#738396]"}`} />
        <span className="text-[10px] font-bold text-[#556578] uppercase tracking-wide whitespace-nowrap overflow-visible">
          {label}
        </span>
      </div>
      <div className={`text-lg font-bold telemetry-num font-mono ${accent ? "text-[#0B5D7A]" : "text-[#0F172A]"}`}>
        {value}
      </div>
    </div>
  );
}

export default function CommandCenter() {
  const { state } = useCore();

  const activeUnits = state.ambulances.filter(
    (a) => a.status !== "IDLE" && a.status !== "STANDBY"
  ).length;

  const dispatchTime = state.dispatchCode !== "IDLE" && state.dispatchCode !== "STANDBY"
    ? new Date().toLocaleTimeString("id-ID", { hour12: false })
    : "--:--:--";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-[#F4F6F8]">

      {/* ── SIDEBAR KIRI (Flat Enterprise Panel) ── */}
      <aside className="w-80 shrink-0 bg-white border-r border-[#D8E0EA] divide-y divide-[#D8E0EA] flex flex-col p-0 overflow-y-auto">

        {/* Section 1: Header */}
        <div className="p-3.5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[10px] font-bold text-[#556578] uppercase tracking-wider">
              ARMADA AKTIF
            </h2>
            <p className="text-xs text-[#0F172A] font-semibold mt-0.5">
              {state.ambulances.length} unit armada · {activeUnits} aktif
            </p>
          </div>
          <div className={`
            w-2.5 h-2.5 rounded-full
            ${activeUnits > 0 ? "bg-[#C81E1E] animate-pulse ring-4 ring-[#C81E1E]/20" : "bg-[#0F766E] ring-4 ring-[#0F766E]/20"}
          `} />
        </div>

        {/* Section 2: Metric Strip (Seamless 2x2 Grid) */}
        <div className="grid grid-cols-2 divide-x divide-y divide-[#D8E0EA] bg-[#F8FAFC] shrink-0 border-b border-[#D8E0EA]">
          <MetricCell
            icon={Radio}
            label="Unit Aktif"
            value={`${activeUnits}/${state.ambulances.length}`}
            accent={activeUnits > 0}
          />
          <MetricCell
            icon={Clock}
            label="Dispatch"
            value={dispatchTime}
          />
          <MetricCell
            icon={MapPin}
            label="Radius C.O.R.E"
            value={
              state.dispatchCode === "CODE_RED" ? "1.0 KM" :
              state.dispatchCode === "CODE_YELLOW" ? "700 M" : "— M"
            }
          />
          <MetricCell
            icon={CheckCircle2}
            label="Sinyal Clearance"
            value={
              state.dispatchCode !== "IDLE" && state.dispatchCode !== "STANDBY" ? "4/4" : "0/4"
            }
            accent={state.dispatchCode !== "IDLE" && state.dispatchCode !== "STANDBY"}
          />
        </div>

        {/* Section 3: Daftar Unit */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-3.5 pt-3 pb-1.5 text-[10px] font-bold text-[#556578] uppercase tracking-wider">
            DAFTAR UNIT
          </div>
          <div className="divide-y divide-[#D8E0EA]/40 overflow-y-auto">
            {state.ambulances.map((amb) => (
              <AmbulanceCard key={amb.id} amb={amb} />
            ))}
          </div>
        </div>

        {/* Section 4: Dock Aksi Bawah */}
        <DispatchPanel />
      </aside>

      {/* ── AREA PETA KANAN ── */}
      <main className="flex-1 flex flex-col p-3.5 gap-2.5 overflow-hidden bg-[#F4F6F8]">

        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#072F5F]" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#072F5F]">
              PETA OPERASIONAL REAL-TIME
            </span>
            <span className="text-xs text-[#556578] ml-1.5 font-medium">
              Koridor Medis Jakarta · Salemba Raya (RSCM)
            </span>
          </div>

          {state.dispatchCode !== "IDLE" && state.dispatchCode !== "STANDBY" && (
            <div className={`
              flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold shadow-xs
              ${state.dispatchCode === "CODE_RED"
                ? "bg-[#FEF2F2] border-[#C81E1E]/30 text-[#991B1B]"
                : "bg-[#FEF3C7] border-[#B45309]/30 text-[#92400E]"
              }
            `}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>
                C.O.R.E. AKTIF —{" "}
                {state.ambulances.find((a) => a.id === state.selectedAmbId)?.callSign}
                {" "}→ RSUD Dr. Cipto
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-[#D8E0EA] bg-white shadow-xs">
          <MockMap />
        </div>

        <div className="shrink-0 flex items-center justify-between text-[11px] text-[#556578] px-1 font-medium">
          <span>Engine: Petal Maps Web API v2.4 (Enterprise Light) · Proyeksi: Web Mercator</span>
          <span className="font-mono telemetry-num">Siklus Telemetri: 1Hz GPS Direct WebGL</span>
        </div>
      </main>
    </div>
  );
}
