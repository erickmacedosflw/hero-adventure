import React from 'react';

type ScrollAreaProps = {
  className?: string;
  viewportClassName?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export const ScrollArea = ({ className = '', viewportClassName = '', style, children }: ScrollAreaProps) => (
  <div className={`relative overflow-hidden ${className}`.trim()} style={style}>
    <div className={`h-full w-full overflow-auto rounded-[inherit] custom-scrollbar ${viewportClassName}`.trim()}>
      {children}
    </div>
  </div>
);