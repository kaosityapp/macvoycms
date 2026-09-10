'use client';

import { useActionState, useRef, useEffect } from 'react';
import { sendContactMessage, type ContactState } from './actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

export function ContactForm() {
  const [state, action] = useActionState<ContactState, FormData>(sendContactMessage, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      {/* Honeypot — hidden from real visitors via CSS, bots often fill every field. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Name" htmlFor="contact-name" required>
        <input id="contact-name" name="name" required className={inputClass} />
      </Field>
      <Field label="Email" htmlFor="contact-email" required>
        <input id="contact-email" name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Location" htmlFor="contact-location" required>
        <select id="contact-location" name="location" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select a location…
          </option>
          <option value="Mississauga">Mississauga</option>
          <option value="Pickering">Pickering</option>
        </select>
      </Field>
      <Field label="Message" htmlFor="contact-message" required>
        <textarea id="contact-message" name="message" required rows={5} className={inputClass} />
      </Field>
      <SubmitButton pendingText="Sending…">Send message</SubmitButton>
    </form>
  );
}
