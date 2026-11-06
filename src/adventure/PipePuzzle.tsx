import { motion } from 'framer-motion';
import { Lightbulb, RotateCw, X, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { sfx } from '../audio/sfx';
import { useT } from '../i18n';

/* Connection bits: N=1, E=2, S=4, W=8. */
const N = 1,
  E = 2,
  S = 4,
  W = 8;
const BASE = { straight: N | S, corner: N | E, tee: N | E | S } as const;
type Kind = keyof typeof BASE;
const rot = (m: number, r: number) => {
  let v = m;
  for (let i = 0; i < r; i++) v = ((v << 1) | (v >> 3)) & 15;
  return v;
};
const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];

interface Cell {
  kind: Kind;
  r: number;
  /** Rotation(s) that solve this cell, empty for decoration. */
  solve: number[];
}

const COLS = 6;
const ROWS = 4;
/* Hand-made solution paths (col,row), from inlet (left of first) to outlet (right of last). */
const LAYOUTS: [number, number][][] = [
  [[0, 1], [1, 1], [1, 2], [2, 2], [3, 2], [3, 1], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2]],
  [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [5, 2]],
  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2], [3, 2], [3, 3], [4, 3], [5, 3], [5, 2], [5, 1]],
];

function build(seed: number) {
  const rnd = (() => {
    let s = seed * 9301 + 49297;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  })();
  const path = LAYOUTS[seed % LAYOUTS.length];
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ kind: (['straight', 'corner', 'tee'] as Kind[])[Math.floor(rnd() * 3)], r: 0, solve: [] as number[] })),
  );
  path.forEach(([c, r], i) => {
    const prev = i === 0 ? [c - 1, r] : path[i - 1];
    const next = i === path.length - 1 ? [c + 1, r] : path[i + 1];
    const need = [prev, next].reduce((m, [pc, pr]) => m | DIRS.find((d) => d.dx === pc - c && d.dy === pr - r)!.bit, 0);
    const kind: Kind = need === (N | S) || need === (E | W) ? 'straight' : 'corner';
    const solve = [0, 1, 2, 3].filter((k) => rot(BASE[kind], k) === need);
    grid[r][c] = { kind, r: 0, solve };
  });
  grid.forEach((row) => row.forEach((cell) => (cell.r = Math.floor(rnd() * 4))));
  // Make sure the puzzle does not start solved: scramble the first path cell.
  const [c0, r0] = path[0];
  if (grid[r0][c0].solve.includes(grid[r0][c0].r)) grid[r0][c0].r = (grid[r0][c0].r + 1) % 4;
  return { grid, inRow: path[0][1], outRow: path[path.length - 1][1], path };
}

/** Which cells water reaches from the inlet. */
function flow(grid: Cell[][], inRow: number) {
  const wet = new Set<string>();
  const start = grid[inRow][0];
  if (!(rot(BASE[start.kind], start.r) & W)) return wet;
  const q: [number, number][] = [[0, inRow]];
  wet.add(`0,${inRow}`);
  while (q.length) {
    const [c, r] = q.shift()!;
    const m = rot(BASE[grid[r][c].kind], grid[r][c].r);
    for (const d of DIRS) {
      if (!(m & d.bit)) continue;
      const nc = c + d.dx;
      const nr = r + d.dy;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const n = grid[nr][nc];
      if (!(rot(BASE[n.kind], n.r) & d.opp)) continue;
      const k = `${nc},${nr}`;
      if (!wet.has(k)) {
        wet.add(k);
        q.push([nc, nr]);
      }
    }
  }
  return wet;
}

