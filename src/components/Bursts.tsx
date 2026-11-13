import { useMemo, type CSSProperties, type ReactNode } from 'react';

// Full-screen motion graphics that accompany sound effects on the projector (1920×1080 canvas).

export const BURST_MS: Record<string, number> = {
  applause: 3200,
  bigApplause: 4200,
  drumroll: 3200,
  airhorn: 2200,
  gasp: 2200,
  boo: 2600,
  correct: 2200,
  wrong: 2200,
  suspenseHit: 3000,
  fanfare: 2800,
  showOpen: 3800,
  buzzer: 2200,
};

function Rays({ color, opacity = 0.35 }: { color: string; opacity?: number }) {
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: 3000,
        height: 3000,
        marginLeft: -1500,
        marginTop: -1500,
        background: `repeating-conic-gradient(from 0deg, ${color} 0deg 6deg, transparent 6deg 18deg)`,
        opacity,
        animation: 'rays-spin 8s linear infinite, burst-fade-in 0.4s ease-out both',
        maskImage: 'radial-gradient(circle, black 0%, black 25%, transparent 60%)',
        WebkitMaskImage: 'radial-gradient(circle, black 0%, black 25%, transparent 60%)',
      }}
    />
  );
}

/** Emoji (or text) particles flying up or falling down. */
function Particles({ items, count = 26, dir = 'up', size = [70, 140] }: { items: string[]; count?: number; dir?: 'up' | 'down'; size?: [number, number] }) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        ch: items[i % items.length],
        left: Math.random() * 1840,
        delay: Math.random() * 0.9,
        dur: 1.6 + Math.random() * 1.2,
        size: size[0] + Math.random() * (size[1] - size[0]),
        rot: (Math.random() - 0.5) * 60,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <>
      {parts.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={
            {
              left: p.left,
              [dir === 'up' ? 'bottom' : 'top']: -180,
              fontSize: p.size,
              '--rot': `${p.rot}deg`,
              animation: `${dir === 'up' ? 'float-rise' : 'float-fall'} ${p.dur}s ${p.delay}s cubic-bezier(.2,.7,.3,1) both`,
            } as CSSProperties
          }
        >
          {p.ch}
        </div>
      ))}
    </>
  );
}

function BigText({ children, className = '', style, sub }: { children: ReactNode; className?: string; style?: CSSProperties; sub?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className={`font-display leading-none text-center anim-slam ${className}`} style={style}>
        {children}
      </div>
      {sub && <div className="font-condensed tracking-[0.4em] text-white/90 text-[44px] mt-6 anim-rise delay-2">{sub}</div>}
    </div>
  );
}

