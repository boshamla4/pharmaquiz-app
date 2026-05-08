const requiredServerEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export function hasSupabaseServerEnv(): boolean {
  return requiredServerEnv.every((key) => Boolean(process.env[key]));
}

export function getRequiredServerEnv(key: (typeof requiredServerEnv)[number]): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
