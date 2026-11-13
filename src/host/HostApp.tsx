import { useEffect, useState } from 'react';
import { getEngine, type HostEngine } from '../lib/engine';
import { useHost } from '../lib/hooks';
import type { PrivateState, PublicState, RoundId, ScreenId } from '../lib/types';
import { ROUNDS } from '../lib/types';
import { QR, joinUrl } from '../components/Widgets';
import { unlockAudio } from '../lib/sound';
import { Card, ConfirmButton, StagePreview } from './ui';
import { PollPanel, RoundPanel, ScorePanel, TimerPanel } from './panels';
import ContentEditor from './ContentEditor';
import HistoryTab from './HistoryTab';

type Tab = 'show' | 'content' | 'history' | 'setup';

const SCREENS: { id: ScreenId; label: string }[] = [
  { id: 'home', label: 'Opening title' },
  { id: 'join', label: 'Join / QR code' },
  { id: 'roundIntro', label: 'Round title card' },
  { id: 'teams', label: 'Podiums + timer' },
  { id: 'fof', label: 'Fact or Fiction' },
  { id: 'hotseat', label: 'Hot Seat' },
  { id: 'roulette', label: 'AI Roulette wheel' },
  { id: 'devil', label: "Devil's Advocate" },
  { id: 'final', label: 'Final proposition' },
  { id: 'poll', label: 'Poll / results' },
  { id: 'scoreboard', label: 'Full scoreboard' },
  { id: 'shift', label: 'Opinion shift' },
  { id: 'verdict', label: 'Audience verdict' },
  { id: 'champion', label: 'Champion' },
];

