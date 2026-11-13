import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { useAnimatedNumber, useNow } from '../lib/hooks';
import { fmtClock, timerRemaining } from '../lib/time';
import type { Fx, PollState, PublicState, RouletteState, TeamId, TimerState, WheelCat } from '../lib/types';
import { ROUNDS, roundMeta } from '../lib/types';
import { WHEEL_COLORS } from '../lib/content';
import { useBlip } from './StageKit';

// ───────────────────────── Animated number ─────────────────────────
export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const v = useAnimatedNumber(value, 900);
  return <span className={className}>{Math.round(v)}</span>;
}

// ───────────────────────── Stage score bar ─────────────────────────
export function StageScoreBar({ s }: { s: PublicState }) {
  const meta = roundMeta(s.round);
  const lead: TeamId | null = s.scores.embrace === s.scores.ban ? null : s.scores.embrace > s.scores.ban ? 'embrace' : 'ban';
  const fx = s.fx?.kind === 'points' ? s.fx : null;
  return (
    <div className="absolute top-0 left-0 right-0 h-[118px] flex items-stretch z-30">
      <TeamScore team="embrace" score={s.scores.embrace} lead={lead === 'embrace'} fx={fx} speaking={s.spotlight === 'embrace'} />
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-black/80 to-black/30 border-b border-white/10">
        <div className="font-condensed text-[22px] tracking-[0.35em] text-white/60">
          {meta.num ? `ROUND ${meta.num} OF 5` : meta.id === 'roulette' ? 'BONUS ROUND' : 'THE GREAT AI DEBATE'}
        </div>
        <div className="font-display text-[44px] leading-none text-white glow-white uppercase">{meta.short}</div>
        <div className="flex gap-2 mt-2">
          {ROUNDS.filter((r) => r.num).map((r) => (
            <div
              key={r.id}
              className={`h-[6px] w-12 rounded-full ${
                r.id === s.round ? 'bg-gold shadow-[0_0_10px_rgba(247,215,116,0.9)]' : (r.num ?? 0) < (meta.num ?? 0) ? 'bg-white/60' : 'bg-white/15'
              }`}
            />
          ))}
        </div>
      </div>
      <TeamScore team="ban" score={s.scores.ban} lead={lead === 'ban'} fx={fx} speaking={s.spotlight === 'ban'} />
    </div>
  );
}

