import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';
import { useToggleFavorite } from './api';

export function FavoriteButton({
  listingId,
  isFavorited,
  variant = 'overlay',
}: {
  listingId: string;
  isFavorited?: boolean;
  variant?: 'overlay' | 'icon' | 'inline';
}) {
  const { user } = useAuth();
  const router = useRouter();
  const toggle = useToggleFavorite();
  const toast = useToast();
  const active = !!isFavorited;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault(); // the button sits inside a card link
    e.stopPropagation();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    toggle.mutate(
      { id: listingId, favorite: !active },
      { onError: (err) => toast(errorMessage(err), 'error') },
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? 'Remove from saved cars' : 'Save car'}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition',
        variant === 'overlay' && 'size-9 rounded-full bg-white/95 shadow-md backdrop-blur hover:scale-105 hover:bg-white',
        variant === 'icon' && 'size-9 rounded-full ring-1 ring-slate-200 hover:bg-slate-50',
        variant === 'inline' && 'h-10 rounded-xl px-4 text-sm font-semibold ring-1 ring-slate-300 ring-inset hover:bg-slate-50',
      )}
    >
      <Heart className={cn(variant === 'icon' ? 'size-4' : 'size-5', active ? 'fill-red-500 text-red-500' : 'text-slate-600')} />
      {variant === 'inline' && (active ? 'Saved' : 'Save')}
    </button>
  );
}
