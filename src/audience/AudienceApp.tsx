import { useEffect, useMemo, useState } from 'react';
import { VoteBars, useRanking } from '../components/Widgets';
import { currentDebate, currentTopic, roundLabel, teamName } from '../lib/engine';
import { useNow, useViewerState } from '../lib/hooks';
import { fmtClockFull, timerRemaining } from '../lib/time';
import type { TimerState } from '../lib/types';
import { getTransport, type VoteResult } from '../lib/transport';
import type { PollState, PublicState } from '../lib/types';
import { safeGet, safeJson, safeSet } from '../lib/util';

function participantId(): string {
  let id = safeGet('gad:pid');
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });
    safeSet('gad:pid', id);
  }
  return id;
}

export default function AudienceApp({ room: roomParam }: { room: string | null }) {
  const t = getTransport();
  const live = t.kind === 'supabase';
  const [room, setRoom] = useState<string | null>(roomParam ? roomParam.toUpperCase() : live ? null : 'DEMO');
  const pid = useMemo(participantId, []);
  const joinedKey = `gad:joined:${room}`;
  const votesKey = `gad:votes:${room}`;
  const [joined, setJoined] = useState(() => safeGet(joinedKey) === '1');
  const [votes, setVotes] = useState<Record<string, string>>(() => safeJson(votesKey) ?? {});
  const { state, conn } = useViewerState(live ? room : null);

  useEffect(() => {
    setJoined(safeGet(joinedKey) === '1');
    setVotes(safeJson(votesKey) ?? {});
  }, [joinedKey, votesKey]);

  const saveVote = (pollId: string, option: string) => {
    const next = { ...votes, [pollId]: option };
    setVotes(next);
    safeSet(votesKey, JSON.stringify(next));
  };

  if (live && !room) return <EnterRoom onRoom={(r) => ((window.location.hash = `#/play/${r}`), setRoom(r))} />;

  return (
    <div className="min-h-[100dvh] stage-bg relative overflow-hidden">
      <MobileLights />
      <div className="relative z-10 max-w-md mx-auto px-5 pb-10 pt-4 min-h-[100dvh] flex flex-col">
        <Header s={state} room={room} conn={conn} live={live} />
        {!joined ? (
          <JoinCard
            room={room!}
            pid={pid}
            onJoined={() => {
              safeSet(joinedKey, '1');
              setJoined(true);
            }}
          />
        ) : !state ? (
          <Waiting title="Connecting…" body={live ? 'Looking for the show.' : 'Waiting for the host window on this computer.'} />
        ) : (
          <Live s={state} room={room!} pid={pid} votes={votes} saveVote={saveVote} />
        )}
        {!live && <p className="mt-auto pt-6 text-center text-[11px] text-gold/80">Demo mode: this page only talks to a host window in this same browser.</p>}
      </div>
    </div>
  );
}

function MobileLights() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute -top-20 -left-24 w-72 h-[120%] rotate-[-18deg] bg-gradient-to-b from-embrace/40 via-embrace/10 to-transparent blur-2xl" />
      <div className="absolute -top-20 -right-24 w-72 h-[120%] rotate-[18deg] bg-gradient-to-b from-ban/40 via-ban/10 to-transparent blur-2xl" />
    </div>
  );
}

function Header({ s, room, conn, live }: { s: PublicState | null; room: string | null; conn: string; live: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="font-display leading-[0.85] text-[18px]">
        <div>THE GREAT</div>
        <div>
          <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] tracking-[0.2em] text-white/50">ROOM</div>
        <div className="font-display text-lg tracking-[0.15em]">{s?.roomCode ?? room}</div>
        {live && (
          <div className="flex items-center justify-end gap-1 text-[10px] text-white/60">
            <span className={`w-2 h-2 rounded-full ${conn === 'online' ? 'bg-emerald-400' : conn === 'connecting' ? 'bg-gold' : 'bg-ban'}`} />
            {conn === 'online' ? 'Connected' : conn === 'connecting' ? 'Connecting' : 'Reconnecting…'}
          </div>
        )}
      </div>
    </div>
  );
}

function EnterRoom({ onRoom }: { onRoom: (r: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="min-h-[100dvh] stage-bg relative">
      <MobileLights />
      <form
        className="relative z-10 max-w-md mx-auto px-6 pt-20 flex flex-col items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim().length >= 4) onRoom(v.trim().toUpperCase());
        }}
      >
        <div className="font-display text-center leading-[0.85]">
          <div className="text-4xl">THE GREAT</div>
          <div className="text-6xl">
            <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
          </div>
        </div>
        <label htmlFor="room" className="mt-12 text-white/70 text-sm tracking-[0.2em]">
          ENTER ROOM CODE
        </label>
        <input
          id="room"
          value={v}
          onChange={(e) => setV(e.target.value.toUpperCase())}
          className="mt-3 w-full bg-black/60 neon-red rounded-2xl px-4 py-4 font-display text-4xl tracking-[0.3em] text-center outline-none uppercase"
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className="mt-6 w-full pill-gold rounded-2xl py-4 font-display text-xl tracking-[0.1em]">JOIN</button>
      </form>
    </div>
  );
}

