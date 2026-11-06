import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Star, XCircle, RotateCcw, Home } from 'lucide-react';
import { BALANCE } from '../../config/science';
import { useT } from '../../i18n';
import { score } from '../../sim/engine';
import type { DaySnapshot, GameState } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { COLORS, Ring } from '../ui/primitives';

const ROWS: { k: keyof DaySnapshot; label: string; unit: string; d: number; good: 'up' | 'down'; color: string }[] = [
  { k: 'oxygenKg', label: 'res.oxygen', unit: 'kg', d: 2, good: 'up', color: COLORS.oxygen },
  { k: 'waterL', label: 'res.water', unit: 'L', d: 1, good: 'up', color: COLORS.water },
  { k: 'batteryKWh', label: 'res.battery', unit: 'kWh', d: 2, good: 'up', color: COLORS.energy },
  { k: 'foodDays', label: 'res.food', unit: '', d: 1, good: 'up', color: COLORS.food },
  { k: 'health', label: 'res.health', unit: '%', d: 0, good: 'up', color: COLORS.oxygen },
  { k: 'plantHealth', label: 'res.plants', unit: '%', d: 0, good: 'up', color: '#8fdc8f' },
  { k: 'co2', label: 'res.co2', unit: 'mmHg', d: 2, good: 'down', color: COLORS.food },
  { k: 'radiation', label: 'res.radiation', unit: '', d: 1, good: 'down', color: COLORS.energy },
];

