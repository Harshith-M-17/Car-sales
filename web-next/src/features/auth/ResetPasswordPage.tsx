'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import Link from '@/components/Link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useToast } from '@/components/toast';
import { Button, ButtonLink, ErrorNotice, Field, Input, PageSpinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { AuthPayload } from '@/lib/types';
import { newPasswordSchema } from '@/lib/validation';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';

const schema = z
  .object({ newPassword: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

// The token is in the URL fragment, which only the browser can see.
const subscribeToHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};
const readHash = () => window.location.hash;
const noHashOnServer = () => null;

export default function ResetPasswordPage() {
  const { applyAuth } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const hash = useSyncExternalStore(subscribeToHash, readHash, noHashOnServer);
  const token = hash && new URLSearchParams(hash.slice(1)).get('token');
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { newPassword: '', confirm: '' } });

  if (hash === null) return <PageSpinner />;

  if (!token) {
    return (
      <AuthShell title="This link isn't valid" subtitle="Open the link from your email again, or request a new one.">
        <ButtonLink href="/forgot-password" size="lg" className="w-full">
          Request a new link
        </ButtonLink>
      </AuthShell>
    );
  }

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setError(null);
    try {
      applyAuth(await api<AuthPayload>('/auth/password/reset', { method: 'POST', body: { token, newPassword } }));
      toast('Password changed. Other devices have been signed out.');
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters with a letter and a number.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorNotice message={error} />}
        <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message}>
          <Input id="newPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...register('newPassword')} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Change password
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Link not working?{' '}
        <Link href="/forgot-password" className="font-medium text-brand-700 hover:underline">
          Request a new one
        </Link>
      </p>
    </AuthShell>
  );
}
