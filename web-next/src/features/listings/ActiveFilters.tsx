import { X } from 'lucide-react';
import { formatPriceShort, labelize } from '@/lib/format';
import { useCatalogLookups } from '../catalog/useCatalog';
import type { SearchFilters } from './api';

interface ActiveChip {
  key: string;
  label: string;
  remove: Partial<SearchFilters>;
}

function priceLabel(min?: number, max?: number) {
  if (min && max) return `${formatPriceShort(min)} – ${formatPriceShort(max)}`;
  if (min) return `Above ${formatPriceShort(min)}`;
  return `Under ${formatPriceShort(max!)}`;
}

/** Removable chips for every applied filter, so users can see and undo them at a glance. */
export function ActiveFilters({
  filters,
  onChange,
  onClear,
}: {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
  onClear: () => void;
}) {
  const { makes, cities } = useCatalogLookups();
  const chips: ActiveChip[] = [];
  const make = filters.make ? makes.get(filters.make) : undefined;

  if (filters.q) chips.push({ key: 'q', label: `“${filters.q}”`, remove: { q: undefined } });
  if (filters.city) chips.push({ key: 'city', label: cities.get(filters.city) ?? labelize(filters.city), remove: { city: undefined } });
  if (filters.make) chips.push({ key: 'make', label: make?.name ?? labelize(filters.make), remove: { make: undefined, model: undefined } });
  if (filters.model) {
    const model = make?.models.find((m) => m.slug === filters.model);
    chips.push({ key: 'model', label: model?.name ?? labelize(filters.model), remove: { model: undefined } });
  }
  if (filters.minPrice || filters.maxPrice) {
    chips.push({ key: 'price', label: priceLabel(filters.minPrice, filters.maxPrice), remove: { minPrice: undefined, maxPrice: undefined } });
  }
  for (const b of filters.body ?? []) {
    chips.push({ key: `body-${b}`, label: labelize(b), remove: { body: filters.body!.filter((x) => x !== b) } });
  }
  for (const f of filters.fuel ?? []) {
    chips.push({ key: `fuel-${f}`, label: labelize(f), remove: { fuel: filters.fuel!.filter((x) => x !== f) } });
  }
  if (filters.transmission) chips.push({ key: 'tx', label: labelize(filters.transmission), remove: { transmission: undefined } });
  if (filters.minYear) chips.push({ key: 'year', label: `${filters.minYear} or newer`, remove: { minYear: undefined } });
  if (filters.maxKm) chips.push({ key: 'km', label: `Under ${filters.maxKm / 1000}k km`, remove: { maxKm: undefined } });
  if (filters.maxOwners) {
    chips.push({ key: 'owners', label: filters.maxOwners === 1 ? '1st owner' : `Up to ${filters.maxOwners} owners`, remove: { maxOwners: undefined } });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onChange(chip.remove)}
          className="group inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-2 pl-3 text-[13px] font-medium text-brand-800 ring-1 ring-brand-200 ring-inset hover:bg-brand-100"
          aria-label={`Remove filter ${chip.label}`}
        >
          {chip.label}
          <X className="size-3.5 text-brand-500 group-hover:text-brand-800" />
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={onClear} className="px-1 text-[13px] font-semibold text-slate-600 hover:text-slate-900">
          Clear all
        </button>
      )}
    </div>
  );
}
