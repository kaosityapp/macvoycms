'use client';

import { useActionState } from 'react';
import { impersonateFamily, type ImpersonateState } from '../actions';
import { FormError, SubmitButton } from '@/components/ui';

export function ImpersonateButton({ memberId }: { memberId: string }) {
  const [state, action] = useActionState<ImpersonateState, FormData>(impersonateFamily, {});

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="member_id" value={memberId} />
        <FormError message={state.error} />
        <SubmitButton pendingText="Generating link…">Log in as this family</SubmitButton>
      </form>
      {state.url && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">
            Open this in an incognito/private window, not a normal new tab —
          </p>
          <p className="mt-1 text-amber-800">
            logging in here shares cookies with your current browser, so opening it in a regular tab would
            sign you out of admin. A private window keeps the two separate.
          </p>
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-semibold text-brand-pink hover:underline"
          >
            Open their dashboard →
          </a>
          <p className="mt-1 text-xs text-amber-700">
            This link works once and expires soon — generate a new one if you need it again later.
          </p>
        </div>
      )}
    </div>
  );
}
