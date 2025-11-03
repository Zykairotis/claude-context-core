import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('badge', {
  variants: {
    variant: {
      default: 'badge-default',
      secondary: 'badge-secondary',
      outline: 'badge-outline',
      accent: 'badge-accent'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);
