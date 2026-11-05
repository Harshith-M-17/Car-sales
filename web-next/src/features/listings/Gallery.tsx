import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { CarSilhouette } from '@/components/CarSilhouette';
import { cn } from '@/components/ui';
import type { ListingImage } from '@/lib/types';

export function Gallery({ images, title, bodyType }: { images: ListingImage[]; title: string; bodyType?: string | null }) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = images[index];
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  if (!current) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
        <CarSilhouette type={bodyType ?? undefined} className="w-1/2 text-slate-300" />
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
    >
      <div className="group relative aspect-[16/10] overflow-hidden rounded-2xl bg-slate-900">
        {/* Blurred copy fills the frame so portrait or odd-ratio photos don't get black bars. */}
        <img src={current.thumbUrl} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-2xl" />
        <img
          key={current.id}
          src={current.url}
          alt={`${title} — photo ${index + 1} of ${count}`}
          width={current.width}
          height={current.height}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          decoding="async"
          className="relative size-full object-contain"
        />
        {count > 1 && (
          <>
            <GalleryButton side="left" onClick={() => go(-1)} />
            <GalleryButton side="right" onClick={() => go(1)} />
          </>
        )}
        <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          <Camera className="size-3.5" /> {index + 1} / {count}
        </span>
      </div>
      {count > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-slate-50 transition',
                i === index ? 'ring-brand-600' : 'ring-transparent opacity-60 hover:opacity-100',
              )}
            >
              <img src={img.thumbUrl} alt="" loading="lazy" decoding="async" width={96} height={64} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={cn(
        'absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
