import { BALANCE, DERIVED, NASA_REFERENCE as N, SIM_ASSUMPTIONS as S } from '../config/science';
import type { Activity, GameState, LightProfile } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** O2 consumption by activity. "normal" is an interpolation (simulation assumption). */
export const o2Consumption = (a: Activity) =>
  a === 'rest' ? N.o2RestKgPerDay : a === 'active' ? N.o2ActiveKgPerDay : (N.o2RestKgPerDay + N.o2ActiveKgPerDay) / 2;

const activityCo2Factor: Record<Activity, number> = { rest: 1, normal: 1.15, active: 1.4 };

/** Plant response to light profile (simplified model, inspired by VEG-04 red/blue treatments). */
export const profileFactor: Record<LightProfile, { growth: number; power: number }> = {
  balanced: { growth: 1, power: 1 },
  redRich: { growth: 0.95, power: 0.85 },
  blueRich: { growth: 0.9, power: 1.1 },
};

export const commsLoad = { standard: 1, low: 0.5, boost: 1.8 } as const;
export const commsBandwidth = { standard: 5, low: 2, boost: 7 } as const;

/** Everything the station will do over the next 24 h with the current settings. */
export interface DailyRates {
  solarKWh: number;
  backupKWh: number;
  loads: { lifeSupport: number; greenhouse: number; comms: number; safety: number; habitat: number };
  loadKWh: number;
  netKWh: number;
  /** 0..1 – share of demand the battery + solar can actually cover. */
  powerCoverage: number;
  o2GenKg: number;
  o2UseKg: number;
  o2NetKg: number;
  waterUse: { drink: number; hygiene: number; electrolysis: number; plants: number; total: number };
  waterRecoveredL: number;
  waterNetL: number;
  wastewaterL: number;
  co2: number;
  plantHealthDelta: number;
  leafGrowthG: number;
  radiationDose: number;
}

export function plantWaterFactor(waterL: number) {
  const r = waterL / S.plantWaterOptimalL;
  if (r < 0.5) return -6; // wilting
  if (r < 0.85) return -2;
  if (r <= 1.25) return 1.5; // healthy range
  if (r <= 1.75) return -1.5; // over-watering, roots lack oxygen
  return -5;
}

export function plantLightFactor(intensity: number) {
  if (intensity < 30) return -6;
  if (intensity < 60) return -2.5;
  if (intensity < 85) return 0;
  return 1.5;
}

export function computeRates(s: GameState, opts: { spe?: boolean } = {}): DailyRates {
  const { ctl, sys, plants } = s;
  const lsShare = ctl.lifeSupportPower / 100;
  const loads = {
    lifeSupport: S.loadKWh.lifeSupport * lsShare + (sys.backupFilter ? 0.3 : 0),
    greenhouse: S.loadKWh.greenhouse * (ctl.lightIntensity / 100) * profileFactor[ctl.lightProfile].power,
    comms: S.loadKWh.comms * commsLoad[ctl.commsMode] * (sys.relayOnline || ctl.commsMode === 'boost' ? 1 : 0.6),
    safety: S.loadKWh.safety + (sys.shelterHeater ? 0.3 : 0),
    habitat: S.loadKWh.habitat * (ctl.location === 'shelter' ? 0.6 : 1),
  };
  const loadKWh = Object.values(loads).reduce((a, b) => a + b, 0);
  const solarKWh = S.solarAvgKW * 24 * sys.solarEff;
  const backupKWh = sys.backupPower ? 1.5 : 0;
  const netKWh = solarKWh + backupKWh - loadKWh;
  const available = s.res.batteryKWh + solarKWh + backupKWh;
  const powerCoverage = clamp(available / loadKWh, 0, 1);

  // Life support performance scales with its power share and actual coverage.
  const lsPerf = lsShare * powerCoverage;
  const o2GenKg = S.o2GenKgPerDay * lsPerf;
  const o2UseKg = o2Consumption(ctl.activity);

  const hygiene = N.hygieneWaterLPerDay * (sys.waterSaving ? 0.5 : 1);
  const drink = N.drinkWaterLPerDay;
  const electrolysis = o2GenKg * DERIVED.waterPerKgO2;
  const plantsW = ctl.plantWaterL;
  const wastewaterL = drink * S.drinkReturnFraction + hygiene * S.hygieneReturnFraction;
  // Recycling applies ONLY to water that actually enters the recycler.
  const waterRecoveredL = wastewaterL * sys.recyclerEff * lsPerf;
  const waterTotal = drink + hygiene + electrolysis + plantsW;

  const scrub = Math.max(0.2, (sys.backupFilter ? Math.max(sys.scrubberEff, 0.85) : sys.scrubberEff) * (0.4 + 0.6 * lsPerf));
  const plantUptake = 0.4 * (plants.health / 100) * (ctl.lightIntensity / 100);
  const co2 = Math.max(0.4, (S.co2BaselineMmHg * activityCo2Factor[ctl.activity]) / scrub - plantUptake);

  const plantHealthDelta = plantWaterFactor(plantsW) + plantLightFactor(ctl.lightIntensity * Math.min(1, powerCoverage + 0.1));
  const growthCond = clamp(plants.health / 100, 0, 1) * clamp(ctl.lightIntensity / 100, 0, 1.1) * profileFactor[ctl.lightProfile].growth;
  const leafGrowthG = S.leafGrowthGPerDay * growthCond * (plantWaterFactor(plantsW) > 0 ? 1 : 0.5);

  const shelterProtection = ctl.location === 'shelter' ? 0.15 + (1 - sys.shelterReadiness) * 0.5 : 1;
  const speDose = opts.spe ? 6 * shelterProtection : 0;
  const radiationDose = S.radBackgroundPerDay * (ctl.location === 'shelter' ? 0.6 : 1) + speDose;

  return {
    solarKWh,
    backupKWh,
    loads,
    loadKWh,
    netKWh,
    powerCoverage,
    o2GenKg,
    o2UseKg,
    o2NetKg: o2GenKg - o2UseKg,
    waterUse: { drink, hygiene, electrolysis, plants: plantsW, total: waterTotal },
    waterRecoveredL,
    waterNetL: waterRecoveredL - waterTotal,
    wastewaterL,
    co2,
    plantHealthDelta,
    leafGrowthG,
    radiationDose,
  };
}

/** Percentages always derive from real quantities and declared capacities. */
export function percentages(s: GameState) {
  const c = BALANCE.capacity;
  return {
    oxygen: clamp((s.res.oxygenKg / c.oxygenKg) * 100, 0, 100),
    water: clamp((s.res.waterL / c.waterL) * 100, 0, 100),
    energy: clamp((s.res.batteryKWh / c.batteryKWh) * 100, 0, 100),
    food: clamp((s.res.foodDays / c.foodDays) * 100, 0, 100),
  };
}
