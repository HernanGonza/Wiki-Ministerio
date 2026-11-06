import { useRef, type HTMLAttributes, type MouseEvent } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/ui/cn';

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm', className)} {...p} />;
}

/** Tarjeta con halo que sigue al cursor (spotlight) y elevación al pasar el mouse. */
export function SpotlightCard({ className, children, asChild, onMouseMove, ...p }: HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const Comp = asChild ? Slot : 'div';
  const move = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
    onMouseMove?.(e);
  };
  return (
    <Comp
      ref={ref as never}
      onMouseMove={move}
      className={cn(
        'group/spot relative isolate block overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10',
        'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-300 group-hover/spot:before:opacity-100 hover:before:opacity-100',
        'before:bg-[radial-gradient(360px_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_oklab,var(--rosa)_28%,transparent),transparent_70%)]',
        className,
      )}
      {...p}
    >
      {children}
    </Comp>
  );
}
