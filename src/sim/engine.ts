import { BALANCE, SIM_ASSUMPTIONS as S } from '../config/science';
import { DAY_START, EFFECTS, EVENTS, OBJECTIVES, flag, has, mark, note, recyclerRepairCost } from './missions';
import { clamp, commsBandwidth, computeRates, round } from './rates';
import type { CommMessage, DaySnapshot, GameState } from './types';

export const SAVE_VERSION = 3;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/* ------------------------------------------------------------------ */
/* New game                                                             */
/* ------------------------------------------------------------------ */

export function newGame(): GameState {
  const st = BALANCE.start;
  const s: GameState = {
    version: SAVE_VERSION,
    phase: 'briefing',
    day: 1,
    res: {
      oxygenKg: st.oxygenKg,
      waterL: st.waterL,
      reserveWaterL: st.reserveWaterL,
      batteryKWh: st.batteryKWh,
      foodDays: st.foodDays,
      spareParts: st.spareParts,
      backupCanisters: st.backupCanisters,
      backupFuelKWh: st.backupFuelKWh,
    },
    sys: {
      recyclerEff: S.recyclerStartEfficiency,
      scrubberEff: 1,
      solarEff: 1,
      relayOnline: true,
      shelterReadiness: 0.6,
      backupFilter: false,
      backupPower: false,
      waterSaving: false,
      shelterHeater: false,
    },
    ctl: {
      lifeSupportPower: 100,
      lightIntensity: 90,
      lightProfile: 'balanced',
      plantWaterL: 0.6,
      commsMode: 'standard',
      activity: 'normal',
      location: 'habitat',
      evaAuthorized: true,
    },
    plants: { health: st.plantHealth, leavesG: st.leavesG, harvestedG: 0 },
    crew: { health: st.health, radiation: 0, co2: 0 },
    messages: [],
    flags: [],
    marks: [],
    bwUsed: 0,
    decisions: [],
    pending: [],
    activeEvents: [],
    resolvedEvents: [],
    log: [],
    reports: [],
    failed: null,
    completed: false,
    lastOutcome: null,
    dayStart: null as unknown as DaySnapshot,
  };
  generateMessages(s);
  DAY_START[1](s);
  refresh(s);
  s.dayStart = snapshot(s);
  return s;
}

/** Recompute derived live values (CO2 reading) after any change. */
export function refresh(s: GameState) {
  s.crew.co2 = round(computeRates(s, { spe: has(s, 'spe') }).co2, 2);
  s.res.waterL = Math.max(0, s.res.waterL);
  s.res.batteryKWh = clamp(s.res.batteryKWh, 0, BALANCE.capacity.batteryKWh);
}

function generateMessages(s: GameState) {
  const d = s.day;
  const add = (kind: CommMessage['kind'], priority: CommMessage['priority']) =>
    s.messages.push({ id: `m${d}-${kind}`, kind, day: d, priority, status: 'queued' });
  add('telemetry', 1);
  add('health', 1);
  add('science', 2);
  if (d % 2 === 1) add('family', 3);
  if (d >= 3) add('plants', 2);
}

/* ------------------------------------------------------------------ */
/* Decisions                                                            */
/* ------------------------------------------------------------------ */

export function decide(prev: GameState, eventId: string, optionId: string): GameState {
  const ev = EVENTS[eventId];
  const opt = ev?.options.find((o) => o.id === optionId);
  if (!ev || !opt || !prev.activeEvents.includes(eventId)) return prev;
  if (opt.blocked?.(prev)) return prev;
  const s = clone(prev);
  opt.apply(s);
  s.activeEvents = s.activeEvents.filter((e) => e !== eventId);
  s.resolvedEvents.push(eventId);
  s.decisions.push({ eventId, optionId, day: s.day, quality: opt.quality });
  opt.schedule?.forEach((c, i) =>
    s.pending.push({ id: `${eventId}:${optionId}:${i}`, source: `${eventId}:${optionId}`, triggerDay: s.day + c.inDays, effect: c.effect }),
  );
  note(s, opt.quality >= 2 ? 'good' : opt.quality === 1 ? 'info' : 'warn', `ev.${eventId}.${optionId}.outcome`);
  s.lastOutcome = { eventId, optionId };
  refresh(s);
  return s;
}

