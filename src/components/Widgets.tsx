import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { useAnimatedNumber, useNow } from '../lib/hooks';
import { fmtClock, timerRemaining } from '../lib/time';
import type { PollState, PublicState, TimerState, WheelState } from '../lib/types';
import { WHEEL_COLORS } from '../lib/content';
import { useBlip } from './StageKit';

export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const v = useAnimatedNumber(value, 900);
  return <span className={className}>{Math.round(v)}</span>;
}

/** Ranked list of teams with scores (handles any number of teams). */
export function useRanking(s: PublicState) {
  return useMemo(() => {
    const list = s.teams.map((t) => ({ ...t, score: s.scores[t.id] ?? 0 }));
    list.sort((a, b) => b.score - a.score);
    return list.map((t) => ({ ...t, rank: list.findIndex((x) => x.score === t.score) + 1 }));
  }, [s.teams, s.scores]);
}

// ───────────────────────── Stage score strip ─────────────────────────
export function StageScoreBar({ s, left }: { s: PublicState; left: string }) {
  const ranked = useRanking(s);
  const fx = s.fx?.kind === 'points' ? s.fx : null;
  const top = ranked[0]?.score ?? 0;
  const many = s.teams.length >= 5;
  const maxW = Math.floor(1520 / Math.max(1, s.teams.length)) - (many ? 70 : 100);
  return (
    <div className="absolute top-0 left-0 right-0 h-[96px] flex items-stretch z-30 bg-gradient-to-b from-black/85 to-black/40 border-b border-white/10">
      <div className="flex flex-col justify-center pl-8 pr-6 border-r border-white/10 w-[360px] shrink-0">
        <div className="font-display leading-[0.85] text-[24px] whitespace-nowrap">
          THE GREAT <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
        </div>
        <div className="font-condensed tracking-[0.2em] text-white/60 text-[19px] mt-1 whitespace-nowrap truncate">{left}</div>
      </div>
      <div className="flex-1 flex items-center justify-center gap-2 px-3 min-w-0">
        {s.teams.map((t) => {
          const score = s.scores[t.id] ?? 0;
          const leading = score === top && top > 0;
          const burst = fx && fx.team === t.id ? fx : null;
          return <ScoreChip key={t.id} name={t.name} score={score} leading={leading} burstId={burst?.id} delta={burst?.delta} compact={many} maxW={maxW} />;
        })}
      </div>
    </div>
  );
}

