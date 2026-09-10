'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { requestParent2Login, type RequestState } from './actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

export default function Parent2SignupPage() {
  const [state, action] = useActionState<RequestState, FormData>(requestParent2Login, {});
  useEffect(() => {
    document.title = 'Set up your login — MacVoy School of Irish Dance';
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-pink">Set up your login (Parent 2)</h1>
        <p className="mt-1 text-sm text-brand-ink/70">
          If you&apos;re listed as Parent 2 on a family account, enter that email and we&apos;ll
          send you a link to create your own password.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <FormSuccess message={state.message} />
        <Field label="Email" htmlFor="email" required>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <SubmitButton pendingText="Sending…">Send link</SubmitButton>
      </form>

      <Link href="/login" className="block text-sm text-brand-pink hover:underline">
        Back to login
      </Link>
    </div>
  );
}
