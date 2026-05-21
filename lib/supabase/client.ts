import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  // Provide a safe fallback so the client doesn't crash visually before providing real keys
  const safeUrl = url.startsWith("http") ? url : "https://placeholder.supabase.co"
  const safeKey = key || "placeholder-key"

  return createBrowserClient(safeUrl, safeKey)
}