/* ------------------------------------------------------------------ */
/* Player actions inside system screens                                 */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'flag'; flag: string }
  | { type: 'mark'; mark: string }
  | { type: 'setCtl'; key: keyof GameState['ctl']; value: unknown }
  | { type: 'repairRecycler' }
  | { type: 'repairScrubber' }
  | { type: 'toggleBackupFilter' }
  | { type: 'toggleWaterSaving' }
  | { type: 'useReserve' }
  | { type: 'toggleBackupPower' }
  | { type: 'harvest' }
  | { type: 'inspectShelter' }
  | { type: 'medicalCheck' }
  | { type: 'repairSolarCircuit' }
  | { type: 'priority'; id: string; delta: number }
  | { type: 'reacquireRelay' }
  | { type: 'transmit' };

export function act(prev: GameState, a: Action): GameState {
  const s = clone(prev);
  switch (a.type) {
    case 'flag':
      flag(s, a.flag);
      break;
    case 'mark':
      if (s.marks.includes(a.mark)) return prev;
      mark(s, a.mark);
      break;
    case 'setCtl': {
      (s.ctl as unknown as Record<string, unknown>)[a.key] = a.value;
      if (a.key === 'lightIntensity' || a.key === 'lightProfile') flag(s, 'set:light');
      if (a.key === 'plantWaterL') flag(s, 'set:plantWater');
      if (a.key === 'location' && a.value === 'shelter') s.ctl.evaAuthorized = false;
      if (a.key === 'evaAuthorized' && a.value === true && (has(s, 'spe') || s.ctl.location === 'shelter')) s.ctl.evaAuthorized = false;
      break;
    }
    case 'repairRecycler': {
      const cost = recyclerRepairCost(s);
      if (s.sys.recyclerEff >= 0.8 || s.res.spareParts < cost) return prev;
      s.res.spareParts -= cost;
      s.res.batteryKWh = Math.max(0, s.res.batteryKWh - 0.8);
      s.sys.recyclerEff = 0.85;
      s.sys.waterSaving = false;
      s.ctl.activity = 'active';
      mark(s, 'recyclerRepairedLate');
      note(s, 'good', 'act.repairRecycler');
      break;
    }
    case 'repairScrubber':
      if (s.sys.scrubberEff >= 0.8 || s.res.spareParts < 1) return prev;
      s.res.spareParts -= 1;
      s.sys.scrubberEff = 0.95;
      s.ctl.activity = 'active';
      note(s, 'good', 'act.repairScrubber');
      break;
    case 'toggleBackupFilter':
      if (!s.sys.backupFilter) {
        if (s.res.backupCanisters < 1) return prev;
        s.res.backupCanisters -= 1;
        s.sys.backupFilter = true;
        note(s, 'info', 'act.backupFilterOn');
      } else {
        s.sys.backupFilter = false;
      }
      break;
    case 'toggleWaterSaving':
      s.sys.waterSaving = !s.sys.waterSaving;
      break;
    case 'useReserve': {
      const moved = Math.min(5, s.res.reserveWaterL, BALANCE.capacity.waterL - s.res.waterL);
      if (moved <= 0) return prev;
      s.res.reserveWaterL -= moved;
      s.res.waterL += moved;
      note(s, 'info', 'act.useReserve', { l: round(moved, 1) });
      break;
    }
    case 'toggleBackupPower':
      if (!s.sys.backupPower && s.res.backupFuelKWh < 1.5) return prev;
      s.sys.backupPower = !s.sys.backupPower;
      break;
    case 'harvest': {
      const take = Math.max(0, s.plants.leavesG - 30);
      if (take < 20) return prev;
      s.plants.leavesG -= take;
      s.plants.harvestedG += take;
      s.res.foodDays = Math.min(BALANCE.capacity.foodDays, s.res.foodDays + take / S.leafGPerRationDay);
      s.crew.health = clamp(s.crew.health + 1, 0, 100);
      flag(s, 'harvested');
      note(s, 'good', 'act.harvest', { g: Math.round(take) });
      break;
    }
    case 'inspectShelter':
      flag(s, 'inspect:shelter');
      if (s.sys.shelterReadiness < 1) {
        s.sys.shelterReadiness = 1;
        note(s, 'good', 'act.shelterReady');
      }
      break;
    case 'medicalCheck':
      flag(s, 'medical');
      break;
    case 'repairSolarCircuit':
      if (s.marks.includes('solarCircuitFixed')) return prev;
      mark(s, 'solarCircuitFixed');
      s.sys.solarEff = Math.min(1, s.sys.solarEff + 0.15);
      note(s, 'good', 'act.solarFixed');
      break;
    case 'priority': {
      const m = s.messages.find((x) => x.id === a.id);
      if (!m || m.status !== 'queued') return prev;
      m.priority = clamp(m.priority + a.delta, 1, 3) as 1 | 2 | 3;
      flag(s, 'set:priority');
      break;
    }
    case 'reacquireRelay':
      if (s.sys.relayOnline || !s.resolvedEvents.includes('d5_comms')) return prev;
      s.sys.relayOnline = true;
      // The relay pass comes back late in the day: only part of today's bandwidth remains.
      s.bwUsed = Math.max(s.bwUsed, 2);
      note(s, 'good', 'act.relayBack');
      break;
    case 'transmit': {
      if (!s.sys.relayOnline) return prev;
      const n = transmitQueue(s);
      if (n === 0) return prev;
      flag(s, 'transmitted');
      note(s, 'good', 'act.transmit', { n });
      break;
    }
  }
  refresh(s);
  return s;
}

