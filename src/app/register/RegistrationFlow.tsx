'use client';

import { useActionState, useState } from 'react';
import { checkRegistrationEmail, type EmailCheckResult } from './actions';
import { RegistrationForm } from './RegistrationForm';
import { Field, FormError, SubmitButton, inputClass } from '@/components/ui';

interface ClassItem {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  name: string;
  level: string;
  shoe_type: string;
  age_min: number | null;
  age_max: number | null;
  hourly_rate: number | null;
  total_sessions: number | null;
}
interface Group {
  location: { id: string; name: string };
  classes: ClassItem[];
}

type Step = 'email' | 'sent' | 'form';

export function RegistrationFlow({
  groups,
  isLoggedIn,
  parentName,
}: {
  groups: Group[];
  isLoggedIn: boolean;
  parentName: string | null;
}) {
  // Adding a dancer to an already-logged-in account skips the email gate —
  // that's not a "which family is this" question, it's already known.
  const [step, setStep] = useState<Step>(isLoggedIn ? 'form' : 'email');
  const [email, setEmail] = useState('');

  if (step === 'email') {
    return (
      <EmailGate
        onNotMatched={(enteredEmail) => {
          setEmail(enteredEmail);
          setStep('form');
        }}
        onMatched={(enteredEmail) => {
          setEmail(enteredEmail);
          setStep('sent');
        }}
      />
    );
  }

  if (step === 'sent') {
    return (
      <div className="rounded-lg border border-brand-ink/10 bg-white p-8 text-center">
        <h2 className="text-xl font-bold text-brand-pink">Check your email</h2>
        <p className="mx-auto mt-3 max-w-md text-brand-ink/70">
          We found a pre-filled registration for <strong>{email}</strong>. We&apos;ve sent a secure
          link to that address — click it to confirm your details, set a password, and finish
          registering.
        </p>
        <p className="mt-4 text-sm text-brand-ink/50">
          Wrong email or no pre-filled registration expected?{' '}
          <button
            type="button"
            onClick={() => setStep('email')}
            className="font-medium text-brand-pink hover:underline"
          >
            Try a different email
          </button>
        </p>
      </div>
    );
  }

  return (
    <RegistrationForm
      groups={groups}
      isLoggedIn={isLoggedIn}
      parentName={parentName}
      initialEmail={email}
    />
  );
}

function EmailGate({
  onMatched,
  onNotMatched,
}: {
  onMatched: (email: string) => void;
  onNotMatched: (email: string) => void;
}) {
  const [state, action] = useActionState<EmailCheckResult, FormData>(
    async (prev, formData) => {
      const result = await checkRegistrationEmail(prev, formData);
      const email = String(formData.get('email') ?? '').trim();
      if (result.matched) onMatched(email);
      else if (result.matched === false) onNotMatched(email);
      return result;
    },
    {},
  );

  return (
    <div className="rounded-lg border border-brand-ink/10 bg-white p-8">
      <h2 className="text-lg font-semibold text-brand-pink">Let&apos;s find your family</h2>
      <p className="mt-2 text-brand-ink/70">
        Enter your email to get started. Returning families with a pre-filled registration will get
        a secure link to confirm; everyone else continues straight to the form.
      </p>
      <form action={action} className="mt-5 flex flex-wrap items-start gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label="Email" htmlFor="gate-email" required>
            <input id="gate-email" name="email" type="email" required autoFocus className={inputClass} />
          </Field>
        </div>
        <div className="pt-6">
          <SubmitButton pendingText="Checking…">Continue</SubmitButton>
        </div>
      </form>
      <FormError message={state.error} />
    </div>
  );
}
