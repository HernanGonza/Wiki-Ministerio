import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/ui/cn';

export function TableWrap({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-x-auto rounded-2xl border bg-card shadow-sm', className)} {...p} />;
}
export const Table = (p: HTMLAttributes<HTMLTableElement>) => <table className="w-full border-collapse text-sm" {...p} />;
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground" {...p} />;
export const TH = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('px-4 py-3 font-semibold', className)} {...p} />;
export const TR = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('border-t transition-colors hover:bg-secondary/40', className)} {...p} />;
export const TD = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-3 align-top', className)} {...p} />;
