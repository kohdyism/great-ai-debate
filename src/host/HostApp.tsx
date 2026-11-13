import { useEffect, useState } from 'react';
import { currentDebate, currentTopic, getEngine, nextLabel, teamName, type HostEngine } from '../lib/engine';
import { useHost, useNow } from '../lib/hooks';
import { unlockAudio } from '../lib/sound';
import { fmtClockFull, timerRemaining } from '../lib/time';
import type { PrivateState, PublicState, Step } from '../lib/types';
import { QR, joinUrl, useRanking } from '../components/Widgets';
import { Card, ConfirmButton, StagePreview } from './ui';
import Setup from './Setup';

type Tab = 'run' | 'setup';

export default function HostApp() {
  const e = getEngine();
  const { state: s, priv: p, conn, lastPushOk, ready, toasts } = useHost();
  const [tab, setTab] = useState<Tab>(() => (e.state.status === 'lobby' && e.state.scoreLog.length === 0 ? 'setup' : 'run'));

  useEffect(() => {
    void e.init();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.code === 'Space') {
        ev.preventDefault();
        e.state.timer.status === 'running' ? e.timerPause() : e.timerStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      e.destroy();
    };
  }, [e]);

  const stageUrl = `${location.origin}${location.pathname}#/stage/${s.roomCode}`;
  const good = s.backend === 'supabase' && ready && lastPushOk && conn === 'online';

  return (
    <div className="min-h-screen bg-[#070910] text-white">
      <header className="sticky top-0 z-40 bg-[#070910]/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-2 flex-wrap">
          <div className="font-display leading-[0.85] text-[15px]">
            <div>THE GREAT</div>
            <div>
              <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
            </div>
          </div>
          <nav className="flex gap-1 ml-3">
            <button onClick={() => setTab('setup')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'setup' ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}>
              ✎ Setup
            </button>
            <button onClick={() => setTab('run')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'run' ? 'bg-gold text-black' : 'bg-white/5 hover:bg-white/10'}`}>
              ▶ Run the show
            </button>
          </nav>
          <div className="flex-1" />
          <span className="text-[11px] text-white/40">ROOM</span>
          <span className="font-display tracking-[0.15em] text-lg">{s.roomCode}</span>
          {s.backend === 'demo' ? (
            <span className="chip bg-gold/15 text-gold border border-gold/30" title="No Supabase keys: Host and Stage sync on this computer only. Phones cannot vote.">
              DEMO · phones can’t vote
            </span>
          ) : (
            <span className={`chip ${good ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-ban/20 text-ban-bright border border-ban/40 anim-pulse'}`}>
              {!ready ? 'Connecting…' : good ? '● LIVE · phones connected' : 'Reconnecting…'}
            </span>
          )}
          <span className="chip bg-white/10" title="Audience members joined">
            👥 {s.audience.real}
            {s.audience.simulated ? ` +${s.audience.simulated} sim` : ''}
          </span>
          <a href={stageUrl} target="gad-stage" className="btn-white btn-sm">
            ⧉ Open projector screen
          </a>
          <button className="btn-ghost btn-sm" onClick={e.toggleSound}>
            {s.sound ? '🔊' : '🔇'}
          </button>
        </div>
      </header>

      {tab === 'setup' ? <Setup s={s} e={e} onDone={() => setTab('run')} /> : <Run s={s} p={p} e={e} />}

      <div className="fixed top-16 right-4 z-50 space-y-2 w-[min(420px,90vw)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-lg px-4 py-2 text-sm shadow-xl border anim-rise ${
              t.tone === 'error' ? 'bg-ban/90 border-ban' : t.tone === 'warn' ? 'bg-[#3a2c05] border-gold/50 text-gold' : t.tone === 'ok' ? 'bg-emerald-900/90 border-emerald-500/50' : 'bg-[#141828] border-white/15'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════ RUN ═══════════════════════════
const STEPS: { id: Step; label: string }[] = [
  { id: 'spin', label: 'Spin' },
  { id: 'reveal', label: 'Question' },
  { id: 'prep', label: 'Prep' },
  { id: 'for', label: 'FOR speaks' },
  { id: 'against', label: 'AGAINST speaks' },
  { id: 'verdict', label: 'Who won?' },
  { id: 'result', label: 'Result' },
];

