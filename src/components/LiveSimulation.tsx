"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import * as turf from "@turf/turf";
import {
  Play,
  Square,
  Siren,
  Zap,
  RotateCcw,
  Activity,
  CheckCircle2,
  ShieldCheck,
  CloudRain,
  Sun,
  AlertTriangle,
  Sliders,
  Radio,
  Hospital,
  Car as CarIcon,
  Cpu,
  Gauge,
  Camera,
  Navigation2,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
} from "lucide-react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusBadge from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ToastProvider";
import { useCore, type Ambulance as CoreAmbulance, type DispatchCode } from "@/context/CoreContext";
import { getRandomRoadRoute, ROAD_NETWORK_GEOJSON, ROAD_ROUTES } from "@/utils/RoadNetwork";
import { AMBULANCE_ROUTES_POOL, type AmbulanceRoutePoolItem } from "@/utils/AmbulanceRoutesPool";

// ═══════════════════════════════════════════════════════════════════════════════
//  § 1. KONFIGURASI MAPBOX & RUMAH SAKIT KORIDOR SALEMBA
// ═══════════════════════════════════════════════════════════════════════════════

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ─── DAFTAR 3 RUMAH SAKIT UTAMA TUJUAN AMBULANS DI SALEMBA RAYA ───────────────
export const HOSPITAL_DESTINATIONS = [
  {
    id: "rscm",
    name: "RSUD Dr. Cipto Mangunkusumo (IGD)",
    shortName: "RSCM IGD",
    lat: -6.1968,
    lng: 106.8465,
    color: "#DC2626", // Merah
  },
  {
    id: "carolus",
    name: "RS St. Carolus (IGD Salemba)",
    shortName: "RS St. Carolus",
    lat: -6.1947,
    lng: 106.8492,
    color: "#2563EB", // Biru
  },
  {
    id: "radjak",
    name: "RS Radjak Hospital Salemba",
    shortName: "RS Radjak",
    lat: -6.1928,
    lng: 106.8485,
    color: "#7C3AED", // Ungu
  },
];

// ─── 4 TITIK LAMPU MERAH NYATA SEPANJANG KORIDOR MATRAMAN - SALEMBA (4 KM) ─────
export interface TrafficLightNode {
  id: string;
  name: string;
  lng: number;
  lat: number;
}

export type TrafficLightPreemptionState = "red" | "yellow" | "green";

export interface TrafficLightStatus extends TrafficLightNode {
  state: TrafficLightPreemptionState;
  distMeters: number;
  isAhead: boolean;
  triggeringAmbCallSign?: string;
}

