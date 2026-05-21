"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Tag, Trash2, Edit2, Percent, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createCoupon, updateCoupon, deleteCoupon } from "@/app/actions"
import type { Coupon } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function CouponsPage() {
    const { data: coupons, mutate } = useSWR<Coupon[]>("/api/admin?type=coupons", fetcher)
    const [isOpen, setIsOpen] = useState(false)
    const [editing, setEditing] = useState<Coupon | null>(null)

    // Form state
    const [code, setCode] = useState("")
    const [description, setDescription] = useState("")
    const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage")
    const [discountValue, setDiscountValue] = useState("")
    const [minOrderAmount, setMinOrderAmount] = useState("")
    const [maxDiscount, setMaxDiscount] = useState("")
    const [usageLimit, setUsageLimit] = useState("")
    const [validFrom, setValidFrom] = useState("")
    const [validUntil, setValidUntil] = useState("")

    const resetForm = () => {
        setCode("")
        setDescription("")
        setDiscountType("percentage")
        setDiscountValue("")
        setMinOrderAmount("")
        setMaxDiscount("")
        setUsageLimit("")
        setValidFrom(new Date().toISOString().split("T")[0])
        setValidUntil("")
        setEditing(null)
    }

    const openNew = () => {
        resetForm()
        setIsOpen(true)
    }

    const openEdit = (coupon: Coupon) => {
        setEditing(coupon)
        setCode(coupon.code)
        setDescription(coupon.description || "")
        setDiscountType(coupon.discountType)
        setDiscountValue(coupon.discountValue.toString())
        setMinOrderAmount(coupon.minOrderAmount?.toString() || "")
        setMaxDiscount(coupon.maxDiscountAmount?.toString() || "")
        setUsageLimit(coupon.usageLimit?.toString() || "")
        setValidFrom(coupon.validFrom?.split("T")[0] || "")
        setValidUntil(coupon.validUntil?.split("T")[0] || "")
        setIsOpen(true)
    }

    const handleSave = async () => {
        const data = {
            code,
            description,
            discountType,
            discountValue: parseFloat(discountValue) || 0,
            minOrderAmount: parseFloat(minOrderAmount) || 0,
            maxDiscountAmount: maxDiscount ? parseFloat(maxDiscount) : undefined,
            usageLimit: usageLimit ? parseInt(usageLimit) : undefined,
            validFrom: validFrom ? new Date(validFrom).toISOString() : new Date().toISOString(),
            validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        }

        const result = editing
            ? await updateCoupon(editing.id, { ...data, isActive: editing.isActive })
            : await createCoupon(data)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(editing ? "Cupón actualizado" : "Cupón creado")
            mutate()
            setIsOpen(false)
            resetForm()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este cupón?")) return
        const result = await deleteCoupon(id)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Cupón eliminado")
            mutate()
        }
    }

    const handleToggle = async (coupon: Coupon) => {
        const result = await updateCoupon(coupon.id, { isActive: !coupon.isActive })
        if (result.error) {
            toast.error(result.error)
        } else {
            mutate()
        }
    }

    return (
        <div className="flex flex-col gap-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                        Cupones
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona códigos de descuento
                    </p>
                </div>
                <Button onClick={openNew} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Cupón
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons?.map((coupon) => (
                    <Card key={coupon.id} className={cn(
                        "rounded-2xl overflow-hidden",
                        !coupon.isActive && "opacity-60"
                    )}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        {coupon.discountType === "percentage" ? (
                                            <Percent className="h-5 w-5 text-primary" />
                                        ) : (
                                            <DollarSign className="h-5 w-5 text-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-mono">
                                            {coupon.code}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {coupon.usageCount} usos
                                        </p>
                                    </div>
                                </div>
                                <Badge variant={coupon.isActive ? "default" : "secondary"}>
                                    {coupon.isActive ? "Activo" : "Inactivo"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {coupon.description || "Sin descripción"}
                            </p>
                            
                            <div className="flex items-center gap-4 text-sm">
                                <span className="font-bold text-2xl text-primary">
                                    {coupon.discountType === "percentage"
                                        ? `${coupon.discountValue}%`
                                        : `$${coupon.discountValue.toFixed(2)}`}
                                </span>
                                {coupon.minOrderAmount > 0 && (
                                    <span className="text-muted-foreground">
                                        Mín: ${coupon.minOrderAmount}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 rounded-lg"
                                    onClick={() => openEdit(coupon)}
                                >
                                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                                    Editar
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg"
                                    onClick={() => handleToggle(coupon)}
                                >
                                    {coupon.isActive ? "Desactivar" : "Activar"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(coupon.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? "Editar Cupón" : "Nuevo Cupón"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label>Código</Label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="EJ: VERANO20"
                                className="rounded-xl mt-1.5 uppercase"
                            />
                        </div>

                        <div>
                            <Label>Descripción</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Descuento de verano"
                                className="rounded-xl mt-1.5"
                            />
                        </div>

                        <div>
                            <Label>Tipo de Descuento</Label>
                            <RadioGroup
                                value={discountType}
                                onValueChange={(v) => setDiscountType(v as "percentage" | "fixed_amount")}
                                className="flex gap-4 mt-1.5"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="percentage" id="percentage" />
                                    <Label htmlFor="percentage" className="cursor-pointer">Porcentaje</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="fixed_amount" id="fixed" />
                                    <Label htmlFor="fixed" className="cursor-pointer">Monto Fijo</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Valor</Label>
                                <Input
                                    type="number"
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(e.target.value)}
                                    placeholder={discountType === "percentage" ? "20" : "10.00"}
                                    className="rounded-xl mt-1.5"
                                />
                            </div>
                            <div>
                                <Label>Mínimo de compra</Label>
                                <Input
                                    type="number"
                                    value={minOrderAmount}
                                    onChange={(e) => setMinOrderAmount(e.target.value)}
                                    placeholder="0"
                                    className="rounded-xl mt-1.5"
                                />
                            </div>
                        </div>

                        {discountType === "percentage" && (
                            <div>
                                <Label>Descuento máximo (opcional)</Label>
                                <Input
                                    type="number"
                                    value={maxDiscount}
                                    onChange={(e) => setMaxDiscount(e.target.value)}
                                    placeholder="Sin límite"
                                    className="rounded-xl mt-1.5"
                                />
                            </div>
                        )}

                        <div>
                            <Label>Límite de usos (opcional)</Label>
                            <Input
                                type="number"
                                value={usageLimit}
                                onChange={(e) => setUsageLimit(e.target.value)}
                                placeholder="Ilimitado"
                                className="rounded-xl mt-1.5"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Válido desde</Label>
                                <Input
                                    type="date"
                                    value={validFrom}
                                    onChange={(e) => setValidFrom(e.target.value)}
                                    className="rounded-xl mt-1.5"
                                />
                            </div>
                            <div>
                                <Label>Válido hasta (opcional)</Label>
                                <Input
                                    type="date"
                                    value={validUntil}
                                    onChange={(e) => setValidUntil(e.target.value)}
                                    className="rounded-xl mt-1.5"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={() => setIsOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 rounded-xl"
                                onClick={handleSave}
                                disabled={!code || !discountValue}
                            >
                                {editing ? "Guardar" : "Crear"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
