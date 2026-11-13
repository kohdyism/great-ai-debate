import type { ReactNode } from 'react';
import { BigTimer, QR, SimulatedNote, StageScoreBar, VoteBars, Wheel, joinUrl, wheelAngle, AnimatedNumber } from '../components/Widgets';
import { Backdrop, LedPanel, MotionText, Podium, TeamTag, TitleLockup } from '../components/StageKit';
import { useNow } from '../lib/hooks';
import { now } from '../lib/time';
import type { PublicState, TeamId } from '../lib/types';
import { ROUNDS, TEAM_NAME, roundMeta } from '../lib/types';

export const TEAM_POSITION: Record<TeamId, string> = {
  embrace: 'AGAINST THE MOTION — universities should embrace AI',
  ban: 'FOR THE MOTION — AI should be banned from universities',
};

/** Which screens show the persistent scoreboard. */
const NO_SCOREBAR = new Set(['home', 'countdown', 'verdict', 'champion', 'roundIntro']);

export function StageScreen({ s }: { s: PublicState }) {
  const showBar = s.showScoreboard && !NO_SCOREBAR.has(s.screen);
  const dim = s.screen === 'countdown' ? 0.7 : s.screen === 'verdict' || s.screen === 'champion' ? 0.25 : 0;
  return (
    <>
      <Backdrop dim={dim} crowd={s.screen !== 'scoreboard'} />
      {showBar && <StageScoreBar s={s} />}
      <div className="absolute inset-0" style={{ top: showBar ? 118 : 0 }}>
        <ScreenBody s={s} />
      </div>
    </>
  );
}

function ScreenBody({ s }: { s: PublicState }) {
  switch (s.screen) {
    case 'home':
      return <HomeScreen s={s} />;
    case 'join':
      return <JoinScreen s={s} />;
    case 'roundIntro':
      return <RoundIntroScreen s={s} />;
    case 'teams':
      return <TeamsScreen s={s} />;
    case 'fof':
      return <FofScreen s={s} />;
    case 'hotseat':
      return <HotSeatScreen s={s} />;
    case 'devil':
      return <DevilScreen s={s} />;
    case 'roulette':
      return <RouletteScreen s={s} />;
    case 'poll':
      return <PollScreen s={s} />;
    case 'scoreboard':
      return <ScoreboardScreen s={s} />;
    case 'final':
      return <FinalScreen s={s} />;
    case 'countdown':
      return <CountdownScreen s={s} />;
    case 'verdict':
      return <VerdictScreen s={s} />;
    case 'shift':
      return <ShiftScreen s={s} />;
    case 'champion':
      return <ChampionScreen s={s} />;
    case 'message':
      return <MessageScreen title={s.message?.title ?? ''} body={s.message?.body ?? ''} />;
    default:
      return null;
  }
}

const Center = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`absolute inset-0 flex flex-col items-center justify-center ${className}`}>{children}</div>
);

// ───────────────────────── HOME ─────────────────────────
export function HomeScreen({ s, onStart }: { s: PublicState | null; onStart?: () => void }) {
  return (
    <>
      <div className="absolute left-0 right-0 top-[44px] flex justify-center">
        <div className="anim-rise" style={{ width: 1180 }}>
          <LedPanel tilt className="px-16 py-10">
            <div className="anim-flicker">
              <MotionText size={118} />
            </div>
          </LedPanel>
        </div>
      </div>
      <div className="absolute left-0 right-0 top-[496px] flex justify-center">
        <div className="anim-pop delay-3">
          <div className="bubble px-10 py-4 font-display text-[44px]">Got an opinion?</div>
        </div>
      </div>
      <div className="absolute left-0 right-0 top-[618px] text-center text-white/90 font-body font-semibold tracking-[0.45em] text-[26px] anim-rise delay-4">
        WELL JOIN US AT
      </div>
      <div className="absolute left-0 right-0 top-[656px] anim-slam delay-5">
        <TitleLockup size={0.92} />
      </div>
      <div className="absolute left-[90px] bottom-[150px] anim-rise delay-2">
        <Podium team="embrace" scale={0.9} />
      </div>
      <div className="absolute right-[90px] bottom-[150px] anim-rise delay-2">
        <Podium team="ban" scale={0.9} />
      </div>
      <div className="absolute left-0 right-0 top-[905px] flex items-center justify-center gap-8 font-display text-[40px] anim-rise delay-6">
        <span className="text-embrace-bright glow-blue">TEAM EMBRACE</span>
        <span className="font-condensed text-gold glow-gold text-[46px]">VS</span>
        <span className="text-ban-bright glow-red">TEAM BAN</span>
      </div>
      {onStart && (
        <div className="absolute left-0 right-0 top-[975px] flex justify-center anim-pop delay-6">
          <button onClick={onStart} className="pill-gold rounded-full px-14 py-4 font-display text-[30px] tracking-[0.12em] hover:scale-105 transition">
            START THE SHOW
          </button>
        </div>
      )}
      {!onStart && s && (
        <div className="absolute left-0 right-0 top-[985px] flex justify-center">
          <div className="pill-gold rounded-full px-12 py-3 font-display text-[26px] tracking-[0.12em]">
            JOIN AT ROOM CODE <span className="ml-2">{s.roomCode}</span>
          </div>
        </div>
      )}
    </>
  );
}

