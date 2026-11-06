import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { BookOpen, FlaskConical, Info } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useT } from '../../i18n';

export const COLORS = {
  oxygen: '#40C7B6',
  water: '#30B8E5',
  energy: '#F2B84B',
  food: '#F37B62',
  ok: '#40C7B6',
  warning: '#F2B84B',
  critical: '#F37B62',
  muted: '#9fb0c2',
};

/** Number that animates smoothly to its new value. */
export function AnimatedNumber({ value, digits = 0, suffix = '' }: { value: number; digits?: number; suffix?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => v.toFixed(digits) + suffix);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: 'easeOut' });
    return c.stop;
  }, [value, mv]);
  return <motion.span className="num">{text}</motion.span>;
}

export function Ring({ value, color, size = 40, stroke = 4, children }: { value: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(247,245,241,.12)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(100, value)) / 100) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color, h = 8 }: { value: number; color: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/10" style={{ height: h }}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.8 }} />
    </div>
  );
}

export function Card({ title, icon, children, className = '', right }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-white/8 bg-white/[0.04] p-4 ${className}`}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-ink/85">
            {icon}
            {title}
          </h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, color, sub }: { label: string; value: ReactNode; unit?: string; color?: string; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1 text-[22px] font-semibold" style={{ color }}>
        {value}
        {unit && <span className="text-[12px] font-medium text-muted">{unit}</span>}
      </div>
      {sub && <div className="text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  color = COLORS.oxygen,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
  format?: (v: number) => string;
  hint?: ReactNode;
}) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="text-ink/85">{label}</span>
        <span className="num font-semibold" style={{ color }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--p' as string]: `${p}%`, ['--c' as string]: color }}
      />
      {hint && <div className="mt-1.5 text-[11.5px] text-muted">{hint}</div>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <div className="mb-2 text-[13px] text-ink/85">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-white/[0.06] p-1">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition ${value === o.id ? 'bg-o2/20 text-[#9ff0e5] shadow-[inset_0_0_0_1px_rgba(64,199,182,.45)]' : 'text-ink/70 hover:text-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, disabled, sub }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean; sub?: ReactNode }) {
  return (
    <button role="switch" aria-checked={checked} disabled={disabled} onClick={onChange} className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-start transition hover:bg-white/[0.07] disabled:opacity-45">
      <span>
        <span className="block text-[13px] text-ink/90">{label}</span>
        {sub && <span className="block text-[11.5px] text-muted">{sub}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-o2' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'start-[22px]' : 'start-0.5'}`} />
      </span>
    </button>
  );
}

/** Educational note, tagged as NASA reference or game assumption. */
export function Learn({ children, kind = 'learn' }: { children: ReactNode; kind?: 'learn' | 'nasa' | 'sim' }) {
  const { t } = useT();
  const meta = {
    learn: { icon: <BookOpen size={14} />, label: t('common.learn'), c: '#9ff0e5', bg: 'rgba(64,199,182,.08)' },
    nasa: { icon: <Info size={14} />, label: t('common.nasaRef'), c: '#8fd6f2', bg: 'rgba(48,184,229,.08)' },
    sim: { icon: <FlaskConical size={14} />, label: t('common.simAssumption'), c: '#f5cf86', bg: 'rgba(242,184,75,.08)' },
  }[kind];
  return (
    <div className="rounded-xl p-3 text-[12.5px] leading-relaxed text-ink/80" style={{ background: meta.bg }}>
      <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: meta.c }}>
        {meta.icon}
        {meta.label}
      </div>
      {children}
    </div>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <div dir="ltr" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-center font-mono text-[12.5px] text-[#cfe9f3]">
      {children}
    </div>
  );
}

export function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: `${color}22`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
