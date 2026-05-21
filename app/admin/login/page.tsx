"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogIn, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function AdminLoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const supabase = createClient()

            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (authError) {
                setError(authError.message)
                return
            }

            if (!data.user) {
                setError("Login failed")
                return
            }

            // Check admin access
            const { data: adminUser, error: adminError } = await supabase
                .from("admin_users")
                .select("id")
                .eq("user_id", data.user.id)
                .single()

            if (adminError || !adminUser) {
                await supabase.auth.signOut()
                setError("No tienes acceso al panel de administración")
                return
            }

            toast.success("Welcome back!")
            router.push("/admin")
            router.refresh()
        } catch {
            setError("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-sm rounded-2xl bg-card border-border">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-2">
                        <span
                            className="text-2xl font-bold text-primary"
                            style={{ fontFamily: "var(--font-heading)" }}
                        >
                            BLAZR
                        </span>
                    </div>
                    <CardTitle
                        className="text-xl text-card-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Admin Login
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Sign in to manage your restaurant
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="flex flex-col gap-4">
                        {error && (
                            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}
                        <div>
                            <Label htmlFor="email" className="text-sm text-muted-foreground mb-1.5 block">
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div>
                            <Label htmlFor="password" className="text-sm text-muted-foreground mb-1.5 block">
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn className="h-4 w-4 mr-2" />
                                    Sign In
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
