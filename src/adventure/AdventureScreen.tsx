import { AnimatePresence } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { BottomNav, DayBadge, Logo, ResourceBar, TopRightTools } from '../components/hud/Hud';
import { Briefing } from '../components/screens/Briefing';
import { StatusModal, TimelineModal } from '../components/screens/Modals';
import { DayReportScreen, FinalResults } from '../components/screens/Reports';
import { CommsPanel } from '../components/systems/CommsPanel';
import { EnergyPanel } from '../components/systems/EnergyPanel';
import { GreenhousePanel } from '../components/systems/GreenhousePanel';
import { LifeSupportPanel } from '../components/systems/LifeSupportPanel';
import { SafetyPanel } from '../components/systems/SafetyPanel';
import { useViewport } from '../hooks/useViewport';
import { useT } from '../i18n';
import { canEndDay } from '../sim/engine';
import { EVENTS, has } from '../sim/missions';
import { computeRates } from '../sim/rates';
import type { GameState, SystemId } from '../sim/types';
import { useGame } from '../store/gameStore';
import { Assistant, Celebration, ChoiceCard, ControlsHint, ObjectiveTracker, type CelebrationData, type Say } from './AdventureHud';
import { Explorer } from './Explorer';
import { CircuitPuzzle } from './CircuitPuzzle';
import { PipePuzzle } from './PipePuzzle';
import { EVENT_SPOT, MINIGAME, currentStep, type Ctx } from './steps';
import { WORLDS, spotById, type Interactable, type SceneId } from './world';

const SPOT_SYSTEM: Record<string, SystemId> = {
  solarPanel: 'energy',
  greenhouse: 'greenhouse',
  commsConsole: 'comms',
  shelterDoor: 'safety',
  radMonitor: 'safety',
  waterUnit: 'lifeSupport',
  scrubber: 'lifeSupport',
};
const DISCOVERIES = ['seismometer', 'rover', 'rock', 'crater', 'window'];
const BADGE: Record<string, string> = {
  d1_power: 'powerPlanner',
  d2_water: 'waterHero',
  d3_greenhouse: 'greenThumb',
  d4_radiation: 'safeHaven',
  d4_triage: 'waterHero',
  d5_comms: 'messenger',
  d6_air: 'airGuardian',
};

/** Before/after values shown on the celebration card. */
function changes(a: GameState, b: GameState, num: (v: number, d?: number) => string) {
  const ra = computeRates(a, { spe: has(a, 'spe') });
  const rb = computeRates(b, { spe: has(b, 'spe') });
  const rows = [
    { key: 'ls.recycler', from: a.sys.recyclerEff * 100, to: b.sys.recyclerEff * 100, unit: '%', d: 0, up: true },
    { key: 'adv.ch.waterNet', from: ra.waterNetL, to: rb.waterNetL, unit: ' L', d: 2, up: true },
    { key: 'en.panelEff', from: a.sys.solarEff * 100, to: b.sys.solarEff * 100, unit: '%', d: 0, up: true },
    { key: 'res.co2', from: a.crew.co2, to: b.crew.co2, unit: ' mmHg', d: 2, up: false },
    { key: 'res.battery', from: a.res.batteryKWh, to: b.res.batteryKWh, unit: ' kWh', d: 1, up: true },
    { key: 'res.water', from: a.res.waterL, to: b.res.waterL, unit: ' L', d: 1, up: true },
    { key: 'res.parts', from: a.res.spareParts, to: b.res.spareParts, unit: '', d: 0, up: true },
    { key: 'adv.ch.solarKwh', from: ra.solarKWh, to: rb.solarKWh, unit: ' kWh', d: 2, up: true },
    { key: 'sf.today', from: ra.radiationDose, to: rb.radiationDose, unit: '', d: 1, up: false },
  ];
  return rows
    .filter((r) => Math.abs(r.to - r.from) > 0.005)
    .slice(0, 4)
    .map((r) => ({ key: r.key, from: num(r.from, r.d) + r.unit, to: num(r.to, r.d) + r.unit, good: r.up ? r.to > r.from : r.to < r.from }));
}

