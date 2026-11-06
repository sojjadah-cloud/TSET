import { has } from '../sim/missions';
import type { GameState } from '../sim/types';
import type { SceneId } from './world';

/** Where each decision event is handled in the world. */
export const EVENT_SPOT: Record<string, string> = {
  d1_power: 'solarPanel',
  d2_water: 'waterUnit',
  d3_greenhouse: 'greenhouse',
  d4_radiation: 'shelterDoor',
  d4_triage: 'waterUnit',
  d5_comms: 'commsConsole',
  d6_air: 'scrubber',
};

/** Decision options that are played as a mini-game instead of a single click. */
export const MINIGAME: Record<string, 'pipes'> = {
  'd2_water:repair': 'pipes',
  'd4_triage:repairLate': 'pipes',
};

export interface Ctx {
  game: GameState;
  scene: SceneId;
}

export interface Step {
  id: string;
  /** Spot the guidance beacon points at. */
  spot: (c: Ctx) => string;
  done: (c: Ctx) => boolean;
  /** Counter shown next to the objective, e.g. 3/5. */
  count?: (c: Ctx) => [number, number];
}

const resolved = (id: string) => (c: Ctx) => c.game.resolvedEvents.includes(id);
const restSpot = (c: Ctx) => (c.game.ctl.location === 'shelter' ? 'shelterDoor' : 'bunk');
const rest: Step = { id: 'rest', spot: restSpot, done: () => false };
const SYSTEMS = ['lifeSupport', 'greenhouse', 'energy', 'comms', 'safety'] as const;
const TOUR_SPOT: Record<(typeof SYSTEMS)[number], string> = {
  lifeSupport: 'waterUnit',
  greenhouse: 'greenhouse',
  energy: 'solarPanel',
  comms: 'commsConsole',
  safety: 'radMonitor',
};

export const DAY_STEPS: Record<number, Step[]> = {
  1: [
    { id: 'd1_repair', spot: () => 'solarPanel', done: (c) => c.game.marks.includes('solarCircuitFixed') },
    { id: 'd1_plan', spot: () => 'solarPanel', done: resolved('d1_power') },
    { id: 'd1_shelter', spot: () => 'shelterDoor', done: (c) => has(c.game, 'inspect:shelter') },
    rest,
  ],
  2: [
    { id: 'd2_enter', spot: () => 'airlock', done: (c) => c.scene === 'habitat' || has(c.game, 'diag:lifeSupport') },
    { id: 'd2_find', spot: () => 'waterUnit', done: (c) => has(c.game, 'diag:lifeSupport') },
    { id: 'd2_fix', spot: () => 'waterUnit', done: resolved('d2_water') },
    rest,
  ],
  3: [
    { id: 'd3_visit', spot: () => 'greenhouse', done: (c) => has(c.game, 'diag:greenhouse') },
    { id: 'd3_solve', spot: () => 'greenhouse', done: resolved('d3_greenhouse') },
    rest,
  ],
  4: [
    { id: 'd4_monitor', spot: () => 'radMonitor', done: (c) => has(c.game, 'viewed:solar') },
    { id: 'd4_protect', spot: () => 'shelterDoor', done: resolved('d4_radiation') },
    { id: 'd4_triage', spot: () => 'waterUnit', done: (c) => !c.game.activeEvents.includes('d4_triage') },
    rest,
  ],
  5: [
    { id: 'd5_check', spot: () => 'commsConsole', done: (c) => has(c.game, 'diag:comms') },
    { id: 'd5_store', spot: () => 'commsConsole', done: resolved('d5_comms') },
    { id: 'd5_relay', spot: () => 'commsConsole', done: (c) => c.game.sys.relayOnline },
    rest,
  ],
  6: [
    { id: 'd6_enter', spot: () => 'airlock', done: (c) => c.scene === 'habitat' || has(c.game, 'diag:lifeSupport') },
    { id: 'd6_scrubber', spot: () => 'scrubber', done: resolved('d6_air') },
    rest,
  ],
  7: [
    {
      id: 'd7_tour',
      spot: (c) => TOUR_SPOT[SYSTEMS.find((x) => !has(c.game, `diag:${x}`)) ?? 'lifeSupport'],
      done: (c) => SYSTEMS.every((x) => has(c.game, `diag:${x}`)),
      count: (c) => [SYSTEMS.filter((x) => has(c.game, `diag:${x}`)).length, SYSTEMS.length],
    },
    { id: 'd7_medical', spot: () => 'medkit', done: (c) => has(c.game, 'medical') },
    { id: 'rest7', spot: restSpot, done: () => false },
  ],
};

/** Steps shown today (the Day 4 water step only appears if that consequence fired). */
export function stepsFor(c: Ctx) {
  return (DAY_STEPS[c.game.day] ?? []).filter((s) => s.id !== 'd4_triage' || c.game.activeEvents.includes('d4_triage') || c.game.resolvedEvents.includes('d4_triage'));
}

export function currentStep(c: Ctx) {
  return stepsFor(c).find((s) => !s.done(c)) ?? null;
}
