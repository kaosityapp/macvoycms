'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, type AuthState } from '../actions';
import { Field, FormError, SubmitButton, inputClass } from '@/components/ui';

export default function LoginPage() {
  const [state, action] = useActionState<AuthState, FormData>(login, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-pink">Log in</h1>
        <p className="mt-1 text-sm text-brand-ink/70">
          Sign in to manage your dancers, schedules, and payments.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <Field label="Email" htmlFor="email" required>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      </form>

      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-pink hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-brand-pink hover:underline">
          New here? Register
        </Link>
      </div>
    </div>
  );
}
