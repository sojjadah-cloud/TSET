/**
 * Walkable worlds for exploration mode (coordinates in the 1600×900 scene space).
 * Feet position (x, y): y is depth – larger y is closer to the camera.
 */
export type SceneId = 'outside' | 'habitat';

type Rect = { kind: 'rect'; x1: number; y1: number; x2: number; y2: number };
type Ellipse = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };
export type Shape = Rect | Ellipse;

export interface Interactable {
  id: string;
  x: number;
  y: number;
  /** i18n key of the action verb shown in the [E] prompt. */
  prompt: string;
  /** Discoveries are optional bonus content. */
  bonus?: boolean;
  r?: number;
}

export interface World {
  bounds: { x1: number; y1: number; x2: number; y2: number };
  obstacles: Shape[];
  spots: Interactable[];
  spawn: { x: number; y: number };
  /** Perspective: astronaut scale at the back and front of the floor. */
  depth: { y1: number; y2: number; s1: number; s2: number };
  /** Lunar surface (suit, low-gravity lope) vs. pressurized interior. */
  surface: boolean;
}

const rect = (x1: number, y1: number, x2: number, y2: number): Rect => ({ kind: 'rect', x1, y1, x2, y2 });
const ell = (cx: number, cy: number, rx: number, ry: number): Ellipse => ({ kind: 'ellipse', cx, cy, rx, ry });

export const WORLDS: Record<SceneId, World> = {
  outside: {
    bounds: { x1: 40, y1: 565, x2: 1560, y2: 875 },
    surface: true,
    spawn: { x: 800, y: 690 },
    depth: { y1: 560, y2: 880, s1: 0.62, s2: 1.12 },
    obstacles: [
      ell(800, 598, 228, 46), // habitat dome
      rect(925, 495, 1092, 602), // life-support annex + O2 tanks
      rect(592, 520, 658, 598), // water tank
      rect(252, 555, 608, 624), // greenhouse
      rect(292, 594, 398, 652), // battery bank
      ell(127, 829, 72, 15), // solar arrays (posts)
      ell(283, 763, 66, 14),
      ell(423, 704, 56, 12),
      ell(94, 695, 58, 12),
      ell(1165, 742, 152, 34), // shelter berm
      rect(1072, 492, 1192, 556), // comms hut + mast
      rect(1338, 726, 1452, 768), // rover
      rect(1005, 622, 1082, 640), // containers
      rect(636, 640, 676, 652),
      rect(556, 650, 590, 660),
      ell(612, 674, 7, 4), // lamps
      ell(1010, 694, 7, 4),
      ell(1300, 724, 7, 4),
      ell(120, 621, 14, 5), // seismometer
    ],
    spots: [
      { id: 'airlock', x: 800, y: 662, prompt: 'adv.p.enterHabitat' },
      { id: 'solarPanel', x: 372, y: 790, prompt: 'adv.p.solar', r: 80 },
      { id: 'greenhouse', x: 470, y: 648, prompt: 'adv.p.greenhouse' },
      { id: 'commsConsole', x: 1130, y: 584, prompt: 'adv.p.comms' },
      { id: 'shelterDoor', x: 1150, y: 806, prompt: 'adv.p.shelter' },
      { id: 'radMonitor', x: 1340, y: 735, prompt: 'adv.p.radMonitor' },
      { id: 'seismometer', x: 120, y: 652, prompt: 'adv.p.discover', bonus: true },
      { id: 'rover', x: 1395, y: 795, prompt: 'adv.p.discover', bonus: true },
      { id: 'rock', x: 1475, y: 722, prompt: 'adv.p.discover', bonus: true },
      { id: 'crater', x: 700, y: 772, prompt: 'adv.p.discover', bonus: true },
    ],
  },
  habitat: {
    bounds: { x1: 200, y1: 600, x2: 1400, y2: 845 },
    surface: false,
    spawn: { x: 270, y: 735 },
    depth: { y1: 590, y2: 860, s1: 1.05, s2: 1.4 },
    obstacles: [
      rect(1230, 655, 1430, 770), // bunk
      ell(800, 770, 105, 30), // table
      rect(1150, 800, 1215, 850), // medical cabinet
    ],
    spots: [
      { id: 'exit', x: 240, y: 700, prompt: 'adv.p.exitHabitat' },
      { id: 'waterUnit', x: 505, y: 625, prompt: 'adv.p.waterUnit' },
      { id: 'o2Gen', x: 760, y: 625, prompt: 'adv.p.inspect' },
      { id: 'scrubber', x: 1010, y: 625, prompt: 'adv.p.scrubber' },
      { id: 'bunk', x: 1215, y: 715, prompt: 'adv.p.bunk' },
      { id: 'kitchen', x: 800, y: 820, prompt: 'adv.p.inspect' },
      { id: 'medkit', x: 1120, y: 825, prompt: 'adv.p.medkit' },
      { id: 'window', x: 1240, y: 625, prompt: 'adv.p.look', bonus: true },
    ],
  },
};

export function blocked(w: World, x: number, y: number) {
  const b = w.bounds;
  if (x < b.x1 || x > b.x2 || y < b.y1 || y > b.y2) return true;
  for (const o of w.obstacles) {
    if (o.kind === 'rect') {
      if (x > o.x1 && x < o.x2 && y > o.y1 && y < o.y2) return true;
    } else {
      const dx = (x - o.cx) / o.rx;
      const dy = (y - o.cy) / o.ry;
      if (dx * dx + dy * dy < 1) return true;
    }
  }
  return false;
}

export function depthScale(w: World, y: number) {
  const { y1, y2, s1, s2 } = w.depth;
  const k = Math.min(1, Math.max(0, (y - y1) / (y2 - y1)));
  return s1 + (s2 - s1) * k;
}

export function nearestSpot(w: World, x: number, y: number) {
  const reach = w.surface ? 62 : 90; // interior is drawn larger
  let best: Interactable | null = null;
  let bd = Infinity;
  for (const s of w.spots) {
    const d = Math.hypot(s.x - x, (s.y - y) * 1.6);
    if (d < (s.r ?? reach) && d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

export const spotById = (id: string) => {
  for (const scene of Object.keys(WORLDS) as SceneId[]) {
    const s = WORLDS[scene].spots.find((p) => p.id === id);
    if (s) return { scene, spot: s };
  }
  return null;
};
