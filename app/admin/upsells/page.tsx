"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Sparkles, Trash2, Edit2, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createUpsellRule, updateUpsellRule, deleteUpsellRule } from "@/app/actions"
import type { UpsellRule, Product } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function UpsellsPage() {
    const { data: rules, mutate } = useSWR<UpsellRule[]>("/api/admin?type=upsells", fetcher)
    const { data: products } = useSWR<Product[]>("/api/admin?type=products", fetcher)
    const [isOpen, setIsOpen] = useState(false)
    const [editing, setEditing] = useState<UpsellRule | null>(null)

    const [name, setName] = useState("")
    const [message, setMessage] = useState("¿Te gustaría agregar esto?")
    const [discountPercentage, setDiscountPercentage] = useState("")
    const [priority, setPriority] = useState("0")
    const [selectedProducts, setSelectedProducts] = useState<string[]>([])

    const resetForm = () => {
        setName("")
        setMessage("¿Te gustaría agregar esto?")
        setDiscountPercentage("")
        setPriority("0")
        setSelectedProducts([])
        setEditing(null)
    }

    const openNew = () => {
        resetForm()
        setIsOpen(true)
    }

    const openEdit = (rule: UpsellRule) => {
        setEditing(rule)
        setName(rule.name)
        setMessage(rule.message)
        setDiscountPercentage(rule.discountPercentage.toString())
        setPriority(rule.priority.toString())
        setSelectedProducts(rule.suggestedProductIds)
        setIsOpen(true)
    }

    const handleSave = async () => {
        const data = {
            name,
            message,
            discountPercentage: parseFloat(discountPercentage) || 0,
            priority: parseInt(priority) || 0,
            suggestedProductIds: selectedProducts,
        }

        const result = editing
            ? await updateUpsellRule(editing.id, { ...data, isActive: editing.isActive })
            : await createUpsellRule(data)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(editing ? "Regla actualizada" : "Regla creada")
            mutate()
            setIsOpen(false)
            resetForm()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta regla?")) return
        const result = await deleteUpsellRule(id)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Regla eliminada")
            mutate()
        }
    }

    const handleToggle = async (rule: UpsellRule) => {
        const result = await updateUpsellRule(rule.id, { isActive: !rule.isActive })
        if (result.error) {
            toast.error(result.error)
        } else {
            mutate()
        }
    }

    const toggleProduct = (id: string) => {
        setSelectedProducts((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        )
    }

    return (
        <div className="flex flex-col gap-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                        Upsells
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Sugerencias inteligentes en el carrito
                    </p>
                </div>
                <Button onClick={openNew} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Regla
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rules?.map((rule) => (
                    <Card key={rule.id} className={cn("rounded-2xl overflow-hidden", !rule.isActive && "opacity-60")}>
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Sparkles className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{rule.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground">Prioridad: {rule.priority}</p>
                                    </div>
                                </div>
                                <Badge variant={rule.isActive ? "default" : "secondary"}>
                                    {rule.isActive ? "Activa" : "Inactiva"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground italic">"{rule.message}"</p>
                            
                            {rule.discountPercentage > 0 && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <Percent className="h-4 w-4 text-green-600" />
                                    <span className="text-green-600 font-medium">{rule.discountPercentage}% de descuento</span>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-1">
                                {rule.suggestedProductIds.slice(0, 3).map((pid) => {
                                    const product = products?.find((p) => p.id === pid)
                                    return product ? (
                                        <Badge key={pid} variant="outline" className="text-xs">
                                            {product.name}
                                        </Badge>
                                    ) : null
                                })}
                                {rule.suggestedProductIds.length > 3 && (
                                    <Badge variant="outline" className="text-xs">+{rule.suggestedProductIds.length - 3}</Badge>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => openEdit(rule)}>
                                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                                    Editar
                                </Button>
                                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => handleToggle(rule)}>
                                    {rule.isActive ? "Desactivar" : "Activar"}
                                </Button>
                                <Button variant="outline" size="sm" className="rounded-lg text-destructive" onClick={() => handleDelete(rule.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Regla" : "Nueva Regla"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label>Nombre</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Agrega una bebida" className="rounded-xl mt-1.5" />
                        </div>
                        <div>
                            <Label>Mensaje</Label>
                            <Input value={message} onChange={(e) => setMessage(e.target.value)} className="rounded-xl mt-1.5" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Descuento %</Label>
                                <Input type="number" value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} placeholder="0" className="rounded-xl mt-1.5" />
                            </div>
                            <div>
                                <Label>Prioridad</Label>
                                <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-xl mt-1.5" />
                            </div>
                        </div>
                        <div>
                            <Label>Productos sugeridos</Label>
                            <div className="mt-1.5 max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1">
                                {products?.filter((p) => p.active).map((product) => (
                                    <label key={product.id} className="flex items-center gap-2 p-1.5 hover:bg-secondary rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedProducts.includes(product.id)}
                                            onChange={() => toggleProduct(product.id)}
                                            className="rounded"
                                        />
                                        <span className="text-sm">{product.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsOpen(false)}>Cancelar</Button>
                            <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={!name || selectedProducts.length === 0}>Guardar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
