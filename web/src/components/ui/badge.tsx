import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/ui/cn';

const variants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-secondary text-secondary-foreground',
      primary: 'bg-primary/15 text-primary',
      rosa: 'bg-accent text-accent-foreground',
      danger: 'bg-destructive/12 text-destructive',
      warn: 'bg-warning/15 text-warning',
      ok: 'bg-success/15 text-success',
      outline: 'border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof variants>) {
  return <span className={cn(variants({ variant }), className)} {...p} />;
}
