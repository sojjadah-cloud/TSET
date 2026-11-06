import { memo } from 'react';

/** Deterministic PRNG so the landscape is identical on every render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(7);
const STARS = Array.from({ length: 260 }, () => ({
  x: rnd() * 1600,
  y: rnd() * 430,
  r: rnd() < 0.08 ? 1.4 + rnd() : 0.4 + rnd() * 0.8,
  o: 0.3 + rnd() * 0.7,
  tw: rnd() < 0.18,
  d: rnd() * 6,
}));

/* Craters: perspective-flattened ellipses. Light from the left → inner left wall shaded. */
const CRATERS = [
  { x: 700, y: 760, rx: 120, ry: 26 },
  { x: 1480, y: 860, rx: 150, ry: 30 },
  { x: 220, y: 560, rx: 70, ry: 13 },
  { x: 980, y: 470, rx: 60, ry: 9 },
  { x: 1380, y: 560, rx: 46, ry: 8 },
  { x: 560, y: 470, rx: 40, ry: 6 },
  { x: 880, y: 860, rx: 90, ry: 18 },
  { x: 1500, y: 640, rx: 60, ry: 11 },
  { x: 120, y: 860, rx: 70, ry: 14 },
  { x: 1250, y: 470, rx: 34, ry: 5 },
];

const rr = mulberry32(42);
type Rock = { x: number; y: number; s: number; pts: string };
const rockShape = (s: number) => {
  const n = 7;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI; // upper half
    const rad = s * (0.7 + rr() * 0.4);
    pts.push(`${(Math.cos(a) * rad).toFixed(1)},${(Math.sin(a) * rad * 0.75).toFixed(1)}`);
  }
  return pts.join(' ');
};
const ROCK_SPOTS = [
  [520, 700, 18], [585, 720, 9], [960, 800, 22], [1010, 812, 10], [1350, 640, 14], [1440, 700, 26],
  [1550, 740, 16], [70, 600, 14], [180, 880, 20], [420, 860, 12], [760, 870, 14], [1180, 860, 18],
  [1300, 830, 9], [640, 520, 8], [900, 500, 7], [1050, 470, 6], [360, 500, 9], [1560, 520, 10],
  [1210, 520, 8], [250, 640, 7], [690, 690, 6], [1100, 830, 7], [860, 720, 8], [1490, 790, 7],
];
const ROCKS: Rock[] = ROCK_SPOTS.map(([x, y, s]) => ({ x, y, s, pts: rockShape(s) }));
const PEBBLES = Array.from({ length: 140 }, () => {
  const y = 470 + rr() ** 0.8 * 430;
  return { x: rr() * 1600, y, r: 0.8 + rr() * (y - 440) * 0.006 };
});

