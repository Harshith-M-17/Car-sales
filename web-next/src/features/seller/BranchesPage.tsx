'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LocateFixed, MapPin, Pencil, Phone, Plus, Store, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorNotice, Field, Input, PageHeader } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { formatAddress } from '@/lib/format';
import type { DealerBranch } from '@/lib/types';
import { addressSchema, EMPTY_ADDRESS, phoneSchema, toAddressInput } from '@/lib/validation';
import { useAuth } from '../auth/AuthContext';
import { AddressFields } from './AddressFields';
import { useRemoveBranch, useSaveBranch } from './api';

const schema = addressSchema.extend({
  name: z.string().trim().min(1, 'Name this branch').max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || phoneSchema.safeParse(v).success, 'Enter a valid mobile number'),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export default function BranchesPage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<DealerBranch | 'new' | null>(null);
  const [removing, setRemoving] = useState<DealerBranch | null>(null);
  const remove = useRemoveBranch();
  const toast = useToast();
  const profile = user?.sellerProfile;

  if (!user || !profile) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          icon={<Store className="size-7" />}
          title="This account has no dealership"
          action={<ButtonLink href="/">Go home</ButtonLink>}
        />
      </div>
    );
  }

  const { branches } = profile;
  // A dealer from before addresses were required goes straight to adding one.
  const adding = editing === 'new' || branches.length === 0;

  const confirmRemove = () =>
    removing &&
    remove.mutate(removing.id, {
      onSuccess: () => toast('Branch removed'),
      onError: (err) => toast(errorMessage(err), 'error'),
      onSettled: () => setRemoving(null),
    });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Branches"
        description="Buyers see these addresses on your cars and your dealer page."
        actions={
          branches.length > 0 &&
          !adding && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add branch
            </Button>
          )
        }
      />

      {adding && (
        <div className="mt-6">
          <BranchForm
            defaultName={branches.length === 0 ? 'Main branch' : ''}
            dealerPhone={user.phone}
            onCancel={branches.length > 0 ? () => setEditing(null) : undefined}
            onSaved={() => setEditing(null)}
          />
        </div>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {branches.map((branch, i) =>
          editing !== 'new' && editing?.id === branch.id ? (
            <li key={branch.id} className="sm:col-span-2">
              <BranchForm
                key={branch.id}
                branch={branch}
                dealerPhone={user.phone}
                onCancel={() => setEditing(null)}
                onSaved={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={branch.id} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <span className="min-w-0 truncate">{branch.name}</span>
                {i === 0 && <Badge tone="blue">Main</Badge>}
              </p>
              <p className="mt-2 flex gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {formatAddress(branch)}
              </p>
              <p className="mt-1.5 flex gap-2 text-sm text-slate-600">
                <Phone className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {branch.phone ?? `${user.phone} (your main number)`}
              </p>
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="secondary" size="sm" onClick={() => setEditing(branch)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
                {branches.length > 1 && (
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setRemoving(branch)}>
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? 'this branch'}?`}
        description={
          removing === branches[0]
            ? `This is your main address, so ${branches[1]?.name ?? 'your next branch'} becomes your main branch.`
            : 'Buyers will no longer see this address on your dealer page.'
        }
        confirmLabel="Remove branch"
        tone="danger"
        loading={remove.isPending}
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

function BranchForm({
  branch,
  defaultName = '',
  dealerPhone,
  onCancel,
  onSaved,
}: {
  branch?: DealerBranch;
  defaultName?: string;
  dealerPhone: string;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const save = useSaveBranch(branch?.id);
  const toast = useToast();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: branch
      ? {
          name: branch.name,
          addressLine: branch.addressLine,
          locality: branch.locality ?? '',
          city: branch.city,
          state: branch.state,
          pincode: branch.pincode,
          phone: branch.phone ?? '',
          lat: branch.lat ?? undefined,
          lng: branch.lng ?? undefined,
        }
      : { ...EMPTY_ADDRESS, name: defaultName, phone: '' },
  });
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = form;
  const lat = useWatch({ control, name: 'lat' });

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setValue('lat', Number(pos.coords.latitude.toFixed(5)));
        setValue('lng', Number(pos.coords.longitude.toFixed(5)));
        toast('Location added — buyers nearby will find your cars');
      },
      () => toast('Could not get your location', 'error'),
      { timeout: 10_000 },
    );
  };

  // Not mutate(): adding a dealer's first address closes this form, and that would cancel its callbacks.
  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ name: v.name, ...toAddressInput(v), phone: v.phone || undefined, lat: v.lat, lng: v.lng });
      toast(branch ? 'Branch updated' : 'Branch added');
      onSaved();
    } catch {
      /* shown above the form */
    }
  });

  return (
    <Card>
      <h2 className="mb-4 font-semibold text-slate-900">{branch ? `Edit ${branch.name}` : 'Add a branch'}</h2>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {save.isError && <ErrorNotice message={errorMessage(save.error)} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Branch name" htmlFor="name" error={errors.name?.message} hint="e.g. Whitefield showroom">
              <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
            </Field>
            <Field
              label="Branch phone (optional)"
              htmlFor="phone"
              error={errors.phone?.message}
              hint={`Buyers get this number for cars here. Leave it empty to use ${dealerPhone}.`}
            >
              <Input id="phone" type="tel" aria-invalid={!!errors.phone} {...register('phone')} />
            </Field>
          </div>
          <AddressFields />
          <Button variant="ghost" size="sm" onClick={locate}>
            <LocateFixed className="size-4" />
            {lat !== undefined ? 'Location added — update' : 'Use my current location (optional)'}
          </Button>
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={save.isPending}>
              Save branch
            </Button>
          </div>
        </form>
      </FormProvider>
    </Card>
  );
}
