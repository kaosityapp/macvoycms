'use client';

import { useActionState } from 'react';
import { updateAnnouncement, type ActionState } from '../actions';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

export function EditAnnouncementForm({
  id,
  subject,
  body,
}: {
  id: string;
  subject: string;
  body: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateAnnouncement, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <Field label="Subject" htmlFor="subject" required>
        <input id="subject" name="subject" defaultValue={subject} required className={inputClass} />
      </Field>
      <div className="space-y-1">
        <label className="text-sm font-medium text-brand-ink">Message</label>
        <RichTextEditor name="body" defaultValue={body} />
      </div>
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
