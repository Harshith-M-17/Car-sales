'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Link from '@/components/Link';
import { useParams, useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button, ButtonLink, Card, EmptyState, ErrorNotice, Field, Input, PageHeader, PageSpinner, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { formatAddress, formatKm, formatPriceShort, labelize } from '@/lib/format';
import type { DealerBranch, ListingDetail } from '@/lib/types';
import { useAuth } from '../auth/AuthContext';
import { useCatalog } from '../catalog/useCatalog';
import { useOwnedListing, useSaveListing, type ListingInput } from './api';
import { ImageUploader, type UploadedImage } from './ImageUploader';

const currentYear = new Date().getFullYear();
const num = (message: string) => z.number({ error: message });

const schema = z.object({
  makeSlug: z.string().min(1, 'Select the brand'),
  modelSlug: z.string().min(1, 'Select the model'),
  variant: z.string().trim().max(80),
  year: num('Enter the year').int().min(1980, 'Too old').max(currentYear + 1, 'Invalid year'),
  kmDriven: num('Enter kilometres driven').int().min(0).max(2_000_000),
  fuelType: z.string().min(1, 'Select fuel type'),
  transmission: z.string().min(1, 'Select transmission'),
  bodyType: z.string(),
  ownerCount: num('Select owners').int().min(1).max(10),
  color: z.string().trim().max(40),
  price: num('Enter the price').int().min(10_000, 'Minimum ₹10,000').max(1_000_000_000),
  negotiable: z.boolean(),
  registrationState: z.string(),
  insuranceValidTill: z.string(),
  description: z.string().trim().max(5000),
  features: z.array(z.string()),
  branchId: z.string().min(1, 'Select the branch'),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  makeSlug: '',
  modelSlug: '',
  variant: '',
  year: NaN,
  kmDriven: NaN,
  fuelType: '',
  transmission: '',
  bodyType: '',
  ownerCount: 1,
  color: '',
  price: NaN,
  negotiable: true,
  registrationState: '',
  insuranceValidTill: '',
  description: '',
  features: [],
  branchId: '',
};

function toFormValues(l: ListingDetail): FormValues {
  return {
    makeSlug: l.makeSlug,
    modelSlug: l.modelSlug,
    variant: l.variant ?? '',
    year: l.year,
    kmDriven: l.kmDriven,
    fuelType: l.fuelType,
    transmission: l.transmission,
    bodyType: l.bodyType ?? '',
    ownerCount: l.ownerCount,
    color: l.color ?? '',
    price: l.price,
    negotiable: l.negotiable,
    registrationState: l.registrationState ?? '',
    insuranceValidTill: l.insuranceValidTill?.slice(0, 10) ?? '',
    description: l.description ?? '',
    features: l.features,
    branchId: l.branchId ?? '',
  };
}

export default function ListingFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuth();
  const existing = useOwnedListing(id);
  const branches = user?.sellerProfile?.branches ?? [];
  if (isEdit && existing.isPending) return <PageSpinner />;
  if (isEdit && existing.error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorNotice message={errorMessage(existing.error)} />
      </div>
    );
  }
  if (branches.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={<MapPin className="size-7" />}
          title="Add your dealership address first"
          description="Buyers need to know where each car is, so every car belongs to a branch."
          action={<ButtonLink href="/dashboard/branches">Add address</ButtonLink>}
        />
      </div>
    );
  }
  return <ListingForm key={id ?? 'new'} listing={existing.data} branches={branches} />;
}

