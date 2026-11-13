import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicState } from '../lib/types';
import { StageScreen, HomeScreen } from '../stage/Screens';
import { Backdrop } from '../components/StageKit';

export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`h-card p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="h-title">{title}</div>
          <div className="flex items-center gap-1.5">{right}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function ConfirmButton({ msg, onConfirm, className = 'btn-danger', children, disabled }: { msg: string; onConfirm: () => void; className?: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button className={className} disabled={disabled} onClick={() => window.confirm(msg) && onConfirm()}>
      {children}
    </button>
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
        {s.status === 'paused' && <div className="absolute inset-0 bg-black/80 flex items-center justify-center font-display text-[120px]">PAUSED</div>}
      </div>
      <div className="absolute top-2 left-2 chip bg-black/70 text-white/80 border border-white/15">ON THE PROJECTOR</div>
    </div>
  );
}
