import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Lock, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BALANCE } from '../../config/science';
import { useT } from '../../i18n';
import { EVENTS, OBJECTIVES, has } from '../../sim/missions';
import { computeRates, percentages } from '../../sim/rates';
import type { GameState } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Bar, COLORS, Slider, Toggle } from '../ui/primitives';

export function ModalFrame({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const { t } = useT();
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-[#020a14]/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className={`glass-strong scroll-thin max-h-[92dvh] w-full overflow-y-auto rounded-[24px] p-4 sm:p-6 ${wide ? 'max-w-[980px]' : 'max-w-[560px]'}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[21px] font-bold">{title}</h2>
          <button className="btn btn-ghost h-9 w-9 rounded-xl" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function StatusModal({ game }: { game: GameState }) {
  const { t, num } = useT();
  const setModal = useGame((g) => g.setModal);
  const p = percentages(game);
  const r = computeRates(game, { spe: has(game, 'spe') });
  const rows: [string, string, number, string][] = [
    [t('res.oxygen'), `${num(game.res.oxygenKg, 2)} kg`, p.oxygen, COLORS.oxygen],
    [t('res.water'), `${num(game.res.waterL, 1)} L (+${num(game.res.reserveWaterL, 1)})`, p.water, COLORS.water],
    [t('res.energy'), `${num(game.res.batteryKWh, 2)} kWh`, p.energy, COLORS.energy],
    [t('res.food'), `${num(game.res.foodDays, 1)}`, p.food, COLORS.food],
    [t('res.health'), `${Math.round(game.crew.health)}%`, game.crew.health, game.crew.health < 50 ? COLORS.critical : COLORS.oxygen],
    [t('res.co2'), `${num(game.crew.co2, 2)} mmHg`, (game.crew.co2 / 5) * 100, game.crew.co2 > 3 ? COLORS.critical : COLORS.oxygen],
    [t('res.radiation'), `${num(game.crew.radiation, 1)} / ${BALANCE.radiationLimit}`, (game.crew.radiation / BALANCE.radiationLimit) * 100, COLORS.energy],
    [t('res.battery'), `${num(r.netKWh, 2)} kWh${t('common.perDay')}`, p.energy, r.netKWh < 0 ? COLORS.warning : COLORS.energy],
    [t('res.comms'), game.sys.relayOnline ? t('common.online') : t('common.offline'), game.sys.relayOnline ? 100 : 0, game.sys.relayOnline ? COLORS.oxygen : COLORS.critical],
    [t('res.parts'), `${game.res.spareParts}`, (game.res.spareParts / 3) * 100, COLORS.muted],
  ];
  return (
    <ModalFrame title={t('status.title')} onClose={() => setModal(null)}>
      <div className="space-y-3">
        {rows.map(([l, v, pc, c]) => (
          <div key={l}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="text-ink/80">{l}</span>
              <span className="num font-semibold" style={{ color: c }}>
                {v}
              </span>
            </div>
            <Bar value={pc} color={c} h={6} />
          </div>
        ))}
      </div>
    </ModalFrame>
  );
}

export function TimelineModal({ game }: { game: GameState }) {
  const { t, tm } = useT();
  const setModal = useGame((g) => g.setModal);
  const [tab, setTab] = useState<'days' | 'log'>('days');
  return (
    <ModalFrame title={t('day.timeline')} onClose={() => setModal(null)} wide>
      <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.05] p-1">
        {(['days', 'log'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium ${tab === k ? 'bg-o2/20 text-[#9ff0e5]' : 'text-ink/70'}`}>
            {k === 'days' ? t('day.timeline') : t('timeline.log')}
          </button>
        ))}
      </div>
      {tab === 'days' ? (
        <ol className="relative space-y-3 ps-6">
          <span className="absolute bottom-2 start-[9px] top-2 w-px bg-white/15" />
          {Array.from({ length: 7 }).map((_, i) => {
            const d = i + 1;
            const state = d < game.day || (d === game.day && game.phase !== 'playing') ? 'done' : d === game.day ? 'today' : 'locked';
            const rep = game.reports.find((r) => r.day === d);
            const decs = game.decisions.filter((x) => x.day === d);
            return (
              <li key={d} className="relative">
                <span className={`absolute -start-6 top-1 grid h-[19px] w-[19px] place-items-center rounded-full ${state === 'done' ? 'bg-o2 text-space' : state === 'today' ? 'bg-warm text-space' : 'bg-white/15 text-ink/60'}`}>
                  {state === 'done' ? <CheckCircle2 size={13} /> : state === 'today' ? <Circle size={9} fill="currentColor" /> : <Lock size={10} />}
                </span>
                <div className={`rounded-2xl p-4 ${state === 'today' ? 'bg-warm/10 ring-1 ring-warm/30' : 'bg-white/[0.04]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[14.5px] font-semibold">
                      {t('common.day')} {d} · {t(`day.${d}`)}
                    </div>
                    <span className="text-[11.5px] text-muted">{t(`timeline.${state}`)}</span>
                  </div>
                  {state !== 'locked' && (
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {(OBJECTIVES[d] ?? []).map((o) => {
                        const ok = rep ? rep.objectivesDone.includes(o.id) : o.done(game);
                        return (
                          <li key={o.id} className="flex items-start gap-1.5 text-[12px]">
                            {ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-o2" /> : <Circle size={13} className="mt-0.5 shrink-0 text-white/30" />}
                            <span className={ok ? 'text-ink/60' : 'text-ink/85'}>{t(o.id)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {decs.map((x) => (
                    <div key={x.eventId} className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-[12px]">
                      <span className="text-muted">{t(`ev.${x.eventId}.title`)}: </span>
                      <b className="text-ink">{t(`ev.${x.eventId}.${x.optionId}.label`)}</b>
                      <div className="mt-0.5 text-ink/70">{t(`ev.${x.eventId}.${x.optionId}.outcome`)}</div>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <ul className="space-y-1.5">
          {game.log.length === 0 && <li className="text-[13px] text-muted">{t('timeline.none')}</li>}
          {[...game.log].reverse().map((l, i) => (
            <li key={i} className="flex gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-[12.5px]">
              <span className="num shrink-0 text-muted">D{l.day}</span>
              <span className="h-2 w-2 shrink-0 translate-y-1.5 rounded-full" style={{ background: l.tone === 'good' ? COLORS.oxygen : l.tone === 'bad' ? COLORS.critical : l.tone === 'warn' ? COLORS.warning : COLORS.water }} />
              <span className="text-ink/85">{tm(l.msg)}</span>
            </li>
          ))}
        </ul>
      )}
    </ModalFrame>
  );
}

export function SettingsModal() {
  const { t } = useT();
  const s = useGame();
  const [confirm, setConfirm] = useState(false);
  return (
    <ModalFrame title={t('settings.title')} onClose={() => s.setModal(null)}>
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[13px] text-ink/85">{t('settings.language')}</div>
          <div className="flex gap-2">
            {(['ar', 'en'] as const).map((l) => (
              <button key={l} onClick={() => s.setLang(l)} className={`btn h-10 flex-1 ${s.lang === l ? 'btn-teal' : 'btn-ghost'}`}>
                {l === 'ar' ? 'العربية' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <Slider label={t('settings.sound')} value={Math.round(s.sound * 100)} min={0} max={100} onChange={(v) => s.setPrefs({ sound: v / 100 })} format={(v) => `${v}%`} />
        <Slider label={t('settings.music')} value={Math.round(s.music * 100)} min={0} max={100} onChange={(v) => s.setPrefs({ music: v / 100 })} format={(v) => `${v}%`} />
        <Toggle label={t('settings.motion')} checked={s.reduceMotion} onChange={() => s.setPrefs({ reduceMotion: !s.reduceMotion })} />
        {s.game && (
          <div className="border-t border-white/10 pt-4">
            {!confirm ? (
              <button className="btn btn-ghost h-10 w-full text-food" onClick={() => setConfirm(true)}>
                {t('settings.restart')}
              </button>
            ) : (
              <div className="rounded-xl bg-food/10 p-3 text-[13px]">
                {t('settings.restartConfirm')}
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-primary h-9 flex-1" onClick={s.startNew}>
                    {t('settings.restart')}
                  </button>
                  <button className="btn btn-ghost h-9 flex-1" onClick={() => setConfirm(false)}>
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalFrame>
  );
}

export function HowToModal() {
  const { t } = useT();
  const setModal = useGame((g) => g.setModal);
  return (
    <ModalFrame title={t('how.title')} onClose={() => setModal(null)}>
      <ol className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-white/[0.04] p-3 text-[13.5px] leading-relaxed">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-o2/15 text-[13px] font-bold text-o2">{i}</span>
            <span className="text-ink/85">{t(`how.${i}`)}</span>
          </li>
        ))}
      </ol>
    </ModalFrame>
  );
}

export const eventTitle = (id: string) => (EVENTS[id] ? `ev.${id}.title` : id);
