import React from 'react';
import { X } from 'lucide-react';

type Accent = 'wine' | 'sage' | 'gold';

type NavItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
};

type RpgMenuShellProps = {
  title: string;
  subtitle?: string;
  closeLabel?: string;
  onClose: () => void;
  closing?: boolean;
  accent?: Accent;
  valueBadge?: React.ReactNode;
  headerAction?: React.ReactNode;
  navItems?: NavItem[];
  children: React.ReactNode;
  contentClassName?: string;
};

const accentMap: Record<Accent, { header: string; badge: string; active: string }> = {
  wine: {
    header: 'bg-[#6b3141] text-[#f6eadc]',
    badge: 'border-[#d6b47d] bg-[#f1dfc7] text-[#6b3141]',
    active: 'border-[#7d3d4d] bg-[#f3e4d1] text-[#6b3141] shadow-[0_10px_22px_rgba(107,49,65,0.14)]',
  },
  sage: {
    header: 'bg-[#5f5c3f] text-[#f7f0e3]',
    badge: 'border-[#c4b58f] bg-[#f3ead7] text-[#525035]',
    active: 'border-[#6a6848] bg-[#f1ead7] text-[#525035] shadow-[0_10px_22px_rgba(82,80,53,0.14)]',
  },
  gold: {
    header: 'bg-[#7a5733] text-[#fff5e7]',
    badge: 'border-[#e1bc7b] bg-[#f6ebd4] text-[#704f2e]',
    active: 'border-[#8d6339] bg-[#f6ead1] text-[#704f2e] shadow-[0_10px_22px_rgba(112,79,46,0.14)]',
  },
};

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export const RpgMenuPanel = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn('rpg-menu-panel', className)}>{children}</div>
);

export const RpgMenuSectionTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rpg-menu-section-title', className)}>{children}</div>
);

export const RpgMenuTab = ({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) => (
  <button onClick={onClick} className={cn('rpg-menu-tab', active && 'rpg-menu-tab-active', className)}>
    {children}
  </button>
);

export const RpgMenuStat = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={cn('rpg-menu-stat', className)}>
    <div className="rpg-menu-stat-label">{label}</div>
    <div className="rpg-menu-stat-value">{value}</div>
  </div>
);

export const RpgMenuShell = ({
  title,
  subtitle,
  closeLabel = 'Fechar',
  onClose,
  closing = false,
  accent = 'wine',
  valueBadge,
  headerAction,
  navItems,
  children,
  contentClassName,
}: RpgMenuShellProps) => {
  const palette = accentMap[accent];
  const hasSidebar = Boolean(navItems?.length);
  const overlayAnimationClass = closing ? 'rpg-modal-overlay-out' : 'rpg-modal-overlay-in';
  const panelAnimationClass = closing ? 'rpg-modal-panel-out' : 'rpg-modal-panel-in';

  return (
    <div className={cn('absolute inset-0 z-[70] bg-[rgba(28,13,18,0.36)] backdrop-blur-[3px] pointer-events-auto', overlayAnimationClass)} onClick={onClose}>
      <div className="flex h-full w-full items-stretch p-2 sm:p-3 xl:p-5" onClick={(event) => event.stopPropagation()}>
        <div className={cn('rpg-menu-theme mx-auto flex h-full max-h-[calc(100dvh-1rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-[24px] border border-[#c59d82] shadow-[0_24px_90px_rgba(40,20,25,0.32)] sm:max-h-[calc(100dvh-1.5rem)]', panelAnimationClass)}>
            <header className={cn('grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5', palette.header)}>
              <button onClick={onClose} className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80 sm:text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current/20 bg-white/10"><X size={14} /></span>
                {closeLabel}
              </button>
              <div className="min-w-0 text-center">
                <h2 className="truncate rpg-menu-title text-lg sm:text-[1.35rem]">{title}</h2>
                {subtitle && <p className="mt-0.5 truncate text-[11px] opacity-85 sm:text-xs">{subtitle}</p>}
              </div>
              <div className="flex items-center justify-end gap-2">
                {headerAction}
                {valueBadge && <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black shadow-sm sm:text-sm', palette.badge)}>{valueBadge}</div>}
              </div>
            </header>

            {hasSidebar && (
              <div className="border-b border-[#c79e82] bg-[#eddcc8]/95 px-3 py-2 lg:hidden">
                <nav className="flex gap-2 overflow-x-auto custom-scrollbar">
                  {navItems?.map((item) => (
                    <button key={item.id} onClick={item.onClick} className={cn('rpg-menu-tab whitespace-nowrap', item.active && 'rpg-menu-tab-active')}>
                      <span className="inline-flex items-center gap-2">{item.icon}{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            )}

            <div className={cn('grid min-h-0 flex-1 gap-0 bg-[#f4e7d5]', hasSidebar ? 'lg:grid-cols-[13rem_minmax(0,1fr)]' : 'grid-cols-1', contentClassName)}>
              {hasSidebar && (
                <aside className="hidden border-r border-[#c79e82] bg-[#eddcc8]/88 p-3 lg:block lg:p-4">
                  <div className="rpg-menu-panel h-full p-2">
                    <nav className="grid gap-2">
                      {navItems?.map((item) => (
                        <button key={item.id} onClick={item.onClick} className={cn('rpg-menu-nav-item', item.active ? palette.active : 'border-transparent text-[#7c5a56] hover:border-[#c9a489] hover:bg-[#f5eadb]')}>
                          <span className="flex items-center gap-3">
                            {item.icon && <span className="text-current">{item.icon}</span>}
                            <span className="truncate">{item.label}</span>
                          </span>
                        </button>
                      ))}
                    </nav>
                  </div>
                </aside>
              )}

              <div className="min-w-0 min-h-0 overflow-y-auto p-2.5 sm:p-3 lg:p-4">{children}</div>
            </div>
        </div>
      </div>
    </div>
  );
};

export type { NavItem };
