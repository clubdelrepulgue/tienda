import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// OAuth landing: Google redirects to Supabase, Supabase redirects here with a
// one-time code. Exchange it for a session (cookies) and send the user back.
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const nextParam = searchParams.get("next") || "/cuenta"
    // Only allow relative redirects — never an absolute URL from the query string
    const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/cuenta"

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    return NextResponse.redirect(`${origin}/cuenta?auth_error=1`)
}
