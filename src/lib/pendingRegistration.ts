import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

export type PendingRegistration =
  Database['public']['Tables']['pending_registrations']['Row'];

/**
 * The un-completed pre-filled registration for an address, if there is one.
 * Matches either parent's email on Debbie's import, since whichever parent
 * confirms becomes the login.
 *
 * `pending_registrations` has no public read policy — this is a service-role
 * lookup, so it must stay server-side.
 */
export async function getPendingRegistration(
  email: string | null | undefined,
): Promise<PendingRegistration | null> {
  const address = email?.trim();
  if (!address) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('pending_registrations')
    .select('*')
    .or(`email.ilike.${address},parent2_email.ilike.${address}`)
    .eq('status', 'pending')
    .maybeSingle();
  return data;
}
