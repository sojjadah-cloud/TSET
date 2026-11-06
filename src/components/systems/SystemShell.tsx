import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ScanLine, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { has } from '../../sim/missions';
import { systemLevels } from '../../sim/status';
import type { GameState, SystemId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { COLORS, Pill } from '../ui/primitives';

export function SystemShell({ id, game, icon, children }: { id: SystemId; game: GameState; icon: ReactNode; children: ReactNode }) {
  const { t, dir } = useT();
  const setView = useGame((g) => g.setView);
  const dispatch = useGame((g) => g.dispatch);
  const level = systemLevels(game)[id];
  const diag = has(game, `diag:${id}`);
  const Back = dir === 'rtl' ? ArrowRight : ArrowLeft;
  return (
    <motion.aside
      key={id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      className="glass-strong pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-[24px]"
      aria-label={t(`sys.${id}`)}
    >
      <header className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
        <button onClick={() => setView('station')} className="btn btn-ghost h-10 w-10 shrink-0 rounded-xl" aria-label={t('common.back')} title={t('common.back')}>
          <Back size={18} />
        </button>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-o2/12 text-o2">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-[19px] font-bold">{t(`sys.${id}`)}</h2>
          <div className="truncate text-[12px] text-muted">{t(`sys.${id}.desc`)}</div>
        </div>
        <Pill color={COLORS[level]}>{t(level === 'ok' ? 'common.ok' : level === 'warning' ? 'common.warning' : 'common.critical')}</Pill>
        <button onClick={() => dispatch({ type: 'flag', flag: `diag:${id}` })} className={`btn h-10 px-3 text-[12.5px] ${diag ? 'btn-ghost text-o2' : 'btn-teal'}`} aria-pressed={diag}>
          {diag ? <CheckCircle2 size={16} /> : <ScanLine size={16} />}
          <span className="hidden xl:inline">{diag ? t('common.diagDone') : t('common.runDiag')}</span>
        </button>
      </header>
      <div className="scroll-thin flex-1 overflow-y-auto p-5">{children}</div>
    </motion.aside>
  );
}
