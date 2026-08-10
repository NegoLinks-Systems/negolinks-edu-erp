import { useEffect, useRef } from 'react';
import { BRAND } from '@/lib/brand';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // CSS animation drives the bar — no JS interval, no re-renders
    // Total: ~600ms then call onDone
    const t = setTimeout(onDone, 650);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.18) 0%, var(--bg-primary) 65%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`
        @keyframes splash-bar { from { width: 0% } to { width: 100% } }
        @keyframes splash-fade { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Content — fades in */}
      <div style={{ animation: 'splash-fade 0.35s ease-out forwards', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', marginBottom: 20,
          background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(201,168,76,0.35)',
          fontSize: '1.75rem', fontFamily: 'Poppins, sans-serif', fontWeight: 900, color: '#080810',
        }}>∞</div>

        <h1 style={{
          fontFamily: 'Poppins, sans-serif', fontWeight: 900, fontSize: '2rem',
          background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          marginBottom: 6, letterSpacing: '-0.02em',
        }}>{BRAND.name}</h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {BRAND.productShort}
        </p>
      </div>

      {/* Progress bar — pure CSS, completes in 600ms */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--bg-border)' }}>
        <div ref={barRef} style={{
          height: '100%',
          background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-light))',
          boxShadow: '0 0 10px var(--accent-glow)',
          animation: 'splash-bar 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }} />
      </div>
    </div>
  );
}