// ───────────────────────── JOIN ─────────────────────────
function JoinScreen({ s }: { s: PublicState }) {
  const url = joinUrl(s.roomCode);
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-24 pb-24">
      <div className="anim-pop">
        <div className="rounded-3xl p-5 bg-white neon-gold" style={{ boxShadow: '0 0 60px rgba(247,215,116,0.45)' }}>
          <QR text={url} size={460} />
        </div>
        <div className="text-center mt-4 font-body text-white/70 text-[22px] max-w-[500px] break-all">{url.replace(/^https?:\/\//, '')}</div>
      </div>
      <div className="anim-rise delay-2" style={{ width: 860 }}>
        <div className="font-display text-[110px] leading-[0.9] uppercase">
          JOIN THE <span className="text-goldgrad">JURY</span>
        </div>
        <div className="font-body text-white/80 text-[34px] mt-4 leading-snug">
          Scan the code with your phone camera. No sign-up. Your vote decides the verdict.
        </div>
        <div className="mt-10 flex items-end gap-6">
          <div>
            <div className="font-condensed tracking-[0.3em] text-white/60 text-[26px]">ROOM CODE</div>
            <LedPanel tone="split" className="px-10 py-4 mt-2">
              <div className="font-display text-[110px] leading-none tracking-[0.15em] led-text">{s.roomCode}</div>
            </LedPanel>
          </div>
          <div className="pb-3">
            <div className="font-condensed text-[120px] leading-none text-gold glow-gold tabular-nums">
              <AnimatedNumber value={s.audience.real + s.audience.simulated} />
            </div>
            <div className="font-condensed tracking-[0.3em] text-white/60 text-[24px]">IN THE JURY</div>
          </div>
        </div>
        {s.audience.simulated > 0 && (
          <div className="mt-4 tag bg-gold/15 text-gold border border-gold/40 text-[24px] px-5 py-1">
            {s.audience.simulated} SIMULATED · {s.audience.real} REAL
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── ROUND INTRO ─────────────────────────
function RoundIntroScreen({ s }: { s: PublicState }) {
  const m = roundMeta(s.round);
  return (
    <Center key={s.round + (s.fx?.id ?? '')}>
      <div className="font-condensed tracking-[0.5em] text-[44px] text-white/70 anim-rise">
        {m.num ? `ROUND ${m.num}` : m.id === 'roulette' ? 'BONUS ROUND' : 'PRE-SHOW'}
      </div>
      <div className="mt-6 anim-slam delay-1">
        <LedPanel tone={m.id === 'roulette' ? 'gold' : m.id === 'r5' ? 'split' : 'red'} className="px-20 py-10" style={{ maxWidth: 1700 }}>
          <div className="font-display text-[136px] leading-[0.95] uppercase led-text text-center">{m.name}</div>
        </LedPanel>
      </div>
      <div className="mt-10 font-body text-[40px] text-white/85 anim-rise delay-4">{m.tagline}</div>
      <div className="flex gap-4 mt-14 anim-rise delay-5">
        {ROUNDS.filter((r) => r.num).map((r) => (
          <div
            key={r.id}
            className={`px-5 py-2 rounded-full font-condensed text-[22px] tracking-[0.15em] ${
              r.id === s.round ? 'bg-gold text-black' : 'bg-white/10 text-white/60'
            }`}
          >
            {r.num}. {r.short}
          </div>
        ))}
      </div>
    </Center>
  );
}

// ───────────────────────── TEAMS / OPENING GAMBIT ─────────────────────────
function DebateFloor({ s, center }: { s: PublicState; center: ReactNode }) {
  const sp = s.spotlight;
  return (
    <>
      <div className="absolute left-[110px] bottom-[110px]">
        <Podium team="embrace" active={sp === 'embrace'} dim={sp === 'ban'} scale={1.05} />
      </div>
      <div className="absolute right-[110px] bottom-[110px]">
        <Podium team="ban" active={sp === 'ban'} dim={sp === 'embrace'} scale={1.05} />
      </div>
      {sp && (
        <div
          className="absolute pointer-events-none transition-all duration-700"
          style={{
            left: sp === 'embrace' ? 0 : undefined,
            right: sp === 'ban' ? 0 : undefined,
            top: -118,
            width: 700,
            height: 1100,
            background: `radial-gradient(40% 60% at 50% 70%, ${sp === 'embrace' ? 'rgba(60,150,255,0.35)' : 'rgba(255,60,70,0.35)'}, transparent 70%)`,
          }}
        />
      )}
      <div className="absolute left-[520px] right-[520px] top-0 bottom-[120px] flex flex-col items-center justify-center">{center}</div>
    </>
  );
}

function TeamsScreen({ s }: { s: PublicState }) {
  const sp = s.spotlight;
  const intro = sp && s.timer.status === 'idle' && /intro/i.test(s.phase);
  return (
    <DebateFloor
      s={s}
      center={
        intro && sp ? (
          <div key={sp} className="text-center anim-slam">
            <div className="font-condensed tracking-[0.5em] text-white/70 text-[34px]">INTRODUCING</div>
            <div className={`font-display text-[120px] leading-[0.9] mt-3 ${sp === 'embrace' ? 'text-ai' : 'text-debate'}`}>{TEAM_NAME[sp]}</div>
            <div className="font-body text-[30px] text-white/85 mt-6 max-w-[760px] mx-auto">{TEAM_POSITION[sp]}</div>
          </div>
        ) : (
          <>
            <LedPanel tone="split" className="px-10 py-5 mb-10">
              <MotionText size={46} cursor={false} />
            </LedPanel>
            <BigTimer t={s.timer} size={400} />
            {sp && (
              <div className="mt-6 text-[34px]">
                <TeamTag team={sp} /> <span className="font-display text-white/80">HAS THE FLOOR</span>
              </div>
            )}
          </>
        )
      }
    />
  );
}

// ───────────────────────── FACT OR FICTION ─────────────────────────
function FofScreen({ s }: { s: PublicState }) {
  const c = s.card;
  if (c.kind === 'none')
    return (
      <Center>
        <div className="font-display text-[160px] leading-none">
          <span className="text-ai">FACT</span> <span className="text-white/60 text-[90px]">OR</span> <span className="text-debate">FICTION?</span>
        </div>
        <div className="font-body text-[36px] text-white/70 mt-6">The first statement is coming up…</div>
      </Center>
    );
  const revealed = c.locksRevealed;
  const lockBox = (team: TeamId) => {
    const lock = c.locks[team];
    const right = revealed && c.answer && lock === c.answer;
    const wrong = revealed && c.answer && lock && lock !== c.answer;
    return (
      <div className={`w-[380px] rounded-2xl p-6 text-center ${team === 'embrace' ? 'neon-blue' : 'neon-red'} bg-black/50`}>
        <TeamTag team={team} className="text-[30px]" />
        <div className="mt-4 h-[90px] flex items-center justify-center">
          {!lock ? (
            <span className="font-condensed text-[44px] text-white/40 tracking-[0.2em]">THINKING…</span>
          ) : !revealed ? (
            <span className="font-condensed text-[52px] text-gold glow-gold tracking-[0.15em] anim-pop">LOCKED IN</span>
          ) : (
            <span className={`font-display text-[64px] anim-pop ${right ? 'text-gold glow-gold' : wrong ? 'text-white/40 line-through' : 'text-white'}`}>
              {lock}
            </span>
          )}
        </div>
        {revealed && c.answer && lock && (
          <div className={`font-condensed text-[30px] tracking-[0.2em] ${right ? 'text-gold' : 'text-white/50'}`}>{right ? `CORRECT +${c.points}` : 'WRONG'}</div>
        )}
      </div>
    );
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-10">
      <div className="font-display text-[54px] leading-none mb-6">
        <span className="text-ai">FACT</span> <span className="text-white/60">OR</span> <span className="text-debate">FICTION?</span>
        {c.kind === 'debate' && <span className="ml-6 align-middle tag bg-gold text-black text-[28px] px-5 py-1 font-display">DEBATE STATEMENT</span>}
      </div>
      <div key={c.id} className="anim-slam" style={{ width: 1500 }}>
        <LedPanel className="px-16 py-12" tone={c.kind === 'debate' ? 'gold' : 'red'}>
          <div className="font-display text-[66px] leading-[1.08] led-text text-center">{c.text}</div>
        </LedPanel>
      </div>
      <div className="flex items-start justify-between w-[1600px] mt-10">
        {c.kind === 'fact' ? lockBox('embrace') : <div className="w-[380px]" />}
        <div className="flex-1 px-8 text-center">
          {revealed && (
            <div className="anim-pop">
              {c.answer ? (
                <div className="font-display text-[150px] leading-none text-goldgrad anim-slam">{c.answer}</div>
              ) : (
                <div className="font-display text-[64px] leading-none text-goldgrad">NO SINGLE RIGHT ANSWER</div>
              )}
              {c.explanation && <div className="font-body text-[28px] leading-snug text-white/90 mt-5 max-w-[760px] mx-auto">{c.explanation}</div>}
            </div>
          )}
          {!revealed && c.kind === 'fact' && <div className="font-condensed text-[40px] tracking-[0.25em] text-white/60 mt-6">LOCK IN YOUR ANSWERS</div>}
          {!revealed && c.kind === 'debate' && (
            <div className="font-body text-[34px] text-white/80 mt-4">
              No objective answer here — argue it. Best argument earns the points.
            </div>
          )}
        </div>
        {c.kind === 'fact' ? lockBox('ban') : <div className="w-[380px]" />}
      </div>
      {s.timer.status !== 'idle' && (
        <div className="absolute right-[60px] bottom-[60px]">
          <BigTimer t={s.timer} size={200} />
        </div>
      )}
    </div>
  );
}

// ───────────────────────── HOT SEAT ─────────────────────────
function HotSeatScreen({ s }: { s: PublicState }) {
  const c = s.card;
  return (
    <DebateFloor
      s={s}
      center={
        c.kind === 'scenario' ? (
          <>
            <div className="font-display text-[50px] mb-4 text-debate">THE HOT SEAT</div>
            <div key={c.id} className="anim-slam w-[880px]">
              <LedPanel className="px-10 py-8">
                <div className="font-display text-[46px] leading-[1.12] led-text text-center">{c.text}</div>
              </LedPanel>
            </div>
            <div className="mt-8">
              <BigTimer t={s.timer} size={290} />
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="font-display text-[140px] leading-none text-debate">THE HOT SEAT</div>
            <div className="font-body text-[36px] text-white/75 mt-6">Real dilemmas. No time to hide.</div>
          </div>
        )
      }
    />
  );
}

// ───────────────────────── DEVIL'S ADVOCATE ─────────────────────────
function DevilScreen({ s }: { s: PublicState }) {
  const d = s.card.kind === 'devil' ? s.card.devil ?? {} : {};
  const card = (team: TeamId) => {
    const txt = d[team];
    const active = s.spotlight === team;
    return (
      <div
        className={`w-[640px] rounded-3xl p-10 bg-black/60 transition-all duration-500 ${team === 'embrace' ? 'neon-blue' : 'neon-red'} ${
          s.spotlight && !active ? 'opacity-40 scale-95' : active ? 'scale-[1.03]' : ''
        }`}
      >
        <TeamTag team={team} className="text-[34px]" />
        <div className="font-condensed text-[26px] tracking-[0.3em] text-white/60 mt-3">MUST ARGUE</div>
        <div className="font-display text-[46px] leading-[1.12] mt-4 min-h-[200px]">{txt ?? '—'}</div>
      </div>
    );
  };
  if (s.card.kind !== 'devil')
    return (
      <Center>
        <div className="font-display text-[150px] leading-none text-goldgrad">THE DEVIL’S ADVOCATE</div>
        <div className="font-body text-[38px] text-white/75 mt-6">Argue the side you hate. Convince us anyway.</div>
      </Center>
    );
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-10 pb-20">
      <div className="anim-rise">{card('embrace')}</div>
      <div className="flex flex-col items-center">
        <div className="font-display text-[44px] text-goldgrad mb-6 text-center leading-none">
          DEVIL’S
          <br />
          ADVOCATE
        </div>
        <BigTimer t={s.timer} size={300} />
      </div>
      <div className="anim-rise delay-2">{card('ban')}</div>
    </div>
  );
}

// ───────────────────────── ROULETTE ─────────────────────────
function RouletteScreen({ s }: { s: PublicState }) {
  const r = s.roulette;
  const at = useNow(r.status === 'spinning', 60);
  const list = s.wheel ?? [];
  const angle = wheelAngle(r, at);
  const landed = r.status === 'landed' || r.status === 'revealed' || (r.status === 'spinning' && at >= r.startedAt + r.durationMs);
  const cat = r.categoryIndex != null ? list[r.categoryIndex] : null;
  const showPanel = landed && cat;
  return (
    <div className="absolute inset-0">
      <div
        className="absolute top-1/2 transition-all duration-1000 ease-out"
        style={{ left: showPanel ? 90 : 960 - 430, transform: `translateY(-50%) scale(${showPanel ? 0.92 : 1})`, transformOrigin: 'left center', marginTop: -30 }}
      >
        <Wheel cats={list} angle={angle} size={860} highlight={landed ? r.categoryIndex : null} />
        {r.status === 'idle' && (
          <div className="absolute -bottom-16 left-0 right-0 text-center font-condensed text-[36px] tracking-[0.4em] text-white/70">AI ROULETTE</div>
        )}
        {r.status === 'spinning' && !landed && (
          <div className="absolute -bottom-16 left-0 right-0 text-center font-condensed text-[40px] tracking-[0.4em] text-gold glow-gold anim-pulse">SPINNING…</div>
        )}
      </div>
      {showPanel && cat && (
        <div className="absolute right-[70px] top-[40px] bottom-[110px] w-[880px] flex flex-col justify-center">
          <div className="font-condensed tracking-[0.4em] text-white/60 text-[28px] anim-rise">THE WHEEL HAS SPOKEN</div>
          <div key={r.spinId ?? ''} className="anim-slam mt-2">
            <LedPanel tone="gold" className="px-8 py-5">
              <div className="font-display text-[72px] leading-none led-text">{cat.name}</div>
              <div className="font-body text-[28px] text-white/80 mt-2">{cat.blurb}</div>
            </LedPanel>
          </div>
          {r.status === 'revealed' && r.question && (
            <div className="mt-8 anim-rise">
              <div className="font-display text-[44px] leading-[1.15]">{r.question}</div>
              <div className="mt-7 flex items-center gap-8">
                <div className="flex-1">
                  {r.team ? (
                    <div className="text-[40px]">
                      <TeamTag team={r.team} /> <span className="font-display text-white/80">MUST ANSWER</span>
                      {cat.mode === 'switch' && (
                        <div className="font-body text-[26px] text-gold mt-2">…defending {TEAM_NAME[r.team === 'embrace' ? 'ban' : 'embrace']}’s position!</div>
                      )}
                    </div>
                  ) : (
                    <div className="font-display text-[40px] text-gold glow-gold anim-pulse">THE AUDIENCE DECIDES WHO ANSWERS…</div>
                  )}
                  {cat.mode === 'double' && (
                    <div className="mt-4 inline-block rounded-xl neon-gold bg-black/50 px-6 py-3 font-condensed text-[34px] tracking-[0.1em] text-gold">
                      STAKE {r.stake} PTS · WIN {r.stake * 2} OR LOSE {r.stake}
                    </div>
                  )}
                </div>
                <BigTimer t={s.timer} size={240} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── POLL ─────────────────────────
function PollScreen({ s }: { s: PublicState }) {
  const p = s.poll;
  if (!p) return <MessageScreen title="THE PEOPLE’S VERDICT" body="Voting opens shortly." />;
  const showResults = !!p.results;
  const lead = p.results
    ? [...p.options].sort((a, b) => (p.results!.counts[b.id] ?? 0) - (p.results!.counts[a.id] ?? 0))
    : [];
  const tie = lead.length > 1 && p.results && (p.results.counts[lead[0].id] ?? 0) === (p.results.counts[lead[1].id] ?? 0);
  return (
    <div className="absolute inset-0 flex flex-col items-center px-[120px] pt-10">
      <div className="flex items-center gap-4 mb-5">
        <span className={`tag text-[26px] px-5 py-1 font-display ${p.status === 'open' ? 'bg-ban text-white anim-pulse' : 'bg-white/15 text-white/80'}`}>
          {p.status === 'open' ? '● VOTING OPEN' : 'VOTING CLOSED'}
        </span>
        <span className="font-condensed text-[28px] tracking-[0.3em] text-white/60">THE PEOPLE’S VERDICT</span>
      </div>
      <div key={p.id} className="anim-pop w-full">
        <LedPanel tone="split" className="px-14 py-8">
          <div className="font-display text-[60px] leading-[1.1] led-text text-center">{p.question}</div>
        </LedPanel>
      </div>
      <div className="w-full mt-12 flex-1">
        {showResults ? (
          <div className="anim-rise">
            <VoteBars poll={p} big />
            <div className="flex justify-between items-center mt-8">
              <div className="font-condensed text-[34px] tracking-[0.2em] text-white/70">
                <AnimatedNumber value={p.results!.total} /> VOTES
              </div>
              <SimulatedNote poll={p} />
              {p.results!.total > 0 && (
                <div className="font-display text-[34px]">
                  {tie ? <span className="text-gold">DEAD HEAT</span> : <span className="text-gold glow-gold">LEADING: {lead[0].label.toUpperCase()}</span>}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-16">
            <div className="flex-1 text-center">
              <div className="font-condensed text-[200px] leading-none text-white glow-white tabular-nums">
                <AnimatedNumber value={p.voteCount} />
              </div>
              <div className="font-condensed text-[40px] tracking-[0.35em] text-white/70">VOTES CAST</div>
              <div className="font-body text-[30px] text-white/60 mt-6">
                {p.status === 'open' ? 'Results are hidden until the big reveal.' : 'Results coming up…'}
              </div>
            </div>
            {p.status === 'open' && (
              <div className="flex items-center gap-8 bg-black/50 rounded-3xl p-6 neon-dim">
                <div className="bg-white rounded-xl p-2">
                  <QR text={joinUrl(s.roomCode)} size={220} />
                </div>
                <div>
                  <div className="font-condensed tracking-[0.3em] text-white/60 text-[24px]">VOTE NOW · ROOM</div>
                  <div className="font-display text-[80px] leading-none tracking-[0.1em]">{s.roomCode}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── SCOREBOARD ─────────────────────────
function ScoreboardScreen({ s }: { s: PublicState }) {
  const rounds = ROUNDS.filter((r) => r.id !== 'pre');
  const sumRounds = (t: TeamId) => rounds.reduce((a, r) => a + (s.roundScores[r.id]?.[t] ?? 0), 0) + (s.roundScores.pre?.[t] ?? 0);
  const adj = (t: TeamId) => s.scores[t] - sumRounds(t);
  const lead: TeamId | null = s.scores.embrace === s.scores.ban ? null : s.scores.embrace > s.scores.ban ? 'embrace' : 'ban';
  return (
    <div className="absolute inset-0 px-[160px] pt-8">
      <div className="font-display text-[64px] text-center leading-none mb-8">
        LIVE <span className="text-goldgrad">SCOREBOARD</span>
      </div>
      <div className="grid grid-cols-[1fr_300px_300px] gap-y-3 text-[34px] font-body">
        <div />
        <div className="text-center font-display text-embrace-bright glow-blue">EMBRACE</div>
        <div className="text-center font-display text-ban-bright glow-red">BAN</div>
        {rounds.map((r) => (
          <div key={r.id} className="contents">
            <div className={`font-display uppercase ${r.id === s.round ? 'text-gold' : 'text-white/85'}`}>
              {r.num ? `R${r.num} · ` : ''}
              {r.name}
            </div>
            <div className="text-center font-condensed text-[44px] tabular-nums">{s.roundScores[r.id]?.embrace ?? 0}</div>
            <div className="text-center font-condensed text-[44px] tabular-nums">{s.roundScores[r.id]?.ban ?? 0}</div>
          </div>
        ))}
        <div className="font-display text-gold/90">BONUS POINTS (INCLUDED)</div>
        <div className="text-center font-condensed text-[44px] text-gold">{s.bonus.embrace}</div>
        <div className="text-center font-condensed text-[44px] text-gold">{s.bonus.ban}</div>
        {(adj('embrace') !== 0 || adj('ban') !== 0) && (
          <>
            <div className="font-display text-white/60">HOST ADJUSTMENTS</div>
            <div className="text-center font-condensed text-[44px] text-white/60">{adj('embrace')}</div>
            <div className="text-center font-condensed text-[44px] text-white/60">{adj('ban')}</div>
          </>
        )}
        <div className="col-span-3 h-[3px] bg-gradient-to-r from-embrace via-white/40 to-ban my-2" />
        <div className="font-display text-[54px]">TOTAL</div>
        <div className={`text-center font-condensed text-[110px] leading-none ${lead === 'embrace' ? 'text-gold glow-gold' : ''}`}>
          <AnimatedNumber value={s.scores.embrace} />
        </div>
        <div className={`text-center font-condensed text-[110px] leading-none ${lead === 'ban' ? 'text-gold glow-gold' : ''}`}>
          <AnimatedNumber value={s.scores.ban} />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── FINAL VERDICT (round 5) ─────────────────────────
function FinalScreen({ s }: { s: PublicState }) {
  return (
    <DebateFloor
      s={s}
      center={
        <>
          <div className="font-condensed tracking-[0.45em] text-white/70 text-[30px] mb-4">THE FINAL VERDICT</div>
          <LedPanel tilt className="px-12 py-8 mb-10">
            <MotionText size={68} />
          </LedPanel>
          <BigTimer t={s.timer} size={330} />
        </>
      }
    />
  );
}

// ───────────────────────── COUNTDOWN ─────────────────────────
function CountdownScreen({ s }: { s: PublicState }) {
  const c = s.countdown;
  const at = useNow(true, 30);
  if (!c) return null;
  const left = Math.max(0, c.seconds * 1000 - (at - c.startedAt));
  const n = Math.ceil(left / 1000);
  const before = at < c.startedAt;
  return (
    <Center>
      <div className="font-condensed tracking-[0.6em] text-[44px] text-white/70 mb-6">{c.label}</div>
      {n > 0 && !before ? (
        <div
          key={n}
          className={`font-condensed leading-none tabular-nums anim-count ${n <= 3 ? 'text-ban-bright glow-red' : 'text-white glow-white'}`}
          style={{ fontSize: 520 }}
        >
          {n}
        </div>
      ) : (
        <div className="font-display text-[120px] text-goldgrad anim-pulse">AND THE VERDICT IS…</div>
      )}
      <div className="flex gap-3 mt-10">
        {Array.from({ length: c.seconds }).map((_, i) => (
          <div
            key={i}
            className={`w-10 h-3 rounded-full transition-all ${i < c.seconds - n ? 'bg-gold shadow-[0_0_14px_#f7d774]' : 'bg-white/15'}`}
          />
        ))}
      </div>
    </Center>
  );
}

// ───────────────────────── AUDIENCE VERDICT ─────────────────────────
function VerdictScreen({ s }: { s: PublicState }) {
  const p = s.finalPollId ? (s.poll?.id === s.finalPollId ? s.poll : s.pollHistory.find((x) => x.id === s.finalPollId)) : null;
  const r = p?.results;
  if (!p || !r) return <MessageScreen title="THE AUDIENCE VERDICT" body="Waiting for the results…" />;
  const ban = r.counts.ban ?? 0;
  const emb = r.counts.embrace ?? 0;
  const n = ban + emb;
  const banPct = n ? (ban / n) * 100 : 0;
  const embPct = n ? (emb / n) * 100 : 0;
  const win: TeamId | null = ban === emb ? null : ban > emb ? 'ban' : 'embrace';
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-16">
      <div className="font-condensed tracking-[0.5em] text-[40px] text-white/70 anim-rise">THE AUDIENCE VERDICT</div>
      <div className="font-display text-[56px] mt-2 anim-rise delay-1">SHOULD AI BE BANNED FROM UNIVERSITIES?</div>
      <div className="flex items-center justify-center gap-16 mt-12 w-full px-[100px]">
        <div className={`flex-1 text-center transition-all duration-700 ${win === 'ban' ? 'opacity-50 scale-95' : ''}`}>
          <div className="font-condensed text-[260px] leading-none text-embrace-bright glow-blue tabular-nums anim-slam delay-2">
            <AnimatedNumber value={Math.round(embPct)} />%
          </div>
          <div className="font-display text-[54px] mt-2">NO — EMBRACE AI</div>
          <div className="font-body text-[30px] text-white/60">{emb} votes</div>
        </div>
        <div className="font-condensed text-[80px] text-white/40">VS</div>
        <div className={`flex-1 text-center transition-all duration-700 ${win === 'embrace' ? 'opacity-50 scale-95' : ''}`}>
          <div className="font-condensed text-[260px] leading-none text-ban-bright glow-red tabular-nums anim-slam delay-2">
            <AnimatedNumber value={Math.round(banPct)} />%
          </div>
          <div className="font-display text-[54px] mt-2">YES — BAN AI</div>
          <div className="font-body text-[30px] text-white/60">{ban} votes</div>
        </div>
      </div>
      <div className="mt-12 anim-pop delay-5">
        <LedPanel tone={win === 'ban' ? 'red' : win === 'embrace' ? 'blue' : 'gold'} className="px-16 py-6">
          <div className="font-display text-[76px] leading-none led-text text-center">
            {win === 'ban' ? 'THE ROOM SAYS: BAN AI' : win === 'embrace' ? 'THE ROOM SAYS: EMBRACE AI' : 'THE ROOM IS SPLIT DOWN THE MIDDLE'}
          </div>
        </LedPanel>
      </div>
      <div className="mt-6 flex items-center gap-6 font-condensed text-[30px] tracking-[0.2em] text-white/70">
        <span>{r.total} TOTAL VOTES</span>
        <SimulatedNote poll={p} />
      </div>
    </div>
  );
}

// ───────────────────────── OPINION SHIFT ─────────────────────────
function ShiftScreen({ s }: { s: PublicState }) {
  const d = s.shift;
  if (!d) return <MessageScreen title="OPINION SHIFT" body="Compare the opening poll with the final vote." />;
  const col = (label: string, side: typeof d.initial, delay: string) => (
    <div className={`w-[560px] anim-rise ${delay}`}>
      <div className="font-condensed tracking-[0.4em] text-[34px] text-white/70 text-center">{label}</div>
      <div className="mt-4 rounded-3xl bg-black/50 neon-dim p-8">
        <div className="flex justify-between items-end">
          <div>
            <div className="font-condensed text-[100px] leading-none text-embrace-bright glow-blue tabular-nums">
              <AnimatedNumber value={Math.round(side.embracePct)} />%
            </div>
            <div className="font-display text-[24px]">SUPPORT ADOPTION</div>
          </div>
          <div className="text-right">
            <div className="font-condensed text-[100px] leading-none text-ban-bright glow-red tabular-nums">
              <AnimatedNumber value={Math.round(side.banPct)} />%
            </div>
            <div className="font-display text-[24px]">SUPPORT A BAN</div>
          </div>
        </div>
        <div className="h-8 mt-6 rounded-full overflow-hidden flex bg-white/10">
          <div className="h-full transition-all duration-1000" style={{ width: `${side.embracePct}%`, background: 'linear-gradient(90deg,#1f7bff,#3fd2ff)' }} />
          <div className="h-full transition-all duration-1000 ml-auto" style={{ width: `${side.banPct}%`, background: 'linear-gradient(90deg,#ff2d3d,#a3101c)' }} />
        </div>
        <div className="text-center mt-4 font-body text-[24px] text-white/60">{side.n} votes</div>
      </div>
    </div>
  );
  const delta = Math.round(d.banDeltaPts);
  const headline =
    d.headline === 'flipped'
      ? 'THE ROOM HAS CHANGED ITS MIND!'
      : d.headline === 'shifting'
        ? `THE ROOM IS MOVING ${delta < 0 ? 'TOWARDS AI' : 'TOWARDS A BAN'}`
        : 'THE ROOM HOLDS ITS GROUND';
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-6">
      <div className="font-display text-[60px] leading-none">
        OPINION <span className="text-goldgrad">SHIFT</span> TRACKER
      </div>
      <div className="flex items-center gap-10 mt-8">
        {col('INITIAL OPINION', d.initial, 'delay-1')}
        <div className="text-center anim-pop delay-3">
          <div className="font-condensed text-[34px] tracking-[0.2em] text-white/60">BAN SUPPORT</div>
          <div className={`font-condensed text-[110px] leading-none ${delta < 0 ? 'text-embrace-bright glow-blue' : delta > 0 ? 'text-ban-bright glow-red' : 'text-white'}`}>
            {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
            {Math.abs(delta)}
          </div>
          <div className="font-condensed text-[30px] tracking-[0.2em] text-white/60">PTS</div>
          <div className="text-[80px] leading-none mt-2 text-white/70">→</div>
        </div>
        {col('FINAL OPINION', d.final, 'delay-2')}
      </div>
      <div className="mt-8 anim-slam delay-4">
        <LedPanel tone={d.headline === 'flipped' ? 'gold' : 'split'} className="px-14 py-5">
          <div className="font-display text-[64px] leading-none led-text text-center">{headline}</div>
        </LedPanel>
      </div>
      <div className="mt-6 font-body text-[28px] text-white/80 text-center max-w-[1500px] anim-rise delay-5">
        {d.individuals ? (
          <>
            Of the <b>{d.individuals.both}</b> people who voted both times, <b className="text-gold">{d.individuals.changed}</b> changed their vote
            {d.individuals.changed > 0 && (
              <>
                {' '}
                (<span className="text-ban-bright">{d.individuals.toBan} → Ban</span>, <span className="text-embrace-bright">{d.individuals.toEmbrace} → Embrace</span>)
              </>
            )}
            .
          </>
        ) : (
          <>The percentages show the change in the room’s overall opinion — not how many individuals changed their minds.</>
        )}
        {d.includesSimulated && <span className="ml-3 tag bg-gold/15 text-gold border border-gold/40 text-[20px] px-4 py-0.5">INCLUDES SIMULATED VOTES</span>}
      </div>
    </div>
  );
}

// ───────────────────────── CHAMPION ─────────────────────────
function ChampionScreen({ s }: { s: PublicState }) {
  const e = s.scores.embrace;
  const b = s.scores.ban;
  const win: TeamId | null = e === b ? null : e > b ? 'embrace' : 'ban';
  return (
    <Center>
      <div className="font-condensed tracking-[0.6em] text-[44px] text-gold glow-gold anim-rise">GAMESHOW CHAMPION</div>
      {win ? (
        <div className="mt-4 anim-slam delay-1">
          <div className={`font-display text-[170px] leading-[0.9] whitespace-nowrap ${win === 'embrace' ? 'text-ai' : 'text-debate'}`}>{TEAM_NAME[win]}</div>
        </div>
      ) : (
        <div className="font-display text-[200px] leading-none mt-4 text-goldgrad anim-slam">IT’S A DRAW!</div>
      )}
      <div className="flex items-end gap-24 mt-10 anim-rise delay-3">
        <div className={`text-center ${win === 'ban' ? 'opacity-50' : ''}`}>
          <div className="font-condensed text-[150px] leading-none text-embrace-bright glow-blue">
            <AnimatedNumber value={e} />
          </div>
          <div className="font-display text-[36px]">TEAM EMBRACE</div>
        </div>
        <div className="font-condensed text-[60px] text-white/40 pb-10">PTS</div>
        <div className={`text-center ${win === 'embrace' ? 'opacity-50' : ''}`}>
          <div className="font-condensed text-[150px] leading-none text-ban-bright glow-red">
            <AnimatedNumber value={b} />
          </div>
          <div className="font-display text-[36px]">TEAM BAN</div>
        </div>
      </div>
      <div className="mt-10 font-body text-[26px] text-white/60 anim-rise delay-5">
        Decided by points across all five rounds. The audience verdict is a separate result.
      </div>
    </Center>
  );
}

// ───────────────────────── MESSAGE / FALLBACK ─────────────────────────
export function MessageScreen({ title, body }: { title: string; body: string }) {
  return (
    <Center>
      <div className="anim-slam" style={{ maxWidth: 1500 }}>
        <LedPanel tone="split" className="px-20 py-12">
          <div className="font-display text-[110px] leading-[0.95] led-text text-center">{title}</div>
        </LedPanel>
      </div>
      {body && <div className="font-body text-[40px] text-white/85 mt-10 text-center max-w-[1400px] anim-rise delay-2">{body}</div>}
    </Center>
  );
}

export const isSpinLanded = (s: PublicState) =>
  s.roulette.status === 'landed' || s.roulette.status === 'revealed' || (s.roulette.status === 'spinning' && now() >= s.roulette.startedAt + s.roulette.durationMs);
