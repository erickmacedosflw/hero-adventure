import React from 'react';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
};

export const Tooltip = ({ content, children }: TooltipProps) => (
  <span className="relative inline-flex group/tooltip">
    {children}
    <span className="pointer-events-none absolute bottom-[calc(100%+0.6rem)] left-1/2 z-[120] w-max max-w-[16rem] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/96 px-3 py-2 text-xs font-semibold text-slate-100 opacity-0 shadow-[0_18px_50px_rgba(2,6,23,0.55)] transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100">
      {content}
      <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-slate-700 bg-slate-950/96" />
    </span>
  </span>
);