const Vignette = ({ color }: { color: string }) => (
  <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 35%, ${color} 100%)`, animation: 'burst-fade-in 0.3s both' }} />
);

export function SoundBurst({ name }: { name: string }) {
  const out = (body: ReactNode, fade = true) => (
    <div className="absolute inset-0 z-[45] pointer-events-none overflow-hidden" style={fade ? { animation: `burst-out ${BURST_MS[name] ?? 2500}ms ease-in both` } : undefined}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" style={{ animation: 'burst-fade-in 0.25s both' }} />
      {body}
    </div>
  );
  switch (name) {
    case 'applause':
      return out(
        <>
          <Vignette color="rgba(247,215,116,0.25)" />
          <Rays color="rgba(247,215,116,0.6)" opacity={0.25} />
          <Particles items={['👏', '👏', '🙌', '✨']} count={30} />
          <BigText className="text-goldgrad text-[200px]" sub="MAKE SOME NOISE!">
            APPLAUSE!
          </BigText>
        </>,
      );
    case 'bigApplause':
      return out(
        <>
          <Vignette color="rgba(247,215,116,0.35)" />
          <Rays color="rgba(247,215,116,0.7)" opacity={0.35} />
          <Particles items={['🎉', '👏', '🥳', '⭐', '🙌']} count={40} />
          <BigText className="text-goldgrad text-[180px]" sub="WHAT A PERFORMANCE">
            BRAVO!
          </BigText>
        </>,
      );
    case 'drumroll':
      return out(
        <>
          <div className="absolute inset-0 bg-black/55" style={{ animation: 'burst-fade-in 0.3s both' }} />
          <div className="absolute top-0 bottom-0 w-[500px] bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'spot-sweep 1.4s ease-in-out infinite alternate' }} />
          <div className="absolute inset-0 flex items-center justify-center gap-10">
            <div className="text-[220px] anim-shake-loop">🥁</div>
            <div className="font-display text-[150px] text-white glow-white" style={{ animation: 'pulse-glow 0.35s ease-in-out infinite' }}>
              DRUMROLL…
            </div>
            <div className="text-[220px] anim-shake-loop" style={{ animationDelay: '0.1s' }}>
              🥁
            </div>
          </div>
        </>,
      );
    case 'airhorn':
      return out(
        <>
          <Rays color="rgba(255,255,255,0.8)" opacity={0.3} />
          <div className="absolute inset-0 flex items-center justify-center gap-12">
            <div className="text-[260px] anim-shake-loop">📯</div>
            <div className="font-display text-[240px] text-white glow-white anim-slam">HONK!</div>
          </div>
          <Particles items={['💥', '🔊', '💥']} count={14} size={[90, 160]} />
        </>,
      );
    case 'gasp':
      return out(
        <>
          <div className="absolute inset-0 bg-white" style={{ animation: 'flash 0.6s ease-out both' }} />
          <Vignette color="rgba(0,0,0,0.75)" />
          <BigText className="text-white glow-white text-[240px]" sub="DID THEY REALLY SAY THAT?!">
            😱 OOOOH!
          </BigText>
        </>,
      );
    case 'boo':
      return out(
        <>
          <Vignette color="rgba(255,45,61,0.45)" />
          <Particles items={['👎', '🍅', '👎']} count={26} dir="down" />
          <BigText className="text-ban-bright glow-red text-[240px] anim-shake-loop">BOOOO!</BigText>
        </>,
      );
    case 'correct':
      return out(
        <>
          <Vignette color="rgba(16,185,129,0.4)" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[420px] h-[420px] rounded-full bg-emerald-500 flex items-center justify-center text-[300px] text-white anim-pop" style={{ boxShadow: '0 0 120px rgba(16,185,129,0.9)' }}>
              ✓
            </div>
          </div>
          <div className="absolute left-0 right-0 bottom-[150px] text-center font-display text-[90px] text-emerald-300 anim-rise delay-1">NAILED IT!</div>
        </>,
      );
    case 'wrong':
      return out(
        <>
          <Vignette color="rgba(255,45,61,0.5)" />
          <div className="absolute inset-0 flex items-center justify-center anim-shake-loop">
            <div className="w-[420px] h-[420px] rounded-full bg-ban flex items-center justify-center text-[300px] text-white anim-pop" style={{ boxShadow: '0 0 120px rgba(255,45,61,0.9)' }}>
              ✕
            </div>
          </div>
          <div className="absolute left-0 right-0 bottom-[150px] text-center font-display text-[90px] text-ban-bright anim-rise delay-1">NOPE!</div>
        </>,
      );
    case 'suspenseHit':
      return out(
        <>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 20%, rgba(120,0,10,0.85) 100%)', animation: 'heartbeat-bg 0.9s ease-in-out infinite' }} />
          <BigText className="text-white text-[220px] tracking-[0.3em]" style={{ animation: 'pulse-glow 0.9s ease-in-out infinite' }}>
            …
          </BigText>
        </>,
      );
    case 'fanfare':
      return out(
        <>
          <Rays color="rgba(247,215,116,0.8)" opacity={0.4} />
          <div className="absolute inset-0 flex items-center justify-center gap-12">
            <div className="text-[200px]" style={{ animation: 'tilt-l 0.5s ease-in-out infinite alternate' }}>
              🎺
            </div>
            <div className="font-display text-goldgrad text-[200px] anim-slam">TA-DA!</div>
            <div className="text-[200px]" style={{ animation: 'tilt-r 0.5s ease-in-out infinite alternate', transform: 'scaleX(-1)' }}>
              🎺
            </div>
          </div>
          <Particles items={['✨', '⭐', '✨']} count={20} size={[60, 110]} />
        </>,
      );
    case 'showOpen':
      return out(
        <>
          <div className="absolute inset-0 bg-black" style={{ animation: 'show-open-bg 3.8s ease-in-out both' }} />
          <div className="absolute top-0 bottom-0 w-[700px] bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: 'spot-sweep 1.8s 0.2s ease-in-out both' }} />
          <Rays color="rgba(120,160,255,0.6)" opacity={0.25} />
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ animation: 'show-open-zoom 3.8s ease-out both' }}>
            <div className="font-condensed tracking-[0.6em] text-[44px] text-white/80 anim-rise delay-3">LIVE FROM GOODENOUGH COLLEGE</div>
            <div className="font-display leading-[0.86] text-center mt-6 anim-slam delay-5">
              <div className="text-white glow-white text-[150px]">THE GREAT</div>
              <div className="text-[210px]">
                <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
              </div>
            </div>
          </div>
        </>,
        false,
      );
    case 'buzzer':
      return out(
        <>
          <div className="absolute inset-0 bg-ban/40" style={{ animation: 'flash-red 0.4s steps(2) 4' }} />
          <BigText className="text-white glow-red text-[220px] anim-shake-loop">⏰ TIME’S UP!</BigText>
        </>,
      );
    default:
      return null;
  }
}
