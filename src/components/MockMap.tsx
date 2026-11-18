"use client";

import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import * as turf from "@turf/turf";
import { useCore } from "@/context/CoreContext";
import {
  Zap,
  Hospital,
  AlertTriangle,
  Camera,
  Activity,
  ShieldCheck,
  Radio,
} from "lucide-react";
import {
  HOSPITAL_DESTINATIONS,
  TRAFFIC_LIGHTS_GEOJSON,
  type TrafficLightStatus,
  type TrafficLightPreemptionState,
} from "@/components/LiveSimulation";
import { AMBULANCE_ROUTES_POOL } from "@/utils/AmbulanceRoutesPool";

// ─── KONFIGURASI MAPBOX ───────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ─── HELPER: GeoJSON Geodesic Circle untuk Radius Geofence (1KM / 0.7KM) ────────
function createGeoJSONCircle(
  center: [number, number],
  radiusInKm: number,
  points = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const ret: [number, number][] = [];
  const distanceX = radiusInKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([lng + x, lat + y]);
  }
  ret.push(ret[0]);

  return {
    type: "Feature",
    properties: { radiusKm: radiusInKm },
    geometry: {
      type: "Polygon",
      coordinates: [ret],
    },
  };
}

export default function MockMap() {
  const { state, selectAmb, setActiveAmbulanceId } = useCore();
  const mapRef = useRef<MapRef | null>(null);

  // Strobo siren timer untuk efek visual strobo ambulans
  const [strobeState, setStrobeState] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setStrobeState((prev) => !prev);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  const selectedAmb = useMemo(() => {
    return (
      state.ambulances.find((a) => a.id === state.selectedAmbId) ??
      state.ambulances[0]
    );
  }, [state.ambulances, state.selectedAmbId]);

  const isArrived = selectedAmb?.status === "ARRIVED";
  const anyDispatched = state.ambulances.some(
    (a) => a.status === "CODE_RED" || a.status === "EN_ROUTE"
  );
  const isSelectedDispatched =
    !!selectedAmb && selectedAmb.status !== "IDLE" && selectedAmb.status !== "STANDBY";
  const isCodeRed = selectedAmb?.status === "CODE_RED" || selectedAmb?.status === "EN_ROUTE";
  const isCodeYellow = selectedAmb?.status === "CODE_YELLOW";

  const geofenceRadiusKm = isCodeRed ? 1.0 : isCodeYellow ? 0.7 : (selectedAmb?.radiusKm ?? 0);
  const routeColor = selectedAmb?.color || (isCodeRed ? "#DC2626" : isCodeYellow ? "#F59E0B" : "#2563EB");

  // HANYA tampilkan geofence radius jika status CODE_RED atau EN_ROUTE (otomatis false jika ARRIVED)
  const shouldRenderGeofence =
    selectedAmb?.status === "CODE_RED" || selectedAmb?.status === "EN_ROUTE";

  // Injeksi Layer Bangunan 3D (3D Extrusion) saat peta selesai dimuat
  const handleMapLoad = useCallback((evt: any) => {
    const map = evt.target;
    if (!map) return;
    map.resize();

    try {
      const layers = map.getStyle()?.layers;
      let labelLayerId: string | undefined;
      if (layers) {
        for (const layer of layers) {
          if (layer.type === "symbol" && layer.layout?.["text-field"]) {
            labelLayerId = layer.id;
            break;
          }
        }
      }

      if (!map.getLayer("3d-buildings") && map.getSource("composite")) {
        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#dbeafe",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.85,
            },
          },
          labelLayerId
        );
      }
    } catch (e) {
      console.warn("Could not add 3D buildings layer:", e);
    }
  }, []);

  // ─── EVALUASI PREEMPTION LAMPU LALU LINTAS 3-STAGE (IDENTIK DENGAN LIVE SIMULATION) ───
  const trafficLightsStatus = useMemo((): TrafficLightStatus[] => {
    return TRAFFIC_LIGHTS_GEOJSON.map((tl) => {
      // RESET LAMPU LALU LINTAS: Ambulans yang berstatus ARRIVED atau STANDBY tidak memancarkan override
      const activeAmbs = state.ambulances.filter(
        (a) => a.status === "EN_ROUTE" || a.status === "CODE_RED"
      );
      if (activeAmbs.length === 0) {
        return { ...tl, state: "red", distMeters: 9999, isAhead: false };
      }

      let closestDist = 9999;
      let hasGreen = false;
      let hasYellow = false;
      let triggeringCallSign = "";

      for (const amb of activeAmbs) {
        const ambPt = turf.point([amb.location.lng, amb.location.lat]);
        const tlPt = turf.point([tl.lng, tl.lat]);
        const dMeters = turf.distance(ambPt, tlPt, { units: "kilometers" }) * 1000;

        const bearingToTL = (turf.bearing(ambPt, tlPt) + 360) % 360;
        const angleDiff = Math.abs(bearingToTL - (amb.heading ?? 0));
        const isAhead = angleDiff < 85 || angleDiff > 275;

        // < 300m dan di depan ambulans (atau sedang dilewati < 25m) -> HIJAU
        if (dMeters < 300 && (isAhead || dMeters < 25)) {
          hasGreen = true;
          if (dMeters < closestDist) {
            closestDist = dMeters;
            triggeringCallSign = amb.callSign;
          }
        }
        // 300m - 500m dan di depan ambulans -> KUNING (CLEARANCE)
        else if (dMeters >= 300 && dMeters <= 500 && isAhead) {
          hasYellow = true;
          if (dMeters < closestDist) {
            closestDist = dMeters;
            triggeringCallSign = amb.callSign;
          }
        } else if (dMeters < closestDist) {
          closestDist = dMeters;
        }
      }

      let tlState: TrafficLightPreemptionState = "red";
      if (hasGreen) tlState = "green";
      else if (hasYellow) tlState = "yellow";
      else tlState = "red";

      return {
        ...tl,
        state: tlState,
        distMeters: closestDist,
        isAhead: true,
        triggeringAmbCallSign: triggeringCallSign,
      };
    });
  }, [state.ambulances]);

  // Geofence GeoJSON Polygon - HANYA render jika status CODE_RED atau EN_ROUTE dan BUKAN ARRIVED
  const geofenceGeoJSON = useMemo(() => {
    if (!shouldRenderGeofence || !selectedAmb) return null;
    return createGeoJSONCircle(
      [selectedAmb.location.lng, selectedAmb.location.lat],
      geofenceRadiusKm
    );
  }, [selectedAmb?.location.lng, selectedAmb?.location.lat, geofenceRadiusKm, shouldRenderGeofence]);

  // Rute ambulans dari AMBULANCE_ROUTES_POOL
  const poolRoutesMap = useMemo(() => {
    const routesMap: Record<string, GeoJSON.Feature<GeoJSON.LineString>> = {};
    for (const amb of state.ambulances) {
      const match =
        AMBULANCE_ROUTES_POOL.find(
          (r) =>
            r.callSign.toLowerCase() === amb.callSign.toLowerCase() ||
            r.id === amb.id
        ) || AMBULANCE_ROUTES_POOL[0];
      if (match?.geometry) {
        routesMap[amb.id] = {
          type: "Feature",
          properties: { id: amb.id, color: amb.color },
          geometry: match.geometry,
        };
      }
    }
    return routesMap;
  }, [state.ambulances]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-[#0B0F19] border border-gray-200/80 shadow-inner select-none transition-none">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: 106.8520,
          latitude: -6.2010,
          zoom: 15.3,
          pitch: 50,
          bearing: -15,
        }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
        reuseMaps
        onLoad={handleMapLoad}
      >
        <NavigationControl position="bottom-right" showCompass showZoom />

        {/* ── 1. LAYER GEOFENCE RADIUS (1KM / 0.7KM - HANYA CODE_RED/EN_ROUTE, HILANG SAAT ARRIVED) ── */}
        {shouldRenderGeofence && geofenceGeoJSON && (
          <Source id="geofence-source" type="geojson" data={geofenceGeoJSON}>
            <Layer
              id="geofence-fill"
              type="fill"
              paint={{
                "fill-color": routeColor,
                "fill-opacity": isCodeRed ? 0.12 : 0.10,
              }}
            />
            <Layer
              id="geofence-boundary-glow"
              type="line"
              paint={{
                "line-color": routeColor,
                "line-width": 4,
                "line-opacity": 0.45,
                "line-blur": 2,
              }}
            />
            <Layer
              id="geofence-boundary-line"
              type="line"
              paint={{
                "line-color": routeColor,
                "line-width": 2,
                "line-dasharray": [3, 2],
              }}
            />
          </Source>
        )}

        {/* ── 2. LAYER RUTE KORIDOR SELURUH ARMADA (GAYA IDENTIK LIVE SIMULATION) ── */}
        {state.ambulances.map((amb) => {
          const isSelected = amb.id === selectedAmb?.id;
          const routeGeo = poolRoutesMap[amb.id];
          if (!routeGeo) return null;

          return (
            <Source key={`route-${amb.id}`} id={`route-src-${amb.id}`} type="geojson" data={routeGeo}>
              <Layer
                id={`route-casing-${amb.id}`}
                type="line"
                paint={{
                  "line-color": "#FFFFFF",
                  "line-width": isSelected ? 8 : 5,
                  "line-opacity": 0.85,
                }}
              />
              <Layer
                id={`route-glow-${amb.id}`}
                type="line"
                paint={{
                  "line-color": amb.color || routeColor,
                  "line-width": isSelected ? 14 : 8,
                  "line-opacity": isSelected ? 0.5 : 0.25,
                  "line-blur": 3,
                }}
              />
              <Layer
                id={`route-line-${amb.id}`}
                type="line"
                layout={{
                  "line-cap": "round",
                  "line-join": "round",
                }}
                paint={{
                  "line-color": amb.color || routeColor,
                  "line-width": isSelected ? 5 : 3.5,
                }}
              />
            </Source>
          );
        })}

        {/* ── 3. MARKER 3 RUMAH SAKIT UTAMA (IDENTIK DENGAN LIVE SIMULATION) ── */}
        {HOSPITAL_DESTINATIONS.map((hosp) => (
          <Marker
            key={hosp.id}
            longitude={hosp.lng}
            latitude={hosp.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center cursor-pointer group">
              <div className="bg-white/95 text-gray-900 text-[10.5px] font-bold px-2 py-0.5 rounded shadow-sm border border-red-300 mb-1 whitespace-nowrap flex items-center gap-1 group-hover:scale-105 transition-transform">
                <Hospital className="w-3.5 h-3.5 text-red-600" />
                <span>{hosp.shortName}</span>
              </div>
              <div
                className="w-7 h-7 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: hosp.color }}
              >
                H
              </div>
              <div className="w-2 h-2 rotate-45 -mt-1 shadow-xs" style={{ backgroundColor: hosp.color }} />
            </div>
          </Marker>
        ))}

        {/* ── 4. MARKER LAMPU LALU LINTAS 3-STAGE PREEMPTION (IDENTIK LIVE SIMULATION) ── */}
        {trafficLightsStatus.map((tl) => (
          <Marker
            key={tl.id}
            longitude={tl.lng}
            latitude={tl.lat}
            anchor="center"
          >
            <div className="relative flex flex-col items-center cursor-pointer group">
              {tl.state === "green" ? (
                <>
                  <div className="absolute -inset-4 rounded-full border-2 border-emerald-400 animate-ping opacity-75 pointer-events-none" />
                  <div className="absolute -inset-8 rounded-full border border-emerald-500/50 animate-pulse pointer-events-none" />

                  <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-emerald-400/40 animate-pulse">
                    <Zap className="w-3 h-3 text-yellow-300 fill-current" />
                  </div>

                  <div className="mt-1 flex flex-col items-center bg-emerald-600 text-white px-2 py-0.5 rounded-lg shadow-lg border border-white whitespace-nowrap animate-bounce">
                    <span className="text-[9px] font-bold tracking-tight">
                      🟢 C.O.R.E. GREEN WAVE (HIJAU)
                    </span>
                    <span className="text-[8px] opacity-90 font-mono">
                      {tl.triggeringAmbCallSign ? `${tl.triggeringAmbCallSign} · ` : ""}Prioritas ({Math.round(tl.distMeters)}m)
                    </span>
                  </div>
                </>
              ) : tl.state === "yellow" ? (
                <>
                  <div className="absolute -inset-3 rounded-full border-2 border-amber-400 animate-ping opacity-60 pointer-events-none" />

                  <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-white ring-4 ring-amber-400/40 animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-white fill-current" />
                  </div>

                  <div className="mt-1 flex flex-col items-center bg-amber-500 text-white px-2 py-0.5 rounded-lg shadow-md border border-white whitespace-nowrap animate-pulse">
                    <span className="text-[9px] font-bold tracking-tight">
                      🟡 PREEMPTION: CLEARANCE...
                    </span>
                    <span className="text-[8px] opacity-90 font-mono">
                      {tl.triggeringAmbCallSign ? `${tl.triggeringAmbCallSign} · ` : ""}Pembersihan ({Math.round(tl.distMeters)}m)
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-md flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </div>

                  <div className="mt-1 flex flex-col items-center bg-white/95 text-red-600 px-1.5 py-0.5 rounded shadow-xs border border-red-200 whitespace-nowrap">
                    <span className="text-[8.5px] font-bold">🔴 NORMAL (MERAH)</span>
                    <span className="text-[7.5px] text-gray-500">{tl.name}</span>
                  </div>
                </>
              )}
            </div>
          </Marker>
        ))}

        {/* ── 5. MARKER SELURUH ARMADA AMBULANS 3D (IDENTIK 100% DENGAN LIVE SIMULATION) ── */}
        {state.ambulances.map((amb) => {
          const isSelected = amb.id === selectedAmb?.id;
          const isStandby = amb.status === "STANDBY" || amb.status === "IDLE";
          const bearing = amb.heading ?? 0;

          return (
            <Marker
              key={amb.id}
              longitude={amb.location.lng}
              latitude={amb.location.lat}
              anchor="center"
              pitchAlignment="map"
              rotationAlignment="map"
              rotation={bearing}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                selectAmb(amb.id);
                setActiveAmbulanceId(amb.id);
              }}
            >
              <div
                className={`relative flex items-center justify-center cursor-pointer transition-transform ${
                  isSelected ? "scale-125 z-30" : "scale-100 hover:scale-110 z-20"
                }`}
              >
                {/* Sorot Lampu Depan Darurat (HANYA JIKA SEDANG BERTUGAS & BUKAN ARRIVED) */}
                {!isStandby && amb.status !== "ARRIVED" && (
                  <div className="absolute -top-12 w-8 h-12 bg-gradient-to-t from-yellow-200/50 to-transparent pointer-events-none" />
                )}

                {/* Aura Strobo Flashing (HANYA JIKA SEDANG BERTUGAS & BUKAN ARRIVED) */}
                {!isStandby && amb.status !== "ARRIVED" && (
                  <div
                    className={`absolute w-12 h-12 rounded-full opacity-60 animate-ping pointer-events-none ${
                      strobeState ? "bg-blue-500" : "bg-red-500"
                    }`}
                  />
                )}

                {/* Halo Highlight POV Aktif (Cyan Ring) - HAPUS PULSE JIKA ARRIVED */}
                {isSelected && (
                  <div
                    className={`absolute -inset-3 rounded-full border-2 pointer-events-none ring-4 shadow-lg ${
                      amb.status === "ARRIVED"
                        ? "border-emerald-400 ring-emerald-400/40 shadow-emerald-400/50"
                        : "border-cyan-400 animate-pulse ring-cyan-400/40 shadow-cyan-400"
                    }`}
                  />
                )}

                {/* Badan Ambulans Medis */}
                <div
                  className={`w-4 h-9 rounded-sm bg-white border-2 shadow-2xl relative flex flex-col items-center justify-between py-0.5 ${
                    amb.status === "ARRIVED"
                      ? "border-emerald-500 ring-2 ring-emerald-400"
                      : isSelected
                      ? "border-cyan-400 ring-2 ring-cyan-400"
                      : "border-red-600"
                  }`}
                >
                  {/* Kaca Depan */}
                  <div className="w-3 h-1.5 bg-gray-800 rounded-xs" />

                  {/* Lampu Sirene Strobo Atas (Mati saat Tiba) */}
                  <div className="flex gap-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-xs ${
                        amb.status === "ARRIVED"
                          ? "bg-gray-400"
                          : strobeState
                          ? "bg-blue-600 shadow-sm"
                          : "bg-red-600 shadow-sm"
                      }`}
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-xs ${
                        amb.status === "ARRIVED"
                          ? "bg-gray-400"
                          : strobeState
                          ? "bg-red-600 shadow-sm"
                          : "bg-blue-600 shadow-sm"
                      }`}
                    />
                  </div>

                  {/* Chevrons Belakang */}
                  <div
                    className="w-full h-1"
                    style={{ backgroundColor: amb.status === "ARRIVED" ? "#10B981" : amb.color || "#DC2626" }}
                  />
                </div>

                {/* Label Call Sign & Badge POV */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                  {amb.status === "ARRIVED" ? (
                    <div className="bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.2 rounded shadow-md border border-white flex items-center gap-1">
                      <span>✓ {amb.callSign} TIBA</span>
                    </div>
                  ) : isSelected ? (
                    <div className="bg-cyan-500 text-white text-[8px] font-bold px-1.5 py-0.2 rounded shadow-md border border-white animate-bounce flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5" />
                      <span>POV {amb.callSign}</span>
                    </div>
                  ) : (
                    <div className="bg-gray-900/90 text-white text-[7.5px] font-bold px-1 py-0.2 rounded shadow-xs border border-white/40">
                      {amb.callSign}
                    </div>
                  )}
                </div>
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* ── OVERLAY HUD KIRI ATAS: STATUS REAL-TIME (GLASSMORPHISM) ── */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-xs pointer-events-none">
        <div className="bg-white/85 backdrop-blur-md p-3.5 rounded-2xl border border-white/40 shadow-lg pointer-events-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">
              STATUS ARMADA
            </span>
            <span
              className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isArrived
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : anyDispatched
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isArrived ? "✓ TIBA DI RS" : anyDispatched ? "C.O.R.E. AKTIF" : "STANDBY"}
            </span>
          </div>

          <div className="text-xs text-slate-600 leading-snug">
            {isArrived ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>EVAKUASI SELESAI ({selectedAmb?.callSign})</span>
                </div>
                <div>Pasien berhasil dievakuasi ke RS tujuan. Koridor telah kembali ke siklus normal.</div>
              </div>
            ) : anyDispatched ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>KORIDOR C.O.R.E. TERKONTROL</span>
                </div>
                <div>Lampu lalu lintas otomatis beralih hijau untuk memberi prioritas darurat.</div>
              </div>
            ) : (
              <div>Seluruh unit bersiaga. Klik unit ambulans pada peta untuk melihat detail rute.</div>
            )}
          </div>
        </div>

        {/* Indikator Sinyal Prioritas vs Misi Selesai */}
        {isArrived ? (
          <div className="bg-white/85 backdrop-blur-md text-emerald-700 border border-white/40 px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2 pointer-events-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="text-xs font-semibold">
              ✓ MISI SELESAI - UNIT TELAH TIBA DI TUJUAN
            </div>
          </div>
        ) : anyDispatched ? (
          <div className="bg-white/85 backdrop-blur-md text-red-700 border border-white/40 px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2 pointer-events-auto animate-pulse">
            <ShieldCheck className="w-4 h-4 text-red-600 shrink-0" />
            <div className="text-xs font-semibold">
              SINYAL PRIORITAS TERTINGGI DIAKTIFKAN
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
