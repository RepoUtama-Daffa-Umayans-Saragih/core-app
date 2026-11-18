"use client";

import { useCore } from "@/context/CoreContext";
import CommandCenter from "@/components/CommandCenter";
import DriverKiosk from "@/components/DriverKiosk";
import LiveSimulation from "@/components/LiveSimulation";

export default function HomePage() {
  const { state } = useCore();
  return (
    <>
      {state.activeMode === "command"    && <CommandCenter />}
      {state.activeMode === "driver"     && <DriverKiosk />}
      {state.activeMode === "simulation" && <LiveSimulation />}
    </>
  );
}
