import { useState } from 'react';
import { MOTION, NEITHER_OPTION, POSITION_OPTIONS, TEAM_OPTIONS, type HostEngine } from '../lib/engine';
import { useNow } from '../lib/hooks';
import { fmtClockFull, now, timerRemaining } from '../lib/time';
import type { PollOption, PollVisibility, PrivateState, PublicState, TeamId } from '../lib/types';
import { TEAM_NAME } from '../lib/types';
import { Card, ConfirmButton, NumInput, Step } from './ui';

type P = { s: PublicState; p: PrivateState; e: HostEngine; busy: Record<string, boolean> };

const teamBtn = (t: TeamId) => (t === 'embrace' ? 'btn-blue' : 'btn-red');
const short = (t: TeamId) => (t === 'embrace' ? 'Embrace' : 'Ban');

// ═══════════════════════════ TIMER ═══════════════════════════
export function TimerPanel({ s, e }: P) {
  const t = s.timer;
  const at = useNow(t.status === 'running', 10);
  const rem = timerRemaining(t, at);
  const [custom, setCustom] = useState(45);
  const done = rem <= 0 && t.status !== 'idle';
  return (
    <Card title="Timer" right={<span className="text-[11px] text-white/50 truncate max-w-[160px]">{t.label}</span>}>
      <div className="flex items-center gap-3">
        <div className={`font-condensed text-6xl tabular-nums leading-none w-[150px] ${done ? 'text-ban anim-pulse' : rem <= 10000 && t.status === 'running' ? 'text-ban-bright' : 'text-white'}`}>
          {done ? 'TIME' : fmtClockFull(rem)}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-1.5">
          {t.status === 'running' ? (
            <button className="btn-gold col-span-2" onClick={e.timerPause}>
              ❚❚ Pause
            </button>
          ) : (
            <button className="btn-gold col-span-2" onClick={e.timerStart}>
              ▶ {t.status === 'paused' ? 'Resume' : 'Start'}
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={e.timerReset}>
            ↺ Reset
          </button>
          <div className="flex gap-1">
            <button className="btn-ghost btn-sm flex-1" onClick={() => e.timerAdd(-10)}>
              −10s
            </button>
            <button className="btn-ghost btn-sm flex-1" onClick={() => e.timerAdd(10)}>
              +10s
            </button>
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${t.totalMs ? (rem / t.totalMs) * 100 : 0}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-1 mt-2">
        {[10, 30, 60, 90].map((n) => (
          <button key={n} className="btn-ghost btn-sm" onClick={() => e.timerSetDuration(n)}>
            {n}s
          </button>
        ))}
        <NumInput value={custom} onChange={setCustom} className="!w-16" min={1} aria-label="Custom seconds" />
        <button className="btn-ghost btn-sm" onClick={() => e.timerSetDuration(custom)}>
          Set
        </button>
        <span className="mx-1 text-white/20">|</span>
        {(['embrace', 'ban'] as TeamId[]).map((tm) => (
          <button
            key={tm}
            className={`btn-sm ${t.team === tm ? teamBtn(tm) : 'btn-ghost'}`}
            onClick={() => e.update((st) => ((st.timer.team = st.timer.team === tm ? null : tm), (st.spotlight = st.timer.team)))}
          >
            {short(tm)}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ═══════════════════════════ SCORES ═══════════════════════════
export function ScorePanel({ s, e }: P) {
  const [amt, setAmt] = useState(10);
  const [reason, setReason] = useState('');
  const [bonus, setBonus] = useState(false);
  return (
    <Card title="Scores" right={<span className="text-[11px] text-white/40">awarded to: {s.round.toUpperCase()}</span>}>
      <div className="grid grid-cols-2 gap-2">
        {(['embrace', 'ban'] as TeamId[]).map((t) => (
          <div key={t} className={`rounded-lg p-2 ${t === 'embrace' ? 'bg-embrace/10 border border-embrace/40' : 'bg-ban/10 border border-ban/40'}`}>
            <div className="flex items-baseline justify-between">
              <span className={`font-display text-xs ${t === 'embrace' ? 'text-embrace-bright' : 'text-ban-bright'}`}>{TEAM_NAME[t]}</span>
              <span className="font-condensed text-4xl tabular-nums">{s.scores[t]}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {[5, 10, -5, -10].map((d) => (
                <button key={d} className={`btn-sm ${d > 0 ? teamBtn(t) : 'btn-ghost'}`} onClick={() => e.award(t, d, d > 0 ? 'Quick award' : 'Quick deduction')}>
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
            <button className={`btn-sm w-full mt-1 ${teamBtn(t)}`} onClick={() => e.award(t, amt, reason || (bonus ? 'Bonus points' : 'Points awarded'), bonus)}>
              {amt >= 0 ? '+' : ''}
              {amt} {bonus ? 'bonus' : ''} → {short(t)}
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-2 items-center">
        <NumInput value={amt} onChange={setAmt} className="!w-16" aria-label="Points amount" />
        <input className="inp !py-1" placeholder="Reason (optional)" value={reason} onChange={(ev) => setReason(ev.target.value)} />
        <label className="flex items-center gap-1 text-xs text-gold whitespace-nowrap">
          <input type="checkbox" checked={bonus} onChange={(ev) => setBonus(ev.target.checked)} /> Bonus
        </label>
      </div>
      <OverrideRow s={s} e={e} />
    </Card>
  );
}

function OverrideRow({ s, e }: { s: PublicState; e: HostEngine }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ embrace: s.scores.embrace, ban: s.scores.ban });
  if (!open)
    return (
      <div className="flex justify-between mt-2">
        <button className="text-xs text-white/50 hover:text-white underline" onClick={() => (setV({ ...s.scores }), setOpen(true))}>
          Manual override…
        </button>
        {s.scoreLog.length > 0 && (
          <button className="text-xs text-white/50 hover:text-white underline" onClick={() => e.undoScore(s.scoreLog[s.scoreLog.length - 1].id)}>
            Undo last ({s.scoreLog[s.scoreLog.length - 1].delta > 0 ? '+' : ''}
            {s.scoreLog[s.scoreLog.length - 1].delta} {short(s.scoreLog[s.scoreLog.length - 1].team)})
          </button>
        )}
      </div>
    );
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <span className="text-xs text-embrace-bright">E</span>
      <NumInput value={v.embrace} onChange={(n) => setV({ ...v, embrace: n })} className="!w-20" aria-label="Embrace score" />
      <span className="text-xs text-ban-bright">B</span>
      <NumInput value={v.ban} onChange={(n) => setV({ ...v, ban: n })} className="!w-20" aria-label="Ban score" />
      <button
        className="btn-white btn-sm"
        onClick={() => {
          e.overrideScore('embrace', v.embrace);
          e.overrideScore('ban', v.ban);
          setOpen(false);
        }}
      >
        Save
      </button>
      <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

// ═══════════════════════════ POLL ═══════════════════════════
const PRESETS = [
  'Which team made the stronger opening argument?',
  'Who won the Hot Seat?',
  "Which team handled the Devil's Advocate challenge better?",
  'Which argument was most convincing?',
  'Has your opinion about AI changed?',
  'Should universities ban AI?',
];

export function PollPanel({ s, p, e, busy }: P) {
  const poll = s.poll;
  const [sim, setSim] = useState(20);
  const [lean, setLean] = useState('random');
  const [showManual, setShowManual] = useState(false);
  const r = poll ? e.computeResults(poll.id, poll.options, p) : null;
  return (
    <Card
      title="Audience poll"
      right={
        poll && (
          <span className={`chip ${poll.status === 'open' ? 'bg-ban text-white' : 'bg-white/10 text-white/70'}`}>{poll.status === 'open' ? '● OPEN' : 'CLOSED'}</span>
        )
      }
    >
      {poll ? (
        <>
          <div className="text-sm font-semibold leading-snug">{poll.question}</div>
          <div className="text-[11px] text-white/50 mt-0.5">
            {poll.purpose === 'baseline' ? 'Baseline opinion poll' : poll.purpose === 'final' ? 'FINAL VERDICT vote' : poll.purpose === 'quiz' ? 'Audience quiz' : poll.purpose === 'audienceDecides' ? 'Audience decides' : 'Round poll'} ·{' '}
            {poll.revealed ? 'results revealed' : poll.visibility === 'live' ? 'live results on stage' : 'results hidden from audience & stage'}
          </div>
          <div className="mt-2 space-y-1">
            {poll.options.map((o) => {
              const n = r!.counts[o.id] ?? 0;
              const pc = r!.total ? (n / r!.total) * 100 : 0;
              return (
                <div key={o.id} className="text-xs">
                  <div className="flex justify-between">
                    <span>{o.label}</span>
                    <span className="tabular-nums">
                      <b>{n}</b> · {Math.round(pc)}%
                      <span className="text-white/40 ml-1">
                        ({r!.real[o.id] ?? 0} real{r!.simulated[o.id] ? `, ${r!.simulated[o.id]} sim` : ''}
                        {r!.manual[o.id] ? `, ${r!.manual[o.id]} hands` : ''})
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${pc}%`, background: o.id === 'embrace' || o.id === 'fact' ? '#1f7bff' : o.id === 'ban' || o.id === 'fiction' ? '#ff2d3d' : '#aaa' }} />
                  </div>
                </div>
              );
            })}
            <div className="text-[11px] text-white/50">Total {r!.total} · Host view (always visible to you)</div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {poll.status === 'open' ? (
              <button className="btn-gold col-span-2" disabled={busy.closePoll} onClick={() => void e.closePoll()}>
                ■ Close voting
              </button>
            ) : poll.revealed ? (
              <button className="btn-ghost col-span-2" onClick={e.hidePoll}>
                Hide results
              </button>
            ) : (
              <button className="btn-gold col-span-2" onClick={e.revealPoll}>
                ★ Reveal results
              </button>
            )}
            <button className="btn-ghost" onClick={() => e.setScreen('poll')}>
              On stage
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <label className="text-[11px] text-white/50">Results:</label>
            <select className="inp !py-1 !w-auto text-xs" value={poll.visibility} onChange={(ev) => e.setPollVisibility(ev.target.value as PollVisibility)}>
              <option value="hidden">Hidden until I reveal</option>
              <option value="live">Displayed live</option>
              <option value="after">Auto-reveal when closed</option>
            </select>
            <ConfirmButton className="btn-danger btn-sm ml-auto" msg="Reset this poll? All its votes will be deleted and voting reopens." onConfirm={() => void e.resetPoll()}>
              Reset
            </ConfirmButton>
          </div>
          {poll.status === 'open' && (
            <div className="mt-2 rounded-lg bg-gold/5 border border-gold/20 p-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gold font-semibold">SIMULATE</span>
                <NumInput value={sim} onChange={setSim} min={1} className="!w-14" aria-label="Number of simulated votes" />
                <select className="inp !py-1 !w-auto text-xs" value={lean} onChange={(ev) => setLean(ev.target.value)}>
                  <option value="random">random</option>
                  {poll.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      lean {o.label}
                    </option>
                  ))}
                </select>
                <button className="btn-ghost btn-sm" onClick={() => e.simulateVotes(sim, lean)}>
                  Add votes
                </button>
              </div>
              <div className="text-[10px] text-white/40 mt-1">Simulated votes are always labelled on stage. {s.backend === 'supabase' && 'You are in LIVE mode — use only for rehearsal.'}</div>
            </div>
          )}
          <button className="text-[11px] text-white/50 underline mt-2" onClick={() => setShowManual(!showManual)}>
            {showManual ? 'Hide' : 'Show-of-hands fallback'} (if phones fail)
          </button>
          {showManual && (
            <div className="flex flex-wrap gap-2 mt-1">
              {poll.options.map((o) => (
                <label key={o.id} className="text-xs flex items-center gap-1">
                  {o.label}
                  <NumInput value={p.manual[poll.id]?.[o.id] ?? 0} min={0} onChange={(n) => e.setManualCount(o.id, n)} className="!w-16" aria-label={`Hands for ${o.label}`} />
                </label>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-white/50">No poll yet.</div>
      )}
      <NewPoll s={s} e={e} />
    </Card>
  );
}

function NewPoll({ s, e }: { s: PublicState; e: HostEngine }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(PRESETS[0]);
  const [kind, setKind] = useState<'teams' | 'position' | 'custom'>('teams');
  const [neither, setNeither] = useState(true);
  const [custom, setCustom] = useState('Yes\nNo');
  const [vis, setVis] = useState<PollVisibility>('hidden');
  const disabled = s.poll?.status === 'open';
  if (!open)
    return (
      <button className="btn-ghost w-full mt-3" disabled={disabled} onClick={() => setOpen(true)} title={disabled ? 'Close the current poll first' : ''}>
        + New poll
      </button>
    );
  const options = (): PollOption[] =>
    kind === 'teams'
      ? [...TEAM_OPTIONS, ...(neither ? [NEITHER_OPTION] : [])]
      : kind === 'position'
        ? POSITION_OPTIONS
        : custom
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 6)
            .map((label, i) => ({ id: `o${i}`, label }));
  return (
    <div className="mt-3 rounded-lg border border-white/10 p-2 space-y-1.5">
      <select className="inp !py-1 text-xs" value={PRESETS.includes(q) ? q : ''} onChange={(ev) => ev.target.value && setQ(ev.target.value)}>
        <option value="">— preset questions —</option>
        {PRESETS.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <input className="inp !py-1" value={q} onChange={(ev) => setQ(ev.target.value)} aria-label="Poll question" />
      <div className="flex gap-1 text-xs">
        {(['teams', 'position', 'custom'] as const).map((k) => (
          <button key={k} className={`btn-sm ${kind === k ? 'btn-white' : 'btn-ghost'}`} onClick={() => setKind(k)}>
            {k === 'teams' ? 'Team Embrace / Team Ban' : k === 'position' ? 'Ban AI / Embrace AI' : 'Custom'}
          </button>
        ))}
      </div>
      {kind === 'teams' && (
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={neither} onChange={(ev) => setNeither(ev.target.checked)} /> Include “Neither / Both equally”
        </label>
      )}
      {kind === 'custom' && <textarea className="inp text-xs" rows={3} value={custom} onChange={(ev) => setCustom(ev.target.value)} aria-label="One option per line" />}
      <div className="flex items-center gap-1.5">
        <select className="inp !py-1 !w-auto text-xs" value={vis} onChange={(ev) => setVis(ev.target.value as PollVisibility)}>
          <option value="hidden">Results hidden</option>
          <option value="live">Results live</option>
          <option value="after">Reveal on close</option>
        </select>
        <button
          className="btn-gold btn-sm ml-auto"
          onClick={() => {
            e.openPoll({ question: q, options: options(), purpose: 'round', visibility: vis });
            setOpen(false);
          }}
        >
          Open poll
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════ ROUND PANELS ═══════════════════════════
interface StepDef {
  label: string;
  sec: number;
  team: TeamId | null;
}

function StepRunner({ s, e, steps, start = 1 }: { s: PublicState; e: HostEngine; steps: StepDef[]; start?: number }) {
  return (
    <div className="space-y-1">
      {steps.map((st, i) => {
        const active = s.timer.label === st.label;
        return (
          <Step key={st.label} n={i + start} label={`${st.label}${st.sec ? ` · ${st.sec}s` : ''}`} active={active}>
            {st.team && <span className={`w-2 h-2 rounded-full ${st.team === 'embrace' ? 'bg-embrace' : 'bg-ban'}`} />}
            <button className="btn-ghost btn-sm" onClick={() => e.runStep(st.label, st.sec, st.team, false)} title="Load timer, don't start">
              Load
            </button>
            <button className="btn-gold btn-sm" onClick={() => e.runStep(st.label, st.sec, st.team, true)} title="Load and start now">
              ▶ Go
            </button>
          </Step>
        );
      })}
    </div>
  );
}

function TeamPoll({ s, e, question, points, reason, bonus = false }: { s: PublicState; e: HostEngine; question: string; points: number; reason: string; bonus?: boolean }) {
  const [neither, setNeither] = useState(true);
  const mine = s.poll?.question === question ? s.poll : null;
  return (
    <div className="rounded-lg border border-white/10 p-2 mt-2">
      <div className="text-xs text-white/60 mb-1">Audience vote: “{question}”</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={neither} onChange={(ev) => setNeither(ev.target.checked)} /> Neither option
        </label>
        <button
          className="btn-gold btn-sm"
          disabled={s.poll?.status === 'open'}
          onClick={() => e.openPoll({ question, options: [...TEAM_OPTIONS, ...(neither ? [NEITHER_OPTION] : [])], purpose: 'round', visibility: 'hidden' })}
        >
          Open vote
        </button>
        {mine && mine.status === 'open' && (
          <button className="btn-white btn-sm" onClick={() => void e.closePoll()}>
            Close
          </button>
        )}
        {mine && mine.status === 'closed' && !mine.revealed && (
          <button className="btn-white btn-sm" onClick={e.revealPoll}>
            Reveal
          </button>
        )}
        {mine && mine.status === 'closed' && (
          <button className="btn-gold btn-sm" onClick={() => e.awardPollWinner(points, reason)}>
            Award winner {bonus ? 'bonus ' : ''}+{points}
          </button>
        )}
      </div>
    </div>
  );
}

export function RoundPanel(props: P) {
  const { s } = props;
  switch (s.round) {
    case 'pre':
      return <PrePanel {...props} />;
    case 'r1':
      return <R1Panel {...props} />;
    case 'r2':
      return <R2Panel {...props} />;
    case 'r3':
      return <R3Panel {...props} />;
    case 'roulette':
      return <RoulettePanel {...props} />;
    case 'r4':
      return <R4Panel {...props} />;
    case 'r5':
      return <R5Panel {...props} />;
  }
}

function PrePanel({ s, e }: P) {
  const bp = s.baselinePollId ? (s.poll?.id === s.baselinePollId ? s.poll : s.pollHistory.find((x) => x.id === s.baselinePollId)) : null;
  return (
    <Card title="Pre-show · Join the jury">
      <div className="space-y-1">
        <Step n={1} label="Opening title screen" active={s.screen === 'home'}>
          <button className="btn-ghost btn-sm" onClick={() => e.setScreen('home')}>
            Show
          </button>
        </Step>
        <Step n={2} label="START THE SHOW → join screen with QR code" active={s.screen === 'join'} done={s.status !== 'lobby'}>
          <button className="btn-gold btn-sm" onClick={e.startShow}>
            Start
          </button>
        </Step>
        <Step n={3} label="Baseline poll: “Should AI be banned from universities?” (results hidden)" done={!!bp && bp.status === 'closed'} active={bp?.status === 'open'}>
          {!bp || bp.status !== 'open' ? (
            <button className="btn-gold btn-sm" disabled={s.poll?.status === 'open'} onClick={e.openBaselinePoll}>
              {bp ? 'Re-open new' : 'Open'}
            </button>
          ) : (
            <button className="btn-white btn-sm" onClick={() => void e.closePoll()}>
              Close
            </button>
          )}
        </Step>
        <Step n={4} label="Go to Round 1 · The Opening Gambit">
          <button className="btn-ghost btn-sm" onClick={() => e.goRound('r1')}>
            Go →
          </button>
        </Step>
      </div>
      <p className="text-[11px] text-white/45 mt-2">Tip: keep the baseline results hidden — the Opinion Shift reveal in Round 5 is more dramatic.</p>
    </Card>
  );
}

function R1Panel({ s, p, e }: P) {
  const st = p.content.settings;
  return (
    <Card title="Round 1 · The Opening Gambit">
      <div className="flex gap-1.5 mb-2">
        <button className="btn-ghost btn-sm" onClick={() => e.setScreen('roundIntro')}>
          Title card
        </button>
        <button className="btn-white btn-sm" onClick={() => e.setScreen('teams')}>
          Podiums screen
        </button>
      </div>
      <div className="space-y-1">
        <Step n={1} label="Introduce Team Embrace" active={s.spotlight === 'embrace' && /intro/i.test(s.phase)}>
          <button className="btn-blue btn-sm" onClick={() => e.update((x) => ((x.screen = 'teams'), (x.spotlight = 'embrace'), (x.phase = 'Intro Team Embrace'), (x.timer = { ...x.timer, status: 'idle', startedAt: null, baseMs: x.timer.totalMs })))}>
            Spotlight
          </button>
        </Step>
        <Step n={2} label="Introduce Team Ban" active={s.spotlight === 'ban' && /intro/i.test(s.phase)}>
          <button className="btn-red btn-sm" onClick={() => e.update((x) => ((x.screen = 'teams'), (x.spotlight = 'ban'), (x.phase = 'Intro Team Ban'), (x.timer = { ...x.timer, status: 'idle', startedAt: null, baseMs: x.timer.totalMs })))}>
            Spotlight
          </button>
        </Step>
      </div>
      <div className="mt-2">
        <StepRunner
          s={s}
          e={e}
          start={3}
          steps={[
            { label: 'Team Embrace · Opening statement', sec: st.openingSec, team: 'embrace' },
            { label: 'Team Ban · Opening statement', sec: st.openingSec, team: 'ban' },
          ]}
        />
      </div>
      <TeamPoll s={s} e={e} question="Which team made the stronger opening argument?" points={st.pollPoints} reason="Won the Opening Gambit audience vote" />
    </Card>
  );
}

function R2Panel({ s, p, e }: P) {
  const c = s.card;
  const item = p.content.facts.find((f) => f.id === c.id);
  const [pickId, setPickId] = useState('');
  const [autoAward, setAutoAward] = useState(true);
  return (
    <Card title="Round 2 · Fact or Fiction?">
      <div className="flex flex-wrap gap-1.5">
        <button className="btn-gold btn-sm" onClick={() => e.fofDraw('fact')}>
          🎲 Random factual
        </button>
        <button className="btn-ghost btn-sm" onClick={() => e.fofDraw('debate')}>
          🎲 Random debate statement
        </button>
        <select className="inp !py-1 !w-auto text-xs max-w-[260px]" value={pickId} onChange={(ev) => setPickId(ev.target.value)}>
          <option value="">Choose a specific statement…</option>
          {p.content.facts.map((f) => (
            <option key={f.id} value={f.id}>
              {p.used[f.id] ? '✓ ' : ''}
              {f.kind === 'fact' ? '[F] ' : '[D] '}
              {f.statement.slice(0, 70)}
            </option>
          ))}
        </select>
        <button className="btn-ghost btn-sm" disabled={!pickId} onClick={() => e.fofDraw('any', pickId)}>
          Show
        </button>
      </div>
      {c.kind === 'fact' || c.kind === 'debate' ? (
        <div className="mt-2 rounded-lg bg-black/40 border border-white/10 p-2">
          <div className="text-sm font-semibold">{c.text}</div>
          <div className="text-xs mt-1">
            {item?.kind === 'fact' ? (
              <>
                <span className="text-white/50">Answer (host only): </span>
                <b className="text-gold">{item.answer}</b>
              </>
            ) : (
              <span className="chip bg-gold/20 text-gold">DEBATE STATEMENT — no objective answer</span>
            )}
          </div>
          {c.kind === 'fact' && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(['embrace', 'ban'] as TeamId[]).map((t) => (
                <div key={t} className="flex items-center gap-1">
                  <span className={`text-xs w-14 ${t === 'embrace' ? 'text-embrace-bright' : 'text-ban-bright'}`}>{short(t)}</span>
                  {(['FACT', 'FICTION'] as const).map((a) => (
                    <button key={a} className={`btn-sm ${c.locks[t] === a ? teamBtn(t) : 'btn-ghost'}`} onClick={() => e.fofLock(t, c.locks[t] === a ? null : a)} disabled={c.locksRevealed}>
                      {a}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <button className="btn-gold btn-sm" disabled={c.locksRevealed} onClick={() => e.fofReveal(autoAward)}>
              ★ Reveal {c.kind === 'fact' ? 'answer' : 'explanation'}
            </button>
            {c.kind === 'fact' && (
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={autoAward} onChange={(ev) => setAutoAward(ev.target.checked)} /> Auto-award +{c.points} to correct teams
              </label>
            )}
            <button className="btn-ghost btn-sm" disabled={s.poll?.status === 'open'} onClick={e.fofAudienceQuiz}>
              📱 Audience plays along
            </button>
            <button className="btn-ghost btn-sm" onClick={() => e.runStep('Discussion', 30, null, true)}>
              30s discussion
            </button>
          </div>
          {c.kind === 'debate' && (
            <div className="flex gap-1.5 mt-2">
              {(['embrace', 'ban'] as TeamId[]).map((t) => (
                <button key={t} className={`${teamBtn(t)} btn-sm`} onClick={() => e.award(t, c.points, 'Best argument: debate statement')}>
                  Best argument → {short(t)} +{c.points}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/50 mt-2">Draw a statement to put it on the LED wall. Factual items have a verifiable answer; debate statements are labelled as opinions.</p>
      )}
    </Card>
  );
}

function R3Panel({ s, p, e }: P) {
  const st = p.content.settings;
  const [pickId, setPickId] = useState('');
  return (
    <Card title="Round 3 · The Hot Seat">
      <div className="flex flex-wrap gap-1.5">
        <button className="btn-gold btn-sm" onClick={() => e.hotDraw()}>
          🎲 Random scenario
        </button>
        <select className="inp !py-1 !w-auto text-xs max-w-[300px]" value={pickId} onChange={(ev) => setPickId(ev.target.value)}>
          <option value="">Choose a scenario…</option>
          {p.content.scenarios.map((x) => (
            <option key={x.id} value={x.id}>
              {p.used[x.id] ? '✓ ' : ''}
              {x.text.slice(0, 80)}
            </option>
          ))}
        </select>
        <button className="btn-ghost btn-sm" disabled={!pickId} onClick={() => e.hotDraw(pickId)}>
          Show
        </button>
      </div>
      {s.card.kind === 'scenario' && <div className="mt-2 text-sm font-semibold rounded-lg bg-black/40 border border-white/10 p-2">{s.card.text}</div>}
      <div className="mt-2">
        <StepRunner
          s={s}
          e={e}
          steps={[
            { label: 'Preparation (both teams)', sec: st.prepSec, team: null },
            { label: 'Team Embrace responds', sec: st.responseSec, team: 'embrace' },
            { label: 'Team Ban challenges', sec: st.challengeSec, team: 'ban' },
            { label: 'Team Ban responds', sec: st.responseSec, team: 'ban' },
            { label: 'Team Embrace challenges', sec: st.challengeSec, team: 'embrace' },
          ]}
        />
      </div>
      <TeamPoll s={s} e={e} question="Who won the Hot Seat?" points={s.card.points || st.pollPoints} reason="Won the Hot Seat audience vote" />
    </Card>
  );
}

function R4Panel({ s, p, e }: P) {
  const st = p.content.settings;
  const d = s.card.kind === 'devil' ? s.card.devil ?? {} : {};
  return (
    <Card title="Round 4 · The Devil's Advocate">
      <div className="flex flex-wrap gap-1.5">
        <button className="btn-gold btn-sm" onClick={() => e.devilAssign()}>
          🎲 Assign challenges to both teams
        </button>
        <button className="btn-ghost btn-sm" disabled={s.card.kind !== 'devil'} onClick={() => e.devilAssign('embrace')}>
          Re-roll Embrace
        </button>
        <button className="btn-ghost btn-sm" disabled={s.card.kind !== 'devil'} onClick={() => e.devilAssign('ban')}>
          Re-roll Ban
        </button>
      </div>
      {s.card.kind === 'devil' && (
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <div className="rounded-lg bg-embrace/10 border border-embrace/30 p-2">
            <b className="text-embrace-bright">Embrace must argue:</b> {d.embrace}
          </div>
          <div className="rounded-lg bg-ban/10 border border-ban/30 p-2">
            <b className="text-ban-bright">Ban must argue:</b> {d.ban}
          </div>
        </div>
      )}
      <div className="mt-2">
        <StepRunner
          s={s}
          e={e}
          steps={[
            { label: 'Preparation (both teams) ', sec: st.prepSec, team: null },
            { label: "Team Ban plays devil's advocate", sec: st.responseSec, team: 'ban' },
            { label: 'Team Embrace challenges ', sec: st.challengeSec, team: 'embrace' },
            { label: "Team Embrace plays devil's advocate", sec: st.responseSec, team: 'embrace' },
            { label: 'Team Ban challenges ', sec: st.challengeSec, team: 'ban' },
          ]}
        />
      </div>
      <TeamPoll s={s} e={e} question="Which team handled the Devil's Advocate challenge better?" points={st.devilBonus} reason="Devil's Advocate bonus (audience vote)" bonus />
    </Card>
  );
}

function RoulettePanel({ s, p, e }: P) {
  const r = s.roulette;
  const cats = p.content.roulette;
  const st = p.content.settings;
  const at = useNow(r.status === 'spinning', 5);
  const spinning = r.status === 'spinning' && at < r.startedAt + r.durationMs + 200;
  const cat = r.categoryIndex != null ? cats[r.categoryIndex] : null;
  const [forceIdx, setForceIdx] = useState(0);
  const [qid, setQid] = useState('');
  const [pts, setPts] = useState(st.roulettePoints);
  const answering = r.team;
  return (
    <Card title="AI Roulette">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn-gold btn-lg" disabled={spinning} onClick={() => e.spin()}>
          {spinning ? 'Spinning…' : r.status === 'idle' ? '🎡 SPIN' : '🎡 RE-SPIN'}
        </button>
        <select className="inp !py-1 !w-auto text-xs" value={forceIdx} onChange={(ev) => setForceIdx(Number(ev.target.value))} aria-label="Manual category">
          {cats.map((c, i) => (
            <option key={c.id} value={i}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn-ghost btn-sm" disabled={spinning} onClick={() => e.spin(forceIdx)} title="Spin animation that lands on this category">
          Spin to it
        </button>
        <button className="btn-ghost btn-sm" disabled={spinning} onClick={() => e.rouletteSetCategory(forceIdx)} title="No spin, jump straight to it">
          Set directly
        </button>
        <button className="btn-ghost btn-sm ml-auto" onClick={() => e.setScreen('roulette')}>
          Wheel on stage
        </button>
      </div>
      {cat && !spinning && (
        <div className="mt-2 rounded-lg bg-black/40 border border-gold/30 p-2">
          <div className="flex items-center gap-2">
            <span className="font-display text-gold">{cat.name}</span>
            <span className="text-xs text-white/50">{cat.blurb}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <button className="btn-gold btn-sm" onClick={() => e.rouletteReveal()}>
              ★ Reveal random challenge
            </button>
            <select className="inp !py-1 !w-auto text-xs max-w-[260px]" value={qid} onChange={(ev) => setQid(ev.target.value)}>
              <option value="">…or pick one</option>
              {cat.questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {p.used[q.id] ? '✓ ' : ''}
                  {q.text.slice(0, 70)}
                </option>
              ))}
            </select>
            <button className="btn-ghost btn-sm" disabled={!qid} onClick={() => e.rouletteReveal(qid)}>
              Reveal
            </button>
            <button className="btn-danger btn-sm ml-auto" onClick={e.rouletteSkip}>
              Skip challenge
            </button>
          </div>
          {r.status === 'revealed' && (
            <>
              <div className="text-sm font-semibold mt-2">{r.question}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-xs text-white/50">Answering:</span>
                {(['embrace', 'ban'] as TeamId[]).map((t) => (
                  <button key={t} className={`btn-sm ${answering === t ? teamBtn(t) : 'btn-ghost'}`} onClick={() => e.rouletteSetTeam(t)}>
                    {short(t)}
                  </button>
                ))}
                {cat.mode === 'audience' && (
                  <>
                    <button className="btn-gold btn-sm" disabled={s.poll?.status === 'open'} onClick={e.rouletteAudienceVote}>
                      📱 Audience vote: who answers?
                    </button>
                    {s.poll?.purpose === 'audienceDecides' && s.poll.status === 'open' && (
                      <button className="btn-white btn-sm" onClick={() => void e.closePoll()}>
                        Close vote
                      </button>
                    )}
                    {s.poll?.purpose === 'audienceDecides' && s.poll.status === 'closed' && (
                      <button className="btn-white btn-sm" onClick={e.rouletteApplyAudience}>
                        Apply result → back to wheel
                      </button>
                    )}
                  </>
                )}
              </div>
              {cat.mode === 'double' && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 rounded-md bg-gold/10 p-1.5">
                  <span className="text-xs text-gold font-semibold">STAKE</span>
                  <NumInput value={r.stake} onChange={e.rouletteSetStake} min={0} className="!w-16" aria-label="Stake" />
                  <button className="btn-gold btn-sm" disabled={!answering} onClick={() => e.rouletteDouble(true)}>
                    WON: +{r.stake * 2}
                  </button>
                  <button className="btn-danger btn-sm" disabled={!answering} onClick={() => e.rouletteDouble(false)}>
                    LOST: −{r.stake}
                  </button>
                </div>
              )}
              <div className="mt-2">
                <StepRunner
                  s={s}
                  e={e}
                  steps={
                    cat.mode === 'ten'
                      ? [{ label: '10-second answer', sec: st.tenSec, team: answering }]
                      : [
                          { label: 'Roulette · Preparation', sec: st.prepSec, team: answering },
                          { label: 'Roulette · Response', sec: st.responseSec, team: answering },
                          { label: 'Roulette · Opponent challenges', sec: st.challengeSec, team: answering ? (answering === 'embrace' ? 'ban' : 'embrace') : null },
                        ]
                  }
                />
              </div>
              {cat.mode !== 'double' && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <NumInput value={pts} onChange={setPts} className="!w-16" aria-label="Roulette points" />
                  {(['embrace', 'ban'] as TeamId[]).map((t) => (
                    <button key={t} className={`${teamBtn(t)} btn-sm`} onClick={() => e.award(t, pts, `AI Roulette: ${cat.name}`)}>
                      +{pts} {short(t)}
                    </button>
                  ))}
                  {(['embrace', 'ban'] as TeamId[]).map((t) => (
                    <button key={t + 'd'} className="btn-ghost btn-sm" onClick={() => e.award(t, -pts, `AI Roulette penalty: ${cat.name}`)}>
                      −{pts} {short(t)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function R5Panel({ s, p, e, busy }: P) {
  const st = p.content.settings;
  const fp = s.finalPollId ? (s.poll?.id === s.finalPollId ? s.poll : s.pollHistory.find((x) => x.id === s.finalPollId)) : null;
  const finalOpen = fp?.status === 'open';
  const finalClosed = fp?.status === 'closed';
  return (
    <Card title="Round 5 · The Final Verdict">
      <div className="space-y-1">
        <Step n={1} label={`Display the proposition: “${MOTION}”`} active={s.screen === 'final'}>
          <button className="btn-ghost btn-sm" onClick={() => e.setScreen('final')}>
            Show
          </button>
        </Step>
      </div>
      <div className="mt-1">
        <StepRunner
          s={s}
          e={e}
          start={2}
          steps={[
            { label: 'Team Embrace · Closing statement', sec: st.closingSec, team: 'embrace' },
            { label: 'Team Ban · Closing statement', sec: st.closingSec, team: 'ban' },
          ]}
        />
      </div>
      <div className="space-y-1 mt-1">
        <Step n={4} label="Open the FINAL audience vote" active={finalOpen} done={finalClosed}>
          {!finalOpen ? (
            <button className="btn-gold btn-sm" disabled={s.poll?.status === 'open'} onClick={() => (!fp || window.confirm('Open a NEW final vote? The previous final vote will be replaced.')) && e.openFinalPoll()}>
              {fp ? 'Re-open new' : 'Open'}
            </button>
          ) : (
            <button className="btn-white btn-sm" disabled={busy.closePoll} onClick={() => void e.closePoll()}>
              Close voting
            </button>
          )}
        </Step>
        <Step n={5} label="Dim the room · 10-second countdown → reveal audience verdict" active={s.screen === 'countdown'} done={s.verdictRevealed}>
          <button className="btn-gold btn-sm" disabled={!fp} onClick={() => void e.startVerdictCountdown(10)}>
            ▶ Countdown
          </button>
          <button className="btn-ghost btn-sm" disabled={!fp} onClick={() => void e.revealVerdict()}>
            Reveal now
          </button>
        </Step>
        <Step n={6} label="Opinion Shift: compare the opening poll with the final vote" active={s.screen === 'shift'} done={!!s.shift}>
          <button className="btn-ghost btn-sm" disabled={!s.baselinePollId || !s.finalPollId || busy.shift} onClick={() => void e.computeShift()}>
            {busy.shift ? '…' : 'Show shift'}
          </button>
        </Step>
        <Step n={7} label="Announce the gameshow champion (by points)" active={s.screen === 'champion'} done={s.championRevealed}>
          <button className="btn-ghost btn-sm" onClick={() => e.setScreen('scoreboard')}>
            Scoreboard
          </button>
          <button className="btn-gold btn-sm" onClick={e.revealChampion}>
            🏆 Champion
          </button>
        </Step>
      </div>
      {!s.baselinePollId && <p className="text-[11px] text-gold mt-2">No baseline poll was taken — the Opinion Shift needs one (Pre-show step 3).</p>}
      <p className="text-[11px] text-white/45 mt-2">
        Two separate results: the <b>champion</b> is decided by points; the <b>audience verdict</b> by the final vote.
      </p>
    </Card>
  );
}

export const nowTs = now;
