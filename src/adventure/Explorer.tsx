import { useEffect, useRef, useState } from 'react';
import { ArrowBigUp, Hand, Navigation, Zap } from 'lucide-react';
import { useViewport } from '../hooks/useViewport';
import { useT } from '../i18n';
import type { GameState } from '../sim/types';
import { useGame } from '../store/gameStore';
import { Defs, PROFILE_GLOW, WorldContents } from '../components/scene/StationScene';
import { AstronautFigure, applyPose, useAstroRefs, type Pose } from './Astronaut';
import { HabitatInterior } from './HabitatInterior';
import { WORLDS, blocked, depthScale, nearestSpot, type Interactable, type SceneId } from './world';

interface Props {
  game: GameState;
  scene: SceneId;
  spawn: { x: number; y: number; key: number };
  paused: boolean;
  repairing: boolean;
  /** Where the guidance beacon points in this scene (null = none). */
  target: { x: number; y: number } | null;
  onInteract: (spot: Interactable) => void;
  onMoved: () => void;
}

/* Tuning: px/s in scene units. Lunar gravity (1/6 g) gives long, floaty jumps. */
const MOVE = {
  surface: { walk: 125, run: 205, accel: 3.2, jumpV: 200, gravity: 230 },
  inside: { walk: 150, run: 235, accel: 11, jumpV: 120, gravity: 230 },
};

