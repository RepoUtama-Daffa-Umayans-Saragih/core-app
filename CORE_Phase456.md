# 🚦 C.O.R.E. MVP — Tahap 4+5+6: Live 2D Canvas Simulation

> [!IMPORTANT]
> Tahap ini membuat **1 file besar** (`LiveSimulation.tsx`) dan **mengupdate 1 file** (`page.tsx`).
> Seluruh engine simulasi (physics, rendering, AI) ada dalam satu file, terpisah bersih dari React.

---

## File yang dibuat di Tahap ini

```
src/
└── components/
    └── LiveSimulation.tsx    ← Engine simulasi lengkap (~650 baris)
src/app/
    └── page.tsx              ← Update: import LiveSimulation
```

---

## ① `src/components/LiveSimulation.tsx`

```tsx
// src/components/LiveSimulation.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Play, Square, Siren, Zap, RotateCcw,
  Activity, Shield, Car,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

// ═══════════════════════════════════════════════════════════
//  § 1. CONSTANTS
// ═══════════════════════════════════════════════════════════

const W = 800, H = 600;
const CX = W / 2, CY = H / 2;    // canvas center (400, 300)
const RH = 65;                    // road half-width → full road = 130px
const LO = 20;                    // lane offset from center line
const GEO_R = 185;                // geofence radius in px

const CAR_W = 18, CAR_H = 30;    // NPC car box
const AMB_W = 22, AMB_H = 38;    // ambulance box

const MIN_HEADWAY  = 52;          // minimum gap between cars (px)
const MAX_CARS     = 10;
const SPAWN_FRAMES = 165;         // frames between car spawns (~2.75s @60fps)
const CAR_SPD_MIN  = 90;
const CAR_SPD_MAX  = 150;         // px / second
const AMB_SPD      = 165;         // px / second

// Phase durations: [NS-green, NS-yellow, EW-green, EW-yellow] in ms
const PHASE_MS: [number, number, number, number] = [5000, 1200, 5000, 1200];

const PALETTE = [
  "#4A90E2","#7B61FF","#50FA7B","#FF6B35",
  "#A8DADC","#E63946","#2EC4B6","#F7B731",
  "#8338EC","#FB5607","#3A86FF","#FFBE0B",
];

// ═══════════════════════════════════════════════════════════
//  § 2. TYPES
// ═══════════════════════════════════════════════════════════

type Dir = "S" | "N" | "E" | "W";
// S = going DOWN  (spawns at top,   y increases)
// N = going UP    (spawns at bottom, y decreases)
// E = going RIGHT (spawns at left,   x increases)
// W = going LEFT  (spawns at right,  x decreases)

type Sig = "red" | "yellow" | "green";

interface NPCar {
  id:     number;
  x:      number;
  y:      number;
  dir:    Dir;
  color:  string;
  spd:    number;   // px/sec base speed
  active: boolean;
}

interface AmbObj {
  x:       number;
  y:       number;
  spd:     number;
  inGeo:   boolean;   // inside geofence circle
  exited:  boolean;   // off the right side of canvas
  flash:   boolean;   // alternating siren color
  flashT:  number;    // ms since last flash toggle
}

interface FlashRing {
  r:     number;    // current radius
  maxR:  number;
  alpha: number;    // 1 → 0
}

interface SimState {
  running: boolean;
  cars:    NPCar[];
  amb:     AmbObj | null;
  coreOn:  boolean;

  phase:  0 | 1 | 2 | 3;
  phaseT: number;             // ms elapsed in current phase
  savedPhase: 0 | 1 | 2 | 3; // snapshot when CORE activates
  savedT:     number;

  sig: Record<Dir, Sig>;

  nextId:  number;
  spawnT:  number;    // frame counter
  lastTs:  number;    // last RAF timestamp
  rafId:   number | null;

  rings:       FlashRing[];
  coreEvents:  number;
  carsCleared: number;
}

// ═══════════════════════════════════════════════════════════
//  § 3. PURE GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════

/** Rounded rect path helper (avoids CanvasRenderingContext2D.roundRect compat issues) */
function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/** Spawn (x, y) for each direction — off screen */
function spawnXY(dir: Dir): { x: number; y: number } {
  switch (dir) {
    case "S": return { x: CX + LO, y: -60 };
    case "N": return { x: CX - LO, y: H + 60 };
    case "E": return { x: -60,     y: CY + LO };
    case "W": return { x: W + 60,  y: CY - LO };
  }
}

/** True if car's front hasn't reached the intersection stop line yet */
function beforeStop(car: NPCar): boolean {
  switch (car.dir) {
    case "S": return car.y + CAR_H / 2 < CY - RH;
    case "N": return car.y - CAR_H / 2 > CY + RH;
    case "E": return car.x + CAR_W / 2 < CX - RH;
    case "W": return car.x - CAR_W / 2 > CX + RH;
  }
}

/** True if car has exited the visible canvas */
function offCanvas(car: NPCar): boolean {
  switch (car.dir) {
    case "S": return car.y - CAR_H > H + 30;
    case "N": return car.y + CAR_H < -30;
    case "E": return car.x - CAR_W > W + 30;
    case "W": return car.x + CAR_W < -30;
  }
}

/** Euclidean distance from canvas center */
function distCenter(x: number, y: number): number {
  return Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
}

/**
 * Find the nearest car directly ahead of `car` in the same lane.
 * "Ahead" means further in the direction of travel.
 */
function getLeader(car: NPCar, all: NPCar[]): NPCar | null {
  const peers = all.filter((c) => c.id !== car.id && c.dir === car.dir && c.active);
  switch (car.dir) {
    case "S": {
      // ahead = larger y; same x (within car width)
      const fwd = peers.filter((c) => c.y > car.y && Math.abs(c.x - car.x) < CAR_W + 2);
      return fwd.reduce<NPCar | null>((cl, c) => (!cl || c.y < cl.y ? c : cl), null);
    }
    case "N": {
      const fwd = peers.filter((c) => c.y < car.y && Math.abs(c.x - car.x) < CAR_W + 2);
      return fwd.reduce<NPCar | null>((cl, c) => (!cl || c.y > cl.y ? c : cl), null);
    }
    case "E": {
      const fwd = peers.filter((c) => c.x > car.x && Math.abs(c.y - car.y) < CAR_H + 2);
      return fwd.reduce<NPCar | null>((cl, c) => (!cl || c.x < cl.x ? c : cl), null);
    }
    case "W": {
      const fwd = peers.filter((c) => c.x < car.x && Math.abs(c.y - car.y) < CAR_H + 2);
      return fwd.reduce<NPCar | null>((cl, c) => (!cl || c.x > cl.x ? c : cl), null);
    }
  }
}

/** Bumper-to-bumper gap between car and its leader */
function headwayGap(car: NPCar, leader: NPCar): number {
  switch (car.dir) {
    case "S": return leader.y - CAR_H / 2 - (car.y + CAR_H / 2);
    case "N": return (car.y - CAR_H / 2) - (leader.y + CAR_H / 2);
    case "E": return leader.x - CAR_W / 2 - (car.x + CAR_W / 2);
    case "W": return (car.x - CAR_W / 2) - (leader.x + CAR_W / 2);
    default:   return 999;
  }
}

/** Map 4-phase cycle index → all 4 direction signals */
function phaseToSig(p: 0 | 1 | 2 | 3): Record<Dir, Sig> {
  switch (p) {
    case 0: return { S: "green",  N: "green",  E: "red",    W: "red"    };
    case 1: return { S: "yellow", N: "yellow", E: "red",    W: "red"    };
    case 2: return { S: "red",    N: "red",    E: "green",  W: "green"  };
    case 3: return { S: "red",    N: "red",    E: "yellow", W: "yellow" };
  }
}

// ═══════════════════════════════════════════════════════════
//  § 4. SPAWNING
// ═══════════════════════════════════════════════════════════

const DIRS: Dir[] = ["S", "N", "E", "W"];

function trySpawn(sim: SimState): void {
  if (sim.cars.filter((c) => c.active).length >= MAX_CARS) return;

  const dir = DIRS[Math.floor(Math.random() * 4)];
  const pos = spawnXY(dir);

  // Don't spawn if spawn point blocked
  const blocked = sim.cars.some((c) => {
    if (c.dir !== dir || !c.active) return false;
    return Math.abs(c.x - pos.x) < CAR_W * 3.5
        && Math.abs(c.y - pos.y) < CAR_H * 3.5;
  });
  if (blocked) return;

  sim.cars.push({
    id:     sim.nextId++,
    x:      pos.x,
    y:      pos.y,
    dir,
    color:  PALETTE[Math.floor(Math.random() * PALETTE.length)],
    spd:    CAR_SPD_MIN + Math.random() * (CAR_SPD_MAX - CAR_SPD_MIN),
    active: true,
  });
}

// ═══════════════════════════════════════════════════════════
//  § 5. SIMULATION UPDATE (runs every RAF frame)
// ═══════════════════════════════════════════════════════════

function updateSim(sim: SimState, dt: number): void {

  // ── 5a. Traffic light cycle (frozen when CORE active) ──
  if (!sim.coreOn) {
    sim.phaseT += dt;
    while (sim.phaseT >= PHASE_MS[sim.phase]) {
      sim.phaseT -= PHASE_MS[sim.phase];
      sim.phase = ((sim.phase + 1) % 4) as 0 | 1 | 2 | 3;
    }
    sim.sig = phaseToSig(sim.phase);
  }

  // ── 5b. Ambulance update ──
  if (sim.amb && !sim.amb.exited) {
    const amb = sim.amb;

    // Flashing siren (every 350ms)
    amb.flashT += dt;
    if (amb.flashT > 350) { amb.flash = !amb.flash; amb.flashT = 0; }

    const dist = distCenter(amb.x, amb.y);

    // ── GEOFENCE ENTRY ──
    if (!amb.inGeo && dist < GEO_R) {
      amb.inGeo = true;
      sim.coreOn = true;
      sim.savedPhase = sim.phase;
      sim.savedT     = sim.phaseT;
      sim.coreEvents++;

      // Override: ambulance lane (East) = GREEN; cross traffic = RED
      sim.sig = { S: "red", N: "red", E: "green", W: "red" };

      // Clear E-direction NPCs between ambulance and intersection
      // (they "pull over" to let ambulance through)
      sim.cars = sim.cars.filter((c) => {
        if (c.dir === "E" && c.x > amb.x && c.x < CX) return false;
        return true;
      });

      // Spawn expanding flash ring
      sim.rings.push({ r: 15, maxR: GEO_R, alpha: 1 });
    }

    // ── GEOFENCE EXIT (after passing intersection center) ──
    if (amb.inGeo && amb.x > CX && dist > GEO_R) {
      amb.inGeo  = false;
      sim.coreOn = false;
      sim.phase  = sim.savedPhase;
      sim.phaseT = sim.savedT;
      sim.sig    = phaseToSig(sim.phase);
    }

    // Move east at constant speed
    amb.x += (amb.spd * dt) / 1000;

    // Off-screen → cleanup
    if (amb.x - AMB_W > W + 50) {
      amb.exited = true;
      if (sim.coreOn) {
        sim.coreOn = false;
        sim.phase  = sim.savedPhase;
        sim.phaseT = sim.savedT;
        sim.sig    = phaseToSig(sim.phase);
      }
    }
  }

  // ── 5c. Flash ring animation ──
  sim.rings = sim.rings
    .map((r) => ({
      ...r,
      r:     r.r + (dt / 1000) * 160,
      alpha: r.alpha - (dt / 1000) * 1.6,
    }))
    .filter((r) => r.alpha > 0);

  // ── 5d. NPC car physics ──
  for (const car of sim.cars) {
    if (!car.active) continue;

    const sig        = sim.sig[car.dir];
    const atRedLight = (sig === "red" || sig === "yellow") && beforeStop(car);
    if (atRedLight) continue;                        // 🛑 Stop at red

    const leader = getLeader(car, sim.cars);
    if (leader && headwayGap(car, leader) < MIN_HEADWAY) continue; // 🛑 Too close

    // Move at base speed
    const d = (car.spd * dt) / 1000;
    switch (car.dir) {
      case "S": car.y += d; break;
      case "N": car.y -= d; break;
      case "E": car.x += d; break;
      case "W": car.x -= d; break;
    }

    if (offCanvas(car)) {
      car.active = false;
      sim.carsCleared++;
    }
  }

  sim.cars = sim.cars.filter((c) => c.active);

  // ── 5e. Spawn timer ──
  sim.spawnT++;
  if (sim.spawnT >= SPAWN_FRAMES) {
    sim.spawnT = 0;
    trySpawn(sim);
  }
}

// ═══════════════════════════════════════════════════════════
//  § 6. DRAW FUNCTIONS (pure canvas, no React)
// ═══════════════════════════════════════════════════════════

function drawBackground(ctx: CanvasRenderingContext2D): void {
  // Deep asphalt base
  ctx.fillStyle = "#0d0d1a";
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = "#ffffff04";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawRoads(ctx: CanvasRenderingContext2D): void {
  // Road surfaces
  ctx.fillStyle = "#1c1c30";
  ctx.fillRect(CX - RH, 0,       RH * 2, H);   // vertical
  ctx.fillRect(0,       CY - RH, W,      RH * 2); // horizontal

  // Intersection box (slightly lighter)
  ctx.fillStyle = "#242440";
  ctx.fillRect(CX - RH, CY - RH, RH * 2, RH * 2);

  // Road edge lines
  ctx.strokeStyle = "#ffffff12";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  // Vertical road edges (above & below intersection)
  [[CX - RH, 0], [CX + RH, 0]].forEach(([x]) => {
    ctx.beginPath(); ctx.moveTo(x, 0);        ctx.lineTo(x, CY - RH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, CY + RH);  ctx.lineTo(x, H);       ctx.stroke();
  });
  // Horizontal road edges (left & right of intersection)
  [[CY - RH], [CY + RH]].forEach(([y]) => {
    ctx.beginPath(); ctx.moveTo(0,       y); ctx.lineTo(CX - RH, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CX + RH, y); ctx.lineTo(W,       y); ctx.stroke();
  });

  // Center dashed yellow lines
  ctx.strokeStyle = "#ffcc0055";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([18, 14]);
  // Vertical center
  ctx.beginPath(); ctx.moveTo(CX, 0);       ctx.lineTo(CX, CY - RH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX, CY + RH); ctx.lineTo(CX, H);       ctx.stroke();
  // Horizontal center
  ctx.beginPath(); ctx.moveTo(0,       CY); ctx.lineTo(CX - RH, CY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX + RH, CY); ctx.lineTo(W,       CY); ctx.stroke();
  ctx.setLineDash([]);

  // Stop lines (white solid, only on the half each direction uses)
  ctx.strokeStyle = "#ffffff99";
  ctx.lineWidth = 3;
  // South approach (cars from N, go down — right lane x > CX)
  ctx.beginPath(); ctx.moveTo(CX,       CY - RH); ctx.lineTo(CX + RH, CY - RH); ctx.stroke();
  // North approach (cars from S, go up — left lane x < CX)
  ctx.beginPath(); ctx.moveTo(CX - RH, CY + RH); ctx.lineTo(CX,       CY + RH); ctx.stroke();
  // East approach (cars from W, go right — bottom lane y > CY)
  ctx.beginPath(); ctx.moveTo(CX - RH, CY);       ctx.lineTo(CX - RH, CY + RH); ctx.stroke();
  // West approach (cars from E, go left — top lane y < CY)
  ctx.beginPath(); ctx.moveTo(CX + RH, CY - RH); ctx.lineTo(CX + RH, CY);       ctx.stroke();

  // Crosswalk stripes
  ctx.fillStyle = "#ffffff14";
  const sw = 7, nStripes = 5;
  const crossLen = RH * 2 / nStripes;
  // North crosswalk
  for (let i = 0; i < nStripes; i++)
    ctx.fillRect(CX - RH + i * crossLen, CY - RH - 18, sw, 18);
  // South crosswalk
  for (let i = 0; i < nStripes; i++)
    ctx.fillRect(CX - RH + i * crossLen, CY + RH, sw, 18);
  // West crosswalk
  for (let i = 0; i < nStripes; i++)
    ctx.fillRect(CX - RH - 18, CY - RH + i * crossLen, 18, sw);
  // East crosswalk
  for (let i = 0; i < nStripes; i++)
    ctx.fillRect(CX + RH, CY - RH + i * crossLen, 18, sw);
}

function drawGeofence(ctx: CanvasRenderingContext2D, coreOn: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, GEO_R, 0, Math.PI * 2);

  if (coreOn) {
    ctx.fillStyle   = "rgba(0,255,156,0.04)";
    ctx.fill();
    ctx.strokeStyle = "#00FF9C";
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 20;
    ctx.shadowColor = "#00FF9C";
  } else {
    ctx.strokeStyle = "#495AEE44";
    ctx.lineWidth   = 1;
  }
  ctx.setLineDash([9, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  ctx.font      = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = coreOn ? "#00FF9CAA" : "#495AEE55";
  ctx.fillText(
    coreOn ? "⚡ GEOFENCE ACTIVE" : `GEOFENCE Ø${GEO_R * 2}px`,
    CX, CY - GEO_R - 8
  );
  ctx.restore();
}

function drawFlashRings(ctx: CanvasRenderingContext2D, rings: FlashRing[]): void {
  ctx.save();
  for (const ring of rings) {
    ctx.beginPath();
    ctx.arc(CX, CY, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,255,156,${ring.alpha.toFixed(3)})`;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrafficLight(
  ctx:   CanvasRenderingContext2D,
  x:     number,
  y:     number,
  sig:   Sig,
  label: string,
): void {
  const bw = 16, bh = 50;

  ctx.save();

  // Housing
  rRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 4);
  ctx.fillStyle = "#111125";
  ctx.fill();
  ctx.strokeStyle = "#ffffff15";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3 light circles: red (top), yellow (middle), green (bottom)
  const bulbs: { sig: Sig; color: string; dy: number }[] = [
    { sig: "red",    color: "#FF4C4C", dy: -16 },
    { sig: "yellow", color: "#FFC107", dy:   0 },
    { sig: "green",  color: "#00FF9C", dy:  16 },
  ];

  for (const bulb of bulbs) {
    const active = sig === bulb.sig;
    ctx.beginPath();
    ctx.arc(x, y + bulb.dy, 5, 0, Math.PI * 2);
    if (active) {
      ctx.fillStyle  = bulb.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = bulb.color;
    } else {
      ctx.fillStyle  = "#1a1a1a";
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Label below
  ctx.font      = "bold 7px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#929BEC55";
  ctx.fillText(label, x, y + bh / 2 + 10);

  ctx.restore();
}

function drawCar(ctx: CanvasRenderingContext2D, car: NPCar): void {
  ctx.save();
  ctx.translate(car.x, car.y);

  const angles: Record<Dir, number> = {
    N: 0,           // front UP  — no rotation
    S: Math.PI,     // front DOWN
    E: Math.PI / 2, // front RIGHT
    W: -Math.PI / 2,// front LEFT
  };
  ctx.rotate(angles[car.dir]);

  const w = CAR_W, h = CAR_H;

  // Body
  rRect(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.fillStyle = car.color;
  ctx.fill();

  // Windshield (front = top after rotation)
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 3.2);

  // Rear window
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(-w / 2 + 2, h / 2 - h / 4, w - 4, h / 4 - 2);

  // Headlights (front top)
  ctx.fillStyle = "#ffffcc";
  ctx.fillRect(-w / 2 + 2, -h / 2 + 1, 4, 3);
  ctx.fillRect( w / 2 - 6,  -h / 2 + 1, 4, 3);

  // Tail lights
  ctx.fillStyle = "#FF4C4C66";
  ctx.fillRect(-w / 2 + 2, h / 2 - 4, 4, 3);
  ctx.fillRect( w / 2 - 6,  h / 2 - 4, 4, 3);

  ctx.restore();
}

function drawAmbulance(ctx: CanvasRenderingContext2D, amb: AmbObj): void {
  ctx.save();
  ctx.translate(amb.x, amb.y);
  ctx.rotate(Math.PI / 2); // going East → front faces right

  const w = AMB_W, h = AMB_H;

  if (amb.inGeo) {
    ctx.shadowBlur  = 30;
    ctx.shadowColor = "#FF4C4C";
  }

  // White body
  rRect(ctx, -w / 2, -h / 2, w, h, 4);
  ctx.fillStyle = "#EEEEEE";
  ctx.fill();

  // Red stripe (horizontal mid-band)
  ctx.fillStyle = "#FF4C4C";
  ctx.fillRect(-w / 2, -5, w, 10);

  // Red cross on front panel
  ctx.fillStyle = "#FF4C4C";
  ctx.fillRect(-3,         -h / 2 + 5, 6, 2.5);
  ctx.fillRect(-1.5, -h / 2 + 3.5, 3, 5.5);

  // Windshield
  ctx.fillStyle = "rgba(100,160,255,0.45)";
  ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 3.2);

  ctx.shadowBlur = 0;

  // Alternating siren beacons
  const leftColor  = amb.flash ? "#FF4C4C" : "#4A90E2";
  const rightColor = amb.flash ? "#4A90E2" : "#FF4C4C";

  [[  -w / 2 + 4, -h / 2 + 4, leftColor ],
   [   w / 2 - 4, -h / 2 + 4, rightColor]].forEach(([bx, by, bc]) => {
    ctx.shadowBlur  = 14;
    ctx.shadowColor = bc as string;
    ctx.fillStyle   = bc as string;
    ctx.beginPath();
    ctx.arc(bx as number, by as number, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  ctx.restore();
}

function drawCoreOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const text = "⚡ C.O.R.E. ACTIVE  —  ZERO BRAKE CLEARANCE";
  ctx.font = "bold 12px monospace";
  const tw   = ctx.measureText(text).width;
  const bx   = (W - tw - 28) / 2;
  const by   = 12;

  rRect(ctx, bx, by, tw + 28, 28, 6);
  ctx.fillStyle = "rgba(0,255,156,0.10)";
  ctx.fill();
  ctx.strokeStyle = "#00FF9C55";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign   = "center";
  ctx.fillStyle   = "#00FF9C";
  ctx.shadowBlur  = 12;
  ctx.shadowColor = "#00FF9C";
  ctx.fillText(text, W / 2, by + 19);
  ctx.shadowBlur  = 0;
  ctx.restore();
}

/** Master draw — called every frame */
function drawScene(ctx: CanvasRenderingContext2D, sim: SimState): void {
  drawBackground(ctx);
  drawRoads(ctx);
  drawGeofence(ctx, sim.coreOn);
  drawFlashRings(ctx, sim.rings);

  // Traffic lights at 4 corners (just outside intersection box)
  // NE corner → controls southbound (S)
  drawTrafficLight(ctx, CX + RH + 20, CY - RH - 22, sim.sig.S, "S↓");
  // SW corner → controls northbound (N)
  drawTrafficLight(ctx, CX - RH - 20, CY + RH + 22, sim.sig.N, "N↑");
  // NW corner → controls eastbound (E)  ← ambulance direction
  drawTrafficLight(ctx, CX - RH - 20, CY + RH - 22, sim.sig.E, "E→");
  // SE corner → controls westbound (W)
  drawTrafficLight(ctx, CX + RH + 20, CY - RH + 22, sim.sig.W, "W←");

  // NPC cars
  for (const car of sim.cars) {
    if (car.active) drawCar(ctx, car);
  }

  // Ambulance
  if (sim.amb && !sim.amb.exited) drawAmbulance(ctx, sim.amb);

  // CORE overlay banner
  if (sim.coreOn) drawCoreOverlay(ctx);
}

// ═══════════════════════════════════════════════════════════
//  § 7. REACT COMPONENT
// ═══════════════════════════════════════════════════════════

function createInitialSim(): SimState {
  const phase = 0 as const;
  return {
    running:     false,
    cars:        [],
    amb:         null,
    coreOn:      false,
    phase,
    phaseT:      0,
    savedPhase:  phase,
    savedT:      0,
    sig:         phaseToSig(phase),
    nextId:      1,
    spawnT:      0,
    lastTs:      0,
    rafId:       null,
    rings:       [],
    coreEvents:  0,
    carsCleared: 0,
  };
}

const PHASE_LABELS = ["NS ● HIJAU", "NS ● KUNING", "EW ● HIJAU", "EW ● KUNING"];
const PHASE_COLORS = [
  "text-neon-green", "text-alert-yellow",
  "text-neon-green", "text-alert-yellow",
];

export default function LiveSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef    = useRef<SimState>(createInitialSim());
  const { addToast } = useToast();

  // React state for sidebar — updated via setInterval, NOT inside RAF
  const [stats, setStats] = useState({
    running: false, coreOn: false, phase: 0 as 0|1|2|3,
    coreEvents: 0, carsCleared: 0, carCount: 0, hasAmb: false,
  });

  // ── RAF loop ──────────────────────────────────────────────
  const animate = useCallback((ts: number) => {
    const sim = simRef.current;
    if (!sim.running) return;

    const dt = sim.lastTs > 0 ? Math.min(ts - sim.lastTs, 50) : 16;
    sim.lastTs = ts;

    updateSim(sim, dt);

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, sim);

    sim.rafId = requestAnimationFrame(animate);
  }, []);

  // ── Controls ──────────────────────────────────────────────
  function startSim() {
    const sim = simRef.current;
    if (sim.running) return;
    sim.running = true;
    sim.lastTs  = 0;
    sim.rafId   = requestAnimationFrame(animate);
    addToast({ type: "info", title: "Simulasi Dimulai", message: "Traffic engine aktif. NPC mulai spawn." });
  }

  function stopSim() {
    const sim = simRef.current;
    sim.running = false;
    if (sim.rafId !== null) { cancelAnimationFrame(sim.rafId); sim.rafId = null; }
    addToast({ type: "info", title: "Simulasi Dihentikan", message: "Traffic engine dimatikan." });
  }

  function resetSim() {
    const sim = simRef.current;
    const wasRunning = sim.running;
    sim.running = false;
    if (sim.rafId !== null) { cancelAnimationFrame(sim.rafId); sim.rafId = null; }

    simRef.current = createInitialSim();

    // Clear canvas to static frame
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, simRef.current);

    if (wasRunning) {
      simRef.current.running = true;
      simRef.current.rafId   = requestAnimationFrame(animate);
    }
  }

  function spawnAmbulance() {
    const sim = simRef.current;
    if (!sim.running) {
      addToast({ type: "warning", title: "Start Dulu!", message: "Tekan START sebelum spawn ambulans." });
      return;
    }
    if (sim.amb && !sim.amb.exited) {
      addToast({ type: "warning", title: "Ambulans Masih Aktif", message: "Tunggu ambulans saat ini keluar layar." });
      return;
    }
    sim.amb = {
      x: -65, y: CY + LO,     // spawns from West, in East lane
      spd: AMB_SPD,
      inGeo: false, exited: false,
      flash: false, flashT: 0,
    };
    addToast({
      type: "danger",
      title: "🚨 Ambulans Dispawn!",
      message: "C.O.R.E. AI akan aktif saat ambulans memasuki zona geofence.",
      duration: 5000,
    });
  }

  // ── Stats update every 500ms ──────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const s = simRef.current;
      setStats({
        running:     s.running,
        coreOn:      s.coreOn,
        phase:       s.phase,
        coreEvents:  s.coreEvents,
        carsCleared: s.carsCleared,
        carCount:    s.cars.filter((c) => c.active).length,
        hasAmb:      !!s.amb && !s.amb.exited,
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ── Cleanup & initial static draw ────────────────────────
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, simRef.current);
    return () => {
      const sim = simRef.current;
      sim.running = false;
      if (sim.rafId !== null) cancelAnimationFrame(sim.rafId);
    };
  }, []);

  // ── JSX ───────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ══════════ SIDEBAR KIRI ══════════ */}
      <aside className="w-64 shrink-0 flex flex-col gap-3 p-4 overflow-y-auto
                        border-r border-accent/10 bg-deep-space/80 backdrop-blur">

        {/* Title */}
        <div>
          <h2 className="font-display text-sm font-bold text-text-light tracking-wider">
            TRAFFIC ENGINE
          </h2>
          <p className="text-[10px] text-accent-soft/50 mt-0.5">
            HTML5 Canvas 2D · 60fps Target
          </p>
        </div>

        {/* Controls */}
        <div className="glass-card p-3 space-y-2">
          <div className="text-[10px] text-accent-soft/40 tracking-widest uppercase">
            Kontrol Simulasi
          </div>

          <button
            onClick={stats.running ? stopSim : startSim}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl
                        font-semibold text-sm transition-all active:scale-95 ${
              stats.running
                ? "bg-alert-red/15 border border-alert-red/30 text-alert-red hover:bg-alert-red/25"
                : "bg-neon-green/15 border border-neon-green/30 text-neon-green hover:bg-neon-green/25"
            }`}
          >
            {stats.running
              ? <><Square className="w-4 h-4 fill-current" /> Stop Simulasi</>
              : <><Play  className="w-4 h-4 fill-current" /> Start Simulasi</>}
          </button>

          <button
            onClick={resetSim}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                       text-xs text-accent-soft/50 border border-dashed border-accent-soft/20
                       hover:text-text-light hover:border-accent-soft/40 transition-all"
          >
            <RotateCcw className="w-3 h-3" /> Reset Semua
          </button>
        </div>

        {/* CORE inject */}
        <div className="glass-card p-3 space-y-2">
          <div className="text-[10px] text-accent-soft/40 tracking-widest uppercase">
            C.O.R.E. Injection
          </div>

          <button
            onClick={spawnAmbulance}
            disabled={stats.hasAmb}
            className={`w-full flex flex-col items-center gap-1.5 py-4 rounded-xl
                        font-semibold transition-all duration-200 active:scale-95 border-2 ${
              stats.hasAmb
                ? "opacity-40 cursor-not-allowed border-accent-soft/20 text-accent-soft/50"
                : "bg-alert-red/15 border-alert-red/50 text-alert-red hover:bg-alert-red/25 shadow-[0_0_20px_#FF4C4C33]"
            }`}
          >
            <Siren className={`w-6 h-6 ${!stats.hasAmb ? "animate-pulse" : ""}`} />
            <span className="text-sm">Spawn Ambulance</span>
            <span className="text-[9px] font-normal opacity-70">C.O.R.E. AI Trigger</span>
          </button>

          {stats.coreOn && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg
                            bg-neon-green/10 border border-neon-green/30 animate-slide-in">
              <Zap className="w-4 h-4 text-neon-green animate-pulse" />
              <div>
                <div className="text-[11px] font-bold text-neon-green">C.O.R.E. AKTIF</div>
                <div className="text-[9px] text-neon-green/60">Zero Brake Clearance</div>
              </div>
            </div>
          )}
        </div>

        {/* Live stats */}
        <div className="glass-card p-3 space-y-2">
          <div className="text-[10px] text-accent-soft/40 tracking-widest uppercase">
            Live Stats
          </div>

          {([
            {
              label: "Engine",
              value: stats.running ? "AKTIF" : "IDLE",
              color: stats.running ? "text-neon-green" : "text-accent-soft/50",
            },
            {
              label: "Fase Lampu",
              value: PHASE_LABELS[stats.phase],
              color: PHASE_COLORS[stats.phase],
            },
            { label: "NPC di Canvas",    value: `${stats.carCount} unit`,  color: "text-text-light" },
            { label: "Kendaraan Lewat",  value: `${stats.carsCleared}`,    color: "text-text-light" },
            { label: "Event C.O.R.E.",   value: `${stats.coreEvents}×`,    color: stats.coreEvents > 0 ? "text-alert-red" : "text-text-light" },
          ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-accent-soft/50">{label}</span>
              <span className={`font-mono font-semibold ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="glass-card p-3 space-y-1.5">
          <div className="text-[10px] text-accent-soft/40 tracking-widest uppercase">Legenda</div>
          {[
            { color: "#00FF9C", label: "Lampu Hijau / CORE Active" },
            { color: "#FFC107", label: "Lampu Kuning (Transisi)" },
            { color: "#FF4C4C", label: "Lampu Merah (Stop)" },
            { color: "#495AEE", label: "Geofence Radius" },
            { color: "#FFFFFF", label: "Ambulans C.O.R.E." },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 text-[10px] text-accent-soft/60">
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </aside>

      {/* ══════════ CANVAS AREA ══════════ */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto
                       bg-[#060111]">

        {/* Header */}
        <div className="mb-3 flex items-center gap-3">
          <Activity className="w-4 h-4 text-accent" />
          <span className="font-display text-sm font-bold text-text-light tracking-wider">
            LIVE 2D SIMULATION — TOP-DOWN VIEW
          </span>
          {stats.coreOn && (
            <span className="text-[10px] font-mono text-neon-green border border-neon-green/30
                             px-2 py-0.5 rounded-full animate-pulse">
              C.O.R.E. OVERRIDE
            </span>
          )}
        </div>

        {/* Canvas wrapper */}
        <div
          className="relative rounded-xl overflow-hidden transition-all duration-500"
          style={{
            boxShadow: stats.coreOn
              ? "0 0 50px #00FF9C33, 0 0 100px #00FF9C11"
              : "0 0 40px #495AEE22",
            border: `1px solid ${stats.coreOn ? "#00FF9C33" : "#495AEE22"}`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ display: "block", maxWidth: "100%", height: "auto" }}
          />

          {/* Idle overlay */}
          {!stats.running && (
            <div className="absolute inset-0 flex items-center justify-center
                            bg-black/60 backdrop-blur-sm">
              <div className="text-center space-y-4">
                <div className="text-5xl">🚦</div>
                <div className="font-display text-xl text-text-light">
                  Tekan START untuk Memulai
                </div>
                <div className="text-sm text-accent-soft/50">
                  Traffic simulation engine siap
                </div>
                <button
                  onClick={startSim}
                  className="mt-2 btn-primary flex items-center gap-2 mx-auto"
                >
                  <Play className="w-4 h-4 fill-current" /> Mulai Simulasi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-3 text-[10px] font-mono text-accent-soft/30 text-center">
          Canvas 2D API · {W}×{H}px · 60fps · Car-following physics · C.O.R.E. Geofence AI
        </div>
      </main>
    </div>
  );
}
```

---

## ② Update `src/app/page.tsx`

Ganti placeholder `SimulationView` dengan import komponen nyata:

```tsx
// src/app/page.tsx
"use client";

import { useCore } from "@/context/CoreContext";
import CommandCenter  from "@/components/CommandCenter";
import DriverKiosk    from "@/components/DriverKiosk";
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
```

---

## ③ Arsitektur Engine (Referensi Cepat)

```
RAF loop (60fps)
└── updateSim(dt)
    ├── 5a. Light cycle: phase 0→1→2→3→0 (5s/1.2s/5s/1.2s)
    │       frozen oleh coreOn flag
    │
    ├── 5b. Ambulance:
    │   ├── flash siren (350ms toggle)
    │   ├── dist < GEO_R → GEOFENCE ENTRY
    │   │     coreOn=true, savedPhase, sig={S:red,N:red,E:green,W:red}
    │   │     clear E-direction NPCs ahead
    │   │     spawn flash ring
    │   ├── x > CX && dist > GEO_R → GEOFENCE EXIT
    │   │     coreOn=false, restore savedPhase
    │   └── x > W+50 → exited
    │
    ├── 5c. Flash rings: expand 160px/s, fade alpha
    │
    ├── 5d. NPC physics (per car):
    │   ├── sig[dir]=red/yellow && beforeStop → SKIP (stop at light)
    │   ├── gap to leader < MIN_HEADWAY → SKIP (car following)
    │   └── move by spd × dt/1000
    │
    └── 5e. Spawn: every 165 frames if < 10 cars
```

---

## ✅ Alur Demo yang Harus Dicoba

```
1. Buka tab "Live Simulation"
   → Overlay idle, tekan START atau klik tombol di sidebar

2. Setelah Start:
   → Mobil-mobil NPC mulai muncul dari 4 arah
   → Lampu lalu lintas siklus NS-green → NS-yellow → EW-green → ...
   → Mobil BERHENTI saat lampu merah, JALAN saat hijau
   → Mobil tidak menabrak satu sama lain (car-following physics)

3. Tekan "Spawn Ambulance (C.O.R.E. AI Trigger)"
   → Ambulans putih-merah muncul dari sisi KIRI, bergerak ke KANAN
   → Lampu sirennya berkedip merah-biru

4. Ambulans memasuki lingkaran geofence (Ø370px):
   → Flash ring hijau melebar dari pusat
   → Banner "⚡ C.O.R.E. ACTIVE — ZERO BRAKE CLEARANCE" muncul di atas canvas
   → Lampu EW → HIJAU (jalur ambulans bersih)
   → Lampu NS → MERAH seketika (kendaraan tegak lurus berhenti)
   → Geofence border berubah neon-green dengan glow
   → Canvas glow berubah hijau

5. Ambulans melintasi perempatan dan keluar geofence:
   → Lampu kembali ke siklus normal
   → NPC melanjutkan perjalanan
   → Sidebar: "Event C.O.R.E. 1×"

6. Tekan RESET untuk mengulang
```

---

## ✅ Verifikasi Tahap 4+5+6

| Test | Expected |
|------|----------|
| Tombol START → simulasi berjalan | ✅ |
| Mobil NPC spawn dari 4 arah secara acak | ✅ |
| Mobil berhenti di lampu merah (stop line) | ✅ |
| Mobil tidak menabrak mobil di depannya | ✅ (car-following MIN_HEADWAY) |
| Lampu siklus 4 fase otomatis | ✅ |
| Tombol Spawn Ambulance → kotak putih muncul kiri | ✅ |
| Ambulans masuk geofence → flash ring + banner CORE | ✅ |
| Saat CORE aktif → E green, N/S merah | ✅ |
| NPC N/S yang sudah di dalam intersection → tetap jalan | ✅ |
| Ambulans keluar geofence → siklus normal kembali | ✅ |
| Stats sidebar update tiap 500ms | ✅ |
| Reset → simulasi bersih | ✅ |

---

> [!NOTE]
> Seluruh 3 mode kini lengkap! Gunakan presentasi dengan membuka di **2 jendela/tab browser**:
> - Tab 1 → **Command Center** (operator dispatch)
> - Tab 2 → **Driver Kiosk** (layar supir bereaksi realtime)
> - Tab tunggal → **Live Simulation** (demonstrasi AI Engine ke juri)

---

**🏆 MVP C.O.R.E. selesai dalam 6 Tahap!**
*Jika ada bug atau request fitur polish (UI tweaks, efek tambahan, text bahasa Indonesia), ketik spesifik masalahnya.*
