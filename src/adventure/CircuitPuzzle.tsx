import { motion } from 'framer-motion';
import { Lightbulb, X, Zap } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { SIM_ASSUMPTIONS } from '../config/science';
import { useT } from '../i18n';

/* Each panel string has a colour AND a shape, so colour-blind players can match too. */
const STRINGS = [
  { id: 0, color: '#40C7B6', shape: 'circle' },
  { id: 1, color: '#F2B84B', shape: 'triangle' },
  { id: 2, color: '#F37B62', shape: 'square' },
  { id: 3, color: '#9d8cff', shape: 'star' },
] as const;
type Shape = (typeof STRINGS)[number]['shape'];

const W = 680;
const H = 400;
const PLUG_Y = 150;
const SOCK_Y = 300;
const plugX = (i: number) => 115 + i * 150;
const sockX = (i: number) => 130 + i * 140;

function Glyph({ shape, color, r = 11 }: { shape: Shape; color: string; r?: number }) {
  if (shape === 'circle') return <circle r={r} fill={color} />;
  if (shape === 'square') return <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={3} fill={color} />;
  if (shape === 'triangle') return <path d={`M0 ${-r * 1.1} L ${r} ${r * 0.8} L ${-r} ${r * 0.8} Z`} fill={color} />;
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.5 : r * 1.15;
    return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  return <polygon points={pts} fill={color} />;
}

