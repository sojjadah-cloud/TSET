import { BatteryCharging, Sun, Zap } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BALANCE, SIM_ASSUMPTIONS as S } from '../../config/science';
import { useT } from '../../i18n';
import { has } from '../../sim/missions';
import { computeRates } from '../../sim/rates';
import type { CommsMode, GameState } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { AnimatedNumber, Bar, Card, COLORS, Formula, Learn, Ring, Segmented, Slider, Stat, Toggle } from '../ui/primitives';
import { SystemShell } from './SystemShell';

export function EnergyPanel({ game }: { game: GameState }) {
  const { t, num } = useT();
  const dispatch = useGame((g) => g.dispatch);
  const r = computeRates(game, { spe: has(game, 'spe') });
  const cap = BALANCE.capacity.batteryKWh;
  const pct = (game.res.batteryKWh / cap) * 100;
  const next = Math.max(0, Math.min(cap, game.res.batteryKWh + r.netKWh));
  const history = [
    ...game.reports.map((rep) => ({ d: `${rep.day}`, kwh: +rep.before.batteryKWh.toFixed(2) })),
    { d: `${game.day}`, kwh: +game.res.batteryKWh.toFixed(2) },
    { d: `${game.day}→`, kwh: +next.toFixed(2) },
  ];
  const maxLoad = Math.max(...Object.values(r.loads), 0.1);

  return (
    <SystemShell id="energy" game={game} icon={<Zap size={20} />}>
      <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-4">
          <Ring value={pct} color={pct < 25 ? COLORS.critical : COLORS.energy} size={110} stroke={9}>
            <div className="text-center leading-tight">
              <BatteryCharging size={18} className="mx-auto mb-0.5 text-energy" />
              <div className="text-[20px] font-bold">
                <AnimatedNumber value={pct} suffix="%" />
              </div>
              <div className="num text-[11px] text-muted">
                {num(game.res.batteryKWh, 2)} / {cap} kWh
              </div>
            </div>
          </Ring>
          <div className="grid gap-3">
            <Stat label={t('en.solar')} value={<AnimatedNumber value={r.solarKWh} digits={2} />} unit="kWh" color={COLORS.energy} />
            <Stat label={t('en.load')} value={<AnimatedNumber value={r.loadKWh} digits={2} />} unit="kWh" />
            <Stat label={t('en.net')} value={<AnimatedNumber value={r.netKWh + 0} digits={2} />} unit="kWh" color={r.netKWh >= 0 ? COLORS.oxygen : COLORS.critical} />
          </div>
        </Card>
        <Card title={t('en.chart')}>
          <div className="h-[150px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="bat" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#F2B84B" stopOpacity={0.5} />
                    <stop offset="1" stopColor="#F2B84B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" stroke="#6f8399" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis domain={[0, cap]} stroke="#6f8399" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#10283E', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [`${v} kWh`, t('en.battery')]} />
                <Area type="monotone" dataKey="kwh" stroke="#F2B84B" strokeWidth={2} fill="url(#bat)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title={t('en.priorities')} icon={<Zap size={15} className="text-energy" />}>
          {(Object.keys(r.loads) as (keyof typeof r.loads)[]).map((k) => (
            <div key={k} className="mt-2.5">
              <div className="mb-1 flex justify-between text-[12.5px]">
                <span className="text-ink/75">{t(`en.load.${k}`)}</span>
                <span className="num font-semibold text-energy">{num(r.loads[k], 2)} kWh</span>
              </div>
              <Bar value={(r.loads[k] / maxLoad) * 100} color={k === 'lifeSupport' ? COLORS.oxygen : COLORS.energy} h={6} />
            </div>
          ))}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-[12.5px]">
            <span className="flex items-center gap-2 text-ink/80">
              <Sun size={14} className="text-energy" />
              {t('en.panelEff')}
            </span>
            <span className="num font-semibold" style={{ color: game.sys.solarEff < 0.85 ? COLORS.warning : COLORS.oxygen }}>
              {Math.round(game.sys.solarEff * 100)}%
            </span>
          </div>
        </Card>

        <Card title={t('common.status')}>
          <div className="space-y-4">
            <Slider label={t('ls.power')} value={game.ctl.lifeSupportPower} min={60} max={100} step={5} onChange={(v) => dispatch({ type: 'setCtl', key: 'lifeSupportPower', value: v })} format={(v) => `${v}%`} color={COLORS.oxygen} />
            <Slider label={t('gh.light')} value={game.ctl.lightIntensity} min={0} max={100} step={5} onChange={(v) => dispatch({ type: 'setCtl', key: 'lightIntensity', value: v })} format={(v) => `${v}%`} color={COLORS.energy} />
            <Segmented<CommsMode>
              label={t('en.commsMode')}
              value={game.ctl.commsMode}
              onChange={(v) => dispatch({ type: 'setCtl', key: 'commsMode', value: v })}
              options={(['low', 'standard', 'boost'] as const).map((id) => ({ id, label: t(`en.mode.${id}`) }))}
            />
            <Toggle
              label={t('en.backup')}
              checked={game.sys.backupPower}
              onChange={() => dispatch({ type: 'toggleBackupPower' })}
              disabled={!game.sys.backupPower && game.res.backupFuelKWh < 1.5}
              sub={`+1.5 kWh${t('common.perDay')} · ${t('en.backupFuel', { kwh: num(game.res.backupFuelKWh, 1) })}`}
            />
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Formula>Energy (kWh) = Power (kW) × Time (h)</Formula>
          <Formula>
            {num(S.solarAvgKW, 2)} kW × 24 h × {Math.round(game.sys.solarEff * 100)}% = {num(r.solarKWh, 2)} kWh
          </Formula>
          <Formula>
            Battery = {num(game.res.batteryKWh, 2)} + {num(r.solarKWh + r.backupKWh, 2)} − {num(r.loadKWh, 2)} = {num(game.res.batteryKWh + r.netKWh, 2)} kWh
          </Formula>
        </div>
        <Learn kind="sim">{t('en.learn')}</Learn>
      </div>
    </SystemShell>
  );
}
