'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface ActionState {
  error?: string;
  success?: string;
}

const seasonSchema = z
  .object({
    name: z.string().min(1, 'Season name is required.'),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string().min(1, 'End date is required.'),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date.',
    path: ['endDate'],
  });

// Default rate-card template applied to a new season (Debbie can edit after).
const DEFAULT_RATES: { duration_minutes: number; price: number }[] = [
  { duration_minutes: 30, price: 12 },
  { duration_minutes: 60, price: 22 },
  { duration_minutes: 75, price: 27 },
  { duration_minutes: 90, price: 32 },
  { duration_minutes: 120, price: 42 },
];

export async function createSeason(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = seasonSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    startDate: String(formData.get('startDate') ?? ''),
    endDate: String(formData.get('endDate') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { data: season, error } = await supabase
    .from('seasons')
    .insert({
      name: parsed.data.name,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
    })
    .select('id')
    .single();
  if (error || !season) return { error: 'Could not create the season.' };

  await supabase
    .from('rate_card')
    .insert(DEFAULT_RATES.map((r) => ({ season_id: season.id, ...r })));

  revalidatePath('/admin/seasons');
  return { success: `Season “${parsed.data.name}” created.` };
}
