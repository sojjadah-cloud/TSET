import { useRef, type MutableRefObject } from 'react';

export interface AstroRefs {
  root: MutableRefObject<SVGGElement | null>;
  flip: MutableRefObject<SVGGElement | null>;
  body: MutableRefObject<SVGGElement | null>;
  legL: MutableRefObject<SVGGElement | null>;
  legR: MutableRefObject<SVGGElement | null>;
  armL: MutableRefObject<SVGGElement | null>;
  armR: MutableRefObject<SVGGElement | null>;
  tool: MutableRefObject<SVGGElement | null>;
  shadow: MutableRefObject<SVGEllipseElement | null>;
}

export function useAstroRefs(): AstroRefs {
  return {
    root: useRef(null),
    flip: useRef(null),
    body: useRef(null),
    legL: useRef(null),
    legR: useRef(null),
    armL: useRef(null),
    armR: useRef(null),
    tool: useRef(null),
    shadow: useRef(null),
  };
}

export type Pose = 'idle' | 'walk' | 'run' | 'jump' | 'interact' | 'repair';

/** Poses the limbs for the current frame. `t` is seconds, `phase` the gait cycle. */
export function applyPose(r: AstroRefs, pose: Pose, t: number, phase: number, surface: boolean) {
  const set = (el: SVGGElement | null, v: string) => el && el.setAttribute('transform', v);
  let leg = 0;
  let arm = 0;
  let bob = 0;
  let armFwd = 0;
  let lean = 0;
  if (pose === 'walk' || pose === 'run') {
    const amp = pose === 'run' ? 34 : 24;
    leg = Math.sin(phase) * amp;
    arm = -Math.sin(phase) * amp * 0.8;
    // Low gravity: a bouncier lope on the surface.
    bob = -Math.abs(Math.sin(phase)) * (surface ? (pose === 'run' ? 6 : 4) : 2);
    lean = pose === 'run' ? 6 : 3;
  } else if (pose === 'jump') {
    leg = 18;
    arm = -40;
  } else if (pose === 'interact') {
    armFwd = -70;
    bob = Math.sin(t * 2) * 0.6;
  } else if (pose === 'repair') {
    armFwd = -60 + Math.sin(t * 12) * 18;
    bob = Math.sin(t * 6) * 0.8;
  } else {
    bob = Math.sin(t * 2) * 0.9; // breathing
    arm = Math.sin(t * 2) * 2;
  }
  set(r.body.current, `translate(0 ${bob.toFixed(2)}) rotate(${lean} 0 -30)`);
  set(r.legL.current, `rotate(${(pose === 'jump' ? leg : leg).toFixed(1)} -4 -22)`);
  set(r.legR.current, `rotate(${(pose === 'jump' ? -leg * 0.4 : -leg).toFixed(1)} 4 -22)`);
  set(r.armL.current, `rotate(${(armFwd || arm).toFixed(1)} -9 -46)`);
  set(r.armR.current, `rotate(${(armFwd ? armFwd * 0.7 : -arm).toFixed(1)} 9 -46)`);
  if (r.tool.current) r.tool.current.style.opacity = pose === 'repair' ? '1' : '0';
}

/** Commander Noor, drawn with feet at the origin (≈72 units tall at scale 1). */
export function AstronautFigure({ refs, suit }: { refs: AstroRefs; suit: boolean }) {
  const suitMain = suit ? '#f4f2ee' : '#2f6f9a';
  const suitShade = suit ? '#d2cec8' : '#245678';
  return (
    <g ref={refs.root}>
      <ellipse ref={refs.shadow} cx={0} cy={0} rx={18} ry={5} fill="#0b1118" opacity={0.45} />
      <g ref={refs.flip}>
        <g ref={refs.body}>
          {/* back leg & arm */}
          <g ref={refs.legR}>
            <rect x={1} y={-24} width={8} height={22} rx={3.5} fill={suitShade} />
            <rect x={0} y={-5} width={11} height={6} rx={2.5} fill={suit ? '#9aa1a8' : '#1d2a36'} />
          </g>
          <g ref={refs.armR}>
            <rect x={7} y={-48} width={7} height={20} rx={3.5} fill={suitShade} />
            <circle cx={10.5} cy={-28} r={3.6} fill={suit ? '#c9c4be' : '#e0b48a'} />
          </g>
          {/* backpack (life support) */}
          {suit && <rect x={-16} y={-54} width={10} height={24} rx={3} fill="#d8d4ce" stroke="#b9b4ae" strokeWidth={0.8} />}
          {/* torso */}
          <rect x={-9} y={-52} width={19} height={30} rx={8} fill={suitMain} />
          {suit ? (
            <>
              <rect x={-4} y={-44} width={10} height={6} rx={1.5} fill="#5d6876" />
              <circle cx={-1} cy={-41} r={1} fill="#40C7B6" />
              <circle cx={3} cy={-41} r={1} fill="#F37B62" />
              <rect x={-9} y={-30} width={19} height={3} fill="#F2B84B" opacity={0.9} />
            </>
          ) : (
            <>
              <rect x={-9} y={-32} width={19} height={3} fill="#1d4b68" />
              <circle cx={4} cy={-44} r={2} fill="#F3BE78" />
            </>
          )}
          {/* front leg */}
          <g ref={refs.legL}>
            <rect x={-8} y={-24} width={8} height={22} rx={3.5} fill={suitMain} />
            <rect x={-9} y={-5} width={11} height={6} rx={2.5} fill={suit ? '#aeb4ba' : '#22303c'} />
          </g>
          {/* head */}
          {suit ? (
            <g>
              <circle cx={1} cy={-62} r={11.5} fill="#f7f5f1" stroke="#d2cec8" strokeWidth={1} />
              <path d="M-3 -66 a 9 7.5 0 0 1 15 0 v 5 a 9 6.5 0 0 1 -15 0 Z" fill="#d59a4e" />
              <path d="M-0.5 -66 a 5 3.5 0 0 1 7 -1.5" stroke="#fff4dd" strokeWidth={1.6} fill="none" opacity={0.85} />
            </g>
          ) : (
            <g>
              <circle cx={1} cy={-62} r={9} fill="#e0b48a" />
              <path d="M-8 -64 C -8 -74, 10 -76, 10 -64 C 6 -69, -2 -70, -8 -64 Z" fill="#2a1d17" />
              <circle cx={6} cy={-62} r={1.2} fill="#1a1410" />
              <path d="M5 -58 q 2 1.5 4 0" stroke="#8a5a40" strokeWidth={1} fill="none" />
            </g>
          )}
          {/* front arm + tool */}
          <g ref={refs.armL}>
            <rect x={-13} y={-48} width={7} height={20} rx={3.5} fill={suitMain} />
            <circle cx={-9.5} cy={-28} r={3.8} fill={suit ? '#d9d5cf' : '#e0b48a'} />
            <g ref={refs.tool} style={{ opacity: 0 }}>
              <rect x={-11} y={-30} width={3} height={14} rx={1} fill="#9aa1a8" />
              <circle cx={-9.5} cy={-16} r={3} fill="none" stroke="#9aa1a8" strokeWidth={2} />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}
