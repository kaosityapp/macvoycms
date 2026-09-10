'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function markContactRead(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('contact_messages').update({ read_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin/contact');
}

export async function deleteContactMessage(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('contact_messages').delete().eq('id', id);
  revalidatePath('/admin/contact');
}
