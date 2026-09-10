'use client';

import { useActionState, useEffect } from 'react';
import { confirmParent2Login, type ConfirmState } from '../actions';
import { Field, FormError, SubmitButton, inputClass } from '@/components/ui';

export default function ConfirmParent2LoginPage() {
  const [state, action] = useActionState<ConfirmState, FormData>(confirmParent2Login, {});
  useEffect(() => {
    document.title = 'Create a password — MacVoy School of Irish Dance';
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-pink">Create your password</h1>
        <p className="mt-1 text-sm text-brand-ink/70">
          Set a password to finish linking your own login to this family&apos;s account.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <Field label="Password" htmlFor="password" required hint="At least 8 characters.">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
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
            minLength={8}
            className={inputClass}
          />
        </Field>
        <SubmitButton pendingText="Saving…">Set password &amp; continue</SubmitButton>
      </form>
    </div>
  );
}
