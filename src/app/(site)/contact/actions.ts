'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPlainEmail } from '@/lib/integrations/adminAlert';

export interface ContactState {
  error?: string;
  success?: string;
}

const contactSchema = z.object({
  name: z.string().min(1, 'Please enter your name.'),
  email: z.string().email('Enter a valid email address.'),
  location: z.enum(['Mississauga', 'Pickering'], { errorMap: () => ({ message: 'Please select a location.' }) }),
  message: z.string().min(1, 'Please enter a message.'),
});

const CONTACT_TO = 'macvoyirishdance@rogers.com';

export async function sendContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot — real visitors never fill this hidden field in.
  if (String(formData.get('company') ?? '').trim()) {
    return { success: 'Thanks — your message has been sent.' };
  }

  const parsed = contactSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    location: String(formData.get('location') ?? '').trim(),
    message: String(formData.get('message') ?? '').trim(),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { name, email, location, message } = parsed.data;

  // No logged-in user on this public form, so this goes through the admin
  // client (same pattern as pre-account registration writes) — saved first
  // so the message survives even if the email below fails to send.
  const admin = createAdminClient();
  await admin.from('contact_messages').insert({ name, email, location, message });

  await sendPlainEmail(
    CONTACT_TO,
    `Website contact form — ${name} (${location})`,
    [`From: ${name} (${email})`, `Location: ${location}`, `Message:`, message.replace(/\n/g, '<br/>')],
    { replyTo: email },
  );

  return { success: 'Thanks — your message has been sent.' };
}
