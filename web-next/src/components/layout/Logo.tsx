import { CarFront } from 'lucide-react';
import Link from '@/components/Link';
import { cn } from '@/components/ui';
import { APP_NAME } from '@/lib/config';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${APP_NAME} home`}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-700/30">
        <CarFront className="size-5" />
      </span>
      <span className={cn('text-lg font-bold tracking-tight', light ? 'text-white' : 'text-slate-900')}>{APP_NAME}</span>
    </Link>
  );
}
