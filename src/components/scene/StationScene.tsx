import { motion } from 'framer-motion';
import { memo, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { has } from '../../sim/missions';
import { systemLevels, type Level } from '../../sim/status';
import type { GameState, SystemId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Backdrop } from './Backdrop';

/* Camera focus points for each facility (viewBox 1600×900). */
export const FOCUS: Record<SystemId, { x: number; y: number; s: number }> = {
  lifeSupport: { x: 800, y: 480, s: 1.55 },
  greenhouse: { x: 430, y: 540, s: 1.7 },
  energy: { x: 260, y: 730, s: 1.6 },
  comms: { x: 1140, y: 400, s: 1.5 },
  safety: { x: 1160, y: 700, s: 1.6 },
};

const MARKER: Record<SystemId, { x: number; y: number }> = {
  lifeSupport: { x: 800, y: 330 },
  greenhouse: { x: 430, y: 455 },
  energy: { x: 230, y: 620 },
  comms: { x: 1140, y: 205 },
  safety: { x: 1150, y: 600 },
};

const levelColor: Record<Level, string> = { ok: '#40C7B6', warning: '#F2B84B', critical: '#F37B62' };

export const PROFILE_GLOW = { balanced: '#e58bf0', redRich: '#ff6f7d', blueRich: '#8f8bff' } as const;

interface Props {
  game: GameState;
  focus: SystemId | null;
  onSelect: (s: SystemId) => void;
  /** Screen x (viewBox units) where the focused facility should land. */
  targetX?: number;
  markers?: boolean;
}

export const StationScene = memo(function StationScene({ game, focus, onSelect, targetX = 800, markers = true }: Props) {
  const reduceMotion = useGame((g) => g.reduceMotion);
  const { t, dir } = useT();
  const [hover, setHover] = useState<SystemId | null>(null);
  const levels = systemLevels(game);
  const f = focus ? FOCUS[focus] : null;
  // Keep the camera inside the painted world so no empty edges appear.
  const fx = f ? Math.min(Math.max(f.x, targetX / f.s), 1600 - (1600 - targetX) / f.s) : 0;
  const fy = f ? Math.min(Math.max(f.y, 450 / f.s), 900 - 450 / f.s) : 0;
  const cam = f ? { scale: f.s, x: targetX - 800 - (fx - 800) * f.s, y: -(fy - 450) * f.s } : { scale: 1, x: 0, y: 0 };

  const facility = (id: SystemId, children: ReactNode) => (
    <g
      className={`facility ${hover === id ? 'is-hover' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t(`sys.${id}`)}
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover((h) => (h === id ? null : h))}
      onFocus={() => setHover(id)}
      onBlur={() => setHover(null)}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(id))}
    >
      {children}
    </g>
  );

  return (
    <svg className="absolute inset-0 h-full w-full select-none" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-label="Lunar station">
      <Defs ghGlow={PROFILE_GLOW[game.ctl.lightProfile]} />
      <motion.g
        initial={false}
        animate={{ scale: cam.scale, x: cam.x, y: cam.y }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 18 }}
        style={{ originX: '800px', originY: '450px' }}
      >
        <WorldContents game={game} reduceMotion={reduceMotion} wrap={facility} />

        {/* ---------- Floating markers ---------- */}
        {markers && (Object.keys(MARKER) as SystemId[]).map((id) => {
          const m = MARKER[id];
          const active = hover === id;
          const c = levelColor[levels[id]];
          return (
            <g key={id} transform={`translate(${m.x} ${m.y})`} pointerEvents="none" opacity={focus ? 0 : 1} style={{ transition: 'opacity .4s' }}>
              <circle r={active ? 9 : 6} fill={c} opacity={0.25} className={reduceMotion ? '' : 'pulse'} />
              <circle r={4} fill={c} stroke="#091B30" strokeWidth={1.5} />
              <line y1={6} y2={26} stroke={c} strokeOpacity={0.6} strokeWidth={1} />
              <foreignObject x={-110} y={-62} width={220} height={54} style={{ overflow: 'visible' }}>
                <div className={`marker ${active ? 'marker-active' : ''}`} dir={dir}>
                  <span className="marker-dot" style={{ background: c }} />
                  <span className="marker-name">{t(`sys.${id}`)}</span>
                  {active && <span className="marker-status" style={{ color: c }}>{t(levels[id] === 'ok' ? 'common.ok' : levels[id] === 'warning' ? 'common.warning' : 'common.critical')}</span>}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </motion.g>
    </svg>
  );
});

/* =================================================================== */
/* World contents – shared by the station overview and exploration mode */
/* =================================================================== */

export function WorldContents({
  game,
  reduceMotion,
  wrap = (_id, c) => c,
  npcAstronaut = true,
  children,
}: {
  game: GameState;
  reduceMotion: boolean;
  wrap?: (id: SystemId, c: ReactNode) => ReactNode;
  npcAstronaut?: boolean;
  /** Drawn above the base but below the light wash (player, beacons…). */
  children?: ReactNode;
}) {
  const ghGlow = PROFILE_GLOW[game.ctl.lightProfile];
  const ghLight = game.ctl.lightIntensity / 100;
  const circuitFault = game.day === 1 && !game.marks.includes('solarCircuitFixed');
  const dust = circuitFault ? 0 : Math.max(0, 1 - game.sys.solarEff);
  const relay = game.sys.relayOnline;
  const inShelter = game.ctl.location === 'shelter';
  const spe = has(game, 'spe');
  const co2Bad = game.crew.co2 > 3;
  const facility = wrap;
  return (
    <g>
    <Backdrop relay={relay} reduceMotion={reduceMotion} />

    {/* ---------- Corridors (behind facilities) ---------- */}
    <Corridor x1={560} y1={575} x2={640} y2={560} />
    <Corridor x1={985} y1={560} x2={1080} y2={540} />
    <Corridor x1={930} y1={615} x2={1060} y2={690} />

    {/* ---------- Power cables ---------- */}
    <g stroke="#1b2733" strokeWidth={3} fill="none" opacity={0.85}>
      <path d="M330 700 C 420 690, 520 650, 640 600" />
      <path d="M150 745 C 260 735, 380 700, 470 620" />
    </g>
    <g stroke="#F2B84B" strokeWidth={1.5} fill="none" className={reduceMotion ? '' : 'cable-flow'} opacity={0.75 * game.sys.solarEff}>
      <path d="M330 700 C 420 690, 520 650, 640 600" strokeDasharray="6 14" />
      <path d="M150 745 C 260 735, 380 700, 470 620" strokeDasharray="6 14" />
    </g>

    {/* ---------- Communications tower ---------- */}
    {facility('comms', <CommsTower relay={relay} reduceMotion={reduceMotion} />)}

    {/* ---------- Greenhouse ---------- */}
    {facility('greenhouse', <Greenhouse glow={ghGlow} light={ghLight} health={game.plants.health} />)}

    {/* ---------- Central habitat & life support ---------- */}
    {facility('lifeSupport', <Habitat co2Bad={co2Bad} recyclerOk={game.sys.recyclerEff >= 0.7} reduceMotion={reduceMotion} />)}

    {/* ---------- Shelter ---------- */}
    {facility('safety', <Shelter occupied={inShelter} spe={spe} reduceMotion={reduceMotion} />)}

    {/* ---------- Solar arrays & batteries ---------- */}
    {facility('energy', <SolarField dust={dust} battery={game.res.batteryKWh / 10} reduceMotion={reduceMotion} fault={circuitFault} />)}

    {/* ---------- Props ---------- */}
    <Rover x={1395} y={742} />
    {npcAstronaut && !inShelter && <Astronaut x={1262} y={742} animate={!reduceMotion} />}
    <Containers />
    <Lamp x={612} y={640} />
    <Lamp x={1010} y={660} />
    <Lamp x={1300} y={690} />
    <Seismometer x={120} y={600} />

    {children}

    {/* Warm golden-hour light wash + vignette */}
    <rect width="1600" height="900" fill="url(#sunWash)" pointerEvents="none" />
    <rect width="1600" height="900" fill="url(#vignette)" pointerEvents="none" />
    </g>
  );
}

/* =================================================================== */
/* Gradients & filters                                                  */
/* =================================================================== */

export function Defs({ ghGlow }: { ghGlow: string }) {
  return (
    <defs>
      <radialGradient id="domeGrad" cx="0.32" cy="0.25" r="0.85">
        <stop offset="0" stopColor="#f6f1ea" />
        <stop offset="0.35" stopColor="#d9d6d2" />
        <stop offset="0.7" stopColor="#8f97a0" />
        <stop offset="1" stopColor="#3d4957" />
      </radialGradient>
      <linearGradient id="metalV" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#d8d4cf" />
        <stop offset="1" stopColor="#6c7480" />
      </linearGradient>
      <linearGradient id="metalH" x1="0" x2="1">
        <stop offset="0" stopColor="#efe9e1" />
        <stop offset="0.55" stopColor="#a8adb3" />
        <stop offset="1" stopColor="#4d5967" />
      </linearGradient>
      <linearGradient id="tube" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#e7e2db" />
        <stop offset="0.5" stopColor="#a9aeb4" />
        <stop offset="1" stopColor="#4f5a66" />
      </linearGradient>
      <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#d9f3f5" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="#7fb7c9" stopOpacity="0.18" />
        <stop offset="1" stopColor="#24435c" stopOpacity="0.35" />
      </linearGradient>
      <radialGradient id="ghGlow" cx="0.5" cy="0.6" r="0.6">
        <stop offset="0" stopColor={ghGlow} stopOpacity="0.9" />
        <stop offset="1" stopColor={ghGlow} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="panelCell" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#3a5f8d" />
        <stop offset="0.45" stopColor="#13284a" />
        <stop offset="0.6" stopColor="#1d3a66" />
        <stop offset="1" stopColor="#0b1a33" />
      </linearGradient>
      <linearGradient id="panelSheen" x1="0" x2="1" y1="0" y2="0.4">
        <stop offset="0" stopColor="#F3BE78" stopOpacity="0" />
        <stop offset="0.5" stopColor="#F3BE78" stopOpacity="0.55" />
        <stop offset="1" stopColor="#F3BE78" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="warmWindow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffe2b0" />
        <stop offset="1" stopColor="#F3BE78" />
      </radialGradient>
      <radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sunWash" cx="0.02" cy="0.47" r="0.9">
        <stop offset="0" stopColor="#ffb661" stopOpacity="0.28" />
        <stop offset="0.35" stopColor="#ff9e4a" stopOpacity="0.1" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#020812" stopOpacity="0.55" />
      </radialGradient>
      <linearGradient id="shadowFade" x1="0" x2="1">
        <stop offset="0" stopColor="#0d1620" stopOpacity="0.55" />
        <stop offset="1" stopColor="#0d1620" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="berm" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#d6cdc4" />
        <stop offset="0.5" stopColor="#9b938c" />
        <stop offset="1" stopColor="#4b4a4c" />
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="blur2">
        <feGaussianBlur stdDeviation="2" />
      </filter>
      <filter id="blur8" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
    </defs>
  );
}

/* =================================================================== */
/* Facilities                                                           */
/* =================================================================== */

function CastShadow({ x, y, w, h, skew = 0.9 }: { x: number; y: number; w: number; h: number; skew?: number }) {
  // Low sun on the left → long shadows to the right.
  return <ellipse cx={x + w * 0.5 * skew} cy={y} rx={w} ry={h} fill="url(#shadowFade)" filter="url(#softShadow)" />;
}

function Corridor({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <g transform={`translate(${x1} ${y1}) rotate(${ang})`}>
      <rect x={0} y={-13} width={len} height={26} rx={12} fill="url(#tube)" />
      {Array.from({ length: Math.floor(len / 22) }).map((_, i) => (
        <rect key={i} x={10 + i * 22} y={-14} width={4} height={28} rx={2} fill="#8d939a" opacity={0.7} />
      ))}
      <rect x={0} y={-13} width={len} height={5} rx={2} fill="#fff" opacity={0.25} />
    </g>
  );
}

function Habitat({ co2Bad, recyclerOk, reduceMotion }: { co2Bad: boolean; recyclerOk: boolean; reduceMotion: boolean }) {
  return (
    <g>
      <CastShadow x={840} y={612} w={330} h={36} />
      {/* Life-support annex: O2 tanks, water treatment, CO2 filtration */}
      <g>
        <rect x={930} y={500} width={96} height={86} rx={8} fill="url(#metalV)" />
        <rect x={938} y={512} width={80} height={10} rx={3} fill="#3b4652" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={942 + i * 19} y={530} width={12} height={40} rx={3} fill="#5d6876" />
        ))}
        <circle cx={1012} cy={517} r={3.5} fill={co2Bad ? '#F37B62' : '#40C7B6'} className={reduceMotion ? '' : 'blink'} />
        {/* O2 tanks */}
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(${1032 + i * 26} 508)`}>
            <rect width={22} height={78} rx={11} fill="url(#metalH)" />
            <rect y={20} width={22} height={5} fill="#40C7B6" opacity={0.85} />
          </g>
        ))}
        {/* Water treatment tank */}
        <g transform="translate(600 530)">
          <rect width={52} height={58} rx={10} fill="url(#metalH)" />
          <rect x={6} y={8} width={40} height={6} rx={3} fill="#30B8E5" opacity={0.85} />
          <circle cx={40} cy={44} r={3.5} fill={recyclerOk ? '#40C7B6' : '#F2B84B'} className={reduceMotion ? '' : 'blink'} />
        </g>
      </g>
      {/* Base ring */}
      <path d="M590 560 Q 800 640 1010 560 L 1010 588 Q 800 668 590 588 Z" fill="#59636f" />
      <path d="M590 560 Q 800 640 1010 560 L 1010 566 Q 800 646 590 566 Z" fill="#c9c4be" opacity={0.6} />
      {/* Dome */}
      <path d="M590 562 C 590 360, 1010 360, 1010 562 Q 800 640 590 562 Z" fill="url(#domeGrad)" />
      {/* Panel seams */}
      <g fill="none" stroke="#5a6470" strokeOpacity={0.35} strokeWidth={1.4}>
        <path d="M640 520 Q 800 575 960 520" />
        <path d="M680 460 Q 800 500 920 460" />
        <path d="M740 410 Q 800 425 860 410" />
        <path d="M800 400 L 800 610" />
        <path d="M700 425 Q 690 520 700 600" />
        <path d="M900 425 Q 910 520 900 600" />
        <path d="M640 470 Q 620 530 630 585" />
        <path d="M960 470 Q 980 530 970 585" />
      </g>
      {/* Sun rim highlight */}
      <path d="M600 540 C 600 400, 720 370, 800 372" fill="none" stroke="#ffd59c" strokeWidth={3} strokeOpacity={0.55} />
      {/* Window band with warm interior light */}
      {[-150, -95, -40, 15, 70, 125].map((dx, i) => (
        <g key={i}>
          <rect x={800 + dx} y={527 + Math.abs(dx + 12) * 0.12} width={34} height={20} rx={7} fill="#1a2430" />
          <rect x={802 + dx} y={529 + Math.abs(dx + 12) * 0.12} width={30} height={16} rx={6} fill="url(#warmWindow)" className={reduceMotion ? '' : 'window-flicker'} style={{ animationDelay: `${i * 0.7}s` }} />
        </g>
      ))}
      <ellipse cx={800} cy={590} rx={180} ry={30} fill="#F3BE78" opacity={0.12} filter="url(#blur8)" />
      {/* Cupola */}
      <ellipse cx={800} cy={402} rx={42} ry={10} fill="#6b7581" />
      <path d="M762 402 C 762 360, 838 360, 838 402 Z" fill="url(#glass)" stroke="#d9e3e8" strokeOpacity={0.5} />
      <ellipse cx={800} cy={392} rx={18} ry={8} fill="#F3BE78" opacity={0.5} filter="url(#blur2)" />
      {/* Airlock */}
      <g transform="translate(760 572)">
        <rect width={80} height={56} rx={14} fill="url(#metalV)" />
        <rect x={20} y={14} width={40} height={42} rx={10} fill="#1a2430" />
        <rect x={24} y={18} width={32} height={38} rx={8} fill="url(#warmWindow)" opacity={0.92} />
        <rect x={-6} y={50} width={92} height={8} rx={3} fill="#4b5560" />
      </g>
      <ellipse cx={800} cy={640} rx={60} ry={10} fill="#F3BE78" opacity={0.25} filter="url(#blur8)" />
    </g>
  );
}