function TeamScore({ team, score, lead, fx, speaking }: { team: TeamId; score: number; lead: boolean; fx: Fx | null; speaking: boolean }) {
  const blue = team === 'embrace';
  const burst = fx && fx.team === team ? fx : null;
  const blip = useBlip(burst?.id);
  return (
    <div
      className={`relative w-[600px] flex items-center ${blue ? 'flex-row pl-10' : 'flex-row-reverse pr-10'} gap-6 ${
        blue ? 'bg-gradient-to-r from-embrace/50 via-embrace/15 to-transparent' : 'bg-gradient-to-l from-ban/50 via-ban/15 to-transparent'
      }`}
      style={{ borderBottom: `4px solid ${blue ? '#3a8dff' : '#ff3a48'}`, boxShadow: `0 6px 30px ${blue ? 'rgba(40,130,255,0.45)' : 'rgba(255,45,61,0.45)'}` }}
    >
      <div className={`${blue ? 'text-left' : 'text-right'}`}>
        <div className="font-condensed text-[20px] tracking-[0.3em] text-white/70 flex items-center gap-2" style={{ justifyContent: blue ? 'flex-start' : 'flex-end' }}>
          {speaking && <span className="w-3 h-3 rounded-full bg-white anim-pulse" />}
          TEAM
          {lead && <span className="text-gold glow-gold tracking-[0.2em]">★ LEADING</span>}
        </div>
        <div className={`font-display text-[52px] leading-none ${blue ? 'glow-blue' : 'glow-red'}`}>{blue ? 'EMBRACE' : 'BAN'}</div>
      </div>
      <div
        className={`font-condensed text-[96px] leading-none tabular-nums ${blip ? 'text-gold glow-gold' : 'text-white glow-white'} transition-colors duration-500`}
        style={{ minWidth: 150, textAlign: 'center' }}
      >
        <AnimatedNumber value={score} />
      </div>
      {burst && (
        <div
          key={burst.id}
          className={`absolute ${blue ? 'left-[380px]' : 'right-[380px]'} top-[124px] font-condensed text-[84px] ${
            (burst.delta ?? 0) >= 0 ? 'text-gold glow-gold' : 'text-ban-bright glow-red'
          }`}
          style={{ animation: 'float-up 2.2s ease-out both' }}
        >
          {(burst.delta ?? 0) > 0 ? '+' : ''}
          {burst.delta}
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
  const color = t.team === 'embrace' ? '#3a8dff' : t.team === 'ban' ? '#ff3a48' : '#f7d774';
  const r = size / 2 - 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      {showLabel && (
        <div className="font-condensed uppercase tracking-[0.25em] text-white/80 mb-3" style={{ fontSize: size * 0.085 }}>
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
            <div
              className={`font-condensed tabular-nums leading-none ${urgent ? 'text-ban-bright glow-red' : 'text-white glow-white'}`}
              style={{ fontSize: size * 0.4 }}
            >
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

// ───────────────────────── Vote bars ─────────────────────────
export function VoteBars({ poll, big = true, showCounts = true }: { poll: PollState; big?: boolean; showCounts?: boolean }) {
  const r = poll.results;
  if (!r) return null;
  const total = r.total;
  const opts = poll.options;
  const isTeamSplit = opts.some((o) => o.id === 'embrace') && opts.some((o) => o.id === 'ban');
  const pctOf = (id: string) => (total ? ((r.counts[id] ?? 0) / total) * 100 : 0);
  const colorOf = (id: string, i: number) =>
    id === 'embrace' ? '#1f7bff' : id === 'ban' ? '#ff2d3d' : id === 'fact' ? '#1f7bff' : id === 'fiction' ? '#ff2d3d' : i % 2 ? '#ff2d3d' : '#1f7bff';

  if (isTeamSplit) {
    const e = pctOf('embrace');
    const b = pctOf('ban');
    const n = 100 - e - b;
    const eLabel = opts.find((o) => o.id === 'embrace')!.label;
    const bLabel = opts.find((o) => o.id === 'ban')!.label;
    return (
      <div className="w-full">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className={`font-condensed leading-none text-embrace-bright glow-blue tabular-nums ${big ? 'text-[150px]' : 'text-6xl'}`}>
              <AnimatedNumber value={Math.round(e)} />%
            </div>
            <div className={`font-display uppercase ${big ? 'text-[34px]' : 'text-lg'}`}>{eLabel}</div>
            {showCounts && <div className="text-white/60 font-body text-xl">{r.counts.embrace ?? 0} votes</div>}
          </div>
          {opts.some((o) => o.id === 'neither') && (
            <div className="text-center pb-2">
              <div className={`font-condensed text-white/80 ${big ? 'text-6xl' : 'text-3xl'}`}>
                <AnimatedNumber value={Math.round(n)} />%
              </div>
              <div className="font-display text-white/60 uppercase text-lg">Neither / Both</div>
            </div>
          )}
          <div className="text-right">
            <div className={`font-condensed leading-none text-ban-bright glow-red tabular-nums ${big ? 'text-[150px]' : 'text-6xl'}`}>
              <AnimatedNumber value={Math.round(b)} />%
            </div>
            <div className={`font-display uppercase ${big ? 'text-[34px]' : 'text-lg'}`}>{bLabel}</div>
            {showCounts && <div className="text-white/60 font-body text-xl">{r.counts.ban ?? 0} votes</div>}
          </div>
        </div>
        <div className={`relative w-full ${big ? 'h-16' : 'h-8'} rounded-full overflow-hidden bg-white/10 flex border border-white/15`}>
          <div className="h-full transition-all duration-1000 ease-out sheen" style={{ width: `${e}%`, background: 'linear-gradient(90deg,#0b3fa8,#1f7bff,#3fd2ff)', boxShadow: '0 0 30px #1f7bff' }} />
          <div className="h-full transition-all duration-1000 ease-out bg-white/25" style={{ width: `${n}%` }} />
          <div className="h-full transition-all duration-1000 ease-out sheen ml-auto" style={{ width: `${b}%`, background: 'linear-gradient(90deg,#ff5a4f,#ff2d3d,#a3101c)', boxShadow: '0 0 30px #ff2d3d' }} />
          <div className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-white/70" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {opts.map((o, i) => {
        const p = pctOf(o.id);
        const correct = poll.correctOption && poll.revealed ? poll.correctOption === o.id : null;
        return (
          <div key={o.id}>
            <div className="flex justify-between items-end mb-2">
              <div className={`font-display uppercase ${big ? 'text-4xl' : 'text-lg'} flex items-center gap-3`}>
                {o.label}
                {correct === true && <span className="chip bg-gold text-black text-base px-3">CORRECT</span>}
              </div>
              <div className={`font-condensed tabular-nums ${big ? 'text-6xl' : 'text-2xl'}`}>
                <AnimatedNumber value={Math.round(p)} />%
                {showCounts && <span className="text-white/50 text-xl font-body ml-3">{r.counts[o.id] ?? 0}</span>}
              </div>
            </div>
            <div className={`${big ? 'h-10' : 'h-5'} rounded-full bg-white/10 overflow-hidden`}>
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${p}%`, background: colorOf(o.id, i), boxShadow: `0 0 20px ${colorOf(o.id, i)}`, opacity: correct === false ? 0.45 : 1 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SimulatedNote({ poll }: { poll: PollState }) {
  const r = poll.results;
  if (!r) return null;
  const parts: string[] = [];
  if (r.simulatedTotal) parts.push(`${r.simulatedTotal} SIMULATED`);
  if (r.manualTotal) parts.push(`${r.manualTotal} SHOW-OF-HANDS`);
  if (!parts.length) return null;
  return (
    <span className="tag bg-gold/15 text-gold border border-gold/40 text-[20px] px-4 py-1">
      INCLUDES {parts.join(' + ')} VOTES · {r.realTotal} FROM AUDIENCE DEVICES
    </span>
  );
}

// ───────────────────────── Roulette wheel ─────────────────────────
const A = 0.1;
const T = A / 2 + (1 - A) / 3;
/** Accelerate for the first 10%, then a long, dramatic deceleration. */
export function spinEase(k: number) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  if (k < A) return (k * k) / (2 * A) / T;
  const u = (1 - k) / (1 - A);
  return (A / 2 + ((1 - A) / 3) * (1 - u * u * u)) / T;
}
export function wheelAngle(r: RouletteState, at: number) {
  if (r.status !== 'spinning') return r.toDeg;
  const k = (at - r.startedAt) / Math.max(1, r.durationMs);
  return r.fromDeg + (r.toDeg - r.fromDeg) * spinEase(k);
}

function splitLabel(name: string): string[] {
  const words = name.split(' ');
  if (name.length <= 10 || words.length === 1) return [name];
  let best = [name];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const d = Math.abs(a.length - b.length);
    if (d < bestDiff) {
      bestDiff = d;
      best = [a, b];
    }
  }
  return best;
}

export function Wheel({ cats, angle, size = 860, highlight }: { cats: WheelCat[]; angle: number; size?: number; highlight: number | null }) {
  const n = Math.max(1, cats.length);
  const R = 430;
  const seg = 360 / n;
  const at = useNow(true, 4);
  const lightsOn = Math.floor(at / 350) % 2;
  const paths = useMemo(
    () =>
      cats.map((_, i) => {
        const a0 = ((i * seg - 90) * Math.PI) / 180;
        const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
        const large = seg > 180 ? 1 : 0;
        return `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
      }),
    [cats, seg],
  );
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* pointer */}
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
          {cats.map((c, i) => {
            const fill = WHEEL_COLORS[i % WHEEL_COLORS.length];
            const isGold = fill === '#e9b53a';
            const mid = i * seg + seg / 2;
            const lines = splitLabel(c.name);
            const lit = highlight === i;
            return (
              <g key={c.id}>
                <path d={paths[i]} fill={fill} stroke="#05060b" strokeWidth="4" opacity={highlight != null && !lit ? 0.45 : 1} />
                <g transform={`rotate(${mid}) translate(0 ${-R * 0.58}) rotate(-90)`}>
                  {lines.map((ln, li) => (
                    <text
                      key={li}
                      x={0}
                      y={(li - (lines.length - 1) / 2) * 34}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontFamily="'Archivo Black', sans-serif"
                      fontSize={lines.length > 1 ? 27 : 30}
                      fill={isGold ? '#0b0b10' : '#fff'}
                      style={{ letterSpacing: '0.01em' }}
                    >
                      {ln}
                    </text>
                  ))}
                </g>
              </g>
            );
          })}
          <circle r={R} fill="url(#segshade)" />
        </g>
        {/* rim lights */}
        {Array.from({ length: 32 }).map((_, i) => {
          const a = (i / 32) * Math.PI * 2;
          const on = (i + lightsOn) % 2 === 0;
          return (
            <circle
              key={i}
              cx={441 * Math.cos(a)}
              cy={441 * Math.sin(a)}
              r={6}
              fill={on ? '#fff3c4' : '#6b5520'}
              style={on ? { filter: 'drop-shadow(0 0 6px #f7d774)' } : undefined}
            />
          );
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

export const joinUrl = (room: string) => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/play/${room}`;
};

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
