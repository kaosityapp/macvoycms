'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

export async function updateRateCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const seasonId = String(formData.get('season_id') ?? '');
  if (!seasonId) return { error: 'Missing season.' };
  const supabase = await createClient();

  const ids = formData.getAll('existing_id').map(String);
  for (const id of ids) {
    if (String(formData.get(`delete_${id}`) ?? '') === 'on') {
      await supabase.from('rate_card').delete().eq('id', id);
      continue;
    }
    const price = num(formData.get(`price_${id}`));
    if (price !== null) await supabase.from('rate_card').update({ price }).eq('id', id);
  }

  const newDuration = num(formData.get('new_duration'));
  const newPrice = num(formData.get('new_price'));
  if (newDuration !== null && newPrice !== null) {
    const { error } = await supabase
      .from('rate_card')
      .upsert(
        { season_id: seasonId, duration_minutes: newDuration, price: newPrice },
        { onConflict: 'season_id,duration_minutes' },
      );
    if (error) return { error: 'Could not add the new rate.' };
  }

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: 'Rate card saved.' };
}

export async function createClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const seasonId = String(formData.get('season_id') ?? '');
  if (!seasonId) return { error: 'Missing season.' };

  const record = {
    season_id: seasonId,
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

  if (!record.location_id || !record.name || !record.start_time || !record.end_time) {
    return { error: 'Location, name, start and end time are required.' };
  }
  if (record.end_time <= record.start_time) {
    return { error: 'End time must be after start time.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('classes').insert(record);
  if (error) return { error: 'Could not create the class.' };

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: `Class “${record.name}” added. Regenerate sessions to add it to the calendar.` };
}

/**
 * Generate/refresh calendar sessions for the season. Uses the service-role
 * client because the SQL function is restricted from the authenticated role.
 * `from_date` regenerates only occurrences on/after that date (future-only).
 */
export async function regenerateSessions(formData: FormData): Promise<void> {
  const seasonId = String(formData.get('season_id') ?? '');
  const fromDate = String(formData.get('from_date') ?? '').trim() || undefined;
  if (!seasonId) return;

  const admin = createAdminClient();
  await admin.rpc('generate_class_sessions', { p_season_id: seasonId, p_from: fromDate });

  revalidatePath(`/admin/seasons/${seasonId}`);
}
