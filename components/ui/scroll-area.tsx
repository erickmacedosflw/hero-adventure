import React from 'react';

type ScrollAreaProps = {
  className?: string;
  viewportClassName?: string;
  children: React.ReactNode;
};

export const ScrollArea = ({ className = '', viewportClassName = '', children }: ScrollAreaProps) => (
  <div className={`relative overflow-hidden ${className}`.trim()}>
    <div className={`h-full w-full overflow-auto rounded-[inherit] custom-scrollbar ${viewportClassName}`.trim()}>
      {children}
    </div>
  </div>
);