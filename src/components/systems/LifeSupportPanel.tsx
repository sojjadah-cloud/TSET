import { Activity, Droplets, GlassWater, ShowerHead, Sprout, Wind, Wrench } from 'lucide-react';
import { BALANCE, NASA_REFERENCE as N, SIM_ASSUMPTIONS as S } from '../../config/science';
import { useT } from '../../i18n';
import { has, recyclerRepairCost } from '../../sim/missions';
import { computeRates } from '../../sim/rates';
import type { Activity as Act, GameState } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { AnimatedNumber, Bar, Card, COLORS, Formula, Learn, Segmented, Slider, Stat, Toggle } from '../ui/primitives';
import { SystemShell } from './SystemShell';

export function LifeSupportPanel({ game }: { game: GameState }) {
  const { t, num } = useT();
  const dispatch = useGame((g) => g.dispatch);
  const r = computeRates(game, { spe: has(game, 'spe') });
  const cost = recyclerRepairCost(game);
  const co2Pct = Math.min(100, (game.crew.co2 / 5) * 100);
  const co2Color = game.crew.co2 > N.co2ThresholdMmHg ? COLORS.critical : game.crew.co2 > 2.5 ? COLORS.warning : COLORS.oxygen;
  const daysLeft = r.waterNetL < 0 ? game.res.waterL / -r.waterNetL : Infinity;
  const showForecast = has(game, 'viewed:waterForecast');

  return (
    <SystemShell id="lifeSupport" game={game} icon={<Wind size={20} />}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <Stat label={t('ls.oxygen')} value={<AnimatedNumber value={game.res.oxygenKg} digits={2} />} unit="kg" color={COLORS.oxygen} sub={`${num(r.o2NetKg, 2)} kg${t('common.perDay')}`} />
        </Card>
        <Card>
          <Stat label={t('res.water')} value={<AnimatedNumber value={game.res.waterL} digits={1} />} unit="L" color={COLORS.water} sub={`${t('ls.reserve')}: ${num(game.res.reserveWaterL, 1)} L`} />
        </Card>
        <Card>
          <Stat label={t('res.co2')} value={<AnimatedNumber value={game.crew.co2} digits={2} />} unit="mmHg" color={co2Color} sub={t('ls.threshold', { v: N.co2ThresholdMmHg })} />
        </Card>
        <Card>
          <Stat label={t('res.parts')} value={<span className="num">{game.res.spareParts}</span>} color={COLORS.energy} sub={`${t('ls.backupFilter')}: ${game.res.backupCanisters}`} />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title={t('ls.oxygen')} icon={<Wind size={15} className="text-o2" />}>
          <Row label={t('ls.o2gen')} value={`+${num(r.o2GenKg, 2)} kg${t('common.perDay')}`} pct={(r.o2GenKg / 1.2) * 100} color={COLORS.oxygen} />
          <Row label={t('ls.o2use')} value={`−${num(r.o2UseKg, 3)} kg${t('common.perDay')}`} pct={(r.o2UseKg / 1.2) * 100} color={COLORS.food} />
          <div className="mt-3">
            <Learn kind="nasa">
              <span className="num">0.771</span> kg/day (rest) · <span className="num">1.083</span> kg/day (active). {t('ls.learn.o2')}
            </Learn>
          </div>
        </Card>

        <Card title={t('ls.water')} icon={<Droplets size={15} className="text-water" />}>
          <Row label={t('ls.recycler')} value={`${Math.round(game.sys.recyclerEff * 100)}%`} pct={game.sys.recyclerEff * 100} color={game.sys.recyclerEff < 0.7 ? COLORS.warning : COLORS.water} />
          <Row label={t('ls.wastewater')} value={`${num(r.wastewaterL, 2)} L`} pct={(r.wastewaterL / 4) * 100} color="#6f8aa3" />
          <Row label={t('ls.recovered')} value={`+${num(r.waterRecoveredL, 2)} L`} pct={(r.waterRecoveredL / 4) * 100} color={COLORS.water} />
          <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px] text-muted">
            {(
              [
                [GlassWater, r.waterUse.drink],
                [ShowerHead, r.waterUse.hygiene],
                [Wind, r.waterUse.electrolysis],
                [Sprout, r.waterUse.plants],
              ] as const
            ).map(([Icon, v], i) => (
              <div key={i} className="rounded-lg bg-white/[0.04] py-1.5">
                <Icon size={14} className="mx-auto mb-0.5 text-water" />
                <div className="num text-ink/85">{num(v, 2)} L</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Formula>
              recovered = ({N.drinkWaterLPerDay} × {S.drinkReturnFraction} + {num(r.waterUse.hygiene, 2)}) × {Math.round(game.sys.recyclerEff * 100)}% = {num(r.waterRecoveredL, 2)} L
            </Formula>
          </div>
          <button onClick={() => dispatch({ type: 'flag', flag: 'viewed:waterForecast' })} className="btn btn-ghost mt-3 h-9 w-full text-[12.5px]">
            {t('ls.forecast')}
          </button>
          {showForecast && (
            <div className="mt-2 rounded-lg bg-water/10 px-3 py-2 text-[12.5px] text-[#9fdcf2]">
              {Number.isFinite(daysLeft) ? t('ls.forecastText', { d: num(daysLeft, 1) }) : t('ls.forecastStable')}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title={t('ls.co2')} icon={<Activity size={15} className="text-food" />}>
          <div className="relative mt-1">
            <Bar value={co2Pct} color={co2Color} h={10} />
            <div className="absolute -top-1 h-4 w-0.5 bg-ink/70" style={{ insetInlineStart: `${(N.co2ThresholdMmHg / 5) * 100}%` }} title="3 mmHg" />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted" dir="ltr">
            <span>0</span>
            <span>3 mmHg</span>
            <span>5</span>
          </div>
          <Row label={t('ls.scrubber')} value={`${Math.round(game.sys.scrubberEff * 100)}%`} pct={game.sys.scrubberEff * 100} color={game.sys.scrubberEff < 0.7 ? COLORS.critical : COLORS.oxygen} />
          <div className="mt-3">
            <Learn kind="nasa">{t('ls.learn.co2')}</Learn>
          </div>
        </Card>

        <Card title={t('ls.activity')} icon={<Wrench size={15} className="text-energy" />}>
          <div className="space-y-4">
            <Segmented<Act>
              label={t('ls.activity')}
              value={game.ctl.activity}
              onChange={(v) => dispatch({ type: 'setCtl', key: 'activity', value: v })}
              options={(['rest', 'normal', 'active'] as const).map((id) => ({ id, label: t(`ls.activity.${id}`) }))}
            />
            <Slider label={t('ls.power')} value={game.ctl.lifeSupportPower} min={60} max={100} step={5} onChange={(v) => dispatch({ type: 'setCtl', key: 'lifeSupportPower', value: v })} format={(v) => `${v}%`} color={COLORS.oxygen} />
            <Toggle label={t('ls.waterSaving')} checked={game.sys.waterSaving} onChange={() => dispatch({ type: 'toggleWaterSaving' })} sub={`${t('res.water')}: ${num(N.hygieneWaterLPerDay * (game.sys.waterSaving ? 0.5 : 1), 2)} L${t('common.perDay')}`} />
            <Toggle label={t('ls.backupFilter')} checked={game.sys.backupFilter} onChange={() => dispatch({ type: 'toggleBackupFilter' })} disabled={!game.sys.backupFilter && game.res.backupCanisters < 1} sub={`×${game.res.backupCanisters} · +0.3 kWh${t('common.perDay')}`} />
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="btn btn-teal h-10 text-[12.5px]" disabled={game.sys.recyclerEff >= 0.8 || game.res.spareParts < cost} onClick={() => dispatch({ type: 'repairRecycler' })}>
                {t('ls.repairRecycler', { n: cost })}
              </button>
              <button className="btn btn-teal h-10 text-[12.5px]" disabled={game.sys.scrubberEff >= 0.8 || game.res.spareParts < 1} onClick={() => dispatch({ type: 'repairScrubber' })}>
                {t('ls.repairScrubber')}
              </button>
              <button className="btn btn-ghost h-10 text-[12.5px] sm:col-span-2" disabled={game.res.reserveWaterL <= 0 || game.res.waterL >= BALANCE.capacity.waterL} onClick={() => dispatch({ type: 'useReserve' })}>
                {t('ls.useReserve')}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-3">
        <Learn kind="sim">{t('ls.learn.water')}</Learn>
      </div>
    </SystemShell>
  );
}

export function Row({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex justify-between text-[12.5px]">
        <span className="text-ink/75">{label}</span>
        <span className="num font-semibold" style={{ color }}>
          {value}
        </span>
      </div>
      <Bar value={pct} color={color} h={6} />
    </div>
  );
}
