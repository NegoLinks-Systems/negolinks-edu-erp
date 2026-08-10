import * as React from 'react';
import { cn } from '@/lib/utils';
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border bg-[var(--bg-card)] px-3 py-2 text-sm text-white',
        'border-[var(--bg-border)] placeholder:text-[var(--text-muted)]',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:border-[var(--accent-primary)] focus-visible:shadow-[0_0_0_3px_var(--accent-glow)]',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-none',
        className,
      )}
      {...props} />
  ),
);
Textarea.displayName = 'Textarea';
export { Textarea };
