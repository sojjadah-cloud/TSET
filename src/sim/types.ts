export type Lang = 'ar' | 'en';
export type Phase = 'welcome' | 'briefing' | 'playing' | 'report' | 'final';
export type SystemId = 'lifeSupport' | 'greenhouse' | 'energy' | 'comms' | 'safety';
export type Activity = 'rest' | 'normal' | 'active';
export type LightProfile = 'balanced' | 'redRich' | 'blueRich';
export type CommsMode = 'standard' | 'low' | 'boost';
export type Location = 'habitat' | 'shelter';
export type Risk = 'low' | 'medium' | 'high';
export type ResourceKey = 'oxygen' | 'water' | 'energy' | 'food' | 'health' | 'plants' | 'comms' | 'radiation' | 'co2' | 'parts';

/** A localized message: i18n key plus interpolation params. */
export interface Msg {
  key: string;
  params?: Record<string, string | number>;
}

export interface LogEntry {
  day: number;
  tone: 'good' | 'bad' | 'info' | 'warn';
  msg: Msg;
}

export interface CommMessage {
  id: string;
  kind: 'telemetry' | 'science' | 'health' | 'family' | 'plants';
  day: number;
  priority: 1 | 2 | 3; // 1 = highest
  status: 'queued' | 'sent';
  sentDay?: number;
}

export interface Resources {
  oxygenKg: number;
  waterL: number;
  reserveWaterL: number;
  batteryKWh: number;
  foodDays: number;
  spareParts: number;
  backupCanisters: number;
  backupFuelKWh: number;
}

export interface Systems {
  recyclerEff: number; // 0..1
  scrubberEff: number; // 0..1
  solarEff: number; // 0..1
  relayOnline: boolean;
  shelterReadiness: number; // 0..1
  backupFilter: boolean;
  backupPower: boolean;
  waterSaving: boolean;
  shelterHeater: boolean;
}

export interface Controls {
  lifeSupportPower: number; // 60..100 %
  lightIntensity: number; // 0..100 %
  lightProfile: LightProfile;
  plantWaterL: number; // L/day
  commsMode: CommsMode;
  activity: Activity;
  location: Location;
  evaAuthorized: boolean;
}

export interface Plants {
  health: number; // 0..100
  leavesG: number;
  harvestedG: number;
}

export interface Crew {
  health: number; // 0..100
  radiation: number; // simulated units, cumulative
  co2: number; // mmHg, last computed
}

export interface DecisionRecord {
  eventId: string;
  optionId: string;
  day: number;
  quality: number; // 0..2
}

export interface PendingConsequence {
  id: string;
  source: string; // eventId:optionId
  triggerDay: number;
  effect: string; // key into EFFECTS
}

export interface DaySnapshot {
  oxygenKg: number;
  waterL: number;
  batteryKWh: number;
  foodDays: number;
  health: number;
  plantHealth: number;
  radiation: number;
  co2: number;
}

export interface DayReport {
  day: number;
  before: DaySnapshot;
  after: DaySnapshot;
  notes: LogEntry[];
  objectivesDone: string[];
  objectivesMissed: string[];
}

export interface GameState {
  version: number;
  phase: Phase;
  day: number;
  res: Resources;
  sys: Systems;
  ctl: Controls;
  plants: Plants;
  crew: Crew;
  messages: CommMessage[];
  flags: string[]; // per-day action flags (reset each day)
  marks: string[]; // permanent markers left by decisions/actions
  bwUsed: number; // messages transmitted today
  decisions: DecisionRecord[];
  pending: PendingConsequence[];
  activeEvents: string[]; // unresolved event ids for today
  resolvedEvents: string[];
  log: LogEntry[];
  reports: DayReport[];
  failed: string | null; // failure reason key
  completed: boolean;
  lastOutcome: { eventId: string; optionId: string } | null;
  dayStart: DaySnapshot;
}