export function PipePuzzle({ seed, onSolved, onClose }: { seed: number; onSolved: () => void; onClose: () => void }) {
  const { t } = useT();
  const initial = useMemo(() => build(seed), [seed]);
  const [grid, setGrid] = useState(initial.grid);
  const [sel, setSel] = useState<[number, number]>([0, initial.inRow]);
  const [hint, setHint] = useState<string | null>(null);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const wet = flow(grid, initial.inRow);
  const outCell = grid[initial.outRow][COLS - 1];
  const solved = wet.has(`${COLS - 1},${initial.outRow}`) && !!(rot(BASE[outCell.kind], outCell.r) & E);

  // Apply a change, then check whether water now reaches the outlet.
  const commit = (n: Cell[][]) => {
    setGrid(n);
    const w = flow(n, initial.inRow);
    const o = n[initial.outRow][COLS - 1];
    if (w.has(`${COLS - 1},${initial.outRow}`) && rot(BASE[o.kind], o.r) & E) {
      setDone(true);
      sfx.play('success');
      setTimeout(onSolved, 1400);
    }
  };
  const copy = () => grid.map((row) => row.map((x) => ({ ...x })));

  const turn = (c: number, r: number) => {
    if (done) return;
    setSel([c, r]);
    setMoves((m) => m + 1);
    sfx.play('tick');
    const n = copy();
    n[r][c].r = (n[r][c].r + 1) % 4;
    commit(n);
  };

  const giveHint = () => {
    // Fix the first wrong cell along the real path and highlight it.
    const wrong = initial.path.find(([c, r]) => !grid[r][c].solve.includes(grid[r][c].r));
    if (!wrong || done) return;
    const [c, r] = wrong;
    setHint(`${c},${r}`);
    sfx.play('click');
    const n = copy();
    n[r][c].r = n[r][c].solve[0];
    commit(n);
    setTimeout(() => setHint(null), 1200);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const [c, r] = sel;
    const mv: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (mv[e.key]) {
      e.preventDefault();
      const [dx, dy] = mv[e.key];
      setSel([Math.min(COLS - 1, Math.max(0, c + dx)), Math.min(ROWS - 1, Math.max(0, r + dy))]);
    } else if (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'e') {
      e.preventDefault();
      turn(c, r);
    } else if (e.key.toLowerCase() === 'h') giveHint();
  };

  const CELL = 92;
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-[#020a14]/70 p-2 backdrop-blur-sm sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-modal="true" aria-label={t('mg.pipes.title')} initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} className="glass-strong scroll-thin max-h-[96dvh] w-full max-w-[720px] overflow-y-auto rounded-[28px] p-4 sm:p-6" onKeyDown={onKey} tabIndex={-1} ref={(el) => el?.focus()}>
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-water/15 text-water">
            <Wrench size={22} />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[22px] font-bold">{t('mg.pipes.title')}</h2>
            <p className="mt-0.5 text-[14px] text-ink/80">{t('mg.pipes.goal')}</p>
          </div>
          <button className="btn btn-ghost h-9 w-9 rounded-xl" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 flex justify-center" dir="ltr">
          <svg viewBox={`-60 -10 ${COLS * CELL + 120} ${ROWS * CELL + 20}`} className="w-full max-w-[640px]">
            {/* Inlet tank and outlet tank */}
            <g transform={`translate(-52 ${initial.inRow * CELL + CELL / 2 - 30})`}>
              <rect width={44} height={60} rx={10} fill="#30B8E5" opacity={0.85} />
              <text x={22} y={36} textAnchor="middle" fontSize={13} fontWeight={700} fill="#04212d">
                H₂O
              </text>
            </g>
            <g transform={`translate(${COLS * CELL + 8} ${initial.outRow * CELL + CELL / 2 - 30})`}>
              <rect width={44} height={60} rx={10} fill={solved ? '#40C7B6' : '#22384d'} stroke="#40C7B6" strokeWidth={2} />
              <path d="M14 30 l 6 6 l 12 -12" stroke={solved ? '#04212d' : '#40C7B6'} strokeWidth={3} fill="none" opacity={solved ? 1 : 0.4} />
            </g>
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const key = `${c},${r}`;
                const isWet = wet.has(key);
                const isSel = sel[0] === c && sel[1] === r;
                const color = isWet ? '#30B8E5' : '#8e979f';
                return (
                  <g key={key} transform={`translate(${c * CELL} ${r * CELL})`} onClick={() => turn(c, r)} style={{ cursor: 'pointer' }} role="button" aria-label={`${t('mg.pipes.tile')} ${c + 1},${r + 1}`}>
                    <rect x={3} y={3} width={CELL - 6} height={CELL - 6} rx={14} fill={hint === key ? '#F3BE78' : '#14283c'} opacity={hint === key ? 0.4 : 1} stroke={isSel ? '#40C7B6' : 'rgba(255,255,255,.08)'} strokeWidth={isSel ? 3 : 1} />
                    <motion.g animate={{ rotate: cell.r * 90 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} style={{ originX: `${CELL / 2}px`, originY: `${CELL / 2}px` }}>
                      <PipeShape kind={cell.kind} color={color} size={CELL} />
                    </motion.g>
                  </g>
                );
              }),
            )}
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <RotateCw size={14} />
            {done ? <span className="font-semibold text-o2">{t('mg.pipes.done')}</span> : t('mg.pipes.how')}
          </div>
          <div className="flex items-center gap-2">
            <span className="num text-[12px] text-muted">{moves}</span>
            <button className="btn btn-ghost h-10 px-4 text-[13px]" onClick={giveHint} disabled={done}>
              <Lightbulb size={15} className="text-warm" />
              {t('mg.hint')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PipeShape({ kind, color, size }: { kind: Kind; color: string; size: number }) {
  const h = size / 2;
  const w = 18;
  const stroke = { stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <g>
      {kind === 'straight' && <line x1={h} y1={0} x2={h} y2={size} {...stroke} />}
      {kind === 'corner' && <path d={`M${h} 0 V ${h - 8} Q ${h} ${h} ${h + 8} ${h} H ${size}`} {...stroke} />}
      {kind === 'tee' && (
        <>
          <line x1={h} y1={0} x2={h} y2={size} {...stroke} />
          <line x1={h} y1={h} x2={size} y2={h} {...stroke} />
        </>
      )}
      <circle cx={h} cy={h} r={12} fill="#5d6876" />
      <circle cx={h} cy={h} r={5} fill={color} />
    </g>
  );
}
