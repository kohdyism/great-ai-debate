import type { ReactNode } from 'react';
import { AnimatedNumber, BigTimer, QR, StageScoreBar, VoteBars, Wheel, joinUrl, useRanking, wheelAngle } from '../components/Widgets';
import { Backdrop, LedPanel, MotionText, Podium, TitleLockup } from '../components/StageKit';
import { currentDebate, currentRound, currentTopic, isPractice, roundLabel, teamName, usedQuestionIds } from '../lib/engine';
import { SPEECHES, debateFlow, speechOf, speechSec } from '../lib/content';
import { useNow } from '../lib/hooks';
import type { PublicState } from '../lib/types';

const NO_SCOREBAR = new Set(['home', 'champion']);

export function StageScreen({ s }: { s: PublicState }) {
  const showBar = s.showScoreboard && !NO_SCOREBAR.has(s.screen) && !(s.screen === 'show' && s.cur.step === 'intro');
  const topic = currentTopic(s);
  const left = s.screen === 'show' || s.screen === 'scoreboard' ? `${roundLabel(s)} · ${(topic?.title ?? '').toUpperCase()}` : `ROOM ${s.roomCode}`;
  return (
    <>
      <Backdrop dim={s.screen === 'champion' ? 0.25 : 0} crowd={s.screen !== 'scoreboard'} />
      {s.screen === 'home' && <HomeScreen s={s} />}
      {s.screen !== 'home' && (
        <>
          {showBar && <StageScoreBar s={s} left={left} />}
          <div className="absolute inset-0" style={{ top: showBar ? 96 : 0 }}>
            <Body s={s} />
          </div>
        </>
      )}
    </>
  );
}

function Body({ s }: { s: PublicState }) {
  switch (s.screen) {
    case 'join':
      return <JoinScreen s={s} />;
    case 'scoreboard':
      return <ScoreboardScreen s={s} />;
    case 'champion':
      return <ChampionScreen s={s} />;
    case 'message':
      return <MessageScreen title={s.message?.title ?? ''} body={s.message?.body ?? ''} />;
    case 'show':
      return <ShowScreen s={s} />;
    default:
      return null;
  }
}

const Center = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`absolute inset-0 flex flex-col items-center justify-center ${className}`}>{children}</div>
);

// ───────────────────────── HOME (poster) ─────────────────────────
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
      <div className="absolute left-0 right-0 top-[618px] text-center text-white/90 font-body font-semibold tracking-[0.45em] text-[26px] anim-rise delay-4">WELL JOIN US AT</div>
      <div className="absolute left-0 right-0 top-[656px] anim-slam delay-5">
        <TitleLockup size={0.92} />
      </div>
      <div className="absolute left-[90px] bottom-[150px] anim-rise delay-2">
        <Podium side="for" name="" scale={0.9} />
      </div>
      <div className="absolute right-[90px] bottom-[150px] anim-rise delay-2">
        <Podium side="against" name="" scale={0.9} />
      </div>
      <div className="absolute left-0 right-0 top-[905px] flex items-center justify-center gap-8 font-display text-[40px] anim-rise delay-6">
        {s ? (
          <span className="text-white/90">
            {s.teams.length} TEAMS · {s.schedule.filter((r) => !r.practice).length} ROUNDS · <span className="text-gold glow-gold">ONE WHEEL</span>
          </span>
        ) : (
          <span className="text-white/90">
            <span className="text-embrace-bright glow-blue">FOR</span> <span className="font-condensed text-gold">VS</span> <span className="text-ban-bright glow-red">AGAINST</span>
          </span>
        )}
      </div>
      {onStart ? (
        <div className="absolute left-0 right-0 top-[975px] flex justify-center anim-pop delay-6">
          <button onClick={onStart} className="pill-gold rounded-full px-14 py-4 font-display text-[30px] tracking-[0.12em] hover:scale-105 transition">
            START THE SHOW
          </button>
        </div>
      ) : (
        s && (
          <div className="absolute left-0 right-0 top-[985px] flex justify-center">
            <div className="pill-gold rounded-full px-12 py-3 font-display text-[26px] tracking-[0.12em]">JOIN WITH ROOM CODE {s.roomCode}</div>
          </div>
        )
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
        <div className="font-body text-white/80 text-[34px] mt-4 leading-snug">Scan with your phone camera. No sign-up. You vote on who wins each debate.</div>
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
      </div>
    </div>
  );
}

