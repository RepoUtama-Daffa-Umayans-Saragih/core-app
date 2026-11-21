"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";

// ─── Tipe Data ────────────────────────────────────────────────────────────────

export type DispatchCode =
  | "STANDBY"
  | "IDLE"
  | "DISPATCHED_WAITING"
  | "EN_ROUTE"
  | "CODE_RED"
  | "CODE_YELLOW"
  | "ARRIVED";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Ambulance = {
  id:           string;
  callSign:     string;              // Contoh: "AMB-01"
  status:       DispatchCode;
  location:     Coordinates;         // Posisi real-time (simulasi)
  target:       Coordinates | null;  // Tujuan yang di-set operator
  radiusKm:     number;              // 1.0 = Code Red, 0.7 = Code Yellow
  heading?:     number;              // Sudut bearing hadap aspal (0-360)
  speedKmh?:    number;              // Kecepatan km/h
  progress?:    number;              // 0.0 s/d 1.0
  progressDistance?: number;         // Jarak tempuh km aktual
  totalLengthKm?: number;
  hospitalName?: string;             // Nama RS Tujuan
  startName?:   string;              // Titik Awal
  active?:      boolean;
  color?:       string;
};

export type CoreState = {
  activeMode:        "command" | "driver" | "simulation";
  ambulances:        Ambulance[];
  selectedAmbId:     string | null;   // Ambulans yang dipilih operator
  activeAmbulanceId: string | null;   // Ambulans aktif yang disorot kamera POV global
  dispatchCode:      DispatchCode;
  journeyActive:     boolean;         // Driver sudah tekan "Mulai Perjalanan"
  simulationRunning: boolean;         // Mode 3 canvas berjalan
};

// ─── Initial State & Koordinat Koridor Matraman - Salemba (RSCM) ───────────────

export const HOSPITAL_LOCATION: Coordinates = {
  lat: -6.1968,
  lng: 106.8465,
};

const INITIAL_AMBULANCES: Ambulance[] = [
  {
    id: "amb-01",
    callSign: "AMB-01",
    status: "STANDBY",
    location: { lat: -6.2115, lng: 106.8621 }, // Simpang Matraman / Pramuka
    target: { lat: -6.1968, lng: 106.8465 },
    radiusKm: 1.0,
    heading: 330,
    speedKmh: 0,
    progress: 0,
    startName: "Simpang Matraman Pramuka",
    hospitalName: "RSUD Dr. Cipto Mangunkusumo (IGD)",
    active: false,
    color: "#EF4444",
  },
  {
    id: "amb-02",
    callSign: "AMB-02",
    status: "STANDBY",
    location: { lat: -6.1950, lng: 106.8690 },
    target: { lat: -6.1968, lng: 106.8465 },
    radiusKm: 1.0,
    heading: 260,
    speedKmh: 0,
    progress: 0,
    startName: "Simpang Pramuka Timur",
    hospitalName: "RSUD Dr. Cipto Mangunkusumo (IGD)",
    active: false,
    color: "#3B82F6",
  },
  {
    id: "amb-03",
    callSign: "AMB-03",
    status: "STANDBY",
    location: { lat: -6.2085, lng: 106.8495 },
    target: { lat: -6.1968, lng: 106.8465 },
    radiusKm: 0.7,
    heading: 10,
    speedKmh: 0,
    progress: 0,
    startName: "Stasiun Manggarai Tambak",
    hospitalName: "RSUD Dr. Cipto Mangunkusumo (IGD)",
    active: false,
    color: "#10B981",
  },
];

const initialState: CoreState = {
  activeMode:        "command",
  ambulances:        INITIAL_AMBULANCES,
  selectedAmbId:     "amb-01",
  activeAmbulanceId: "amb-01",
  dispatchCode:      "STANDBY",
  journeyActive:     false,
  simulationRunning: false,
};

