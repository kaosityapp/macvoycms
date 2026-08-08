'use client';

import { useActionState } from 'react';
import { sendPasswordReset, type ActionState } from '../actions';
import { FormError, FormSuccess, SubmitButton } from '@/components/ui';

export function PasswordResetButton({ email }: { email: string }) {
  const [state, action] = useActionState<ActionState, FormData>(sendPasswordReset, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="email" value={email} />
      <SubmitButton pendingText="Sending…">Send password reset email</SubmitButton>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
    </form>
  );
}
