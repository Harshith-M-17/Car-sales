'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from '@/components/Link';
import { Navigate } from '@/components/Navigate';
import { z } from 'zod';
import { Button, ButtonLink, ErrorNotice, Field, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.email('Enter a valid email') });

export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  if (user) return <Navigate to="/account" replace />;

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await api('/auth/password/forgot', { method: 'POST', body: { email } });
      setSentTo(email);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If there's an account for ${sentTo}, we've sent it a link to choose a new password. The link expires in 1 hour.`}
      >
        <ButtonLink href="/login" variant="secondary" size="lg" className="w-full">
          Back to sign in
        </ButtonLink>
        <p className="mt-6 text-center text-sm text-slate-600">
          No email? Check your spam folder, or{' '}
          <button type="button" onClick={() => setSentTo(null)} className="font-medium text-brand-700 hover:underline">
            try again
          </button>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your account's email and we'll send you a link to choose a new one.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorNotice message={error} />}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
