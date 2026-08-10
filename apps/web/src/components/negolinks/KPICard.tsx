import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: LucideIcon;
  subtitle?: string;
  loading?: boolean;
}

export function KPICard({ title, value, trend, trendUp, icon: Icon, subtitle, loading }: KPICardProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #141420, #1A1A2E)',
      border: '1px solid var(--accent-border)',
      borderRadius: '12px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent glow top-right */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: 'var(--accent-glow)', borderRadius: '0 12px 0 100%', filter: 'blur(20px)' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} style={{ color: 'var(--accent-light)' }} />
        </div>
        {trend && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: trendUp ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {trend}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ height: 32, background: 'var(--bg-border)', borderRadius: 6, animation: 'pulse 2s infinite', marginBottom: 8 }} />
      ) : (
        <div style={{
          fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, marginBottom: 4,
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>{value}</div>
      )}
      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: subtitle ? 2 : 0 }}>{title}</div>
      {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</div>}
    </div>
  );
}
