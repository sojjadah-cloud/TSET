import { Droplets, Lightbulb, Scissors, Sprout, Search } from 'lucide-react';
import { NASA_REFERENCE as N, SIM_ASSUMPTIONS as S } from '../../config/science';
import { useT } from '../../i18n';
import { has } from '../../sim/missions';
import { computeRates } from '../../sim/rates';
import type { GameState, LightProfile } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { AnimatedNumber, Card, COLORS, Learn, Ring, Segmented, Slider, Stat } from '../ui/primitives';
import { SystemShell } from './SystemShell';

export function GreenhousePanel({ game }: { game: GameState }) {
  const { t, num } = useT();
  const dispatch = useGame((g) => g.dispatch);
  const r = computeRates(game, { spe: has(game, 'spe') });
  const h = game.plants.health;
  const cond = h >= 85 ? 'great' : h >= 65 ? 'good' : h >= 40 ? 'weak' : 'bad';
  const condColor = h >= 65 ? COLORS.oxygen : h >= 40 ? COLORS.warning : COLORS.critical;
  const ratio = game.ctl.plantWaterL / S.plantWaterOptimalL;
  const waterHint = ratio < 0.85 ? 'low' : ratio <= 1.25 ? 'ok' : 'high';
  const harvestable = Math.max(0, game.plants.leavesG - 30);
  const inspected = has(game, 'diag:greenhouse');

  return (
    <SystemShell id="greenhouse" game={game} icon={<Sprout size={20} />}>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <div className="flex items-center gap-4">
            <Ring value={h} color={condColor} size={92} stroke={8}>
              <div className="text-center leading-tight">
                <div className="text-[20px] font-bold">
                  <AnimatedNumber value={h} />
                </div>
                <div className="text-[10.5px] text-muted">{t('gh.health')}</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-[17px] font-semibold" style={{ color: condColor }}>
                {t(`gh.cond.${cond}`)}
              </div>
              <div className="text-[12.5px] text-muted">
                {t('gh.trend', { v: `${r.plantHealthDelta >= 0 ? '+' : ''}${num(r.plantHealthDelta, 1)}` })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label={t('gh.leaves')} value={<AnimatedNumber value={game.plants.leavesG} />} unit="g" color="#8fdc8f" />
                <Stat label={t('gh.harvested')} value={<AnimatedNumber value={game.plants.harvestedG} />} unit="g" />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn btn-teal h-10 text-[12.5px]" onClick={() => dispatch({ type: 'flag', flag: 'diag:greenhouse' })}>
              <Search size={15} />
              {t('gh.inspect')}
            </button>
            <button className="btn btn-primary h-10 text-[12.5px]" disabled={harvestable < 20} onClick={() => dispatch({ type: 'harvest' })}>
              <Scissors size={15} />
              {t('gh.harvest')}
            </button>
          </div>
          {inspected && (
            <div className="mt-3 rounded-lg bg-o2/10 p-3 text-[12px] leading-relaxed text-ink/85">
              Mizuna (Brassica rapa var. japonica) · {t('gh.health')}: <b className="num">{Math.round(h)}</b> · {t('gh.leaves')}: <b className="num">{Math.round(game.plants.leavesG)} g</b> · +{num(r.leafGrowthG, 1)} g{t('common.perDay')}
            </div>
          )}
          <PhotoperiodDial />
        </Card>

        <Card title={t('gh.light')} icon={<Lightbulb size={15} className="text-energy" />}>
          <div className="space-y-4">
            <Slider label={t('gh.light')} value={game.ctl.lightIntensity} min={0} max={100} step={5} onChange={(v) => dispatch({ type: 'setCtl', key: 'lightIntensity', value: v })} format={(v) => `${v}%`} color={COLORS.energy} />
            <Segmented<LightProfile>
              label={t('gh.profile')}
              value={game.ctl.lightProfile}
              onChange={(v) => dispatch({ type: 'setCtl', key: 'lightProfile', value: v })}
              options={(['balanced', 'redRich', 'blueRich'] as const).map((id) => ({ id, label: t(`gh.profile.${id}`) }))}
            />
            <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px]">
              <span className="text-ink/75">{t('gh.energy')}</span>
              <span className="num font-semibold text-energy">{num(r.loads.greenhouse, 2)} kWh{t('common.perDay')}</span>
            </div>
            <Slider
              label={t('gh.water')}
              value={game.ctl.plantWaterL}
              min={0}
              max={1.5}
              step={0.05}
              onChange={(v) => dispatch({ type: 'setCtl', key: 'plantWaterL', value: v })}
              format={(v) => `${v.toFixed(2)} L`}
              color={COLORS.water}
              hint={
                <span className="flex items-center gap-1.5" style={{ color: waterHint === 'ok' ? COLORS.oxygen : COLORS.warning }}>
                  <Droplets size={12} />
                  {t(`gh.waterHint.${waterHint}`)}
                </span>
              }
            />
          </div>
        </Card>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Learn kind="nasa">{t('gh.learn')}</Learn>
        <Learn kind="sim">
          {t('gh.water')}: <span className="num">{S.plantWaterOptimalL} L</span> · {t('gh.leaves')}: <span className="num">≤ {S.leafGrowthGPerDay} g</span>
          {t('common.perDay')} · <span className="num">{S.leafGPerRationDay} g</span> = 1 {t('res.food')}
        </Learn>
      </div>
    </SystemShell>
  );
}

function PhotoperiodDial() {
  const { t } = useT();
  const L = N.photoperiodLightH;
  const D = N.photoperiodDarkH;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} stroke="#22384d" strokeWidth="8" fill="none" />
        <circle cx="32" cy="32" r={r} stroke="#e58bf0" strokeWidth="8" fill="none" strokeDasharray={`${(c * L) / 24} ${c}`} />
      </svg>
      <div className="text-[12.5px] text-ink/85">{t('gh.cycle', { l: L, d: D })}</div>
    </div>
  );
}