export function Explorer({ game, scene, spawn, paused, repairing, target, onInteract, onMoved }: Props) {
  const { t } = useT();
  const reduceMotion = useGame((g) => g.reduceMotion);
  const world = WORLDS[scene];
  // The world is drawn once into a big layer that the GPU slides around (cheap on phones).
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const layerSize = useRef({ w: 0, h: 0 });
  const cam = useRef({ tx: 0, ty: 0, k: 1, left: 0, top: 0 });
  const promptRef = useRef<HTMLButtonElement | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const astro = useAstroRefs();
  const [near, setNear] = useState<Interactable | null>(null);
  const vp = useViewport();
  // Touch devices: skip decorative scene animations so the big world layer never repaints.
  const lite = vp.touch;

  const st = useRef({
    x: spawn.x,
    y: spawn.y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: 1,
    phase: 0,
    interactUntil: 0,
    camX: spawn.x,
    camY: spawn.y,
    zoom: scene === 'outside' ? 1.9 : 1.15,
    look: { x: 0, y: 0 },
    goal: null as null | { x: number; y: number },
    keys: new Set<string>(),
    moved: false,
    stuck: 0,
    /** On-screen joystick (-1..1), running flag from the touch button. */
    joy: { x: 0, y: 0 },
    touchRun: false,
    /** Effective zoom after fitting the screen shape. */
    ze: 1.9,
  });
  const live = useRef({ paused, repairing, target, near: null as Interactable | null, onInteract, onMoved });
  live.current = { ...live.current, paused, repairing, target, onInteract, onMoved };

  // Reset on scene change / teleport.
  useEffect(() => {
    const s = st.current;
    Object.assign(s, { x: spawn.x, y: spawn.y, z: 0, vx: 0, vy: 0, vz: 0, goal: null, camX: spawn.x, camY: spawn.y, zoom: scene === 'outside' ? 1.9 : 1.15 });
  }, [spawn.key, spawn.x, spawn.y, scene]);

  // Keyboard
  useEffect(() => {
    const s = st.current;
    const isTyping = (e: KeyboardEvent) => (e.target as HTMLElement)?.closest?.('input, textarea, select, [role="dialog"]');
    const down = (e: KeyboardEvent) => {
      if (live.current.paused || isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        s.keys.add(k);
        s.goal = null;
        if (k.startsWith('arrow')) e.preventDefault();
      }
      if (k === ' ' && s.z === 0) {
        e.preventDefault();
        s.vz = (world.surface ? MOVE.surface : MOVE.inside).jumpV;
      }
      if (k === 'e' && live.current.near) {
        s.interactUntil = performance.now() + 700;
        live.current.onInteract(live.current.near);
      }
    };
    const up = (e: KeyboardEvent) => s.keys.delete(e.key.toLowerCase());
    const blur = () => s.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [world.surface]);

  useEffect(() => {
    if (paused) st.current.keys.clear();
  }, [paused]);

  // Main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const s = st.current;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const L = live.current;
      const m = world.surface ? MOVE.surface : MOVE.inside;
      const k = s.keys;
      let ix = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      let iy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
      let mag = 1;
      const jm = Math.hypot(s.joy.x, s.joy.y);
      if (!ix && !iy && jm > 0.15) {
        ix = s.joy.x;
        iy = s.joy.y;
        mag = Math.min(1, jm);
        s.goal = null;
      }
      if (!ix && !iy && s.goal) {
        const dx = s.goal.x - s.x;
        const dy = s.goal.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) s.goal = null;
        else {
          ix = dx / d;
          iy = dy / d;
        }
      }
      if (L.paused) ix = iy = 0;
      const len = Math.hypot(ix, iy) || 1;
      const running = k.has('shift') || s.touchRun || jm > 0.95;
      const speed = running ? m.run : m.walk;
      const tvx = (ix / len) * speed * mag;
      const tvy = (iy / len) * speed * mag * 0.7; // depth moves look slower
      const a = 1 - Math.exp(-m.accel * dt * (s.z > 0 ? 0.35 : 1)); // little air control
      s.vx += (tvx - s.vx) * a;
      s.vy += (tvy - s.vy) * a;
      const px = s.x;
      const py = s.y;
      const nx = s.x + s.vx * dt;
      const ny = s.y + s.vy * dt;
      if (!blocked(world, nx, s.y)) s.x = nx;
      else s.vx = 0;
      if (!blocked(world, s.x, ny)) s.y = ny;
      else s.vy = 0;
      // Walking into an obstacle: slide sideways around it instead of stopping dead.
      if ((ix || iy) && s.x === px && s.y === py) {
        const step = speed * dt;
        for (const side of [1, -1]) {
          const sx = s.x + (-iy / len) * step * side;
          const sy = s.y + (ix / len) * step * side * 0.7;
          if (!blocked(world, sx, sy)) {
            s.x = sx;
            s.y = sy;
            break;
          }
        }
      }
      // Give up a click-to-walk goal only after being blocked for a moment.
      const movedDist = Math.hypot(s.x - px, s.y - py);
      s.stuck = s.goal && movedDist < 0.3 ? s.stuck + dt : 0;
      if (s.stuck > 0.35) s.goal = null;
      // Jump physics
      if (s.z > 0 || s.vz > 0) {
        s.vz -= m.gravity * dt;
        s.z = Math.max(0, s.z + s.vz * dt);
        if (s.z === 0) s.vz = 0;
      }
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 4) {
        if (Math.abs(s.vx) > 3) s.facing = s.vx > 0 ? 1 : -1;
        s.phase += dt * sp * (world.surface ? 0.055 : 0.075);
        if (!s.moved) {
          s.moved = true;
          L.onMoved();
        }
      }
      const pose: Pose = L.repairing ? 'repair' : s.z > 0 ? 'jump' : now < s.interactUntil ? 'interact' : sp > 150 ? 'run' : sp > 12 ? 'walk' : 'idle';

      // Draw astronaut
      const sc = depthScale(world, s.y);
      astro.root.current?.setAttribute('transform', `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) scale(${sc.toFixed(3)})`);
      astro.flip.current?.setAttribute('transform', `translate(0 ${(-s.z / sc).toFixed(1)}) scale(${s.facing} 1)`);
      if (astro.shadow.current) {
        const f = 1 - Math.min(0.6, s.z / 160);
        astro.shadow.current.setAttribute('rx', (18 * f).toFixed(1));
        astro.shadow.current.setAttribute('opacity', (0.45 * f).toFixed(2));
      }
      applyPose(astro, pose, now / 1000, s.phase, world.surface);

      // Camera follow (smooth), with mouse look offset, clamped to the scene.
      const host = hostRef.current;
      const cw = host?.clientWidth || window.innerWidth;
      const ch = host?.clientHeight || window.innerHeight;
      const S = Math.max(cw / 1600, ch / 900); // "cover" fit of the 1600×900 scene
      const fw = Math.min(1, cw / ch / (16 / 9)); // visible share of the scene width at zoom 1
      const z = Math.max(1, s.zoom * fw ** 0.45); // zoom out a little on tall screens
      s.ze = z;
      const px2 = S * z; // scene units → CSS pixels
      const lead = s.vx * 0.35;
      const wantX = s.x + lead + s.look.x;
      const wantY = s.y - 70 + s.look.y;
      const c = 1 - Math.exp(-4 * dt);
      s.camX += (wantX - s.camX) * c;
      s.camY += (wantY - s.camY) * c;
      const hw = Math.min(800, cw / (2 * px2));
      const hh = Math.min(450, ch / (2 * px2));
      s.camX = Math.min(Math.max(s.camX, hw), 1600 - hw);
      s.camY = Math.min(Math.max(s.camY, hh), 900 - hh);
      const layer = layerRef.current;
      if (layer) {
        const lw = Math.round(1600 * px2);
        const lh = Math.round(900 * px2);
        if (layerSize.current.w !== lw || layerSize.current.h !== lh) {
          // Only on zoom/resize: re-rasterize at the new size so it stays sharp.
          layerSize.current = { w: lw, h: lh };
          layer.style.width = `${lw}px`;
          layer.style.height = `${lh}px`;
        }
        const tx = cw / 2 - s.camX * px2;
        const ty = ch / 2 - s.camY * px2;
        layer.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
        const r = host?.getBoundingClientRect();
        cam.current = { tx, ty, k: px2, left: r?.left ?? 0, top: r?.top ?? 0 };
      }

      // Nearby interactable
      const n = nearestSpot(world, s.x, s.y);
      if (n?.id !== L.near?.id) {
        L.near = n;
        setNear(n);
      }

      // Project helpers (scene → screen pixels)
      const project = (wx: number, wy: number) => {
        const cm = cam.current;
        return { x: cm.left + cm.tx + wx * cm.k, y: cm.top + cm.ty + wy * cm.k };
      };
      if (promptRef.current && n) {
        const p = project(s.x, s.y - 86 * sc - s.z);
        if (p) promptRef.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      }
      // Off-screen guidance arrow
      const arrow = arrowRef.current;
      if (arrow) {
        const tg = L.target;
        const p = tg ? project(tg.x, tg.y - 30) : null;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const off = p && (p.x < 40 || p.x > w - 40 || p.y < 90 || p.y > h - 90);
        if (p && off) {
          const cx = w / 2;
          const cy = h / 2;
          const ang = Math.atan2(p.y - cy, p.x - cx);
          const r = Math.min(w / 2 - 70, h / 2 - 110);
          arrow.style.opacity = '1';
          arrow.style.transform = `translate(${cx + Math.cos(ang) * r}px, ${cy + Math.sin(ang) * r}px) translate(-50%, -50%) rotate(${(ang * 180) / Math.PI + 45}deg)`;
        } else arrow.style.opacity = '0';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, astro]);

  // Mouse: drag to look around, click to walk, wheel to zoom.
  const drag = useRef<{ x: number; y: number; lx: number; ly: number; moved: boolean } | null>(null);
  const toScene = (clientX: number, clientY: number) => {
    const cm = cam.current;
    return { x: (clientX - cm.left - cm.tx) / cm.k, y: (clientY - cm.top - cm.ty) / cm.k };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (paused) return;
    drag.current = { x: e.clientX, y: e.clientY, lx: st.current.look.x, ly: st.current.look.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !(e.buttons & 1)) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 6) d.moved = true;
    if (d.moved) {
      st.current.look.x = Math.max(-260, Math.min(260, d.lx - dx * 0.6));
      st.current.look.y = Math.max(-140, Math.min(140, d.ly - dy * 0.6));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || paused) return;
    if (d.moved) {
      // Ease the view back to the astronaut.
      const s = st.current;
      const back = () => {
        s.look.x *= 0.85;
        s.look.y *= 0.85;
        if (Math.hypot(s.look.x, s.look.y) > 1 && !drag.current) requestAnimationFrame(back);
        else if (!drag.current) s.look = { x: 0, y: 0 };
      };
      setTimeout(back, 900);
      return;
    }
    const p = toScene(e.clientX, e.clientY);
    if (!p) return;
    const b = world.bounds;
    st.current.goal = { x: Math.min(b.x2, Math.max(b.x1, p.x)), y: Math.min(b.y2, Math.max(b.y1, p.y)) };
  };
  const onWheel = (e: React.WheelEvent) => {
    const s = st.current;
    const lo = scene === 'outside' ? 1.35 : 1;
    const hi = scene === 'outside' ? 2.6 : 1.5;
    s.zoom = Math.min(hi, Math.max(lo, s.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
  };

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      role="application"
      aria-label={t('adv.controlsAria')}
    >
      <div ref={layerRef} className="absolute left-0 top-0" style={{ width: 1600, height: 900, willChange: 'transform' }}>
        {/* Static world: repainted only when the station state changes */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
          <Defs ghGlow={PROFILE_GLOW[game.ctl.lightProfile]} />
          {scene === 'outside' ? (
            <WorldContents game={game} reduceMotion={reduceMotion || lite} npcAstronaut={false}>
              {world.spots
                .filter((s) => s.bonus && !game.marks.includes(`disc:${s.id}`))
                .map((s) => (
                  <circle key={s.id} cx={s.x} cy={s.y - 14} r={3.5} fill="#F3BE78" opacity={0.9} />
                ))}
            </WorldContents>
          ) : (
            <HabitatInterior game={game} reduceMotion={reduceMotion || lite} />
          )}
        </svg>
        {/* Moving things: astronaut and objective beacon */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
          <Beacon target={target} />
          <AstronautFigure refs={astro} suit={scene === 'outside'} />
        </svg>
      </div>

      {/* Contextual [E] prompt – also clickable for mouse / touch players */}
      <button
        ref={promptRef}
        onClick={() => near && (st.current.interactUntil = performance.now() + 700, onInteract(near))}
        className={`pointer-events-auto fixed left-0 top-0 z-10 flex items-center gap-2 rounded-full border border-o2/50 bg-[#0b1f33]/90 py-1.5 pe-3.5 ps-1.5 text-[13.5px] font-semibold text-ink shadow-lg backdrop-blur transition-opacity ${near && !paused ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <kbd className="grid h-6 w-6 place-items-center rounded-md bg-o2 text-[12px] font-bold text-space" dir="ltr">
          E
        </kbd>
        {near ? t(near.prompt) : ''}
      </button>

      {vp.touch && (
        <TouchControls
          compact={vp.compact}
          canUse={!!near && !paused}
          onJoy={(x, y) => (st.current.joy = { x, y })}
          onRun={(on) => (st.current.touchRun = on)}
          onJump={() => {
            const s = st.current;
            if (!paused && s.z === 0) s.vz = (world.surface ? MOVE.surface : MOVE.inside).jumpV;
          }}
          onUse={() => {
            if (near && !paused) {
              st.current.interactUntil = performance.now() + 700;
              onInteract(near);
            }
          }}
          labels={{ use: near ? t(near.prompt) : t('adv.k.use'), jump: t('adv.k.jump'), run: t('adv.k.run'), stick: t('adv.k.move') }}
        />
      )}

      {/* Guidance arrow when the objective is off-screen */}
      <div ref={arrowRef} className="pointer-events-none fixed left-0 top-0 z-10 opacity-0 transition-opacity">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-warm text-space shadow-[0_0_20px_rgba(243,190,120,.6)]">
          <Navigation size={20} fill="currentColor" />
        </div>
      </div>
    </div>
  );
}

function Beacon({ target }: { target: { x: number; y: number } | null }) {
  const reduceMotion = useGame((g) => g.reduceMotion);
  if (!target) return null;
  return (
    <g transform={`translate(${target.x} ${target.y})`} pointerEvents="none">
      <ellipse rx={34} ry={10} fill="none" stroke="#F3BE78" strokeWidth={2.5} className={reduceMotion ? '' : 'beacon-ring'} />
      <ellipse rx={20} ry={6} fill="#F3BE78" opacity={0.25} />
      <g className={reduceMotion ? '' : 'beacon-bob'}>
        <path d="M-9 -92 L 9 -92 L 0 -78 Z" fill="#F3BE78" />
        <circle cy={-100} r={5} fill="#F3BE78" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* On-screen controls for phones and tablets                            */
/* ------------------------------------------------------------------ */
function TouchControls({
  compact,
  canUse,
  onJoy,
  onRun,
  onJump,
  onUse,
  labels,
}: {
  compact: boolean;
  canUse: boolean;
  onJoy: (x: number, y: number) => void;
  onRun: (on: boolean) => void;
  onJump: () => void;
  onUse: () => void;
  labels: { use: string; jump: string; run: string; stick: string };
}) {
  const size = compact ? 112 : 136;
  const knob = useRef<HTMLDivElement | null>(null);
  const base = useRef<HTMLDivElement | null>(null);
  const active = useRef<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    const max = size / 2;
    let dx = e.clientX - (r.left + max);
    let dy = e.clientY - (r.top + max);
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    onJoy(dx / max, dy / max);
  };
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)';
    onJoy(0, 0);
  };
  const btn = 'pointer-events-auto grid place-items-center rounded-full border border-white/15 bg-[#0b1f33]/75 text-ink shadow-lg backdrop-blur active:scale-95 select-none';
  return (
    <div dir="ltr" className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex items-end justify-between" style={{ padding: 'max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))' }}>
      <div
        ref={base}
        role="application"
        aria-label={labels.stick}
        className="pointer-events-auto relative touch-none rounded-full border border-white/15 bg-white/[0.06] backdrop-blur"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          active.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* some browsers refuse capture for synthetic pointers */
          }
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={knob} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full bg-o2/80 shadow-[0_0_20px_rgba(64,199,182,.5)] transition-transform duration-75" />
      </div>
      <div className="flex items-end gap-3">
        <button
          className={`${btn} touch-none`}
          style={{ width: compact ? 52 : 60, height: compact ? 52 : 60 }}
          aria-label={labels.run}
          onPointerDown={() => onRun(true)}
          onPointerUp={() => onRun(false)}
          onPointerCancel={() => onRun(false)}
          onPointerLeave={() => onRun(false)}
        >
          <Zap size={20} className="text-energy" />
        </button>
        <div className="flex flex-col items-center gap-3">
          <button className={btn} style={{ width: compact ? 56 : 64, height: compact ? 56 : 64 }} aria-label={labels.jump} onPointerDown={onJump}>
            <ArrowBigUp size={24} />
          </button>
          <button
            className={`${btn} ${canUse ? 'border-o2 bg-o2 text-space shadow-[0_0_24px_rgba(64,199,182,.6)]' : 'opacity-50'}`}
            style={{ width: compact ? 72 : 84, height: compact ? 72 : 84 }}
            aria-label={labels.use}
            disabled={!canUse}
            onClick={onUse}
          >
            <Hand size={28} />
          </button>
        </div>
      </div>
    </div>
  );
}
