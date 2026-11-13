import { useEffect, useRef, useState } from 'react';
import { StageCanvas, Backdrop } from '../components/StageKit';
import { fireConfetti, wheelAngle } from '../components/Widgets';
import { useViewerState } from '../lib/hooks';
import { audioUnlocked, sfx, unlockAudio } from '../lib/sound';
import { now, timerRemaining } from '../lib/time';
import { getLocalBus, getTransport } from '../lib/transport';
import type { PublicState } from '../lib/types';
import { safeJson } from '../lib/util';
import { HomeScreen, MessageScreen, StageScreen } from './Screens';

function resolveRoom(param: string | null): string | null {
  if (param) return param.toUpperCase();
  // Same computer as the host? Use the host's room automatically.
  const hostPub = safeJson<PublicState>('gad:host:public:v1');
  return hostPub?.roomCode ?? null;
}

export default function StageApp({ room: roomParam }: { room: string | null }) {
  const live = getTransport().kind === 'supabase';
  const [room, setRoom] = useState<string | null>(() => resolveRoom(roomParam));
  const { state, conn, loaded } = useViewerState(live ? room : null);
  const [audioReady, setAudioReady] = useState(audioUnlocked());
  const [cursorHidden, setCursorHidden] = useState(false);

  // Keyboard: F = full screen. Clicking anywhere unlocks audio.
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

        {/* Status corner — subtle on purpose */}
        <div className="absolute bottom-3 right-4 z-50 flex items-center gap-3 text-[15px] font-body text-white/50">
          {state?.backend === 'demo' && <span className="chip bg-gold/15 text-gold border border-gold/30">DEMO MODE</span>}
          {live && (
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${conn === 'online' ? 'bg-emerald-400' : conn === 'connecting' ? 'bg-gold' : 'bg-ban anim-pulse'}`} />
              {conn === 'online' ? 'LIVE' : conn === 'connecting' ? 'CONNECTING' : 'RECONNECTING'}
            </span>
          )}
          {!audioReady && <span className="chip bg-white/10">CLICK FOR SOUND</span>}
          <button onClick={(e) => (e.stopPropagation(), toggleFullscreen())} className="chip bg-white/10 hover:bg-white/20" title="Full screen (F)">
            ⛶ FULL SCREEN
          </button>
        </div>
      </StageCanvas>
    </div>
  );
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

/** Sound + confetti driven purely by state changes (so refreshes never replay old effects). */
function useStageEffects(s: PublicState | null, audio: boolean) {
  const prev = useRef<PublicState | null>(null);
  const seenFx = useRef<string | null>(null);
  const lastSec = useRef<number | null>(null);
  const lastSeg = useRef<number | null>(null);
  const cdSec = useRef<number | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!s) return;
    const p = prev.current;
    prev.current = s;
    const sound = s.sound && audio;
    if (firstLoad.current) {
      firstLoad.current = false;
      seenFx.current = s.fx?.id ?? null;
      return;
    }
    // FX
    if (s.fx && s.fx.id !== seenFx.current) {
      seenFx.current = s.fx.id;
      const fresh = now() - s.updatedAt < 5000;
      if (fresh) {
        if (s.fx.kind === 'confetti') {
          fireConfetti(true);
          if (sound) sfx.fanfare();
        } else if (s.fx.kind === 'points') {
          if (sound) (s.fx.delta ?? 0) >= 0 ? sfx.points() : sfx.buzzer();
        } else if (s.fx.kind === 'flash' && sound) sfx.whoosh();
      }
    }
    if (!p || !sound) return;
    if (s.poll && s.poll.status === 'open' && p.poll?.id !== s.poll.id) sfx.ding();
    if (s.poll?.revealed && p.poll && !p.poll.revealed && p.poll.id === s.poll.id) sfx.reveal();
    if (s.card.id && s.card.id !== p.card.id) sfx.reveal();
    if (s.card.locksRevealed && !p.card.locksRevealed) sfx.boom();
    if (s.roulette.status === 'revealed' && p.roulette.status !== 'revealed') sfx.reveal();
    if (s.screen === 'roundIntro' && p.screen !== 'roundIntro') sfx.boom();
    if (s.screen === 'countdown' && p.screen !== 'countdown' && s.countdown) sfx.drumroll(s.countdown.seconds);
  }, [s, audio]);

  // Frame loop for timer ticks, wheel clicks and countdown beats.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = prev.current;
      if (st && st.sound && audio) {
        // timer
        if (st.timer.status === 'running') {
          const sec = Math.ceil(timerRemaining(st.timer) / 1000);
          if (lastSec.current !== null && sec !== lastSec.current) {
            if (sec === 0) sfx.buzzer();
            else if (sec <= 5) sfx.tickLow();
          }
          lastSec.current = sec;
        } else lastSec.current = null;
        // wheel
        const r = st.roulette;
        if (r.status === 'spinning' && st.screen === 'roulette') {
          const t = now();
          const ang = wheelAngle(r, t);
          const segs = Math.max(1, st.wheel.length);
          const seg = Math.floor(ang / (360 / segs));
          if (lastSeg.current !== null && seg !== lastSeg.current && t < r.startedAt + r.durationMs) sfx.wheelTick();
          if (lastSeg.current !== null && t >= r.startedAt + r.durationMs && lastSeg.current !== -1) {
            sfx.boom();
            lastSeg.current = -1;
          } else if (t < r.startedAt + r.durationMs) lastSeg.current = seg;
        } else lastSeg.current = null;
        // verdict countdown
        if (st.screen === 'countdown' && st.countdown) {
          const left = Math.ceil((st.countdown.seconds * 1000 - (now() - st.countdown.startedAt)) / 1000);
          if (cdSec.current !== null && left !== cdSec.current && left >= 0) left <= 3 ? sfx.tickLow() : sfx.tick();
          cdSec.current = left;
        } else cdSec.current = null;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audio]);
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
