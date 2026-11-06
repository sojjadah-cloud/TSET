import { AnimatePresence, motion } from 'framer-motion';
import { Save } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { sfx } from './audio/sfx';
import { AdventureScreen } from './adventure/AdventureScreen';
import { Alerts, BottomNav, DayBadge, Logo, MissionCard, ResourceBar, TopRightTools } from './components/hud/Hud';
import { StationScene } from './components/scene/StationScene';
import { Briefing } from './components/screens/Briefing';
import { DecisionModal } from './components/screens/DecisionModal';
import { HowToModal, ModalFrame, SettingsModal, StatusModal, TimelineModal } from './components/screens/Modals';
import { DayReportScreen, FinalResults } from './components/screens/Reports';
import { Welcome } from './components/screens/Welcome';
import { CommsPanel } from './components/systems/CommsPanel';
import { EnergyPanel } from './components/systems/EnergyPanel';
import { GreenhousePanel } from './components/systems/GreenhousePanel';
import { LifeSupportPanel } from './components/systems/LifeSupportPanel';
import { SafetyPanel } from './components/systems/SafetyPanel';
import { useT } from './i18n';
import type { GameState, SystemId } from './sim/types';
import { useGame } from './store/gameStore';

export default function App() {
  const { lang, dir, t } = useT();
  const screen = useGame((g) => g.screen);
  const game = useGame((g) => g.game);
  const modal = useGame((g) => g.modal);
  const reduceMotion = useGame((g) => g.reduceMotion);
  const corrupt = useGame((g) => g.corruptNotice);
  const dismissCorrupt = useGame((g) => g.dismissCorrupt);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = lang === 'ar' ? 'المحطة القمرية | Lunar Station' : 'Lunar Station | المحطة القمرية';
  }, [lang, dir]);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    <div dir={dir} className={`relative h-full w-full overflow-hidden bg-space ${reduceMotion ? 'reduce-motion' : ''}`}>
      {screen === 'welcome' || !game ? <Welcome /> : <AdventureScreen game={game} />}
      <AnimatePresence>
        {modal === 'settings' && <SettingsModal key="settings" />}
        {modal === 'how' && <HowToModal key="how" />}
        {corrupt && (
          <ModalFrame key="corrupt" title={t('welcome.settings')} onClose={dismissCorrupt}>
            <p className="text-[14px] text-ink/85">{t('settings.corrupt')}</p>
          </ModalFrame>
        )}
      </AnimatePresence>
    </div>
  );
}

// Classic click-to-manage view, kept for reference/testing.
export function GameScreen({ game }: { game: GameState }) {
  const { dir, t } = useT();
  const view = useGame((g) => g.view);
  const modal = useGame((g) => g.modal);
  const setView = useGame((g) => g.setView);
  const setModal = useGame((g) => g.setModal);
  const savedAt = useGame((g) => g.savedAt);
  const focus = view === 'station' ? null : (view as SystemId);
  // Facilities on the right of the base open their panel on the left, and vice versa.
  const panelLeft = focus === 'comms' || focus === 'safety';
  const shown = useRef<string>('');

  // Surface a new decision automatically when the day begins.
  useEffect(() => {
    const ev = game.activeEvents[0];
    if (game.phase !== 'playing' || !ev) return;
    const key = `${game.day}:${ev}`;
    if (shown.current === key) return;
    const timer = setTimeout(() => {
      shown.current = key;
      sfx.play('alert');
      setModal('decision');
    }, 1100);
    return () => clearTimeout(timer);
  }, [game.phase, game.day, game.activeEvents, setModal]);

  // Escape returns to the station / closes modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modal) setModal(null);
      else if (view !== 'station') setView('station');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, view, setModal, setView]);

  const panel = {
    lifeSupport: <LifeSupportPanel game={game} />,
    greenhouse: <GreenhousePanel game={game} />,
    energy: <EnergyPanel game={game} />,
    comms: <CommsPanel game={game} />,
    safety: <SafetyPanel game={game} />,
  } as const;

  const showDecision = modal === 'decision' || !!game.lastOutcome;

  return (
    <div className="absolute inset-0">
      <StationScene game={game} focus={focus} onSelect={setView} targetX={panelLeft ? 1180 : 420} />
      {/* Readability gradients behind the HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#040c18]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#040c18]/70 to-transparent" />

      {/* Top HUD */}
      <header dir="ltr" className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-6 pt-5">
        <div className="pointer-events-auto flex flex-col gap-4" dir={dir}>
          <Logo />
          {view === 'station' && (
            <div className="max-[1439px]:mt-[60px]">
              <Alerts game={game} />
            </div>
          )}
        </div>
        <div className="pointer-events-auto absolute left-1/2 top-5 -translate-x-1/2 max-[1439px]:top-[84px]" dir={dir}>
          <ResourceBar game={game} />
        </div>
        <div className="pointer-events-auto flex items-center gap-2" dir={dir}>
          <DayBadge game={game} />
          <TopRightTools />
        </div>
      </header>

      {/* Mission card (station view) */}
      <AnimatePresence>
        {view === 'station' && game.phase === 'playing' && (
          <motion.div key="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="absolute right-6 top-[112px] z-20 max-[1439px]:top-[160px]">
            <MissionCard game={game} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* System panel */}
      <AnimatePresence>
        {focus && (
          <div key={focus} className={`pointer-events-none absolute bottom-[104px] top-[100px] z-20 max-[1439px]:top-[150px] flex w-[min(760px,56vw)] max-[900px]:inset-x-4 max-[900px]:w-auto ${panelLeft ? 'left-6' : 'right-6'}`}>
            {panel[focus]}
          </div>
        )}
      </AnimatePresence>

      {/* Bottom navigation */}
      <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
        <BottomNav view={view} />
      </div>

      {/* Save indicator */}
      <AnimatePresence>
        {savedAt > 0 && (
          <motion.div key={savedAt} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2, times: [0, 0.1, 0.8, 1] }} className="pointer-events-none absolute bottom-8 left-6 z-20 flex items-center gap-1.5 text-[11.5px] text-muted">
            <Save size={12} />
            {t('common.saved')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {game.phase === 'briefing' && <Briefing key="brief" game={game} />}
        {game.phase === 'playing' && showDecision && <DecisionModal key="dec" game={game} />}
        {game.phase === 'playing' && modal === 'status' && <StatusModal key="status" game={game} />}
        {modal === 'timeline' && <TimelineModal key="timeline" game={game} />}
        {game.phase === 'report' && <DayReportScreen key={`rep${game.day}`} game={game} />}
        {game.phase === 'final' && <FinalResults key="final" game={game} />}
      </AnimatePresence>
    </div>
  );
}