function Greenhouse({ glow, light, health }: { glow: string; light: number; health: number }) {
  const leaf = health > 70 ? '#5fbf6a' : health > 45 ? '#9bb35a' : '#a88f52';
  return (
    <g>
      <CastShadow x={470} y={612} w={210} h={26} />
      {/* Plinth */}
      <path d="M262 590 L 600 600 L 600 618 L 262 606 Z" fill="#59636f" />
      {/* Inner glow */}
      <ellipse cx={430} cy={560} rx={150} ry={60} fill="url(#ghGlow)" opacity={0.15 + light * 0.5} />
      {/* Growing racks and Mizuna plants */}
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect x={290 + row * 8} y={566 + row * 10} width={290 - row * 16} height={9} rx={3} fill="#3c4650" />
          {Array.from({ length: 11 - row }).map((_, i) => {
            const x = 302 + row * 8 + i * (26 + row * 0.5);
            const y = 566 + row * 10;
            return (
              <g key={i} transform={`translate(${x} ${y})`}>
                <path d="M0 0 C -9 -10, -6 -20, 0 -15 C 6 -20, 9 -10, 0 0 Z" fill={leaf} />
                <path d="M-3 0 C -14 -6, -14 -14, -6 -11 Z" fill={leaf} opacity={0.75} />
                <path d="M3 0 C 14 -6, 14 -14, 6 -11 Z" fill={leaf} opacity={0.85} />
              </g>
            );
          })}
        </g>
      ))}
      {/* Grow light bars */}
      {[320, 390, 460, 530].map((x) => (
        <rect key={x} x={x} y={503} width={44} height={4} rx={2} fill={glow} opacity={0.35 + light * 0.65} />
      ))}
      {/* Glass vault */}
      <path d="M262 592 C 262 470, 600 470, 600 600 Z" fill="url(#glass)" />
      <g fill="none" stroke="#e8f1f4" strokeOpacity={0.55} strokeWidth={1.6}>
        <path d="M262 592 C 262 470, 600 470, 600 600" />
        {[0.18, 0.36, 0.54, 0.72].map((k) => (
          <path key={k} d={`M${262 + 338 * k} ${592 + 8 * k} C ${262 + 338 * k - 10} ${520 - 30 * Math.sin(k * Math.PI)}, ${262 + 338 * k + 10} ${505}, ${262 + 338 * k + 4} ${486 + 14 * Math.abs(k - 0.5)}`} strokeOpacity={0.3} />
        ))}
        <path d="M285 540 C 360 505, 500 505, 585 545" strokeOpacity={0.3} />
      </g>
      <path d="M280 560 C 290 505, 340 490, 380 488" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" />
      {/* Water supply pipe */}
      <path d="M600 590 L 620 590" stroke="#30B8E5" strokeWidth={4} />
    </g>
  );
}

