'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types/database';

export interface ActionState {
  error?: string;
  success?: string;
}

function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

/**
 * Admin edit of a still-pending (spreadsheet-imported) registration. Unlike
 * the parent-facing confirm screen, admin can edit everything — including
 * classes and the payment plan — since this IS the "contact the school" path.
 * Saves back into pending_registrations, so the family's next visit to
 * /register/continue immediately reflects the change.
 */
export async function updatePendingRegistration(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const pendingId = s(formData, 'pending_id');
  const dancerCount = Number(s(formData, 'dancerCount')) || 0;
  if (!pendingId || dancerCount === 0) return { error: 'Missing registration.' };

  const parent1Name = s(formData, 'parent1_name');
  if (!parent1Name) return { error: 'Parent 1 name is required.' };

  const dancers = [];
  for (let i = 0; i < dancerCount; i++) {
    const firstName = s(formData, `firstName_${i}`);
    const lastName = s(formData, `lastName_${i}`);
    if (!firstName || !lastName) return { error: `Dancer ${i + 1}: first and last name are required.` };

    const classIds = formData.getAll(`classIds_${i}`).map(String).filter(Boolean);

    const instDates = formData.getAll(`instDate_${i}`).map(String);
    const instAmounts = formData.getAll(`instAmount_${i}`).map(String);
    const installment_schedule: { date: string; amount: number }[] = [];
    for (let j = 0; j < instDates.length; j++) {
      const date = instDates[j]?.trim();
      const amount = Number(instAmounts[j]);
      if (date && Number.isFinite(amount) && amount > 0) installment_schedule.push({ date, amount });
    }
    const total_amount = installment_schedule.reduce((sum, item) => sum + item.amount, 0);

    dancers.push({
      first_name: firstName,
      last_name: lastName,
      birthday: s(formData, `birthday_${i}`) || undefined,
      gender: s(formData, `gender_${i}`) || undefined,
      address: s(formData, `address_${i}`) || undefined,
      medical_notes: s(formData, `medicalNotes_${i}`) || undefined,
      emergency_contact_name: s(formData, `emergencyName_${i}`) || undefined,
      emergency_contact_phone: s(formData, `emergencyPhone_${i}`) || undefined,
      emergency_contact_relationship: s(formData, `emergencyRelationship_${i}`) || undefined,
      class_ids: classIds,
      plan_type: s(formData, `planType_${i}`) || 'custom',
      total_amount,
      installment_schedule,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('pending_registrations')
    .update({
      parent1_name: parent1Name,
      parent1_phone: s(formData, 'parent1_phone') || null,
      parent2_name: s(formData, 'parent2_name') || null,
      parent2_phone: s(formData, 'parent2_phone') || null,
      parent2_email: s(formData, 'parent2_email') || null,
      dancers: dancers as unknown as Json,
    })
    .eq('id', pendingId);
  if (error) return { error: 'Could not save this registration.' };

  revalidatePath('/admin/families');
  revalidatePath(`/admin/pending/${pendingId}`);
  return { success: 'Saved.' };
}

/** Delete a pending registration entirely (e.g. entered by mistake). */
export async function deletePendingRegistration(formData: FormData): Promise<void> {
  const pendingId = s(formData, 'pending_id');
  if (!pendingId) return;
  const supabase = await createClient();
  await supabase.from('pending_registrations').delete().eq('id', pendingId);
  revalidatePath('/admin/families');
  redirect('/admin/families');
}
