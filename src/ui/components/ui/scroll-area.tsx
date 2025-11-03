import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, viewportClassName, ...props }, ref) => (
    <div ref={ref} className={cn('scroll-area', className)} {...props}>
      <div className={cn('scroll-area-viewport', viewportClassName)}>{children}</div>
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';
