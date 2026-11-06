import type { GameState, LogEntry, ResourceKey, Risk, SystemId } from './types';
import { clamp } from './rates';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export const has = (s: GameState, flag: string) => s.flags.includes(flag);
export const marked = (s: GameState, m: string) => s.marks.includes(m);
export const mark = (s: GameState, m: string) => {
  if (!s.marks.includes(m)) s.marks.push(m);
};
export const flag = (s: GameState, f: string) => {
  if (!s.flags.includes(f)) s.flags.push(f);
};
export const note = (s: GameState, tone: LogEntry['tone'], key: string, params?: Record<string, string | number>) => {
  s.log.push({ day: s.day, tone, msg: { key, params } });
};

/** Spare parts needed to fix the water recycler (rises if repair was postponed). */
export const recyclerRepairCost = (s: GameState) => (marked(s, 'repairCostUp') ? 2 : 1);

/* ------------------------------------------------------------------ */
/* Delayed / conditional consequence effects (serializable by key)      */
/* ------------------------------------------------------------------ */

export interface Effect {
  /** Return false to skip (condition no longer true). */
  when?: (s: GameState) => boolean;
  apply: (s: GameState) => void;
}

export const EFFECTS: Record<string, Effect> = {
  recyclerWorsens: {
    when: (s) => s.sys.recyclerEff < 0.7,
    apply: (s) => {
      s.sys.recyclerEff = clamp(s.sys.recyclerEff - 0.12, 0.3, 1);
      note(s, 'bad', 'cons.recyclerWorsens', { eff: Math.round(s.sys.recyclerEff * 100) });
    },
  },
  waterTriage: {
    when: (s) => s.sys.recyclerEff < 0.7,
    apply: (s) => {
      s.activeEvents.push('d4_triage');
      note(s, 'warn', 'cons.waterTriage');
    },
  },
  hygieneFatigue: {
    when: (s) => s.sys.waterSaving,
    apply: (s) => {
      s.crew.health = clamp(s.crew.health - 3, 0, 100);
      note(s, 'bad', 'cons.hygieneFatigue');
    },
  },
  repairCostUp: {
    when: (s) => s.sys.recyclerEff < 0.7,
    apply: (s) => {
      mark(s, 'repairCostUp');
      note(s, 'warn', 'cons.repairCostUp');
    },
  },
  dustAccumulates: {
    when: (s) => s.sys.solarEff < 0.9,
    apply: (s) => {
      s.sys.solarEff = clamp(s.sys.solarEff - 0.08, 0.4, 1);
      note(s, 'bad', 'cons.dustAccumulates', { eff: Math.round(s.sys.solarEff * 100) });
    },
  },
  plantsStressed: {
    when: (s) => s.plants.health < 65,
    apply: (s) => {
      s.plants.leavesG = Math.max(0, s.plants.leavesG - 25);
      note(s, 'bad', 'cons.plantsStressed');
    },
  },
  plantsThrive: {
    when: (s) => s.plants.health >= 75,
    apply: (s) => {
      s.plants.leavesG += 20;
      note(s, 'good', 'cons.plantsThrive');
    },
  },
  canisterDepleted: {
    when: (s) => s.sys.backupFilter && s.sys.scrubberEff < 0.8,
    apply: (s) => {
      if (s.res.backupCanisters > 0) {
        s.res.backupCanisters -= 1;
        note(s, 'info', 'cons.canisterSwap');
      } else {
        s.sys.backupFilter = false;
        note(s, 'bad', 'cons.canisterDepleted');
      }
    },
  },
  restBonus: {
    apply: (s) => {
      s.crew.health = clamp(s.crew.health + 2, 0, 100);
      note(s, 'good', 'cons.restBonus');
    },
  },
  shelterPaysOff: {
    apply: (s) => note(s, 'good', 'cons.shelterPaysOff'),
  },
  evaExposure: {
    apply: (s) => {
      s.crew.health = clamp(s.crew.health - 4, 0, 100);
      note(s, 'bad', 'cons.evaExposure');
    },
  },
};

/* ------------------------------------------------------------------ */
/* Day-start scripted conditions (the scenario itself)                 */
/* ------------------------------------------------------------------ */

