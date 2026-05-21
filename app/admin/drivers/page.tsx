"use client"

import { useState } from "react"
import useSWR from "swr"
import { Plus, Bike, Trash2, Edit2, Phone, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createDriver, updateDriver, deleteDriver } from "@/app/actions"
import type { Driver } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DriversPage() {
    const { data: drivers, mutate } = useSWR<Driver[]>("/api/admin?type=drivers", fetcher)
    const [isOpen, setIsOpen] = useState(false)
    const [editing, setEditing] = useState<Driver | null>(null)

    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [vehicleType, setVehicleType] = useState<"motorcycle" | "bicycle" | "car">("motorcycle")
    const [vehiclePlate, setVehiclePlate] = useState("")

    const resetForm = () => {
        setName("")
        setPhone("")
        setEmail("")
        setVehicleType("motorcycle")
        setVehiclePlate("")
        setEditing(null)
    }

    const openNew = () => {
        resetForm()
        setIsOpen(true)
    }

    const openEdit = (driver: Driver) => {
        setEditing(driver)
        setName(driver.name)
        setPhone(driver.phone)
        setEmail(driver.email || "")
        setVehicleType(driver.vehicleType || "motorcycle")
        setVehiclePlate(driver.vehiclePlate || "")
        setIsOpen(true)
    }

    const handleSave = async () => {
        const data = { name, phone, email: email || undefined, vehicleType, vehiclePlate: vehiclePlate || undefined }
        const result = editing
            ? await updateDriver(editing.id, { ...data, isActive: editing.isActive })
            : await createDriver(data)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(editing ? "Repartidor actualizado" : "Repartidor creado")
            mutate()
            setIsOpen(false)
            resetForm()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este repartidor?")) return
        const result = await deleteDriver(id)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Repartidor eliminado")
            mutate()
        }
    }

    const handleToggle = async (driver: Driver) => {
        const result = await updateDriver(driver.id, { isActive: !driver.isActive })
        if (result.error) {
            toast.error(result.error)
        } else {
            mutate()
        }
    }

    const vehicleLabel = { motorcycle: "Moto", bicycle: "Bicicleta", car: "Auto" }

    return (
        <div className="flex flex-col gap-6 max-w-6xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                        Repartidores
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona el equipo de delivery
                    </p>
                </div>
                <Button onClick={openNew} className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Repartidor
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers?.map((driver) => (
                    <Card key={driver.id} className={cn("rounded-2xl overflow-hidden", !driver.isActive && "opacity-60")}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Bike className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground">{driver.name}</h3>
                                        <p className="text-xs text-muted-foreground">{vehicleLabel[driver.vehicleType || "motorcycle"]}</p>
                                    </div>
                                </div>
                                <Badge variant={driver.isAvailable ? "default" : "secondary"}>
                                    {driver.isAvailable ? "Disponible" : "Ocupado"}
                                </Badge>
                            </div>

                            <div className="space-y-1 text-sm text-muted-foreground mb-3">
                                <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5" />
                                    {driver.phone}
                                </div>
                                {driver.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-3.5 w-3.5" />
                                        {driver.email}
                                    </div>
                                )}
                                {driver.vehiclePlate && (
                                    <p className="text-xs">Patente: {driver.vehiclePlate}</p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => openEdit(driver)}>
                                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                                    Editar
                                </Button>
                                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => handleToggle(driver)}>
                                    {driver.isActive ? "Desactivar" : "Activar"}
                                </Button>
                                <Button variant="outline" size="sm" className="rounded-lg text-destructive" onClick={() => handleDelete(driver.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Repartidor" : "Nuevo Repartidor"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label>Nombre</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl mt-1.5" />
                        </div>
                        <div>
                            <Label>Teléfono</Label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl mt-1.5" />
                        </div>
                        <div>
                            <Label>Email (opcional)</Label>
                            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl mt-1.5" />
                        </div>
                        <div>
                            <Label>Vehículo</Label>
                            <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as any)}>
                                <SelectTrigger className="rounded-xl mt-1.5">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="motorcycle">Moto</SelectItem>
                                    <SelectItem value="bicycle">Bicicleta</SelectItem>
                                    <SelectItem value="car">Auto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Patente (opcional)</Label>
                            <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className="rounded-xl mt-1.5" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsOpen(false)}>Cancelar</Button>
                            <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={!name || !phone}>Guardar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