export function CircuitPuzzle({ seed, onSolved, onClose }: { seed: number; onSolved: () => void; onClose: () => void }) {
  const { t, num } = useT();
  // Socket order is shuffled so the match is never straight down.
  const order = useMemo(() => {
    const perms = [
      [2, 0, 3, 1],
      [1, 3, 0, 2],
      [3, 2, 1, 0],
      [2, 3, 0, 1],
    ];
    return perms[seed % perms.length];
  }, [seed]);
  const [links, setLinks] = useState<Record<number, number>>({}); // string id → socket slot
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [msg, setMsg] = useState<'how' | 'wrong' | 'done'>('how');
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const connected = Object.keys(links).length;
  const done = connected === STRINGS.length;
  // Each string supplies a quarter of the array's average output.
  const kw = (SIM_ASSUMPTIONS.solarAvgKW * connected) / STRINGS.length;

  const pickPlug = (id: number) => {
    if (done || links[id] !== undefined) return;
    sfx.play('click');
    setPicked(id);
  };
  const pickSocket = (slot: number) => {
    if (done || picked === null || Object.values(links).includes(slot)) return;
    if (order[slot] === picked) {
      const next = { ...links, [picked]: slot };
      setLinks(next);
      setPicked(null);
      setMsg('how');
      if (Object.keys(next).length === STRINGS.length) {
        sfx.play('success');
        setMsg('done');
        setTimeout(onSolved, 1500);
      } else sfx.play('confirm');
    } else {
      sfx.play('deny');
      setWrong(slot);
      setMsg('wrong');
      setTimeout(() => setWrong(null), 500);
    }
  };
  const giveHint = () => {
    const id = STRINGS.find((s) => links[s.id] === undefined)?.id;
    if (id === undefined) return;
    sfx.play('click');
    setPicked(id);
    setHint(id);
    setTimeout(() => setHint(null), 1600);
  };
  const onMove = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || picked === null) return;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const v = p.matrixTransform(ctm.inverse());
    setMouse({ x: v.x, y: v.y });
  };
  const wire = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1} C ${x1} ${(y1 + y2) / 2 + 30}, ${x2} ${(y1 + y2) / 2 - 30}, ${x2} ${y2}`;
  const keyAct = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-[#020a14]/70 p-2 backdrop-blur-sm sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-modal="true" aria-label={t('mg.circuit.title')} initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} className="glass-strong scroll-thin max-h-[96dvh] w-full max-w-[760px] overflow-y-auto rounded-[28px] p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-energy/15 text-energy">
            <Zap size={22} />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[22px] font-bold">{t('mg.circuit.title')}</h2>
            <p className="mt-0.5 text-[14px] text-ink/80">{t('mg.circuit.goal')}</p>
          </div>
          <button className="btn btn-ghost h-9 w-9 rounded-xl" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </div>

        <div className="mt-4" dir="ltr">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" onPointerMove={onMove} onPointerLeave={() => setMouse(null)}>
            <defs>
              <linearGradient id="cpCell" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#3a5f8d" />
                <stop offset="1" stopColor="#0b1a33" />
              </linearGradient>
            </defs>
            {/* Solar panels (top) */}
            {STRINGS.map((s) => {
              const on = links[s.id] !== undefined;
              const x = plugX(s.id);
              return (
                <g key={s.id}>
                  <g transform={`translate(${x - 55} 30) skewX(-12)`}>
                    <rect width={110} height={60} rx={4} fill="url(#cpCell)" stroke={on ? s.color : '#8c96a3'} strokeWidth={on ? 3 : 1.5} />
                    {[1, 2, 3].map((k) => (
                      <line key={k} x1={(110 / 4) * k} x2={(110 / 4) * k} y1={0} y2={60} stroke="#7d93b3" strokeOpacity={0.35} />
                    ))}
                    <line x1={0} x2={110} y1={30} y2={30} stroke="#7d93b3" strokeOpacity={0.35} />
                    {on && <rect width={110} height={60} rx={4} fill={s.color} opacity={0.18} />}
                  </g>
                  <line x1={x} y1={92} x2={x} y2={PLUG_Y - 14} stroke="#5d6876" strokeWidth={4} />
                </g>
              );
            })}

            {/* Inverter / battery box (bottom) */}
            <rect x={60} y={SOCK_Y - 32} width={W - 120} height={88} rx={16} fill="#1c3043" stroke="rgba(255,255,255,.1)" />
            <text x={W / 2} y={SOCK_Y + 44} textAnchor="middle" fontSize={13} fill="#9fb0c2">
              {t('mg.circuit.battery')}
            </text>

            {/* Finished wires */}
            {Object.entries(links).map(([id, slot]) => {
              const s = STRINGS[Number(id)];
              return (
                <g key={id}>
                  <path d={wire(plugX(s.id), PLUG_Y, sockX(slot), SOCK_Y)} stroke={s.color} strokeWidth={6} fill="none" strokeLinecap="round" />
                  <path d={wire(plugX(s.id), PLUG_Y, sockX(slot), SOCK_Y)} stroke="#fff" strokeWidth={2} fill="none" strokeDasharray="4 12" className="beam" opacity={0.7} />
                </g>
              );
            })}
            {/* Live wire following the pointer */}
            {picked !== null && mouse && <path d={wire(plugX(picked), PLUG_Y, mouse.x, mouse.y)} stroke={STRINGS[picked].color} strokeWidth={5} strokeDasharray="8 6" fill="none" opacity={0.75} pointerEvents="none" />}

            {/* Plugs */}
            {STRINGS.map((s) => {
              const on = links[s.id] !== undefined;
              const sel = picked === s.id;
              return (
                <g
                  key={s.id}
                  transform={`translate(${plugX(s.id)} ${PLUG_Y})`}
                  onClick={() => pickPlug(s.id)}
                  onKeyDown={(e) => keyAct(e, () => pickPlug(s.id))}
                  role="button"
                  tabIndex={on ? -1 : 0}
                  aria-label={`${t('mg.circuit.plug')} ${t(`mg.circuit.shape.${s.shape}`)}`}
                  aria-pressed={sel}
                  style={{ cursor: on ? 'default' : 'pointer' }}
                >
                  {/* Generous invisible tap area for small fingers */}
                  <circle r={48} fill="transparent" />
                  <circle r={24} fill={sel || hint === s.id ? `${s.color}44` : '#10283E'} stroke={s.color} strokeWidth={sel ? 4 : 2.5} className={hint === s.id ? 'pulse' : ''} />
                  <Glyph shape={s.shape} color={s.color} />
                </g>
              );
            })}

            {/* Sockets */}
            {order.map((id, slot) => {
              const s = STRINGS[id];
              const used = Object.values(links).includes(slot);
              const isHint = hint !== null && order[slot] === hint;
              return (
                <motion.g
                  key={slot}
                  animate={wrong === slot ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => pickSocket(slot)}
                  onKeyDown={(e) => keyAct(e, () => pickSocket(slot))}
                  role="button"
                  tabIndex={used ? -1 : 0}
                  aria-label={`${t('mg.circuit.socket')} ${t(`mg.circuit.shape.${s.shape}`)}`}
                  style={{ cursor: used || picked === null ? 'default' : 'pointer' }}
                >
                  <g transform={`translate(${sockX(slot)} ${SOCK_Y})`}>
                    <rect x={-60} y={-40} width={120} height={80} fill="transparent" />
                    <rect x={-26} y={-26} width={52} height={52} rx={12} fill={wrong === slot ? '#5a2630' : isHint ? `${s.color}33` : '#0b1f33'} stroke={used || isHint ? s.color : 'rgba(255,255,255,.25)'} strokeWidth={2.5} />
                    <g opacity={used ? 1 : 0.6}>
                      <Glyph shape={s.shape} color={s.color} r={10} />
                    </g>
                  </g>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {/* Power meter */}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[13px] text-ink/80">{t('mg.circuit.power')}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-energy to-warm" animate={{ width: `${(connected / STRINGS.length) * 100}%` }} />
          </div>
          <span className="num text-[13px] font-semibold text-energy">{num(kw, 3)} kW</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className={`text-[13.5px] font-medium ${msg === 'done' ? 'text-o2' : msg === 'wrong' ? 'text-food' : 'text-muted'}`} aria-live="polite">
            {t(`mg.circuit.${msg}`)}
          </div>
          <button className="btn btn-ghost h-10 px-4 text-[13px]" onClick={giveHint} disabled={done}>
            <Lightbulb size={15} className="text-warm" />
            {t('mg.hint')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
