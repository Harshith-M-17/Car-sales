import { useId } from 'react';
import { useFormContext } from 'react-hook-form';
import { Field, Input, Select } from '@/components/ui';
import type { AddressValues } from '@/lib/validation';
import { useCatalog } from '../catalog/useCatalog';

/** The address inputs shared by dealer sign-up and the branch form. Needs a FormProvider. */
export function AddressFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<AddressValues>();
  const { data: catalog } = useCatalog();
  const cities = useId();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Shop or street address"
        htmlFor="addressLine"
        error={errors.addressLine?.message}
        hint="Shop number, building and street"
        className="sm:col-span-2"
      >
        <Input id="addressLine" autoComplete="address-line1" aria-invalid={!!errors.addressLine} {...register('addressLine')} />
      </Field>
      <Field label="Area / locality (optional)" htmlFor="locality" error={errors.locality?.message}>
        <Input id="locality" autoComplete="address-line2" {...register('locality')} />
      </Field>
      <Field label="City" htmlFor="city" error={errors.city?.message}>
        <Input id="city" list={cities} autoComplete="address-level2" aria-invalid={!!errors.city} {...register('city')} />
        <datalist id={cities}>{catalog?.cities.map((c) => <option key={c.slug} value={c.name} />)}</datalist>
      </Field>
      <Field label="State" htmlFor="state" error={errors.state?.message}>
        <Select id="state" autoComplete="address-level1" aria-invalid={!!errors.state} {...register('state')}>
          <option value="">Select state</option>
          {catalog?.registrationStates.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Pincode" htmlFor="pincode" error={errors.pincode?.message}>
        <Input id="pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" aria-invalid={!!errors.pincode} {...register('pincode')} />
      </Field>
    </div>
  );
}