function ScoreChip({ name, score, leading, burstId, delta, compact, maxW }: { name: string; score: number; leading: boolean; burstId?: string; delta?: number; compact: boolean; maxW: number }) {
  const blip = useBlip(burstId);
  return (
    <div
      className={`relative flex items-center gap-2 rounded-xl px-3 py-2 border ${leading ? 'border-gold/70 bg-gold/10 shadow-[0_0_20px_rgba(247,215,116,0.35)]' : 'border-white/15 bg-white/5'}`}
    >
      <div className={`font-display uppercase ${compact ? 'text-[18px] leading-[1.05] line-clamp-2' : 'text-[24px] truncate'} ${leading ? 'text-gold' : 'text-white'}`} style={{ maxWidth: maxW }}>
        {leading && '★ '}
        {name}
      </div>
      <div className={`font-condensed tabular-nums leading-none ${compact ? 'text-[40px]' : 'text-[48px]'} ${blip ? 'text-gold glow-gold' : 'text-white'}`}>
        <AnimatedNumber value={score} />
      </div>
      {burstId && (
        <div key={burstId} className="absolute left-1/2 -translate-x-1/2 top-[70px] font-condensed text-[60px] text-gold glow-gold" style={{ animation: 'float-up 2.2s ease-out both' }}>
          {(delta ?? 0) > 0 ? '+' : ''}
          {delta}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Timer ─────────────────────────
export function BigTimer({ t, size = 360, showLabel = true }: { t: TimerState; size?: number; showLabel?: boolean }) {
  const at = useNow(t.status === 'running', 20);
  const rem = timerRemaining(t, at);
  const frac = t.totalMs > 0 ? rem / t.totalMs : 0;
  const done = rem <= 0 && (t.status === 'running' || t.status === 'paused');
  const urgent = rem > 0 && rem <= 10_000 && t.status === 'running';
  const color = t.side === 'for' ? '#3a8dff' : t.side === 'against' ? '#ff3a48' : '#f7d774';
  const r = size / 2 - 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      {showLabel && (
        <div className="font-condensed uppercase tracking-[0.25em] text-white/80 mb-3 text-center" style={{ fontSize: Math.max(18, size * 0.075) }}>
          {t.label}
        </div>
      )}
      <div className={`relative ${urgent ? 'anim-heartbeat' : ''}`} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={14} fill="rgba(0,0,0,0.55)" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={urgent || done ? '#ff3a48' : color}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
            style={{ filter: `drop-shadow(0 0 12px ${urgent || done ? '#ff3a48' : color})`, transition: t.status === 'running' ? 'none' : 'stroke-dashoffset 0.4s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {done ? (
            <div className="font-display text-ban-bright glow-red anim-slam" style={{ fontSize: size * 0.24 }}>
              TIME!
            </div>
          ) : (
            <div className={`font-condensed tabular-nums leading-none ${urgent ? 'text-ban-bright glow-red' : 'text-white glow-white'}`} style={{ fontSize: size * 0.4 }}>
              {fmtClock(rem)}
            </div>
          )}
          {t.status === 'paused' && !done && (
            <div className="font-condensed tracking-[0.3em] text-gold" style={{ fontSize: size * 0.06 }}>
              PAUSED
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Vote bars (FOR blue left / AGAINST red right) ─────────────────────────
export function VoteBars({ poll, big = true }: { poll: PollState; big?: boolean }) {
  const r = poll.results;
  if (!r) return null;
  const [a, b] = poll.options;
  if (!a || !b) return null;
  const total = r.total;
  const pa = total ? ((r.counts[a.id] ?? 0) / total) * 100 : 0;
  const pb = total ? ((r.counts[b.id] ?? 0) / total) * 100 : 0;
  return (
    <div className="w-full">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className={`font-condensed leading-none text-embrace-bright glow-blue tabular-nums ${big ? 'text-[120px]' : 'text-5xl'}`}>
            <AnimatedNumber value={Math.round(pa)} />%
          </div>
          <div className={`font-display uppercase ${big ? 'text-[30px]' : 'text-base'}`}>{a.label}</div>
          <div className={`text-white/60 ${big ? 'text-xl' : 'text-xs'}`}>{r.counts[a.id] ?? 0} votes</div>
        </div>
        <div className="text-right">
          <div className={`font-condensed leading-none text-ban-bright glow-red tabular-nums ${big ? 'text-[120px]' : 'text-5xl'}`}>
            <AnimatedNumber value={Math.round(pb)} />%
          </div>
          <div className={`font-display uppercase ${big ? 'text-[30px]' : 'text-base'}`}>{b.label}</div>
          <div className={`text-white/60 ${big ? 'text-xl' : 'text-xs'}`}>{r.counts[b.id] ?? 0} votes</div>
        </div>
      </div>
      <div className={`relative w-full ${big ? 'h-12' : 'h-6'} rounded-full overflow-hidden bg-white/10 flex border border-white/15`}>
        <div className="h-full transition-all duration-1000 ease-out sheen" style={{ width: `${pa}%`, background: 'linear-gradient(90deg,#0b3fa8,#1f7bff,#3fd2ff)' }} />
        <div className="h-full transition-all duration-1000 ease-out sheen ml-auto" style={{ width: `${pb}%`, background: 'linear-gradient(90deg,#ff5a4f,#ff2d3d,#a3101c)' }} />
        <div className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-white/70" />
      </div>
      {(r.simulatedTotal > 0 || r.manualTotal > 0) && (
        <div className={`mt-2 text-gold ${big ? 'text-[20px]' : 'text-xs'}`}>
          Includes {r.simulatedTotal ? `${r.simulatedTotal} simulated` : ''}
          {r.simulatedTotal && r.manualTotal ? ' + ' : ''}
          {r.manualTotal ? `${r.manualTotal} show-of-hands` : ''} votes
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Roulette wheel ─────────────────────────
const A = 0.1;
const T = A / 2 + (1 - A) / 3;
export function spinEase(k: number) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  if (k < A) return (k * k) / (2 * A) / T;
  const u = (1 - k) / (1 - A);
  return (A / 2 + ((1 - A) / 3) * (1 - u * u * u)) / T;
}
export function wheelAngle(w: WheelState, at: number) {
  if (w.status !== 'spinning') return w.toDeg;
  const k = (at - w.startedAt) / Math.max(1, w.durationMs);
  return w.fromDeg + (w.toDeg - w.fromDeg) * spinEase(k);
}

/** Wheel of numbered questions. Used ones are dimmed with a tick. */
export function Wheel({ count, used, angle, size = 860, highlight }: { count: number; used: boolean[]; angle: number; size?: number; highlight: number | null }) {
  const n = Math.max(1, count);
  const R = 430;
  const seg = 360 / n;
  const at = useNow(true, 4);
  const lightsOn = Math.floor(at / 350) % 2;
  const paths = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        if (n === 1) return `M0 ${-R} A${R} ${R} 0 1 1 -0.01 ${-R} Z`;
        const a0 = ((i * seg - 90) * Math.PI) / 180;
        const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
        const large = seg > 180 ? 1 : 0;
        return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
      }),
    [n, seg],
  );
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: -26 }}>
        <svg width="90" height="100" viewBox="0 0 90 100">
          <defs>
            <linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff6cf" />
              <stop offset="1" stopColor="#e0b13a" />
            </linearGradient>
          </defs>
          <path d="M45 98 L8 18 Q45 -6 82 18 Z" fill="url(#ptr)" stroke="#fff" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 14px rgba(247,215,116,0.95))' }} />
          <circle cx="45" cy="28" r="9" fill="#05060b" />
        </svg>
      </div>
      <svg viewBox="-460 -460 920 920" width={size} height={size} className="absolute inset-0">
        <defs>
          <radialGradient id="hub" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#22263a" />
            <stop offset="1" stopColor="#05060b" />
          </radialGradient>
          <radialGradient id="segshade" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
        </defs>
        <circle r="452" fill="#0a0c14" stroke="#f7d774" strokeWidth="6" style={{ filter: 'drop-shadow(0 0 22px rgba(247,215,116,0.55))' }} />
        <g transform={`rotate(${angle})`}>
          {Array.from({ length: n }, (_, i) => {
            let fill = WHEEL_COLORS[i % WHEEL_COLORS.length];
            if (n % 4 === 1 && i === n - 1 && n > 1) fill = '#7a1520';
            const isGold = fill === '#e9b53a';
            const mid = i * seg + seg / 2;
            const lit = highlight === i;
            const dim = (highlight != null && !lit) || (used[i] && !lit);
            return (
              <g key={i}>
                <path d={paths[i]} fill={fill} stroke="#05060b" strokeWidth="4" opacity={dim ? 0.35 : 1} />
                <g transform={`rotate(${mid}) translate(0 ${-R * 0.66})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="Anton, sans-serif"
                    fontSize={n > 8 ? 80 : 110}
                    fill={isGold ? '#0b0b10' : '#fff'}
                    opacity={dim ? 0.5 : 1}
                    transform={`rotate(${-mid - angle})`}
                  >
                    {i + 1}
                  </text>
                  {used[i] && !lit && (
                    <text y={70} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={800} fontSize={34} fill="#fff" opacity={0.8} transform={`rotate(${-mid - angle})`}>
                      ✓
                    </text>
                  )}
                </g>
              </g>
            );
          })}
          <circle r={R} fill="url(#segshade)" />
        </g>
        {Array.from({ length: 32 }).map((_, i) => {
          const a = (i / 32) * Math.PI * 2;
          const on = (i + lightsOn) % 2 === 0;
          return <circle key={i} cx={441 * Math.cos(a)} cy={441 * Math.sin(a)} r={6} fill={on ? '#fff3c4' : '#6b5520'} style={on ? { filter: 'drop-shadow(0 0 6px #f7d774)' } : undefined} />;
        })}
        <circle r="96" fill="url(#hub)" stroke="#f7d774" strokeWidth="5" />
        <text x="-24" y="18" textAnchor="middle" fontFamily="'Archivo Black', sans-serif" fontSize="58" fill="#3a95ff">
          A
        </text>
        <text x="26" y="18" textAnchor="middle" fontFamily="'Archivo Black', sans-serif" fontSize="58" fill="#ff3a48">
          I
        </text>
      </svg>
    </div>
  );
}

// ───────────────────────── QR ─────────────────────────
export function QR({ text, size = 320 }: { text: string; size?: number }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: size * 2, errorCorrectionLevel: 'M', color: { dark: '#05060bff', light: '#ffffffff' } })
      .then(setUrl)
      .catch(() => setUrl(''));
  }, [text, size]);
  return url ? <img src={url} width={size} height={size} alt={`QR code to join: ${text}`} className="rounded-xl" /> : <div style={{ width: size, height: size }} className="bg-white/10 rounded-xl" />;
}

export const joinUrl = (room: string) => `${window.location.origin}${window.location.pathname}#/play/${room}`;

// ───────────────────────── Confetti ─────────────────────────
export function fireConfetti(big = true) {
  const colors = ['#1f7bff', '#3fd2ff', '#ff2d3d', '#ff5a4f', '#f7d774', '#ffffff'];
  const end = Date.now() + (big ? 2500 : 900);
  const frame = () => {
    confetti({ particleCount: 7, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors, startVelocity: 65, scalar: 1.3 });
    confetti({ particleCount: 7, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors, startVelocity: 65, scalar: 1.3 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
  if (big) confetti({ particleCount: 180, spread: 120, origin: { y: 0.35 }, colors, startVelocity: 45, scalar: 1.4 });
}
