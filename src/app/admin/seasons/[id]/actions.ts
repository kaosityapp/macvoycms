'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recalcDefaultPlanForMember } from '@/lib/admin/billing';

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
  const isPrivate = String(formData.get('is_private') ?? '') === 'on';
  const familyMemberId = String(formData.get('family_member_id') ?? '');

  if (!name || !locationId || !startTime || !durationMin || durationMin <= 0) {
    return { error: 'Name, location, start time, and duration are required.' };
  }
  if (!startDate || !endDate) return { error: 'Start and end dates are required.' };
  if (isPrivate && !familyMemberId) {
    return { error: 'Select the dancer this private lesson is for.' };
  }

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
      is_private: isPrivate,
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

  // Private lesson → enroll only the chosen dancer, so it appears on their
  // calendar (and nowhere else) and feeds their tuition.
  if (isPrivate && familyMemberId) {
    await supabase.from('enrollments').insert({ family_member_id: familyMemberId, class_id: cls.id });
    await recalcDefaultPlanForMember(supabase, familyMemberId);
  }

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: `Class “${name}” added with ${sessionDates.length} classes.` };
}

// ---------------------------------------------------------------------------
// CSV bulk import
// ---------------------------------------------------------------------------

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LEVELS = new Set(['beginner', 'advanced', 'competitive', 'adult', 'ceili']);
const SHOES = new Set(['soft', 'hard', 'soft-hard', 'n/a']);

/** Minimal CSV parser (handles quoted fields and embedded commas/quotes). */
function parseCsv(text: string): string[][] {
  const s = text.replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

function datesForRange(startIso: string, endIso: string, dow: number): string[] {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const out: string[] = [];
  for (let t = start, i = 0; t <= end && i < 500; t += 86_400_000, i++) {
    const d = new Date(t);
    if (d.getUTCDay() === dow) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function importClasses(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const seasonId = String(formData.get('season_id') ?? '');
  if (!seasonId) return { error: 'Missing season.' };

  const file = formData.get('file');
  let csv = '';
  if (file && typeof (file as { text?: unknown }).text === 'function') {
    csv = await (file as File).text();
  }
  if (!csv.trim()) return { error: 'Choose a CSV file to import.' };

  const rows = parseCsv(csv);
  if (rows.length < 2) return { error: 'CSV needs a header row and at least one class row.' };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const required = ['name', 'location', 'day_of_week', 'start_date', 'end_date', 'start_time', 'duration_minutes', 'hourly_rate'];
  const missing = required.filter((r) => col(r) === -1);
  if (missing.length) return { error: `CSV is missing columns: ${missing.join(', ')}.` };

  const supabase = await createClient();
  const { data: locs } = await supabase.from('locations').select('id, name');
  const locMap = new Map((locs ?? []).map((l) => [l.name.trim().toLowerCase(), l.id]));

  const get = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? '').trim() : '');
  let created = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = get(r, 'name');
    const locId = locMap.get(get(r, 'location').toLowerCase());
    const dow = DAY_INDEX[get(r, 'day_of_week').toLowerCase()];
    const startDate = get(r, 'start_date');
    const endDate = get(r, 'end_date');
    const startTime = get(r, 'start_time');
    const duration = Number(get(r, 'duration_minutes'));
    const hourly = Number(get(r, 'hourly_rate'));

    if (!name) { errors.push(`Row ${i + 1}: missing name`); continue; }
    if (!locId) { errors.push(`Row ${i + 1}: unknown location “${get(r, 'location')}”`); continue; }
    if (dow == null) { errors.push(`Row ${i + 1}: invalid day_of_week`); continue; }
    if (!startDate || !endDate || !startTime || !Number.isFinite(duration) || duration <= 0) {
      errors.push(`Row ${i + 1}: bad dates/time/duration`);
      continue;
    }

    const endTime = addMinutesToTime(startTime, duration);
    const dates = datesForRange(startDate, endDate, dow);
    const level = LEVELS.has(get(r, 'level').toLowerCase()) ? get(r, 'level').toLowerCase() : 'beginner';
    const shoe = SHOES.has(get(r, 'shoe_type').toLowerCase()) ? get(r, 'shoe_type').toLowerCase() : 'soft';
    const ageMin = get(r, 'age_min') ? Number(get(r, 'age_min')) : null;
    const ageMax = get(r, 'age_max') ? Number(get(r, 'age_max')) : null;

    const { data: cls, error } = await supabase
      .from('classes')
      .insert({
        season_id: seasonId,
        location_id: locId,
        day_of_week: DAY_NAME[dow],
        start_time: startTime,
        end_time: endTime,
        name,
        level,
        shoe_type: shoe,
        age_min: ageMin,
        age_max: ageMax,
        is_private: false,
        start_date: startDate,
        end_date: endDate,
        hourly_rate: Number.isFinite(hourly) ? hourly : null,
        total_sessions: dates.length,
      })
      .select('id')
      .single();
    if (error || !cls) { errors.push(`Row ${i + 1}: could not create “${name}”`); continue; }

    if (dates.length) {
      await supabase.from('class_sessions').insert(
        dates.map((d) => ({
          class_id: cls.id,
          session_date: d,
          start_time: startTime,
          end_time: endTime,
          location_id: locId,
          status: 'scheduled',
        })),
      );
    }
    created += 1;
  }

  revalidatePath(`/admin/seasons/${seasonId}`);
  if (created === 0) return { error: errors[0] ?? 'No classes imported.' };
  return {
    success: `Imported ${created} class${created === 1 ? '' : 'es'}.${
      errors.length ? ` Skipped ${errors.length}: ${errors.slice(0, 3).join('; ')}` : ''
    }`,
  };
}