// ───────────────────────── THE SHOW ─────────────────────────
function ShowScreen({ s }: { s: PublicState }) {
  const step = s.cur.step;
  if (step === 'intro') return <RoundIntro s={s} />;
  if (step === 'spin') return <SpinView s={s} />;
  if (step === 'verdict') return <VerdictView s={s} />;
  if (step === 'result') return <ResultView s={s} />;
  return <DebateView s={s} />;
}

function RoundIntro({ s }: { s: PublicState }) {
  const topic = currentTopic(s);
  const round = currentRound(s);
  const many = (round?.debates.length ?? 0) > 4;
  return (
    <Center key={s.cur.round + (s.fx?.id ?? '')}>
      <div className="font-condensed tracking-[0.5em] text-[44px] text-white/70 anim-rise">
        {roundLabel(s)}
      </div>
      <div className="mt-5 anim-slam delay-1" style={{ maxWidth: 1700 }}>
        <LedPanel tone={isPractice(s) ? 'gold' : s.cur.round % 3 === 1 ? 'blue' : s.cur.round % 3 === 2 ? 'gold' : 'red'} className="px-20 py-10">
          <div className="font-display text-[110px] leading-[0.95] uppercase led-text text-center">{topic?.title}</div>
        </LedPanel>
      </div>
      <div className="mt-10 grid gap-x-16 gap-y-3 anim-rise delay-4" style={{ gridTemplateColumns: many ? '1fr 1fr' : '1fr' }}>
        {round?.debates.map((d, i) => (
          <div key={d.id} className="flex items-center gap-4 text-[30px] font-display">
            <span className="font-condensed text-gold text-[28px] w-[150px]">DEBATE {i + 1}</span>
            <span className="text-embrace-bright">{teamName(s, d.forTeam)}</span>
            <span className="font-condensed text-white/50 text-[22px]">FOR vs AGAINST</span>
            <span className="text-ban-bright">{teamName(s, d.againstTeam)}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 font-body text-[26px] text-white/60 anim-rise delay-5">
        {isPractice(s) ? (
          <span className="text-gold">A warm-up to learn the format — no points, just practice. Audience: try voting on your phone!</span>
        ) : (
          'Every team argues FOR once and AGAINST once this round.'
        )}
      </div>
    </Center>
  );
}

function SpinView({ s }: { s: PublicState }) {
  const w = s.wheel;
  const at = useNow(w.status === 'spinning', 60);
  const topic = currentTopic(s);
  const qs = topic?.questions ?? [];
  const used = usedQuestionIds(s);
  const d = currentDebate(s);
  const usedFlags = qs.map((q) => used.has(q.id) && q.id !== d?.questionId);
  const landed = w.status === 'landed' || (w.status === 'spinning' && at >= w.startedAt + w.durationMs);
  return (
    <div className="absolute inset-0 flex">
      <div className="flex-1 flex flex-col items-center justify-center">
        <Wheel count={qs.length} used={usedFlags} angle={wheelAngle(w, at)} size={800} highlight={landed ? w.index : null} />
      </div>
      <div className="w-[760px] pr-20 flex flex-col justify-center">
        <div className="font-condensed tracking-[0.4em] text-white/60 text-[30px]">
          DEBATE {s.cur.debate + 1} OF {currentRound(s)?.debates.length}
        </div>
        <div className="font-display text-[64px] leading-[1] mt-2">
          {w.status === 'spinning' && !landed ? (
            <span className="text-gold glow-gold anim-pulse">SPINNING…</span>
          ) : landed ? (
            <span className="text-gold glow-gold">QUESTION {(w.index ?? 0) + 1}!</span>
          ) : (
            <>
              SPIN FOR THE <span className="text-goldgrad">QUESTION</span>
            </>
          )}
        </div>
        <div className="mt-10 space-y-4">
          <div className="rounded-2xl neon-blue bg-black/50 px-6 py-4">
            <div className="font-condensed tracking-[0.3em] text-embrace-bright text-[24px]">ARGUING FOR</div>
            <div className="font-display text-[46px] leading-tight">{teamName(s, d?.forTeam)}</div>
          </div>
          <div className="rounded-2xl neon-red bg-black/50 px-6 py-4">
            <div className="font-condensed tracking-[0.3em] text-ban-bright text-[24px]">ARGUING AGAINST</div>
            <div className="font-display text-[46px] leading-tight">{teamName(s, d?.againstTeam)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionPanel({ s, size = 58 }: { s: PublicState; size?: number }) {
  const d = currentDebate(s);
  const qn = d?.questionId ? (currentTopic(s)?.questions.findIndex((q) => q.id === d.questionId) ?? 0) + 1 : null;
  return (
    <div key={d?.questionId ?? ''} className="anim-slam w-full">
      <LedPanel tone="split" className="px-12 py-7">
        <div className="font-condensed tracking-[0.35em] text-gold text-[24px] text-center mb-2">
          {isPractice(s) ? 'PRACTICE · ' : ''}DEBATE {s.cur.debate + 1}
          {qn ? ` · QUESTION ${qn}` : ''}
        </div>
        <div className="font-display leading-[1.08] led-text text-center" style={{ fontSize: size }}>
          {d?.question ?? '—'}
        </div>
      </LedPanel>
    </div>
  );
}

function DebateView({ s }: { s: PublicState }) {
  const d = currentDebate(s);
  const step = s.cur.step;
  const sp = speechOf(step);
  const speaking = sp?.side ?? null;
  const flow = debateFlow(s.settings);
  const enabled = SPEECHES.filter((x) => flow.includes(x.step));
  const curIdx = flow.indexOf(step);
  return (
    <>
      <div className="absolute left-[100px] right-[100px] top-[30px]">
        <QuestionPanel s={s} />
        <div className="flex justify-center gap-2 mt-4">
          {enabled.map((x) => {
            const i = flow.indexOf(x.step);
            const now_ = x.step === step;
            const done = i < curIdx;
            return (
              <div
                key={x.step}
                className={`rounded-full px-4 py-1.5 font-condensed text-[22px] tracking-[0.12em] border transition-all ${
                  now_
                    ? x.side === 'for'
                      ? 'bg-embrace text-white border-embrace-bright shadow-[0_0_20px_rgba(31,123,255,0.8)] scale-110'
                      : 'bg-ban text-white border-ban-bright shadow-[0_0_20px_rgba(255,45,61,0.8)] scale-110'
                    : done
                      ? 'border-white/20 text-white/40'
                      : x.side === 'for'
                        ? 'border-embrace/50 text-embrace-bright/80'
                        : 'border-ban/50 text-ban-bright/80'
                }`}
              >
                {done ? '✓ ' : ''}
                {x.side.toUpperCase()} {x.kind}
              </div>
            );
          })}
        </div>
      </div>
      {speaking && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: speaking === 'for' ? 0 : undefined,
            right: speaking === 'against' ? 0 : undefined,
            top: 0,
            width: 700,
            height: 1000,
            background: `radial-gradient(40% 60% at 50% 70%, ${speaking === 'for' ? 'rgba(60,150,255,0.35)' : 'rgba(255,60,70,0.35)'}, transparent 70%)`,
          }}
        />
      )}
      <div className="absolute left-[110px] bottom-[90px]">
        <Podium side="for" name={teamName(s, d?.forTeam)} active={speaking === 'for'} dim={speaking === 'against'} scale={1.05} />
      </div>
      <div className="absolute right-[110px] bottom-[90px]">
        <Podium side="against" name={teamName(s, d?.againstTeam)} active={speaking === 'against'} dim={speaking === 'for'} scale={1.05} />
      </div>
      <div className="absolute left-[520px] right-[520px] bottom-[100px] flex flex-col items-center">
        {step === 'reveal' ? (
          <div className="text-center anim-rise pb-20">
            <div className="font-display text-[60px] text-white">GET READY…</div>
            <div className="font-body text-[28px] text-white/70 mt-3">
              {s.settings.prepSec}s to prepare · openings {s.settings.speechSec}s
              {speechSec(s.settings, 'rebuttalSec') > 0 ? ` · counters ${speechSec(s.settings, 'rebuttalSec')}s` : ''}
              {speechSec(s.settings, 'summarySec') > 0 ? ` · summaries ${speechSec(s.settings, 'summarySec')}s` : ''}
            </div>
          </div>
        ) : (
          <>
            <BigTimer t={s.timer} size={300} />
            {speaking && (
              <div className={`mt-4 font-display text-[32px] text-center uppercase ${speaking === 'for' ? 'text-embrace-bright' : 'text-ban-bright'}`}>
                {teamName(s, speaking === 'for' ? d?.forTeam : d?.againstTeam)} ·{' '}
                {sp?.kind === 'OPENING' ? 'OPENING ARGUMENT' : sp?.kind === 'COUNTER' ? 'COUNTER-ARGUMENT' : 'CLOSING SUMMARY'}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function VerdictView({ s }: { s: PublicState }) {
  const d = currentDebate(s);
  const p = s.poll && s.poll.debateId === d?.id ? s.poll : null;
  return (
    <div className="absolute inset-0 flex flex-col items-center px-[120px] pt-10">
      <QuestionPanel s={s} size={44} />
      <div className="font-display text-[90px] mt-10 leading-none">
        WHO <span className="text-goldgrad">WON?</span>
      </div>
      <div className="w-full mt-10">
        {p?.results ? (
          <div className="anim-rise">
            <VoteBars poll={p} />
          </div>
        ) : p ? (
          <div className="flex items-center justify-center gap-16">
            {s.timer.label === 'Audience vote' && <BigTimer t={s.timer} size={300} showLabel={false} />}
            <div className="text-center">
              <div className="relative font-condensed text-[180px] leading-none tabular-nums glow-white">
                <AnimatedNumber value={p.voteCount} />
                {p.voteCount > 0 && (
                  <span key={p.voteCount} className="absolute -right-24 top-0 text-[64px] text-gold glow-gold" style={{ animation: 'float-up 1.2s ease-out both' }}>
                    +1
                  </span>
                )}
              </div>
              <div className="font-condensed text-[36px] tracking-[0.35em] text-white/70">VOTES CAST</div>
              <div className="mt-3 inline-block rounded-full bg-ban px-6 py-1 font-display text-[26px] anim-pulse">● VOTE NOW ON YOUR PHONE</div>
            </div>
            <div className="flex items-center gap-6 bg-black/50 rounded-3xl p-6 neon-dim">
              <div className="bg-white rounded-xl p-2">
                <QR text={joinUrl(s.roomCode)} size={220} />
              </div>
              <div>
                <div className="font-condensed tracking-[0.3em] text-white/60 text-[24px]">ROOM</div>
                <div className="font-display text-[80px] leading-none tracking-[0.1em]">{s.roomCode}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-10 font-display text-[64px]">
            <span className="text-embrace-bright glow-blue">{teamName(s, d?.forTeam)}</span>
            <span className="font-condensed text-white/50 text-[48px]">OR</span>
            <span className="text-ban-bright glow-red">{teamName(s, d?.againstTeam)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({ s }: { s: PublicState }) {
  const d = currentDebate(s);
  if (!d) return null;
  const draw = d.winner === 'draw';
  const winSide = d.winner === d.forTeam ? 'for' : d.winner === d.againstTeam ? 'against' : null;
  return (
    <Center key={d.id + d.winner}>
      <div className="font-condensed tracking-[0.5em] text-[36px] text-white/70">
        {roundLabel(s, s.cur.round, false)} · DEBATE {s.cur.debate + 1}
      </div>
      {d.winner ? (
        draw ? (
          <div className="font-display text-[170px] leading-none text-goldgrad mt-4 anim-slam">IT’S A DRAW!</div>
        ) : (
          <>
            <div className={`font-display text-[150px] leading-[0.95] mt-4 anim-slam text-center uppercase ${winSide === 'for' ? 'text-ai' : 'text-debate'}`} style={{ maxWidth: 1700 }}>
              {teamName(s, d.winner)}
            </div>
            <div className="font-display text-[64px] mt-2 anim-rise delay-2">
              WINS ARGUING <span className={winSide === 'for' ? 'text-embrace-bright' : 'text-ban-bright'}>{winSide === 'for' ? 'FOR' : 'AGAINST'}</span>
            </div>
          </>
        )
      ) : (
        <div className="font-display text-[90px] mt-6">RESULT PENDING…</div>
      )}
      <div className="mt-8 font-condensed text-[56px] text-gold glow-gold anim-pop delay-3">
        {isPractice(s) ? 'PRACTICE — NO POINTS' : draw ? `+${s.settings.drawPoints} POINTS EACH` : d.winner ? `+${s.settings.winPoints} POINTS` : ''}
      </div>
      <div className="mt-8 max-w-[1400px] text-center font-body text-[28px] text-white/70">“{d.question}”</div>
    </Center>
  );
}

// ───────────────────────── SCOREBOARD ─────────────────────────
function ScoreboardScreen({ s }: { s: PublicState }) {
  const ranked = useRanking(s);
  const max = Math.max(1, ...ranked.map((t) => t.score));
  const big = ranked.length <= 6;
  return (
    <div className="absolute inset-0 px-[120px] pt-10">
      <div className="font-display text-[70px] text-center leading-none mb-10">
        THE <span className="text-goldgrad">LEADERBOARD</span>
      </div>
      <div className={big ? 'space-y-5' : 'space-y-2'}>
        {ranked.map((t, i) => (
          <div key={t.id} className="flex items-center gap-6 anim-rise" style={{ animationDelay: `${i * 0.12}s` }}>
            <div className={`w-[90px] font-condensed ${big ? 'text-[64px]' : 'text-[44px]'} text-center ${t.rank === 1 ? 'text-gold glow-gold' : 'text-white/60'}`}>{t.rank}</div>
            <div className={`w-[720px] font-display ${big ? 'text-[44px]' : 'text-[32px]'} uppercase truncate ${t.rank === 1 ? 'text-gold' : ''}`}>{t.name}</div>
            <div className={`flex-1 ${big ? 'h-12' : 'h-8'} rounded-full bg-white/10 overflow-hidden`}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${(t.score / max) * 100}%`, background: t.rank === 1 ? 'linear-gradient(90deg,#e0b13a,#fff3c4)' : 'linear-gradient(90deg,#1f7bff,#ff2d3d)' }}
              />
            </div>
            <div className={`w-[160px] text-right font-condensed ${big ? 'text-[72px]' : 'text-[50px]'} tabular-nums`}>
              <AnimatedNumber value={t.score} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── CHAMPION ─────────────────────────
function ChampionScreen({ s }: { s: PublicState }) {
  const ranked = useRanking(s);
  const winners = ranked.filter((t) => t.rank === 1);
  return (
    <Center>
      <div className="font-condensed tracking-[0.5em] text-[46px] text-gold glow-gold anim-rise">{winners.length > 1 ? 'JOINT CHAMPIONS' : 'CHAMPIONS OF THE GREAT AI DEBATE'}</div>
      <div className="mt-6 anim-slam delay-1 text-center" style={{ maxWidth: 1800 }}>
        {winners.map((w) => (
          <div key={w.id} className="font-display text-[150px] leading-[0.95] text-goldgrad uppercase">
            {w.name}
          </div>
        ))}
      </div>
      <div className="font-condensed text-[80px] mt-6 text-white glow-white anim-rise delay-3">{winners[0]?.score ?? 0} POINTS</div>
      <div className="flex flex-wrap justify-center gap-10 mt-10 anim-rise delay-5 max-w-[1600px]">
        {ranked
          .filter((t) => t.rank !== 1)
          .map((t) => (
            <div key={t.id} className="text-center">
              <div className="font-display text-[30px] text-white/70 uppercase">
                {t.rank}. {t.name}
              </div>
              <div className="font-condensed text-[48px] text-white/60">{t.score}</div>
            </div>
          ))}
      </div>
    </Center>
  );
}

// ───────────────────────── MESSAGE ─────────────────────────
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
