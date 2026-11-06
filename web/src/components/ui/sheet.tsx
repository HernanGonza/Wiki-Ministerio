import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/ui/cn';

interface PanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

const spring = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } as const;

function Overlay() {
  return (
    <Dialog.Overlay asChild forceMount>
      <motion.div className="fixed inset-0 z-50 bg-verde-900/45 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
    </Dialog.Overlay>
  );
}

function Header({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
      <div>
        <Dialog.Title className="text-lg font-bold tracking-tight">{title}</Dialog.Title>
        <Dialog.Description className={cn('mt-0.5 text-sm text-muted-foreground', !description && 'sr-only')}>{description ?? title}</Dialog.Description>
      </div>
      <Dialog.Close className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Cerrar">
        <X className="size-4" />
      </Dialog.Close>
    </header>
  );
}

/** Cajón lateral (drawer) que entra desde la derecha; en móvil sube desde abajo. */
export function Sheet({ open, onOpenChange, title, description, children, className, side = 'right' }: PanelProps & { side?: 'right' | 'left' }) {
  const from = side === 'right' ? '100%' : '-100%';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Overlay />
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.aside
                className={cn(
                  'fixed z-50 flex flex-col border bg-card shadow-2xl outline-none',
                  'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl sm:inset-y-0 sm:max-h-none sm:w-[34rem] sm:max-w-[92vw] sm:rounded-none',
                  side === 'right' ? 'sm:left-auto sm:right-0 sm:rounded-l-3xl' : 'sm:left-0 sm:right-auto sm:rounded-r-3xl',
                  className,
                )}
                initial={{ x: from, y: 0, opacity: 0.6 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={{ x: from, opacity: 0.4 }}
                transition={spring}
              >
                <Header title={title} description={description} />
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** Modal centrado con entrada tipo resorte. */
export function Modal({ open, onOpenChange, title, description, children, className }: PanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Overlay />
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className={cn('pointer-events-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-3xl border bg-card shadow-2xl outline-none', className)}
                  initial={{ opacity: 0, scale: 0.92, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={spring}
                >
                  <Header title={title} description={description} />
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