function JoinCard({ room, onJoined, pid }: { room: string; onJoined: () => void; pid: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const join = async () => {
    setBusy(true);
    setErr(null);
    const r = await getTransport().join(room, pid);
    setBusy(false);
    if (r.ok) onJoined();
    else
      setErr(
        r.reason === 'no_event'
          ? 'That room code doesn’t exist. Check the big screen and try again.'
          : r.reason === 'no_host'
            ? 'No host window found (demo mode only works in the same browser).'
            : 'Couldn’t connect. Check your signal and try again.',
      );
  };
  return (
    <div className="flex-1 flex flex-col justify-center py-8">
      <div className="led px-5 py-6">
        <div className="font-display text-[34px] leading-[0.95] led-text">
          AI SHOULD BE <span className="banned-chip">BANNED</span> FROM UNIVERSITIES.
        </div>
      </div>
      <div className="mt-8 font-display text-4xl leading-none">
        JOIN THE <span className="text-goldgrad">JURY</span>
      </div>
      <p className="mt-3 text-white/75">You decide who wins each debate. No sign-up, no names.</p>
      <button onClick={join} disabled={busy} className="mt-8 w-full rounded-2xl py-5 font-display text-2xl tracking-[0.08em] pill-gold disabled:opacity-60">
        {busy ? 'JOINING…' : 'I’M IN'}
      </button>
      {err && (
        <p role="alert" className="mt-4 text-ban-bright text-sm">
          {err}
        </p>
      )}
    </div>
  );
}

function Waiting({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
      <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-gold animate-spin" />
      <div className="font-display text-3xl mt-6">{title}</div>
      <p className="text-white/70 mt-2">{body}</p>
    </div>
  );
}

function Live({ s, room, pid, votes, saveVote }: { s: PublicState; room: string; pid: string; votes: Record<string, string>; saveVote: (p: string, o: string) => void }) {
  const p = s.poll;
  if (s.status === 'paused') return <Waiting title="Short break" body="We’ll be right back." />;
  if (p && p.status === 'open') {
    return votes[p.id] ? <Voted poll={p} option={votes[p.id]} /> : <Ballot key={p.id} poll={p} room={room} pid={pid} timer={s.timer.label === 'Audience vote' ? s.timer : null} onVoted={(o) => saveVote(p.id, o)} />;
  }
  if (s.screen === 'champion') return <Final s={s} />;
  if (p && p.status === 'closed' && p.results && s.cur.step === 'verdict') return <Closed poll={p} mine={votes[p.id]} />;
  const d = currentDebate(s);
  return (
    <div className="flex-1 flex flex-col justify-center text-center py-8">
      {s.status === 'lobby' ? (
        <>
          <div className="text-xs tracking-[0.3em] text-white/50">YOU’RE IN</div>
          <div className="font-display text-4xl mt-2 leading-none">THE SHOW STARTS SOON</div>
        </>
      ) : (
        <>
          <div className="text-xs tracking-[0.3em] text-white/50">
            {roundLabel(s, s.cur.round, false)} · {currentTopic(s)?.title}
          </div>
          {d?.question && s.cur.step !== 'intro' ? (
            <>
              <div className="font-display text-2xl mt-3 leading-tight">{d.question}</div>
              <div className="mt-3 text-sm">
                <span className="text-embrace-bright font-semibold">{teamName(s, d.forTeam)}</span> FOR ·{' '}
                <span className="text-ban-bright font-semibold">{teamName(s, d.againstTeam)}</span> AGAINST
              </div>
            </>
          ) : (
            <div className="font-display text-3xl mt-3 leading-none">EYES ON THE STAGE</div>
          )}
        </>
      )}
      <p className="text-white/60 mt-5 text-sm">Your phone lights up when it’s time to vote.</p>
      <MiniScores s={s} />
    </div>
  );
}

function MiniScores({ s }: { s: PublicState }) {
  const ranked = useRanking(s);
  return (
    <div className="mt-8 rounded-2xl bg-black/50 neon-dim p-3 text-left">
      {ranked.map((t) => (
        <div key={t.id} className="flex items-center gap-2 py-1">
          <span className="w-5 text-white/40 font-condensed">{t.rank}</span>
          <span className="flex-1 font-semibold truncate">{t.name}</span>
          <span className="font-condensed text-2xl">{t.score}</span>
        </div>
      ))}
    </div>
  );
}

function Ballot({ poll, room, pid, timer, onVoted }: { poll: PollState; room: string; pid: string; timer: TimerState | null; onVoted: (o: string) => void }) {
  const at = useNow(!!timer && timer.status === 'running', 4);
  const rem = timer ? timerRemaining(timer, at) : null;
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async () => {
    if (!sel || busy) return;
    setBusy(true);
    setMsg(null);
    const t = getTransport();
    let r: VoteResult = await t.vote(room, pid, poll.id, sel);
    if (!r.ok && r.reason === 'not_joined') {
      await t.join(room, pid);
      r = await t.vote(room, pid, poll.id, sel);
    }
    setBusy(false);
    if (r.ok) onVoted(r.option);
    else if (r.reason === 'duplicate') onVoted(r.option ?? sel);
    else if (r.reason === 'closed') setMsg('Sorry — voting has just closed.');
    else if (r.reason === 'no_host') setMsg('Host not reachable.');
    else setMsg('Couldn’t send your vote. Check your connection and tap again.');
  };
  return (
    <div className="flex-1 flex flex-col py-4">
      <div className="flex items-center justify-between">
        <span className="chip bg-ban text-white">● VOTING OPEN</span>
        {rem != null && <span className={`font-condensed text-2xl tabular-nums ${rem <= 10000 ? 'text-ban-bright' : 'text-gold'}`}>⏱ {fmtClockFull(rem)}</span>}
      </div>
      <h1 className="font-display text-[30px] leading-[1.05] mt-3">{poll.question}</h1>
      <div className="mt-6 space-y-3" role="radiogroup" aria-label={poll.question}>
        {poll.options.map((o) => {
          const on = sel === o.id;
          const cls = o.side === 'for' ? 'bg-gradient-to-b from-[#2b8cff] to-[#0b3fa8] border-embrace-bright' : 'bg-gradient-to-b from-[#ff4a57] to-[#a3101c] border-ban-bright';
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={on}
              onClick={() => setSel(o.id)}
              className={`w-full min-h-[84px] rounded-2xl border-2 px-5 py-4 text-left flex items-center gap-4 transition ${cls} ${
                on ? 'ring-4 ring-white scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.35)]' : sel ? 'opacity-50' : ''
              }`}
            >
              <span className="font-display text-[22px] leading-tight flex-1">{o.label}</span>
              <span className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center ${on ? 'bg-white text-black' : ''}`} aria-hidden>
                {on ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
      <button onClick={submit} disabled={!sel || busy} className="mt-6 w-full rounded-2xl py-5 font-display text-xl tracking-[0.08em] pill-gold disabled:opacity-40 disabled:shadow-none">
        {busy ? 'SENDING…' : sel ? 'LOCK IN MY VOTE' : 'CHOOSE A TEAM'}
      </button>
      {msg && (
        <p role="alert" className="mt-3 text-center text-ban-bright text-sm">
          {msg}
        </p>
      )}
      <p className="mt-3 text-center text-[11px] text-white/45">One vote per person. You can’t change it once locked in.</p>
    </div>
  );
}

function Voted({ poll, option }: { poll: PollState; option: string }) {
  const o = poll.options.find((x) => x.id === option);
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-8 anim-pop">
      <div className="w-24 h-24 rounded-full bg-gold text-black flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(247,215,116,0.6)]">✓</div>
      <div className="font-display text-3xl mt-6">VOTE LOCKED IN</div>
      <div className="mt-3 font-display text-xl">{o?.label ?? option}</div>
      <p className="text-white/70 mt-6">Watch the big screen for the result.</p>
    </div>
  );
}

function Closed({ poll, mine }: { poll: PollState; mine?: string }) {
  return (
    <div className="flex-1 flex flex-col py-6">
      <span className="chip bg-white/15 self-start">VOTING CLOSED</span>
      <h2 className="font-display text-2xl leading-tight mt-3">{poll.question}</h2>
      {mine && <p className="text-white/70 mt-2">You voted: <b className="text-white">{poll.options.find((o) => o.id === mine)?.label}</b></p>}
      <div className="mt-6">{poll.results && <VoteBars poll={poll} big={false} />}</div>
    </div>
  );
}

function Final({ s }: { s: PublicState }) {
  const ranked = useRanking(s);
  const winners = ranked.filter((t) => t.rank === 1);
  return (
    <div className="flex-1 flex flex-col justify-center py-6 gap-5">
      <div className="rounded-2xl bg-black/50 neon-gold p-5 text-center">
        <div className="text-xs tracking-[0.3em] text-gold">{winners.length > 1 ? 'JOINT CHAMPIONS' : 'CHAMPIONS'}</div>
        {winners.map((w) => (
          <div key={w.id} className="font-display text-4xl mt-2 text-goldgrad">
            {w.name}
          </div>
        ))}
      </div>
      <MiniScores s={s} />
      <p className="text-center text-white/70">Thanks for being on the jury tonight!</p>
    </div>
  );
}
