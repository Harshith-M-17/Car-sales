'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from '@/components/Link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge, Button, Card, CardTitle, ErrorNotice, Field, Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage, session } from '@/lib/api';
import { newPasswordSchema, phoneSchema } from '@/lib/validation';
import type { AuthPayload, User } from '@/lib/types';
import { Avatar } from '@/components/layout/Avatar';
import { useAuth } from '../auth/AuthContext';

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: phoneSchema,
    isDealer: z.boolean(),
    businessName: z.string().trim().max(120),
  })
  .refine((v) => !v.isDealer || v.businessName.length > 0, {
    path: ['businessName'],
    message: 'Enter your dealership name',
  });

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{user.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {user.email} <Badge className="capitalize">{user.role === 'seller' ? 'dealer' : user.role}</Badge>
            {user.sellerProfile?.verified && <Badge tone="blue">Verified dealer</Badge>}
          </p>
        </div>
      </div>
      <ProfileForm user={user} />
      <PasswordForm />
      <SessionsCard />
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const sp = user.sellerProfile;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone,
      isDealer: !!sp,
      businessName: sp?.businessName ?? '',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      const updated = await api<User>('/me', {
        method: 'PATCH',
        body: {
          name: v.name,
          phone: v.phone,
          ...(sp && { sellerProfile: { businessName: v.businessName } }),
        },
      });
      setUser(updated);
      reset(v);
      toast('Profile saved');
    } catch (err) {
      setError('root', { message: errorMessage(err) });
    }
  });

  return (
    <Card>
      <CardTitle description="Shown to people you contact or who contact you">Profile</CardTitle>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.root?.message && <ErrorNotice message={errors.root.message} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...register('name')} />
          </Field>
          <Field label="Mobile number" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" {...register('phone')} />
          </Field>
        </div>
        {sp && (
          <div className="border-t border-slate-100 pt-4">
            <Field label="Dealership name" htmlFor="businessName" error={errors.businessName?.message}>
              <Input id="businessName" aria-invalid={!!errors.businessName} {...register('businessName')} />
            </Field>
            <p className="mt-3 text-sm text-slate-600">
              Addresses are managed under{' '}
              <Link href="/dashboard/branches" className="font-medium text-brand-700 hover:underline">
                Branches
              </Link>
              .
            </p>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { applyAuth } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      const payload = await api<AuthPayload>('/me/password', {
        method: 'PATCH',
        body: { currentPassword: v.currentPassword, newPassword: v.newPassword },
      });
      applyAuth(payload);
      reset();
      toast('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError('root', { message: errorMessage(err) });
    }
  });

  return (
    <Card>
      <CardTitle description="Use at least 8 characters with a letter and a number">Change password</CardTitle>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.root?.message && <ErrorNotice message={errors.root.message} />}
        <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}>
          <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message}>
            <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const signOutEverywhere = async () => {
    setLoading(true);
    try {
      await api('/auth/logout-all', { method: 'POST' });
      session.set(null);
      router.push('/login');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Card>
      <h2 className="font-semibold">Sessions</h2>
      <p className="mt-1 text-sm text-slate-600">Lost a phone or used a shared computer? Sign out of every device.</p>
      <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
        Sign out of all devices
      </Button>
      <ConfirmDialog
        open={open}
        title="Sign out everywhere?"
        description="You'll need to sign in again on every device, including this one."
        confirmLabel="Sign out everywhere"
        tone="danger"
        loading={loading}
        onConfirm={signOutEverywhere}
        onClose={() => setOpen(false)}
      />
    </Card>
  );
}
