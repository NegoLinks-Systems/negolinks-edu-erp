export function DemoModeBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div style={{
      background: 'linear-gradient(90deg, var(--accent-glow), transparent)',
      borderBottom: '1px solid var(--accent-border)',
      color: 'var(--accent-light)',
      padding: '6px 24px',
      fontSize: '0.75rem',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      letterSpacing: '0.05em',
    }}>
      <span>⚡</span> DEMO MODE — Sample Data Loaded
    </div>
  );
}
