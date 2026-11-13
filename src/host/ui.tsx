import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicState } from '../lib/types';
import { StageScreen, HomeScreen } from '../stage/Screens';
import { Backdrop } from '../components/StageKit';

export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`h-card p-3 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="h-title">{title}</div>
          <div className="flex items-center gap-1.5">{right}</div>
        </div>
      )}
      {children}
    </section>
  );
}

/** Button that asks for confirmation before destructive actions. */
export function ConfirmButton({ msg, onConfirm, className = 'btn-danger', children, disabled }: { msg: string; onConfirm: () => void; className?: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={() => {
        if (window.confirm(msg)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}

export function NumInput({ value, onChange, className = '', min, max, step = 1, ...rest }: { value: number; onChange: (n: number) => void; className?: string; min?: number; max?: number; step?: number; 'aria-label'?: string }) {
  return (
    <input
      type="number"
      className={`inp !py-1 !px-2 tabular-nums ${className}`}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      {...rest}
    />
  );
}

export function Step({ n, label, active, done, children }: { n: number | string; label: string; active?: boolean; done?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${active ? 'bg-gold/10 border border-gold/40' : 'border border-transparent'}`}>
      <span className={`w-6 h-6 shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center ${done ? 'bg-emerald-500 text-black' : active ? 'bg-gold text-black' : 'bg-white/10 text-white/70'}`}>
        {done ? '✓' : n}
      </span>
      <span className="text-sm flex-1 min-w-0">{label}</span>
      <div className="flex items-center gap-1 shrink-0">{children}</div>
    </div>
  );
}

/** Live miniature of exactly what the projector shows. */
export function StagePreview({ s }: { s: PublicState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1920));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative w-full rounded-lg overflow-hidden border border-white/15 bg-black" style={{ aspectRatio: '16 / 9' }}>
      <div className="absolute top-0 left-0 stage-bg overflow-hidden pointer-events-none" style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {s.screen === 'home' ? (
          <>
            <Backdrop />
            <HomeScreen s={s} />
          </>
        ) : (
          <StageScreen s={s} />
        )}
        {s.status === 'paused' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center font-display text-[120px]">PAUSED</div>
        )}
      </div>
      <div className="absolute top-2 left-2 chip bg-black/70 text-white/80 border border-white/15">STAGE PREVIEW</div>
    </div>
  );
}