// ─── Action Types ─────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_MODE"; payload: CoreState["activeMode"] }
  | { type: "SELECT_AMBULANCE"; payload: string }
  | { type: "SET_ACTIVE_AMBULANCE_ID"; payload: string | null }
  | { type: "SET_AMBULANCES"; payload: Ambulance[] }
  | { type: "SET_TARGET"; payload: { ambId: string; coords: Coordinates } }
  | { type: "DISPATCH"; payload: { ambId: string; code: "CODE_RED" | "CODE_YELLOW" } }
  | { type: "START_JOURNEY"; payload?: { ambId?: string } }
  | {
      type: "UPDATE_LOCATION";
      payload: {
        ambId: string;
        coords: Coordinates;
        heading?: number;
        progress?: number;
        speedKmh?: number;
        progressDistance?: number;
      };
    }
  | { type: "ARRIVE"; payload?: { ambId?: string } }
  | { type: "TOGGLE_SIMULATION"; payload: boolean }
  | { type: "RESET_DISPATCH"; payload?: { ambId?: string } };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function coreReducer(state: CoreState, action: Action): CoreState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, activeMode: action.payload };

    case "SELECT_AMBULANCE": {
      const match = state.ambulances.find((a) => a.id === action.payload);
      return {
        ...state,
        selectedAmbId: action.payload,
        activeAmbulanceId: action.payload,
        dispatchCode: match?.status ?? "STANDBY",
      };
    }

    case "SET_ACTIVE_AMBULANCE_ID": {
      const match = state.ambulances.find((a) => a.id === action.payload);
      return {
        ...state,
        activeAmbulanceId: action.payload,
        selectedAmbId: action.payload ?? state.selectedAmbId,
        dispatchCode: match?.status ?? "STANDBY",
      };
    }

    case "SET_AMBULANCES":
      return {
        ...state,
        ambulances: action.payload,
      };

    case "SET_TARGET":
      return {
        ...state,
        ambulances: state.ambulances.map((a) =>
          a.id === action.payload.ambId
            ? { ...a, target: action.payload.coords }
            : a
        ),
      };

    case "DISPATCH": {
      const { ambId, code } = action.payload;
      const radiusKm = code === "CODE_RED" ? 1.0 : 0.7;
      return {
        ...state,
        selectedAmbId: ambId,
        activeAmbulanceId: ambId,
        dispatchCode: "DISPATCHED_WAITING",
        ambulances: state.ambulances.map((a) =>
          a.id === ambId
            ? { ...a, status: "DISPATCHED_WAITING", radiusKm, active: true, speedKmh: 0 }
            : a
        ),
      };
    }

    case "START_JOURNEY": {
      const targetId = action.payload?.ambId || state.activeAmbulanceId || state.selectedAmbId;
      return {
        ...state,
        journeyActive: true,
        dispatchCode: "EN_ROUTE",
        ambulances: state.ambulances.map((a) =>
          a.id === targetId
            ? { ...a, status: "EN_ROUTE", active: true, speedKmh: 65 }
            : a
        ),
      };
    }

    case "UPDATE_LOCATION":
      return {
        ...state,
        ambulances: state.ambulances.map((a) =>
          a.id === action.payload.ambId
            ? {
                ...a,
                location: action.payload.coords,
                heading: action.payload.heading ?? a.heading,
                progress: action.payload.progress ?? a.progress,
                progressDistance: action.payload.progressDistance ?? a.progressDistance,
                speedKmh: action.payload.speedKmh ?? a.speedKmh,
              }
            : a
        ),
      };

    case "ARRIVE": {
      const targetId = action.payload?.ambId || state.selectedAmbId || state.activeAmbulanceId;
      return {
        ...state,
        journeyActive: false,
        dispatchCode: "ARRIVED",
        ambulances: state.ambulances.map((a) =>
          a.id === targetId
            ? { ...a, status: "ARRIVED", target: null, speedKmh: 0, progress: 1.0 }
            : a
        ),
      };
    }

    case "TOGGLE_SIMULATION":
      return { ...state, simulationRunning: action.payload };

    case "RESET_DISPATCH": {
      const targetId = action.payload?.ambId;
      return {
        ...state,
        dispatchCode: "STANDBY",
        journeyActive: false,
        ambulances: state.ambulances.map((a) =>
          !targetId || a.id === targetId
            ? {
                ...a,
                status: "STANDBY",
                active: false,
                speedKmh: 0,
                progress: 0,
              }
            : a
        ),
      };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type CoreContextValue = {
  state: CoreState;
  dispatch: React.Dispatch<Action>;
  setMode: (mode: CoreState["activeMode"]) => void;
  selectAmb: (id: string) => void;
  setActiveAmbulanceId: (id: string | null) => void;
  setAmbulances: (ambs: Ambulance[]) => void;
  setTarget: (ambId: string, coords: Coordinates) => void;
  triggerDispatch: (ambId: string, code: "CODE_RED" | "CODE_YELLOW") => void;
  dispatchAmbulance: (ambId: string, code?: "CODE_RED" | "CODE_YELLOW") => void;
  startJourney: (ambId?: string) => void;
  updateLocation: (
    ambId: string,
    coords: Coordinates,
    heading?: number,
    progress?: number,
    speedKmh?: number,
    progressDistance?: number
  ) => void;
  resetDispatch: () => void;
};

const CoreContext = createContext<CoreContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(coreReducer, initialState);

  const setMode = useCallback((mode: CoreState["activeMode"]) => {
    dispatch({ type: "SET_MODE", payload: mode });
  }, []);

  const selectAmb = useCallback((id: string) => {
    dispatch({ type: "SELECT_AMBULANCE", payload: id });
  }, []);

  const setActiveAmbulanceId = useCallback((id: string | null) => {
    dispatch({ type: "SET_ACTIVE_AMBULANCE_ID", payload: id });
  }, []);

  const setAmbulances = useCallback((ambs: Ambulance[]) => {
    dispatch({ type: "SET_AMBULANCES", payload: ambs });
  }, []);

  const setTarget = useCallback((ambId: string, coords: Coordinates) => {
    dispatch({ type: "SET_TARGET", payload: { ambId, coords } });
  }, []);

  const triggerDispatch = useCallback((ambId: string, code: "CODE_RED" | "CODE_YELLOW") => {
    dispatch({ type: "DISPATCH", payload: { ambId, code } });
  }, []);

  const dispatchAmbulance = useCallback((ambId: string, code: "CODE_RED" | "CODE_YELLOW" = "CODE_RED") => {
    dispatch({ type: "DISPATCH", payload: { ambId, code } });
  }, []);

  const startJourney = useCallback((ambId?: string) => {
    dispatch({ type: "START_JOURNEY", payload: ambId ? { ambId } : undefined });
  }, []);

  const updateLocation = useCallback(
    (
      ambId: string,
      coords: Coordinates,
      heading?: number,
      progress?: number,
      speedKmh?: number,
      progressDistance?: number
    ) => {
      dispatch({
        type: "UPDATE_LOCATION",
        payload: { ambId, coords, heading, progress, speedKmh, progressDistance },
      });
    },
    []
  );

  const resetDispatch = useCallback(() => {
    dispatch({ type: "RESET_DISPATCH" });
  }, []);

  return (
    <CoreContext.Provider
      value={{
        state,
        dispatch,
        setMode,
        selectAmb,
        setActiveAmbulanceId,
        setAmbulances,
        setTarget,
        triggerDispatch,
        dispatchAmbulance,
        startJourney,
        updateLocation,
        resetDispatch,
      }}
    >
      {children}
    </CoreContext.Provider>
  );
}

// ─── Custom Hook ──────────────────────────────────────────────────────────────

export function useCore() {
  const ctx = useContext(CoreContext);
  if (!ctx) throw new Error("useCore must be used inside <CoreProvider>");
  return ctx;
}
