import * as React from 'react';
import { GripVertical } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { cn } from '../../lib/utils';

export function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return <Group className={cn('h-full w-full', className)} {...props} />;
}

export const ResizablePanel = Panel;

export function ResizableHandle({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        'group relative flex w-3 items-center justify-center bg-card outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <GripVertical aria-hidden="true" className="z-10 h-5 w-3 bg-card text-muted-foreground group-hover:bg-muted group-hover:text-foreground" />
    </Separator>
  );
}
