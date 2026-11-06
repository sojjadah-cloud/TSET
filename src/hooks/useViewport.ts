import { useEffect, useState } from 'react';

export interface Viewport {
  w: number;
  h: number;
  /** Phone-sized: narrow screens, or short landscape phones. */
  compact: boolean;
  portrait: boolean;
  /** Primary input is a finger (phones, tablets) – show on-screen controls. */
  touch: boolean;
}

function read(): Viewport {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // `?touch=1` forces on-screen controls (handy for touch laptops and testing).
  const forced = new URLSearchParams(window.location.search).get('touch');
  const touch = forced === '1' ? true : forced === '0' ? false : (window.matchMedia?.('(pointer: coarse)').matches ?? false);
  return { w, h, compact: w < 768 || h < 520, portrait: h > w, touch };
}

export function useViewport() {
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    const mq = window.matchMedia?.('(pointer: coarse)');
    mq?.addEventListener?.('change', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      mq?.removeEventListener?.('change', on);
    };
  }, []);
  return v;
}
