import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { TeamId } from '../lib/types';
import { TEAM_NAME } from '../lib/types';

/** Fixed 1920×1080 broadcast canvas, letterboxed to any projector. */
export function StageCanvas({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      <div
        className="relative shrink-0 overflow-hidden stage-bg"
        style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'center center' }}
      >
        {children}
      </div>
    </div>
  );
}

/** Spotlights, haze, floor and audience — the poster's room. */
export function Backdrop({ dim = 0, floor = true, crowd = true, beams = true }: { dim?: number; floor?: boolean; crowd?: boolean; beams?: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {beams && (
        <>
          <div className="beam beam-blue" />
          <div className="beam beam-red" />
          <div className="beam beam-white" />
          <div className="lamp lamp-blue" style={{ left: 70, top: 40 }} />
          <div className="lamp lamp-red" style={{ right: 70, top: 40 }} />
        </>
      )}
      <div className="haze" />
      {floor && <div className="floor" />}
      {crowd && <Crowd />}
      {dim > 0 && <div className="absolute inset-0 bg-black transition-opacity duration-700" style={{ opacity: dim }} />}
    </div>
  );
}

const HEADS = (() => {
  // Deterministic pseudo-random crowd.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = [
    { y: 1060, r: 58, count: 13, jitter: 30 },
    { y: 990, r: 44, count: 17, jitter: 20 },
  ];
  const out: { x: number; y: number; r: number }[] = [];
  rows.forEach((row, ri) => {
    for (let i = 0; i < row.count; i++) {
      const x = (i + 0.5 + (ri ? 0.5 : 0)) * (1920 / row.count) + (rnd() - 0.5) * row.jitter;
      out.push({ x, y: row.y + (rnd() - 0.5) * 18, r: row.r * (0.85 + rnd() * 0.3) });
    }
  });
  return out.sort((a, b) => a.y - b.y);
})();

function Crowd() {
  return (
    <svg className="absolute inset-0" viewBox="0 0 1920 1080" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rim" x1="0" x2="1">
          <stop offset="0" stopColor="#2b8cff" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#8890ff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ff3344" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {HEADS.map((h, i) => (
        <g key={i}>
          <path
            d={`M${h.x - h.r * 1.9} ${h.y + h.r * 3} Q${h.x - h.r * 1.8} ${h.y + h.r * 1.05} ${h.x} ${h.y + h.r * 0.95} Q${h.x + h.r * 1.8} ${h.y + h.r * 1.05} ${h.x + h.r * 1.9} ${h.y + h.r * 3} Z`}
            fill="#020306"
          />
          <ellipse cx={h.x} cy={h.y} rx={h.r * 0.82} ry={h.r} fill="#020306" stroke="url(#rim)" strokeWidth={1.2} strokeOpacity={0.3} />
        </g>
      ))}
      <rect x="0" y="900" width="1920" height="180" fill="url(#fade)" />
    </svg>
  );
}

export function LedPanel({
  children,
  tone = 'red',
  className = '',
  style,
  tilt = false,
}: {
  children: ReactNode;
  tone?: 'red' | 'blue' | 'gold' | 'split';
  className?: string;
  style?: CSSProperties;
  tilt?: boolean;
}) {
  const t = tone === 'red' ? '' : `led-${tone}`;
  return (
    <div
      className={`led ${t} ${className}`}
      style={{ ...(tilt ? { transform: 'perspective(1800px) rotateX(4deg) rotateZ(-1.2deg)' } : {}), ...style }}
    >
      {children}
    </div>
  );
}

/** The poster's headline: AI SHOULD BE [BANNED] FROM UNIVERSITIES. */
export function MotionText({ size = 110, cursor = true }: { size?: number; cursor?: boolean }) {
  return (
    <div className="font-display led-text uppercase leading-[0.95] tracking-tight" style={{ fontSize: size }}>
      <div>AI SHOULD BE</div>
      <div>
        <span className="banned-chip">BANNED</span> FROM
      </div>
      <div className={cursor ? 'led-cursor' : ''}>UNIVERSITIES.</div>
    </div>
  );
}

