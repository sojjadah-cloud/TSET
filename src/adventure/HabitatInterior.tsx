import { memo } from 'react';
import type { GameState } from '../sim/types';

/** Inside the main dome: life-support machines along the curved back wall. */
export const HabitatInterior = memo(function HabitatInterior({ game, reduceMotion }: { game: GameState; reduceMotion: boolean }) {
  const waterBad = game.sys.recyclerEff < 0.7;
  const airBad = game.sys.scrubberEff < 0.7 && !game.sys.backupFilter;
  const blink = reduceMotion ? '' : 'blink';
  return (
    <g>
      <defs>
        <linearGradient id="hWall" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1b2f44" />
          <stop offset="1" stopColor="#2c4358" />
        </linearGradient>
        <linearGradient id="hFloor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5b636b" />
          <stop offset="1" stopColor="#3a4047" />
        </linearGradient>
        <radialGradient id="hWarm" cx="0.5" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#F3BE78" stopOpacity="0.35" />
          <stop offset="1" stopColor="#F3BE78" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="machine" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#dcd8d2" />
          <stop offset="1" stopColor="#8f979f" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="#0d1b2b" />
      {/* Dome wall */}
      <path d="M60 600 C 60 140, 1540 140, 1540 600 Z" fill="url(#hWall)" />
      <g fill="none" stroke="#7d93ad" strokeOpacity={0.18} strokeWidth={2}>
        {[220, 330, 440].map((y) => (
          <path key={y} d={`M${60 + (600 - y) * 0.2} ${y + 160} Q 800 ${y - 60} ${1540 - (600 - y) * 0.2} ${y + 160}`} />
        ))}
        {[300, 550, 800, 1050, 1300].map((x) => (
          <path key={x} d={`M${x} 600 Q ${x + (x - 800) * 0.05} 330 ${800 + (x - 800) * 0.3} 190`} />
        ))}
      </g>
      {/* Window to the lunar surface */}
      <g transform="translate(1240 400)">
        <ellipse rx={92} ry={62} fill="#1a2430" />
        <ellipse rx={84} ry={55} fill="#091B30" />
        <path d="M-84 18 Q -20 -6 84 12 L 84 30 Q 0 60 -84 30 Z" fill="#9a948f" />
        <circle cx={40} cy={-24} r={2} fill="#fff" />
        <circle cx={-30} cy={-30} r={1.2} fill="#fff" />
        <circle cx={-10} cy={-12} r={1} fill="#fff" />
        <g transform="translate(48 -30)">
          <rect x={-8} y={-2} width={6} height={4} fill="#2a4a78" />
          <rect x={2} y={-2} width={6} height={4} fill="#2a4a78" />
          <rect x={-2} y={-2.5} width={4} height={5} fill="#d9d4cc" />
        </g>
        <ellipse rx={84} ry={55} fill="none" stroke="#b9c3cc" strokeWidth={4} />
      </g>
      {/* Floor */}
      <path d="M120 600 L 1480 600 L 1600 900 L 0 900 Z" fill="url(#hFloor)" />
      <g stroke="#fff" strokeOpacity={0.05}>
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={120 + i * 124} y1={600} x2={-40 + i * 152} y2={900} />
        ))}
        {[650, 720, 810].map((y) => (
          <line key={y} x1={0} x2={1600} y1={y} y2={y} />
        ))}
      </g>
      <rect width="1600" height="900" fill="url(#hWarm)" />

      {/* Water processor (faulty on Day 2) */}
      <g transform="translate(410 430)">
        <rect width={190} height={170} rx={12} fill="url(#machine)" />
        <rect x={14} y={16} width={70} height={46} rx={6} fill="#0f2233" />
        <text x={49} y={46} textAnchor="middle" fontSize={18} fontWeight={700} fill={waterBad ? '#F37B62' : '#40C7B6'}>
          {Math.round(game.sys.recyclerEff * 100)}%
        </text>
        <rect x={100} y={16} width={74} height={110} rx={8} fill="#30B8E5" opacity={0.25} />
        <rect x={100} y={16 + 110 * (1 - Math.min(1, game.res.waterL / 50))} width={74} height={110 * Math.min(1, game.res.waterL / 50)} rx={8} fill="#30B8E5" opacity={0.7} />
        <path d="M20 90 h 60 v 40 h -40" fill="none" stroke="#5d6876" strokeWidth={8} strokeLinecap="round" />
        <circle cx={170} cy={150} r={6} fill={waterBad ? '#F37B62' : '#40C7B6'} className={blink} />
        {waterBad && (
          <g className={blink}>
            <path d="M40 130 q -4 12 0 18 q 4 -6 0 -18" fill="#30B8E5" />
            <path d="M52 140 q -3 9 0 13 q 3 -4 0 -13" fill="#30B8E5" opacity={0.7} />
          </g>
        )}
      </g>
      {/* O2 generator */}
      <g transform="translate(680 450)">
        <rect width={160} height={150} rx={12} fill="url(#machine)" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={18 + i * 44} y={22} width={30} height={90} rx={15} fill="#bfc6cc" stroke="#40C7B6" strokeOpacity={0.6} />
        ))}
        <text x={80} y={135} textAnchor="middle" fontSize={15} fontWeight={700} fill="#40C7B6">
          O₂
        </text>
      </g>
      {/* CO2 scrubber */}
      <g transform="translate(920 450)">
        <rect width={180} height={150} rx={12} fill="url(#machine)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={18 + i * 30} y={20} width={20} height={80} rx={4} fill="#5d6876" />
        ))}
        <text x={90} y={130} textAnchor="middle" fontSize={15} fontWeight={700} fill={airBad ? '#F37B62' : '#40C7B6'}>
          CO₂ {game.crew.co2.toFixed(1)}
        </text>
        <circle cx={164} cy={136} r={6} fill={airBad ? '#F37B62' : '#40C7B6'} className={blink} />
      </g>
      {/* Exit hatch */}
      <g transform="translate(160 470)">
        <rect width={120} height={170} rx={50} fill="#4b5560" />
        <rect x={14} y={14} width={92} height={150} rx={42} fill="#1a2430" />
        <circle cx={60} cy={90} r={18} fill="none" stroke="#9aa1a8" strokeWidth={5} />
        <rect x={40} y={-14} width={40} height={10} rx={3} fill="#F2B84B" />
      </g>
      {/* Bunk */}
      <g transform="translate(1230 640)">
        <rect width={200} height={120} rx={14} fill="#4b5560" />
        <rect x={10} y={10} width={180} height={64} rx={10} fill="#7fa6c4" />
        <rect x={14} y={14} width={48} height={30} rx={8} fill="#e8e2d8" />
        <rect x={10} y={56} width={180} height={20} rx={6} fill="#2f6f9a" />
      </g>
      {/* Table with food packets */}
      <g transform="translate(800 760)">
        <ellipse cy={22} rx={110} ry={24} fill="#000" opacity={0.25} />
        <ellipse rx={100} ry={28} fill="#c9c4be" />
        <rect x={-6} y={0} width={12} height={30} fill="#8e979f" />
        <rect x={-50} y={-14} width={26} height={16} rx={3} fill="#F37B62" />
        <rect x={-16} y={-16} width={26} height={16} rx={3} fill="#F2B84B" />
        <path d="M30 -10 c -6 -10 -2 -16 4 -12 c 6 -4 10 2 4 12 z" fill="#5fbf6a" />
      </g>
      {/* Medical cabinet */}
      <g transform="translate(1150 770)">
        <rect width={64} height={80} rx={8} fill="#e5e1dc" />
        <rect x={26} y={18} width={12} height={36} fill="#F37B62" />
        <rect x={14} y={30} width={36} height={12} fill="#F37B62" />
      </g>
      {/* Ceiling lights */}
      {[500, 800, 1100].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={210} rx={60} ry={10} fill="#ffe2b0" opacity={0.8} />
          <ellipse cx={x} cy={600} rx={260} ry={40} fill="#F3BE78" opacity={0.08} />
        </g>
      ))}
    </g>
  );
});