export function AdventureScreen({ game }: { game: GameState }) {
  const { t, num } = useT();
  const view = useGame((g) => g.view);
  const modal = useGame((g) => g.modal);
  const setView = useGame((g) => g.setView);
  const dispatch = useGame((g) => g.dispatch);
  const choose = useGame((g) => g.choose);
  const dismissOutcome = useGame((g) => g.dismissOutcome);
  const finishDay = useGame((g) => g.finishDay);

  const [scene, setScene] = useState<SceneId>(game.day === 1 ? 'outside' : 'habitat');
  const [spawn, setSpawn] = useState(() => ({ ...(game.day === 1 ? WORLDS.outside.spawn : { x: 1120, y: 760 }), key: 0 }));
  const [choice, setChoice] = useState<string | null>(null);
  const [mini, setMini] = useState<{ kind: 'pipes'; eventId: string; optionId: string } | { kind: 'circuit' } | null>(null);
  // A decision to open once the current celebration is closed.
  const nextChoice = useRef<string | null>(null);
  const [celebrate, setCelebrate] = useState<CelebrationData | null>(null);
  const [say, setSayState] = useState<Say | null>(null);
  const [info, setInfo] = useState(false);
  const vp = useViewport();
  const compact = vp.compact;
  // Phones: portrait stacks the resources under the header; landscape keeps one row.
  const tall = compact && vp.portrait;
  const belowHud = tall ? 'top-[104px]' : compact ? 'top-[60px]' : '';
  const infoButton = (iconOnly: boolean) => (
    <button
      onClick={() => {
        if (info) setView('station');
        setInfo((v) => !v);
      }}
      className={`glass pointer-events-auto flex items-center gap-2 rounded-2xl text-[13px] font-semibold ${iconOnly ? (compact ? 'h-9 w-9 justify-center' : 'h-11 w-11 justify-center') : 'h-11 px-4'} ${info ? 'text-o2' : ''}`}
      aria-expanded={info}
      aria-label={t('adv.infoBtn')}
    >
      {info ? <X size={16} /> : <Info size={16} className="text-o2" />}
      {!iconOnly && t('adv.infoBtn')}
    </button>
  );
  const sayId = useRef(0);
  const speak = useCallback((key: string, tone: Say['tone'] = 'info', params?: Say['params']) => setSayState({ key, params, tone, id: ++sayId.current }), []);

  const ctx: Ctx = useMemo(() => ({ game, scene }), [game, scene]);
  const step = currentStep(ctx);

  // Guidance target (route through the airlock when the goal is in the other scene).
  const target = useMemo(() => {
    if (!step) return null;
    const loc = spotById(step.spot(ctx));
    if (!loc) return null;
    if (loc.scene === scene) return { x: loc.spot.x, y: loc.spot.y };
    const door = WORLDS[scene].spots.find((s) => s.id === (scene === 'outside' ? 'airlock' : 'exit'))!;
    return { x: door.x, y: door.y };
  }, [step, ctx, scene]);

  // A new day: wake up in the habitat and hear the alert.
  const lastDay = useRef(0);
  useEffect(() => {
    if (game.phase !== 'playing' || lastDay.current === game.day) return;
    const first = lastDay.current === 0;
    lastDay.current = game.day;
    if (!first) {
      setScene('habitat');
      setSpawn((s) => ({ x: 1120, y: 760, key: s.key + 1 }));
    }
    if (game.day > 1) sfx.play('alert');
    speak(`adv.dayStart.${game.day}`, game.day > 1 ? 'warn' : 'info');
  }, [game.day, game.phase, speak]);

  // Luna explains each new objective.
  const lastStep = useRef<string | null>(null);
  useEffect(() => {
    if (!step || game.phase !== 'playing' || step.id === lastStep.current) return;
    const prev = lastStep.current;
    lastStep.current = step.id;
    if (prev === null) {
      // Let the day-start greeting be read first (no cleanup: must survive StrictMode re-runs).
      const id = step.id;
      setTimeout(() => lastStep.current === id && speak(`adv.say.${id}`), 3800);
      return;
    }
    sfx.play('success');
    speak(`adv.say.${step.id}`, 'good');
  }, [step, game.phase, speak]);

  const applyChoice = (eventId: string, optionId: string) => {
    const before = useGame.getState().game!;
    choose(eventId, optionId);
    dismissOutcome();
    const after = useGame.getState().game!;
    if (after === before) return;
    const opt = EVENTS[eventId].options.find((o) => o.id === optionId)!;
    if (opt.quality >= 2) {
      const badge = BADGE[eventId];
      const isNew = badge && !after.marks.includes(`badge:${badge}`);
      if (isNew) dispatch({ type: 'mark', mark: `badge:${badge}` });
      setCelebrate({ titleKey: 'adv.missionDone', factKey: `adv.fact.${eventId}`, badge: isNew ? badge : undefined, changes: changes(before, after, num) });
    } else {
      speak(`ev.${eventId}.${optionId}.impact`, opt.quality === 1 ? 'info' : 'warn');
    }
  };

  const onPick = (optionId: string) => {
    if (!choice) return;
    const eventId = choice;
    setChoice(null);
    if (MINIGAME[`${eventId}:${optionId}`]) {
      speak('mg.pipes.luna');
      setMini({ kind: 'pipes', eventId, optionId });
    } else applyChoice(eventId, optionId);
  };

  const discover = (id: string) => {
    const g = useGame.getState().game!;
    if (!g.marks.includes(`disc:${id}`)) {
      dispatch({ type: 'mark', mark: `disc:${id}` });
      sfx.play('success');
      const found = DISCOVERIES.filter((d) => d === id || g.marks.includes(`disc:${d}`)).length;
      if (found === 3 && !g.marks.includes('badge:explorer')) {
        dispatch({ type: 'mark', mark: 'badge:explorer' });
        setCelebrate({ titleKey: 'adv.explorerTitle', factKey: `adv.disc.${id}`, badge: 'explorer', changes: [] });
        return;
      }
    }
    speak(`adv.disc.${id}`, 'good');
  };

  const onInteract = (spot: Interactable) => {
    const g = useGame.getState().game!;
    if (g.phase !== 'playing') return;
    sfx.play('click');
    if (spot.id === 'airlock') {
      setScene('habitat');
      setSpawn((s) => ({ ...WORLDS.habitat.spawn, key: s.key + 1 }));
      return;
    }
    if (spot.id === 'exit') {
      setScene('outside');
      setSpawn((s) => ({ x: 800, y: 694, key: s.key + 1 }));
      return;
    }
    const sys = SPOT_SYSTEM[spot.id];
    if (sys) dispatch({ type: 'flag', flag: `diag:${sys}` });
    // Day 1: the loose panel cable must be reconnected before planning energy.
    if (spot.id === 'solarPanel' && g.day === 1 && !g.marks.includes('solarCircuitFixed')) {
      speak('adv.circuitFound', 'warn');
      setMini({ kind: 'circuit' });
      return;
    }
    // A decision waiting at this spot?
    const ev = g.activeEvents.find((e) => EVENT_SPOT[e] === spot.id);
    if (ev) {
      if (spot.id === 'waterUnit') dispatch({ type: 'flag', flag: 'viewed:waterForecast' });
      if (spot.id === 'radMonitor' || spot.id === 'shelterDoor') dispatch({ type: 'flag', flag: 'viewed:solar' });
      setChoice(ev);
      return;
    }
    if (DISCOVERIES.includes(spot.id)) return discover(spot.id);
    switch (spot.id) {
      case 'solarPanel':
        return speak('adv.fact.solar', 'info', { eff: Math.round(g.sys.solarEff * 100) });
      case 'greenhouse':
        return speak('adv.fact.greenhouse', 'info', { h: Math.round(g.plants.health) });
      case 'waterUnit':
        dispatch({ type: 'flag', flag: 'viewed:waterForecast' });
        return speak('adv.fact.water', 'info', { eff: Math.round(g.sys.recyclerEff * 100) });
      case 'o2Gen':
        return speak('adv.fact.o2');
      case 'scrubber':
        return speak('adv.fact.co2', g.crew.co2 > 3 ? 'warn' : 'info', { v: num(g.crew.co2, 1) });
      case 'kitchen':
        return speak('adv.fact.food', 'info', { d: num(g.res.foodDays, 1) });
      case 'medkit':
        dispatch({ type: 'medicalCheck' });
        return speak('adv.fact.medical', 'good', { h: Math.round(g.crew.health) });
      case 'radMonitor':
        dispatch({ type: 'flag', flag: 'viewed:solar' });
        return speak(has(g, 'spe') ? 'adv.fact.storm' : 'adv.fact.quiet');
      case 'commsConsole': {
        if (!g.sys.relayOnline && g.resolvedEvents.includes('d5_comms')) {
          const before = g;
          dispatch({ type: 'reacquireRelay' });
          dispatch({ type: 'transmit' });
          const after = useGame.getState().game!;
          const sent = after.messages.filter((m) => m.status === 'sent').length - before.messages.filter((m) => m.status === 'sent').length;
          return setCelebrate({ titleKey: 'adv.relayBack', factKey: 'adv.fact.dtn', changes: [{ key: 'cm.sent', from: '0', to: String(sent), good: true }] });
        }
        if (!g.sys.relayOnline) return speak('adv.fact.noRelay', 'warn');
        const queued = g.messages.filter((m) => m.status === 'queued').length;
        if (queued) {
          dispatch({ type: 'transmit' });
          return speak('adv.fact.sent', 'good', { n: Math.min(queued, 5) });
        }
        return speak('adv.fact.comms');
      }
      case 'shelterDoor':
        if (g.ctl.location === 'shelter' && canEndDay(g)) return finishDay();
        dispatch({ type: 'inspectShelter' });
        return speak('adv.fact.shelter', 'good');
      case 'bunk':
        if (canEndDay(g)) return finishDay();
        return speak('adv.notYet', 'warn');
    }
  };

  const onHint = () => speak(step ? `adv.hint.${step.id}` : 'adv.hint.rest');

  const paused = !!choice || !!mini || !!celebrate || view !== 'station' || !!modal || game.phase !== 'playing';
  const panel = {
    lifeSupport: <LifeSupportPanel game={game} />,
    greenhouse: <GreenhousePanel game={game} />,
    energy: <EnergyPanel game={game} />,
    comms: <CommsPanel game={game} />,
    safety: <SafetyPanel game={game} />,
  } as const;
  const focus = view === 'station' ? null : (view as SystemId);

  return (
    <div className="absolute inset-0">
      <Explorer
        game={game}
        scene={scene}
        spawn={spawn}
        paused={paused}
        repairing={!!mini}
        target={paused ? null : target}
        onInteract={onInteract}
        onMoved={() => undefined}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#040c18]/70 to-transparent" />

      {/* Top HUD: only the four core resources */}
      <header
        dir="ltr"
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 ${compact ? 'px-3 pt-3' : 'px-6 pt-5'}`}
        style={{ paddingTop: compact ? 'max(12px, env(safe-area-inset-top))' : undefined }}
      >
        <div className="pointer-events-auto">
          <Logo />
        </div>
        <div
          className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 ${tall ? 'top-[56px]' : compact ? 'top-3' : 'top-5 max-[1439px]:top-[84px]'}`}
          style={tall ? { top: 'calc(max(12px, env(safe-area-inset-top)) + 44px)' } : undefined}
        >
          <ResourceBar game={game} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <DayBadge game={game} />
          <TopRightTools />
          {vp.touch && infoButton(true)}
        </div>
      </header>

      {game.phase === 'playing' && !focus && (
        <div className={`absolute z-20 ${compact ? `right-3 ${belowHud}` : 'right-6 top-[100px] max-[1439px]:top-[160px]'}`}>
          <ObjectiveTracker ctx={ctx} compact={compact} />
        </div>
      )}

      {/* Luna – bottom-left with a keyboard, top-left when the thumbs need the bottom */}
      {game.phase === 'playing' && !focus && !mini && (
        <div className={`absolute z-20 ${tall ? 'inset-x-3 top-[150px]' : compact ? `left-3 ${belowHud} max-w-[52vw]` : vp.touch ? 'bottom-[176px] left-6' : 'bottom-6 left-6'}`}>
          <Assistant say={say} onHint={onHint} compact={compact || vp.touch} />
        </div>
      )}

      {/* Optional science info (keyboard/mouse layout) */}
      {!vp.touch && (
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
          {!focus && vp.w >= 1100 && <ControlsHint surface={scene === 'outside'} />}
          {infoButton(false)}
        </div>
      )}
      {info && (
        <div className={`absolute inset-x-0 z-30 flex justify-center px-3 ${vp.touch ? 'bottom-4' : 'bottom-[88px]'}`}>
          <BottomNav view={view} />
        </div>
      )}
      <AnimatePresence>
        {focus && (
          <div
            key={focus}
            className={`pointer-events-none absolute z-20 mx-auto flex max-w-[820px] ${compact ? `inset-x-2 ${tall ? 'bottom-[92px] top-[96px]' : 'bottom-[76px] top-[56px]'}` : 'bottom-[170px] left-6 right-6 top-[100px] max-[1439px]:top-[150px]'}`}
          >
            {panel[focus]}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {choice && <ChoiceCard key="choice" game={game} eventId={choice} onPick={onPick} onClose={() => setChoice(null)} />}
        {mini?.kind === 'pipes' && (
          <PipePuzzle
            key="pipes"
            seed={game.day + game.decisions.length}
            onSolved={() => {
              setMini(null);
              applyChoice(mini.eventId, mini.optionId);
            }}
            onClose={() => {
              setMini(null);
              setChoice(mini.eventId);
            }}
          />
        )}
        {mini?.kind === 'circuit' && (
          <CircuitPuzzle
            key="circuit"
            seed={game.reports.length + game.marks.length}
            onSolved={() => {
              setMini(null);
              const before = useGame.getState().game!;
              dispatch({ type: 'repairSolarCircuit' });
              const after = useGame.getState().game!;
              const isNew = !after.marks.includes('badge:electrician');
              if (isNew) dispatch({ type: 'mark', mark: 'badge:electrician' });
              if (after.activeEvents.includes('d1_power')) nextChoice.current = 'd1_power';
              setCelebrate({ titleKey: 'adv.circuitTitle', factKey: 'adv.fact.circuit', badge: isNew ? 'electrician' : undefined, changes: changes(before, after, num) });
            }}
            onClose={() => {
              setMini(null);
              speak('adv.say.d1_repair');
            }}
          />
        )}
        {celebrate && (
          <Celebration
            key="cel"
            data={celebrate}
            onClose={() => {
              setCelebrate(null);
              if (nextChoice.current) {
                setChoice(nextChoice.current);
                nextChoice.current = null;
              }
            }}
          />
        )}
        {game.phase === 'briefing' && <Briefing key="brief" game={game} />}
        {game.phase === 'playing' && modal === 'status' && <StatusModal key="status" game={game} />}
        {modal === 'timeline' && <TimelineModal key="timeline" game={game} />}
        {game.phase === 'report' && <DayReportScreen key={`rep${game.day}`} game={game} />}
        {game.phase === 'final' && <FinalResults key="final" game={game} />}
      </AnimatePresence>
    </div>
  );
}