function SolarField({ dust, battery, reduceMotion, fault = false }: { dust: number; battery: number; reduceMotion: boolean; fault?: boolean }) {
  const arrays = [
    { x: 60, y: 760, w: 150, h: 86 },
    { x: 220, y: 700, w: 140, h: 78 },
    { x: 370, y: 650, w: 118, h: 66 },
    { x: 40, y: 640, w: 120, h: 68 },
  ];
  return (
    <g>
      {arrays.map((a, i) => (
        <g key={i}>
          <ellipse cx={a.x + a.w * 0.95} cy={a.y + a.h * 0.75} rx={a.w * 0.75} ry={a.h * 0.18} fill="#0d1620" opacity={0.45} filter="url(#blur8)" />
          <rect x={a.x + a.w * 0.45} y={a.y + a.h * 0.35} width={6} height={a.h * 0.45} fill="#5b6470" />
          <g transform={`translate(${a.x} ${a.y}) skewX(-18)`}>
            <rect width={a.w} height={a.h * 0.42} rx={3} fill="url(#panelCell)" stroke="#8c96a3" strokeWidth={2} />
            {Array.from({ length: 6 }).map((_, k) => (
              <line key={k} x1={(a.w / 6) * k} x2={(a.w / 6) * k} y1={0} y2={a.h * 0.42} stroke="#7d93b3" strokeOpacity={0.35} />
            ))}
            <line x1={0} x2={a.w} y1={a.h * 0.21} y2={a.h * 0.21} stroke="#7d93b3" strokeOpacity={0.35} />
            <rect width={a.w} height={a.h * 0.42} fill="url(#panelSheen)" className={reduceMotion ? '' : 'sheen'} style={{ animationDelay: `${i * 0.8}s` }} />
            {/* Moon dust layer reflects the simulation (solar efficiency) */}
            <rect width={a.w} height={a.h * 0.42} fill="#b9b0a6" opacity={dust * 1.3} />
          </g>
        </g>
      ))}
      {/* Day 1: a loose cable sparking under the middle array */}
      {fault && (
        <g>
          <path d="M296 736 C 306 752, 322 750, 330 762" stroke="#1b2733" strokeWidth={3} fill="none" />
          <g className={reduceMotion ? '' : 'blink'}>
            <path d="M330 762 l 6 -8 l -2 7 l 8 -5 l -5 9 l 7 0 l -10 5" fill="#ffd36b" />
            <circle cx={334} cy={762} r={9} fill="#F37B62" opacity={0.35} />
          </g>
        </g>
      )}
      {/* Battery storage */}
      <g transform="translate(300 600)">
        <ellipse cx={70} cy={50} rx={60} ry={8} fill="#0d1620" opacity={0.5} filter="url(#blur2)" />
        <rect width={92} height={48} rx={6} fill="url(#metalV)" />
        <rect x={6} y={6} width={80} height={10} rx={2} fill="#2d3742" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={10 + i * 15} y={24} width={11} height={16} rx={2} fill={battery * 5 > i ? '#F2B84B' : '#38424d'} />
        ))}
      </g>
    </g>
  );
}