function ListingForm({ listing, branches }: { listing?: ListingDetail; branches: DealerBranch[] }) {
  const router = useRouter();
  const toast = useToast();
  const { data: catalog } = useCatalog();
  const save = useSaveListing(listing?.id);
  const [images, setImages] = useState<UploadedImage[]>(
    listing?.images.map((i) => ({ id: i.id, thumbUrl: i.thumbUrl })) ?? [],
  );
  const [imageError, setImageError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: listing ? toFormValues(listing) : { ...EMPTY, branchId: branches.length === 1 ? branches[0].id : '' },
  });

  const [makeSlug, price, branchId, km] = useWatch({ control, name: ['makeSlug', 'price', 'branchId', 'kmDriven'] });
  const make = catalog?.makes.find((m) => m.slug === makeSlug);
  const branch = branches.find((b) => b.id === branchId);

  // Changing the brand invalidates the model choice.
  useEffect(() => {
    if (make && !make.models.some((m) => m.slug === getValues('modelSlug'))) setValue('modelSlug', '');
  }, [make, getValues, setValue]);

  const submit = (publish: boolean) =>
    handleSubmit(async (v) => {
      const willBeLive = isLive(listing) || publish;
      if (willBeLive && images.length === 0) {
        setImageError('Add at least one photo');
        return;
      }
      setImageError(null);
      // On edit, null clears an optional field; on create, absent fields are simply omitted.
      const clear = listing ? null : undefined;
      const input: ListingInput = {
        makeSlug: v.makeSlug,
        modelSlug: v.modelSlug,
        variant: v.variant || clear,
        year: v.year,
        kmDriven: v.kmDriven,
        fuelType: v.fuelType,
        transmission: v.transmission,
        bodyType: v.bodyType || clear,
        ownerCount: v.ownerCount,
        color: v.color || clear,
        price: v.price,
        negotiable: v.negotiable,
        registrationState: v.registrationState || clear,
        insuranceValidTill: v.insuranceValidTill || clear,
        description: v.description || clear,
        features: v.features,
        branchId: v.branchId,
        imageIds: images.map((i) => i.id),
        ...(listing ? {} : { publish }),
      };
      try {
        const saved = await save.mutateAsync(input);
        toast(
          listing
            ? 'Listing updated'
            : saved.status === 'active'
              ? 'Your car is live!'
              : saved.status === 'pending'
                ? 'Submitted — your listing will go live after review'
                : 'Draft saved',
        );
        router.push('/dashboard');
      } catch {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

  if (!catalog) return <PageSpinner />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title={listing ? `Edit ${listing.title}` : 'List a car'}
        description={
          listing ? 'Changes go live immediately.' : 'Complete listings with good photos sell faster. It takes about 3 minutes.'
        }
      />

      <form className="mt-6 space-y-5" noValidate onSubmit={submit(true)}>
        {save.isError && <ErrorNotice message={errorMessage(save.error)} />}

        <Card>
          <SectionTitle step={1} title="Car details" description="Brand, model and condition" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand" htmlFor="makeSlug" error={errors.makeSlug?.message}>
              <Select id="makeSlug" aria-invalid={!!errors.makeSlug} {...register('makeSlug')}>
                <option value="">Select brand</option>
                {catalog.makes.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Model" htmlFor="modelSlug" error={errors.modelSlug?.message}>
              <Select id="modelSlug" disabled={!make} aria-invalid={!!errors.modelSlug} {...register('modelSlug')}>
                <option value="">{make ? 'Select model' : 'Select brand first'}</option>
                {make?.models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Variant" htmlFor="variant" hint="e.g. VXi AMT, SX(O) Diesel" error={errors.variant?.message}>
              <Input id="variant" {...register('variant')} />
            </Field>
            <Field label="Registration year" htmlFor="year" error={errors.year?.message}>
              <Input id="year" type="number" inputMode="numeric" min={1980} max={currentYear + 1} aria-invalid={!!errors.year} {...register('year', { valueAsNumber: true })} />
            </Field>
            <Field
              label="Kilometres driven"
              htmlFor="kmDriven"
              error={errors.kmDriven?.message}
              hint={Number.isFinite(km) && km > 0 ? formatKm(km) : undefined}
            >
              <Input id="kmDriven" type="number" inputMode="numeric" min={0} aria-invalid={!!errors.kmDriven} {...register('kmDriven', { valueAsNumber: true })} />
            </Field>
            <Field label="Ownership" htmlFor="ownerCount" error={errors.ownerCount?.message}>
              <Select id="ownerCount" {...register('ownerCount', { valueAsNumber: true })}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 5 ? '5 or more' : `${n}${['st', 'nd', 'rd', 'th'][Math.min(n, 4) - 1]} owner`}</option>)}
              </Select>
            </Field>
            <Field label="Fuel type" htmlFor="fuelType" error={errors.fuelType?.message}>
              <Select id="fuelType" aria-invalid={!!errors.fuelType} {...register('fuelType')}>
                <option value="">Select</option>
                {catalog.fuelTypes.map((f) => <option key={f} value={f}>{labelize(f)}</option>)}
              </Select>
            </Field>
            <Field label="Transmission" htmlFor="transmission" error={errors.transmission?.message}>
              <Select id="transmission" aria-invalid={!!errors.transmission} {...register('transmission')}>
                <option value="">Select</option>
                {catalog.transmissions.map((t) => <option key={t} value={t}>{labelize(t)}</option>)}
              </Select>
            </Field>
            <Field label="Body type" htmlFor="bodyType">
              <Select id="bodyType" {...register('bodyType')}>
                <option value="">Select</option>
                {catalog.bodyTypes.map((b) => <option key={b} value={b}>{labelize(b)}</option>)}
              </Select>
            </Field>
            <Field label="Colour" htmlFor="color">
              <Input id="color" {...register('color')} />
            </Field>
            <Field label="Registration state" htmlFor="registrationState">
              <Select id="registrationState" {...register('registrationState')}>
                <option value="">Select</option>
                {catalog.registrationStates.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </Select>
            </Field>
            <Field label="Insurance valid till" htmlFor="insuranceValidTill">
              <Input id="insuranceValidTill" type="date" {...register('insuranceValidTill')} />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionTitle step={2} title="Price" description="What you expect to get for the car" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Expected price (₹)"
              htmlFor="price"
              error={errors.price?.message}
              hint={Number.isFinite(price) && price > 0 ? formatPriceShort(price) : undefined}
            >
              <Input id="price" type="number" inputMode="numeric" min={10000} step={1000} aria-invalid={!!errors.price} {...register('price', { valueAsNumber: true })} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="size-4 rounded accent-brand-600" {...register('negotiable')} />
              Price is negotiable
            </label>
          </div>
        </Card>

        <Card>
          <SectionTitle step={3} title="Photos" description="Up to 20 photos — the first one is the cover" />
          <ImageUploader
            value={images}
            onChange={(next) => {
              setImages(next);
              if (next.length) setImageError(null);
            }}
          />
          {imageError && <p className="mt-2 text-sm text-red-600" role="alert">{imageError}</p>}
        </Card>

        <Card>
          <SectionTitle step={4} title="Features" description="Tick everything the car has" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.features.map((f) => (
              <label key={f.slug} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={f.slug} className="size-4 rounded accent-brand-600" {...register('features')} />
                {f.label}
              </label>
            ))}
          </div>
          <Field label="Description" htmlFor="description" className="mt-5" error={errors.description?.message} hint="Service history, accidents, new tyres, accessories, warranty…">
            <Textarea id="description" rows={5} maxLength={5000} {...register('description')} />
          </Field>
        </Card>

        <Card>
          <SectionTitle step={5} title="Branch" description="Where buyers can see the car" />
          <Field label="Branch" htmlFor="branchId" error={errors.branchId?.message}>
            <Select id="branchId" aria-invalid={!!errors.branchId} {...register('branchId')}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
            </Select>
          </Field>
          {branch && (
            <p className="mt-3 flex gap-2 text-sm text-slate-600">
              <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
              {formatAddress(branch)}
            </p>
          )}
          <Link href="/dashboard/branches" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
            Manage branches
          </Link>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 flex gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:justify-end sm:rounded-2xl sm:border sm:py-4 sm:shadow-lift [&>button]:flex-1 sm:[&>button]:flex-none">
          {!listing && (
            <Button variant="secondary" size="lg" onClick={submit(false)} disabled={isSubmitting}>
              Save as draft
            </Button>
          )}
          <Button type="submit" size="lg" loading={isSubmitting}>
            {listing ? 'Save changes' : 'Publish listing'}
          </Button>
        </div>
      </form>
    </div>
  );
}

const isLive = (l?: ListingDetail) => !!l && (l.status === 'active' || l.status === 'pending');

function SectionTitle({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {step}
      </span>
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
