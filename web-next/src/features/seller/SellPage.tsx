'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeIndianRupee, Camera, MapPin, PhoneIncoming } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { Navigate } from '@/components/Navigate';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink, Card, ErrorNotice, Field, Input, Spinner } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { APP_NAME } from '@/lib/config';
import type { AuthPayload } from '@/lib/types';
import { dealerSchema, EMPTY_ADDRESS, toDealerInput } from '@/lib/validation';
import { useAuth } from '../auth/AuthContext';
import { AddressFields } from './AddressFields';

const STEPS = [
  { icon: MapPin, title: 'Set up your dealership', text: 'Add your address, plus any other branches buyers can visit.' },
  { icon: Camera, title: 'List your cars', text: 'Brand, model, price and a few clear photos for each car.' },
  { icon: PhoneIncoming, title: 'Get inquiries', text: 'Interested buyers contact you directly by phone or WhatsApp.' },
  { icon: BadgeIndianRupee, title: 'Sell on your terms', text: 'Meet the buyer, negotiate and close the deal yourself.' },
];

/** Entry point for dealers: sign up, upgrade a buyer account, or go straight to the form. */
export default function SellPage() {
  const { status, user } = useAuth();

  if (user && (user.role === 'seller' || user.role === 'admin')) return <Navigate to="/dashboard/listings/new" replace />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sell more cars from your dealership</h1>
          <p className="mt-3 text-slate-600">
            {APP_NAME} is for used-car dealers. List your stock for free and reach genuine buyers in your city, with every branch on one account.
          </p>
          <ul className="mt-8 space-y-5">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-slate-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {status === 'loading' ? (
          <Card className="flex min-h-64 items-center justify-center p-8">
            <Spinner />
          </Card>
        ) : user ? (
          <BecomeDealerForm />
        ) : (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold">Create a dealer account</h2>
            <p className="mt-2 text-sm text-slate-600">Keep your dealership address handy. It takes about two minutes.</p>
            <div className="mt-6 space-y-3">
              <ButtonLink href="/register?as=seller" size="lg" className="w-full">
                Register your dealership
              </ButtonLink>
              <ButtonLink href="/login?next=%2Fsell" variant="secondary" size="lg" className="w-full">
                I already have an account
              </ButtonLink>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function BecomeDealerForm() {
  const { applyAuth } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const form = useForm({
    resolver: zodResolver(dealerSchema),
    defaultValues: { businessName: '', ...EMPTY_ADDRESS },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(async (v) => {
    try {
      const payload = await api<AuthPayload>('/me/seller-profile', { method: 'POST', body: toDealerInput(v) });
      applyAuth(payload);
      toast('Dealership set up');
      router.push('/dashboard/listings/new');
    } catch (err) {
      setError('root', { message: errorMessage(err) });
    }
  });

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-xl font-semibold">Set up your dealership</h2>
      <p className="mt-1 mb-5 text-sm text-slate-600">Buyers see this on your listings. You can add more branches later.</p>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {errors.root?.message && <ErrorNotice message={errors.root.message} />}
          <Field label="Dealership name" htmlFor="businessName" error={errors.businessName?.message}>
            <Input id="businessName" aria-invalid={!!errors.businessName} {...register('businessName')} />
          </Field>
          <AddressFields />
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Continue
          </Button>
        </form>
      </FormProvider>
    </Card>
  );
}
