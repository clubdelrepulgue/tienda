import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Only routes that need auth: the storefront stays middleware-free so
  // public pages skip the Supabase auth round-trips on every navigation.
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
