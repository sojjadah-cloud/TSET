import { ChevronDown, ChevronUp, Radio, Satellite, Send, CheckCircle2, Clock } from 'lucide-react';
import { DERIVED, relayOneWayS } from '../../config/science';
import { useT } from '../../i18n';
import { commsBandwidth } from '../../sim/rates';
import type { CommsMode, GameState } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Card, COLORS, Formula, Learn, Pill, Segmented } from '../ui/primitives';
import { SystemShell } from './SystemShell';

const PCOLOR = { 1: COLORS.critical, 2: COLORS.energy, 3: COLORS.muted } as const;

export function CommsPanel({ game }: { game: GameState }) {
  const { t, num } = useT();
  const dispatch = useGame((g) => g.dispatch);
  const reduceMotion = useGame((g) => g.reduceMotion);
  const online = game.sys.relayOnline;
  const queued = game.messages.filter((m) => m.status === 'queued').sort((a, b) => a.priority - b.priority || a.day - b.day);
  const sent = game.messages.filter((m) => m.status === 'sent').sort((a, b) => (b.sentDay ?? 0) - (a.sentDay ?? 0));
  const cap = commsBandwidth[game.ctl.commsMode];
  const canReacquire = !online && game.resolvedEvents.includes('d5_comms');

  return (
    <SystemShell id="comms" game={game} icon={<Radio size={20} />}>
      <Card>
        <LinkDiagram online={online} reduceMotion={reduceMotion} />
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <div className="text-[11.5px] text-muted">{t('cm.link')}</div>
            <div className="mt-1">
              <Pill color={online ? COLORS.oxygen : COLORS.critical}>{online ? t('common.online') : t('common.offline')}</Pill>
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3">
            <div className="text-[11.5px] text-muted">{t('cm.direct')}</div>
            <div className="num mt-1 text-[15px] font-semibold">
              {num(DERIVED.directOneWayS, 2)} s · ⇄ {num(DERIVED.directRoundTripS, 2)} s
            </div>
          </div>
          <div className="col-span-2 rounded-xl bg-white/[0.04] p-3 lg:col-span-1">
            <div className="text-[11.5px] text-muted">{t('cm.relay')}</div>
            <div className="num mt-1 text-[15px] font-semibold text-o2">
              ≈ {num(relayOneWayS(), 2)} s · ⇄ {num(relayOneWayS() * 2, 2)} s
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Formula>t = d / c = 384,400 km / 299,792 km/s ≈ {num(DERIVED.directOneWayS, 2)} s</Formula>
        </div>
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Card
          title={`${t('cm.queue')} · ${queued.length} ${t('cm.waiting')}`}
          icon={<Clock size={15} className="text-energy" />}
          right={<span className="num text-[11.5px] text-muted">{t('cm.bandwidth', { used: game.bwUsed, cap })}</span>}
        >
          {!online && <div className="mb-2 rounded-lg bg-food/10 px-3 py-2 text-[12px] text-[#f8b2a2]">{t('cm.noLink')}</div>}
          <ul className="space-y-1.5">
            {queued.length === 0 && <li className="py-3 text-center text-[12.5px] text-muted">{t('cm.empty')}</li>}
            {queued.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PCOLOR[m.priority] }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{t(`cm.kind.${m.kind}`)}</div>
                  <div className="text-[11px] text-muted">
                    {t('common.day')} {m.day} · {t(`cm.p${m.priority}`)}
                  </div>
                </div>
                <button className="btn btn-ghost h-7 w-7 rounded-lg" aria-label={`${t('cm.priority')} +`} disabled={m.priority === 1} onClick={() => dispatch({ type: 'priority', id: m.id, delta: -1 })}>
                  <ChevronUp size={14} />
                </button>
                <button className="btn btn-ghost h-7 w-7 rounded-lg" aria-label={`${t('cm.priority')} −`} disabled={m.priority === 3} onClick={() => dispatch({ type: 'priority', id: m.id, delta: 1 })}>
                  <ChevronDown size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button className="btn btn-primary h-10 text-[13px]" disabled={!online || queued.length === 0 || game.bwUsed >= cap} onClick={() => dispatch({ type: 'transmit' })}>
              <Send size={15} />
              {t('cm.transmit')}
            </button>
            <button className="btn btn-teal h-10 text-[13px]" disabled={!canReacquire} onClick={() => dispatch({ type: 'reacquireRelay' })}>
              <Satellite size={15} />
              {t('cm.reacquire')}
            </button>
          </div>
        </Card>

        <div className="space-y-3">
          <Card>
            <Segmented<CommsMode>
              label={t('en.commsMode')}
              value={game.ctl.commsMode}
              onChange={(v) => dispatch({ type: 'setCtl', key: 'commsMode', value: v })}
              options={(['low', 'standard', 'boost'] as const).map((id) => ({ id, label: `${t(`en.mode.${id}`)} · ${commsBandwidth[id]}` }))}
            />
          </Card>
          <Card title={`${t('cm.sent')} · ${sent.length}`} icon={<CheckCircle2 size={15} className="text-o2" />}>
            <ul className="scroll-thin max-h-[170px] space-y-1 overflow-y-auto">
              {sent.map((m) => (
                <li key={m.id} className="flex justify-between text-[12px] text-ink/75">
                  <span className="truncate">{t(`cm.kind.${m.kind}`)}</span>
                  <span className="num text-muted">
                    {m.day}→{m.sentDay}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Learn kind="nasa">{t('cm.learn')}</Learn>
        </div>
      </div>
    </SystemShell>
  );
}

function LinkDiagram({ online, reduceMotion }: { online: boolean; reduceMotion: boolean }) {
  const { t } = useT();
  const c = online ? '#40C7B6' : '#F37B62';
  return (
    <svg viewBox="0 0 560 170" className="w-full" aria-label={t('cm.link')}>
      <defs>
        <radialGradient id="earthG" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#7cc6ff" />
          <stop offset="0.6" stopColor="#2a6fb5" />
          <stop offset="1" stopColor="#0b2647" />
        </radialGradient>
        <radialGradient id="moonG" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#e9e4de" />
          <stop offset="1" stopColor="#6d6863" />
        </radialGradient>
      </defs>
      {/* Earth */}
      <circle cx={70} cy={90} r={40} fill="url(#earthG)" />
      <path d="M50 75 q 10 -8 22 -2 q 6 10 -6 14 q -12 2 -16 -12z M78 100 q 10 -4 14 6 q -6 8 -14 -6z" fill="#5fae6a" opacity=".8" />
      <text x={70} y={152} textAnchor="middle" fill="#9fb0c2" fontSize="12">
        {t('cm.earth')}
      </text>
      {/* Moon (station on the far side, facing away from Earth) */}
      <circle cx={420} cy={92} r={46} fill="url(#moonG)" />
      <circle cx={468} cy={92} r={6} fill="#F3BE78" />
      <text x={420} y={156} textAnchor="middle" fill="#9fb0c2" fontSize="12">
        {t('cm.moon')}
      </text>
      <text x={486} y={80} fill="#F3BE78" fontSize="11">
        {t('cm.station')}
      </text>
      {/* Blocked direct path */}
      <line x1={112} y1={92} x2={372} y2={92} stroke="#9fb0c2" strokeOpacity=".2" strokeDasharray="3 6" />
      <text x={242} y={110} textAnchor="middle" fill="#6f8399" fontSize="10.5">
        ✕
      </text>
      {/* Relay satellite beyond the Moon */}
      <g transform="translate(510 26)">
        <rect x={-16} y={-3} width={11} height={6} fill="#2a4a78" />
        <rect x={5} y={-3} width={11} height={6} fill="#2a4a78" />
        <rect x={-5} y={-5} width={10} height={10} rx={2} fill="#d9d4cc" />
      </g>
      <text x={510} y={14} textAnchor="middle" fill="#9fb0c2" fontSize="11">
        {t('cm.satellite')}
      </text>
      <path d="M470 86 L 508 32" stroke={c} strokeWidth={2} strokeDasharray="4 6" className={online && !reduceMotion ? 'beam' : ''} />
      <path d="M500 26 C 380 -10, 180 10, 104 64" stroke={c} strokeWidth={2} fill="none" strokeDasharray="4 6" className={online && !reduceMotion ? 'beam' : ''} opacity={online ? 1 : 0.35} />
      {!online && (
        <g transform="translate(300 18)">
          <circle r={10} fill="#F37B62" opacity=".2" />
          <path d="M-4 -4 L 4 4 M 4 -4 L -4 4" stroke="#F37B62" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
}
