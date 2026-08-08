'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayIso } from '@/lib/billing/dueDates';

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
    level: String(formData.get('level') ?? ''),
    shoe_type: String(formData.get('shoe_type') ?? ''),
    age_min: num(formData.get('age_min')),
    age_max: num(formData.get('age_max')),
    is_private: String(formData.get('is_private') ?? '') === 'on',
  };
  if (record.end_time <= record.start_time) {
    return { error: 'End time must be after start time.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('classes').update(record).eq('id', classId);
  if (error) return { error: 'Could not update the class.' };

  // Optional: apply the template change to future sessions from a chosen date.
  const applyFromRaw = String(formData.get('apply_from') ?? '').trim();
  if (applyFromRaw) {
    const today = todayIso();
    const from = applyFromRaw < today ? today : applyFromRaw; // never touch the past
    // Drop this class's future sessions, then regenerate them from the new template.
    await supabase.from('class_sessions').delete().eq('class_id', classId).gte('session_date', from);
    if (seasonId) {
      const admin = createAdminClient();
      await admin.rpc('generate_class_sessions', { p_season_id: seasonId, p_from: from });
    }
  }

  revalidatePath(`/admin/classes/${classId}`);
  if (seasonId) revalidatePath(`/admin/seasons/${seasonId}`);
  return {
    success: applyFromRaw
      ? 'Class updated and future sessions regenerated.'
      : 'Class template updated (existing sessions unchanged).',
  };
}

export async function updateSession(formData: FormData): Promise<void> {
  const sessionId = String(formData.get('session_id') ?? '');
  const classId = String(formData.get('class_id') ?? '');
  const status = String(formData.get('status') ?? 'scheduled');
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!sessionId) return;

  const supabase = await createClient();
  await supabase.from('class_sessions').update({ status, note }).eq('id', sessionId);

  if (classId) revalidatePath(`/admin/classes/${classId}`);
}