/** Store-and-forward: send queued messages by priority, limited by today's bandwidth. */
function transmitQueue(s: GameState) {
  const cap = commsBandwidth[s.ctl.commsMode] - s.bwUsed;
  if (cap <= 0) return 0;
  const queued = s.messages.filter((m) => m.status === 'queued').sort((a, b) => a.priority - b.priority || a.day - b.day);
  const batch = queued.slice(0, cap);
  batch.forEach((m) => {
    m.status = 'sent';
    m.sentDay = s.day;
  });
  s.bwUsed += batch.length;
  return batch.length;
}

/* ------------------------------------------------------------------ */
/* Day transition – processing order is fixed to avoid double counting  */
/* ------------------------------------------------------------------ */

export const snapshot = (s: GameState): DaySnapshot => ({
  oxygenKg: s.res.oxygenKg,
  waterL: s.res.waterL + s.res.reserveWaterL,
  batteryKWh: s.res.batteryKWh,
  foodDays: s.res.foodDays,
  health: s.crew.health,
  plantHealth: s.plants.health,
  radiation: s.crew.radiation,
  co2: s.crew.co2,
});

export const canEndDay = (s: GameState) => s.phase === 'playing' && s.activeEvents.length === 0 && !s.failed;

/**
 * Ends the current day. Order:
 *  1. compute 24 h rates once from current settings
 *  2. energy balance → 3. oxygen → 4. water (consumption, then recycling of wastewater only)
 *  5. food → 6. plants → 7. crew health / radiation → 8. comms auto-forward
 *  9. failure check → 10. report → (next day starts on continueDay)
 */
export function endDay(prev: GameState): GameState {
  if (!canEndDay(prev)) return prev;
  const s = clone(prev);
  const before = prev.dayStart;
  const logStart = s.log.length;
  const spe = has(s, 'spe');
  const r = computeRates(s, { spe });

  // 2. Energy: Battery(new) = Battery(prev) + charged − used
  if (s.sys.backupPower) {
    s.res.backupFuelKWh = Math.max(0, s.res.backupFuelKWh - r.backupKWh);
    if (s.res.backupFuelKWh < 1.5) s.sys.backupPower = false;
  }
  const rawBattery = s.res.batteryKWh + r.solarKWh + r.backupKWh - r.loadKWh;
  if (rawBattery < 0) note(s, 'bad', 'end.powerShort', { kwh: round(-rawBattery, 1) });
  s.res.batteryKWh = clamp(rawBattery, 0, BALANCE.capacity.batteryKWh);

  // 3. Oxygen
  s.res.oxygenKg = clamp(s.res.oxygenKg + r.o2NetKg, 0, BALANCE.capacity.oxygenKg);

  // 4. Water – consumption once, recovery once (only the wastewater that entered the recycler)
  let water = s.res.waterL - r.waterUse.total + r.waterRecoveredL;
  if (water < 0 && s.res.reserveWaterL > 0) {
    const draw = Math.min(-water, s.res.reserveWaterL);
    s.res.reserveWaterL -= draw;
    water += draw;
    note(s, 'warn', 'end.reserveDraw', { l: round(draw, 1) });
  }
  s.res.waterL = clamp(water, 0, BALANCE.capacity.waterL);

  // 5. Food
  s.res.foodDays = Math.max(0, s.res.foodDays - 1);

  // 6. Plants
  s.plants.health = clamp(s.plants.health + r.plantHealthDelta, 0, 100);
  s.plants.leavesG += r.leafGrowthG;

  // 7. Crew
  let dh = s.ctl.activity === 'rest' ? 2.5 : s.ctl.activity === 'active' ? 0.5 : 1.5;
  if (r.co2 > 3) {
    dh -= (r.co2 - 3) * 10;
    note(s, 'bad', 'end.co2High', { co2: round(r.co2, 1) });
  } else if (r.co2 > 2.5) dh -= 1;
  if (s.sys.waterSaving) dh -= 1.5;
  if (s.res.foodDays <= 0) dh -= 10;
  if (s.res.oxygenKg < 1) dh -= 10;
  if (r.powerCoverage < 1) dh -= (1 - r.powerCoverage) * 20;
  s.crew.radiation = round(s.crew.radiation + r.radiationDose, 2);
  if (r.radiationDose > 1.5) dh -= (r.radiationDose - 1) * 1.2;
  if (s.crew.radiation > BALANCE.radiationLimit * 0.6) dh -= 2;
  s.crew.health = clamp(s.crew.health + dh, 0, 100);

  // 8. Comms: DTN automatically forwards what fits in the remaining bandwidth.
  if (s.sys.relayOnline) transmitQueue(s);

  // 9. Failure
  if (s.res.oxygenKg <= 0) s.failed = 'fail.oxygen';
  else if (s.res.waterL <= 0 && s.res.reserveWaterL <= 0) s.failed = 'fail.water';
  else if (s.crew.health < BALANCE.failure.minHealth) s.failed = 'fail.health';

  refresh(s);
  const objs = OBJECTIVES[s.day] ?? [];
  s.reports.push({
    day: s.day,
    before,
    after: snapshot(s),
    notes: s.log.slice(logStart),
    objectivesDone: objs.filter((o) => o.done(prev)).map((o) => o.id),
    objectivesMissed: objs.filter((o) => !o.done(prev)).map((o) => o.id),
  });
  s.phase = 'report';
  return s;
}