export const Backdrop = memo(function Backdrop({ relay, reduceMotion }: { relay: boolean; reduceMotion: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#040c18" />
          <stop offset="0.55" stopColor="#091B30" />
          <stop offset="1" stopColor="#14304a" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff3dc" stopOpacity="1" />
          <stop offset="0.12" stopColor="#ffd28c" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#ff9f4f" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ff9f4f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ridgeFar" x1="0" x2="1">
          <stop offset="0" stopColor="#c9a882" />
          <stop offset="0.35" stopColor="#6f6a6a" />
          <stop offset="1" stopColor="#3b4250" />
        </linearGradient>
        <linearGradient id="ridgeNear" x1="0" x2="1">
          <stop offset="0" stopColor="#d9bb93" />
          <stop offset="0.4" stopColor="#8a8380" />
          <stop offset="1" stopColor="#4b505a" />
        </linearGradient>
        <linearGradient id="ground" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#a29a93" />
          <stop offset="0.35" stopColor="#b7b1ac" />
          <stop offset="1" stopColor="#8d8782" />
        </linearGradient>
        <linearGradient id="groundLight" x1="0" x2="1">
          <stop offset="0" stopColor="#ffcf94" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#ffcf94" stopOpacity="0.05" />
          <stop offset="1" stopColor="#1a2a3d" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="craterIn" cx="0.62" cy="0.4" r="0.75">
          <stop offset="0" stopColor="#c9c2bb" />
          <stop offset="0.5" stopColor="#8d8781" />
          <stop offset="1" stopColor="#4c4a4b" />
        </radialGradient>
        <linearGradient id="rockGrad" x1="0" x2="1" y1="0" y2="0.5">
          <stop offset="0" stopColor="#e2d4c2" />
          <stop offset="0.45" stopColor="#8f8882" />
          <stop offset="1" stopColor="#3e3f44" />
        </linearGradient>
        <filter id="regolith" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 1.6" numOctaves="2" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.32  0 0 0 0.55 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      {/* Sky */}
      <rect width="1600" height="900" fill="url(#sky)" />
      <g>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#f7f5f1" opacity={s.o} className={s.tw && !reduceMotion ? 'twinkle' : ''} style={s.tw ? { animationDelay: `${s.d}s` } : undefined} />
        ))}
      </g>
      {/* Faint Milky Way band */}
      <path d="M-50 330 C 400 150, 1000 60, 1700 -20" stroke="#9fb6d6" strokeOpacity={0.06} strokeWidth={120} fill="none" filter="url(#blur8)" />

      {/* Relay satellite – Earth is never visible from the far side */}
      <g transform="translate(1395 92)">
        <g className={reduceMotion ? '' : 'sat-drift'}>
          <rect x={-34} y={-5} width={26} height={10} fill="#2a4a78" stroke="#9fb6d6" strokeWidth={0.8} />
          <rect x={8} y={-5} width={26} height={10} fill="#2a4a78" stroke="#9fb6d6" strokeWidth={0.8} />
          <rect x={-8} y={-8} width={16} height={16} rx={2} fill="#d9d4cc" />
          <path d="M-6 8 Q 0 16 6 8" fill="#cfd3d6" />
          <circle cx={0} cy={0} r={2} fill={relay ? '#40C7B6' : '#F37B62'} className={reduceMotion ? '' : 'blink'} />
        </g>
      </g>
      {/* Link between antenna and relay */}
      <path
        d="M1168 236 Q 1290 150 1388 100"
        stroke={relay ? '#40C7B6' : '#F37B62'}
        strokeOpacity={relay ? 0.55 : 0.35}
        strokeWidth={1.6}
        fill="none"
        strokeDasharray={relay ? '4 8' : '2 10'}
        className={relay && !reduceMotion ? 'beam' : ''}
      />

      {/* Low sun just above the western horizon */}
      <circle cx={70} cy={452} r={260} fill="url(#sunGlow)" />

      {/* Distant ridges */}
      <path d="M0 470 L 0 418 C 90 400, 160 380, 260 402 C 340 420, 410 392, 520 410 C 640 430, 720 404, 840 420 C 960 436, 1080 398, 1200 414 C 1320 430, 1420 404, 1600 420 L 1600 470 Z" fill="url(#ridgeFar)" opacity={0.75} />
      <path d="M0 480 L 0 444 C 120 430, 230 420, 330 438 C 440 456, 560 428, 700 444 C 820 458, 940 440, 1060 452 C 1200 466, 1340 438, 1600 450 L 1600 480 Z" fill="url(#ridgeNear)" />
      <path d="M0 444 C 120 430, 230 420, 330 438" fill="none" stroke="#ffdcae" strokeOpacity={0.55} strokeWidth={2} />

      {/* Ground plane */}
      <rect y="460" width="1600" height="440" fill="url(#ground)" />
      <rect y="460" width="1600" height="440" fill="#000" filter="url(#regolith)" opacity={0.6} />
      <rect y="460" width="1600" height="440" fill="url(#groundLight)" />

      {/* Craters */}
      {CRATERS.map((c, i) => (
        <g key={i}>
          <ellipse cx={c.x} cy={c.y - c.ry * 0.12} rx={c.rx * 1.08} ry={c.ry * 1.2} fill="#d8cfc5" opacity={0.35} />
          <ellipse cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} fill="url(#craterIn)" />
          <path d={`M${c.x - c.rx} ${c.y} A ${c.rx} ${c.ry} 0 0 1 ${c.x + c.rx} ${c.y}`} fill="#2f3036" opacity={0.35} />
          <path d={`M${c.x + c.rx * 0.2} ${c.y + c.ry} A ${c.rx} ${c.ry} 0 0 0 ${c.x + c.rx} ${c.y}`} fill="none" stroke="#fbe6c8" strokeOpacity={0.5} strokeWidth={1.5} />
        </g>
      ))}

      {/* Pebbles */}
      {PEBBLES.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={p.r * 1.4} ry={p.r * 0.7} fill="#5d5956" opacity={0.5} />
      ))}

      {/* Rocks with long shadows */}
      {ROCKS.map((r, i) => (
        <g key={i} transform={`translate(${r.x} ${r.y})`}>
          <ellipse cx={r.s * 1.6} cy={1} rx={r.s * 2.2} ry={r.s * 0.28} fill="#1a1d24" opacity={0.45} />
          <polygon points={r.pts} fill="url(#rockGrad)" />
          <polygon points={r.pts} fill="none" stroke="#f5dcb8" strokeOpacity={0.25} strokeWidth={1} />
        </g>
      ))}
    </g>
  );
});
