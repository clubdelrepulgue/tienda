"use client"

import { useState } from "react"
import { Tag, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { validateCoupon } from "@/app/actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface CouponInputProps {
    cartTotal: number
    onCouponApplied: (coupon: { code: string; discount: number; discountType: string; discountValue: number } | null) => void
    appliedCoupon: { code: string; discount: number; discountType: string; discountValue: number } | null
}

export function CouponInput({ cartTotal, onCouponApplied, appliedCoupon }: CouponInputProps) {
    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)

    const handleApply = async () => {
        if (!code.trim()) return
        
        setLoading(true)
        try {
            const result = await validateCoupon(code, cartTotal)
            
            if ("error" in result) {
                toast.error(result.error)
                return
            }
            
            onCouponApplied({
                code: result.code,
                discount: result.discount,
                discountType: result.discountType,
                discountValue: result.discountValue,
            })
            toast.success(`Cupón aplicado: -$${result.discount.toFixed(2)}`)
            setCode("")
        } catch {
            toast.error("Error al validar el cupón")
        } finally {
            setLoading(false)
        }
    }

    const handleRemove = () => {
        onCouponApplied(null)
        toast.info("Cupón removido")
    }

    if (appliedCoupon) {
        return (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                Cupón aplicado
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {appliedCoupon.code} (-${appliedCoupon.discount.toFixed(2)})
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={handleRemove}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">¿Tienes un cupón?</p>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Ingresa tu código"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="pl-9 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground uppercase"
                        onKeyDown={(e) => e.key === "Enter" && handleApply()}
                    />
                </div>
                <Button
                    onClick={handleApply}
                    disabled={loading || !code.trim()}
                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        "Aplicar"
                    )}
                </Button>
            </div>
        </div>
    )
}
