'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * NavigationProgress
 *
 * A 3px violet progress bar fixed at the very top of the viewport.
 * Triggered on every pathname change — starts an animated forward-slide,
 * then fades out once the transition settles.
 *
 * Uses CSS keyframes defined in globals.css (nav-slide, nav-fade-out).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'idle' | 'sliding' | 'done'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef  = useRef(pathname);

  useEffect(() => {
    // Ignore the very first render (no navigation occurred yet)
    if (prevRef.current === pathname) return;
    prevRef.current = pathname;

    // Start the bar
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('sliding');

    // After the slide animation completes (600ms), show full width then fade out
    timerRef.current = setTimeout(() => {
      setPhase('done');
      timerRef.current = setTimeout(() => setPhase('idle'), 350);
    }, 600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  if (phase === 'idle') return null;

  return (
    <div
      style={{
        position:     'fixed',
        top:          0,
        left:         0,
        height:       '3px',
        zIndex:       9999,
        pointerEvents:'none',
        width:        phase === 'done' ? '100%' : undefined,
        opacity:      phase === 'done' ? 0 : 1,
        transition:   phase === 'done' ? 'opacity 0.35s ease-out' : undefined,
        animation:    phase === 'sliding'
          ? 'nav-slide 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : undefined,
        background:   'linear-gradient(90deg, #7c6df0, #a89ff5)',
        boxShadow:    '0 0 10px rgba(124,109,240,0.7), 0 0 4px rgba(124,109,240,0.4)',
      }}
    />
  );
}
