import { useId } from 'react';
import { cn } from './cn';

/** Flor del Lapacho: 5 pétalos con degradé rosa (#F5A5BF → #C9346C), según el Brandbook 2024. */
export function Flor({ className, mono = false }: { className?: string; mono?: boolean }) {
  const id = useId().replace(/:/g, '');
  const petal = 'M50 50 C37 41 28 22 36 11 C41 5 47 8 50 12 C53 8 59 5 64 11 C72 22 63 41 50 50Z';
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`g${id}`} cx="50%" cy="50%" r="55%">
          <stop offset="0" stopColor="#C9346C" />
          <stop offset="0.55" stopColor="#E9709A" />
          <stop offset="1" stopColor="#F5A5BF" />
        </radialGradient>
      </defs>
      {[0, 72, 144, 216, 288].map((r) => (
        <g key={r} transform={`rotate(${r} 50 50)`}>
          <path d={petal} fill={mono ? 'currentColor' : `url(#g${id})`} />
          {!mono && (
            <path d="M50 46 L50 15 M47 44 L41 20 M53 44 L59 20" stroke="#fff" strokeOpacity="0.38" strokeWidth="0.9" strokeLinecap="round" fill="none" />
          )}
        </g>
      ))}
      <circle cx="50" cy="50" r="5.2" fill={mono ? 'var(--background)' : '#fff'} />
    </svg>
  );
}

/** Logo horizontal: flor + ECOLOGÍA / MISIONES. Verde institucional, sin deformar (Brandbook p. 14). */
export function Logo({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 leading-none', className)}>
      <Flor className="size-9 shrink-0 drop-shadow-sm" />
      <span className={cn('flex flex-col text-verde-700 dark:text-primary', compacto && 'hidden sm:flex')}>
        <span className="text-[1.15rem] font-medium tracking-wide">ECOLOGÍA</span>
        <span className="text-[0.62rem] font-semibold tracking-[0.32em]">MISIONES</span>
      </span>
    </span>
  );
}

/** Patrón de flores del Key Visual (Brandbook p. 17), con degradé de desvanecido. */
export function PatronFlores({ className }: { className?: string }) {
  const filas = 7;
  const cols = 14;
  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <svg viewBox="0 0 700 330" className="h-full w-full" preserveAspectRatio="xMaxYMid slice">
        <defs>
          <linearGradient id="fadeFlores" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.65" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="maskFlores"><rect width="700" height="330" fill="url(#fadeFlores)" /></mask>
          <symbol id="flor5" viewBox="0 0 100 100">
            {[0, 72, 144, 216, 288].map((r) => (
              <path key={r} transform={`rotate(${r} 50 50)`} d="M50 50 C37 41 28 22 36 11 C41 5 47 8 50 12 C53 8 59 5 64 11 C72 22 63 41 50 50Z" />
            ))}
            <circle cx="50" cy="50" r="6" fill="var(--flor-centro, #3e6c51)" />
          </symbol>
        </defs>
        <g mask="url(#maskFlores)" fill="currentColor">
          {Array.from({ length: filas }).flatMap((_, y) =>
            Array.from({ length: cols }).map((__, x) => (
              <use key={`${x}-${y}`} href="#flor5" x={x * 50 + (y % 2 ? 25 : 0)} y={y * 46} width="40" height="40" />
            )),
          )}
        </g>
      </svg>
    </div>
  );
}