/** Leave the report screen: start the next day or show final results. */
export function continueDay(prev: GameState): GameState {
  if (prev.phase !== 'report') return prev;
  const s = clone(prev);
  if (s.failed || s.day >= BALANCE.missionDays) {
    s.phase = 'final';
    s.completed = !s.failed;
    return s;
  }
  s.day += 1;
  s.flags = [];
  s.bwUsed = 0;
  s.lastOutcome = null;
  // Activity returns to normal unless the player keeps resting.
  if (s.ctl.activity === 'active') s.ctl.activity = 'normal';
  generateMessages(s);
  DAY_START[s.day]?.(s);
  // Delayed consequences due today (conditional)
  const due = s.pending.filter((p) => p.triggerDay === s.day);
  s.pending = s.pending.filter((p) => p.triggerDay !== s.day);
  due.forEach((p) => {
    const e = EFFECTS[p.effect];
    if (e && (!e.when || e.when(s))) e.apply(s);
  });
  s.phase = 'playing';
  refresh(s);
  s.dayStart = snapshot(s);
  return s;
}

/* ------------------------------------------------------------------ */
/* Score                                                                */
/* ------------------------------------------------------------------ */

export function score(s: GameState) {
  const c = BALANCE.capacity;
  const health = (s.crew.health / 100) * 25;
  const resAvg =
    (Math.min(1, s.res.oxygenKg / c.oxygenKg) +
      Math.min(1, s.res.waterL / c.waterL) +
      Math.min(1, s.res.batteryKWh / c.batteryKWh) +
      Math.min(1, s.res.foodDays / c.foodDays)) /
    4;
  const resources = Math.min(1, resAvg / 0.5) * 15;
  const sysChecks = [
    s.sys.recyclerEff >= 0.7,
    s.sys.scrubberEff >= 0.7 || s.sys.backupFilter,
    s.sys.solarEff >= 0.85,
    s.sys.relayOnline,
    s.crew.radiation < BALANCE.radiationLimit * 0.6,
  ];
  const systems = (sysChecks.filter(Boolean).length / sysChecks.length) * 15;
  const plants = (s.plants.health / 100) * 10;
  const sent = s.messages.filter((m) => m.status === 'sent').length;
  const comms = (sent / Math.max(1, s.messages.length)) * 10;
  const q = s.decisions.length ? s.decisions.reduce((a, d) => a + d.quality, 0) / (s.decisions.length * 2) : 0;
  const decisions = q * 15;
  const allObj = s.reports.reduce((a, r) => a + r.objectivesDone.length + r.objectivesMissed.length, 0);
  const doneObj = s.reports.reduce((a, r) => a + r.objectivesDone.length, 0);
  const objectives = (doneObj / Math.max(1, allObj)) * 10;
  let total = health + resources + systems + plants + comms + decisions + objectives;
  if (s.failed) total = Math.min(total, 35);
  total = Math.round(total);
  const stars = s.failed ? (total >= 25 ? 1 : 0) : total >= 90 ? 5 : total >= 78 ? 4 : total >= 62 ? 3 : total >= 45 ? 2 : 1;
  return {
    total,
    stars,
    parts: { health, resources, systems, plants, comms, decisions, objectives },
    sent,
    totalMessages: s.messages.length,
    decisionQuality: q,
    objectives: { done: doneObj, all: allObj },
  };
}
