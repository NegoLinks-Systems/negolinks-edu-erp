import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'text-white shadow-lg hover:-translate-y-0.5 hover:shadow-[0_4px_20px_var(--accent-glow)]',
        destructive: 'bg-[var(--color-danger)] text-white hover:opacity-90',
        outline: 'border border-[var(--accent-border)] bg-transparent text-[var(--accent-light)] hover:bg-[var(--accent-glow)]',
        secondary: 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--bg-border)] hover:text-white',
        ghost: 'text-[var(--text-secondary)] hover:bg-[var(--accent-glow)] hover:text-white',
        link: 'text-[var(--accent-light)] underline-offset-4 hover:underline',
      },
      size: { default: 'h-10 px-5 py-2', sm: 'h-8 rounded-md px-3 text-xs', lg: 'h-11 rounded-lg px-8', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const gradientStyle = (!variant || variant === 'default') 
      ? { background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-deep))', ...style }
      : style;
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} style={gradientStyle} {...props} />;
  },
);
Button.displayName = 'Button';
export { Button, buttonVariants };