function CommsTower({ relay, reduceMotion }: { relay: boolean; reduceMotion: boolean }) {
  return (
    <g>
      <CastShadow x={1180} y={550} w={140} h={16} />
      {/* Equipment hut */}
      <rect x={1080} y={500} width={90} height={50} rx={6} fill="url(#metalV)" />
      <rect x={1090} y={512} width={30} height={10} rx={2} fill="#2d3742" />
      <circle cx={1155} cy={517} r={4} fill={relay ? '#40C7B6' : '#F37B62'} className={reduceMotion ? '' : 'blink'} />
      {/* Lattice mast */}
      <g stroke="#cfd3d6" strokeWidth={3} fill="none">
        <path d="M1120 500 L 1138 260 L 1156 500" />
        {[460, 420, 380, 340, 300].map((y) => (
          <path key={y} d={`M${1120 + (500 - y) * 0.075} ${y} L ${1156 - (500 - y) * 0.075} ${y - 40}`} strokeWidth={1.5} opacity={0.7} />
        ))}
        {[460, 420, 380, 340, 300].map((y) => (
          <path key={'b' + y} d={`M${1156 - (500 - y) * 0.075} ${y} L ${1120 + (500 - y) * 0.075} ${y - 40}`} strokeWidth={1.5} opacity={0.5} />
        ))}
      </g>
      {/* Main dish pointing at the relay satellite (upper right) */}
      <g transform="translate(1140 262) rotate(-28)">
        <path d="M-58 0 Q 0 46 58 0 Z" fill="url(#metalH)" stroke="#e9edf0" strokeWidth={2} />
        <path d="M-58 0 Q 0 14 58 0" fill="none" stroke="#5a6470" strokeWidth={1.5} />
        <line x1={0} y1={8} x2={0} y2={-40} stroke="#cfd3d6" strokeWidth={2} />
        <circle cx={0} cy={-42} r={4} fill="#e9edf0" />
      </g>
      {/* Secondary antenna */}
      <g transform="translate(1185 470) rotate(-35)">
        <path d="M-18 0 Q 0 14 18 0 Z" fill="url(#metalH)" />
        <line x1={0} y1={2} x2={0} y2={-14} stroke="#cfd3d6" strokeWidth={1.5} />
      </g>
      <line x1={1185} y1={478} x2={1185} y2={500} stroke="#cfd3d6" strokeWidth={2} />
      <circle cx={1138} cy={258} r={4} fill="#F37B62" className={reduceMotion ? '' : 'blink'} />
      {/* Signal waves */}
      {relay &&
        [0, 1, 2].map((i) => (
          <path key={i} d="M1168 232 q 12 -14 30 -14" stroke="#40C7B6" strokeWidth={2} fill="none" className={reduceMotion ? '' : 'wave'} style={{ animationDelay: `${i * 0.6}s` }} transform={`translate(${i * 12} ${-i * 10})`} />
        ))}
    </g>
  );
}

