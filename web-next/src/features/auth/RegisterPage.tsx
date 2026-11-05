'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import Link from '@/components/Link';
import { Navigate } from '@/components/Navigate';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { Button, cn, ErrorNotice, Field, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { dealerSchema, EMPTY_ADDRESS, phoneSchema, toDealerInput } from '@/lib/validation';
import { AddressFields } from '../seller/AddressFields';
import { useAuth } from './AuthContext';
import { AuthShell, safeNext } from './AuthShell';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(80),
    email: z.email('Enter a valid email'),
    phone: phoneSchema,
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .max(128)
      .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Include a letter and a number'),
    accountType: z.enum(['buyer', 'seller']),
    businessName: z.string(),
    addressLine: z.string(),
    locality: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.accountType !== 'seller') return;
    for (const { path, message } of dealerSchema.safeParse(v).error?.issues ?? []) {
      ctx.addIssue({ code: 'custom', path, message });
    }
  });

export default function RegisterPage() {
  const { register: signUp, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const asSeller = params.get('as') === 'seller';
  const next = safeNext(params.get('next') ?? (asSeller ? '/dashboard' : null));
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      accountType: (asSeller ? 'seller' : 'buyer') as 'buyer' | 'seller',
      businessName: '',
      ...EMPTY_ADDRESS,
    },
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  const accountType = useWatch({ control, name: 'accountType' });

  if (user) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signUp({
        name: v.name,
        email: v.email,
        phone: v.phone,
        password: v.password,
        accountType: v.accountType,
        sellerProfile: v.accountType === 'seller' ? toDealerInput(v) : undefined,
      });
      router.replace(v.accountType === 'seller' && next === '/' ? '/dashboard' : next);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthShell
      title={accountType === 'seller' ? 'Register your dealership' : 'Create your account'}
      subtitle={accountType === 'seller' ? 'List your cars for free and get calls from genuine buyers.' : 'Save cars and contact dealers directly.'}
    >
      <FormProvider {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <ErrorNotice message={error} />}

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Account type">
            {(['buyer', 'seller'] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={accountType === type}
                onClick={() => setValue('accountType', type)}
                className={cn(
                  'rounded-lg py-2.5 text-sm font-semibold transition',
                  accountType === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {type === 'buyer' ? 'I want to buy' : "I'm a dealer"}
              </button>
            ))}
          </div>

          <Field label="Full name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Mobile number" htmlFor="phone" error={errors.phone?.message} hint="Shared with the other party only when a buyer contacts a dealer">
            <Input id="phone" type="tel" autoComplete="tel" placeholder="98765 43210" aria-invalid={!!errors.phone} {...register('phone')} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
          </Field>

          {accountType === 'seller' && (
            <fieldset className="space-y-4 rounded-2xl bg-slate-100/70 p-4 ring-1 ring-slate-200/70">
              <legend className="sr-only">Dealership details</legend>
              <div>
                <p className="text-sm font-semibold text-slate-800">Dealership details</p>
                <p className="mt-0.5 text-xs text-slate-500">Buyers see this address. You can add more branches later.</p>
              </div>
              <Field label="Dealership name" htmlFor="businessName" error={errors.businessName?.message}>
                <Input id="businessName" autoComplete="organization" aria-invalid={!!errors.businessName} {...register('businessName')} />
              </Field>
              <AddressFields />
            </fieldset>
          )}

          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Create account
          </Button>
        </form>
      </FormProvider>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
