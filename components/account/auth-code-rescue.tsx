"use client"

import { useEffect } from "react"

// If Supabase's redirect allow-list rejects our redirectTo, it falls back to
// the Site URL root with ?code=... and the login silently dies. Catch that
// code anywhere it lands and forward it to /auth/callback to finish the login.
export function AuthCodeRescue() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")

        if (!code || window.location.pathname.startsWith("/auth/")) return

        window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/cuenta`)
    }, [])

    return null
}