export default function HostApp() {
  const e = getEngine();
  const snap = useHost();
  const { state: s, priv: p, conn, lastPushOk, ready, toasts, busy } = snap;
  const [tab, setTab] = useState<Tab>('show');

  useEffect(() => {
    void e.init();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    // Space = start/pause the timer (when not typing).
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.code === 'Space') {
        ev.preventDefault();
        const t = e.state.timer;
        if (t.status === 'running') e.timerPause();
        else e.timerStart();
      }
    };
    window.addEventListener('keydown', onKey);
    const warn = (ev: BeforeUnloadEvent) => {
      if (e.state.status === 'live') ev.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', warn);
      e.destroy();
    };
  }, [e]);

  const stageUrl = `${location.origin}${location.pathname}#/stage/${s.roomCode}`;

  return (
    <div className="min-h-screen bg-[#070910] text-white">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-[#070910]/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="font-display leading-[0.85] text-[15px]">
            <div>THE GREAT</div>
            <div>
              <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
            </div>
          </div>
          <span className="chip bg-white/10 text-white/70 ml-1">HOST</span>
          <div className="ml-2 flex items-center gap-2">
            <span className="text-[11px] text-white/40">ROOM</span>
            <span className="font-display tracking-[0.15em] text-lg">{s.roomCode}</span>
          </div>
          <StatusChip s={s} />
          <ConnChip s={s} conn={conn} ok={lastPushOk} ready={ready} />
          <span className="chip bg-gold/15 text-gold border border-gold/30" title="Audience members joined">
            👥 {s.audience.real}
            {s.audience.simulated > 0 && <span className="text-gold/70">+{s.audience.simulated} sim</span>}
          </span>
          <div className="flex-1" />
          <EventControls s={s} e={e} />
          <a href={stageUrl} target="gad-stage" className="btn-white btn-sm" title="Open the projector window (press F there for full screen)">
            ⧉ Open Stage
          </a>
          <button className={`btn-sm ${s.sound ? 'btn-ghost' : 'btn-danger'}`} onClick={e.toggleSound} title="Stage sound effects">
            {s.sound ? '🔊 Sound' : '🔇 Muted'}
          </button>
        </div>
        <nav className="flex gap-1 px-4">
          {(
            [
              ['show', 'Show control'],
              ['content', 'Questions & content'],
              ['history', 'Scores, polls & stats'],
              ['setup', 'Setup & recovery'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-sm rounded-t-lg border-b-2 ${tab === id ? 'border-gold text-white bg-white/5' : 'border-transparent text-white/50 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'show' && <ShowTab s={s} p={p} e={e} busy={busy} />}
      {tab === 'content' && (
        <div className="p-4">
          <ContentEditor p={p} e={e} />
        </div>
      )}
      {tab === 'history' && (
        <div className="p-4">
          <HistoryTab s={s} p={p} e={e} />
        </div>
      )}
      {tab === 'setup' && (
        <div className="p-4">
          <SetupTab s={s} p={p} e={e} />
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[min(560px,90vw)]">
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

function StatusChip({ s }: { s: PublicState }) {
  const map = {
    lobby: ['LOBBY', 'bg-white/10 text-white/70'],
    live: ['● LIVE', 'bg-ban text-white'],
    paused: ['❚❚ PAUSED', 'bg-gold text-black'],
    ended: ['ENDED', 'bg-white/20 text-white'],
  } as const;
  const [label, cls] = map[s.status];
  return <span className={`chip ${cls}`}>{label}</span>;
}

function ConnChip({ s, conn, ok, ready }: { s: PublicState; conn: string; ok: boolean; ready: boolean }) {
  if (s.backend === 'demo')
    return (
      <span className="chip bg-gold/15 text-gold border border-gold/30" title="No Supabase credentials: Host and Stage sync in this browser only. Phones cannot join.">
        DEMO MODE · this computer only
      </span>
    );
  const good = ready && ok && conn === 'online';
  return (
    <span className={`chip ${good ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-ban/20 text-ban-bright border border-ban/40 anim-pulse'}`}>
      <span className={`w-2 h-2 rounded-full ${good ? 'bg-emerald-400' : 'bg-ban'}`} />
      {!ready ? 'Connecting…' : good ? 'LIVE · synced' : ok ? 'Reconnecting…' : 'Offline — changes queued'}
    </span>
  );
}

function EventControls({ s, e }: { s: PublicState; e: HostEngine }) {
  return (
    <div className="flex items-center gap-1.5">
      {s.status === 'lobby' && (
        <button className="btn-gold btn-sm" onClick={e.startShow}>
          ▶ START THE SHOW
        </button>
      )}
      {s.status === 'live' && (
        <button className="btn-ghost btn-sm" onClick={e.pauseShow}>
          ❚❚ Pause
        </button>
      )}
      {s.status === 'paused' && (
        <button className="btn-gold btn-sm" onClick={e.resumeShow}>
          ▶ Resume
        </button>
      )}
      {(s.status === 'live' || s.status === 'paused') && (
        <ConfirmButton className="btn-ghost btn-sm" msg="End the show? The stage will show the thank-you screen." onConfirm={e.endShow}>
          ■ End
        </ConfirmButton>
      )}
      {s.status === 'ended' && (
        <button className="btn-ghost btn-sm" onClick={e.resumeShow}>
          Re-open show
        </button>
      )}
      <ConfirmButton className="btn-danger btn-sm" msg="RESET THE WHOLE SHOW? Scores, polls, votes and question history will be cleared. Your questions are kept." onConfirm={e.resetShow}>
        Reset
      </ConfirmButton>
    </div>
  );
}

function ShowTab({ s, p, e, busy }: { s: PublicState; p: PrivateState; e: HostEngine; busy: Record<string, boolean> }) {
  const [msgTitle, setMsgTitle] = useState('WE’LL BE RIGHT BACK');
  const [msgBody, setMsgBody] = useState('Grab a slice of pizza 🍕');
  return (
    <div className="grid grid-cols-[230px_minmax(0,1fr)_380px] gap-3 p-3 items-start">
      {/* Left: run of show + stage screens */}
      <div className="space-y-3">
        <Card title="Run of show">
          <div className="space-y-1">
            {ROUNDS.map((r) => (
              <button
                key={r.id}
                onClick={() => e.goRound(r.id as RoundId)}
                className={`w-full text-left rounded-lg px-2.5 py-2 text-sm flex items-center gap-2 transition ${
                  s.round === r.id ? 'bg-gold text-black font-semibold' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="w-5 text-center font-display text-xs">{r.num ?? (r.id === 'roulette' ? '🎡' : '•')}</span>
                {r.name}
              </button>
            ))}
          </div>
          <button className="btn-white btn-sm w-full mt-2" onClick={e.showMain}>
            Show this round’s main screen
          </button>
        </Card>
        <Card title="Stage screen">
          <div className="grid grid-cols-1 gap-1">
            {SCREENS.map((x) => (
              <button
                key={x.id}
                onClick={() => e.setScreen(x.id)}
                className={`text-left rounded-md px-2 py-1 text-xs ${s.screen === x.id ? 'bg-white text-black font-semibold' : 'hover:bg-white/10 text-white/80'}`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            <input className="inp !py-1 text-xs" value={msgTitle} onChange={(ev) => setMsgTitle(ev.target.value)} aria-label="Message title" />
            <input className="inp !py-1 text-xs" value={msgBody} onChange={(ev) => setMsgBody(ev.target.value)} aria-label="Message body" />
            <button className="btn-ghost btn-sm w-full" onClick={() => e.setMessage(msgTitle, msgBody)}>
              Show message / fallback screen
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2">
            <button className="btn-ghost btn-sm" onClick={e.fireConfetti}>
              🎉 Confetti
            </button>
            <button className="btn-ghost btn-sm" onClick={e.toggleScoreboard}>
              {s.showScoreboard ? 'Hide' : 'Show'} score bar
            </button>
            <button className="btn-ghost btn-sm col-span-2" onClick={() => e.goRound(s.round)}>
              ✨ Replay round transition
            </button>
          </div>
        </Card>
      </div>

      {/* Centre: preview + round controls */}
      <div className="space-y-3 min-w-0">
        <StagePreview s={s} />
        <div className="flex items-center gap-2 text-xs text-white/60 -mt-1">
          <span>
            Now: <b className="text-white">{s.phase}</b>
          </span>
          {s.spotlight && <span className={`chip ${s.spotlight === 'embrace' ? 'bg-embrace/20 text-embrace-bright' : 'bg-ban/20 text-ban-bright'}`}>spotlight: {s.spotlight}</span>}
          <button className="ml-auto underline hover:text-white" onClick={() => e.setSpotlight(null)}>
            clear spotlight
          </button>
        </div>
        <RoundPanel s={s} p={p} e={e} busy={busy} />
      </div>

      {/* Right: always-on controls */}
      <div className="space-y-3">
        <TimerPanel s={s} p={p} e={e} busy={busy} />
        <PollPanel s={s} p={p} e={e} busy={busy} />
        <ScorePanel s={s} p={p} e={e} busy={busy} />
      </div>
    </div>
  );
}

function SetupTab({ s, p, e }: { s: PublicState; p: PrivateState; e: HostEngine }) {
  const [showKey, setShowKey] = useState(false);
  const [rRoom, setRRoom] = useState('');
  const [rKey, setRKey] = useState('');
  const [simN, setSimN] = useState(30);
  const url = joinUrl(s.roomCode);
  const stageUrl = `${location.origin}${location.pathname}#/stage/${s.roomCode}`;
  return (
    <div className="grid grid-cols-3 gap-3 items-start">
      <Card title="Mode">
        {s.backend === 'demo' ? (
          <div className="text-sm space-y-2">
            <p>
              <b className="text-gold">DEMO MODE.</b> No Supabase credentials were found, so the Host and Stage windows sync through this browser only. Audience phones <b>cannot</b> connect.
            </p>
            <p className="text-white/70">You can still run the entire show: simulate an audience below, or collect a show of hands and type the counts into the poll panel.</p>
            <p className="text-white/70">
              For real phone voting, add your Supabase URL and anon key to <code className="text-gold">config.js</code> (see README) and reload.
            </p>
          </div>
        ) : (
          <div className="text-sm space-y-2">
            <p>
              <b className="text-emerald-300">LIVE MODE</b> — connected to Supabase. Votes are validated on the server: one vote per phone per poll, no votes after closing, hidden results never leave the host.
            </p>
          </div>
        )}
      </Card>
      <Card title="Audience join">
        <div className="flex gap-3">
          <div className="bg-white p-1.5 rounded-lg shrink-0">
            <QR text={url} size={130} />
          </div>
          <div className="text-xs space-y-2 min-w-0">
            <div className="font-display text-2xl tracking-[0.15em]">{s.roomCode}</div>
            <div className="break-all text-white/70">{url}</div>
            <div className="flex gap-1">
              <button className="btn-ghost btn-sm" onClick={() => void navigator.clipboard?.writeText(url)}>
                Copy link
              </button>
              <a className="btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
                Test as audience
              </a>
            </div>
          </div>
        </div>
        <div className="text-xs mt-3 space-y-1">
          <div className="text-white/50">Stage window:</div>
          <div className="break-all">{stageUrl}</div>
        </div>
      </Card>
      <Card title="Simulated audience">
        <p className="text-xs text-white/60 mb-2">For rehearsals and demo mode. Simulated participants and votes are always labelled on the projector.</p>
        <div className="flex items-center gap-2">
          <input type="number" className="inp !w-20 !py-1" value={simN} onChange={(ev) => setSimN(Number(ev.target.value))} aria-label="Simulated participants" />
          <button className="btn-ghost btn-sm" onClick={() => e.addSimulatedParticipants(simN)}>
            Add participants
          </button>
          <ConfirmButton className="btn-danger btn-sm" msg="Remove all simulated participants and their votes?" onConfirm={e.clearSimulated}>
            Clear simulated
          </ConfirmButton>
        </div>
        <div className="text-xs text-white/50 mt-2">
          Currently {s.audience.real} real · {s.audience.simulated} simulated · {p.simulatedParticipants} sim slots
        </div>
      </Card>
      <Card title="Recovery">
        <p className="text-xs text-white/60">
          Everything is saved continuously. If this browser crashes just reload — the show resumes exactly where it was{s.backend === 'supabase' ? ' (state also lives in Supabase)' : ''}.
        </p>
        {s.backend === 'supabase' && (
          <>
            <div className="mt-3 text-xs">
              <div className="text-white/50">Host key (keep private — lets another computer take over this room):</div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-gold break-all">{showKey ? p.hostKey : '••••••••••••••••'}</code>
                <button className="btn-ghost btn-sm" onClick={() => setShowKey(!showKey)}>
                  {showKey ? 'Hide' : 'Reveal'}
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="text-xs text-white/50">Take over an existing room on this computer:</div>
              <input className="inp !py-1" placeholder="Room code" value={rRoom} onChange={(ev) => setRRoom(ev.target.value)} />
              <input className="inp !py-1" placeholder="Host key" value={rKey} onChange={(ev) => setRKey(ev.target.value)} />
              <button className="btn-white btn-sm" disabled={!rRoom || !rKey} onClick={() => void e.recoverRoom(rRoom, rKey)}>
                Take over room
              </button>
            </div>
          </>
        )}
      </Card>
      <Card title="Room">
        <p className="text-xs text-white/60 mb-2">Creating a new room gives a new code and QR — phones on the old code will stop receiving updates. Your questions are kept.</p>
        <ConfirmButton className="btn-danger btn-sm" msg="Create a brand-new room? The current show state is discarded and everyone must re-join." onConfirm={() => void e.newRoom()}>
          New room code
        </ConfirmButton>
      </Card>
      <Card title="Keyboard">
        <ul className="text-xs text-white/70 space-y-1">
          <li>
            <b>Space</b> (host) — start / pause timer
          </li>
          <li>
            <b>F</b> (stage window) — full screen
          </li>
          <li>Click the stage window once to enable its sound.</li>
        </ul>
      </Card>
    </div>
  );
}
