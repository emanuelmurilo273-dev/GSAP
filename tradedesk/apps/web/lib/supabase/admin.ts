import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** service_role — SOMENTE no servidor. Ignora RLS. */
export const supabaseAdmin = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
