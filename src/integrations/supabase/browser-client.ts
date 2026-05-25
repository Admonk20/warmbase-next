import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let browserClientPromise: Promise<SupabaseClient<Database>> | undefined;

export async function getBrowserSupabase() {
  if (!browserClientPromise) {
    browserClientPromise = import("./client").then((module) => module.supabase);
  }

  return browserClientPromise;
}