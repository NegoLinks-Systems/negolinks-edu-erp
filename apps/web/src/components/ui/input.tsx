import * as React from 'react';
import { cn } from '@/lib/utils';
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-sm text-white',
        'border-[var(--bg-border)] placeholder:text-[var(--text-muted)]',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:border-[var(--accent-primary)] focus-visible:shadow-[0_0_0_3px_var(--accent-glow)]',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props} />
  ),
);
Input.displayName = 'Input';
export { Input };