function Shelter({ occupied, spe, reduceMotion }: { occupied: boolean; spe: boolean; reduceMotion: boolean }) {
  return (
    <g>
      <CastShadow x={1210} y={772} w={200} h={24} />
      {/* Regolith-covered berm */}
      <path d="M1020 770 C 1030 680, 1110 640, 1170 640 C 1240 640, 1300 690, 1310 772 Z" fill="url(#berm)" />
      <g fill="none" stroke="#5c5753" strokeOpacity={0.35} strokeWidth={2}>
        <path d="M1040 735 Q 1165 705 1295 740" />
        <path d="M1065 700 Q 1165 672 1268 703" />
        <path d="M1100 668 Q 1168 650 1235 670" />
      </g>
      <path d="M1032 740 C 1045 680, 1110 648, 1165 646" fill="none" stroke="#fbe1bb" strokeOpacity={0.4} strokeWidth={3} />
      {/* Reinforced entrance arch */}
      <path d="M1112 772 L 1112 724 Q 1150 692 1188 724 L 1188 772 Z" fill="#6d7680" />
      <path d="M1122 772 L 1122 728 Q 1150 704 1178 728 L 1178 772 Z" fill="#1a2430" />
      <path d="M1128 772 L 1128 732 Q 1150 712 1172 732 L 1172 772 Z" fill="url(#warmWindow)" opacity={occupied ? 1 : 0.35} />
      {[1118, 1182].map((x) => (
        <rect key={x} x={x - 4} y={726} width={8} height={46} fill="#8e979f" />
      ))}
      {occupied && <ellipse cx={1150} cy={780} rx={50} ry={10} fill="#F3BE78" opacity={0.4} filter="url(#blur8)" />}
      {/* Radiation monitor mast */}
      <line x1={1262} y1={700} x2={1262} y2={630} stroke="#cfd3d6" strokeWidth={2.5} />
      <rect x={1252} y={618} width={20} height={14} rx={3} fill="#e5e1dc" />
      <circle cx={1262} cy={612} r={4} fill={spe ? '#F37B62' : '#40C7B6'} className={reduceMotion ? '' : 'blink'} />
      {/* EVA preparation area: suit rack + platform */}
      <rect x={1205} y={760} width={90} height={10} rx={3} fill="#4b5560" />
      <rect x={1278} y={724} width={6} height={38} fill="#8e979f" />
      <rect x={1270} y={720} width={22} height={6} rx={2} fill="#F2B84B" />
    </g>
  );
}

