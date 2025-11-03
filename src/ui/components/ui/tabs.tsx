import * as React from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
  value: string | undefined;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext(): TabsContextValue {
  const value = React.useContext(TabsContext);
  if (!value) {
    throw new Error('Tabs components must be used within <Tabs>');
  }
  return value;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs = ({
  children,
  className,
  defaultValue,
  value: controlledValue,
  onValueChange,
  ...props
}: TabsProps) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);

  const value = controlledValue ?? uncontrolledValue;

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
    },
    [controlledValue, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={cn('tabs', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TabsList = ({ className, ...props }: TabsListProps) => (
  <div className={cn('tabs-list', className)} role="tablist" {...props} />
);

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const context = useTabsContext();
    const active = context.value === value;

    return (
      <button
        ref={ref}
        type="button"
        className={cn('tabs-trigger', active && 'tabs-trigger--active', className)}
        data-state={active ? 'active' : 'inactive'}
        aria-selected={active}
        onClick={() => context.onValueChange(value)}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = useTabsContext();
    const active = context.value === value;

    if (!active) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn('tabs-content', className)}
        role="tabpanel"
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';
