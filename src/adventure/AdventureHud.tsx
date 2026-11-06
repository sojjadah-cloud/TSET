import { AnimatePresence, motion } from 'framer-motion';
import { Award, CheckCircle2, ChevronDown, Circle, Gamepad2, Lightbulb, Sparkles, Star, Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { EVENTS } from '../sim/missions';
import type { GameState, Risk } from '../sim/types';
import { MINIGAME, stepsFor, type Ctx } from './steps';

/* ------------------------------------------------------------------ */
/* Luna – the mission assistant robot                                   */
/* ------------------------------------------------------------------ */
export interface Say {
  key: string;
  params?: Record<string, string | number>;
  tone?: 'info' | 'good' | 'warn';
  id: number;
}

export function Assistant({ say, onHint, compact = false }: { say: Say | null; onHint: () => void; compact?: boolean }) {
  const { t } = useT();
  // On small screens the bubble tucks away after a while; tap Luna to hear it again.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(true);
    if (!compact) return;
    const timer = setTimeout(() => setOpen(false), 9000);
    return () => clearTimeout(timer);
  }, [say?.id, compact]);
  return (
    <div className={`pointer-events-auto flex gap-3 ${compact ? 'items-start' : 'items-end'}`}>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('adv.luna')}
        aria-expanded={open}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="relative shrink-0"
      >
        <svg width={compact ? 46 : 62} height={compact ? 46 : 62} viewBox="0 0 62 62" aria-hidden>
          <ellipse cx="31" cy="58" rx="14" ry="3" fill="#000" opacity=".3" />
          <circle cx="31" cy="28" r="22" fill="#f1efec" />
          <circle cx="31" cy="28" r="22" fill="none" stroke="#40C7B6" strokeWidth="2" opacity=".6" />
          <rect x="15" y="19" width="32" height="18" rx="9" fill="#0b1f33" />
          <motion.g animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }} style={{ originY: '28px' }}>
            <circle cx="24" cy="28" r="3.2" fill="#40C7B6" />
            <circle cx="38" cy="28" r="3.2" fill="#40C7B6" />
          </motion.g>
          <line x1="31" y1="6" x2="31" y2="1" stroke="#9aa1a8" strokeWidth="2" />
          <circle cx="31" cy="1.5" r="2.5" fill="#F3BE78" />
        </svg>
      </motion.button>
      <AnimatePresence mode="wait">
        {say && open && (
          <motion.div
            key={say.id}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            className={`glass-strong relative rounded-2xl ${compact ? 'max-w-[min(320px,calc(100vw-90px))] rounded-ss-sm px-3 py-2' : 'mb-3 max-w-[min(420px,calc(100vw-200px))] rounded-es-sm px-4 py-3'} ${say.tone === 'good' ? 'ring-1 ring-o2/50' : say.tone === 'warn' ? 'ring-1 ring-energy/50' : ''}`}
          >
            <div className="mb-0.5 text-[11.5px] font-bold tracking-wide text-o2">{t('adv.luna')}</div>
            <p className={`leading-snug text-ink ${compact ? 'text-[13px]' : 'text-[14.5px]'}`}>{t(say.key, say.params)}</p>
            <button onClick={onHint} className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-warm hover:underline">
              <Lightbulb size={13} />
              {t('adv.hintBtn')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function ObjectiveTracker({ ctx, compact = false }: { ctx: Ctx; compact?: boolean }) {
  const { t } = useT();
  const steps = stepsFor(ctx);
  const firstOpen = steps.findIndex((s) => !s.done(ctx));
  const [open, setOpen] = useState(!compact);
  if (compact && !open) {
    const cur = steps[firstOpen];
    const done = steps.filter((s) => s.done(ctx)).length;
    return (
      <button onClick={() => setOpen(true)} className="glass flex max-w-[44vw] items-center gap-2 rounded-2xl px-3 py-2 text-start" aria-expanded={false}>
        <span className="num shrink-0 rounded-md bg-o2/15 px-1.5 text-[11px] font-bold text-o2">
          {done}/{steps.length}
        </span>
        <span className="truncate text-[12.5px] font-semibold">{cur ? t(`adv.step.${cur.id}`) : t(`adv.title.${ctx.game.day}`)}</span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>
    );
  }
  return (
    <div className={`glass rounded-[20px] ${compact ? 'w-[min(290px,60vw)] p-3' : 'w-[290px] p-4'}`} onClick={() => compact && setOpen(false)}>
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-warm">
        {t('common.day')} {ctx.game.day} · {t(`day.${ctx.game.day}`)}
      </div>
      <h2 className="font-display mt-1 text-[18px] font-bold leading-tight">{t(`adv.title.${ctx.game.day}`)}</h2>
      <ul className="mt-3 space-y-2">
        {steps.map((s, i) => {
          const ok = s.done(ctx);
          const active = i === firstOpen;
          const cnt = s.count?.(ctx);
          return (
            <motion.li key={s.id} layout className={`flex items-start gap-2 text-[13.5px] ${active ? 'text-ink' : ok ? 'text-ink/45' : 'text-ink/60'}`}>
              {ok ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-o2" />
                </motion.span>
              ) : (
                <Circle size={17} className={`mt-0.5 shrink-0 ${active ? 'text-warm' : 'text-white/25'}`} />
              )}
              <span className={ok ? 'line-through' : active ? 'font-semibold' : ''}>
                {t(`adv.step.${s.id}`)}
                {cnt && <span className="num ms-1 text-o2">({cnt[0]}/{cnt[1]})</span>}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
const RISK: Record<Risk, string> = { low: '#40C7B6', medium: '#F2B84B', high: '#F37B62' };

export function ChoiceCard({ game, eventId, onPick, onClose }: { game: GameState; eventId: string; onPick: (opt: string) => void; onClose: () => void }) {
  const { t } = useT();
  const ev = EVENTS[eventId];
  if (!ev) return null;
  return (
    <motion.div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-6" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}>
      <div className="glass-strong scroll-thin max-h-[88dvh] w-full max-w-[920px] overflow-y-auto rounded-[26px] p-4 sm:p-5" role="dialog" aria-modal="true" aria-label={t(`ev.${eventId}.title`)}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="font-display text-[20px] font-bold leading-tight">{t(`ev.${eventId}.title`)}</h2>
            <p className="mt-1 text-[14px] text-ink/75">{t(`adv.ask.${eventId}`)}</p>
          </div>
          <button className="btn btn-ghost h-9 w-9 rounded-xl" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ev.options.map((o, i) => {
            const blocked = o.blocked?.(game) ?? null;
            const game_ = MINIGAME[`${eventId}:${o.id}`];
            return (
              <motion.button
                key={o.id}
                whileHover={blocked ? undefined : { y: -3 }}
                whileTap={blocked ? undefined : { scale: 0.98 }}
                disabled={!!blocked}
                onClick={() => onPick(o.id)}
                className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-start transition hover:border-o2/60 hover:bg-o2/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-[13px] font-bold">{String.fromCharCode(65 + i)}</span>
                  {game_ && (
                    <span className="flex items-center gap-1 rounded-full bg-o2/15 px-2 py-0.5 text-[11px] font-semibold text-o2">
                      <Gamepad2 size={12} />
                      {t('adv.minigame')}
                    </span>
                  )}
                  <span className="ms-auto h-2.5 w-2.5 rounded-full" style={{ background: RISK[o.risk] }} title={`${t('dec.risk')}: ${t(`risk.${o.risk}`)}`} />
                </div>
                <div className="mt-2.5 text-[16px] font-semibold leading-snug">{t(`ev.${eventId}.${o.id}.label`)}</div>
                <div className="mt-1.5 text-[12.5px] leading-snug text-o2/90">+ {t(`ev.${eventId}.${o.id}.benefit`)}</div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-[#f8b2a2]">− {t(`ev.${eventId}.${o.id}.cost`)}</div>
                {blocked && <div className="mt-2 text-[12px] font-semibold text-food">{t(blocked)}</div>}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
export interface CelebrationData {
  titleKey: string;
  factKey: string;
  badge?: string;
  changes: { key: string; from: string; to: string; good: boolean }[];
}

const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 37) % 100,
  d: (i % 7) * 0.08,
  c: ['#40C7B6', '#F2B84B', '#F37B62', '#30B8E5', '#F7F5F1'][i % 5],
  r: (i * 53) % 360,
}));

export function Celebration({ data, onClose }: { data: CelebrationData; onClose: () => void }) {
  const { t } = useT();
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center overflow-hidden bg-[#020a14]/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {CONFETTI.map((c, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-3 w-2 rounded-sm"
          style={{ left: `${c.x}%`, background: c.c }}
          initial={{ y: -40, rotate: c.r, opacity: 1 }}
          animate={{ y: '105vh', rotate: c.r + 540, opacity: [1, 1, 0] }}
          transition={{ duration: 2.6, delay: c.d, ease: 'easeIn' }}
        />
      ))}
      <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 16 }} className="glass-strong scroll-thin relative max-h-[94dvh] w-full max-w-[520px] overflow-y-auto rounded-[28px] p-5 text-center sm:p-7" role="dialog" aria-modal="true">
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-warm to-food shadow-[0_0_40px_rgba(243,190,120,.5)]">
          {data.badge ? <Award size={40} className="text-space" /> : <Star size={40} className="text-space" fill="currentColor" />}
        </motion.div>
        <h2 className="font-display mt-4 text-[26px] font-extrabold">{t(data.titleKey)}</h2>
        {data.badge && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warm/15 px-3 py-1 text-[13px] font-semibold text-warm">
            <Sparkles size={14} />
            {t('adv.badgeEarned')}: {t(`badge.${data.badge}`)}
          </div>
        )}
        {data.changes.length > 0 && (
          <div className="mt-4 grid gap-2">
            {data.changes.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-xl bg-white/[0.05] px-3 py-2 text-[13.5px]">
                <span className="text-ink/80">{t(c.key)}</span>
                <span className="num font-semibold" style={{ color: c.good ? '#40C7B6' : '#F37B62' }}>
                  {c.from} → {c.to}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-2 rounded-2xl bg-o2/[0.08] p-3 text-start text-[13.5px] leading-snug text-ink/85">
          <Lightbulb size={17} className="mt-0.5 shrink-0 text-warm" />
          {t(data.factKey)}
        </div>
        <button className="btn btn-primary mt-5 h-12 w-full text-[16px]" onClick={onClose} autoFocus>
          {t('common.continue')}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
export function ControlsHint({ surface }: { surface: boolean }) {
  const { t } = useT();
  const K = ({ k }: { k: string }) => (
    <kbd className="inline-grid min-w-6 place-items-center rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[11px] font-bold" dir="ltr">
      {k}
    </kbd>
  );
  return (
    <div className="glass flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-[11.5px] text-ink/75">
      <span className="flex items-center gap-1">
        <K k="W" />
        <K k="A" />
        <K k="S" />
        <K k="D" /> {t('adv.k.move')}
      </span>
      <span className="flex items-center gap-1">
        <K k="⇧" /> {t('adv.k.run')}
      </span>
      <span className="flex items-center gap-1">
        <K k="␣" /> {t('adv.k.jump')}
      </span>
      <span className="flex items-center gap-1">
        <K k="E" /> {t('adv.k.use')}
      </span>
      <span className="text-muted">· {t(surface ? 'adv.k.surface' : 'adv.k.inside')}</span>
    </div>
  );
}

export function RepairBadge() {
  return <Wrench size={14} />;
}
