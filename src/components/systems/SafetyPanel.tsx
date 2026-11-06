import { Activity, HeartPulse, Shield, ShieldCheck, Sun, Database, Footprints } from 'lucide-react';
import { useState } from 'react';
import { BALANCE } from '../../config/science';
import { useT } from '../../i18n';
import { has } from '../../sim/missions';
import { computeRates } from '../../sim/rates';
import type { GameState, Location } from '../../sim/types';
import { fetchRecentFlares, type FlareRecord } from '../../services/donki';
import { useGame } from '../../store/gameStore';
import { AnimatedNumber, Bar, Card, COLORS, Learn, Pill, Ring, Segmented, Toggle } from '../ui/primitives';
import { SystemShell } from './SystemShell';

export function SafetyPanel({ game }: { game: GameState }) {
  const { t, num } = useT();
  const dispatch = useGame((g) => g.dispatch);
  const spe = has(game, 'spe');
  const r = computeRates(game, { spe });
  const solar = game.day < 4 ? 'quiet' : spe ? 'storm' : game.day === 5 ? 'after' : 'quiet';
  const solarColor = solar === 'storm' ? COLORS.critical : solar === 'after' ? COLORS.warning : COLORS.oxygen;
  const reviewed = has(game, 'viewed:solar');
  const h = game.crew.health;
  const limit = BALANCE.radiationLimit;
  const evaBlocked = spe || game.ctl.location === 'shelter';

  return (
    <SystemShell id="safety" game={game} icon={<ShieldCheck size={20} />}>
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="flex items-center gap-4">
          <Ring value={h} color={h < 50 ? COLORS.critical : h < 75 ? COLORS.warning : COLORS.oxygen} size={86} stroke={8}>
            <HeartPulse size={20} className="text-food" />
          </Ring>
          <div>
            <div className="text-[11.5px] text-muted">{t('sf.health')}</div>
            <div className="text-[26px] font-bold">
              <AnimatedNumber value={h} suffix="%" />
            </div>
            <button className="btn btn-ghost mt-1 h-8 px-3 text-[12px]" onClick={() => dispatch({ type: 'medicalCheck' })}>
              <Activity size={14} />
              {t('sf.medical')}
            </button>
          </div>
        </Card>
        <Card className="lg:col-span-2" title={t('sf.exposure')} icon={<Shield size={15} className="text-energy" />}>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-bold">
              <AnimatedNumber value={game.crew.radiation} digits={1} />
            </span>
            <span className="text-[12px] text-muted">
              / {limit} {t('res.radiationUnits')}
            </span>
            <span className="ms-auto text-[12px] text-muted">
              {t('sf.today')}: <b className="num text-ink">+{num(r.radiationDose, 1)}</b>
            </span>
          </div>
          <div className="mt-2">
            <Bar value={(game.crew.radiation / limit) * 100} color={game.crew.radiation > limit * 0.6 ? COLORS.critical : COLORS.energy} h={8} />
          </div>
          <div className="mt-2 text-[11.5px] text-muted">{t('sf.exposureNote')}</div>
        </Card>
      </div>
      {has(game, 'medical') && (
        <div className="mt-3 rounded-xl bg-o2/10 px-4 py-2.5 text-[12.5px] text-[#9ff0e5]">
          {t('sf.medicalDone', { h: Math.round(h) })} · CO₂ <span className="num">{num(game.crew.co2, 2)}</span> mmHg · {t('sf.exposure')} <span className="num">{num(game.crew.radiation, 1)}</span>
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title={t('sf.solar')} icon={<Sun size={15} className="text-energy" />} right={<Pill color={solarColor}>{t(`sf.solar.${solar}`)}</Pill>}>
          <SolarMonitor storm={spe} day={game.day} />
          <button className="btn btn-teal mt-3 h-10 w-full text-[12.5px]" onClick={() => dispatch({ type: 'flag', flag: 'viewed:solar' })}>
            {t('sf.reviewSolar')}
          </button>
          {reviewed && (
            <div className="mt-2 rounded-lg bg-white/[0.05] px-3 py-2 text-[12px] text-ink/80">
              {t(`sf.solar.${solar}`)} · {t('sf.today')}: +{num(r.radiationDose, 1)} {t('res.radiationUnits')}
            </div>
          )}
        </Card>

        <Card title={t('sf.shelter')} icon={<ShieldCheck size={15} className="text-o2" />}>
          <div className="mb-1 flex justify-between text-[12.5px]">
            <span className="text-ink/75">{t('sf.shelter')}</span>
            <span className="num font-semibold" style={{ color: game.sys.shelterReadiness < 1 ? COLORS.warning : COLORS.oxygen }}>
              {Math.round(game.sys.shelterReadiness * 100)}%
            </span>
          </div>
          <Bar value={game.sys.shelterReadiness * 100} color={game.sys.shelterReadiness < 1 ? COLORS.warning : COLORS.oxygen} />
          <button className="btn btn-teal mt-3 h-10 w-full text-[12.5px]" onClick={() => dispatch({ type: 'inspectShelter' })}>
            {t('sf.inspectShelter')}
          </button>
          <div className="mt-4 space-y-3">
            <Segmented<Location>
              label={t('sf.location')}
              value={game.ctl.location}
              onChange={(v) => dispatch({ type: 'setCtl', key: 'location', value: v })}
              options={(['habitat', 'shelter'] as const).map((id) => ({ id, label: t(`sf.loc.${id}`) }))}
            />
            <Toggle
              label={t('sf.eva')}
              checked={game.ctl.evaAuthorized && !evaBlocked}
              disabled={evaBlocked}
              onChange={() => dispatch({ type: 'setCtl', key: 'evaAuthorized', value: !game.ctl.evaAuthorized })}
              sub={
                <span className="flex items-center gap-1">
                  <Footprints size={12} />
                  {game.ctl.evaAuthorized && !evaBlocked ? t('sf.evaAllowed') : t('sf.evaBlocked')}
                </span>
              }
            />
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DonkiCard />
        <Learn kind="nasa">{t('sf.learn')}</Learn>
      </div>
    </SystemShell>
  );
}

/** Simulated scenario curve (educational) – not a real measurement. */
function SolarMonitor({ storm, day }: { storm: boolean; day: number }) {
  const pts = Array.from({ length: 48 }, (_, i) => {
    const base = 18 + Math.sin(i * 0.7) * 3 + Math.sin(i * 1.9) * 2;
    const peak = storm ? Math.max(0, 70 * Math.exp(-((i - 30) ** 2) / 40)) : day === 5 ? Math.max(0, 22 * Math.exp(-((i - 4) ** 2) / 60)) : 0;
    return 100 - (base + peak);
  });
  const d = pts.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i / 47) * 300} ${y}`).join(' ');
  return (
    <svg viewBox="0 0 300 100" className="h-[100px] w-full" aria-hidden>
      <defs>
        <linearGradient id="solarFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={storm ? '#F37B62' : '#F2B84B'} stopOpacity=".45" />
          <stop offset="1" stopColor={storm ? '#F37B62' : '#F2B84B'} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((y) => (
        <line key={y} x1={0} x2={300} y1={y} y2={y} stroke="#fff" strokeOpacity=".06" />
      ))}
      <path d={`${d} L 300 100 L 0 100 Z`} fill="url(#solarFill)" />
      <path d={d} stroke={storm ? '#F37B62' : '#F2B84B'} strokeWidth={2} fill="none" />
    </svg>
  );
}

function DonkiCard() {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [flares, setFlares] = useState<FlareRecord[]>([]);
  const load = async () => {
    setState('loading');
    try {
      setFlares(await fetchRecentFlares());
      setState('done');
    } catch {
      setState('error');
    }
  };
  return (
    <Card title={t('sf.donki')} icon={<Database size={15} className="text-water" />}>
      <button className="btn btn-ghost h-9 w-full text-[12.5px]" onClick={load} disabled={state === 'loading'}>
        {state === 'loading' ? t('sf.donkiLoading') : t('sf.donkiFetch')}
      </button>
      {state === 'error' && <div className="mt-2 text-[12px] text-[#f8b2a2]">{t('sf.donkiError')}</div>}
      {state === 'done' && (
        <ul className="mt-2 space-y-1" dir="ltr">
          {flares.length === 0 && <li className="text-[12px] text-muted">{t('sf.donkiNone')}</li>}
          {flares.map((f) => (
            <li key={f.id} className="flex justify-between rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[12px]">
              <span className="font-semibold text-energy">{f.classType}</span>
              <span className="text-muted">{f.begin.replace('T', ' ').replace('Z', ' UTC')}</span>
              <span className="text-ink/70">{f.source ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-[11.5px] leading-relaxed text-muted">{t('sf.donkiNote')}</div>
    </Card>
  );
}
