import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent text-white',
        secondary: 'border-[var(--bg-border)] bg-[var(--bg-card)] text-[var(--text-secondary)]',
        destructive: 'border-transparent bg-[var(--color-danger)]/20 text-[var(--color-danger)] border-[var(--color-danger)]/30',
        outline: 'border-[var(--accent-border)] text-[var(--accent-light)] bg-[var(--accent-glow)]',
        success: 'border-transparent bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30',
        warning: 'border-transparent bg-[var(--color-warning)]/20 text-[var(--color-warning)] border-[var(--color-warning)]/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
function Badge({ className, variant, style, ...props }: BadgeProps) {
  const gradientStyle = (!variant || variant === 'default')
    ? { background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-deep))', ...style }
    : style;
  return <div className={cn(badgeVariants({ variant }), className)} style={gradientStyle} {...props} />;
}
export { Badge, badgeVariants };
