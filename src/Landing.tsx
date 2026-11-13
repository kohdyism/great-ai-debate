import { useState } from 'react';
import { isLiveBackend } from './lib/config';

export default function Landing() {
  const live = isLiveBackend();
  const [code, setCode] = useState('');
  return (
    <div className="min-h-screen stage-bg relative overflow-hidden">
      <div className="beam beam-blue" />
      <div className="beam beam-red" />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center">
        <div className="led px-8 py-6 anim-rise" style={{ transform: 'perspective(1400px) rotateX(4deg) rotateZ(-1deg)' }}>
          <div className="font-display led-text text-[clamp(28px,6vw,64px)] leading-[0.95]">
            AI SHOULD BE <span className="banned-chip">BANNED</span>
            <br />
            FROM UNIVERSITIES.
          </div>
        </div>
        <div className="font-display text-center leading-[0.86] mt-10 anim-slam delay-2">
          <div className="text-[clamp(40px,8vw,90px)] glow-white">THE GREAT</div>
          <div className="text-[clamp(56px,12vw,140px)]">
            <span className="text-ai">AI</span> <span className="text-debate">DEBATE</span>
          </div>
        </div>
        <div className="mt-3 tracking-[0.4em] text-white/70 text-sm">LIVE · GOODENOUGH COLLEGE</div>

        <div className="grid md:grid-cols-3 gap-4 mt-12 w-full">
          <a href="#/host" className="rounded-2xl p-6 bg-black/50 neon-gold hover:scale-[1.02] transition anim-rise delay-3">
            <div className="text-3xl">🎛️</div>
            <div className="font-display text-2xl mt-2">HOST MODE</div>
            <p className="text-sm text-white/70 mt-1">Run the whole show: rounds, timers, roulette, polls, scores.</p>
          </a>
          <a href="#/stage" target="gad-stage" className="rounded-2xl p-6 bg-black/50 neon-blue hover:scale-[1.02] transition anim-rise delay-4">
            <div className="text-3xl">📽️</div>
            <div className="font-display text-2xl mt-2">STAGE MODE</div>
            <p className="text-sm text-white/70 mt-1">The full-screen projector broadcast. Open on the event laptop, press F.</p>
          </a>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.location.hash = `#/play/${code.trim().toUpperCase()}`;
            }}
            className="rounded-2xl p-6 bg-black/50 neon-red anim-rise delay-5"
          >
            <div className="text-3xl">📱</div>
            <div className="font-display text-2xl mt-2">AUDIENCE</div>
            <p className="text-sm text-white/70 mt-1">Join the jury with the room code on screen.</p>
            <div className="flex gap-2 mt-3">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" className="inp font-display tracking-[0.2em] uppercase" aria-label="Room code" />
              <button className="btn-red">Join</button>
            </div>
          </form>
        </div>
        <div className={`mt-8 chip px-4 py-1.5 text-xs ${live ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-gold/15 text-gold border border-gold/30'}`}>
          {live
            ? 'LIVE MODE · Supabase connected — phones can vote from anywhere'
            : 'DEMO MODE · no Supabase credentials — Host and Stage sync on this computer only; audience can be simulated'}
        </div>
      </div>
    </div>
  );
}
