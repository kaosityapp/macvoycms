import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Service-role Supabase client. BYPASSES RLS — server-only. Use exclusively in
 * trusted server contexts that must write across families: registration
 * (creating a family_account before the login exists), and Helcim/Loops
 * webhook handlers. Never import this into a client component.
 */
export function createAdminClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
