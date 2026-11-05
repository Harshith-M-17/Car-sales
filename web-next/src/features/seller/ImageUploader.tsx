import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { prepareImage } from '@/lib/image';
import { uploadImages } from './api';

export interface UploadedImage {
  id: string;
  thumbUrl: string;
}

export function ImageUploader({
  value,
  onChange,
  max = 20,
}: {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();
  const remaining = max - value.length;

  const addFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (files.length > remaining) toast(`Only ${remaining} more photo${remaining === 1 ? '' : 's'} allowed`, 'error');
    const selected = files.slice(0, remaining);
    if (!selected.length) return;

    setProgress(0);
    try {
      // Sequential on purpose: decoding many 12MP photos at once can exhaust memory on phones.
      const prepared: Blob[] = [];
      for (const file of selected) prepared.push(await prepareImage(file));
      const uploaded = await uploadImages(prepared, setProgress);
      onChange([...value, ...uploaded.map((m) => ({ id: m.id, thumbUrl: m.thumbUrl }))]);
    } catch (err) {
      toast(errorMessage(err, 'Upload failed'), 'error');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((img, i) => (
          <figure key={img.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
            <img src={img.thumbUrl} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-brand-600 px-1.5 py-0.5 text-xs font-medium text-white">
                <Star className="size-3" /> Cover
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-slate-900/70 p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <div className="flex gap-1">
                <IconButton label="Move left" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  <ChevronLeft className="size-4" />
                </IconButton>
                <IconButton label="Move right" onClick={() => move(i, i + 1)} disabled={i === value.length - 1}>
                  <ChevronRight className="size-4" />
                </IconButton>
              </div>
              <IconButton label="Remove photo" onClick={() => onChange(value.filter((v) => v.id !== img.id))}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          </figure>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            disabled={progress !== null}
            className={cn(
              'flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm transition',
              dragging ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-500 hover:border-brand-400 hover:text-brand-700',
            )}
          >
            {progress !== null ? (
              <>
                <span className="font-medium">Uploading… {Math.round(progress * 100)}%</span>
                <span className="h-1.5 w-2/3 overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full bg-brand-600 transition-all" style={{ width: `${progress * 100}%` }} />
                </span>
              </>
            ) : (
              <>
                <ImagePlus className="size-7" />
                <span className="font-medium">Add photos</span>
                <span className="text-xs">{remaining} remaining</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
      <p className="mt-2 text-xs text-slate-500">
        Tip: clear daylight photos of the front, back, sides, interior, dashboard (odometer) and tyres get the most inquiries.
        The first photo is the cover.
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-white/90 p-1 text-slate-700 hover:bg-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}
