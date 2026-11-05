import type { LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui';
import { formatNumber } from '@/lib/format';

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-700',
};

export function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  highlight,
  hint,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: number;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        'h-full rounded-2xl border bg-white p-4 shadow-card transition sm:p-5',
        highlight ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200/80',
      )}
    >
      <span className={cn('flex size-10 items-center justify-center rounded-xl', TONES[tone])}>
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-3xl">{formatNumber(value)}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
      {hint && <p className="mt-2 text-xs font-semibold text-emerald-700">{hint}</p>}
    </div>
  );
}
