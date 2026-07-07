"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export function signInWithGoogle(nextPath: string) {
    const supabase = createClient()
    return supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
    })
}

// Header account entry: avatar linking to /cuenta when logged in,
// otherwise a "log in with Google" shortcut. Never blocks guest checkout.
export function LoginButton() {
    const supabase = useMemo(() => createClient(), [])
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        supabase.auth.getUser().then(({ data }) => setUser(data.user))

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    if (!mounted) {
        return <span className="h-9 w-9" aria-hidden="true" />
    }

    if (user) {
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture

        return (
            <Link
                href="/cuenta"
                aria-label="Mi cuenta"
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={avatarUrl}
                        alt="Mi cuenta"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                )}
            </Link>
        )
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 rounded-xl p-0 sm:w-auto sm:gap-2 sm:px-3"
            onClick={() => signInWithGoogle(pathname || "/")}
            aria-label="Iniciar sesión"
        >
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Ingresar</span>
        </Button>
    )
}
