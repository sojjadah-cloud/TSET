import { motion } from 'framer-motion';
import { BookOpen, Languages, Play, RotateCcw, Settings } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../../i18n';
import { useGame } from '../../store/gameStore';
import { newGame } from '../../sim/engine';
import { StationScene } from '../scene/StationScene';
import { Logo } from '../hud/Hud';

const preview = newGame();

export function Welcome() {
  const { t } = useT();
  const game = useGame((g) => g.game);
  const lang = useGame((g) => g.lang);
  const setLang = useGame((g) => g.setLang);
  const startNew = useGame((g) => g.startNew);
  const resume = useGame((g) => g.resume);
  const setModal = useGame((g) => g.setModal);
  const [confirm, setConfirm] = useState(false);
  const hasSave = !!game;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <StationScene game={game ?? preview} focus={null} onSelect={() => {}} markers={false} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#040c18]/80 via-transparent to-[#040c18]/85" />
      <div dir="ltr" className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6">
        <Logo />
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="glass flex h-11 items-center gap-2 rounded-[14px] px-4 text-[13px] font-semibold">
          <Languages size={16} className="text-o2" />
          {t('lang.switch')}
        </button>
      </div>

      <div className="absolute inset-x-0 top-[14%] flex flex-col items-center px-6 text-center [@media(max-height:520px)]:top-[16%]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="font-display text-[clamp(40px,6vw,84px)] font-extrabold leading-none tracking-[0.12em] text-ink drop-shadow-[0_8px_30px_rgba(0,0,0,.6)]" dir="ltr">
            LUNAR STATION
          </div>
          <div className="mt-2 text-[clamp(24px,3vw,40px)] font-bold text-warm" dir="rtl" style={{ fontFamily: 'IBM Plex Sans Arabic, Tajawal, sans-serif' }}>
            المحطة القمرية
          </div>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink/85 [@media(max-height:520px)]:hidden">{t('welcome.tagline')}</p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }} className="absolute inset-x-0 bottom-[9%] flex justify-center px-4 [@media(max-height:520px)]:bottom-3">
        <div className="glass-strong flex w-full max-w-[460px] flex-col gap-2.5 rounded-[26px] p-5 [@media(max-height:520px)]:gap-1.5 [@media(max-height:520px)]:p-3">
          {hasSave && (
            <button className="btn btn-primary h-13 py-3.5 text-[16px]" onClick={resume}>
              <Play size={18} />
              {t('welcome.continue')}
              <span className="text-[12.5px] font-medium opacity-75">
                · {t('common.day')} {game!.day}
              </span>
            </button>
          )}
          {!confirm ? (
            <button className={`btn h-13 py-3.5 text-[16px] ${hasSave ? 'btn-ghost' : 'btn-primary'}`} onClick={() => (hasSave ? setConfirm(true) : startNew())}>
              {hasSave ? <RotateCcw size={18} /> : <Play size={18} />}
              {t('welcome.start')}
            </button>
          ) : (
            <div className="rounded-2xl bg-food/10 p-3 text-[13px]">
              <p className="text-ink/90">{t('welcome.confirmNew')}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primary h-10 flex-1" onClick={startNew}>
                  {t('welcome.start')}
                </button>
                <button className="btn btn-ghost h-10 flex-1" onClick={() => setConfirm(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button className="btn btn-ghost h-11 text-[14px]" onClick={() => setModal('how')}>
              <BookOpen size={16} />
              {t('welcome.how')}
            </button>
            <button className="btn btn-ghost h-11 text-[14px]" onClick={() => setModal('settings')}>
              <Settings size={16} />
              {t('welcome.settings')}
            </button>
          </div>
          <div className="mt-1 text-center text-[11.5px] text-muted">{t('brand.team')}</div>
        </div>
      </motion.div>
    </div>
  );
}
