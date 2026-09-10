'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recalcMembersOfClass } from '@/lib/admin/billing';
import { todayIso } from '@/lib/billing/dueDates';
import { sendPlainEmail } from '@/lib/integrations/adminAlert';
import { formatDateLong, formatTime } from '@/lib/format';

export interface ActionState {
  error?: string;
  success?: string;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function updateClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const classId = String(formData.get('class_id') ?? '');
  const seasonId = String(formData.get('season_id') ?? '');
  if (!classId) return { error: 'Missing class.' };

  const record = {
    location_id: String(formData.get('location_id') ?? ''),
    day_of_week: String(formData.get('day_of_week') ?? ''),
    start_time: String(formData.get('start_time') ?? ''),
    end_time: String(formData.get('end_time') ?? ''),
    name: String(formData.get('name') ?? '').trim(),
    level: String(formData.get('level') ?? '') || 'beginner',
    shoe_type: String(formData.get('shoe_type') ?? '') || 'soft',
    age_min: num(formData.get('age_min')),
    age_max: num(formData.get('age_max')),
    is_private: String(formData.get('is_private') ?? '') === 'on',
    start_date: String(formData.get('start_date') ?? '') || null,
    end_date: String(formData.get('end_date') ?? '') || null,
    hourly_rate: num(formData.get('hourly_rate')),
    total_sessions: num(formData.get('total_sessions')),
  };
  if (record.end_time <= record.start_time) {
    return { error: 'End time must be after start time.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('classes').update(record).eq('id', classId);
  if (error) return { error: 'Could not update the class.' };

  // Keep this class's future sessions in sync with the template time.
  await supabase
    .from('class_sessions')
    .update({ start_time: record.start_time, end_time: record.end_time })
    .eq('class_id', classId)
    .gte('session_date', todayIso());

  // Tuition depends on hourly_rate / duration / total_sessions, so refresh the
  // plans of everyone actively enrolled in this class.
  await recalcMembersOfClass(supabase, classId);

  revalidatePath(`/admin/classes/${classId}`);
  if (seasonId) revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: 'Class updated. Enrolled dancers’ tuition has been recalculated.' };
}

/** Email every family with an active enrollment in this class. */
async function notifyEnrolledFamilies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  subject: string,
  bodyLines: string[],
): Promise<void> {
  const { data } = await supabase
    .from('enrollments')
    .select('family_members(family:family_accounts(parent1_email))')
    .eq('class_id', classId)
    .eq('status', 'active');

  const emails = [
    ...new Set(
      ((data ?? []) as any[]).map((r) => r.family_members?.family?.parent1_email).filter(Boolean),
    ),
  ] as string[];

  for (const email of emails) {
    try {
      await sendPlainEmail(email, subject, bodyLines);
    } catch {
      // Continue notifying the rest — one bad address shouldn't block the batch.
    }
  }
}

export async function updateSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sessionId = String(formData.get('session_id') ?? '');
  const classId = String(formData.get('class_id') ?? '');
  const status = String(formData.get('status') ?? 'scheduled');
  const note = String(formData.get('note') ?? '').trim() || null;
  const newDate = String(formData.get('new_date') ?? '').trim();
  if (!sessionId) return { error: 'Missing session.' };

  const update: { status: string; note: string | null; session_date?: string } = { status, note };
  // Rescheduling moves the class to a new date.
  if (status === 'rescheduled') {
    if (!newDate) return { error: 'Pick a new date to reschedule to.' };
    update.session_date = newDate;
  }

  const supabase = await createClient();

  // Fetch the current state first so we can tell what actually changed
  // (and have the original date/time/class name on hand for the email).
  const { data: before } = await supabase
    .from('class_sessions')
    .select('status, session_date, start_time, class:classes(name, location:locations(name))')
    .eq('id', sessionId)
    .maybeSingle();

  const { error } = await supabase.from('class_sessions').update(update).eq('id', sessionId);
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { error: 'That date already has a class for this session.' };
    }
    return { error: 'Could not update the session.' };
  }

  if (before && classId) {
    const className = (before as any).class?.name ?? 'Class';
    const locationName = (before as any).class?.location?.name ?? '';
    const oldWhen = `${formatDateLong(before.session_date)} at ${formatTime(before.start_time)}`;

    if (before.status !== 'cancelled' && status === 'cancelled') {
      await notifyEnrolledFamilies(supabase, classId, `Class cancelled — ${className}`, [
        `${className}${locationName ? ` (${locationName})` : ''} on ${oldWhen} has been cancelled.`,
        ...(note ? [`Note: ${note}`] : []),
      ]);
    } else if (before.status === 'cancelled' && status !== 'cancelled') {
      const newWhen = update.session_date ? `${formatDateLong(update.session_date)} at ${formatTime(before.start_time)}` : oldWhen;
      await notifyEnrolledFamilies(supabase, classId, `Class back on — ${className}`, [
        `Good news — ${className}${locationName ? ` (${locationName})` : ''} on ${newWhen} is back on after all.`,
        ...(note ? [`Note: ${note}`] : []),
      ]);
    } else if (status === 'rescheduled' && update.session_date && update.session_date !== before.session_date) {
      await notifyEnrolledFamilies(supabase, classId, `Class moved — ${className}`, [
        `${className}${locationName ? ` (${locationName})` : ''} has moved from ${oldWhen} to ${formatDateLong(update.session_date)} at ${formatTime(before.start_time)}.`,
        ...(note ? [`Note: ${note}`] : []),
      ]);
    }
  }

  if (classId) revalidatePath(`/admin/classes/${classId}`);
  return { success: 'Saved.' };
}
