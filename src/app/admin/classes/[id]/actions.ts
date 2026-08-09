'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recalcMembersOfClass } from '@/lib/admin/billing';

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

  // Tuition depends on hourly_rate / duration / total_sessions, so refresh the
  // plans of everyone actively enrolled in this class.
  await recalcMembersOfClass(supabase, classId);

  revalidatePath(`/admin/classes/${classId}`);
  if (seasonId) revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: 'Class updated. Enrolled dancers’ tuition has been recalculated.' };
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
  const { error } = await supabase.from('class_sessions').update(update).eq('id', sessionId);
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { error: 'That date already has a class for this session.' };
    }
    return { error: 'Could not update the session.' };
  }

  if (classId) revalidatePath(`/admin/classes/${classId}`);
  return { success: 'Saved.' };
}
