import { useEffect, useRef, useState } from 'react';
import { StageCanvas, Backdrop } from '../components/StageKit';
import { fireConfetti, wheelAngle } from '../components/Widgets';
import { HOST_PUB_KEY, currentTopic } from '../lib/engine';
import { useViewerState } from '../lib/hooks';
import { audioUnlocked, music, playSfx, sfx, unlockAudio, type SfxName, type TrackId } from '../lib/sound';
import { speechOf } from '../lib/content';
import { now, timerRemaining } from '../lib/time';
import { getLocalBus, getTransport } from '../lib/transport';
import type { PublicState } from '../lib/types';
import { safeJson } from '../lib/util';
import { HomeScreen, MessageScreen, StageScreen } from './Screens';
import { BURST_MS, SoundBurst } from '../components/Bursts';

function resolveRoom(param: string | null): string | null {
  if (param) return param.toUpperCase();
  return safeJson<PublicState>(HOST_PUB_KEY)?.roomCode ?? null;
}

export default function StageApp({ room: roomParam }: { room: string | null }) {
  const live = getTransport().kind === 'supabase';
  const [room, setRoom] = useState<string | null>(() => resolveRoom(roomParam));
  const { state, conn, loaded } = useViewerState(live ? room : null);
  const [audioReady, setAudioReady] = useState(audioUnlocked());
  const [cursorHidden, setCursorHidden] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const move = () => {
      setCursorHidden(false);
      clearTimeout(t);
      t = setTimeout(() => setCursorHidden(true), 2500);
    };
    window.addEventListener('mousemove', move);
    move();
    return () => {
      window.removeEventListener('mousemove', move);
      clearTimeout(t);
    };
  }, []);

  useStageEffects(state, audioReady);
  const burst = useBursts(state);

  if (live && !room) return <RoomPrompt onRoom={setRoom} />;

  const startFromStage = async () => {
    unlockAudio();
    setAudioReady(true);
    const r = await getLocalBus().sendCommand('start');
    if (!r) alert('Open Host Mode in another window of this browser to run the show.');
  };

  return (
    <div
      style={{ cursor: cursorHidden ? 'none' : 'default' }}
      onClick={() => {
        if (!audioReady) {
          unlockAudio();
          setAudioReady(true);
        }
      }}
    >
      <StageCanvas>
        {!state ? (
          <>
            <Backdrop />
            {loaded || !live ? <HomeScreen s={null} onStart={startFromStage} /> : <MessageScreen title="CONNECTING…" body="Finding the show." />}
          </>
        ) : state.screen === 'home' ? (
          <>
            <Backdrop />
            <HomeScreen s={state} onStart={state.status === 'lobby' ? startFromStage : undefined} />
          </>
        ) : (
          <StageScreen s={state} />
        )}

        {state?.status === 'paused' && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center">
            <MessageScreen title="WE’LL BE RIGHT BACK" body="The Great AI Debate is paused." />
          </div>
        )}
        <Flash state={state} />
        {burst && <SoundBurst key={burst.id} name={burst.name} />}

        <div className="absolute bottom-3 right-4 z-50 flex items-center gap-3 text-[15px] font-body text-white/50">
          {state?.backend === 'demo' && <span className="chip bg-gold/15 text-gold border border-gold/30">DEMO MODE</span>}
          {live && (
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${conn === 'online' ? 'bg-emerald-400' : conn === 'connecting' ? 'bg-gold' : 'bg-ban anim-pulse'}`} />
              {conn === 'online' ? 'LIVE' : conn === 'connecting' ? 'CONNECTING' : 'RECONNECTING'}
            </span>
          )}
          {!audioReady && <span className="rounded-full bg-gold text-black font-display text-[20px] px-5 py-2 anim-pulse">🔊 CLICK ANYWHERE TO TURN ON SOUND</span>}
          <button onClick={(e) => (e.stopPropagation(), toggleFullscreen())} className="chip bg-white/10 hover:bg-white/20" title="Full screen (F)">
            ⛶ FULL SCREEN
          </button>
        </div>
      </StageCanvas>
    </div>
  );
}

/** Motion graphics for soundboard effects and the show opening (shown even when muted). */
function useBursts(s: PublicState | null) {
  const [burst, setBurst] = useState<{ id: string; name: string } | null>(null);
  const prev = useRef<PublicState | null>(null);
  useEffect(() => {
    if (!s) return;
    const p = prev.current;
    prev.current = s;
    if (!p) return; // never replay on first load / refresh
    let next: { id: string; name: string } | null = null;
    if (s.fx?.kind === 'sound' && s.fx.sound && s.fx.id !== p.fx?.id && now() - s.updatedAt < 5000) next = { id: s.fx.id, name: s.fx.sound };
    else if (s.status === 'live' && p.status === 'lobby') next = { id: `open-${s.v}`, name: 'showOpen' };
    if (!next) return;
    setBurst(next);
    const id = next.id;
    // Not tied to effect cleanup: state updates every few hundred ms must not cancel the hide timer.
    setTimeout(() => setBurst((b) => (b?.id === id ? null : b)), BURST_MS[next.name] ?? 2500);
  }, [s]);
  return burst;
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

function Flash({ state }: { state: PublicState | null }) {
  const id = state?.fx?.kind === 'flash' ? state.fx.id : null;
  if (!id) return null;
  return <div key={id} className="absolute inset-0 z-40 pointer-events-none bg-white" style={{ animation: 'flash 0.9s ease-out both' }} />;
}

/** Sound + confetti driven by state changes. */
function useStageEffects(s: PublicState | null, audio: boolean) {
  const prev = useRef<PublicState | null>(null);
  const seenFx = useRef<string | null>(null);
  const lastSec = useRef<number | null>(null);
  const lastSeg = useRef<number | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!s) return;
    const p = prev.current;
    prev.current = s;
    const sound = s.sound && audio;
    if (first.current) {
      first.current = false;
      seenFx.current = s.fx?.id ?? null;
      return;
    }
    if (s.fx && s.fx.id !== seenFx.current) {
      seenFx.current = s.fx.id;
      if (now() - s.updatedAt < 5000) {
        if (s.fx.kind === 'confetti') {
          fireConfetti(true);
          if (sound) s.screen === 'champion' ? sfx.bigApplause() : (sfx.fanfare(), sfx.applause());
        } else if (s.fx.kind === 'points' && sound) sfx.points();
        else if (s.fx.kind === 'flash' && sound) sfx.whoosh();
        else if (s.fx.kind === 'sound' && sound && s.fx.sound) playSfx(s.fx.sound as SfxName);
      }
    }
    if (!p || !sound) return;
    if (s.status === 'live' && p.status === 'lobby') sfx.showOpen();
    if (s.poll && s.poll.status === 'open' && p.poll?.id !== s.poll.id) sfx.ding();
    // A ding for every vote that comes in (several at once are spread out a little).
    if (s.poll && p.poll && s.poll.id === p.poll.id && s.poll.voteCount > p.poll.voteCount) {
      const n = Math.min(s.poll.voteCount - p.poll.voteCount, 6);
      for (let i = 0; i < n; i++) sfx.voteDing(i * 0.11);
    }
    const enteredIntro = s.screen === 'show' && s.cur.step === 'intro' && (p.cur.step !== 'intro' || p.screen !== 'show' || p.cur.round !== s.cur.round);
    if (enteredIntro) sfx.roundSting();
    if (s.cur.step === 'reveal' && p.cur.step === 'spin') sfx.reveal();
    if (speechOf(s.cur.step) && s.cur.step !== p.cur.step) sfx.go();
    if (s.cur.step === 'verdict' && p.cur.step !== 'verdict') sfx.suspenseHit();
  }, [s, audio]);

  // Background music follows the show.
  const want = s && audio && s.sound && s.music?.on ? trackFor(s) : null;
  const customName = want ? s?.music?.custom?.[want] ?? '' : '';
  useEffect(() => {
    if (!want) {
      music.stop();
      return;
    }
    music.stop();
    void music.play(want);
  }, [want, customName]);
  useEffect(() => {
    if (s?.music) music.setVolume(s.music.volume);
  }, [s?.music?.volume, audio]);
  useEffect(() => () => music.stop(), []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = prev.current;
      if (st && st.sound && audio) {
        if (st.timer.status === 'running') {
          const sec = Math.ceil(timerRemaining(st.timer) / 1000);
          if (lastSec.current !== null && sec !== lastSec.current) {
            if (sec === 0) sfx.buzzer();
            else if (sec <= 5) sfx.tickLow();
          }
          lastSec.current = sec;
        } else lastSec.current = null;
        const w = st.wheel;
        if (w.status === 'spinning') {
          const t = now();
          const segs = Math.max(1, currentTopic(st)?.questions.length ?? 6);
          const seg = Math.floor(wheelAngle(w, t) / (360 / segs));
          const done = t >= w.startedAt + w.durationMs;
          if (!done && lastSeg.current !== null && lastSeg.current !== -1 && seg !== lastSeg.current) sfx.wheelTick();
          if (done && lastSeg.current !== -1) {
            sfx.boom();
            lastSeg.current = -1;
          } else if (!done) lastSeg.current = seg;
        } else lastSeg.current = null;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audio]);
}

/** Which music loop fits the moment (null = quiet so speakers can be heard). */
function trackFor(s: PublicState): TrackId | null {
  if (s.status === 'paused') return 'lobby';
  switch (s.screen) {
    case 'home':
    case 'join':
    case 'message':
    case 'scoreboard':
      return 'lobby';
    case 'champion':
      return 'celebrate';
    case 'show':
      if (s.cur.step === 'intro') return 'lobby';
      if (s.cur.step === 'spin' || s.cur.step === 'verdict') return 'suspense';
      if (s.cur.step === 'result') return 'celebrate';
      return null;
  }
  return null;
}

function RoomPrompt({ onRoom }: { onRoom: (r: string) => void }) {
  const [v, setV] = useState('');
  return (
    <StageCanvas>
      <Backdrop />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-[80px]">STAGE MODE</div>
        <div className="font-body text-[30px] text-white/70 mt-2">Enter the room code shown in Host Mode.</div>
        <form
          className="mt-10 flex gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.trim()) {
              const code = v.trim().toUpperCase();
              window.location.hash = `#/stage/${code}`;
              onRoom(code);
            }
          }}
        >
          <input
            value={v}
            onChange={(e) => setV(e.target.value)}
            className="bg-black/60 neon-red rounded-xl px-6 py-4 font-display text-[60px] tracking-[0.2em] w-[420px] text-center uppercase outline-none"
            maxLength={8}
            autoFocus
            aria-label="Room code"
          />
          <button className="pill-gold rounded-xl px-10 font-display text-[40px]">GO</button>
        </form>
      </div>
    </StageCanvas>
  );
}
