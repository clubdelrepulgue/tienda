import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

// Cookie-less anon client for public catalog reads (branches, menu, zones).
// Not using cookies() keeps pages that read the catalog statically cacheable (ISR).
let client: SupabaseClient | null = null

export function createPublicClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  const safeUrl = url.startsWith("http") ? url : "https://placeholder.supabase.co"
  const safeKey = key || "placeholder-key"

  client = createSupabaseClient(safeUrl, safeKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return client
}
