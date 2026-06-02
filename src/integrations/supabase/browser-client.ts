import { supabase } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Returns the already-initialized Supabase client for browser usage.
 * Using a static import avoids dynamic-import races and ensures callers
 * can reliably obtain the client without awaiting an additional import.
 */
export async function getBrowserSupabase(): Promise<SupabaseClient<Database>> {
  return supabase;
}
