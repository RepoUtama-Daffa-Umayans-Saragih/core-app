"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef, MarkerInstance } from "react-map-gl/mapbox";
import * as turf from "@turf/turf";
import { useCore, type DispatchCode, HOSPITAL_LOCATION } from "@/context/CoreContext";
import { useToast } from "@/components/ToastProvider";
import { AMBULANCE_ROUTES_POOL } from "@/utils/AmbulanceRoutesPool";
import {
  Hospital,
  Zap,
  Navigation2,
  ShieldCheck,
  AlertTriangle,
  Camera,
} from "lucide-react";
import {
  HOSPITAL_DESTINATIONS,
  TRAFFIC_LIGHTS_GEOJSON,
  type TrafficLightStatus,
  type TrafficLightPreemptionState,
} from "@/components/LiveSimulation";

export type MapPoint = {
  lat: number;
  lng: number;
};

// ─── KONFIGURASI MAPBOX ───────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function computeBearingAlong(
  routeLine: GeoJSON.Feature<GeoJSON.LineString>,
  distKm: number,
  totalKm: number
): number {
  const deltaKm = Math.min(0.008, Math.max(0.002, totalKm * 0.015));
  let ptA: [number, number];
  let ptB: [number, number];
  if (distKm + deltaKm <= totalKm) {
    const ptCurrent = turf.along(routeLine, distKm, { units: "kilometers" });
    const ptNext = turf.along(routeLine, distKm + deltaKm, { units: "kilometers" });
    ptA = [ptCurrent.geometry.coordinates[0], ptCurrent.geometry.coordinates[1]];
    ptB = [ptNext.geometry.coordinates[0], ptNext.geometry.coordinates[1]];
  } else {
    const ptPrev = turf.along(routeLine, Math.max(0, distKm - deltaKm), { units: "kilometers" });
    const ptCurrent = turf.along(routeLine, distKm, { units: "kilometers" });
    ptA = [ptPrev.geometry.coordinates[0], ptPrev.geometry.coordinates[1]];
    ptB = [ptCurrent.geometry.coordinates[0], ptCurrent.geometry.coordinates[1]];
  }
  const rawBearing = turf.bearing(ptA, ptB);
  return (rawBearing + 360) % 360;
}

export type HUDUpdateData = {
  eta: string;
  distanceKm: string;
  speedKmh: number;
  progress: number;
};

type Props = {
  ambPos?: MapPoint;
  startPos?: MapPoint;
  progress?: number;
  progressDistance?: number;
  dispatchCode?: DispatchCode;
  journeyActive?: boolean;
  onPositionUpdate?: (pos: MapPoint, bearing: number) => void;
  onHUDUpdate?: (hud: HUDUpdateData) => void;
  markerModel?: "ambulance" | "arrow";
};

const TOTAL_DURATION_MS = 45000; // 45 detik rute demonstrasi
const TOTAL_SECS = 45;

