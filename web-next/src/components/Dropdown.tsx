import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from '@/components/Link';
import { cn } from './ui';

export interface DropdownItem {
  label: ReactNode;
  icon?: ReactNode;
  to?: string;
  onSelect?: () => void;
  tone?: 'default' | 'danger';
  badge?: number;
}

/**
 * Small accessible menu: closes on outside click, Escape and selection.
 * Used for the account menu and per-row overflow actions.
 */
export function Dropdown({
  trigger,
  label,
  items,
  header,
  align = 'right',
  className,
}: {
  trigger: ReactNode;
  label: string;
  items: DropdownItem[];
  header?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass = (tone: DropdownItem['tone']) =>
    cn(
      'flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors',
      tone === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
    );

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-40 mt-2 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lift',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {header && <div className="mb-1 border-b border-slate-100 px-3.5 pt-1.5 pb-2.5">{header}</div>}
          {items.map((item, i) => {
            const content = (
              <>
                {item.icon && <span className="text-slate-400 [&>svg]:size-4">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">{item.badge}</span>
                ) : null}
              </>
            );
            return item.to ? (
              <Link key={i} href={item.to} role="menuitem" className={itemClass(item.tone)} onClick={() => setOpen(false)}>
                {content}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={itemClass(item.tone)}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
