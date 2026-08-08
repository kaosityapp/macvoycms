'use client';

import { useActionState } from 'react';
import { updatePassword, type AuthState } from '../actions';
import { Field, FormError, SubmitButton, inputClass } from '@/components/ui';

export default function ResetPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-pink">Choose a new password</h1>
        <p className="mt-1 text-sm text-brand-ink/70">
          Enter a new password for your account.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <Field label="New password" htmlFor="password" required hint="At least 8 characters.">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" required>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>
        <SubmitButton pendingText="Saving…">Save password</SubmitButton>
      </form>
    </div>
  );
}
