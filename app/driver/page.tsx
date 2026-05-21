"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { LogIn, Loader2, Bike } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { driverLogin } from "@/app/actions"
import { toast } from "sonner"

export default function DriverLoginPage() {
    const [phone, setPhone] = useState("")
    const [loading, setLoading] = useState(false)
    const [isClient, setIsClient] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Detectar si es iOS
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

    useEffect(() => {
        setIsClient(true)
        
        // Verificar si ya está logueado
        try {
            const savedId = localStorage.getItem("driverId") || sessionStorage.getItem("driverId")
            if (savedId) {
                router.push("/driver/dashboard")
            }
        } catch {
            // Storage no disponible
        }
    }, [router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!phone.trim()) {
            toast.error("Ingresa tu número de teléfono")
            return
        }
        
        setLoading(true)

        try {
            const result = await driverLogin(phone)

            if (result.error || !result.driver) {
                toast.error(result.error || "Número no registrado o inactivo")
                setLoading(false)
                return
            }

            const driver = result.driver

            // Guardar en storage con manejo de errores
            let useSessionStorage = false
            try {
                localStorage.setItem("driverId", driver.id)
                localStorage.setItem("driverName", driver.name)
            } catch {
                // Fallback a sessionStorage
                try {
                    sessionStorage.setItem("driverId", driver.id)
                    sessionStorage.setItem("driverName", driver.name)
                    useSessionStorage = true
                } catch {
                    toast.error("No se puede guardar la sesión. Evita usar modo privado.")
                    setLoading(false)
                    return
                }
            }
            
            toast.success(`Bienvenido, ${driver.name}!`)
            
            // Delay para asegurar guardado
            setTimeout(() => {
                router.push("/driver/dashboard")
            }, 200)
        } catch (err) {
            console.error("Login error:", err)
            toast.error("Error al iniciar sesión")
        } finally {
            setLoading(false)
        }
    }

    // Prevenir zoom en iOS al enfocar input
    const handleFocus = () => {
        if (isIOS && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 300)
        }
    }

    if (!isClient) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-sm rounded-2xl">
                    <CardContent className="p-8">
                        <div className="animate-pulse flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10" />
                            <div className="h-6 w-32 bg-muted rounded" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 safe-area-inset-bottom">
            <Card className="w-full max-w-sm rounded-2xl bg-card border-border shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bike className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle
                        className="text-xl text-card-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Repartidor
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Ingresa tu número de teléfono
                    </p>
                </CardHeader>
                <CardContent>
                    <form 
                        onSubmit={handleLogin} 
                        className="flex flex-col gap-4"
                        autoComplete="off"
                        noValidate
                    >
                        <div>
                            <Label 
                                htmlFor="phone" 
                                className="text-sm text-muted-foreground mb-1.5 block"
                            >
                                Teléfono
                            </Label>
                            <Input
                                ref={inputRef}
                                id="phone"
                                name="phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="11 5555-0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                onFocus={handleFocus}
                                required
                                autoFocus
                                disabled={loading}
                                className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground text-lg h-12 touch-manipulation"
                                style={{ fontSize: '16px' }} // Previene zoom en iOS
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                Ingresa el número exactamente como lo registró el administrador
                            </p>
                        </div>
                        
                        <Button
                            type="submit"
                            disabled={loading || !phone.trim()}
                            className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold mt-2 active:scale-95 transition-transform"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Ingresando...
                                </>
                            ) : (
                                <>
                                    <LogIn className="h-4 w-4 mr-2" />
                                    Ingresar
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Debug info - solo visible si hay problemas */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-4 p-2 bg-muted rounded text-xs text-muted-foreground font-mono">
                            <div>User Agent: {navigator.userAgent.slice(0, 50)}...</div>
                            <div>localStorage: {typeof localStorage !== 'undefined' ? 'OK' : 'No'}</div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