export default function DriverMockMap({
  startPos,
  onHUDUpdate,
  markerModel = "arrow",
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const activeMarkerRef = useRef<MarkerInstance | null>(null);

  const { state: coreState, setActiveAmbulanceId, selectAmb, updateLocation, dispatch } = useCore();
  const { addToast } = useToast();

  // Strobo sirene timer untuk efek visual strobo ambulans
  const [strobeState, setStrobeState] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setStrobeState((prev) => !prev);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // Temukan ambulans yang sedang aktif disorot POV
  const activeAmb = useMemo(() => {
    return (
      coreState.ambulances.find((a) => a.id === coreState.activeAmbulanceId) ||
      coreState.ambulances.find((a) => a.id === coreState.selectedAmbId) ||
      coreState.ambulances[0]
    );
  }, [coreState.ambulances, coreState.activeAmbulanceId, coreState.selectedAmbId]);

  const routeColor = activeAmb?.color || "#DC2626";

  // Ambil rute bawaan dari AMBULANCE_ROUTES_POOL
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

  // Rute Feature GeoJSON
  const routeLineFeature = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(() => {
    return {
      type: "Feature",
      properties: {},
      geometry: poolRoute.geometry,
    };
  }, [poolRoute]);

  const routeTotalKm = useMemo(() => {
    return turf.length(routeLineFeature, { units: "kilometers" }) || 2.45;
  }, [routeLineFeature]);

  // Injeksi Layer Bangunan 3D saat peta dimuat
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
      console.warn("Could not add 3D buildings layer in DriverMockMap:", e);
    }
  }, []);

  const activeAmbulanceId = coreState.activeAmbulanceId || activeAmb?.id || "amb-01";

  // ─── 1. FLY-TO & TOAST NOTIFICATION HANYA KETIKA activeAmbulanceId BERGANTI ───
  const prevActiveIdRef = useRef<string | null>(null);
  const isFlyingRef = useRef<boolean>(false);
  const flyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeAmbulanceId) return;

    if (prevActiveIdRef.current === null) {
      prevActiveIdRef.current = activeAmbulanceId;
      return;
    }

    if (prevActiveIdRef.current !== activeAmbulanceId) {
      prevActiveIdRef.current = activeAmbulanceId;
      isFlyingRef.current = true;
      if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current);

      const targetAmb = coreState.ambulances.find((a) => a.id === activeAmbulanceId);
      if (targetAmb && mapRef.current) {
        const mbMap = mapRef.current.getMap?.() || mapRef.current;
        mbMap.flyTo({
          center: [targetAmb.location.lng, targetAmb.location.lat],
          bearing: targetAmb.heading ?? 0,
          pitch: 55,
          zoom: 16.8,
          duration: 1500,
          essential: true,
        });

        addToast({
          type: "info",
          title: `🎥 Cinematic FlyTo: ${targetAmb.callSign}`,
          message: `Kamera beralih ke rute ${targetAmb.hospitalName || "RSUD Dr. Cipto"}`,
          duration: 2500,
        });
      }

      flyTimeoutRef.current = setTimeout(() => {
        isFlyingRef.current = false;
      }, 1500);
    }
  }, [coreState.activeAmbulanceId, coreState.ambulances, addToast]);

  // ─── 2. EVALUASI PREEMPTION LAMPU LALU LINTAS 3-STAGE (IDENTIK LIVE SIMULATION) ───
  const trafficLightsStatus = useMemo((): TrafficLightStatus[] => {
    return TRAFFIC_LIGHTS_GEOJSON.map((tl) => {
      // RESET LAMPU LALU LINTAS: Ambulans yang berstatus ARRIVED atau STANDBY tidak memancarkan override
      const activeAmbs = coreState.ambulances.filter(
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

        // < 300m dan di depan ambulans -> HIJAU
        if (dMeters < 300 && (isAhead || dMeters < 25)) {
          hasGreen = true;
          if (dMeters < closestDist) {
            closestDist = dMeters;
            triggeringCallSign = amb.callSign;
          }
        }
        // 300m - 500m dan di depan ambulans -> KUNING
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
  }, [coreState.ambulances]);

  // ─── 3. BYPASS REACT UNTUK 60FPS WEBGL & DYNAMIC LINE SLICING (turf.lineSliceAlong) ───
  const animStateRef = useRef({
    startTime: 0,
    progress: 0,
    distKm: 0,
    lastThrottleTime: 0,
    animId: null as number | null,
    currentLng: 106.8621,
    currentLat: -6.2115,
    currentHeading: 0,
  });

  const initCenter = useMemo<[number, number]>(() => {
    const pt0 = turf.along(routeLineFeature, 0, { units: "kilometers" });
    return [pt0.geometry.coordinates[0], pt0.geometry.coordinates[1]];
  }, [routeLineFeature]);

  useEffect(() => {
    // Jika bukan status EN_ROUTE, posisikan ke titik awal standby
    if (!activeAmb || activeAmb.status !== "EN_ROUTE") {
      if (animStateRef.current.animId) {
        cancelAnimationFrame(animStateRef.current.animId);
        animStateRef.current.animId = null;
      }

      const totalKm = routeTotalKm;
      const pt0 = turf.along(routeLineFeature, 0, { units: "kilometers" });
      const [initLng, initLat] = pt0.geometry.coordinates;
      const initBearing = computeBearingAlong(routeLineFeature, 0, totalKm);

      animStateRef.current.currentLng = initLng;
      animStateRef.current.currentLat = initLat;
      animStateRef.current.currentHeading = initBearing;

      if (activeMarkerRef.current) {
        activeMarkerRef.current.setLngLat([initLng, initLat]);
        activeMarkerRef.current.setRotation(initBearing);
      }

      const mbMap = mapRef.current?.getMap?.() || mapRef.current;
      if (mbMap) {
        try {
          const routeSrc = mbMap.getSource("ambulance-route") as mapboxgl.GeoJSONSource | undefined;
          if (routeSrc) {
            routeSrc.setData(routeLineFeature);
          }
          mbMap.easeTo({
            center: [initLng, initLat],
            bearing: initBearing,
            pitch: 55,
            duration: 0,
            animate: false,
          });
        } catch (e) {
          // Map source belum ready
        }
      }
      return;
    }

    // STATUS EN_ROUTE: Jalankan 60 FPS WebGL Animation Loop dengan turf.lineSliceAlong
    const totalKm = routeTotalKm;
    let startP = activeAmb.progress ?? 0;
    if (startP >= 0.99) startP = 0;

    animStateRef.current.startTime = performance.now() - startP * TOTAL_DURATION_MS;
    animStateRef.current.lastThrottleTime = performance.now();

    const loop = (now: number) => {
      const elapsed = now - animStateRef.current.startTime;
      const t = Math.min(elapsed / TOTAL_DURATION_MS, 1);
      const distKm = totalKm * t;
      animStateRef.current.progress = t;
      animStateRef.current.distKm = distKm;

      const currentPt = turf.along(routeLineFeature, distKm, { units: "kilometers" });
      const [lng, lat] = currentPt.geometry.coordinates;
      const heading = computeBearingAlong(routeLineFeature, distKm, totalKm);

      animStateRef.current.currentLng = lng;
      animStateRef.current.currentLat = lat;
      animStateRef.current.currentHeading = heading;

      // ─── LOGIKA WAJIB DIPERTAHANKAN: DYNAMIC LINE SLICING (turf.lineSliceAlong) ───
      let remainingRouteGeoJSON: GeoJSON.Feature<GeoJSON.LineString> | null = null;
      if (distKm < totalKm - 0.015) {
        try {
          remainingRouteGeoJSON = turf.lineSliceAlong(
            routeLineFeature,
            Math.max(0.0001, distKm),
            totalKm,
            { units: "kilometers" }
          );
        } catch (e) {
          remainingRouteGeoJSON = null;
        }
      } else {
        remainingRouteGeoJSON = turf.lineString([[lng, lat], [lng, lat]]);
      }

      // Update Native Marker & WebGL Memory secara langsung tanpa re-render React DOM
      if (activeMarkerRef.current) {
        activeMarkerRef.current.setLngLat([lng, lat]);
        activeMarkerRef.current.setRotation(heading);
      }

      const mbMap = mapRef.current?.getMap?.() || mapRef.current;
      if (mbMap && !isFlyingRef.current) {
        try {
          // Update sisa rute dinamis di aspal
          const routeSrc = mbMap.getSource("ambulance-route") as mapboxgl.GeoJSONSource | undefined;
          if (routeSrc && remainingRouteGeoJSON) {
            routeSrc.setData(remainingRouteGeoJSON);
          }

          // Smooth Pan Kamera Drone 3D (Pitch 55)
          mbMap.easeTo({
            center: [lng, lat],
            bearing: (heading - 5 + 360) % 360,
            pitch: 55,
            duration: 0,
            animate: false,
          });
        } catch (e) {
          // Transient WebGL error ignore
        }
      }

      // Update UI Teks Kiosk (ETA & Sisa Jarak) via throttled state (1 detik sekali)
      if (now - animStateRef.current.lastThrottleTime >= 1000) {
        animStateRef.current.lastThrottleTime = now;
        const remainingKm = Math.max(0, totalKm - distKm);
        const secs = Math.max(0, Math.round((1 - t) * TOTAL_SECS));
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const etaStr =
          secs <= 0
            ? "TIBA"
            : m > 0
            ? `${m}m ${s.toString().padStart(2, "0")}s`
            : `${s} detik`;

        onHUDUpdate?.({
          eta: etaStr,
          distanceKm: remainingKm.toFixed(2),
          speedKmh: 65,
          progress: t,
        });

        // Coarse location update ke CoreContext (1 Hz)
        updateLocation(activeAmb.id, { lat, lng }, heading, t, 65, distKm);
      }

      if (t < 0.995) {
        animStateRef.current.animId = requestAnimationFrame(loop);
      } else {
        animStateRef.current.animId = null;
        dispatch({ type: "ARRIVE", payload: { ambId: activeAmb.id } });
        addToast({
          type: "success",
          title: `✅ ${activeAmb.callSign} Tiba di RS`,
          message: `Pasien berhasil dievakuasi ke ${activeAmb.hospitalName || "RSUD Dr. Cipto"}.`,
          duration: 5000,
        });
      }
    };

    animStateRef.current.animId = requestAnimationFrame(loop);

    return () => {
      if (animStateRef.current.animId) {
        cancelAnimationFrame(animStateRef.current.animId);
        animStateRef.current.animId = null;
      }
    };
  }, [
    activeAmb?.id,
    activeAmb?.status,
    activeAmb?.callSign,
    activeAmb?.hospitalName,
    routeLineFeature,
    routeTotalKm,
    updateLocation,
    dispatch,
    addToast,
    onHUDUpdate,
  ]);

  const isStandby = !activeAmb || activeAmb.status === "STANDBY" || activeAmb.status === "IDLE";
  const isArrived = activeAmb?.status === "ARRIVED";

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl bg-[#0B0F19] border border-gray-800 shadow-xl select-none transition-none [&_.mapboxgl-canvas]:transition-none [&_.mapboxgl-canvas-container]:transition-none">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: initCenter[0],
          latitude: initCenter[1],
          zoom: 16.8,
          pitch: 55,
          bearing: 0,
        }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%", transition: "none" }}
        reuseMaps
        onLoad={handleMapLoad}
      >
        <NavigationControl position="top-right" showCompass showZoom={false} />

        {/* ── 1. LAYER SISA RUTE AKTIF (GAYA IDENTIK LIVE SIMULATION DENGAN LINE SLICING) ── */}
        <Source id="ambulance-route" type="geojson" data={routeLineFeature}>
          {/* Casing Putih Tebal untuk Kontras */}
          <Layer
            id="driver-route-casing"
            type="line"
            paint={{
              "line-color": "#FFFFFF",
              "line-width": 8,
              "line-opacity": 0.85,
            }}
          />
          {/* Glow Efek Navigasi */}
          <Layer
            id="driver-route-glow"
            type="line"
            paint={{
              "line-color": routeColor,
              "line-width": 14,
              "line-opacity": 0.5,
              "line-blur": 3,
            }}
          />
          {/* Garis Inti Rute */}
          <Layer
            id="driver-route-core"
            type="line"
            layout={{
              "line-cap": "round",
              "line-join": "round",
            }}
            paint={{
              "line-color": routeColor,
              "line-width": 5,
            }}
          />
        </Source>

        {/* ── 2. MARKER 3 RUMAH SAKIT UTAMA TUJUAN (IDENTIK LIVE SIMULATION) ── */}
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

        {/* ── 3. MARKER LAMPU LALU LINTAS 3-STAGE PREEMPTION (IDENTIK LIVE SIMULATION) ── */}
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

        {/* ── 4. MARKER AMBULANS AKTIF (POV DRIVER) - PERCABANGAN markerModel ('arrow' vs 'ambulance') ── */}
        <Marker
          ref={activeMarkerRef}
          longitude={animStateRef.current.currentLng}
          latitude={animStateRef.current.currentLat}
          anchor="center"
          pitchAlignment="map"
          rotationAlignment="map"
          rotation={animStateRef.current.currentHeading}
        >
          {markerModel === "arrow" ? (
            /* ── DESAIN PANAH NAVIGASI RAMPING (GOOGLE MAPS STYLE) ── */
            <div className="relative flex items-center justify-center cursor-pointer transition-none select-none">
              {/* Radar Pulse / Beacon Ring */}
              <div className="absolute w-14 h-14 rounded-full bg-blue-500/20 border border-blue-400/40 animate-ping pointer-events-none" />

              {/* Badan Panah Navigasi Minimalis Google Maps Style */}
              <div className="relative w-10 h-10 rounded-full bg-[#0055FF] border-2 border-white shadow-md flex items-center justify-center ring-2 ring-blue-500/30">
                {/* SVG Panah Navigasi Ramping Menghadap Atas */}
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 fill-white drop-shadow-sm transform -translate-y-0.5"
                >
                  <path d="M12 2L4 21l8-4 8 4L12 2z" />
                </svg>
              </div>

              {/* Badge CallSign di Atas Panah */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm text-slate-800 text-[8.5px] font-semibold px-2 py-0.5 rounded-full shadow-xs border border-slate-200/60 flex items-center gap-1">
                  <Navigation2 className="w-2.5 h-2.5 fill-blue-600 text-blue-600" />
                  <span>{activeAmb?.callSign || "AMB-01"}</span>
                </div>
              </div>
            </div>
          ) : (
            /* ── DESAIN AMBULANS 3D MEDIS (IDENTIK LIVE SIMULATION) ── */
            <div className="relative flex items-center justify-center cursor-pointer transition-none scale-125 z-30 select-none">
              {/* Sorot Lampu Depan Darurat (Mati jika ARRIVED) */}
              {!isStandby && !isArrived && (
                <div className="absolute -top-12 w-8 h-12 bg-gradient-to-t from-yellow-200/50 to-transparent pointer-events-none" />
              )}

              {/* Aura Strobo Flashing (Mati jika ARRIVED) */}
              {!isStandby && !isArrived && (
                <div
                  className={`absolute w-12 h-12 rounded-full opacity-60 animate-ping pointer-events-none ${
                    strobeState ? "bg-blue-500" : "bg-red-500"
                  }`}
                />
              )}

              {/* Halo Highlight POV Aktif - Tenang jika ARRIVED */}
              <div
                className={`absolute -inset-2.5 rounded-full border-2 pointer-events-none ring-2 ${
                  isArrived
                    ? "border-emerald-500 ring-emerald-200"
                    : "border-blue-500 ring-blue-200 animate-pulse"
                }`}
              />

              {/* Badan Ambulans Medis 3D */}
              <div
                className={`w-4 h-9 rounded-sm bg-white border-2 shadow-md relative flex flex-col items-center justify-between py-0.5 ${
                  isArrived
                    ? "border-emerald-500 ring-1 ring-emerald-400"
                    : "border-blue-600 ring-1 ring-blue-400"
                }`}
              >
                {/* Kaca Depan */}
                <div className="w-3 h-1.5 bg-gray-800 rounded-xs" />

                {/* Lampu Sirene Strobo Atas (Mati saat Tiba) */}
                <div className="flex gap-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-xs ${
                      isArrived
                        ? "bg-gray-400"
                        : strobeState
                        ? "bg-blue-600 shadow-sm"
                        : "bg-red-600 shadow-sm"
                    }`}
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-xs ${
                      isArrived
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
                  style={{ backgroundColor: isArrived ? "#10B981" : routeColor }}
                />
              </div>

              {/* Label Call Sign & Badge POV */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                {isArrived ? (
                  <div className="bg-emerald-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded-full shadow-xs border border-white/60 flex items-center gap-1">
                    <span>✓ {activeAmb?.callSign || "AMB-01"} TIBA</span>
                  </div>
                ) : (
                  <div className="bg-blue-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded-full shadow-xs border border-white/60 flex items-center gap-1">
                    <Camera className="w-2.5 h-2.5" />
                    <span>POV {activeAmb?.callSign || "AMB-01"}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Marker>

        {/* ── 5. RENDER ARMADA LAINNYA DI PETA (NON-POV ACTIVE) - IDENTIK LIVE SIMULATION ── */}
        {coreState.ambulances
          .filter((amb) => amb.id !== activeAmb?.id)
          .map((amb) => {
            const ambLng = amb.location?.lng ?? 106.8621;
            const ambLat = amb.location?.lat ?? -6.2115;
            const ambHeading = amb.heading ?? 0;
            const ambStandby = amb.status === "STANDBY" || amb.status === "IDLE";

            return (
              <Marker
                key={amb.id}
                longitude={ambLng}
                latitude={ambLat}
                anchor="center"
                pitchAlignment="map"
                rotationAlignment="map"
                rotation={ambHeading}
                onClick={() => {
                  setActiveAmbulanceId(amb.id);
                  selectAmb(amb.id);
                }}
              >
                <div className="relative flex items-center justify-center cursor-pointer transition-none scale-100 hover:scale-110 z-20">
                  {/* Aura Strobo Flashing untuk Armada Lain yang Berjalan */}
                  {!ambStandby && (
                    <div
                      className={`absolute w-10 h-10 rounded-full opacity-50 animate-ping pointer-events-none ${
                        strobeState ? "bg-blue-500" : "bg-red-500"
                      }`}
                    />
                  )}

                  {/* Badan Ambulans Medis */}
                  <div className="w-4 h-9 rounded-sm bg-white border-2 border-red-600 shadow-xl relative flex flex-col items-center justify-between py-0.5">
                    <div className="w-3 h-1.5 bg-gray-800 rounded-xs" />
                    <div className="flex gap-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-xs ${
                          strobeState ? "bg-blue-600 shadow-sm" : "bg-red-600 shadow-sm"
                        }`}
                      />
                      <span
                        className={`w-1.5 h-1.5 rounded-xs ${
                          strobeState ? "bg-red-600 shadow-sm" : "bg-blue-600 shadow-sm"
                        }`}
                      />
                    </div>
                    <div
                      className="w-full h-1"
                      style={{ backgroundColor: amb.color || "#3B82F6" }}
                    />
                  </div>

                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                    <div className="bg-gray-900/90 text-white text-[7.5px] font-bold px-1 py-0.2 rounded shadow-xs border border-white/40">
                      {amb.callSign}
                    </div>
                  </div>
                </div>
              </Marker>
            );
          })}
      </Map>

      {/* ── OVERLAY HUD STATUS KORIDOR (KANAN ATAS) ── */}
      <div className="absolute top-4 right-14 z-10 pointer-events-none">
        <div className="bg-white/85 backdrop-blur-md text-emerald-800 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-semibold pointer-events-auto border border-white/40">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>ZERO-BRAKE ACTIVE · 60 FPS WEBGL POV</span>
        </div>
      </div>
    </div>
  );
}
