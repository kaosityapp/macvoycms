'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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

/** 'HH:MM' + minutes → 'HH:MM' (same day). */
function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export async function createClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const seasonId = String(formData.get('season_id') ?? '');
  if (!seasonId) return { error: 'Missing season.' };

  const name = String(formData.get('name') ?? '').trim();
  const locationId = String(formData.get('location_id') ?? '');
  const dayOfWeek = String(formData.get('day_of_week') ?? '');
  const startTime = String(formData.get('start_time') ?? '');
  const durationMin = num(formData.get('duration_minutes'));
  const startDate = String(formData.get('start_date') ?? '');
  const endDate = String(formData.get('end_date') ?? '');
  const hourlyRate = num(formData.get('hourly_rate'));
  const sessionDates = formData.getAll('session_dates').map(String).filter(Boolean);
  const totalSessions = num(formData.get('total_sessions')) ?? sessionDates.length;

  if (!name || !locationId || !startTime || !durationMin || durationMin <= 0) {
    return { error: 'Name, location, start time, and duration are required.' };
  }
  if (!startDate || !endDate) return { error: 'Start and end dates are required.' };

  const endTime = addMinutesToTime(startTime, durationMin);

  const supabase = await createClient();
  const { data: cls, error } = await supabase
    .from('classes')
    .insert({
      season_id: seasonId,
      location_id: locationId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      name,
      level: String(formData.get('level') ?? '') || 'beginner',
      shoe_type: String(formData.get('shoe_type') ?? '') || 'soft',
      age_min: num(formData.get('age_min')),
      age_max: num(formData.get('age_max')),
      is_private: String(formData.get('is_private') ?? '') === 'on',
      start_date: startDate,
      end_date: endDate,
      hourly_rate: hourlyRate,
      total_sessions: totalSessions,
    })
    .select('id')
    .single();
  if (error || !cls) return { error: 'Could not create the class.' };

  // Create exactly the selected calendar dates as sessions.
  if (sessionDates.length > 0) {
    const rows = sessionDates.map((d) => ({
      class_id: cls.id,
      session_date: d,
      start_time: startTime,
      end_time: endTime,
      location_id: locationId,
      status: 'scheduled',
    }));
    const { error: sessErr } = await supabase.from('class_sessions').insert(rows);
    if (sessErr) return { error: 'Class created, but adding the dates failed.' };
  }

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: `Class “${name}” added with ${sessionDates.length} classes.` };
}