export function DayReportScreen({ game }: { game: GameState }) {
  const { t, tm, num } = useT();
  const next = useGame((g) => g.nextDay);
  const rep = game.reports[game.reports.length - 1];
  if (!rep) return null;
  const last = !!game.failed || game.day >= BALANCE.missionDays;
  const decs = game.decisions.filter((d) => d.day === rep.day);
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-[#020a14]/75 p-4 backdrop-blur-md max-sm:p-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-strong scroll-thin max-h-[96dvh] w-full max-w-[1040px] overflow-y-auto rounded-[24px] p-4 sm:p-6 lg:p-8" role="dialog" aria-modal="true">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-warm">{t(`day.${rep.day}`)}</div>
        <h1 className="font-display mt-1 text-[28px] font-extrabold">{game.failed ? t('rep.failed') : t('rep.title', { d: rep.day })}</h1>
        {game.failed && <p className="mt-2 rounded-xl bg-food/12 px-4 py-3 text-[14px] text-[#f8b2a2]">{t(game.failed)}</p>}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <section>
            <h3 className="mb-3 text-[14px] font-semibold text-ink/85">{t('rep.changes')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {ROWS.map((r) => {
                const a = rep.before[r.k];
                const b = rep.after[r.k];
                const delta = b - a;
                const good = r.good === 'up' ? delta >= 0 : delta <= 0;
                const Arrow = delta >= 0 ? ArrowUpRight : ArrowDownRight;
                return (
                  <div key={r.k} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <div className="text-[11.5px] text-muted">{t(r.label)}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="num text-[16px] font-semibold" style={{ color: r.color }}>
                        {num(b, r.d)} {r.unit}
                      </span>
                      <span className="num ms-auto flex items-center text-[12px] font-semibold" style={{ color: Math.abs(delta) < 0.005 ? COLORS.muted : good ? COLORS.oxygen : COLORS.critical }}>
                        <Arrow size={13} />
                        {delta >= 0 ? '+' : ''}
                        {num(delta, r.d)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="space-y-5">
            <div>
              <h3 className="mb-2 text-[14px] font-semibold text-ink/85">{t('rep.objectives')}</h3>
              <ul className="space-y-1">
                {rep.objectivesDone.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-[13px] text-ink/85">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-o2" />
                    {t(o)}
                  </li>
                ))}
                {rep.objectivesMissed.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-[13px] text-ink/55">
                    <Circle size={15} className="mt-0.5 shrink-0 text-white/30" />
                    {t(o)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-[14px] font-semibold text-ink/85">{t('rep.events')}</h3>
              <ul className="space-y-1.5">
                {decs.map((d) => (
                  <li key={d.eventId} className="rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px]">
                    <b>{t(`ev.${d.eventId}.${d.optionId}.label`)}</b>
                    <div className="text-ink/75">{t(`ev.${d.eventId}.${d.optionId}.impact`)}</div>
                  </li>
                ))}
                {rep.notes
                  .filter((n) => !n.msg.key.endsWith('.outcome'))
                  .map((n, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] text-ink/80">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.tone === 'good' ? COLORS.oxygen : n.tone === 'bad' ? COLORS.critical : n.tone === 'warn' ? COLORS.warning : COLORS.water }} />
                      {tm(n.msg)}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-[14px] font-semibold text-ink/85">{t('rep.safety')}</h3>
              <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px] text-ink/80">
                {t('res.health')}: <b className="num">{Math.round(rep.after.health)}%</b> · {t('res.radiation')}: <b className="num">{num(rep.after.radiation, 1)}</b> · CO₂ <b className="num">{num(rep.after.co2, 2)}</b> mmHg
              </div>
            </div>
          </section>
        </div>

        <div className="mt-7 flex justify-end">
          <button className="btn btn-primary h-12 px-10 text-[16px]" onClick={next}>
            {last ? t('rep.final') : t('rep.next', { d: rep.day + 1 })}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FinalResults({ game }: { game: GameState }) {
  const { t, num } = useT();
  const startNew = useGame((g) => g.startNew);
  const toWelcome = useGame((g) => g.toWelcome);
  const sc = score(game);
  const ok = game.completed;
  const c = BALANCE.capacity;
  const tiles: [string, string, string][] = [
    [t('fin.astronaut'), `${Math.round(game.crew.health)}%`, game.crew.health >= 70 ? COLORS.oxygen : COLORS.warning],
    [t('res.oxygen'), `${num(game.res.oxygenKg, 1)} / ${c.oxygenKg} kg`, COLORS.oxygen],
    [t('res.water'), `${num(game.res.waterL, 1)} L (+${num(game.res.reserveWaterL, 1)})`, COLORS.water],
    [t('res.energy'), `${num(game.res.batteryKWh, 1)} kWh`, COLORS.energy],
    [t('res.food'), `${num(game.res.foodDays, 1)}`, COLORS.food],
    [t('fin.greenhouse'), `${Math.round(game.plants.health)}% · ${Math.round(game.plants.harvestedG)} g`, '#8fdc8f'],
    [t('fin.comms'), `${sc.sent} / ${sc.totalMessages}`, COLORS.water],
    [t('fin.decisions'), `${Math.round(sc.decisionQuality * 100)}%`, COLORS.warning],
    [t('fin.objectives'), `${sc.objectives.done} / ${sc.objectives.all}`, COLORS.oxygen],
    [t('res.radiation'), `${num(game.crew.radiation, 1)} / ${BALANCE.radiationLimit}`, COLORS.energy],
  ];
  const lessons = ['water', 'energy', 'radiation', 'comms', 'air'];
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-[#020a14]/75 p-4 backdrop-blur-md max-sm:p-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-strong scroll-thin max-h-[96dvh] w-full max-w-[1100px] overflow-y-auto rounded-[24px] p-4 sm:p-6 lg:p-8" role="dialog" aria-modal="true">
        <div className="flex flex-wrap items-center gap-6">
          <Ring value={sc.total} color={ok ? COLORS.oxygen : COLORS.critical} size={124} stroke={10}>
            <div className="text-center leading-none">
              <div className="num text-[34px] font-extrabold">{sc.total}</div>
              <div className="mt-1 text-[11px] text-muted">{t('fin.score')}</div>
            </div>
          </Ring>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ color: ok ? COLORS.oxygen : COLORS.critical }}>
              {ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {ok ? t('fin.success') : t('fin.fail')}
            </div>
            <h1 className="font-display mt-1 text-[30px] font-extrabold">{t('brand.title')} · {t('brand.sub')}</h1>
            {game.failed && <p className="mt-1 text-[14px] text-[#f8b2a2]">{t(game.failed)}</p>}
            <div className="mt-3 flex gap-1" dir="ltr" aria-label={`${sc.stars} / 5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.span key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.3 + i * 0.12, type: 'spring' }}>
                  <Star size={30} fill={i < sc.stars ? '#F2B84B' : 'transparent'} color={i < sc.stars ? '#F2B84B' : 'rgba(247,245,241,.25)'} />
                </motion.span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-5">
          {tiles.map(([l, v, col]) => (
            <div key={l} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
              <div className="text-[11.5px] text-muted">{l}</div>
              <div className="num mt-0.5 text-[15px] font-semibold" style={{ color: col }}>
                {v}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-ink/85">{t('fin.yourChoices')}</h3>
            <ul className="space-y-1.5">
              {game.decisions.map((d) => (
                <li key={d.eventId} className="rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">
                      {t('common.day')} {d.day} · {t(`ev.${d.eventId}.title`)}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold" style={{ color: d.quality === 2 ? COLORS.oxygen : d.quality === 1 ? COLORS.warning : COLORS.critical }}>
                      {t(d.quality === 2 ? 'fin.excellent' : d.quality === 1 ? 'fin.acceptable' : 'fin.poor')}
                    </span>
                  </div>
                  <div className="mt-0.5 font-semibold">{t(`ev.${d.eventId}.${d.optionId}.label`)}</div>
                  <div className="text-ink/70">{t(`ev.${d.eventId}.${d.optionId}.why`)}</div>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-ink/85">{t('fin.lessons')}</h3>
            <ul className="space-y-1.5">
              {lessons.map((l) => (
                <li key={l} className="flex gap-2 rounded-xl bg-o2/[0.07] px-3 py-2.5 text-[13px] text-ink/85">
                  <Star size={14} className="mt-0.5 shrink-0 text-warm" />
                  {t(`fin.lesson.${l}`)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-7 flex flex-wrap justify-end gap-2">
          <button className="btn btn-ghost h-12 px-6 text-[15px]" onClick={toWelcome}>
            <Home size={17} />
            {t('nav.station')}
          </button>
          <button className="btn btn-primary h-12 px-8 text-[15px]" onClick={startNew}>
            <RotateCcw size={17} />
            {t('fin.replay')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
