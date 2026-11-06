import { ar } from './ar';
import { en, type TKey } from './en';
import { advAr } from './adv.ar';
import { advEn } from './adv.en';
import type { Lang, Msg } from '../sim/types';
import { useGame } from '../store/gameStore';

export const translations = { ar: { ...ar, ...advAr }, en: { ...en, ...advEn } } as const;
export type { TKey };

export function translate(lang: Lang, key: string, params?: Record<string, string | number>) {
  const dict = translations[lang] as Record<string, string>;
  let s = dict[key] ?? (translations.en as Record<string, string>)[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT() {
  const lang = useGame((g) => g.lang);
  const t = (key: TKey | string, params?: Record<string, string | number>) => translate(lang, key, params);
  const tm = (m: Msg) => translate(lang, m.key, m.params);
  const num = (v: number, d = 1) => v.toLocaleString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  return { t, tm, lang, num, dir: lang === 'ar' ? 'rtl' : 'ltr' } as const;
}
