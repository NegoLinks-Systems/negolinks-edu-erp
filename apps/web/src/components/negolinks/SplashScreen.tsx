import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const step = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(step); setTimeout(onDone, 200); return 100; }
        return p + 4;
      });
    }, 40);
    return () => clearInterval(step);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.18) 0%, var(--bg-primary) 65%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Animated star particles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: Math.random() * 2 + 1, height: Math.random() * 2 + 1,
            background: 'var(--accent-light)', borderRadius: '50%', opacity: Math.random() * 0.6 + 0.2,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }} />
        ))}
      </div>

      {/* Logo placeholder — gold infinity emblem */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%', marginBottom: 24,
        background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 40px rgba(201,168,76,0.4)',
        fontSize: '2rem', fontFamily: 'Poppins, Inter, sans-serif', fontWeight: 900, color: '#080810',
      }}>∞</div>

      <h1 style={{
        fontFamily: 'Poppins, Inter, sans-serif', fontWeight: 900, fontSize: '2.25rem',
        background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        marginBottom: 8, letterSpacing: '-0.02em',
      }}>{BRAND.name}</h1>

      <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem', marginBottom: 4, letterSpacing: '0.02em' }}>
        {BRAND.productShort}
      </h2>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 48, letterSpacing: '0.05em' }}>
        Loading Enterprise Platform
        <span style={{ animation: 'pulse 1.5s infinite' }}>...</span>
      </p>

      {/* Progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--bg-border)' }}>
        <div style={{
          height: '100%', width: `${progress}%`, transition: 'width 0.04s linear',
          background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-light))',
          boxShadow: '0 0 10px var(--accent-glow)',
        }} />
      </div>
    </div>
  );
}
