import { useEffect, useRef } from 'react';
import { animate, useInView } from 'motion/react';

/** Número que cuenta desde 0 hasta `valor` al entrar en pantalla. */
export function Contador({ valor, sufijo = '' }: { valor: number; sufijo?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true });
  useEffect(() => {
    if (!visible || !ref.current) return;
    const el = ref.current;
    const c = animate(0, valor, { duration: 0.9, ease: 'easeOut', onUpdate: (v) => { el.textContent = `${Math.round(v)}${sufijo}`; } });
    return () => c.stop();
  }, [visible, valor, sufijo]);
  return <span ref={ref}>0{sufijo}</span>;
}
