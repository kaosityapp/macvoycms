'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sendPlainEmail } from '@/lib/integrations/adminAlert';
import type { AudienceType, Json } from '@/lib/types/database';
import { sanitizeHtml } from '@/lib/sanitize';

export interface ActionState {
  error?: string;
  success?: string;
}

/** Edit an existing announcement's subject/body (the verbatim source of truth). */
export async function updateAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!id) return { error: 'Missing announcement.' };
  if (!subject) return { error: 'Subject is required.' };
  if (!body) return { error: 'Message is required.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('announcements')
    .update({ subject, body: sanitizeHtml(body) })
    .eq('id', id);
  if (error) return { error: 'Could not save the announcement.' };

  revalidatePath('/admin/announcements');
  revalidatePath(`/admin/announcements/${id}`);
  return { success: 'Saved.' };
}

/** Permanently delete an announcement (removes it from parents' portals too). */
export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('announcements').delete().eq('id', id);
  revalidatePath('/admin/announcements');
  redirect('/admin/announcements');
}

const baseSchema = z.object({
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Message body is required.'),
});

export async function sendAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = baseSchema.safeParse({
    subject: String(formData.get('subject') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const audienceType = String(formData.get('audience_type') ?? '') as AudienceType;
  let audienceRef: Record<string, unknown> = {};

  if (audienceType === 'all') {
    audienceRef = {};
  } else if (audienceType === 'location') {
    const locationId = String(formData.get('location_id') ?? '');
    if (!locationId) return { error: 'Choose a location.' };
    audienceRef = { location_id: locationId };
  } else if (audienceType === 'class') {
    const classIds = formData.getAll('class_ids').map(String).filter(Boolean);
    if (classIds.length === 0) return { error: 'Select at least one class.' };
    audienceRef = { class_ids: classIds };
  } else if (audienceType === 'individual') {
    const memberIds = formData.getAll('family_member_ids').map(String).filter(Boolean);
    if (memberIds.length === 0) return { error: 'Select at least one dancer.' };
    audienceRef = { family_member_ids: memberIds };
  } else {
    return { error: 'Choose an audience.' };
  }

  const supabase = await createClient();

  // Save the announcement FIRST — it is the source of truth (spec §3.4).
  const { data: announcement, error } = await supabase
    .from('announcements')
    .insert({
      subject: parsed.data.subject,
      body: sanitizeHtml(parsed.data.body),
      sender: 'debbie@macvoyirishdance.com',
      audience_type: audienceType,
      audience_ref: audienceRef as Json,
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !announcement) return { error: 'Could not save the announcement.' };

  // Email every relevant family directly (Resend) — the in-app archive above
  // is already the source of truth regardless of whether these sends
  // succeed. Sent one-by-one (not one email with everyone in "To") so
  // families never see each other's addresses.
  try {
    const recipients = await resolveRecipientEmails(supabase, audienceType, audienceRef);
    let sent = 0;
    for (const email of recipients) {
      try {
        await sendPlainEmail(email, parsed.data.subject, [parsed.data.body]);
        sent += 1;
      } catch {
        // Continue sending to the rest — one bad address shouldn't block the batch.
      }
    }
    if (recipients.length > 0) {
      await supabase
        .from('announcements')
        .update({ loops_message_id: `direct:${sent}/${recipients.length}` })
        .eq('id', announcement.id);
    }
  } catch {
    // Non-fatal: the in-app announcement is already saved.
  }

  redirect('/admin/announcements');
}

/** Resolve family emails for an audience (used only when Loops is connected). */
async function resolveRecipientEmails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  audienceType: AudienceType,
  audienceRef: Record<string, unknown>,
): Promise<string[]> {
  if (audienceType === 'all') {
    const { data } = await supabase.from('family_accounts').select('parent1_email');
    return (data ?? []).map((r: any) => r.parent1_email).filter(Boolean);
  }

  // For targeted sends, find family accounts via matching active enrollments
  // or explicit members, then read their emails.
  let accountIds: string[] = [];

  if (audienceType === 'individual') {
    const memberIds = (audienceRef.family_member_ids as string[]) ?? [];
    const { data } = await supabase
      .from('family_members')
      .select('family_account_id')
      .in('id', memberIds);
    accountIds = (data ?? []).map((r: any) => r.family_account_id);
  } else {
    // location or class → resolve to class ids, then to enrolled members' accounts
    let classIds: string[] = [];
    if (audienceType === 'class') {
      classIds = (audienceRef.class_ids as string[]) ?? [];
    } else {
      const { data } = await supabase
        .from('classes')
        .select('id')
        .eq('location_id', String(audienceRef.location_id ?? ''));
      classIds = (data ?? []).map((r: any) => r.id);
    }
    if (classIds.length > 0) {
      const { data } = await supabase
        .from('enrollments')
        .select('family_members(family_account_id)')
        .in('class_id', classIds)
        .eq('status', 'active');
      accountIds = (data ?? [])
        .map((r: any) => r.family_members?.family_account_id)
        .filter(Boolean);
    }
  }

  const uniqueIds = [...new Set(accountIds)];
  if (uniqueIds.length === 0) return [];
  const { data } = await supabase
    .from('family_accounts')
    .select('parent1_email')
    .in('id', uniqueIds);
  return [...new Set((data ?? []).map((r: any) => r.parent1_email).filter(Boolean))];
}
