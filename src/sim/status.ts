import { NASA_REFERENCE } from '../config/science';
import { has } from './missions';
import { computeRates, percentages } from './rates';
import type { GameState, SystemId } from './types';

export type Level = 'ok' | 'warning' | 'critical';

export function systemLevels(s: GameState): Record<SystemId, Level> {
  const r = computeRates(s, { spe: has(s, 'spe') });
  const p = percentages(s);
  const worst = (...l: Level[]): Level => (l.includes('critical') ? 'critical' : l.includes('warning') ? 'warning' : 'ok');
  return {
    lifeSupport: worst(
      s.crew.co2 > NASA_REFERENCE.co2ThresholdMmHg ? 'critical' : s.crew.co2 > 2.5 ? 'warning' : 'ok',
      s.sys.recyclerEff < 0.7 ? 'warning' : 'ok',
      p.oxygen < 20 || p.water < 15 ? 'critical' : p.oxygen < 35 || p.water < 30 ? 'warning' : 'ok',
    ),
    greenhouse: s.plants.health < 40 ? 'critical' : s.plants.health < 65 || r.plantHealthDelta < 0 ? 'warning' : 'ok',
    energy: p.energy < 15 ? 'critical' : p.energy < 35 || r.netKWh < -0.3 || s.sys.solarEff < 0.85 ? 'warning' : 'ok',
    comms: s.sys.relayOnline ? 'ok' : 'warning',
    safety: has(s, 'spe') && s.ctl.location !== 'shelter' ? 'critical' : s.crew.health < 50 ? 'warning' : has(s, 'spe') ? 'warning' : 'ok',
  };
}

export interface Alert {
  id: string;
  level: Level;
  key: string;
  params?: Record<string, string | number>;
  system: SystemId;
}

/** Alerts are derived only from the real simulation state. */
export function activeAlerts(s: GameState): Alert[] {
  const p = percentages(s);
  const r = computeRates(s, { spe: has(s, 'spe') });
  const a: Alert[] = [];
  const co2 = s.crew.co2.toFixed(1);
  if (has(s, 'spe')) a.push({ id: 'spe', level: 'critical', key: 'alert.spe', system: 'safety' });
  if (s.crew.co2 > NASA_REFERENCE.co2ThresholdMmHg) a.push({ id: 'co2', level: 'critical', key: 'alert.co2', params: { v: co2 }, system: 'lifeSupport' });
  else if (s.crew.co2 > 2.5) a.push({ id: 'co2', level: 'warning', key: 'alert.co2Near', params: { v: co2 }, system: 'lifeSupport' });
  if (p.oxygen < 30) a.push({ id: 'o2', level: p.oxygen < 15 ? 'critical' : 'warning', key: 'alert.lowO2', system: 'lifeSupport' });
  if (p.water < 25) a.push({ id: 'water', level: p.water < 12 ? 'critical' : 'warning', key: 'alert.lowWater', system: 'lifeSupport' });
  if (!s.sys.relayOnline) a.push({ id: 'comms', level: 'warning', key: 'alert.comms', system: 'comms' });
  if (p.energy < 25) a.push({ id: 'energy', level: p.energy < 10 ? 'critical' : 'warning', key: 'alert.lowEnergy', system: 'energy' });
  else if (r.netKWh < -0.3) a.push({ id: 'deficit', level: 'warning', key: 'alert.powerDeficit', system: 'energy' });
  if (s.sys.solarEff < 0.85) a.push({ id: 'solar', level: 'warning', key: 'alert.solar', system: 'energy' });
  if (s.sys.recyclerEff < 0.7) a.push({ id: 'recycler', level: 'warning', key: 'alert.recycler', system: 'lifeSupport' });
  if (p.food < 20) a.push({ id: 'food', level: 'warning', key: 'alert.lowFood', system: 'greenhouse' });
  if (s.crew.health < 50) a.push({ id: 'health', level: s.crew.health < 30 ? 'critical' : 'warning', key: 'alert.health', system: 'safety' });
  return a;
}
