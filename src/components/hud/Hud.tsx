import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Droplets,
  Home,
  Leaf,
  Radio,
  Settings,
  ShieldCheck,
  Sprout,
  Wind,
  Zap,
  CheckCircle2,
  Circle,
  MoonStar,
  Languages,
} from 'lucide-react';
import { useState } from 'react';
import { BALANCE } from '../../config/science';
import { useT } from '../../i18n';
import { has, MISSION_CARD, OBJECTIVES } from '../../sim/missions';
import { computeRates, percentages } from '../../sim/rates';
import { activeAlerts } from '../../sim/status';
import type { GameState, SystemId } from '../../sim/types';
import { useGame, type View } from '../../store/gameStore';
import { canEndDay } from '../../sim/engine';
import { useViewport } from '../../hooks/useViewport';
import { AnimatedNumber, COLORS, Ring } from '../ui/primitives';

/* ---------------------------------------------------------------- */
export function Logo() {
  const { t } = useT();
  const vp = useViewport();
  const tiny = vp.w < 520;
  return (
    <div className="flex items-center gap-3" dir="ltr">
      <svg width={vp.compact ? 34 : 42} height={vp.compact ? 34 : 42} viewBox="0 0 42 42" aria-hidden>
        <defs>
          <radialGradient id="lg" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#f2eee8" />
            <stop offset="1" stopColor="#7d7873" />
          </radialGradient>
        </defs>
        <circle cx="21" cy="21" r="10" fill="url(#lg)" />
        <circle cx="17.5" cy="18" r="2" fill="#000" opacity=".12" />
        <circle cx="24" cy="25" r="1.4" fill="#000" opacity=".12" />
        <ellipse cx="21" cy="21" rx="19" ry="7" fill="none" stroke="#40C7B6" strokeWidth="1.4" transform="rotate(-22 21 21)" />
        <circle cx="38" cy="14.5" r="2.2" fill="#F3BE78" />
      </svg>
      <div className={`leading-tight ${tiny ? 'hidden' : ''}`}>
        <div className={`font-display font-bold tracking-[0.18em] text-ink ${vp.compact ? 'text-[13px]' : 'text-[17px]'}`}>{t('brand.title')}</div>
        <div className="text-[13px] font-medium text-warm/90" dir="rtl" style={{ fontFamily: 'IBM Plex Sans Arabic, Tajawal, sans-serif' }}>
          المحطة القمرية
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
const RES = [
  { id: 'oxygen', icon: Wind, color: COLORS.oxygen },
  { id: 'water', icon: Droplets, color: COLORS.water },
  { id: 'energy', icon: Zap, color: COLORS.energy },
  { id: 'food', icon: Leaf, color: COLORS.food },
] as const;

export function ResourceBar({ game }: { game: GameState }) {
  const { t, num } = useT();
  const setModal = useGame((g) => g.setModal);
  const [tip, setTip] = useState<string | null>(null);
  const vp = useViewport();
  const small = vp.compact;
  const p = percentages(game);
  const r = computeRates(game, { spe: has(game, 'spe') });
  const c = BALANCE.capacity;
  const sign = (v: number) => (v >= 0 ? '+' : '') + num(v, 2);
  const tips: Record<string, string> = {
    oxygen: t('tip.oxygen', { kg: num(game.res.oxygenKg, 2), cap: c.oxygenKg, net: sign(r.o2NetKg) }),
    water: t('tip.water', { l: num(game.res.waterL, 1), cap: c.waterL, res: num(game.res.reserveWaterL, 1), net: sign(r.waterNetL) }),
    energy: t('tip.energy', { kwh: num(game.res.batteryKWh, 2), cap: c.batteryKWh, net: sign(r.netKWh) }),
    food: t('tip.food', { d: num(game.res.foodDays, 1), cap: c.foodDays }),
  };
  return (
    <div className={`glass relative flex items-center rounded-[20px] ${small ? 'gap-0 px-1 py-1' : 'gap-1 px-2 py-1.5'}`}>
      {RES.map(({ id, icon: Icon, color }) => {
        const v = p[id];
        const low = v < 25;
        return (
          <button
            key={id}
            onClick={() => setModal('status')}
            onMouseEnter={() => setTip(id)}
            onMouseLeave={() => setTip(null)}
            onFocus={() => setTip(id)}
            onBlur={() => setTip(null)}
            className={`relative flex items-center rounded-2xl transition hover:bg-white/[0.06] ${small ? 'gap-1.5 px-1.5 py-0.5' : 'gap-2.5 px-3 py-1'}`}
            aria-label={`${t(`res.${id}`)} ${Math.round(v)}%`}
          >
            <Ring value={v} color={low ? COLORS.critical : color} size={small ? 30 : 38} stroke={3.5}>
              <Icon size={small ? 12 : 15} color={low ? COLORS.critical : color} />
            </Ring>
            <div className="text-start leading-tight">
              {!small && <div className="text-[11.5px] text-muted">{t(`res.${id}`)}</div>}
              <div className={`font-semibold ${small ? 'text-[13px]' : 'text-[16px]'}`} style={{ color: low ? COLORS.critical : '#F7F5F1' }}>
                <AnimatedNumber value={v} suffix="%" />
              </div>
            </div>
            <AnimatePresence>
              {tip === id && !vp.touch && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="glass-strong pointer-events-none absolute start-0 top-[calc(100%+10px)] z-50 w-60 rounded-xl p-3 text-start text-[12px] leading-relaxed text-ink/85"
                >
                  <div className="mb-1 font-semibold" style={{ color }}>
                    {t(`res.${id}`)}
                  </div>
                  {tips[id]}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
export function DayBadge({ game }: { game: GameState }) {
  const { t } = useT();
  const setModal = useGame((g) => g.setModal);
  const vp = useViewport();
  return (
    <button onClick={() => setModal('timeline')} className={`glass flex items-center rounded-[18px] transition hover:bg-white/[0.08] ${vp.compact ? 'gap-2 px-2.5 py-1.5' : 'gap-3 px-4 py-2'}`} aria-label={t('day.timeline')}>
      <CalendarDays size={vp.compact ? 15 : 18} className="text-warm" />
      <div className="text-start leading-tight">
        <div className={`font-semibold ${vp.compact ? 'text-[13px]' : 'text-[15px]'}`}>{vp.compact ? <span className="num">{game.day}/{BALANCE.missionDays}</span> : t('day.label', { d: game.day, n: BALANCE.missionDays })}</div>
        <div className="mt-1 flex gap-1" dir="ltr">
          {Array.from({ length: BALANCE.missionDays }).map((_, i) => (
            <span key={i} className={`h-1 rounded-full ${vp.compact ? 'w-2' : 'w-4'}`} style={{ background: i + 1 < game.day ? '#40C7B6' : i + 1 === game.day ? '#F3BE78' : 'rgba(247,245,241,.15)' }} />
          ))}
        </div>
      </div>
    </button>
  );
}

export function TopRightTools() {
  const { t } = useT();
  const lang = useGame((g) => g.lang);
  const setLang = useGame((g) => g.setLang);
  const setModal = useGame((g) => g.setModal);
  const vp = useViewport();
  const h = vp.compact ? 'h-9' : 'h-11';
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className={`glass flex ${h} items-center gap-1.5 rounded-[14px] px-3 text-[13px] font-semibold transition hover:bg-white/[0.08]`} aria-label="Language">
        <Languages size={16} className="text-o2" />
        {vp.compact ? (lang === 'ar' ? 'EN' : 'ع') : t('lang.switch')}
      </button>
      <button onClick={() => setModal('settings')} className={`glass grid ${h} ${vp.compact ? 'w-9' : 'w-11'} place-items-center rounded-[14px] transition hover:bg-white/[0.08]`} aria-label={t('welcome.settings')}>
        <Settings size={17} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- */
const CARD_ICON: Record<SystemId | 'station', typeof Sprout> = {
  lifeSupport: Wind,
  greenhouse: Sprout,
  energy: Zap,
  comms: Radio,
  safety: ShieldCheck,
  station: MoonStar,
};

export function MissionCard({ game }: { game: GameState }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const setView = useGame((g) => g.setView);
  const setModal = useGame((g) => g.setModal);
  const finishDay = useGame((g) => g.finishDay);
  const objs = OBJECTIVES[game.day] ?? [];
  const done = objs.filter((o) => o.done(game)).length;
  const sys = MISSION_CARD[game.day];
  const Icon = CARD_ICON[sys];
  const pending = game.activeEvents.length > 0;
  const ended = canEndDay(game);
  const last = game.day === BALANCE.missionDays;

  const onContinue = () => {
    if (pending) return setModal('decision');
    const next = objs.find((o) => !o.done(game));
    if (!next) return finishDay();
    if (next.system === 'station') {
      if (next.id === 'o1_resources') return setModal('status');
      if (next.id === 'o7_review') return setModal('timeline');
      const sysNext = (['lifeSupport', 'greenhouse', 'energy', 'comms', 'safety'] as SystemId[]).find((x) => !has(game, `diag:${x}`));
      return setView(sysNext ?? 'lifeSupport');
    }
    setView(next.system as View);
  };

  return (
    <motion.div layout className="glass w-[318px] overflow-hidden rounded-[22px]">
      <div className="relative h-[92px] overflow-hidden bg-gradient-to-br from-navy2 to-navy">
        <MiniArt sys={sys} />
        <div className="absolute start-4 top-3 rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-warm">{t('card.today')}</div>
        <div className="absolute bottom-3 end-4 grid h-10 w-10 place-items-center rounded-xl bg-black/30 backdrop-blur">
          <Icon size={20} className="text-o2" />
        </div>
      </div>
      <div className="p-4">
        <div className="text-[11.5px] font-medium text-muted">
          {t('common.day')} {game.day} · {t(`day.${game.day}`)}
        </div>
        <h2 className="font-display mt-1 text-[19px] font-bold leading-snug">{t(`card.${game.day}.title`)}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75">{t(`card.${game.day}.desc`)}</p>

        <div className="mt-3.5">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="text-muted">{t('card.objectives', { done, all: objs.length })}</span>
            <span className="num font-semibold text-o2">{Math.round((done / Math.max(1, objs.length)) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-o2" initial={false} animate={{ width: `${(done / Math.max(1, objs.length)) * 100}%` }} />
          </div>
        </div>

        <button onClick={() => setOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between text-[12.5px] font-medium text-ink/80 hover:text-ink" aria-expanded={open}>
          {t('card.details')}
          <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {objs.map((o) => {
                const ok = o.done(game);
                return (
                  <li key={o.id} className="flex items-start gap-2 py-1 text-[12.5px]">
                    {ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-o2" /> : <Circle size={15} className="mt-0.5 shrink-0 text-white/30" />}
                    <span className={ok ? 'text-ink/55 line-through' : 'text-ink/85'}>{t(o.id)}</span>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        {pending && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-energy/12 px-3 py-2 text-[12px] font-medium text-energy">
            <AlertTriangle size={14} />
            {t('card.decisionWaiting')}
          </div>
        )}
        {!pending && done === objs.length && <div className="mt-3 rounded-xl bg-o2/12 px-3 py-2 text-[12px] font-medium text-o2">{t('card.allDone')}</div>}

        <div className="mt-3.5 flex gap-2">
          <button className="btn btn-primary h-11 flex-1 text-[14px]" onClick={onContinue}>
            {t('card.continue')}
          </button>
          <button className="btn btn-ghost h-11 px-3 text-[13px]" disabled={!ended} onClick={finishDay} title={ended ? '' : t('day.endHint')}>
            {last ? t('day.finish') : t('day.end')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MiniArt({ sys }: { sys: SystemId | 'station' }) {
  // Small decorative illustration that matches today's system.
  return (
    <svg viewBox="0 0 320 92" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="mg" cx="0.2" cy="1" r="1">
          <stop offset="0" stopColor="#F3BE78" stopOpacity=".45" />
          <stop offset="1" stopColor="#F3BE78" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="92" fill="url(#mg)" />
      {Array.from({ length: 24 }).map((_, i) => (
        <circle key={i} cx={(i * 53) % 320} cy={(i * 29) % 50} r={i % 5 ? 0.6 : 1.1} fill="#fff" opacity=".6" />
      ))}
      <path d="M0 74 C 80 64, 160 70, 320 62 L 320 92 L 0 92 Z" fill="#9a948f" />
      {sys === 'greenhouse' && (
        <g transform="translate(150 74)">
          <path d="M-60 0 C -60 -46, 60 -46, 60 0 Z" fill="#7fd3c8" fillOpacity=".25" stroke="#d9f3f5" strokeOpacity=".6" />
          {[-40, -20, 0, 20, 40].map((x) => (
            <path key={x} d={`M${x} 0 c -6 -8 -4 -14 0 -11 c 4 -3 6 3 0 11z`} fill="#5fbf6a" />
          ))}
          <rect x={-40} y={-34} width={80} height={3} rx={1.5} fill="#e58bf0" />
        </g>
      )}
      {sys === 'lifeSupport' && (
        <g transform="translate(150 74)">
          <path d="M-58 0 C -58 -52, 58 -52, 58 0 Z" fill="#cfcac4" />
          {[-30, -10, 10, 30].map((x) => (
            <rect key={x} x={x - 6} y={-14} width={12} height={7} rx={3} fill="#F3BE78" />
          ))}
          <rect x={64} y={-34} width={12} height={34} rx={6} fill="#bfc4c9" />
          <rect x={64} y={-24} width={12} height={3} fill="#40C7B6" />
        </g>
      )}
      {sys === 'energy' && (
        <g transform="translate(150 70)">
          {[-80, -20, 40].map((x) => (
            <g key={x} transform={`translate(${x} -20) skewX(-18)`}>
              <rect width={54} height={22} rx={2} fill="#1d3a66" stroke="#8c96a3" />
              <line x1={18} x2={18} y2={22} stroke="#7d93b3" strokeOpacity=".5" />
              <line x1={36} x2={36} y2={22} stroke="#7d93b3" strokeOpacity=".5" />
            </g>
          ))}
        </g>
      )}
      {sys === 'comms' && (
        <g transform="translate(160 70)">
          <path d="M-8 0 L 0 -44 L 8 0" stroke="#cfd3d6" strokeWidth="2" fill="none" />
          <path d="M-22 -44 Q 0 -26 22 -44 Z" fill="#cfd3d6" transform="rotate(-25 0 -44)" />
          <path d="M20 -58 q 10 -10 24 -10" stroke="#40C7B6" strokeWidth="2" fill="none" />
          <path d="M28 -66 q 12 -12 28 -12" stroke="#40C7B6" strokeWidth="2" fill="none" opacity=".6" />
          <g transform="translate(110 -64)">
            <rect x={-14} y={-3} width={10} height={6} fill="#2a4a78" />
            <rect x={4} y={-3} width={10} height={6} fill="#2a4a78" />
            <rect x={-4} y={-4} width={8} height={8} fill="#d9d4cc" />
          </g>
        </g>
      )}
      {sys === 'safety' && (
        <g transform="translate(150 76)">
          <path d="M-70 0 C -64 -40, 64 -40, 70 0 Z" fill="#9b938c" />
          <path d="M-16 0 L -16 -20 Q 0 -32 16 -20 L 16 0 Z" fill="#F3BE78" />
          <circle cx={110} cy={-60} r={14} fill="#ffcf7a" opacity=".85" />
          <circle cx={110} cy={-60} r={26} fill="#ffcf7a" opacity=".18" />
        </g>
      )}
      {sys === 'station' && (
        <g transform="translate(150 74)">
          <path d="M-46 0 C -46 -42, 46 -42, 46 0 Z" fill="#cfcac4" />
          <path d="M-110 0 C -110 -28, -60 -28, -60 0 Z" fill="#7fd3c8" fillOpacity=".3" stroke="#d9f3f5" strokeOpacity=".5" />
          <path d="M60 0 C 64 -24, 108 -24, 112 0 Z" fill="#9b938c" />
          {[-20, 0, 20].map((x) => (
            <rect key={x} x={x - 5} y={-12} width={10} height={6} rx={3} fill="#F3BE78" />
          ))}
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------- */
const NAV: { id: View; key: string; icon: typeof Home }[] = [
  { id: 'station', key: 'nav.station', icon: Home },
  { id: 'greenhouse', key: 'nav.agriculture', icon: Sprout },
  { id: 'energy', key: 'nav.energy', icon: Zap },
  { id: 'comms', key: 'nav.communications', icon: Radio },
  { id: 'safety', key: 'nav.safety', icon: ShieldCheck },
];

export function BottomNav({ view }: { view: View }) {
  const { t } = useT();
  const setView = useGame((g) => g.setView);
  const vp = useViewport();
  return (
    <nav className="flex w-full max-w-[620px] items-center gap-1 rounded-[22px] border border-white/10 bg-[#0c1f33]/90 p-1.5 shadow-[0_20px_40px_-16px_rgba(0,0,0,.8)] backdrop-blur-xl" aria-label="Main">
      {NAV.map(({ id, key, icon: Icon }) => {
        const active = view === id || (id === 'station' && view === 'lifeSupport');
        return (
          <button
            key={id}
            onClick={() => setView(id === 'station' && view === 'station' ? 'station' : id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 font-medium transition ${vp.compact ? 'min-w-0 px-1 text-[10.5px]' : 'min-w-[104px] px-4 text-[12.5px]'} ${active ? 'text-[#9ff0e5]' : 'text-ink/65 hover:bg-white/[0.05] hover:text-ink'}`}
          >
            {active && <motion.span layoutId="navActive" className="absolute inset-0 rounded-2xl bg-o2/14 shadow-[inset_0_0_0_1px_rgba(64,199,182,.35)]" />}
            <Icon size={19} strokeWidth={1.7} className="relative" />
            <span className="relative">{t(key)}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------------------------------------------------------- */
export function Alerts({ game }: { game: GameState }) {
  const { t } = useT();
  const setView = useGame((g) => g.setView);
  const alerts = activeAlerts(game).slice(0, 4);
  return (
    <div className="flex w-[270px] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {alerts.map((a) => (
          <motion.button
            key={a.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onClick={() => setView(a.system)}
            className="glass flex items-center gap-2.5 rounded-2xl px-3 py-2 text-start text-[12.5px] font-medium transition hover:bg-white/[0.08]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: a.level === 'critical' ? 'rgba(243,123,98,.18)' : 'rgba(242,184,75,.16)' }}>
              <AlertTriangle size={14} color={a.level === 'critical' ? COLORS.critical : COLORS.warning} />
            </span>
            <span className="text-ink/90">{t(a.key, a.params)}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
