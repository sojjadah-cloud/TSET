import { describe, expect, it } from 'vitest';
import { act, continueDay, decide, endDay, newGame, score } from '../engine';
import { computeRates } from '../rates';
import type { GameState } from '../types';

function play(choices: Record<string, string>, extra?: (s: GameState) => GameState) {
  let s = newGame();
  s.phase = 'playing';
  const trace: string[] = [];
  for (let d = 1; d <= 7; d++) {
    if (extra) s = extra(s);
    while (s.activeEvents.length) {
      const ev = s.activeEvents[0];
      const n = decide(s, ev, choices[ev]);
      if (n === s) throw new Error(`blocked ${ev}:${choices[ev]}`);
      s = n;
    }
    if (extra) s = extra(s);
    s = endDay(s);
    const r = s.reports[s.reports.length - 1].after;
    trace.push(`D${d} O2 ${r.oxygenKg.toFixed(2)} W ${r.waterL.toFixed(1)} B ${r.batteryKWh.toFixed(2)} F ${r.foodDays.toFixed(1)} H ${r.health.toFixed(1)} P ${r.plantHealth.toFixed(0)} R ${r.radiation} CO2 ${r.co2}`);
    s = continueDay(s);
    if (s.phase === 'final') break;
  }
  return { s, trace };
}

const best = { d1_power: 'balanced', d2_water: 'repair', d3_greenhouse: 'clean', d4_radiation: 'shelter', d5_comms: 'storeForward', d6_air: 'repair', d4_triage: 'repairLate' };
const worst = { d1_power: 'growth', d2_water: 'reserve', d3_greenhouse: 'dim', d4_radiation: 'quickEva', d5_comms: 'retry', d6_air: 'rest', d4_triage: 'plantsFirst' };

describe('mission engine', () => {
  it('good path completes', () => {
    const { s, trace } = play(best, (s) => {
      let n = s;
      if (n.day === 5 && n.resolvedEvents.includes('d5_comms')) n = act(n, { type: 'reacquireRelay' });
      return n;
    });
    console.log('BEST\n' + trace.join('\n'), score(s));
    expect(s.phase).toBe('final');
    expect(s.completed).toBe(true);
  });
  it('bad path is punished', () => {
    const { s, trace } = play(worst);
    console.log('WORST\n' + trace.join('\n'), score(s), s.failed);
    expect(score(s).total).toBeLessThan(70);
  });
  it('water recycling applies only to wastewater', () => {
    const s = newGame();
    const r = computeRates(s);
    expect(r.waterRecoveredL).toBeLessThan(r.waterUse.total);
    expect(r.waterRecoveredL).toBeCloseTo(r.wastewaterL * s.sys.recyclerEff, 5);
  });
  it('day transition consumes once', () => {
    let s = newGame();
    s.phase = 'playing';
    s = decide(s, 'd1_power', 'balanced');
    const r = computeRates(s);
    const w0 = s.res.waterL;
    s = endDay(s);
    expect(s.res.waterL).toBeCloseTo(w0 + r.waterNetL, 5);
    const again = endDay(s); // not allowed in report phase
    expect(again).toBe(s);
  });
  it('messages are never deleted', () => {
    const { s } = play(best);
    expect(s.messages.length).toBeGreaterThan(20);
  });
});