function Rover({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={40} cy={34} rx={70} ry={9} fill="#0d1620" opacity={0.5} filter="url(#blur2)" />
      <rect x={-46} y={-6} width={96} height={22} rx={6} fill="url(#metalV)" />
      <rect x={-30} y={-24} width={46} height={20} rx={5} fill="#cfd3d6" />
      <rect x={-24} y={-20} width={20} height={12} rx={3} fill="#1a2430" />
      <line x1={22} y1={-6} x2={30} y2={-34} stroke="#cfd3d6" strokeWidth={2} />
      <circle cx={30} cy={-36} r={3} fill="#40C7B6" />
      {[-34, -2, 30].map((wx) => (
        <g key={wx}>
          <circle cx={wx} cy={20} r={10} fill="#262f38" />
          <circle cx={wx} cy={20} r={4} fill="#7c848c" />
        </g>
      ))}
      <ellipse cx={-50} cy={4} rx={5} ry={3} fill="#ffe2b0" />
    </g>
  );
}

function Astronaut({ x, y, animate }: { x: number; y: number; animate: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={22} cy={30} rx={30} ry={5} fill="#0d1620" opacity={0.5} filter="url(#blur2)" />
      <g className={animate ? 'astro-idle' : ''}>
        <rect x={-9} y={-14} width={10} height={22} rx={3} fill="#c9c6c2" />
        <rect x={-6} y={-16} width={18} height={26} rx={7} fill="#f1efec" />
        <rect x={-5} y={8} width={7} height={20} rx={3} fill="#e8e5e1" />
        <rect x={4} y={8} width={7} height={20} rx={3} fill="#dad6d1" />
        <rect x={-10} y={-10} width={6} height={18} rx={3} fill="#e8e5e1" transform="rotate(10 -7 -10)" />
        <rect x={10} y={-10} width={6} height={18} rx={3} fill="#d7d3ce" transform="rotate(-14 13 -10)" />
        <circle cx={3} cy={-24} r={10} fill="#f4f2ef" />
        <path d="M-3 -27 a 7 6 0 0 1 13 0 v 4 a 7 5 0 0 1 -13 0 Z" fill="#d9a45a" />
        <path d="M-1 -27 a 4 3 0 0 1 6 -1" stroke="#fff4dd" strokeWidth={1.5} fill="none" opacity={0.8} />
        <rect x={0} y={-8} width={6} height={4} rx={1} fill="#F37B62" />
      </g>
    </g>
  );
}

