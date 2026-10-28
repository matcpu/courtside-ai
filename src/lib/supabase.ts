import { createClient } from "@supabase/supabase-js";
let browserClient: ReturnType<typeof createClient> | undefined;
export function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured");
  if (typeof window === "undefined") return createClient(url, key);
  return (browserClient ??= createClient(url, key));
}