export const DAY_START: Record<number, (s: GameState) => void> = {
  1: (s) => {
    // One panel string's cable came loose during landing: output starts at 85 %.
    s.sys.solarEff = 0.85;
    note(s, 'warn', 'day1.start');
    s.activeEvents.push('d1_power');
  },
  2: (s) => {
    s.sys.recyclerEff = 0.55;
    note(s, 'warn', 'day2.start');
    s.activeEvents.push('d2_water');
  },
  3: (s) => {
    s.sys.solarEff = 0.65;
    note(s, 'warn', 'day3.start');
    s.activeEvents.push('d3_greenhouse');
  },
  4: (s) => {
    flag(s, 'spe');
    s.ctl.evaAuthorized = false;
    note(s, 'warn', 'day4.start');
    s.activeEvents.push('d4_radiation');
  },
  5: (s) => {
    s.ctl.location = 'habitat';
    s.sys.shelterHeater = false;
    s.sys.relayOnline = false;
    note(s, 'warn', 'day5.start');
    s.activeEvents.push('d5_comms');
  },
  6: (s) => {
    s.sys.scrubberEff = 0.45;
    note(s, 'warn', 'day6.start');
    s.activeEvents.push('d6_air');
  },
  7: (s) => {
    note(s, 'info', 'day7.start');
  },
};

/* ------------------------------------------------------------------ */
/* Decision events                                                      */
/* ------------------------------------------------------------------ */

export interface DecisionOption {
  id: string;
  risk: Risk;
  affects: ResourceKey[];
  /** Hidden from the player: 0 poor, 1 acceptable, 2 excellent. */
  quality: number;
  /** Disabled with a reason key if it returns a string. */
  blocked?: (s: GameState) => string | null;
  apply: (s: GameState) => void;
  /** Delayed consequences: effect key + days from now. */
  schedule?: { effect: string; inDays: number }[];
}

export interface MissionEvent {
  id: string;
  system: SystemId;
  severity: 'warning' | 'critical' | 'info';
  options: DecisionOption[];
}

