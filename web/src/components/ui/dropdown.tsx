import * as DM from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/ui/cn';

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;
export const DropdownSeparator = (p: ComponentProps<typeof DM.Separator>) => <DM.Separator className="my-1 h-px bg-border" {...p} />;
export const DropdownLabel = (p: ComponentProps<typeof DM.Label>) => <DM.Label className="px-3 py-1.5 text-xs font-semibold text-muted-foreground" {...p} />;

export function DropdownContent({ className, ...p }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={8}
        align="end"
        className={cn(
          'z-50 min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-black/10',
          'data-[state=open]:animate-pop',
          className,
        )}
        {...p}
      />
    </DM.Portal>
  );
}

export function DropdownItem({ className, ...p }: ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition data-[highlighted]:bg-secondary [&_svg]:size-4 [&_svg]:text-muted-foreground', className)}
      {...p}
    />
  );
}