function Run({ s, p, e }: { s: PublicState; p: PrivateState; e: HostEngine }) {
  const d = currentDebate(s);
  const onShow = s.screen === 'show';
  const stepIdx = STEPS.findIndex((x) => x.id === s.cur.step);
  const spinning = useNow(s.wheel.status === 'spinning', 5) < s.wheel.startedAt + s.wheel.durationMs && s.wheel.status === 'spinning';
  const label = nextLabel(s);
  const blocked = (onShow && s.cur.step === 'verdict' && !d?.winner) || spinning || s.screen === 'champion';

  return (
    <div className="grid grid-cols-[270px_minmax(0,1fr)_300px] gap-3 p-3 items-start">
      {/* LEFT — schedule */}
      <Card title="Schedule · click to jump">
        <div className="space-y-3">
          {s.schedule.map((r, ri) => {
            const topic = s.topics.find((t) => t.id === r.topicId);
            return (
              <div key={ri}>
                <button
                  onClick={() => e.goRound(ri)}
                  className={`w-full text-left font-display text-xs px-2 py-1 rounded ${s.cur.round === ri && s.cur.step === 'intro' && onShow ? 'bg-gold text-black' : 'text-gold hover:bg-white/5'}`}
                >
                  ROUND {ri + 1} · {topic?.title}
                </button>
                <div className="mt-1 space-y-1">
                  {r.debates.map((db, di) => {
                    const active = s.cur.round === ri && s.cur.debate === di && s.cur.step !== 'intro';
                    return (
                      <button
                        key={db.id}
                        onClick={() => e.goDebate(ri, di)}
                        className={`w-full text-left rounded-md px-2 py-1.5 text-xs border ${active ? 'border-gold bg-gold/10' : 'border-transparent hover:bg-white/5'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/40 w-4">{di + 1}</span>
                          <span className="text-embrace-bright truncate">{teamName(s, db.forTeam)}</span>
                          <span className="text-white/30">v</span>
                          <span className="text-ban-bright truncate">{teamName(s, db.againstTeam)}</span>
                          <span className="ml-auto">{db.winner ? '✓' : active ? '▶' : ''}</span>
                        </div>
                        {db.winner && <div className="text-[10px] text-white/50 pl-5">{db.winner === 'draw' ? 'Draw' : `${teamName(s, db.winner)} won`}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* CENTRE — now playing + NEXT */}
      <div className="space-y-3 min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-stretch">
          <StagePreview s={s} />
          <div className="h-card p-4 flex flex-col">
            <div className="h-title">
              Round {s.cur.round + 1} · {currentTopic(s)?.title}
            </div>
            {s.cur.step === 'intro' && onShow ? (
              <div className="mt-2 text-sm text-white/70 flex-1">Round title is on screen. Press NEXT to start Debate 1.</div>
            ) : (
              <div className="mt-2 flex-1">
                <div className="text-xs text-white/50">Debate {s.cur.debate + 1}</div>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <span className="chip bg-embrace/20 text-embrace-bright">FOR</span>
                  <b>{teamName(s, d?.forTeam)}</b>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <span className="chip bg-ban/20 text-ban-bright">AGAINST</span>
                  <b>{teamName(s, d?.againstTeam)}</b>
                </div>
                <div className="mt-2 text-sm rounded-md bg-black/40 border border-white/10 p-2 min-h-[48px]">{d?.question ?? <span className="text-white/40">Question: spin the wheel</span>}</div>
              </div>
            )}
            {!onShow && (
              <div className="mt-2 text-xs text-gold">
                Projector is showing: <b>{s.screen}</b>
              </div>
            )}
          </div>
        </div>

        {/* Step pills */}
        {onShow && s.cur.step !== 'intro' && (
          <div className="flex gap-1">
            {STEPS.map((st, i) => (
              <button
                key={st.id}
                onClick={() => (st.id === 'spin' ? e.goDebate(s.cur.round, s.cur.debate) : e.goStep(st.id))}
                disabled={st.id !== 'spin' && !d?.question}
                className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold border ${
                  i === stepIdx ? 'bg-gold text-black border-gold' : i < stepIdx ? 'bg-white/10 border-white/10 text-white/70' : 'border-white/10 text-white/40'
                } disabled:opacity-30`}
              >
                {i < stepIdx ? '✓ ' : ''}
                {st.label}
              </button>
            ))}
          </div>
        )}

        {/* THE BUTTON */}
        <button
          onClick={e.next}
          disabled={blocked}
          className="w-full rounded-2xl py-6 font-display text-3xl tracking-wide pill-gold disabled:opacity-40 disabled:shadow-none hover:brightness-110 active:scale-[0.99] transition"
        >
          NEXT ▶ <span className="text-xl ml-2 normal-case">{label}</span>
        </button>

        {/* Context controls */}
        {onShow && <StepControls s={s} p={p} e={e} />}
      </div>

      {/* RIGHT — scores + screens */}
      <div className="space-y-3">
        <Scores s={s} e={e} />
        <Card title="Projector screens">
          <div className="grid grid-cols-2 gap-1.5">
            <button className="btn-ghost btn-sm" onClick={() => e.setScreen('home')}>
              Title poster
            </button>
            <button className="btn-ghost btn-sm" onClick={() => e.setScreen('join')}>
              Join QR code
            </button>
            <button className="btn-ghost btn-sm" onClick={() => e.setScreen('scoreboard')}>
              Leaderboard
            </button>
            <button className="btn-ghost btn-sm" onClick={() => e.setScreen('show')}>
              Back to debate
            </button>
            <button className="btn-ghost btn-sm" onClick={() => e.setMessage('WE’LL BE RIGHT BACK', 'Grab a slice of pizza 🍕')}>
              Break screen
            </button>
            <button className="btn-gold btn-sm" onClick={e.showChampion}>
              🏆 Champion
            </button>
            <button className="btn-ghost btn-sm" onClick={e.fireConfetti}>
              🎉 Confetti
            </button>
            {s.status === 'paused' ? (
              <button className="btn-gold btn-sm" onClick={e.resumeShow}>
                ▶ Resume
              </button>
            ) : (
              <button className="btn-ghost btn-sm" onClick={e.pauseShow}>
                ❚❚ Pause all
              </button>
            )}
          </div>
        </Card>
        <Card title="Audience">
          <div className="flex gap-3 items-center">
            <div className="bg-white p-1 rounded shrink-0">
              <QR text={joinUrl(s.roomCode)} size={84} />
            </div>
            <div className="text-xs text-white/60">
              {s.backend === 'demo' ? 'Demo mode: phones can’t join. Use hand counts or simulated votes in the “Who won?” step.' : `${s.audience.real} phones joined. Room ${s.roomCode}.`}
            </div>
          </div>
        </Card>
        <ConfirmButton className="btn-danger btn-sm w-full" msg="Reset the show? All scores and results are cleared. Teams and questions are kept." onConfirm={e.resetShow}>
          Reset scores & results
        </ConfirmButton>
      </div>
    </div>
  );
}

function StepControls({ s, p, e }: { s: PublicState; p: PrivateState; e: HostEngine }) {
  const d = currentDebate(s);
  const step = s.cur.step;
  if (step === 'intro') return null;
  if (step === 'spin' || (step === 'reveal' && d?.question))
    return (
      <Card title="Wheel">
        <div className="flex flex-wrap gap-2 items-center">
          {step === 'reveal' && (
            <button className="btn-ghost btn-sm" onClick={() => e.spin()}>
              ↻ Re-spin (different question)
            </button>
          )}
          <select className="inp !w-auto !py-1 text-xs max-w-[420px]" value="" onChange={(ev) => ev.target.value !== '' && e.spin(Number(ev.target.value))}>
            <option value="">…or choose the question yourself</option>
            {currentTopic(s)?.questions.map((q, i) => (
              <option key={q.id} value={i}>
                {i + 1}. {q.text.slice(0, 80)}
              </option>
            ))}
          </select>
        </div>
      </Card>
    );
  if (step === 'prep' || step === 'for' || step === 'against') return <TimerCard s={s} e={e} />;
  if (step === 'verdict' || step === 'result') return <VerdictCard s={s} p={p} e={e} />;
  return null;
}

function TimerCard({ s, e }: { s: PublicState; e: HostEngine }) {
  const t = s.timer;
  const at = useNow(t.status === 'running', 10);
  const rem = timerRemaining(t, at);
  const done = rem <= 0 && t.status !== 'idle';
  return (
    <Card title={`Timer · ${t.label}`}>
      <div className="flex items-center gap-4">
        <div className={`font-condensed text-6xl tabular-nums w-[150px] ${done ? 'text-ban anim-pulse' : rem <= 10000 && t.status === 'running' ? 'text-ban-bright' : ''}`}>
          {done ? 'TIME' : fmtClockFull(rem)}
        </div>
        {t.status === 'running' ? (
          <button className="btn-white btn-lg" onClick={e.timerPause}>
            ❚❚ Pause
          </button>
        ) : (
          <button className="btn-white btn-lg" onClick={e.timerStart}>
            ▶ {t.status === 'paused' ? 'Resume' : 'Start'}
          </button>
        )}
        <button className="btn-ghost" onClick={() => e.timerAdd(-10)}>
          −10s
        </button>
        <button className="btn-ghost" onClick={() => e.timerAdd(10)}>
          +10s
        </button>
        <button className="btn-ghost" onClick={e.timerReset}>
          ↺ Restart
        </button>
      </div>
      <p className="text-[11px] text-white/40 mt-2">Tip: Space bar starts/pauses the timer.</p>
    </Card>
  );
}

function VerdictCard({ s, p, e }: { s: PublicState; p: PrivateState; e: HostEngine }) {
  const d = currentDebate(s)!;
  const poll = s.poll && s.poll.debateId === d.id ? s.poll : null;
  const r = poll ? e.computeResults(poll.id, poll.options, p) : null;
  const [hands, setHands] = useState(false);
  const opt = (id: string, label: string, cls: string) => (
    <button className={`flex-1 btn-lg ${d.winner === id ? cls + ' ring-4 ring-white' : 'btn-ghost'}`} onClick={() => e.setWinner(id)}>
      {d.winner === id ? '✓ ' : ''}
      {label}
    </button>
  );
  return (
    <Card title="Who won this debate?">
      <div className="flex gap-2">
        {opt(d.forTeam, `${teamName(s, d.forTeam)} (FOR)`, 'btn-blue')}
        {opt('draw', 'Draw', 'btn-gold')}
        {opt(d.againstTeam, `${teamName(s, d.againstTeam)} (AGAINST)`, 'btn-red')}
      </div>
      <p className="text-[11px] text-white/45 mt-1.5">
        Win = +{s.settings.winPoints} pts · Draw = +{s.settings.drawPoints} each. You can change your choice; points update automatically.
      </p>

      <div className="mt-3 rounded-lg border border-white/10 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">📱 Or let the audience decide</span>
          {!poll && (
            <button className="btn-gold btn-sm ml-auto" onClick={e.openDebateVote}>
              Open audience vote
            </button>
          )}
          {poll?.status === 'open' && (
            <button className="btn-white btn-sm ml-auto" onClick={() => void e.closeVote()}>
              ■ Close vote & reveal
            </button>
          )}
          {poll?.status === 'closed' && <span className="text-xs text-white/50 ml-auto">Vote closed — winner set from votes (you can still change it above)</span>}
        </div>
        {poll && r && (
          <div className="mt-2 text-sm grid grid-cols-2 gap-2">
            {poll.options.map((o) => (
              <div key={o.id} className={`rounded-md px-2 py-1 ${o.side === 'for' ? 'bg-embrace/15' : 'bg-ban/15'}`}>
                {o.label}: <b className="tabular-nums">{r.counts[o.id] ?? 0}</b>
              </div>
            ))}
          </div>
        )}
        {poll?.status === 'open' && (
          <div className="mt-2">
            <button className="text-xs underline text-white/60" onClick={() => setHands(!hands)}>
              {hands ? 'Hide' : 'No phones? Enter a show-of-hands count'}
            </button>
            {s.backend === 'demo' && (
              <button className="text-xs underline text-white/60 ml-3" onClick={() => e.simulateVotes(20)}>
                Add 20 simulated votes (testing)
              </button>
            )}
            {hands && (
              <div className="flex gap-3 mt-2">
                {poll.options.map((o) => (
                  <label key={o.id} className="text-xs flex items-center gap-1">
                    {o.label}
                    <input
                      type="number"
                      min={0}
                      className="inp !w-20 !py-1"
                      value={p.manual[poll.id]?.[o.id] ?? 0}
                      onChange={(ev) => e.setManualCount(o.id, Number(ev.target.value))}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Scores({ s, e }: { s: PublicState; e: HostEngine }) {
  const ranked = useRanking(s);
  return (
    <Card title="Scores">
      <div className="space-y-1.5">
        {ranked.map((t) => (
          <div key={t.id} className="flex items-center gap-2">
            <span className={`w-5 text-center font-condensed ${t.rank === 1 && t.score > 0 ? 'text-gold' : 'text-white/40'}`}>{t.rank}</span>
            <span className="flex-1 truncate text-sm font-semibold">{t.name}</span>
            <span className="font-condensed text-2xl tabular-nums w-10 text-right">{t.score}</span>
            <button className="btn-ghost btn-sm" onClick={() => e.adjust(t.id, -1)} aria-label={`Minus 1 for ${t.name}`}>
              −1
            </button>
            <button className="btn-ghost btn-sm" onClick={() => e.adjust(t.id, 1)} aria-label={`Plus 1 for ${t.name}`}>
              +1
            </button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-white/40 mt-2">Debate points are added automatically when you pick a winner. Use ±1 for bonuses or corrections.</p>
    </Card>
  );
}
