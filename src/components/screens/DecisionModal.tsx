import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, HelpCircle, Lightbulb, TrendingUp, Siren, Info } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../../i18n';
import { EVENTS } from '../../sim/missions';
import type { GameState, Risk } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { COLORS } from '../ui/primitives';

const RISK_COLOR: Record<Risk, string> = { low: COLORS.oxygen, medium: COLORS.warning, high: COLORS.critical };

export function DecisionModal({ game }: { game: GameState }) {
  const { t } = useT();
  const choose = useGame((g) => g.choose);
  const dismissOutcome = useGame((g) => g.dismissOutcome);
  const setModal = useGame((g) => g.setModal);
  const [sel, setSel] = useState<string | null>(null);
  const outcome = game.lastOutcome;
  const eventId = outcome?.eventId ?? game.activeEvents[0];
  const ev = eventId ? EVENTS[eventId] : null;
  if (!ev) return null;
  const SevIcon = ev.severity === 'critical' ? Siren : ev.severity === 'warning' ? AlertTriangle : Info;
  const sevColor = ev.severity === 'critical' ? COLORS.critical : ev.severity === 'warning' ? COLORS.warning : COLORS.oxygen;

  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-[#020a14]/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dec-title"
        initial={{ y: 24, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        className="glass-strong scroll-thin max-h-[94dvh] w-full max-w-[980px] overflow-y-auto rounded-[26px]"
      >
        <AnimatePresence mode="wait">
          {!outcome ? (
            <motion.div key="choose" exit={{ opacity: 0 }} className="p-6 lg:p-8">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${sevColor}22`, color: sevColor }}>
                  <SevIcon size={24} />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: sevColor }}>
                    {t('dec.title')} · {t('common.day')} {game.day} · {t(`sys.${ev.system}`)}
                  </div>
                  <h2 id="dec-title" className="font-display mt-1 text-[24px] font-bold leading-tight">
                    {t(`ev.${ev.id}.title`)}
                  </h2>
                  <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink/80">{t(`ev.${ev.id}.desc`)}</p>
                </div>
                <button className="btn btn-ghost h-9 px-3 text-[12.5px]" onClick={() => setModal(null)}>
                  {t('common.close')}
                </button>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {ev.options.map((o, i) => {
                  const blocked = o.blocked?.(game) ?? null;
                  const active = sel === o.id;
                  return (
                    <button
                      key={o.id}
                      disabled={!!blocked}
                      onClick={() => setSel(o.id)}
                      aria-pressed={active}
                      className={`group relative flex flex-col rounded-2xl border p-4 text-start transition ${active ? 'border-o2/70 bg-o2/10 shadow-[0_0_0_3px_rgba(64,199,182,.15)]' : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'} disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-[13px] font-bold">{String.fromCharCode(65 + i)}</span>
                        <span className="ms-auto rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${RISK_COLOR[o.risk]}22`, color: RISK_COLOR[o.risk] }}>
                          {t('dec.risk')}: {t(`risk.${o.risk}`)}
                        </span>
                      </div>
                      <div className="mt-3 text-[16px] font-semibold leading-snug">{t(`ev.${ev.id}.${o.id}.label`)}</div>
                      <div className="mt-3 space-y-2 text-[12.5px] leading-relaxed">
                        <div>
                          <div className="font-semibold text-o2">{t('dec.benefits')}</div>
                          <div className="text-ink/80">{t(`ev.${ev.id}.${o.id}.benefit`)}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-food">{t('dec.costs')}</div>
                          <div className="text-ink/80">{t(`ev.${ev.id}.${o.id}.cost`)}</div>
                        </div>
                      </div>
                      <div className="mt-auto pt-3">
                        <div className="mb-1 text-[11px] text-muted">{t('dec.affects')}</div>
                        <div className="flex flex-wrap gap-1">
                          {o.affects.map((a) => (
                            <span key={a} className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] text-ink/80">
                              {t(`res.${a}`)}
                            </span>
                          ))}
                        </div>
                      </div>
                      {blocked && <div className="mt-2 text-[12px] font-semibold text-food">{t(blocked)}</div>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[12.5px] text-muted">
                  <HelpCircle size={14} />
                  {t('dec.noFuture')}
                </span>
                <button className="btn btn-primary h-12 px-8 text-[15px]" disabled={!sel} onClick={() => sel && choose(ev.id, sel)}>
                  {t('common.confirm')}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="outcome" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 lg:p-8">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-o2" size={26} />
                <h2 className="font-display text-[22px] font-bold">{t(`ev.${outcome.eventId}.${outcome.optionId}.label`)}</h2>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {(
                  [
                    ['outcome', 'dec.outcome', CheckCircle2, COLORS.oxygen],
                    ['why', 'dec.why', Lightbulb, COLORS.energy],
                    ['impact', 'dec.impact', TrendingUp, COLORS.water],
                  ] as const
                ).map(([field, label, Icon, c]) => (
                  <motion.div key={field} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: field === 'outcome' ? 0.05 : field === 'why' ? 0.2 : 0.35 }} className="rounded-2xl bg-white/[0.04] p-4">
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: c }}>
                      <Icon size={16} />
                      {t(label)}
                    </div>
                    <p className="text-[14px] leading-relaxed text-ink/85">{t(`ev.${outcome.eventId}.${outcome.optionId}.${field}`)}</p>
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  className="btn btn-primary h-12 px-8 text-[15px]"
                  onClick={() => {
                    setSel(null);
                    dismissOutcome();
                  }}
                >
                  {t('common.continue')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
