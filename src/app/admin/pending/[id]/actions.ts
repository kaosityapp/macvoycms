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

  // Payment history (payments_received) isn't part of this form — carry it
  // forward from the current row so a routine edit doesn't wipe it out.
  const supabase = await createClient();
  const { data: current } = await supabase
    .from('pending_registrations')
    .select('dancers')
    .eq('id', pendingId)
    .maybeSingle();
  const existingDancers = (current?.dancers as any[]) ?? [];

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
      payments_received: existingDancers[i]?.payments_received ?? undefined,
      addon: (() => {
        const a = s(formData, `addon_${i}`);
        return a && a !== 'none' ? a : undefined;
      })(),
    });
  }

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

const PAYMENT_METHODS = new Set(['cash', 'e-transfer', 'cheque', 'other']);

/** Log a payment received from a family before their registration is confirmed. */
export async function addPendingPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pendingId = s(formData, 'pending_id');
  const dancerIndex = Number(s(formData, 'dancer_index'));
  if (!pendingId || !Number.isInteger(dancerIndex)) return { error: 'Missing registration.' };

  const amount = Number(s(formData, 'amount'));
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount.' };
  const date = s(formData, 'date');
  if (!date) return { error: 'Enter the date received.' };
  const method = s(formData, 'method');
  if (!PAYMENT_METHODS.has(method)) return { error: 'Choose a payment method.' };
  const note = s(formData, 'note') || undefined;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('pending_registrations')
    .select('dancers')
    .eq('id', pendingId)
    .maybeSingle();
  if (!row) return { error: 'Registration not found.' };

  const dancers = (row.dancers as any[]) ?? [];
  const dancer = dancers[dancerIndex];
  if (!dancer) return { error: 'Dancer not found.' };

  const payments = Array.isArray(dancer.payments_received) ? dancer.payments_received : [];
  payments.push({ date, amount, method, note });
  dancers[dancerIndex] = { ...dancer, payments_received: payments };

  const { error } = await supabase
    .from('pending_registrations')
    .update({ dancers: dancers as unknown as Json })
    .eq('id', pendingId);
  if (error) return { error: 'Could not save the payment.' };

  revalidatePath('/admin/families');
  revalidatePath(`/admin/pending/${pendingId}`);
  return { success: 'Payment recorded.' };
}

/** Remove a mistakenly-logged pending payment. */
export async function removePendingPayment(formData: FormData): Promise<void> {
  const pendingId = s(formData, 'pending_id');
  const dancerIndex = Number(s(formData, 'dancer_index'));
  const paymentIndex = Number(s(formData, 'payment_index'));
  if (!pendingId || !Number.isInteger(dancerIndex) || !Number.isInteger(paymentIndex)) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('pending_registrations')
    .select('dancers')
    .eq('id', pendingId)
    .maybeSingle();
  if (!row) return;

  const dancers = (row.dancers as any[]) ?? [];
  const dancer = dancers[dancerIndex];
  if (!dancer || !Array.isArray(dancer.payments_received)) return;

  dancer.payments_received = dancer.payments_received.filter((_: unknown, i: number) => i !== paymentIndex);
  dancers[dancerIndex] = dancer;

  await supabase.from('pending_registrations').update({ dancers: dancers as unknown as Json }).eq('id', pendingId);
  revalidatePath('/admin/families');
  revalidatePath(`/admin/pending/${pendingId}`);
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
