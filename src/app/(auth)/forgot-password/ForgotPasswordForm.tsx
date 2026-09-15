'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset, type AuthState } from '../actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

export function ForgotPasswordForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  // Once a new link has been sent, the "expired link" notice is stale.
  const shownNotice = state.error ?? (state.message ? undefined : notice);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-pink">Reset your password</h1>
        <p className="mt-1 text-sm text-brand-ink/70">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <FormError message={shownNotice} />
        <FormSuccess message={state.message} />
        <Field label="Email" htmlFor="email" required>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      </form>

      <Link href="/login" className="block text-sm text-brand-pink hover:underline">
        Back to login
      </Link>
    </div>
  );
}