/** THE GREAT / AI DEBATE lockup. */
export function TitleLockup({ size = 1, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`text-center font-display uppercase leading-[0.86] ${className}`}>
      <div className="text-white glow-white" style={{ fontSize: 120 * size, letterSpacing: '-0.01em' }}>
        THE GREAT
      </div>
      <div style={{ fontSize: 170 * size, letterSpacing: '-0.02em' }}>
        <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
      </div>
    </div>
  );
}

export function Podium({
  team,
  active = false,
  dim = false,
  scale = 1,
  label = true,
  children,
}: {
  team: TeamId;
  active?: boolean;
  dim?: boolean;
  scale?: number;
  label?: boolean;
  children?: ReactNode;
}) {
  const blue = team === 'embrace';
  const w = 300 * scale;
  return (
    <div
      className={`podium ${blue ? 'podium-blue' : 'podium-red'} ${dim ? 'dim' : ''} transition-all duration-500`}
      style={{ width: w, filter: active ? 'brightness(1.25)' : undefined }}
    >
      {/* microphone */}
      <div className="absolute" style={{ left: blue ? w * 0.62 : w * 0.3, top: -70 * scale }}>
        <div className="bg-neutral-700 rounded-full" style={{ width: 4 * scale, height: 70 * scale, transform: `rotate(${blue ? 20 : -20}deg)`, transformOrigin: 'bottom' }} />
        <div className="absolute bg-neutral-800 border border-neutral-600 rounded-full" style={{ width: 14 * scale, height: 26 * scale, top: -14 * scale, left: blue ? 10 * scale : -16 * scale, transform: `rotate(${blue ? 20 : -20}deg)` }} />
      </div>
      <div className="podium-top rounded-sm" style={{ height: 22 * scale, transform: 'perspective(400px) rotateX(25deg)', marginLeft: -10 * scale, marginRight: -10 * scale }} />
      <div className="podium-body rounded-sm flex flex-col items-center justify-center relative overflow-hidden" style={{ height: 300 * scale, marginTop: 4 * scale }}>
        <div className="absolute inset-y-4 border-2 rounded-sm" style={{ left: 24 * scale, right: 24 * scale, borderColor: blue ? 'rgba(58,141,255,0.65)' : 'rgba(255,58,72,0.65)' }} />
        {active && <div className="absolute inset-0 anim-pulse" style={{ background: blue ? 'radial-gradient(circle at 50% 30%, rgba(80,160,255,0.35), transparent 70%)' : 'radial-gradient(circle at 50% 30%, rgba(255,80,90,0.35), transparent 70%)' }} />}
        <div className="relative z-10 text-center px-4">
          {label && (
            <div className={`font-display uppercase ${blue ? 'glow-blue' : 'glow-red'}`} style={{ fontSize: 34 * scale, lineHeight: 1 }}>
              <div className="text-white/80" style={{ fontSize: 18 * scale, letterSpacing: '0.3em' }}>
                TEAM
              </div>
              {blue ? 'EMBRACE' : 'BAN'}
            </div>
          )}
          {children}
        </div>
      </div>
      <div className="podium-base rounded-sm" style={{ height: 16 * scale, marginLeft: -24 * scale, marginRight: -24 * scale, marginTop: 6 * scale, background: '#0a0c14' }} />
    </div>
  );
}

export function TeamTag({ team, className = '' }: { team: TeamId; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display uppercase ${team === 'embrace' ? 'text-embrace-bright glow-blue' : 'text-ban-bright glow-red'} ${className}`}
    >
      <span className={`inline-block w-3 h-3 rounded-full ${team === 'embrace' ? 'bg-embrace' : 'bg-ban'}`} />
      {TEAM_NAME[team]}
    </span>
  );
}

/** Keyed wrapper that replays entrance animations when `k` changes. */
export function Replay({ k, children, className = '' }: { k: string | number; children: ReactNode; className?: string }) {
  return (
    <div key={k} className={className}>
      {children}
    </div>
  );
}

/** Tiny hook: true for `ms` after `key` changes (for flashes). */
export function useBlip(key: unknown, ms = 900) {
  const [on, setOn] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return on;
}
