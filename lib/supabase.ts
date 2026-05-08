import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequiredServerEnv } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(getRequiredServerEnv("SUPABASE_URL"), getRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
  }

  return serviceClient;
}
