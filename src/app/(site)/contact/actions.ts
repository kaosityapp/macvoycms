'use server';

import { z } from 'zod';
import { sendPlainEmail } from '@/lib/integrations/adminAlert';

export interface ContactState {
  error?: string;
  success?: string;
}

const contactSchema = z.object({
  name: z.string().min(1, 'Please enter your name.'),
  email: z.string().email('Enter a valid email address.'),
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
    message: String(formData.get('message') ?? '').trim(),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const { name, email, message } = parsed.data;

  await sendPlainEmail(
    CONTACT_TO,
    `Website contact form — ${name}`,
    [`From: ${name} (${email})`, `Message:`, message.replace(/\n/g, '<br/>')],
    { replyTo: email },
  );

  return { success: 'Thanks — your message has been sent.' };
}
