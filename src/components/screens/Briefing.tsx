import { motion } from 'framer-motion';
import { Droplets, Leaf, MapPin, Target, User, Wind, Zap } from 'lucide-react';
import { BALANCE } from '../../config/science';
import { useT } from '../../i18n';
import { percentages } from '../../sim/rates';
import type { GameState } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { COLORS, Learn } from '../ui/primitives';

export function Briefing({ game }: { game: GameState }) {
  const { t, num } = useT();
  const begin = useGame((g) => g.beginMission);
  const p = percentages(game);
  const c = BALANCE.capacity;
  const res = [
    { k: 'oxygen', icon: Wind, color: COLORS.oxygen, v: `${num(game.res.oxygenKg, 1)} / ${c.oxygenKg} kg`, p: p.oxygen },
    { k: 'water', icon: Droplets, color: COLORS.water, v: `${num(game.res.waterL, 0)} / ${c.waterL} L`, p: p.water },
    { k: 'energy', icon: Zap, color: COLORS.energy, v: `${num(game.res.batteryKWh, 1)} / ${c.batteryKWh} kWh`, p: p.energy },
    { k: 'food', icon: Leaf, color: COLORS.food, v: `${num(game.res.foodDays, 1)} / ${c.foodDays}`, p: p.food },
  ];
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-[#020a14]/70 p-4 backdrop-blur-md max-sm:p-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-strong scroll-thin max-h-[96dvh] w-full max-w-[1080px] overflow-y-auto rounded-[24px] p-4 sm:p-6 lg:p-8" role="dialog" aria-modal="true">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-warm">{t('brief.title')}</div>
        <h1 className="font-display mt-1 text-[30px] font-extrabold">{t('brand.title')} · {t('brand.sub')}</h1>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {(
            [
              [MapPin, 'brief.where', 'brief.whereText'],
              [User, 'brief.astronaut', 'brief.astronautText'],
              [Target, 'brief.goal', 'brief.goalText'],
            ] as const
          ).map(([Icon, h, b]) => (
            <div key={h} className="rounded-2xl bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
                <Icon size={16} className="text-o2" />
                {t(h)}
              </div>
              <p className="text-[13px] leading-relaxed text-ink/80">{t(b)}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 mb-3 text-[14px] font-semibold text-ink/85">{t('brief.resources')}</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {res.map(({ k, icon: Icon, color, v, p }) => (
            <div key={k} className="rounded-2xl bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-[13px]" style={{ color }}>
                <Icon size={16} />
                {t(`res.${k}`)}
              </div>
              <div className="num mt-1 text-[18px] font-semibold">{v}</div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Learn kind="sim">
            {t('common.simAssumption')}: {t('res.oxygen')} {c.oxygenKg} kg · {t('res.water')} {c.waterL} L (+{game.res.reserveWaterL} L) · {t('res.battery')} {c.batteryKWh} kWh · {t('res.parts')} {game.res.spareParts}
          </Learn>
        </div>

        <h3 className="mt-6 mb-3 text-[14px] font-semibold text-ink/85">{t('brief.timeline')}</h3>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <li key={i} className={`rounded-xl p-3 ${i === 0 ? 'bg-o2/12 ring-1 ring-o2/40' : 'bg-white/[0.04]'}`}>
              <div className="text-[11px] text-muted">
                {t('common.day')} {i + 1}
              </div>
              <div className="mt-0.5 text-[12.5px] font-semibold leading-snug">{t(`day.${i + 1}`)}</div>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex justify-end">
          <button className="btn btn-primary h-12 px-10 text-[16px]" onClick={begin}>
            {t('brief.go')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
