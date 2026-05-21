"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import {
    MapPin,
    Plus,
    Loader2,
    Trash2,
    Edit2,
    DollarSign,
    Clock,
    Eye,
    Building2,
    Crosshair,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import type { Branch, DeliveryZone } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    createBranch,
    updateBranch,
    toggleBranchOpen,
    createDeliveryZone,
    updateDeliveryZone,
    deleteDeliveryZone,
} from "@/app/actions"
import { GoogleMapsProvider, ZoneEditor } from "@/components/maps"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ZONE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"]

export default function BranchesPage() {
    const {
        data: branches,
        mutate: mutateBranches,
        isLoading: loadingBranches,
    } = useSWR<Branch[]>("/api/admin?type=branches", fetcher)
    const {
        data: zones,
        mutate: mutateZones,
    } = useSWR<DeliveryZone[]>("/api/admin?type=delivery-zones", fetcher)

    // ── Branch dialog state ──
    const [branchDialogOpen, setBranchDialogOpen] = useState(false)
    const [editBranch, setEditBranch] = useState<Branch | null>(null)
    const [savingBranch, setSavingBranch] = useState(false)
    const [formName, setFormName] = useState("")
    const [formAddress, setFormAddress] = useState("")
    const [formIsOpen, setFormIsOpen] = useState(true)
    const [formLat, setFormLat] = useState<number | null>(null)
    const [formLng, setFormLng] = useState<number | null>(null)

    // ── Zone dialog state ──
    const [zoneDialogOpen, setZoneDialogOpen] = useState(false)
    const [editZone, setEditZone] = useState<DeliveryZone | null>(null)
    const [viewZone, setViewZone] = useState<DeliveryZone | null>(null)
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    const [zoneBranchId, setZoneBranchId] = useState("")
    const [zoneName, setZoneName] = useState("")
    const [zoneDeliveryFee, setZoneDeliveryFee] = useState("")
    const [zoneMinOrder, setZoneMinOrder] = useState("")
    const [zoneEstTime, setZoneEstTime] = useState("")
    const [zoneColor, setZoneColor] = useState("#3b82f6")
    const [zoneCoordinates, setZoneCoordinates] = useState<{ lat: number; lng: number }[]>([])

    // ── Selected branch for filtering zones ──
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)

    // Auto-select first branch
    useEffect(() => {
        if (branches?.length && !selectedBranchId) {
            setSelectedBranchId(branches[0].id)
        }
    }, [branches, selectedBranchId])

    // ── Helpers ──
    const getZonesForBranch = (branchId: string) =>
        zones?.filter((z) => z.branchId === branchId) || []

    const getBranchLocation = (branchId: string) => {
        const branch = branches?.find((b) => b.id === branchId)
        if (branch?.lat && branch?.lng) {
            return { lat: branch.lat, lng: branch.lng, title: branch.name }
        }
        return undefined
    }

    // ── Branch CRUD ──
    const openCreateBranch = () => {
        setEditBranch(null)
        setFormName("")
        setFormAddress("")
        setFormIsOpen(true)
        setFormLat(null)
        setFormLng(null)
        setBranchDialogOpen(true)
    }

    const openEditBranch = (branch: Branch) => {
        setEditBranch(branch)
        setFormName(branch.name)
        setFormAddress(branch.address)
        setFormIsOpen(branch.isOpen)
        setFormLat(branch.lat)
        setFormLng(branch.lng)
        setBranchDialogOpen(true)
    }

    const handleSaveBranch = async () => {
        if (!formName) {
            toast.error("Ingresá un nombre para la sucursal")
            return
        }
        setSavingBranch(true)
        try {
            const payload = {
                nombre: formName,
                direccion: formAddress,
                lat: formLat ?? undefined,
                lng: formLng ?? undefined,
                isOpen: formIsOpen,
            }
            const result = editBranch
                ? await updateBranch(editBranch.id, payload)
                : await createBranch(payload)

            if (result.error) {
                toast.error(result.error)
                return
            }
            toast.success(editBranch ? "Sucursal actualizada" : "Sucursal creada")
            setBranchDialogOpen(false)
            mutateBranches()
        } catch {
            toast.error("Error al guardar")
        } finally {
            setSavingBranch(false)
        }
    }

    const handleToggleOpen = async (branchId: string) => {
        const branch = branches?.find((b) => b.id === branchId)
        mutateBranches(
            (prev) =>
                prev?.map((b) =>
                    b.id === branchId ? { ...b, isOpen: !b.isOpen } : b
                ),
            false
        )
        const result = await toggleBranchOpen(branchId)
        if (result.error) {
            toast.error(result.error)
            mutateBranches()
        } else if (branch) {
            toast.success(`${branch.name} ahora está ${branch.isOpen ? "cerrada" : "abierta"}`)
        }
    }

    // ── Zone CRUD ──
    const openCreateZone = (branchId: string) => {
        setEditZone(null)
        setZoneBranchId(branchId)
        setZoneName("")
        setZoneDeliveryFee("")
        setZoneMinOrder("")
        setZoneEstTime("")
        setZoneColor("#3b82f6")
        setZoneCoordinates([])
        setZoneDialogOpen(true)
    }

    const openEditZone = (zone: DeliveryZone) => {
        setEditZone(zone)
        setZoneBranchId(zone.branchId)
        setZoneName(zone.name)
        setZoneDeliveryFee(zone.deliveryFee.toString())
        setZoneMinOrder(zone.minOrderAmount?.toString() || "")
        setZoneEstTime(zone.estimatedTimeMin?.toString() || "")
        setZoneColor(zone.color)
        setZoneCoordinates(zone.coordinates || [])
        setZoneDialogOpen(true)
    }

    const openViewZone = (zone: DeliveryZone) => {
        setViewZone(zone)
        setViewDialogOpen(true)
    }

    const handleSaveZone = async () => {
        if (zoneCoordinates.length < 3) {
            toast.error("La zona debe tener al menos 3 puntos")
            return
        }
        const data = {
            branchId: zoneBranchId,
            name: zoneName,
            color: zoneColor,
            coordinates: zoneCoordinates,
            deliveryFee: parseFloat(zoneDeliveryFee) || 0,
            minOrderAmount: parseFloat(zoneMinOrder) || 0,
            estimatedTimeMin: zoneEstTime ? parseInt(zoneEstTime) : undefined,
        }
        const result = editZone
            ? await updateDeliveryZone(editZone.id, { ...data, isActive: editZone.isActive })
            : await createDeliveryZone(data)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(editZone ? "Zona actualizada" : "Zona creada")
            mutateZones()
            setZoneDialogOpen(false)
        }
    }

    const handleDeleteZone = async (id: string) => {
        if (!confirm("¿Eliminar esta zona?")) return
        const result = await deleteDeliveryZone(id)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Zona eliminada")
            mutateZones()
        }
    }

    const handleToggleZone = async (zone: DeliveryZone) => {
        const result = await updateDeliveryZone(zone.id, { isActive: !zone.isActive })
        if (result.error) {
            toast.error(result.error)
        } else {
            mutateZones()
        }
    }

    // ── Selected branch data ──
    const selectedBranch = branches?.find((b) => b.id === selectedBranchId)
    const selectedZones = selectedBranchId ? getZonesForBranch(selectedBranchId) : []

    if (loadingBranches) {
        return (
            <div className="flex flex-col gap-6 max-w-6xl">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 w-full rounded-2xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <GoogleMapsProvider>
            <div className="flex flex-col gap-6 max-w-6xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1
                            className="text-2xl font-bold text-foreground"
                            style={{ fontFamily: "var(--font-heading)" }}
                        >
                            Sucursales
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gestiona tus sucursales y sus zonas de delivery
                        </p>
                    </div>
                    <Button className="rounded-xl gap-2" onClick={openCreateBranch}>
                        <Plus className="h-4 w-4" />
                        Nueva Sucursal
                    </Button>
                </div>

                {/* Branch tabs */}
                {branches && branches.length > 0 ? (
                    <Tabs
                        value={selectedBranchId || ""}
                        onValueChange={setSelectedBranchId}
                    >
                        <TabsList className="rounded-xl h-auto flex-wrap">
                            {branches.map((branch) => (
                                <TabsTrigger
                                    key={branch.id}
                                    value={branch.id}
                                    className="rounded-lg gap-2"
                                >
                                    <Building2 className="h-4 w-4" />
                                    {branch.name}
                                    {!branch.isOpen && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                            Cerrada
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {branches.map((branch) => (
                            <TabsContent key={branch.id} value={branch.id} className="mt-4 space-y-4">
                                {/* Branch info card */}
                                <Card className="rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{branch.name}</h3>
                                                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                                        <MapPin className="h-3 w-3" />
                                                        {branch.address || "Sin dirección"}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-xs",
                                                        branch.isOpen
                                                            ? "bg-chart-3/15 text-chart-3 border-chart-3/20"
                                                            : "bg-muted text-muted-foreground border-border"
                                                    )}
                                                >
                                                    {branch.isOpen ? "Abierta" : "Cerrada"}
                                                </Badge>
                                                <Switch
                                                    checked={branch.isOpen}
                                                    onCheckedChange={() => handleToggleOpen(branch.id)}
                                                    aria-label="Toggle open/closed"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-lg"
                                                    onClick={() => openEditBranch(branch)}
                                                >
                                                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                                                    Editar
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Zones section */}
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Zonas de Delivery</h2>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl gap-2"
                                        onClick={() => openCreateZone(branch.id)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Nueva Zona
                                    </Button>
                                </div>

                                {getZonesForBranch(branch.id).length === 0 ? (
                                    <Card className="rounded-2xl border-dashed">
                                        <CardContent className="p-8 text-center">
                                            <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                            <p className="text-muted-foreground text-sm">
                                                No hay zonas de delivery configuradas
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl mt-3"
                                                onClick={() => openCreateZone(branch.id)}
                                            >
                                                Crear primera zona
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {getZonesForBranch(branch.id).map((zone) => (
                                            <Card
                                                key={zone.id}
                                                className={cn(
                                                    "rounded-2xl overflow-hidden",
                                                    !zone.isActive && "opacity-60"
                                                )}
                                            >
                                                <CardHeader className="pb-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="h-8 w-8 rounded-lg flex items-center justify-center"
                                                                style={{ backgroundColor: `${zone.color}20` }}
                                                            >
                                                                <MapPin
                                                                    className="h-4 w-4"
                                                                    style={{ color: zone.color }}
                                                                />
                                                            </span>
                                                            <CardTitle className="text-base">
                                                                {zone.name}
                                                            </CardTitle>
                                                        </div>
                                                        <Badge variant={zone.isActive ? "default" : "secondary"}>
                                                            {zone.isActive ? "Activa" : "Inactiva"}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                            <span className="font-bold text-lg">
                                                                ${zone.deliveryFee.toFixed(2)}
                                                            </span>
                                                        </div>
                                                        {zone.estimatedTimeMin && (
                                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                                <Clock className="h-4 w-4" />
                                                                ~{zone.estimatedTimeMin} min
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        {zone.coordinates?.length || 0} puntos
                                                        {zone.minOrderAmount > 0 && (
                                                            <span> · Gratis desde ${zone.minOrderAmount}</span>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-2 pt-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex-1 rounded-lg"
                                                            onClick={() => openViewZone(zone)}
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                                            Ver
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex-1 rounded-lg"
                                                            onClick={() => openEditZone(zone)}
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg"
                                                            onClick={() => handleToggleZone(zone)}
                                                        >
                                                            {zone.isActive ? "Off" : "On"}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg text-destructive"
                                                            onClick={() => handleDeleteZone(zone.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>
                ) : (
                    <Card className="rounded-2xl border-dashed">
                        <CardContent className="p-8 text-center">
                            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground text-sm">
                                No hay sucursales configuradas
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl mt-3"
                                onClick={openCreateBranch}
                            >
                                Crear primera sucursal
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* ─── Branch Create/Edit Dialog ─── */}
                <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
                    <DialogContent className="max-w-md bg-card border-border rounded-2xl">
                        <DialogHeader>
                            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>
                                {editBranch ? "Editar Sucursal" : "Nueva Sucursal"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-4 py-4">
                            <div>
                                <Label className="text-sm text-muted-foreground mb-1.5 block">
                                    Nombre
                                </Label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ej: Sucursal Centro"
                                    className="rounded-xl bg-secondary border-0"
                                />
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground mb-1.5 block">
                                    Dirección
                                </Label>
                                <Input
                                    value={formAddress}
                                    onChange={(e) => setFormAddress(e.target.value)}
                                    placeholder="Dirección completa"
                                    className="rounded-xl bg-secondary border-0"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-sm text-muted-foreground mb-1.5 block">
                                        Latitud
                                    </Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        value={formLat ?? ""}
                                        onChange={(e) =>
                                            setFormLat(e.target.value ? parseFloat(e.target.value) : null)
                                        }
                                        placeholder="-34.6037"
                                        className="rounded-xl bg-secondary border-0"
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm text-muted-foreground mb-1.5 block">
                                        Longitud
                                    </Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        value={formLng ?? ""}
                                        onChange={(e) =>
                                            setFormLng(e.target.value ? parseFloat(e.target.value) : null)
                                        }
                                        placeholder="-58.3816"
                                        className="rounded-xl bg-secondary border-0"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-sm text-muted-foreground">Abierta</Label>
                                <Switch checked={formIsOpen} onCheckedChange={setFormIsOpen} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setBranchDialogOpen(false)}
                                className="rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSaveBranch}
                                disabled={savingBranch}
                                className="rounded-xl"
                            >
                                {savingBranch ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : editBranch ? (
                                    "Guardar"
                                ) : (
                                    "Crear"
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ─── Zone Create/Edit Dialog ─── */}
                <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
                    <DialogContent className="sm:max-w-4xl rounded-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editZone ? "Editar Zona" : "Nueva Zona de Delivery"}
                            </DialogTitle>
                            <DialogDescription>
                                Dibuja el área de cobertura en el mapa haciendo clic para agregar puntos
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                            {/* Form */}
                            <div className="space-y-4">
                                <div>
                                    <Label>Nombre</Label>
                                    <Input
                                        value={zoneName}
                                        onChange={(e) => setZoneName(e.target.value)}
                                        placeholder="Ej: Centro"
                                        className="rounded-xl mt-1.5"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Costo de envío</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={zoneDeliveryFee}
                                            onChange={(e) => setZoneDeliveryFee(e.target.value)}
                                            className="rounded-xl mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label>Mínimo gratis (opc)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={zoneMinOrder}
                                            onChange={(e) => setZoneMinOrder(e.target.value)}
                                            className="rounded-xl mt-1.5"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Tiempo estimado (min, opc)</Label>
                                    <Input
                                        type="number"
                                        value={zoneEstTime}
                                        onChange={(e) => setZoneEstTime(e.target.value)}
                                        className="rounded-xl mt-1.5"
                                    />
                                </div>
                                <div>
                                    <Label>Color</Label>
                                    <div className="flex gap-2 mt-1.5">
                                        {ZONE_COLORS.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setZoneColor(c)}
                                                className={cn(
                                                    "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                                                    zoneColor === c
                                                        ? "border-foreground scale-110"
                                                        : "border-transparent"
                                                )}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Map Editor */}
                            <div>
                                <Label className="mb-2 block">Área de cobertura</Label>
                                <ZoneEditor
                                    initialCoordinates={zoneCoordinates}
                                    center={getBranchLocation(zoneBranchId)}
                                    branchMarker={getBranchLocation(zoneBranchId)}
                                    zoneColor={zoneColor}
                                    onChange={setZoneCoordinates}
                                    height="400px"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={() => setZoneDialogOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 rounded-xl"
                                onClick={handleSaveZone}
                                disabled={!zoneName || zoneCoordinates.length < 3}
                            >
                                Guardar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ─── Zone View Dialog ─── */}
                <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                    <DialogContent className="sm:max-w-3xl rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>{viewZone?.name}</DialogTitle>
                            <DialogDescription>
                                {branches?.find((b) => b.id === viewZone?.branchId)?.name}
                            </DialogDescription>
                        </DialogHeader>

                        {viewZone && (
                            <div className="space-y-4 pt-4">
                                <ZoneEditor
                                    initialCoordinates={viewZone.coordinates || []}
                                    center={getBranchLocation(viewZone.branchId)}
                                    branchMarker={getBranchLocation(viewZone.branchId)}
                                    zoneColor={viewZone.color}
                                    onChange={() => {}}
                                    height="400px"
                                    readOnly
                                />
                                <div className="grid grid-cols-3 gap-4">
                                    <Card className="rounded-xl">
                                        <CardContent className="p-4 text-center">
                                            <p className="text-2xl font-bold">
                                                ${viewZone.deliveryFee.toFixed(2)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Costo de envío</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-xl">
                                        <CardContent className="p-4 text-center">
                                            <p className="text-2xl font-bold">
                                                ${viewZone.minOrderAmount || 0}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Mínimo gratis</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-xl">
                                        <CardContent className="p-4 text-center">
                                            <p className="text-2xl font-bold">
                                                {viewZone.estimatedTimeMin || "--"} min
                                            </p>
                                            <p className="text-xs text-muted-foreground">Tiempo estimado</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </GoogleMapsProvider>
    )
}