function Containers() {
  return (
    <g>
      {[
        { x: 1010, y: 610, w: 40, h: 26, c: '#d8d2ca' },
        { x: 1048, y: 618, w: 30, h: 20, c: '#F2B84B' },
        { x: 640, y: 628, w: 34, h: 22, c: '#cfcac3' },
        { x: 560, y: 640, w: 28, h: 18, c: '#e3ddd5' },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x + 6} y={b.y + b.h - 4} width={b.w * 1.6} height={6} fill="#0d1620" opacity={0.35} filter="url(#blur2)" />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill={b.c} />
          <rect x={b.x} y={b.y} width={b.w} height={4} rx={2} fill="#fff" opacity={0.35} />
          <rect x={b.x + b.w * 0.7} y={b.y} width={b.w * 0.3} height={b.h} rx={2} fill="#000" opacity={0.18} />
        </g>
      ))}
    </g>
  );
}

function Lamp({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 34} rx={36} ry={9} fill="url(#lampGlow)" />
      <line x1={x} y1={y} x2={x} y2={y + 34} stroke="#9aa1a8" strokeWidth={2} />
      <rect x={x - 6} y={y - 4} width={12} height={5} rx={2} fill="#ffe2b0" />
      <circle cx={x} cy={y} r={10} fill="#ffe2b0" opacity={0.35} filter="url(#blur2)" />
    </g>
  );
}

function Seismometer({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.9}>
      <path d="M-14 22 L 0 0 L 14 22 M 0 0 L 0 22" stroke="#cfd3d6" strokeWidth={2} fill="none" />
      <rect x={-8} y={-10} width={16} height={12} rx={2} fill="#e5e1dc" />
      <circle cx={0} cy={-14} r={2.5} fill="#40C7B6" />
    </g>
  );
}

