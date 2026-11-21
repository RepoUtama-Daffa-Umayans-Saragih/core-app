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

function statusStyle(status: DispatchCode) {
  switch (status) {
    case "DISPATCHED_WAITING": return "bg-amber-50 text-amber-700 border border-amber-200/80 animate-pulse";
    case "CODE_RED":    return "bg-red-50 text-red-700 border border-red-200/80";
    case "CODE_YELLOW": return "bg-amber-50 text-amber-700 border border-amber-200/80";
    case "EN_ROUTE":    return "bg-emerald-50 text-emerald-700 border border-emerald-200/80";
    case "ARRIVED":     return "bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium";
    default:            return "bg-slate-100 text-slate-600 font-medium";
  }
}

function statusLabel(status: DispatchCode) {
  switch (status) {
    case "DISPATCHED_WAITING": return "⏳ MENUNGGU DRIVER";
    case "CODE_RED":    return "⚡ CODE RED";
    case "CODE_YELLOW": return "⚠ CODE YELLOW";
    case "EN_ROUTE":    return "🚑 EN ROUTE";
    case "ARRIVED":     return "✓ TIBA";
    default:            return "STANDBY";
  }
}

function AmbulanceCard({ amb }: { amb: AmbType }) {
  const { state, selectAmb } = useCore();
  const isSelected = state.selectedAmbId === amb.id;
  const isActive   = amb.status !== "IDLE";

  return (
    <button
      onClick={() => selectAmb(amb.id)}
      className={`
        w-full flex items-center justify-between p-3 mb-2 bg-white border rounded-lg shadow-sm transition-colors cursor-pointer text-left
        ${isSelected
          ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40"
          : "border-slate-200 hover:border-slate-300"
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`
          w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border
          ${isActive
            ? (amb.status === "CODE_RED"
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-amber-50 border-amber-200 text-amber-600")
            : "bg-blue-50 border-blue-100 text-blue-600"
          }
        `}>
          <Ambulance className="w-5 h-5" />
        </div>

        <div>
          <div className="text-sm font-bold text-slate-800 leading-tight">
            {amb.callSign}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {amb.location.lat.toFixed(4)}° S, {amb.location.lng.toFixed(4)}° E
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`status-badge text-[10px] ${statusStyle(amb.status)}`}>
          {statusLabel(amb.status)}
        </span>
        {isSelected && (
          <ChevronRight className="w-4 h-4 text-blue-600" />
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
  // Periksa status ambulans spesifik yang sedang dipilih (BUKAN status global)
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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-blue-600" />
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Panel Dispatch</h3>
      </div>

      {selectedAmb ? (
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Unit Terpilih:</div>
          <div className="font-extrabold text-slate-800 text-base">{selectedAmb.callSign}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Status saat ini: <span className="font-semibold text-slate-700">{statusLabel(selectedAmb.status)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-dashed border-slate-200 rounded-lg p-3
                        text-center text-xs text-slate-500">
          ← Pilih ambulans dari daftar armada
        </div>
      )}

      {/* Tombol Dispatch Multi-Unit: Berdasarkan unit terpilih */}
      <div className="space-y-2 mt-4">
        <button
          onClick={() => handleDispatch("CODE_RED")}
          disabled={!hasSelection || isDispatchingRed || !isUnitStandby}
          className={`
            w-full flex items-center justify-center gap-2.5
            font-bold text-sm py-3 px-4 rounded-xl cursor-pointer
            transition-all duration-150 active:scale-[0.98] shadow-sm
            ${isUnitWaiting
              ? "bg-amber-50 border border-amber-300 text-amber-700 cursor-default animate-pulse"
              : isUnitRed
              ? "bg-red-50 border border-red-300 text-red-700 cursor-default animate-pulse"
              : "bg-red-600 hover:bg-red-700 text-white"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Siren className={`w-4 h-4 ${isDispatchingRed ? "animate-spin" : ""}`} />
          {isDispatchingRed
            ? "Mengirim sinyal..."
            : isUnitWaiting
              ? `⏳ ${selectedAmb?.callSign} MENUNGGU DRIVER`
              : isUnitRed
              ? `⚡ ${selectedAmb?.callSign} EN ROUTE`
              : isUnitYellow
              ? `⚠ ${selectedAmb?.callSign} SUDAH CODE YELLOW`
              : `Dispatch Code Red (${selectedAmb?.callSign ?? "Pilih Unit"})`}
        </button>

        <button
          onClick={() => handleDispatch("CODE_YELLOW")}
          disabled={!hasSelection || isDispatchingYellow || !isUnitStandby}
          className={`
            w-full flex items-center justify-center gap-2.5
            font-bold text-sm py-2.5 px-4 rounded-xl cursor-pointer
            transition-all duration-150 active:scale-[0.98] shadow-sm
            ${isUnitWaiting
              ? "bg-amber-50 border border-amber-300 text-amber-700 cursor-default animate-pulse"
              : isUnitYellow
              ? "bg-amber-50 border border-amber-300 text-amber-700 cursor-default animate-pulse"
              : "bg-amber-500 hover:bg-amber-600 text-white"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <AlertTriangle className={`w-4 h-4 ${isDispatchingYellow ? "animate-spin" : ""}`} />
          {isDispatchingYellow
            ? "Mengirim sinyal..."
            : isUnitWaiting
              ? `⏳ ${selectedAmb?.callSign} MENUNGGU DRIVER`
              : isUnitYellow
              ? `⚠ ${selectedAmb?.callSign} CODE YELLOW — AKTIF`
              : isUnitRed
              ? `⚡ ${selectedAmb?.callSign} SUDAH CODE RED`
              : `Dispatch Code Yellow (${selectedAmb?.callSign ?? "Pilih Unit"})`}
        </button>
      </div>

      {anyUnitDispatched && (
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-2 text-xs
                     text-slate-600 hover:text-slate-900 py-2.5 rounded-lg cursor-pointer
                     border border-dashed border-slate-300 hover:border-slate-400 hover:bg-white
                     transition-all font-semibold mt-3"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Semua Dispatch Armada
        </button>
      )}
    </div>
  );
}

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
    <div className="flex flex-col p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${accent ? "text-blue-600" : "text-slate-400"}`} />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="text-xl font-extrabold text-slate-800">{value}</div>
    </div>
  );
}

export default function CommandCenter() {
  const { state } = useCore();

  const activeUnits  = state.ambulances.filter((a) => a.status !== "IDLE").length;
  const dispatchTime = state.dispatchCode !== "IDLE"
    ? new Date().toLocaleTimeString("id-ID", { hour12: false })
    : "--:--:--";

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">

      {/* ── SIDEBAR KIRI (Terang & Bersih) ── */}
      <aside className="w-80 shrink-0 flex flex-col gap-3.5 p-4 overflow-y-auto
                        border-r border-slate-200 bg-slate-100/50 shadow-xs">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              ARMADA AKTIF
            </h2>
            <p className="text-xs text-slate-600 font-semibold mt-0.5">
              {state.ambulances.length} unit armada · {activeUnits} aktif
            </p>
          </div>
          <div className={`
            w-2.5 h-2.5 rounded-full
            ${activeUnits > 0 ? "bg-red-500 animate-pulse ring-4 ring-red-100" : "bg-emerald-500 ring-4 ring-emerald-100"}
          `} />
        </div>

        {/* Metric Cards Mini (Grid 4 Kotak) */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard icon={Radio}        label="Unit Aktif"     value={`${activeUnits}/3`} accent />
          <MetricCard icon={Clock}        label="Dispatch"       value={dispatchTime} />
          <MetricCard icon={MapPin}       label="Radius C.O.R.E" value={
            state.dispatchCode === "CODE_RED" ? "1.0 KM" :
            state.dispatchCode === "CODE_YELLOW" ? "700 M" : "— M"
          } />
          <MetricCard icon={CheckCircle2} label="Sinyal Clearance" value={
            state.dispatchCode !== "IDLE" ? "4/4" : "0/4"
          } accent={state.dispatchCode !== "IDLE"} />
        </div>

        {/* Daftar Ambulans */}
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">
            Daftar Unit
          </div>
          {state.ambulances.map((amb) => (
            <AmbulanceCard key={amb.id} amb={amb} />
          ))}
        </div>

        <DispatchPanel />

        {/* Legenda Status */}
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5 mt-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Legenda</div>
          {[
            { color: "bg-red-500",      label: "Code Red — Prioritas Darurat" },
            { color: "bg-amber-500",    label: "Code Yellow — Prioritas Sedang" },
            { color: "bg-emerald-500",  label: "En Route / C.O.R.E. Aktif" },
            { color: "bg-slate-400",    label: "Standby / Tersedia" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
              <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </aside>

      {/* ── AREA PETA KANAN ── */}
      <main className="flex-1 flex flex-col p-4 gap-3 overflow-hidden bg-slate-50">

        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">
              PETA OPERASIONAL REAL-TIME
            </span>
            <span className="text-xs text-slate-500 ml-2 font-medium">
              Koridor Medis Jakarta · Salemba Raya (RSCM)
            </span>
          </div>

          {state.dispatchCode !== "IDLE" && (
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold
              animate-slide-in shadow-xs
              ${state.dispatchCode === "CODE_RED"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-amber-50 border-amber-200 text-amber-800"
              }
            `}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              C.O.R.E. AKTIF —{" "}
              {state.ambulances.find((a) => a.id === state.selectedAmbId)?.callSign}
              {" "}→ RSUD Dr. Cipto
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden shadow-sm border border-slate-200/60">
          <MockMap />
        </div>

        <div className="shrink-0 flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
          <span>Engine: Petal Maps Web API v2.4 (Enterprise Light) · Proyeksi: Web Mercator</span>
          <span>Siklus Telemetri: 1Hz GPS Direct WebGL</span>
        </div>
      </main>
    </div>
  );
}
