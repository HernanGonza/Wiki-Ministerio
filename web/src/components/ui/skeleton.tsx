import type { HTMLAttributes } from 'react';
import { cn } from '@/ui/cn';

export function Skeleton({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-shimmer rounded-xl bg-[linear-gradient(90deg,var(--muted)_30%,color-mix(in_oklab,var(--muted)_55%,var(--card))_50%,var(--muted)_70%)] bg-[length:200%_100%]', className)}
      {...p}
    />
  );
}
