import type { ReactNode } from 'react';
import { cn, Select } from '@/components/ui';
import { formatPriceShort, labelize } from '@/lib/format';
import { useCatalog } from '../catalog/useCatalog';
import type { SearchFilters } from './api';

const PRICE_STEPS = [100_000, 200_000, 300_000, 500_000, 800_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000];
const KM_STEPS = [10_000, 25_000, 50_000, 75_000, 100_000, 150_000];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => currentYear - i);

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset',
        active
          ? 'bg-brand-600 text-white ring-brand-600'
          : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400',
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-5 last:border-0">
      <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h3>
      {children}
    </div>
  );
}

const toggle = (list: string[] | undefined, value: string) => {
  const set = new Set(list);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set].sort();
};

const numOrUndefined = (v: string) => (v ? Number(v) : undefined);

export function FiltersPanel({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (patch: Partial<SearchFilters>) => void;
}) {
  const { data: catalog } = useCatalog();
  const make = catalog?.makes.find((m) => m.slug === filters.make);

  return (
    <div>
      <Section title="Location">
        <Select value={filters.city ?? ''} onChange={(e) => onChange({ city: e.target.value || undefined })} aria-label="City">
          <option value="">All cities</option>
          {catalog?.cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </Section>

      <Section title="Brand & model">
        <div className="space-y-2">
          <Select
            value={filters.make ?? ''}
            onChange={(e) => onChange({ make: e.target.value || undefined, model: undefined })}
            aria-label="Brand"
          >
            <option value="">All brands</option>
            {catalog?.makes.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.model ?? ''}
            onChange={(e) => onChange({ model: e.target.value || undefined })}
            disabled={!make}
            aria-label="Model"
          >
            <option value="">{make ? 'All models' : 'Choose a brand first'}</option>
            {make?.models.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Budget">
        <div className="grid grid-cols-2 gap-2">
          <Select value={filters.minPrice ?? ''} onChange={(e) => onChange({ minPrice: numOrUndefined(e.target.value) })} aria-label="Minimum price">
            <option value="">Min</option>
            {PRICE_STEPS.filter((p) => !filters.maxPrice || p < filters.maxPrice).map((p) => (
              <option key={p} value={p}>
                {formatPriceShort(p)}
              </option>
            ))}
          </Select>
          <Select value={filters.maxPrice ?? ''} onChange={(e) => onChange({ maxPrice: numOrUndefined(e.target.value) })} aria-label="Maximum price">
            <option value="">Max</option>
            {PRICE_STEPS.filter((p) => !filters.minPrice || p > filters.minPrice).map((p) => (
              <option key={p} value={p}>
                {formatPriceShort(p)}
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Body type">
        <div className="flex flex-wrap gap-2">
          {catalog?.bodyTypes.map((b) => (
            <Chip key={b} active={!!filters.body?.includes(b)} onClick={() => onChange({ body: toggle(filters.body, b) })}>
              {labelize(b)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Fuel">
        <div className="flex flex-wrap gap-2">
          {catalog?.fuelTypes.map((f) => (
            <Chip key={f} active={!!filters.fuel?.includes(f)} onClick={() => onChange({ fuel: toggle(filters.fuel, f) })}>
              {labelize(f)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Transmission">
        <div className="flex flex-wrap gap-2">
          <Chip active={!filters.transmission} onClick={() => onChange({ transmission: undefined })}>
            Any
          </Chip>
          {catalog?.transmissions.map((t) => (
            <Chip key={t} active={filters.transmission === t} onClick={() => onChange({ transmission: t })}>
              {labelize(t)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Model year">
        <Select value={filters.minYear ?? ''} onChange={(e) => onChange({ minYear: numOrUndefined(e.target.value) })} aria-label="Minimum year">
          <option value="">Any year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y} or newer
            </option>
          ))}
        </Select>
      </Section>

      <Section title="Kilometres driven">
        <Select value={filters.maxKm ?? ''} onChange={(e) => onChange({ maxKm: numOrUndefined(e.target.value) })} aria-label="Maximum kilometres">
          <option value="">Any distance</option>
          {KM_STEPS.map((k) => (
            <option key={k} value={k}>
              Under {k / 1000}k km
            </option>
          ))}
        </Select>
      </Section>

      <Section title="Ownership">
        <div className="flex flex-wrap gap-2">
          {([undefined, 1, 2] as const).map((n) => (
            <Chip key={n ?? 'any'} active={filters.maxOwners === n} onClick={() => onChange({ maxOwners: n })}>
              {n === undefined ? 'Any' : n === 1 ? '1st owner' : 'Up to 2nd'}
            </Chip>
          ))}
        </div>
      </Section>
    </div>
  );
}