export const EVENTS: Record<string, MissionEvent> = {
  d1_power: {
    id: 'd1_power',
    system: 'energy',
    severity: 'info',
    options: [
      {
        id: 'balanced',
        risk: 'low',
        affects: ['energy', 'oxygen', 'plants'],
        quality: 2,
        apply: (s) => {
          s.ctl.lifeSupportPower = 100;
          s.ctl.lightIntensity = 90;
          s.ctl.commsMode = 'standard';
        },
      },
      {
        id: 'saver',
        risk: 'medium',
        affects: ['energy', 'plants', 'comms'],
        quality: 1,
        apply: (s) => {
          s.ctl.lifeSupportPower = 100;
          s.ctl.lightIntensity = 65;
          s.ctl.commsMode = 'low';
        },
      },
      {
        id: 'growth',
        risk: 'high',
        affects: ['energy', 'oxygen', 'plants'],
        quality: 0,
        apply: (s) => {
          s.ctl.lifeSupportPower = 75;
          s.ctl.lightIntensity = 100;
          s.ctl.commsMode = 'standard';
        },
        schedule: [{ effect: 'plantsThrive', inDays: 2 }],
      },
    ],
  },

  d2_water: {
    id: 'd2_water',
    system: 'lifeSupport',
    severity: 'warning',
    options: [
      {
        id: 'repair',
        risk: 'low',
        affects: ['water', 'energy', 'parts', 'oxygen'],
        quality: 2,
        blocked: (s) => (s.res.spareParts < 1 ? 'block.noParts' : null),
        apply: (s) => {
          s.res.spareParts -= 1;
          s.res.batteryKWh = Math.max(0, s.res.batteryKWh - 0.8);
          s.sys.recyclerEff = 0.88;
          s.ctl.activity = 'active';
          flag(s, 'repairWork');
        },
      },
      {
        id: 'reserve',
        risk: 'medium',
        affects: ['water'],
        quality: 0,
        apply: (s) => {
          const moved = Math.min(8, s.res.reserveWaterL);
          s.res.reserveWaterL -= moved;
          s.res.waterL += moved;
        },
        schedule: [
          { effect: 'recyclerWorsens', inDays: 1 },
          { effect: 'waterTriage', inDays: 2 },
        ],
      },
      {
        id: 'conserve',
        risk: 'medium',
        affects: ['water', 'health'],
        quality: 1,
        apply: (s) => {
          s.sys.waterSaving = true;
        },
        schedule: [
          { effect: 'hygieneFatigue', inDays: 1 },
          { effect: 'repairCostUp', inDays: 1 },
          { effect: 'waterTriage', inDays: 2 },
        ],
      },
    ],
  },

  d3_greenhouse: {
    id: 'd3_greenhouse',
    system: 'greenhouse',
    severity: 'warning',
    options: [
      {
        id: 'clean',
        risk: 'medium',
        affects: ['energy', 'health', 'radiation'],
        quality: 2,
        blocked: (s) => (has(s, 'spe') ? 'block.spe' : null),
        apply: (s) => {
          s.sys.solarEff = 0.97;
          s.ctl.activity = 'active';
          s.crew.radiation += 0.5;
          flag(s, 'evaDone');
        },
      },
      {
        id: 'dim',
        risk: 'medium',
        affects: ['energy', 'plants', 'food'],
        quality: 1,
        apply: (s) => {
          s.ctl.lightIntensity = 50;
        },
        schedule: [
          { effect: 'plantsStressed', inDays: 2 },
          { effect: 'dustAccumulates', inDays: 3 },
        ],
      },
      {
        id: 'redProfile',
        risk: 'low',
        affects: ['energy', 'plants'],
        quality: 1,
        apply: (s) => {
          s.ctl.lightProfile = 'redRich';
          s.ctl.lightIntensity = 80;
        },
        schedule: [{ effect: 'dustAccumulates', inDays: 3 }],
      },
    ],
  },

  d4_radiation: {
    id: 'd4_radiation',
    system: 'safety',
    severity: 'critical',
    options: [
      {
        id: 'shelter',
        risk: 'low',
        affects: ['radiation', 'health', 'plants'],
        quality: 2,
        apply: (s) => {
          s.ctl.location = 'shelter';
          s.ctl.evaAuthorized = false;
          s.sys.shelterHeater = true;
          s.ctl.activity = 'rest';
          s.plants.health = clamp(s.plants.health - 4, 0, 100);
        },
        schedule: [{ effect: 'shelterPaysOff', inDays: 1 }],
      },
      {
        id: 'quickEva',
        risk: 'high',
        affects: ['radiation', 'health'],
        quality: 0,
        apply: (s) => {
          s.crew.radiation += 4;
          s.ctl.activity = 'active';
          s.ctl.location = 'shelter';
          s.sys.shelterHeater = true;
          flag(s, 'evaDone');
        },
        schedule: [{ effect: 'evaExposure', inDays: 1 }],
      },
      {
        id: 'stayInside',
        risk: 'medium',
        affects: ['radiation', 'health'],
        quality: 0,
        apply: (s) => {
          s.ctl.location = 'habitat';
          s.ctl.evaAuthorized = false;
        },
      },
    ],
  },

  d4_triage: {
    id: 'd4_triage',
    system: 'lifeSupport',
    severity: 'warning',
    options: [
      {
        id: 'repairLate',
        risk: 'low',
        affects: ['water', 'parts', 'energy'],
        quality: 2,
        blocked: (s) => (s.res.spareParts < recyclerRepairCost(s) ? 'block.noParts' : null),
        apply: (s) => {
          s.res.spareParts -= recyclerRepairCost(s);
          s.res.batteryKWh = Math.max(0, s.res.batteryKWh - 0.8);
          s.sys.recyclerEff = 0.85;
          s.sys.waterSaving = false;
        },
      },
      {
        id: 'plantsFirst',
        risk: 'high',
        affects: ['water', 'plants'],
        quality: 1,
        apply: (s) => {
          const moved = s.res.reserveWaterL;
          s.res.reserveWaterL = 0;
          s.res.waterL += moved;
          s.ctl.plantWaterL = 0.6;
        },
      },
      {
        id: 'reservesFirst',
        risk: 'medium',
        affects: ['water', 'plants', 'food'],
        quality: 1,
        apply: (s) => {
          s.ctl.plantWaterL = 0.3;
        },
        schedule: [{ effect: 'plantsStressed', inDays: 1 }],
      },
    ],
  },

  d5_comms: {
    id: 'd5_comms',
    system: 'comms',
    severity: 'warning',
    options: [
      {
        id: 'storeForward',
        risk: 'low',
        affects: ['comms'],
        quality: 2,
        apply: (s) => {
          s.ctl.commsMode = 'standard';
          mark(s, 'dtn');
        },
      },
      {
        id: 'boost',
        risk: 'medium',
        affects: ['comms', 'energy'],
        quality: 1,
        apply: (s) => {
          s.ctl.commsMode = 'boost';
          s.res.batteryKWh = Math.max(0, s.res.batteryKWh - 0.6);
          // Edge-of-coverage contact: only the two highest-priority messages fit through.
          const queued = s.messages.filter((m) => m.status === 'queued').sort((a, b) => a.priority - b.priority || a.day - b.day);
          queued.slice(0, 2).forEach((m) => {
            m.status = 'sent';
            m.sentDay = s.day;
          });
        },
      },
      {
        id: 'retry',
        risk: 'high',
        affects: ['comms', 'energy'],
        quality: 0,
        apply: (s) => {
          s.res.batteryKWh = Math.max(0, s.res.batteryKWh - 1.2);
        },
      },
    ],
  },

  d6_air: {
    id: 'd6_air',
    system: 'lifeSupport',
    severity: 'critical',
    options: [
      {
        id: 'repair',
        risk: 'low',
        affects: ['co2', 'parts', 'health'],
        quality: 2,
        blocked: (s) => (s.res.spareParts < 1 ? 'block.noParts' : null),
        apply: (s) => {
          s.res.spareParts -= 1;
          s.sys.scrubberEff = 0.95;
          s.ctl.activity = 'active';
        },
      },
      {
        id: 'backup',
        risk: 'medium',
        affects: ['co2', 'energy'],
        quality: 1,
        blocked: (s) => (s.res.backupCanisters < 1 ? 'block.noCanisters' : null),
        apply: (s) => {
          s.res.backupCanisters -= 1;
          s.sys.backupFilter = true;
        },
        schedule: [{ effect: 'canisterDepleted', inDays: 1 }],
      },
      {
        id: 'rest',
        risk: 'high',
        affects: ['co2', 'health'],
        quality: 0,
        apply: (s) => {
          s.ctl.activity = 'rest';
        },
        schedule: [{ effect: 'restBonus', inDays: 1 }],
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Daily objectives – each is checked against real state/actions        */
/* ------------------------------------------------------------------ */

export interface Objective {
  id: string;
  system: SystemId | 'station';
  done: (s: GameState) => boolean;
}

const resolved = (id: string) => (s: GameState) => s.resolvedEvents.includes(id);

export const OBJECTIVES: Record<number, Objective[]> = {
  1: [
    { id: 'o1_inspectLS', system: 'lifeSupport', done: (s) => has(s, 'diag:lifeSupport') },
    { id: 'o1_activate', system: 'energy', done: (s) => has(s, 'diag:energy') },
    { id: 'o1_resources', system: 'station', done: (s) => has(s, 'viewed:status') },
    { id: 'o1_allocate', system: 'energy', done: resolved('d1_power') },
    { id: 'o1_shelter', system: 'safety', done: (s) => has(s, 'inspect:shelter') },
    { id: 'o1_repair', system: 'energy', done: (s) => marked(s, 'solarCircuitFixed') },
  ],
  2: [
    { id: 'o2_detect', system: 'lifeSupport', done: (s) => has(s, 'diag:lifeSupport') },
    { id: 'o2_decide', system: 'lifeSupport', done: resolved('d2_water') },
    { id: 'o2_evaluate', system: 'lifeSupport', done: (s) => has(s, 'viewed:waterForecast') },
  ],
  3: [
    { id: 'o3_inspect', system: 'greenhouse', done: (s) => has(s, 'diag:greenhouse') },
    { id: 'o3_balance', system: 'greenhouse', done: resolved('d3_greenhouse') },
    { id: 'o3_light', system: 'greenhouse', done: (s) => has(s, 'set:light') },
    { id: 'o3_water', system: 'greenhouse', done: (s) => has(s, 'set:plantWater') },
  ],
  4: [
    { id: 'o4_review', system: 'safety', done: (s) => has(s, 'viewed:solar') },
    { id: 'o4_prepare', system: 'safety', done: (s) => has(s, 'inspect:shelter') },
    { id: 'o4_decide', system: 'safety', done: resolved('d4_radiation') },
    { id: 'o4_protect', system: 'safety', done: (s) => s.ctl.location === 'shelter' },
  ],
  5: [
    { id: 'o5_detect', system: 'comms', done: (s) => has(s, 'diag:comms') },
    { id: 'o5_store', system: 'comms', done: resolved('d5_comms') },
    { id: 'o5_prioritize', system: 'comms', done: (s) => has(s, 'set:priority') },
    { id: 'o5_restore', system: 'comms', done: (s) => s.sys.relayOnline },
    { id: 'o5_transmit', system: 'comms', done: (s) => has(s, 'transmitted') },
  ],
  6: [
    { id: 'o6_detect', system: 'lifeSupport', done: (s) => has(s, 'diag:lifeSupport') },
    { id: 'o6_decide', system: 'lifeSupport', done: resolved('d6_air') },
    { id: 'o6_restore', system: 'lifeSupport', done: (s) => s.crew.co2 < 3 },
  ],
  7: [
    { id: 'o7_review', system: 'station', done: (s) => has(s, 'viewed:timeline') },
    {
      id: 'o7_inspect',
      system: 'station',
      done: (s) => ['lifeSupport', 'greenhouse', 'energy', 'comms', 'safety'].every((x) => has(s, `diag:${x}`)),
    },
    { id: 'o7_health', system: 'safety', done: (s) => has(s, 'medical') },
    {
      id: 'o7_systems',
      system: 'station',
      done: (s) => s.sys.recyclerEff >= 0.7 && (s.sys.scrubberEff >= 0.7 || s.sys.backupFilter) && s.sys.relayOnline,
    },
  ],
};

export const MISSION_CARD: Record<number, SystemId | 'station'> = {
  1: 'energy',
  2: 'lifeSupport',
  3: 'greenhouse',
  4: 'safety',
  5: 'comms',
  6: 'lifeSupport',
  7: 'station',
};
