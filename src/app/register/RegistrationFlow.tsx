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
  verifiedEmail,
  formToken,
}: {
  groups: Group[];
  isLoggedIn: boolean;
  parentName: string | null;
  /** Set once they've clicked the verification link but have no account yet. */
  verifiedEmail: string | null;
  /** Signed at page render; proves the form came from us. See lib/formGuard.ts. */
  formToken: string;
}) {
  // Adding a dancer to an already-logged-in account skips the email gate —
  // that's not a "which family is this" question, it's already known.
  const [step, setStep] = useState<Step>(isLoggedIn || verifiedEmail ? 'form' : 'email');
  const [email, setEmail] = useState(verifiedEmail ?? '');
  const [preFilled, setPreFilled] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);

  if (step === 'email') {
    return (
      <EmailGate
        onSent={(sentTo, wasPreFilled, isExisting) => {
          setEmail(sentTo);
          setPreFilled(wasPreFilled);
          setExistingAccount(isExisting);
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
          {existingAccount ? (
            <>
              You already have an account with <strong>{email}</strong>, so we&apos;ve sent a link
              there. Click it to sign in, then you can add another dancer.
            </>
          ) : preFilled ? (
            <>
              We found a pre-filled registration for <strong>{email}</strong>. We&apos;ve sent a
              secure link to that address — click it to confirm your details, set a password, and
              finish registering.
            </>
          ) : (
            <>
              We&apos;ve sent a link to <strong>{email}</strong>. Click it to verify your address
              and continue registering. We ask for this so we know we can reach you about classes
              and payments.
            </>
          )}
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-brand-ink/60">
          It can take a minute to arrive. Check your junk or spam folder if you don&apos;t see it.
        </p>
        <p className="mt-4 text-sm text-brand-ink/60">
          Wrong email?{' '}
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
      emailIsVerified={Boolean(verifiedEmail)}
      formToken={formToken}
    />
  );
}

function EmailGate({
  onSent,
}: {
  onSent: (sentTo: string, wasPreFilled: boolean, isExisting: boolean) => void;
}) {
  const [state, action] = useActionState<EmailCheckResult, FormData>(
    async (prev, formData) => {
      const result = await checkRegistrationEmail(prev, formData);
      const email = String(formData.get('email') ?? '').trim();
      // Report the address the link actually went to, which for a Gmail
      // dot/plus variant is the one already on file, not what they typed.
      if (result.sent) {
        onSent(result.sentTo ?? email, Boolean(result.matched), Boolean(result.existingAccount));
      }
      return result;
    },
    {},
  );

  return (
    <div className="rounded-lg border border-brand-ink/10 bg-white p-8">
      <h2 className="text-lg font-semibold text-brand-pink">Let&apos;s find your family</h2>
      <p className="mt-2 text-brand-ink/70">
        Enter your email to get started. We&apos;ll send you a link to confirm it&apos;s yours,
        then you can register your dancer. This is how we make sure we can reach you about classes
        and payments.
      </p>
      <form action={action} className="mt-5 flex flex-wrap items-start gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label="Email" htmlFor="gate-email" required>
            <input id="gate-email" name="email" type="email" required autoFocus className={inputClass} />
          </Field>
        </div>
        <div className="pt-6">
          <SubmitButton pendingText="Sending…">Send my link</SubmitButton>
        </div>
      </form>
      <FormError message={state.error} />
    </div>
  );
}
