"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";

// ─── Tipe Data ────────────────────────────────────────────────────────────────

export type DispatchCode = "IDLE" | "CODE_RED" | "CODE_YELLOW" | "EN_ROUTE" | "ARRIVED";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type Ambulance = {
  id:       string;
  callSign: string;        // Contoh: "AMB-01"
  status:   DispatchCode;
  location: Coordinates;   // Posisi real-time (simulasi)
  target:   Coordinates | null;  // Tujuan yang di-set operator
  radiusKm: number;        // 1.0 = Code Red, 0.7 = Code Yellow
};

export type CoreState = {
  activeMode:        "command" | "driver" | "simulation";
  ambulances:        Ambulance[];
  selectedAmbId:     string | null;   // Ambulans yang dipilih operator
  dispatchCode:      DispatchCode;
  journeyActive:     boolean;         // Driver sudah tekan "Mulai Perjalanan"
  simulationRunning: boolean;         // Mode 3 canvas berjalan
};

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_AMBULANCES: Ambulance[] = [
  {
    id: "amb-01", callSign: "AMB-01", status: "IDLE",
    location: { lat: -6.2000, lng: 106.8166 },
    target: null, radiusKm: 1.0,
  },
  {
    id: "amb-02", callSign: "AMB-02", status: "IDLE",
    location: { lat: -6.1950, lng: 106.8200 },
    target: null, radiusKm: 1.0,
  },
  {
    id: "amb-03", callSign: "AMB-03", status: "IDLE",
    location: { lat: -6.2050, lng: 106.8120 },
    target: null, radiusKm: 0.7,
  },
];

const initialState: CoreState = {
  activeMode:        "command",
  ambulances:        INITIAL_AMBULANCES,
  selectedAmbId:     null,
  dispatchCode:      "IDLE",
  journeyActive:     false,
  simulationRunning: false,
};

// ─── Action Types ─────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_MODE";           payload: CoreState["activeMode"] }
  | { type: "SELECT_AMBULANCE";   payload: string }
  | { type: "SET_TARGET";         payload: { ambId: string; coords: Coordinates } }
  | { type: "DISPATCH";           payload: { ambId: string; code: "CODE_RED" | "CODE_YELLOW" } }
  | { type: "START_JOURNEY" }
  | { type: "UPDATE_LOCATION";    payload: { ambId: string; coords: Coordinates } }
  | { type: "ARRIVE" }
  | { type: "TOGGLE_SIMULATION";  payload: boolean }
  | { type: "RESET_DISPATCH" };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function coreReducer(state: CoreState, action: Action): CoreState {
  switch (action.type) {

    case "SET_MODE":
      return { ...state, activeMode: action.payload };

    case "SELECT_AMBULANCE":
      return { ...state, selectedAmbId: action.payload };

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
        dispatchCode: code,
        ambulances: state.ambulances.map((a) =>
          a.id === ambId
            ? { ...a, status: code, radiusKm }
            : a
        ),
      };
    }

    case "START_JOURNEY":
      return { ...state, journeyActive: true, dispatchCode: "EN_ROUTE" };

    case "UPDATE_LOCATION":
      return {
        ...state,
        ambulances: state.ambulances.map((a) =>
          a.id === action.payload.ambId
            ? { ...a, location: action.payload.coords }
            : a
        ),
      };

    case "ARRIVE":
      return {
        ...state,
        journeyActive: false,
        dispatchCode:  "ARRIVED",
        ambulances: state.ambulances.map((a) =>
          a.id === state.selectedAmbId
            ? { ...a, status: "ARRIVED", target: null }
            : a
        ),
      };

    case "TOGGLE_SIMULATION":
      return { ...state, simulationRunning: action.payload };

    case "RESET_DISPATCH":
      return {
        ...state,
        dispatchCode:  "IDLE",
        journeyActive: false,
        ambulances: state.ambulances.map((a) => ({ ...a, status: "IDLE", target: null })),
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type CoreContextValue = {
  state:           CoreState;
  dispatch:        React.Dispatch<Action>;
  setMode:         (mode: CoreState["activeMode"]) => void;
  selectAmb:       (id: string) => void;
  setTarget:       (ambId: string, coords: Coordinates) => void;
  triggerDispatch: (ambId: string, code: "CODE_RED" | "CODE_YELLOW") => void;
  startJourney:    () => void;
  updateLocation:  (ambId: string, coords: Coordinates) => void;
  resetDispatch:   () => void;
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

  const setTarget = useCallback((ambId: string, coords: Coordinates) => {
    dispatch({ type: "SET_TARGET", payload: { ambId, coords } });
  }, []);

  const triggerDispatch = useCallback((ambId: string, code: "CODE_RED" | "CODE_YELLOW") => {
    dispatch({ type: "DISPATCH", payload: { ambId, code } });
  }, []);

  const startJourney = useCallback(() => {
    dispatch({ type: "START_JOURNEY" });
  }, []);

  const updateLocation = useCallback((ambId: string, coords: Coordinates) => {
    dispatch({ type: "UPDATE_LOCATION", payload: { ambId, coords } });
  }, []);

  const resetDispatch = useCallback(() => {
    dispatch({ type: "RESET_DISPATCH" });
  }, []);

  return (
    <CoreContext.Provider value={{
      state, dispatch,
      setMode, selectAmb, setTarget,
      triggerDispatch, startJourney,
      updateLocation, resetDispatch,
    }}>
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