export const TRAFFIC_LIGHTS_GEOJSON: TrafficLightNode[] = [
  {
    id: "tl-01",
    name: "Simpang Matraman - Pramuka",
    lng: 106.8583,
    lat: -6.2063,
  },
  {
    id: "tl-02",
    name: "Simpang Matraman - Slamet Riyadi",
    lng: 106.8534,
    lat: -6.2000,
  },
  {
    id: "tl-03",
    name: "Simpang Salemba - Raden Saleh",
    lng: 106.8462,
    lat: -6.2024,
  },
  {
    id: "tl-04",
    name: "Simpang Salemba - Diponegoro (RSCM)",
    lng: 106.8467,
    lat: -6.1983,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  § 2. GENERATOR IKON KENDARAAN WEBGL (SDF: TRUE)
// ═══════════════════════════════════════════════════════════════════════════════

type VehicleClass = "car" | "bus" | "truck" | "motorcycle";

function createVehicleIconImageData(vClass: VehicleClass): ImageData | null {
  if (typeof document === "undefined") return null;

  let width = 20;
  let height = 40;
  if (vClass === "motorcycle") {
    width = 12;
    height = 26;
  } else if (vClass === "bus") {
    width = 24;
    height = 64;
  } else if (vClass === "truck") {
    width = 24;
    height = 54;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";

  if (vClass === "motorcycle") {
    ctx.fillRect(4, 2, 4, 6);
    ctx.fillRect(2, 6, 8, 3);
    ctx.fillRect(3, 9, 6, 12);
    ctx.fillRect(4, 21, 4, 5);
  } else if (vClass === "bus") {
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(2, 2, width - 4, height - 4, 3);
    } else {
      ctx.rect(2, 2, width - 4, height - 4);
    }
    ctx.fill();

    ctx.clearRect(4, 5, width - 8, 6);
    for (let y = 14; y < height - 10; y += 7) {
      ctx.clearRect(3, y, 3, 4);
      ctx.clearRect(width - 6, y, 3, 4);
    }
    ctx.clearRect(5, height - 7, width - 10, 3);
  } else if (vClass === "truck") {
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(2, 2, width - 4, 16, 3);
    } else {
      ctx.rect(2, 2, width - 4, 16);
    }
    ctx.fill();
    ctx.clearRect(4, 5, width - 8, 5);

    ctx.fillRect(3, 19, width - 6, height - 21);
    ctx.clearRect(5, 21, width - 10, height - 25);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(5, 21, width - 10, height - 25);
  } else {
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(2, 2, width - 4, height - 4, 4);
    } else {
      ctx.rect(2, 2, width - 4, height - 4);
    }
    ctx.fill();

    ctx.clearRect(4, 8, width - 8, 6);
    ctx.clearRect(4, height - 12, width - 8, 4);
    ctx.clearRect(3, 15, 2, 7);
    ctx.clearRect(width - 5, 15, 2, 7);
  }

  return ctx.getImageData(0, 0, width, height);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  § 3. MODEL DATA SIMULASI MULTI-ARMADA AMBULANS
// ═══════════════════════════════════════════════════════════════════════════════

type RoadCondition = "dry" | "rain" | "extreme";
type TrafficDensity = "low" | "medium" | "jammed";

const getTargetVehicleCount = (density: TrafficDensity): number => {
  switch (density) {
    case "low":
      return 20;
    case "jammed":
      return 120;
    case "medium":
    default:
      return 60;
  }
};

function createGeofenceCircle(
  center: [number, number],
  radiusMeters: number,
  points = 48
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distLat = radiusMeters / 110574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([lng + distLng * Math.cos(theta), lat + distLat * Math.sin(theta)]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

interface VehicleNPC {
  id: number;
  vClass: VehicleClass;
  color: string;
  routeId: string;
  routeName: string;
  currentRoute: GeoJSON.Feature<GeoJSON.LineString>;
  totalLengthKm: number;
  progressDistance: number;
  progress: number;
  speedMps: number;
  baseSpeedMps: number;
  yielding: boolean;
  yieldProgress: number;
  yieldOffsetMeters: number;
  hazardBlink: boolean;
  hazardTimer: number;
  lng: number;
  lat: number;
  bearing: number;
}

export interface AmbulanceSim {
  id: string;
  callSign: string;
  status: DispatchCode;
  startName: string;
  hospitalName: string;
  hospitalCoords: { lat: number; lng: number };
  routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString>;
  totalLengthKm: number;
  progress: number;
  progressDistance: number;
  speedMps: number;
  lng: number;
  lat: number;
  bearing: number;
  strobeState: boolean;
  strobeTimer: number;
  geofenceRadiusMeters: number;
  active: boolean;
  color: string;
}

const NPC_COLORS = [
  "#2563EB", "#0284C7", "#D97706", "#4F46E5",
  "#059669", "#7C3AED", "#475569", "#DC2626",
  "#0D9488", "#334155", "#E11D48", "#0891B2"
];

const AMBULANCE_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"
];

// ═══════════════════════════════════════════════════════════════════════════════
//  § 4. KOMPONEN UTAMA DIGITAL TWIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function LiveSimulation() {
  const mapRef = useRef<MapRef | null>(null);
  const { addToast } = useToast();

  // Pengaturan Skenario Dinamis
  const [running, setRunning] = useState(true);
  const [simSpeed, setSimSpeed] = useState<number>(1); // [1x, 2x, 4x] Speed-Up
  const [roadCondition, setRoadCondition] = useState<RoadCondition>("dry");
  const [trafficDensity, setTrafficDensity] = useState<TrafficDensity>("medium");
  const [renderMode, setRenderMode] = useState<"geojson" | "markers">("geojson");

  // State UI Inspector & Advanced Settings
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [showAdvancedRender, setShowAdvancedRender] = useState(false);

  // Status Telemetri Real-Time
  const [coreActive, setCoreActive] = useState(false);
  const [vehiclesYieldingCount, setVehiclesYieldingCount] = useState(0);
  const [activeVehiclesCount, setActiveVehiclesCount] = useState(60);

  // Global Context C.O.R.E. Sync
  const {
    state: coreState,
    setActiveAmbulanceId: setGlobalActiveAmbId,
    setAmbulances: setGlobalAmbulances,
  } = useCore();

  // ─── STATE MULTI-AMBULANCE (HINGGA 8 UNIT) & POV CAMERA TRACKING ─────────────
  const [ambulances, setAmbulances] = useState<AmbulanceSim[]>([]);
  const [activeAmbulanceId, setActiveAmbulanceId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<"POV" | "VIEW_ALL">("POV");
  const prevZoomRef = useRef<number>(16.8);

  // State Kendaraan NPC
  const [npcVehicles, setNpcVehicles] = useState<VehicleNPC[]>([]);
  const [npcGeoJSON, setNpcGeoJSON] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: "FeatureCollection",
    features: [],
  });

  // Ref penampung state fisika untuk loop 60fps tanpa lagging atau stale closure
  const physicsState = useRef({
    get ambulances() { return this.ambulanceList; },
    set ambulances(v: AmbulanceSim[]) { this.ambulanceList = v; },
    get npcs() { return this.npcList; },
    set npcs(v: VehicleNPC[]) { this.npcList = v; },
    npcList: [] as VehicleNPC[],
    ambulanceList: [] as AmbulanceSim[],
    activeAmbulanceId: null as string | null,
    cameraMode: "POV" as "POV" | "VIEW_ALL",
    nextId: 1,
    spawnCooldown: 0,
    cycleTimer: 0,
    simSpeed: 1,
    trafficLight: "green" as "red" | "green",
    roadCondition: "dry" as RoadCondition,
    trafficDensity: "medium" as TrafficDensity,
    coreActive: false,
    lastFrameTime: 0,
    renderMode: "geojson" as "geojson" | "markers",
    running: true,
  });

  const stateRef = physicsState;

  physicsState.current.simSpeed = Math.max(0.25, simSpeed || 1);
  physicsState.current.running = running;
  physicsState.current.roadCondition = roadCondition;
  physicsState.current.trafficDensity = trafficDensity;
  physicsState.current.renderMode = renderMode;
  physicsState.current.activeAmbulanceId = activeAmbulanceId;
  physicsState.current.cameraMode = cameraMode;

  // Inisialisasi awal armada ambulans STANDBY di titik awal rute
  useEffect(() => {
    if (physicsState.current.ambulanceList.length === 0) {
      const initialAmbs: AmbulanceSim[] = AMBULANCE_ROUTES_POOL.slice(0, 3).map((item, idx) => {
        const routeLine: GeoJSON.Feature<GeoJSON.LineString> = {
          type: "Feature",
          properties: { id: item.id, callSign: item.callSign, hospitalName: item.hospitalName },
          geometry: item.geometry,
        };
        const lenKm = turf.length(routeLine, { units: "kilometers" });
        const pt0 = turf.along(routeLine, 0, { units: "kilometers" });
        const pt1 = turf.along(routeLine, Math.min(0.015, lenKm * 0.05), { units: "kilometers" });
        const bearing0 = (turf.bearing(
          [pt0.geometry.coordinates[0], pt0.geometry.coordinates[1]],
          [pt1.geometry.coordinates[0], pt1.geometry.coordinates[1]]
        ) + 360) % 360;

        return {
          id: `amb-${String(idx + 1).padStart(2, "0")}`,
          callSign: item.callSign,
          status: "STANDBY" as DispatchCode,
          startName: item.startName,
          hospitalName: item.hospitalName,
          hospitalCoords: item.hospitalCoords,
          routeGeoJSON: routeLine,
          totalLengthKm: lenKm,
          progress: 0,
          progressDistance: 0,
          speedMps: 0,
          lng: pt0.geometry.coordinates[0],
          lat: pt0.geometry.coordinates[1],
          bearing: bearing0,
          strobeState: false,
          strobeTimer: 0,
          geofenceRadiusMeters: 400,
          active: false,
          color: AMBULANCE_COLORS[idx % AMBULANCE_COLORS.length],
        };
      });

      physicsState.current.ambulanceList = initialAmbs;
      setAmbulances([...initialAmbs]);
      setActiveAmbulanceId(initialAmbs[0].id);
      physicsState.current.activeAmbulanceId = initialAmbs[0].id;
    }
  }, []);

  // Sinkronisasi status dispatch dari CoreContext (misal saat ditekan Dispatch Code Red di Command Center)
  useEffect(() => {
    let changed = false;
    for (const amb of coreState.ambulances) {
      const match = physicsState.current.ambulanceList.find(
        (a) => a.id === amb.id || a.callSign.toLowerCase() === amb.callSign.toLowerCase()
      );
      if (match) {
        if (match.status !== amb.status) {
          match.status = amb.status;
          changed = true;
        }
        if (amb.status === "EN_ROUTE") {
          match.active = true;
          if (match.speedMps === 0) match.speedMps = 18.5;
        } else if (amb.status === "DISPATCHED_WAITING") {
          match.active = false;
          match.speedMps = 0;
        } else if (amb.status === "STANDBY" || amb.status === "IDLE") {
          match.active = false;
          match.speedMps = 0;
          match.progress = 0;
          match.progressDistance = 0;
        }
      }
    }
    if (changed) {
      setAmbulances([...physicsState.current.ambulanceList]);
    }
  }, [coreState.ambulances]);

  // ─── GLOBAL PREEMPTION EVALUATION (BERDASARKAN AMBULANS TERDEKAT) ─────────────
  const trafficLightsStatus = useMemo((): TrafficLightStatus[] => {
    return TRAFFIC_LIGHTS_GEOJSON.map((tl) => {
      // RESET LAMPU LALU LINTAS: Ambulans yang berstatus ARRIVED atau STANDBY tidak lagi memancarkan override
      const activeAmbs = ambulances.filter(
        (a) => a.active && (a.status === "EN_ROUTE" || a.status === "CODE_RED")
      );
      if (activeAmbs.length === 0) {
        return { ...tl, state: "red", distMeters: 9999, isAhead: false };
      }

      let closestDist = 9999;
      let hasGreen = false;
      let hasYellow = false;
      let triggeringCallSign = "";

      for (const amb of activeAmbs) {
        const ambPt = turf.point([amb.lng, amb.lat]);
        const tlPt = turf.point([tl.lng, tl.lat]);
        const dMeters = turf.distance(ambPt, tlPt, { units: "kilometers" }) * 1000;

        const bearingToTL = (turf.bearing(ambPt, tlPt) + 360) % 360;
        const angleDiff = Math.abs(bearingToTL - amb.bearing);
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

      let state: TrafficLightPreemptionState = "red";
      if (hasGreen) state = "green";
      else if (hasYellow) state = "yellow";
      else state = "red";

      return {
        ...tl,
        state,
        distMeters: closestDist,
        isAhead: true,
        triggeringAmbCallSign: triggeringCallSign,
      };
    });
  }, [ambulances]);

  const activeGreenCount = useMemo(() => {
    return trafficLightsStatus.filter((t) => t.state === "green").length;
  }, [trafficLightsStatus]);

  const activeYellowCount = useMemo(() => {
    return trafficLightsStatus.filter((t) => t.state === "yellow").length;
  }, [trafficLightsStatus]);

  // Ambulans yang sedang aktif disorot kamera
  const activeAmbulance = useMemo(() => {
    if (cameraMode === "VIEW_ALL" || !activeAmbulanceId) return null;
    return (
      ambulances.find((a) => a.id === activeAmbulanceId && a.active) ||
      ambulances.find((a) => a.id === activeAmbulanceId) ||
      null
    );
  }, [ambulances, activeAmbulanceId, cameraMode]);

  // Sinkronisasi POV kamera jika diubah dari luar (misal Driver Kiosk / Command Center)
  useEffect(() => {
    if (cameraMode === "VIEW_ALL") return;
    if (coreState.activeAmbulanceId && coreState.activeAmbulanceId !== activeAmbulanceId) {
      setActiveAmbulanceId(coreState.activeAmbulanceId);
      stateRef.current.activeAmbulanceId = coreState.activeAmbulanceId;
      const target = stateRef.current.ambulanceList.find((a) => a.id === coreState.activeAmbulanceId);
      if (target && mapRef.current) {
        mapRef.current.flyTo({
          center: [target.lng, target.lat],
          zoom: 17,
          pitch: 55,
          bearing: target.bearing - 10,
          duration: 800,
        });
      }
    }
  }, [coreState.activeAmbulanceId, activeAmbulanceId, cameraMode]);

  // Inisiasi Mapbox: Daftarkan Ikon WebGL & Bangunan 3D
  const handleMapLoad = useCallback((evt: any) => {
    const map = evt.target;
    if (!map) return;
    map.resize();

    try {
      const vTypes: VehicleClass[] = ["car", "bus", "truck", "motorcycle"];
      for (const vt of vTypes) {
        const iconId = `${vt}-icon`;
        if (!map.hasImage(iconId)) {
          const imgData = createVehicleIconImageData(vt);
          if (imgData) {
            map.addImage(iconId, imgData, { sdf: true });
          }
        }
      }
    } catch (e) {
      console.warn("Could not register vehicle SDF icons:", e);
    }

    map.on("styleimagemissing", (e: any) => {
      const id = e.id;
      if (id && id.endsWith("-icon")) {
        const type = id.replace("-icon", "") as VehicleClass;
        if (!map.hasImage(id)) {
          const imgData = createVehicleIconImageData(type);
          if (imgData) {
            map.addImage(id, imgData, { sdf: true });
          }
        }
      }
    });

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
              "fill-extrusion-color": "#e2e8f0",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.75,
            },
          },
          labelLayerId
        );
      }
    } catch (e) {
      console.warn("Could not add 3D buildings layer:", e);
    }
  }, []);

  // ─── LOGIKA SPAWNING NPC DENGAN BIAS DI DEPAN AMBULANS ───────────────────────
  const spawnNPC = useCallback((initialProgressFraction = 0, forceAheadOfAmbulance = false, specificRoute?: GeoJSON.Feature<GeoJSON.LineString>) => {
    const s = stateRef.current;
    const maxNPC = getTargetVehicleCount(s.trafficDensity);
    if (s.npcList.length >= maxNPC) return;

    const activeAmbs = s.ambulanceList.filter((a) => a.active);
    const hasActiveAmb = activeAmbs.length > 0;

    let route: GeoJSON.Feature<GeoJSON.LineString>;
    let routeId: string;
    let routeName: string;
    let routeLenKm: number;
    let startDistKm: number;
    let clampedFraction: number;

    if (specificRoute) {
      route = specificRoute;
      routeLenKm = turf.length(route, { units: "kilometers" });
      routeId = (route.properties?.id as string) || "ambulance-corridor";
      routeName = "Koridor Ambulans Salemba";
      startDistKm = Math.min(0.20 + Math.random() * 0.25, routeLenKm - 0.05);
      clampedFraction = startDistKm / routeLenKm;
    } else if ((forceAheadOfAmbulance || (hasActiveAmb && Math.random() < 0.60)) && hasActiveAmb) {
      // Pilih secara acak salah satu ambulans yang sedang aktif
      const targetAmb = activeAmbs[Math.floor(Math.random() * activeAmbs.length)];
      route = targetAmb.routeGeoJSON;
      routeLenKm = targetAmb.totalLengthKm;
      routeId = "ambulance-corridor";
      routeName = `Koridor ${targetAmb.callSign}`;

      const ambDistKm = routeLenKm * targetAmb.progress;
      startDistKm = ambDistKm + (0.10 + Math.random() * 0.22);

      if (startDistKm >= routeLenKm - 0.05) {
        route = getRandomRoadRoute();
        routeLenKm = turf.length(route, { units: "kilometers" });
        routeId = (route.properties?.id as string) || "route";
        routeName = (route.properties?.name as string) || "Jalan Arteri";
        clampedFraction = Math.max(0, Math.min(initialProgressFraction || Math.random() * 0.8, 0.95));
        startDistKm = routeLenKm * clampedFraction;
      } else {
        clampedFraction = startDistKm / routeLenKm;
      }
    } else {
      route = getRandomRoadRoute();
      routeLenKm = turf.length(route, { units: "kilometers" });
      if (routeLenKm <= 0.05) return;
      routeId = (route.properties?.id as string) || "route";
      routeName = (route.properties?.name as string) || "Jalan Arteri";

      clampedFraction = Math.max(0, Math.min(initialProgressFraction, 0.95));
      startDistKm = routeLenKm * clampedFraction;
    }

    const vClasses: VehicleClass[] = ["car", "car", "car", "bus", "truck", "motorcycle", "motorcycle"];
    const vClass = vClasses[Math.floor(Math.random() * vClasses.length)];

    let baseSpeedMps = vClass === "car" ? 11.5 : vClass === "bus" ? 8.5 : vClass === "truck" ? 8.0 : 13.5;
    if (s.roadCondition === "rain") baseSpeedMps *= 0.8;
    if (s.roadCondition === "extreme") baseSpeedMps *= 0.65;

    const color = NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)];

    const initialPt = turf.along(route, startDistKm, { units: "kilometers" });
    const samplePt = turf.along(route, Math.min(routeLenKm, startDistKm + 0.015), { units: "kilometers" });
    const initBearing = (turf.bearing(
      [initialPt.geometry.coordinates[0], initialPt.geometry.coordinates[1]],
      [samplePt.geometry.coordinates[0], samplePt.geometry.coordinates[1]]
    ) + 360) % 360;

    const newNPC: VehicleNPC = {
      id: s.nextId++,
      vClass,
      color,
      routeId,
      routeName,
      currentRoute: route,
      totalLengthKm: routeLenKm,
      progressDistance: startDistKm,
      progress: clampedFraction,
      speedMps: baseSpeedMps,
      baseSpeedMps,
      yielding: false,
      yieldProgress: 0,
      yieldOffsetMeters: 0,
      hazardBlink: false,
      hazardTimer: 0,
      lng: initialPt.geometry.coordinates[0],
      lat: initialPt.geometry.coordinates[1],
      bearing: initBearing,
    };

    s.npcList.push(newNPC);
  }, []);

  // Pre-populasi Awal 60 Mobil
  useEffect(() => {
    const s = stateRef.current;
    if (s.npcList.length === 0) {
      for (let i = 0; i < 60; i++) {
        spawnNPC(0.05 + Math.random() * 0.85);
      }
      setNpcVehicles([...s.npcList]);
      setActiveVehiclesCount(s.npcList.length);
    }
  }, [spawnNPC]);

  // Handler Kepadatan Lalu Lintas
  const handleSetDensity = useCallback((density: TrafficDensity) => {
    setTrafficDensity(density);
    stateRef.current.trafficDensity = density;
    const target = getTargetVehicleCount(density);
    const s = stateRef.current;

    if (s.npcList.length > target) {
      s.npcList = s.npcList.slice(0, target);
    } else if (s.npcList.length < target) {
      const toAdd = target - s.npcList.length;
      for (let i = 0; i < toAdd; i++) {
        spawnNPC(Math.random() * 0.85);
      }
    }

    setNpcVehicles([...s.npcList]);
    setActiveVehiclesCount(s.npcList.length);
  }, [spawnNPC]);

  // ─── 3. LOGIKA SPAWN MULTI-AMBULANCE (MAKSIMAL 8 UNIT DENGAN REUSABLE SLOTS & ROUTES) ───
  const handleSpawnAmbulance = useCallback(() => {
    const s = stateRef.current;
    const MAX_AMBULANCES = 8;

    // 1. Single Source of Truth: Hitung HANYA ambulans yang benar-benar aktif saat ini
    const activeAmbs = s.ambulanceList.filter((a) => a.active);
    if (activeAmbs.length >= MAX_AMBULANCES) {
      addToast({
        type: "warning",
        title: "Armada Penuh (8/8 Unit)",
        message: "Maksimal 8 unit ambulans C.O.R.E. dapat aktif secara bersamaan.",
        duration: 3000,
      });
      return;
    }

    // 2. Cari nomor slot terkecil (1..8) yang TIDAK sedang aktif (Daur ulang slot kosong)
    const activeCallSigns = new Set(activeAmbs.map((a) => a.callSign));
    let targetSlot = 1;
    for (let i = 1; i <= MAX_AMBULANCES; i++) {
      const cs = `AMB-${String(i).padStart(2, "0")}`;
      if (!activeCallSigns.has(cs)) {
        targetSlot = i;
        break;
      }
    }

    const targetCallSign = `AMB-${String(targetSlot).padStart(2, "0")}`;
    const newAmbId = `amb-${String(targetSlot).padStart(2, "0")}`;

    // 3. Kumpulan routeId yang saat ini sedang dipakai oleh armada aktif
    const activeRouteIds = new Set(
      activeAmbs
        .map((a) => (a.routeGeoJSON?.properties as any)?.id)
        .filter(Boolean)
    );

    // Prioritaskan rute default untuk slot ini dari pool jika belum dipakai
    let poolItem = AMBULANCE_ROUTES_POOL.find(
      (r) => r.callSign === targetCallSign && !activeRouteIds.has(r.id)
    );
    // Jika rute default sedang terpakai, cari rute lain di pool yang belum terpakai
    if (!poolItem) {
      poolItem = AMBULANCE_ROUTES_POOL.find((r) => !activeRouteIds.has(r.id));
    }
    // Jika semua rute sedang dipakai (pool < 8), gunakan round-robin
    if (!poolItem) {
      poolItem = AMBULANCE_ROUTES_POOL[(targetSlot - 1) % AMBULANCE_ROUTES_POOL.length];
    }

    const routeLine: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {
        id: poolItem.id,
        callSign: targetCallSign,
        hospitalName: poolItem.hospitalName,
      },
      geometry: poolItem.geometry,
    };

    const routeLenKm = turf.length(routeLine, { units: "kilometers" });
    const initialPt = turf.along(routeLine, 0, { units: "kilometers" });
    const nextPt = turf.along(routeLine, Math.min(0.015, routeLenKm * 0.05), { units: "kilometers" });
    const initialBearing = (turf.bearing(
      [initialPt.geometry.coordinates[0], initialPt.geometry.coordinates[1]],
      [nextPt.geometry.coordinates[0], nextPt.geometry.coordinates[1]]
    ) + 360) % 360;

    const ambColor = AMBULANCE_COLORS[(targetSlot - 1) % AMBULANCE_COLORS.length];

    const newAmb: AmbulanceSim = {
      id: newAmbId,
      callSign: targetCallSign,
      status: "CODE_RED",
      startName: poolItem.startName,
      hospitalName: poolItem.hospitalName,
      hospitalCoords: poolItem.hospitalCoords,
      routeGeoJSON: routeLine,
      totalLengthKm: routeLenKm,
      progress: 0,
      progressDistance: 0,
      speedMps: 18.5, // ~66 km/h
      lng: initialPt.geometry.coordinates[0],
      lat: initialPt.geometry.coordinates[1],
      bearing: initialBearing,
      strobeState: false,
      strobeTimer: 0,
      geofenceRadiusMeters: 400,
      active: true,
      color: ambColor,
    };

    // Bersihkan instance lama dari slot ini (misal status STANDBY atau ARRIVED sebelumnya)
    // agar tidak terjadi duplicate key / duplicate layer di Mapbox & React DOM
    s.ambulanceList = s.ambulanceList.filter(
      (a) => a.id !== newAmbId && a.callSign !== targetCallSign
    );

    s.ambulanceList.push(newAmb);
    s.coreActive = true;
    setCoreActive(true);

    // Jika ini ambulans pertama dan mode kamera POV, otomatis set activeAmbulanceId ke ID ini
    if (s.cameraMode === "POV") {
      if (!s.activeAmbulanceId || !s.ambulanceList.some((a) => a.id === s.activeAmbulanceId && a.active)) {
        s.activeAmbulanceId = newAmb.id;
        setActiveAmbulanceId(newAmb.id);
        setGlobalActiveAmbId(newAmb.id);
      }
    }

    setAmbulances([...s.ambulanceList]);
    setGlobalAmbulances(
      s.ambulanceList.map((a) => ({
        id: a.id,
        callSign: a.callSign,
        status: a.active ? "EN_ROUTE" : "ARRIVED",
        location: { lat: a.lat, lng: a.lng },
        target: { lat: a.hospitalCoords.lat, lng: a.hospitalCoords.lng },
        radiusKm: 1.0,
        heading: a.bearing,
        speedKmh: Math.round(a.speedMps * 3.6),
        progress: a.progress,
        hospitalName: a.hospitalName,
        startName: a.startName,
        active: a.active,
        color: a.color,
      }))
    );

    // Injeksi 2 mobil tepat di depan rute ambulans ini
    for (let offset = 0.12; offset <= 0.28; offset += 0.08) {
      spawnNPC(0, true, routeLine);
    }

    const currentActiveCount = s.ambulanceList.filter((a) => a.active).length;
    addToast({
      type: "success",
      title: `🚑 ${targetCallSign} Meluncur! (${currentActiveCount}/8 Unit Aktif)`,
      message: `${poolItem.startName} ➔ ${poolItem.hospitalName}. Rute prioritas koridor Salemba Raya aktif!`,
      duration: 3500,
    });
  }, [addToast, spawnNPC, setGlobalActiveAmbId, setGlobalAmbulances]);

  // ─── 4. POV SWITCHING: GANTI AMBULANS YANG DISOROT KAMERA ────────────────────
  const handleSelectAmbulance = useCallback((ambId: string) => {
    setCameraMode("POV");
    stateRef.current.cameraMode = "POV";
    prevZoomRef.current = 16.8;
    setActiveAmbulanceId(ambId);
    setGlobalActiveAmbId(ambId);
    stateRef.current.activeAmbulanceId = ambId;

    const target = stateRef.current.ambulanceList.find((a) => a.id === ambId);
    if (target && mapRef.current) {
      mapRef.current.flyTo({
        center: [target.lng, target.lat],
        zoom: 17,
        pitch: 55,
        bearing: target.bearing - 10,
        duration: 800,
      });

      addToast({
        type: "info",
        title: `🎥 Kamera Beralih: ${target.callSign}`,
        message: `Mengikuti jalur ${target.startName} menuju ${target.hospitalName}.`,
        duration: 2500,
      });
    }
  }, [addToast, setGlobalActiveAmbId]);

  // ─── 4b. VIEW ALL: KAMERA BEBAS MELIHAT KESELURUHAN PETA ─────────────────────
  const handleSelectViewAll = useCallback((options?: { smoothFly?: boolean }) => {
    setCameraMode("VIEW_ALL");
    stateRef.current.cameraMode = "VIEW_ALL";
    setActiveAmbulanceId(null);
    stateRef.current.activeAmbulanceId = null;

    if (options?.smoothFly !== false && mapRef.current) {
      mapRef.current.flyTo({
        center: [106.8543, -6.2041],
        zoom: 14.2,
        pitch: 45,
        bearing: 0,
        duration: 800,
      });

      addToast({
        type: "info",
        title: "🌐 Mode: View All (Kamera Bebas)",
        message: "Kamera bebas. Anda dapat bebas zoom, rotate, dan menggeser peta.",
        duration: 2500,
      });
    }
  }, [addToast]);

  // ─── 4c. DETEKSI ZOOM-OUT USER UNTUK AUTO-SWITCH KE VIEW ALL ─────────────────
  const handleMapMoveOrZoom = useCallback((evt: any) => {
    // WAJIB cek evt.originalEvent agar easeTo/flyTo dari kode tidak memicu ini secara tidak sengaja
    if (!evt.originalEvent) return;

    const currentZoom = evt.viewState?.zoom ?? mapRef.current?.getZoom() ?? 16.8;

    if (stateRef.current.cameraMode === "POV") {
      // Jika kamera sedang dalam mode mengikuti ambulans dan user melakukan zoom-out
      if (currentZoom < 15.8 || currentZoom < prevZoomRef.current - 0.15) {
        setCameraMode("VIEW_ALL");
        stateRef.current.cameraMode = "VIEW_ALL";
        setActiveAmbulanceId(null);
        stateRef.current.activeAmbulanceId = null;
      }
    }

    prevZoomRef.current = currentZoom;
  }, []);

  // ─── RESET SELURUH SIMULASI ──────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const s = stateRef.current;
    s.npcList = [];
    s.activeAmbulanceId = null;
    s.cameraMode = "VIEW_ALL";
    setCameraMode("VIEW_ALL");
    s.coreActive = false;
    s.cycleTimer = 0;
    setCoreActive(false);
    setActiveAmbulanceId(null);
    setGlobalActiveAmbId(null);
    setVehiclesYieldingCount(0);

    // Reset seluruh armada ambulans ke kondisi awal (3 unit STANDBY di pangkalan)
    const initialAmbs: AmbulanceSim[] = AMBULANCE_ROUTES_POOL.slice(0, 3).map((item, idx) => {
      const routeLine: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: { id: item.id, callSign: item.callSign, hospitalName: item.hospitalName },
        geometry: item.geometry,
      };
      const lenKm = turf.length(routeLine, { units: "kilometers" });
      const pt0 = turf.along(routeLine, 0, { units: "kilometers" });
      const pt1 = turf.along(routeLine, Math.min(0.015, lenKm * 0.05), { units: "kilometers" });
      const bearing0 = (turf.bearing(
        [pt0.geometry.coordinates[0], pt0.geometry.coordinates[1]],
        [pt1.geometry.coordinates[0], pt1.geometry.coordinates[1]]
      ) + 360) % 360;

      return {
        id: `amb-${String(idx + 1).padStart(2, "0")}`,
        callSign: item.callSign,
        status: "STANDBY" as DispatchCode,
        startName: item.startName,
        hospitalName: item.hospitalName,
        hospitalCoords: item.hospitalCoords,
        routeGeoJSON: routeLine,
        totalLengthKm: lenKm,
        progress: 0,
        progressDistance: 0,
        speedMps: 0,
        lng: pt0.geometry.coordinates[0],
        lat: pt0.geometry.coordinates[1],
        bearing: bearing0,
        strobeState: false,
        strobeTimer: 0,
        geofenceRadiusMeters: 400,
        active: false,
        color: AMBULANCE_COLORS[idx % AMBULANCE_COLORS.length],
      };
    });

    s.ambulanceList = initialAmbs;
    setAmbulances([...initialAmbs]);
    setGlobalAmbulances(
      initialAmbs.map((a) => ({
        id: a.id,
        callSign: a.callSign,
        status: "ARRIVED",
        location: { lat: a.lat, lng: a.lng },
        target: { lat: a.hospitalCoords.lat, lng: a.hospitalCoords.lng },
        radiusKm: 1.0,
        heading: a.bearing,
        speedKmh: 0,
        progress: 0,
        hospitalName: a.hospitalName,
        startName: a.startName,
        active: false,
        color: a.color,
      }))
    );

    const target = getTargetVehicleCount(s.trafficDensity);
    for (let i = 0; i < target; i++) {
      spawnNPC(0.05 + Math.random() * 0.85);
    }

    setNpcVehicles([...s.npcList]);
    setActiveVehiclesCount(s.npcList.length);

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [106.8543, -6.2041],
        zoom: 14,
        pitch: 45,
        bearing: 0,
        duration: 1000,
      });
    }

    addToast({
      type: "info",
      title: "🔄 Simulasi Direset",
      message: `Seluruh armada ambulans & kendaraan dikembalikan ke kondisi awal.`,
      duration: 2500,
    });
  }, [addToast, spawnNPC]);

  // ═══════════════════════════════════════════════════════════════════════════════
  //  § 5. ENGINE FISIKA MULTI-ARMADA REAL-TIME (REQUEST ANIMATION FRAME)
  // ═══════════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    let animId: number;
    let hudThrottleCounter = 0;

    const loop = (timestamp: number) => {
      const s = stateRef.current;
      if (!s.lastFrameTime) s.lastFrameTime = timestamp;

      // Multiplier kecepatan simulasi [1x, 2x, 4x]
      const rawDt = Math.min((timestamp - s.lastFrameTime) / 1000, 0.08);
      const effectiveSimSpeed = Math.max(0.25, s.simSpeed || 1);
      const dt = rawDt * effectiveSimSpeed;
      s.lastFrameTime = timestamp;

      if (running) {
        // 1. Spawning NPC
        const targetMax = getTargetVehicleCount(s.trafficDensity);
        s.spawnCooldown += dt;
        if (s.spawnCooldown >= 0.45) {
          s.spawnCooldown = 0;
          if (s.npcList.length < targetMax) {
            const deficit = targetMax - s.npcList.length;
            const batch = Math.min(deficit, 2);
            for (let b = 0; b < batch; b++) {
              spawnNPC(0);
            }
          }
        }

        // 2. UPDATE FISIKA SETIAP AMBULANS DI DALAM ARMADA (KUNCI PARALELISME)
        const activeAmbs = s.ambulanceList.filter(
          (a) => a.active && a.status === "EN_ROUTE"
        );

        for (const amb of s.ambulanceList) {
          // KUNCI PARALELISME: Jika statusnya DISPATCHED_WAITING atau STANDBY, lewati (continue).
          // Ini menjamin AMB-01 bisa melaju kencang sementara AMB-02 masih diam menunggu drivernya menekan tombol "Start".
          if (amb.status === "STANDBY" || amb.status === "DISPATCHED_WAITING" || amb.status === "IDLE") {
            amb.speedMps = 0;
            continue; // LEWATI, JANGAN BERGERAK
          }
          if (amb.status !== "EN_ROUTE") {
            amb.speedMps = 0;
            continue;
          }

          amb.strobeTimer += dt;
          if (amb.strobeTimer > 0.1) {
            amb.strobeTimer = 0;
            amb.strobeState = !amb.strobeState;
          }

          const routeLenKm = amb.totalLengthKm;
          const ambPt = turf.point([amb.lng, amb.lat]);

          // Cek tabrakan terhadap mobil NPC yang belum sempat menepi atau ambulans lain di depan
          let minDistanceAhead = 999;
          for (const npc of s.npcList) {
            if (npc.yielding) continue; // Mobil menepi diabaikan
            const npcPt = turf.point([npc.lng, npc.lat]);
            const dMeters = turf.distance(ambPt, npcPt, { units: "kilometers" }) * 1000;
            const bearingToNPC = (turf.bearing(ambPt, npcPt) + 360) % 360;
            const angleDiff = Math.abs(bearingToNPC - amb.bearing);
            const isAhead = angleDiff < 65 || angleDiff > 295;

            if (isAhead && dMeters < minDistanceAhead) {
              minDistanceAhead = dMeters;
            }
          }

          // Cek jarak terhadap ambulans lain di depan pada rute bersinggungan
          for (const otherAmb of activeAmbs) {
            if (otherAmb.id === amb.id) continue;
            const oAmbPt = turf.point([otherAmb.lng, otherAmb.lat]);
            const dMeters = turf.distance(ambPt, oAmbPt, { units: "kilometers" }) * 1000;
            const bearingToOther = (turf.bearing(ambPt, oAmbPt) + 360) % 360;
            const angleDiff = Math.abs(bearingToOther - amb.bearing);
            const isAhead = angleDiff < 50 || angleDiff > 310;

            if (isAhead && dMeters < minDistanceAhead) {
              minDistanceAhead = dMeters;
            }
          }

          // Anti-Collision Safety
          const safeHeadway = s.roadCondition === "rain" ? 30 : 18;
          if (minDistanceAhead < 12) {
            amb.speedMps = Math.max(3.0, amb.speedMps - 22.0 * dt);
          } else if (minDistanceAhead < safeHeadway) {
            amb.speedMps = Math.max(7.0, amb.speedMps - 12.0 * dt);
          } else {
            amb.speedMps = Math.min(19.5, amb.speedMps + 8.0 * dt);
          }

          // Majukan progres jarak ambulans (progressDistance)
          amb.progressDistance += (amb.speedMps * dt) / 1000;
          amb.progress = Math.min(1.0, amb.progressDistance / routeLenKm);

          const clampedDist = Math.max(0, Math.min(amb.progressDistance, routeLenKm));
          const currentPt = turf.along(amb.routeGeoJSON, clampedDist, { units: "kilometers" });
          amb.lng = currentPt.geometry.coordinates[0];
          amb.lat = currentPt.geometry.coordinates[1];

          // Hitung bearing sudut hadap
          const deltaKm = Math.min(0.008, routeLenKm * 0.015);
          let ptA: [number, number];
          let ptB: [number, number];
          if (clampedDist + deltaKm <= routeLenKm) {
            ptA = [amb.lng, amb.lat];
            const nextPt = turf.along(amb.routeGeoJSON, clampedDist + deltaKm, { units: "kilometers" });
            ptB = [nextPt.geometry.coordinates[0], nextPt.geometry.coordinates[1]];
          } else {
            const prevPt = turf.along(amb.routeGeoJSON, Math.max(0, clampedDist - deltaKm), { units: "kilometers" });
            ptA = [prevPt.geometry.coordinates[0], prevPt.geometry.coordinates[1]];
            ptB = [amb.lng, amb.lat];
          }
          const rawBearing = turf.bearing(ptA, ptB);
          amb.bearing = (rawBearing + 360) % 360;

          // Cek Tiba di Rumah Sakit Tujuan
          if (amb.progress >= 0.985) {
            amb.active = false;
            amb.status = "ARRIVED";
            amb.speedMps = 0;

            addToast({
              type: "success",
              title: `✅ ${amb.callSign} Tiba di Tujuan!`,
              message: `Pasien berhasil dievakuasi ke ${amb.hospitalName}.`,
              duration: 5000,
            });

            // Jika ambulans yang tiba sedang aktif disorot, pindahkan kamera ke ambulans aktif lainnya
            if (s.activeAmbulanceId === amb.id) {
              const nextActive = s.ambulanceList.find((a) => a.active && a.status !== "STANDBY" && a.status !== "IDLE");
              if (nextActive && s.cameraMode === "POV") {
                s.activeAmbulanceId = nextActive.id;
                setActiveAmbulanceId(nextActive.id);
              } else {
                s.cameraMode = "VIEW_ALL";
                s.activeAmbulanceId = null;
                setActiveAmbulanceId(null);
                setCameraMode("VIEW_ALL");
              }
            }

            // Despawn dari armada & peta setelah 4 detik tiba di rumah sakit
            const arrivedAmbId = amb.id;
            setTimeout(() => {
              const existing = s.ambulanceList.find((a) => a.id === arrivedAmbId);
              if (existing && !existing.active && existing.status === "ARRIVED") {
                s.ambulanceList = s.ambulanceList.filter((a) => a.id !== arrivedAmbId);
                setAmbulances([...s.ambulanceList]);
                setGlobalAmbulances(
                  s.ambulanceList.map((a) => ({
                    id: a.id,
                    callSign: a.callSign,
                    status: a.active ? "EN_ROUTE" : "ARRIVED",
                    location: { lat: a.lat, lng: a.lng },
                    target: { lat: a.hospitalCoords.lat, lng: a.hospitalCoords.lng },
                    radiusKm: 1.0,
                    heading: a.bearing,
                    speedKmh: Math.round(a.speedMps * 3.6),
                    progress: a.progress,
                    hospitalName: a.hospitalName,
                    startName: a.startName,
                    active: a.active,
                    color: a.color,
                  }))
                );
              }
            }, 4000);
          }
        }

        // 3. KAMERA POV DYNAMIC TRACKING (IKAT POSISI & BEARING KE AMBULANS YANG DIPILIH - 60 FPS SMOOTH)
        if (s.cameraMode === "POV" && s.activeAmbulanceId) {
          const cameraTargetAmb =
            activeAmbs.find((a) => a.id === s.activeAmbulanceId) ||
            s.ambulanceList.find((a) => a.id === s.activeAmbulanceId && a.active);
          if (cameraTargetAmb && mapRef.current) {
            try {
              mapRef.current.easeTo({
                center: [cameraTargetAmb.lng, cameraTargetAmb.lat],
                zoom: 16.8,
                pitch: 55,
                bearing: (cameraTargetAmb.bearing - 10 + 360) % 360,
                duration: 0,
                animate: false,
              });
            } catch (e) {
              // Map belum siap
            }
          }
        }

        // 4. GLOBAL CLEARANCE PHYSICS: NPC MENEPI JIKA < 150M DARI AMBULANS MANA PUN
        let yieldingCount = 0;
        const brakingDistanceFactor = s.roadCondition === "rain" ? 1.75 : 1.0;

        for (let i = s.npcList.length - 1; i >= 0; i--) {
          const npc = s.npcList[i];

          const clampedDist = Math.max(0, Math.min(npc.progressDistance, npc.totalLengthKm));
          const currentPt = turf.along(npc.currentRoute, clampedDist, { units: "kilometers" });
          const baseLng = currentPt.geometry.coordinates[0];
          const baseLat = currentPt.geometry.coordinates[1];

          const deltaKm = Math.min(0.008, npc.totalLengthKm * 0.02);
          let ptA: [number, number];
          let ptB: [number, number];
          if (clampedDist + deltaKm <= npc.totalLengthKm) {
            ptA = [baseLng, baseLat];
            const nextPt = turf.along(npc.currentRoute, clampedDist + deltaKm, { units: "kilometers" });
            ptB = [nextPt.geometry.coordinates[0], nextPt.geometry.coordinates[1]];
          } else {
            const prevPt = turf.along(npc.currentRoute, Math.max(0, clampedDist - deltaKm), { units: "kilometers" });
            ptA = [prevPt.geometry.coordinates[0], prevPt.geometry.coordinates[1]];
            ptB = [baseLng, baseLat];
          }
          const rawBearing = turf.bearing(ptA, ptB);
          const baseBearing = (rawBearing + 360) % 360;

          // EVALUASI TERHADAP SELURUH AMBULANS YANG SEDANG AKTIF
          let isYielding = false;
          const basePt = turf.point([baseLng, baseLat]);

          for (const amb of activeAmbs) {
            const ambPt = turf.point([amb.lng, amb.lat]);
            const dMeters = turf.distance(ambPt, basePt, { units: "kilometers" }) * 1000;

            const bearingToNPC = (turf.bearing(ambPt, basePt) + 360) % 360;
            const angleDiff = Math.abs(bearingToNPC - amb.bearing);
            const isAhead = angleDiff < 85 || angleDiff > 275;

            // Jika dalam 150m di depan ambulans mana pun
            if (dMeters <= 150 && (isAhead || dMeters < 12)) {
              isYielding = true;
              break;
            }
          }

          npc.yielding = isYielding;

          if (npc.yielding) {
            yieldingCount++;
            npc.speedMps = 0;
            npc.yieldProgress = 1.0;

            npc.hazardTimer += dt;
            if (npc.hazardTimer > 0.18) {
              npc.hazardTimer = 0;
              npc.hazardBlink = !npc.hazardBlink;
            }

            // Lempar instan 8 meter ke kanan bahu aspal
            const centerPt = turf.point([baseLng, baseLat]);
            const offsetPoint = turf.destination(centerPt, 0.008, baseBearing + 90, {
              units: "kilometers",
            });
            npc.lng = offsetPoint.geometry.coordinates[0];
            npc.lat = offsetPoint.geometry.coordinates[1];
            npc.bearing = baseBearing;
          } else {
            // Recovery: kembali ke centerline aspal
            npc.yieldProgress = 0;
            npc.hazardBlink = false;
            npc.lng = baseLng;
            npc.lat = baseLat;
            npc.bearing = baseBearing;

            const accelRate = 4.0 / brakingDistanceFactor;
            if (npc.speedMps < npc.baseSpeedMps) {
              npc.speedMps += accelRate * dt;
            }
            npc.speedMps = Math.min(npc.speedMps, npc.baseSpeedMps);

            const distTravelledKm = (npc.speedMps * dt) / 1000;
            npc.progressDistance += distTravelledKm;
            npc.progress = Math.min(1.0, npc.progressDistance / npc.totalLengthKm);
          }

          if (npc.progressDistance >= npc.totalLengthKm - 0.015 || npc.progress >= 0.99) {
            s.npcList.splice(i, 1);
            continue;
          }
        }

        // 5. UPDATE GEOJSON SOURCE UNTUK RENDER WEBGL 60 FPS
        const geoJsonFeatures: GeoJSON.Feature<GeoJSON.Point>[] = s.npcList.map((npc) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [npc.lng, npc.lat],
          },
          properties: {
            id: npc.id,
            heading: npc.bearing,
            color: npc.color,
            vClass: npc.vClass,
            icon: `${npc.vClass}-icon`,
            yielding: npc.yielding,
            hazardBlink: npc.hazardBlink,
            speedKmh: Math.round(npc.speedMps * 3.6),
          },
        }));

        const featureCollection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
          type: "FeatureCollection",
          features: geoJsonFeatures,
        };

        if (mapRef.current) {
          try {
            const mbMap = mapRef.current.getMap?.() || mapRef.current;
            const src = mbMap.getSource("npc-vehicles-src") as any;
            if (src && typeof src.setData === "function") {
              src.setData(featureCollection);
            }
          } catch (e) {
            // Map belum siap
          }
        }

        hudThrottleCounter++;
        if (hudThrottleCounter % 6 === 0) {
          setVehiclesYieldingCount(yieldingCount);
          setActiveVehiclesCount(s.npcList.length);
          if (s.renderMode === "markers") {
            setNpcVehicles([...s.npcList]);
          }
          setAmbulances([...s.ambulanceList]);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [running, spawnNPC, addToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    mapRef.current?.resize();
  }, [isInspectorCollapsed]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 10 || MAPBOX_TOKEN.includes("ISI_TOKEN")) {
    return (
      <div className="relative w-full flex-1 min-h-[600px] flex items-center justify-center bg-red-50 border-2 border-red-400 rounded-xl">
        <div className="text-red-600 font-bold text-lg text-center">
          ⚠️ ERROR: MAPBOX TOKEN TIDAK VALID<br/>
          <span className="text-sm font-normal">Silakan isi variabel MAPBOX_TOKEN di dalam kode.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col md:flex-row h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[#F4F6F8] text-[#0F172A] select-none font-sans">
      {/* ── MOBILE BACKDROP ── */}
      {isMobileControlsOpen && (
        <div
          onClick={() => setIsMobileControlsOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* ── SIDEBAR PENGATURAN SKENARIO REAL-TIME (FLAT ENTERPRISE PANEL / MOBILE BOTTOM SHEET) ── */}
      {(isMobileControlsOpen || !isInspectorCollapsed) && (
        <aside
          className={`
            bg-white border-[#D8E0EA] flex flex-col p-0 overflow-y-auto transition-transform duration-200
            ${
              isMobileControlsOpen
                ? "fixed inset-x-0 bottom-0 z-40 max-h-[78dvh] rounded-t-2xl shadow-2xl border-t divide-y divide-[#D8E0EA] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
                : "hidden"
            }
            ${!isInspectorCollapsed ? "md:flex" : "md:hidden"}
            md:static md:w-[304px] md:shrink-0 md:border-r md:divide-y md:divide-[#D8E0EA] md:max-h-none md:rounded-none md:shadow-none md:border-t-0 md:pb-0
          `}
        >
          {/* Mobile-only sheet header with Grab Handle & Close Button */}
          <div className="flex items-center justify-between p-3 border-b border-[#D8E0EA] md:hidden relative bg-[#F8FAFC]">
            <div className="w-10 h-1 rounded-full bg-[#D8E0EA] absolute left-1/2 -translate-x-1/2 top-2" />
            <div className="flex items-center gap-1.5 pt-1">
              <span className="w-2 h-2 rounded-full bg-[#072F5F]" />
              <span className="text-xs font-bold text-[#0F172A] tracking-wide uppercase">
                KONTROL SIMULASI C.O.R.E.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileControlsOpen(false)}
              className="p-1 rounded-md text-[#556578] hover:text-[#0F172A] hover:bg-[#EEF2F6] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Header Modul (Desktop view) */}
          <div className="p-3.5 hidden md:flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#072F5F] animate-pulse shrink-0" />
              <div>
                <h2 className="text-xs font-bold text-[#0F172A] tracking-wider uppercase">
                  C.O.R.E. MULTI-FLEET
                </h2>
                <p className="text-[10px] text-[#556578] font-medium mt-0.5">
                  Manajemen Koridor Salemba Raya
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsInspectorCollapsed(true)}
              className="p-1 text-[#556578] hover:text-[#0F172A] hover:bg-[#F4F6F8] rounded transition-colors cursor-pointer"
              title="Lipat Panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Kontrol Engine & Kecepatan */}
          <div className="p-3.5 flex flex-col gap-2.5 shrink-0">
            <div className="text-[10px] text-[#556578] font-bold tracking-wider uppercase">
              Kontrol Engine
            </div>

            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg cursor-pointer font-semibold text-xs border transition-all ${
                running
                  ? "bg-white text-[#C81E1E] border-[#C81E1E]/30 hover:bg-[#FEF2F2]"
                  : "bg-white text-[#0F766E] border-[#0F766E]/30 hover:bg-[#ECFDF5]"
              }`}
            >
              {running ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current text-[#C81E1E]" />
                  <span>Jeda Simulasi</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current text-[#0F766E]" />
                  <span>Lanjutkan Simulasi</span>
                </>
              )}
            </button>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#556578] uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-[#072F5F]" /> Kecepatan
                </span>
              </div>

              <SegmentedControl
                fullWidth
                size="sm"
                value={simSpeed}
                onChange={(spd) => {
                  setSimSpeed(spd);
                  stateRef.current.simSpeed = spd;
                }}
                options={[
                  { value: 1, label: "1x" },
                  { value: 2, label: "2x" },
                  { value: 4, label: "4x" },
                ]}
              />
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg cursor-pointer text-xs text-[#556578] hover:text-[#0F172A] hover:bg-[#F4F6F8] border border-[#D8E0EA] transition-all font-medium"
            >
              <RotateCcw className="w-3 h-3" /> Reset Seluruh Armada & NPC
            </button>
          </div>

          {/* 3. Injeksi Multi-Ambulance (Hingga 8 Unit) */}
          <div className="p-3.5 flex flex-col gap-2.5 shrink-0">
            <div className="text-[10px] font-bold text-[#556578] tracking-wider uppercase">
              Armada C.O.R.E. AI
            </div>

            <button
              type="button"
              onClick={handleSpawnAmbulance}
              disabled={ambulances.filter((a) => a.active).length >= 8}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all shadow-xs ${
                ambulances.filter((a) => a.active).length >= 8
                  ? "opacity-50 cursor-not-allowed bg-gray-200 text-gray-500 border border-gray-300"
                  : "bg-[#C81E1E] hover:bg-[#B91C1C] text-white cursor-pointer active:scale-[0.99]"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Spawn Ambulance ({ambulances.filter((a) => a.active).length}/8)</span>
            </button>

            {/* Quick POV Camera Switcher */}
            {ambulances.filter((a) => a.active).length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#556578] uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3 h-3 text-[#072F5F]" /> Switch Kamera POV
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* Tombol View All (Kamera Bebas) */}
                  <button
                    type="button"
                    key="btn-view-all"
                    onClick={() => handleSelectViewAll()}
                    className={`py-1.5 px-2 rounded-md text-[10.5px] font-bold transition-all flex items-center justify-between border cursor-pointer ${
                      cameraMode === "VIEW_ALL"
                        ? "bg-[#E6F4F8] text-[#0B5D7A] border-[#0B5D7A]/50 ring-1 ring-[#0B5D7A]/30"
                        : "bg-white text-[#556578] border-[#D8E0EA] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Eye
                        className={`w-3 h-3 ${
                          cameraMode === "VIEW_ALL" ? "text-[#0B5D7A]" : "text-[#738396]"
                        }`}
                      />
                      <span>View All</span>
                    </span>
                    <span className="text-[9px] uppercase tracking-wider opacity-75">
                      Bebas
                    </span>
                  </button>

                  {ambulances
                    .filter((a) => a.active)
                    .map((amb) => {
                      const isSelected = cameraMode === "POV" && amb.id === activeAmbulanceId;
                      return (
                        <button
                          key={amb.id}
                          type="button"
                          onClick={() => handleSelectAmbulance(amb.id)}
                          className={`py-1.5 px-2 rounded-md text-[10.5px] font-bold transition-all flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? "bg-[#E6F4F8] text-[#0B5D7A] border-[#0B5D7A]/50 ring-1 ring-[#0B5D7A]/30"
                              : "bg-white text-[#556578] border-[#D8E0EA] hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: amb.color }}
                            />
                            <span>{amb.callSign}</span>
                          </span>
                          <span className="font-mono telemetry-num text-[10px] opacity-80">
                            {Math.round(amb.progress * 100)}%
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Skenario Kepadatan Lalu Lintas */}
          <div className="p-3.5 flex flex-col gap-2 shrink-0">
            <div className="text-[10px] font-bold text-[#556578] tracking-wider uppercase">
              Kepadatan Lalu Lintas
            </div>

            <SegmentedControl
              fullWidth
              size="sm"
              value={trafficDensity}
              onChange={(val) => handleSetDensity(val as TrafficDensity)}
              options={[
                { value: "low", label: "Rendah" },
                { value: "medium", label: "Sedang" },
                { value: "jammed", label: "Macet" },
              ]}
            />
          </div>

          {/* 5. Skenario Kondisi Jalan & Cuaca */}
          <div className="p-3.5 flex flex-col gap-2 shrink-0">
            <div className="text-[10px] font-bold text-[#556578] tracking-wider uppercase">
              Kondisi Jalan & Cuaca
            </div>

            <SegmentedControl
              fullWidth
              size="sm"
              value={roadCondition}
              onChange={(val) => setRoadCondition(val as RoadCondition)}
              options={[
                { value: "dry", label: "Normal" },
                { value: "rain", label: "Hujan" },
                { value: "extreme", label: "Ekstrem" },
              ]}
            />
          </div>

          {/* 6. Pengaturan Lanjutan (Collapsible Section) */}
          <div className="p-3.5 flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvancedRender((v) => !v)}
              className="flex items-center justify-between w-full text-[10px] font-bold text-[#556578] uppercase tracking-wider hover:text-[#0F172A] cursor-pointer"
            >
              <span>Pengaturan Lanjutan</span>
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  showAdvancedRender ? "rotate-90" : ""
                }`}
              />
            </button>

            {showAdvancedRender && (
              <div className="pt-1 flex flex-col gap-1.5">
                <div className="text-[10px] font-medium text-[#556578]">
                  Engine Render POV 3D
                </div>
                <SegmentedControl
                  fullWidth
                  size="sm"
                  value={renderMode}
                  onChange={(val) => setRenderMode(val as "geojson" | "markers")}
                  options={[
                    { value: "geojson", label: "WebGL GeoJSON" },
                    { value: "markers", label: "3D Markers" },
                  ]}
                />
              </div>
            )}
          </div>

          {/* 7. Live Telemetri (Key-Value Flat Rows) */}
          <div className="mt-auto bg-[#F8FAFC] p-3.5 border-t border-[#D8E0EA] flex flex-col gap-2 shrink-0 text-xs">
            <div className="text-[10px] font-bold text-[#556578] tracking-wider uppercase mb-0.5">
              Live Telemetri Koridor
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#556578]">Status Preemption</span>
              <div>
                {activeGreenCount > 0 ? (
                  <StatusBadge
                    status="EN_ROUTE"
                    label={`${activeGreenCount} Hijau`}
                    size="sm"
                  />
                ) : activeYellowCount > 0 ? (
                  <StatusBadge
                    status="CODE_YELLOW"
                    label={`${activeYellowCount} Clearance`}
                    size="sm"
                  />
                ) : (
                  <StatusBadge
                    status="STANDBY"
                    label="All Red"
                    size="sm"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#556578]">Mobil Menepi</span>
              <span className="font-mono font-bold telemetry-num text-[#0F172A]">
                {vehiclesYieldingCount} kendaraan
              </span>
            </div>

            {activeAmbulance && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[#556578]">POV: {activeAmbulance.callSign}</span>
                  <span className="font-mono font-bold telemetry-num text-[#0B5D7A]">
                    {Math.round(activeAmbulance.speedMps * 3.6)} km/h
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#556578]">Tujuan RS</span>
                  <span className="font-mono font-semibold telemetry-num text-[#0F172A] truncate max-w-[140px]">
                    {activeAmbulance.hospitalName.split(" ")[0]} ({Math.round(activeAmbulance.progress * 100)}%)
                  </span>
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {/* ── AREA MAPBOX DIGITAL TWIN UTAMA ── */}
      <main className="flex-1 p-2 md:p-3.5 flex flex-col min-h-0 bg-[#F4F6F8] relative">
        <div className="relative w-full flex-1 min-h-0 bg-gray-100 rounded-xl overflow-hidden border border-[#D8E0EA] shadow-xs">
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: 106.8543,
              latitude: -6.2041,
              zoom: 14,
              pitch: 45,
            }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: "100%", height: "100%" }}
            reuseMaps
            onLoad={handleMapLoad}
            onMove={handleMapMoveOrZoom}
            onZoom={handleMapMoveOrZoom}
            onError={(e) => console.error("Mapbox error:", e)}
          >
            <NavigationControl position="bottom-right" showCompass showZoom />

            {/* ── 1. LAYER GEOFENCE RADAR UNTUK SEMUA AMBULANS YANG SEDANG AKTIF (HILANG SAAT ARRIVED) ── */}
            {ambulances
              .filter(
                (a) =>
                  a.active &&
                  (a.status === "CODE_RED" || a.status === "EN_ROUTE")
              )
              .map((amb) => {
                const geoCircle = createGeofenceCircle([amb.lng, amb.lat], amb.geofenceRadiusMeters);
                return (
                  <Source key={`geofence-${amb.id}`} id={`geofence-src-${amb.id}`} type="geojson" data={geoCircle}>
                    <Layer
                      id={`geofence-fill-${amb.id}`}
                      type="fill"
                      paint={{
                        "fill-color": amb.color,
                        "fill-opacity": amb.id === activeAmbulanceId ? 0.16 : 0.08,
                      }}
                    />
                    <Layer
                      id={`geofence-line-${amb.id}`}
                      type="line"
                      paint={{
                        "line-color": amb.color,
                        "line-width": amb.id === activeAmbulanceId ? 2.5 : 1.5,
                        "line-dasharray": [3, 2],
                      }}
                    />
                  </Source>
                );
              })}

            {/* ── 2. LAYER RUTE DARI SELURUH AMBULANS YANG SEDANG AKTIF ── */}
            {ambulances
              .filter((a) => a.active && a.status !== "STANDBY" && a.status !== "IDLE")
              .map((amb) => {
                const isSelected = amb.id === activeAmbulanceId;
                return (
                  <Source key={`route-${amb.id}`} id={`route-src-${amb.id}`} type="geojson" data={amb.routeGeoJSON}>
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
                        "line-color": amb.color,
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
                        "line-color": amb.color,
                        "line-width": isSelected ? 5 : 3.5,
                      }}
                    />
                  </Source>
                );
              })}

            {/* ── 3. MARKER 3 RUMAH SAKIT UTAMA TUJUAN AMBULANS DI SALEMBA ── */}
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

            {/* ── 4. MARKER MULTIPLE TRAFFIC LIGHTS (GLOBAL 3-STAGE PREEMPTION) ── */}
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

            {/* ── 5. LAYER GEOJSON KENDARAAN NPC WEBGL (60 FPS, 3D MAP-ALIGNED) ── */}
            <Source id="npc-vehicles-src" type="geojson" data={npcGeoJSON}>
              <Layer
                id="npc-yielding-aura"
                type="circle"
                filter={["==", ["get", "yielding"], true]}
                layout={{
                  visibility: renderMode === "geojson" ? "visible" : "none",
                }}
                paint={{
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13, 8,
                    15, 16,
                    17, 24,
                  ],
                  "circle-color": "#F59E0B",
                  "circle-opacity": 0.55,
                  "circle-stroke-width": 2.5,
                  "circle-stroke-color": "#FEF08A",
                  "circle-pitch-alignment": "map",
                }}
              />

              <Layer
                id="npc-vehicles-symbol"
                type="symbol"
                layout={{
                  visibility: renderMode === "geojson" ? "visible" : "none",
                  "icon-image": ["get", "icon"],
                  "icon-pitch-alignment": "map",
                  "icon-rotation-alignment": "map",
                  "icon-rotate": ["get", "heading"],
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                  "icon-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13, 0.45,
                    15, 0.75,
                    17, 1.15,
                  ],
                }}
                paint={{
                  "icon-color": ["get", "color"],
                  "icon-opacity": [
                    "case",
                    ["==", ["get", "yielding"], true],
                    0.5,
                    1.0,
                  ],
                  "icon-halo-color": [
                    "case",
                    ["==", ["get", "yielding"], true],
                    "#FBBF24",
                    "#0F172A",
                  ],
                  "icon-halo-width": [
                    "case",
                    ["==", ["get", "yielding"], true],
                    2.8,
                    1.2,
                  ],
                }}
              />

              <Layer
                id="npc-yielding-text"
                type="symbol"
                filter={["==", ["get", "yielding"], true]}
                layout={{
                  visibility: renderMode === "geojson" ? "visible" : "none",
                  "text-field": "MENEPI (8M)",
                  "text-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14, 8,
                    16, 10,
                  ],
                  "text-offset": [0, -1.8],
                  "text-anchor": "bottom",
                  "text-pitch-alignment": "viewport",
                  "text-allow-overlap": true,
                  "text-ignore-placement": true,
                }}
                paint={{
                  "text-color": "#FFFFFF",
                  "text-halo-color": "#D97706",
                  "text-halo-width": 2,
                }}
              />
            </Source>

            {/* ── 6. RENDER ALTERNATIF: 3D DOM MARKERS ── */}
            {renderMode === "markers" &&
              npcVehicles.map((npc) => {
                const isMotor = npc.vClass === "motorcycle";
                const isBus = npc.vClass === "bus";
                const isTruck = npc.vClass === "truck";

                const widthPx = isMotor ? 8 : isBus ? 16 : isTruck ? 15 : 12;
                const lengthPx = isMotor ? 18 : isBus ? 46 : isTruck ? 36 : 24;

                return (
                  <Marker
                    key={npc.id}
                    longitude={npc.lng}
                    latitude={npc.lat}
                    anchor="center"
                    pitchAlignment="map"
                    rotationAlignment="map"
                    rotation={npc.bearing}
                  >
                    <div
                      className={`relative transition-all duration-150 ${
                        npc.yielding ? "opacity-50" : "opacity-100"
                      }`}
                    >
                      {npc.yielding && (
                        <>
                          <div className="absolute -inset-2 rounded-md bg-yellow-400/40 animate-ping pointer-events-none" />
                          <div className="absolute -inset-1 rounded-sm bg-amber-400/50 animate-pulse pointer-events-none ring-2 ring-yellow-400" />

                          <div
                            className={`absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full ${
                              npc.hazardBlink
                                ? "bg-amber-400 shadow-md shadow-amber-400 ring-2 ring-amber-300"
                                : "bg-amber-700/50"
                            }`}
                          />
                          <div
                            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                              npc.hazardBlink
                                ? "bg-amber-400 shadow-md shadow-amber-400 ring-2 ring-amber-300"
                                : "bg-amber-700/50"
                            }`}
                          />
                          <div
                            className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full ${
                              npc.hazardBlink
                                ? "bg-amber-400 shadow-md shadow-amber-400 ring-2 ring-amber-300"
                                : "bg-amber-700/50"
                            }`}
                          />
                          <div
                            className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full ${
                              npc.hazardBlink
                                ? "bg-amber-400 shadow-md shadow-amber-400 ring-2 ring-amber-300"
                                : "bg-amber-700/50"
                            }`}
                          />

                          <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.2 rounded shadow-xs uppercase tracking-wider animate-bounce pointer-events-none ring-1 ring-white">
                            MENEPI (8M)
                          </div>
                        </>
                      )}

                      <div
                        className={`rounded-xs border shadow-md relative ${
                          npc.yielding
                            ? "border-yellow-400 ring-2 ring-yellow-400/90 shadow-amber-400/50"
                            : "border-black/40"
                        }`}
                        style={{
                          width: `${widthPx}px`,
                          height: `${lengthPx}px`,
                          backgroundColor: npc.color,
                        }}
                      >
                        <div className="w-full h-1.5 bg-gray-900/80 mt-1" />
                        <div className="w-full h-1 bg-gray-900/60 absolute bottom-1" />
                      </div>
                    </div>
                  </Marker>
                );
              })}

            {/* ── 7. MARKER SELURUH ARMADA AMBULANS (CLICKABLE UNTUK POV SWITCHING) ── */}
            {ambulances.map((amb) => {
              const isSelected = amb.id === activeAmbulanceId;
              const isStandby = amb.status === "STANDBY" || amb.status === "IDLE";
              return (
                <Marker
                  key={amb.id}
                  longitude={amb.lng}
                  latitude={amb.lat}
                  anchor="center"
                  pitchAlignment="map"
                  rotationAlignment="map"
                  rotation={amb.bearing}
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    handleSelectAmbulance(amb.id);
                  }}
                >
                  <div
                    className={`relative flex items-center justify-center cursor-pointer transition-transform ${
                      isSelected ? "scale-125 z-30" : "scale-100 hover:scale-110 z-20"
                    }`}
                  >
                    {/* Sorot Lampu Depan Darurat (Mati jika ARRIVED) */}
                    {!isStandby && amb.status !== "ARRIVED" && (
                      <div className="absolute -top-12 w-8 h-12 bg-gradient-to-t from-yellow-200/50 to-transparent pointer-events-none" />
                    )}

                    {/* Aura Strobo Flashing (Mati jika ARRIVED) */}
                    {!isStandby && amb.status !== "ARRIVED" && (
                      <div
                        className={`absolute w-12 h-12 rounded-full opacity-60 animate-ping pointer-events-none ${
                          amb.strobeState ? "bg-blue-500" : "bg-red-500"
                        }`}
                      />
                    )}

                    {/* Halo Highlight POV Aktif (Cyan Ring) - Tenang jika ARRIVED */}
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
                          isSelected ? "border-cyan-400 ring-2 ring-cyan-400" : "border-red-600"
                        }`}
                      >
                        {/* Kaca Depan */}
                        <div className="w-3 h-1.5 bg-gray-800 rounded-xs" />

                        {/* Lampu Sirene Strobo Atas */}
                        <div className="flex gap-0.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-xs ${
                              amb.strobeState ? "bg-blue-600 shadow-sm" : "bg-red-600 shadow-sm"
                            }`}
                          />
                          <span
                            className={`w-1.5 h-1.5 rounded-xs ${
                              amb.strobeState ? "bg-red-600 shadow-sm" : "bg-blue-600 shadow-sm"
                            }`}
                          />
                        </div>

                        {/* Chevrons Belakang */}
                        <div
                          className="w-full h-1"
                          style={{ backgroundColor: amb.color }}
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

          {/* ── OVERLAY HUD ATAS PETA (POJOK KIRI ATAS) ── */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
            {isInspectorCollapsed && (
              <button
                type="button"
                onClick={() => setIsInspectorCollapsed(false)}
                className="pointer-events-auto hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-md border border-[#D8E0EA] rounded-lg shadow-sm text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-all cursor-pointer"
                title="Buka Panel Kontrol"
              >
                <Sliders className="w-3.5 h-3.5 text-[#072F5F]" />
                <span>Panel</span>
              </button>
            )}

            <div className="pointer-events-auto flex items-center gap-2 px-2.5 md:px-3 py-1 md:py-1.5 bg-white/90 backdrop-blur-md border border-[#D8E0EA] rounded-lg shadow-xs text-xs max-w-[calc(100vw-2rem)] md:max-w-none">
              <span className="w-2 h-2 rounded-full bg-[#0F766E] animate-pulse shrink-0" />
              <span className="font-bold text-[#072F5F] tracking-wide uppercase text-[10px] md:text-[11px] shrink-0">
                JAKARTA DIGITAL TWIN
              </span>
              <span className="text-[#D8E0EA]">|</span>
              <span className="text-[#556578] font-medium text-[10px] md:text-[11px] truncate max-w-[200px] md:max-w-[340px]">
                {cameraMode === "VIEW_ALL" ? (
                  <span>
                    Mode: <strong>View All</strong>
                  </span>
                ) : activeAmbulance ? (
                  <span>
                    POV: <strong className="text-[#0B5D7A]">{activeAmbulance.callSign}</strong> ➔ {activeAmbulance.hospitalName.split(" ")[0]}
                  </span>
                ) : (
                  <span>{ambulances.filter((a) => a.active).length}/8 Armada Aktif</span>
                )}
              </span>
            </div>
          </div>

          {/* ── MOBILE COMPACT PEEK BAR (md:hidden) ── */}
          <div className="md:hidden absolute bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur-md border-t border-[#D8E0EA] px-4 py-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="p-1.5 rounded-md border border-[#D8E0EA] bg-[#F8FAFC] text-[#0F172A] cursor-pointer"
                title={running ? "Jeda" : "Lanjutkan"}
              >
                {running ? (
                  <Square className="w-3.5 h-3.5 fill-current text-[#C81E1E]" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current text-[#0F766E]" />
                )}
              </button>
              <span className="text-xs font-bold text-[#0F172A] truncate">
                {activeAmbulance ? activeAmbulance.callSign : `${ambulances.filter((a) => a.active).length}/8 Aktif`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileControlsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#072F5F] text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <span>Kontrol Simulasi</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
