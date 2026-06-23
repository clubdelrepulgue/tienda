"use client"

import { useState, useEffect } from "react"
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
    Upload,
    X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import type { Branch, DeliveryZone } from "@/lib/types"
import { cn, formatPrice, slugify } from "@/lib/utils"
import { toast } from "sonner"
import {
    createBranch,
    updateBranch,
    toggleBranchOpen,
    createDeliveryZones,
    updateDeliveryZone,
    deleteDeliveryZone,
} from "@/app/actions"
import { AddressSelector, GoogleMapsProvider, ZoneEditor } from "@/components/maps"
import { formatZoneMeta, generateCirclePolygon } from "@/lib/delivery-zones"
import { createClient } from "@/lib/supabase/client"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ZONE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"]

type RadiusZoneDraft = {
    id: string
    name: string
    radiusKm: string
    deliveryFee: string
    minOrderAmount: string
    estimatedTimeMin: string
    color: string
}

const defaultRadiusZones: RadiusZoneDraft[] = [
    {
        id: "near",
        name: "Cerca",
        radiusKm: "5",
        deliveryFee: "100",
        minOrderAmount: "",
        estimatedTimeMin: "25",
        color: "#22c55e",
    },
    {
        id: "mid",
        name: "Media",
        radiusKm: "10",
        deliveryFee: "180",
        minOrderAmount: "",
        estimatedTimeMin: "40",
        color: "#f59e0b",
    },
    {
        id: "far",
        name: "Lejana",
        radiusKm: "25",
        deliveryFee: "300",
        minOrderAmount: "",
        estimatedTimeMin: "60",
        color: "#ef4444",
    },
]

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
    const [formSlug, setFormSlug] = useState("")
    const [formSlugTouched, setFormSlugTouched] = useState(false)
    const [formAddress, setFormAddress] = useState("")
    const [formLogoUrl, setFormLogoUrl] = useState("")
    const [formBannerUrl, setFormBannerUrl] = useState("")
    const [formBrandColor, setFormBrandColor] = useState("#E86303")
    const [formAccentColor, setFormAccentColor] = useState("#F97316")
    const [formHeroTitle, setFormHeroTitle] = useState("")
    const [formHeroSubtitle, setFormHeroSubtitle] = useState("")
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [uploadingBanner, setUploadingBanner] = useState(false)
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
    const [radiusZones, setRadiusZones] = useState<RadiusZoneDraft[]>(defaultRadiusZones)
    const [savingZone, setSavingZone] = useState(false)

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

    const uploadBranchAsset = async (file: File, kind: "logo" | "banner") => {
        const supabase = createClient()
        const fileExt = file.name.split(".").pop() || "webp"
        const folder = editBranch?.id || slugify(formName || "nueva-sucursal")
        const fileName = `branding/branches/${folder}/${kind}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
            .from("productos")
            .upload(fileName, file)

        if (uploadError) {
            toast.error(`Error al subir ${kind === "logo" ? "el logo" : "el banner"}: ${uploadError.message}`)
            return null
        }

        const { data: { publicUrl } } = supabase.storage
            .from("productos")
            .getPublicUrl(fileName)

        return publicUrl
    }

    const handleBrandAssetUpload = async (
        file: File | undefined,
        kind: "logo" | "banner"
    ) => {
        if (!file) return
        if (!file.type.startsWith("image/")) {
            toast.error("Selecciona una imagen valida")
            return
        }

        if (kind === "logo") setUploadingLogo(true)
        if (kind === "banner") setUploadingBanner(true)

        try {
            const publicUrl = await uploadBranchAsset(file, kind)
            if (!publicUrl) return
            if (kind === "logo") setFormLogoUrl(publicUrl)
            if (kind === "banner") setFormBannerUrl(publicUrl)
            toast.success(`${kind === "logo" ? "Logo" : "Banner"} subido`)
        } finally {
            if (kind === "logo") setUploadingLogo(false)
            if (kind === "banner") setUploadingBanner(false)
        }
    }

    // ── Branch CRUD ──
    const openCreateBranch = () => {
        setEditBranch(null)
        setFormName("")
        setFormSlug("")
        setFormSlugTouched(false)
        setFormAddress("")
        setFormLogoUrl("")
        setFormBannerUrl("")
        setFormBrandColor("#E86303")
        setFormAccentColor("#F97316")
        setFormHeroTitle("")
        setFormHeroSubtitle("")
        setFormIsOpen(true)
        setFormLat(null)
        setFormLng(null)
        setBranchDialogOpen(true)
    }

    const openEditBranch = (branch: Branch) => {
        setEditBranch(branch)
        setFormName(branch.name)
        setFormSlug(branch.slug)
        setFormSlugTouched(true)
        setFormAddress(branch.address)
        setFormLogoUrl(branch.logoUrl)
        setFormBannerUrl(branch.bannerUrl)
        setFormBrandColor(branch.brandColor || "#E86303")
        setFormAccentColor(branch.accentColor || "#F97316")
        setFormHeroTitle(branch.heroTitle)
        setFormHeroSubtitle(branch.heroSubtitle)
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
        const normalizedSlug = slugify(formSlug || formName)
        setSavingBranch(true)
        try {
            const payload = {
                nombre: formName,
                slug: normalizedSlug,
                direccion: formAddress,
                logoUrl: formLogoUrl,
                bannerUrl: formBannerUrl,
                brandColor: formBrandColor,
                accentColor: formAccentColor,
                heroTitle: formHeroTitle,
                heroSubtitle: formHeroSubtitle,
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
        setRadiusZones(defaultRadiusZones.map((zone) => ({ ...zone })))
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
        setRadiusZones(defaultRadiusZones.map((draft) => ({ ...draft })))
        setZoneDialogOpen(true)
    }

    const openViewZone = (zone: DeliveryZone) => {
        setViewZone(zone)
        setViewDialogOpen(true)
    }

    const updateRadiusZone = (id: string, patch: Partial<RadiusZoneDraft>) => {
        setRadiusZones((current) =>
            current.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone))
        )
    }

    const addRadiusZone = () => {
        const lastRadius = radiusZones
            .map((zone) => parseFloat(zone.radiusKm))
            .filter((radius) => Number.isFinite(radius))
            .sort((a, b) => b - a)[0]

        setRadiusZones((current) => [
            ...current,
            {
                id: `zone-${Date.now()}`,
                name: `Zona ${current.length + 1}`,
                radiusKm: lastRadius ? String(lastRadius + 5) : "5",
                deliveryFee: "",
                minOrderAmount: "",
                estimatedTimeMin: "",
                color: ZONE_COLORS[current.length % ZONE_COLORS.length],
            },
        ])
    }

    const removeRadiusZone = (id: string) => {
        setRadiusZones((current) => current.filter((zone) => zone.id !== id))
    }

    const handleSaveZone = async () => {
        setSavingZone(true)
        try {
            if (!editZone) {
                const branchLocation = getBranchLocation(zoneBranchId)
                if (!branchLocation) {
                    toast.error("Primero geolocalizá la sucursal para crear zonas por radio")
                    return
                }

                const validZones = radiusZones
                    .map((zone) => ({
                        ...zone,
                        radius: parseFloat(zone.radiusKm),
                        fee: parseFloat(zone.deliveryFee),
                        minOrder: parseFloat(zone.minOrderAmount),
                        eta: parseInt(zone.estimatedTimeMin),
                    }))
                    .filter(
                        (zone) =>
                            zone.name.trim() &&
                            Number.isFinite(zone.radius) &&
                            zone.radius > 0 &&
                            Number.isFinite(zone.fee)
                    )
                    .sort((a, b) => a.radius - b.radius)

                if (validZones.length === 0) {
                    toast.error("Agregá al menos una zona con radio y costo")
                    return
                }

                const result = await createDeliveryZones(
                    validZones.map((zone) => ({
                        branchId: zoneBranchId,
                        name: `${zone.name.trim()} · hasta ${zone.radius} km`,
                        color: zone.color,
                        coordinates: generateCirclePolygon(branchLocation, zone.radius),
                        deliveryFee: zone.fee,
                        minOrderAmount: Number.isFinite(zone.minOrder) ? zone.minOrder : 0,
                        estimatedTimeMin: Number.isFinite(zone.eta) ? zone.eta : undefined,
                    }))
                )

                if (result.error) {
                    toast.error(result.error)
                } else {
                    toast.success(`${validZones.length} zonas creadas por radio`)
                    mutateZones()
                    setZoneDialogOpen(false)
                }
                return
            }

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
        const result = await updateDeliveryZone(editZone.id, { ...data, isActive: editZone.isActive })

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Zona actualizada")
            mutateZones()
            setZoneDialogOpen(false)
        }
        } finally {
            setSavingZone(false)
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
                                                <div
                                                    className="h-10 w-10 overflow-hidden rounded-xl bg-primary/10 flex items-center justify-center"
                                                    style={{ color: branch.brandColor }}
                                                >
                                                    {branch.logoUrl ? (
                                                        <img
                                                            src={branch.logoUrl}
                                                            alt={branch.name}
                                                            className="h-full w-full object-contain"
                                                        />
                                                    ) : (
                                                        <Building2 className="h-5 w-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{branch.name}</h3>
                                                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                                        <MapPin className="h-3 w-3" />
                                                        {branch.address || "Sin dirección"}
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        /menu/{branch.slug}
                                                    </p>
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
                                                                {formatPrice(zone.deliveryFee)}
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
                                                        {formatZoneMeta(zone)} · {zone.coordinates?.length || 0} puntos
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
                    <DialogContent className="max-w-2xl bg-card border-border rounded-2xl max-h-[90vh] overflow-y-auto">
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
                                    onChange={(e) => {
                                        const nextName = e.target.value
                                        setFormName(nextName)
                                        if (!formSlugTouched) {
                                            setFormSlug(slugify(nextName))
                                        }
                                    }}
                                    placeholder="Ej: Sucursal Centro"
                                    className="rounded-xl bg-secondary border-0"
                                />
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground mb-1.5 block">
                                    URL del menú
                                </Label>
                                <Input
                                    value={formSlug}
                                    onChange={(e) => {
                                        setFormSlug(slugify(e.target.value))
                                        setFormSlugTouched(true)
                                    }}
                                    placeholder="sucursal-centro"
                                    className="rounded-xl bg-secondary border-0"
                                />
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    URL pública: /menu/{formSlug || slugify(formName)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-border bg-white p-4">
                                <div className="mb-4">
                                    <h3 className="text-sm font-semibold text-foreground">Branding del menú</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Personaliza logo, banner, colores y textos para esta sucursal.
                                    </p>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-sm text-muted-foreground">Logo</Label>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary">
                                                {formLogoUrl ? (
                                                    <img src={formLogoUrl} alt="Logo" className="h-full w-full object-contain" />
                                                ) : (
                                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                <Input
                                                    value={formLogoUrl}
                                                    onChange={(e) => setFormLogoUrl(e.target.value)}
                                                    placeholder="https://..."
                                                    className="rounded-xl bg-secondary border-0"
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="relative rounded-xl"
                                                        disabled={uploadingLogo}
                                                    >
                                                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                        Subir
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="absolute inset-0 cursor-pointer opacity-0"
                                                            onChange={(e) => handleBrandAssetUpload(e.target.files?.[0], "logo")}
                                                        />
                                                    </Button>
                                                    {formLogoUrl && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="rounded-xl"
                                                            onClick={() => setFormLogoUrl("")}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm text-muted-foreground">Banner</Label>
                                        <div className="overflow-hidden rounded-xl border border-border bg-secondary">
                                            {formBannerUrl ? (
                                                <img src={formBannerUrl} alt="Banner" className="aspect-[3/1] w-full object-cover" />
                                            ) : (
                                                <div className="flex aspect-[3/1] items-center justify-center text-xs text-muted-foreground">
                                                    Sin banner personalizado
                                                </div>
                                            )}
                                        </div>
                                        <Input
                                            value={formBannerUrl}
                                            onChange={(e) => setFormBannerUrl(e.target.value)}
                                            placeholder="https://..."
                                            className="rounded-xl bg-secondary border-0"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="relative rounded-xl"
                                                disabled={uploadingBanner}
                                            >
                                                {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                Subir banner
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 cursor-pointer opacity-0"
                                                    onChange={(e) => handleBrandAssetUpload(e.target.files?.[0], "banner")}
                                                />
                                            </Button>
                                            {formBannerUrl && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-xl"
                                                    onClick={() => setFormBannerUrl("")}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <Label className="text-sm text-muted-foreground mb-1.5 block">
                                            Color principal
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={/^#[0-9A-Fa-f]{6}$/.test(formBrandColor) ? formBrandColor : "#E86303"}
                                                onChange={(e) => setFormBrandColor(e.target.value)}
                                                className="h-10 w-14 rounded-xl bg-secondary p-1"
                                            />
                                            <Input
                                                value={formBrandColor}
                                                onChange={(e) => setFormBrandColor(e.target.value)}
                                                className="rounded-xl bg-secondary border-0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground mb-1.5 block">
                                            Color acento
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={/^#[0-9A-Fa-f]{6}$/.test(formAccentColor) ? formAccentColor : "#F97316"}
                                                onChange={(e) => setFormAccentColor(e.target.value)}
                                                className="h-10 w-14 rounded-xl bg-secondary p-1"
                                            />
                                            <Input
                                                value={formAccentColor}
                                                onChange={(e) => setFormAccentColor(e.target.value)}
                                                className="rounded-xl bg-secondary border-0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <Label className="text-sm text-muted-foreground mb-1.5 block">
                                            Título sobre banner
                                        </Label>
                                        <Input
                                            value={formHeroTitle}
                                            onChange={(e) => setFormHeroTitle(e.target.value)}
                                            placeholder="Horneadas con amor"
                                            className="rounded-xl bg-secondary border-0"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground mb-1.5 block">
                                            Texto secundario
                                        </Label>
                                        <Textarea
                                            value={formHeroSubtitle}
                                            onChange={(e) => setFormHeroSubtitle(e.target.value)}
                                            placeholder="Bienvenido al Club del Repulgue"
                                            className="min-h-10 rounded-xl bg-secondary border-0"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground mb-1.5 block">
                                    Dirección
                                </Label>
                                <AddressSelector
                                    value={
                                        formLat != null && formLng != null
                                            ? {
                                                  lat: formLat,
                                                  lng: formLng,
                                                  address: formAddress || "Ubicación de la sucursal",
                                              }
                                            : undefined
                                    }
                                    onChange={(location) => {
                                        setFormAddress(location.address)
                                        setFormLat(location.lat)
                                        setFormLng(location.lng)
                                    }}
                                    placeholder="Buscar dirección de la sucursal..."
                                    height="240px"
                                    reverseGeocodeOnSelect
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
                                {editZone ? "Editar Zona" : "Zonas por radio de distancia"}
                            </DialogTitle>
                            <DialogDescription>
                                {editZone
                                    ? "Ajusta el área de cobertura dibujada en el mapa"
                                    : "Crea varias zonas circulares desde la sucursal: cerca, media y lejana."}
                            </DialogDescription>
                        </DialogHeader>

                        {editZone ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
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
                                                    type="button"
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

                                <div>
                                    <Label className="mb-2 block">Área de cobertura</Label>
                                    <ZoneEditor
                                        initialCoordinates={zoneCoordinates}
                                        center={getBranchLocation(zoneBranchId)}
                                        branchMarker={getBranchLocation(zoneBranchId)}
                                        zoneColor={zoneColor}
                                        onChange={setZoneCoordinates}
                                        height="400px"
                                        showPointMarkers={zoneCoordinates.length <= 24}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 pt-4">
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-border bg-secondary/40 p-3">
                                        <p className="text-sm font-medium">Regla</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Cada fila crea una zona circular desde el local. El comprador queda en la zona de menor radio que cubra su dirección.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        {radiusZones.map((zone, index) => (
                                            <div
                                                key={zone.id}
                                                className="grid grid-cols-12 gap-2 items-end rounded-xl border border-border p-3"
                                            >
                                                <div className="col-span-12 sm:col-span-3">
                                                    <Label className="text-xs">Nombre</Label>
                                                    <Input
                                                        value={zone.name}
                                                        onChange={(e) => updateRadiusZone(zone.id, { name: e.target.value })}
                                                        className="rounded-lg mt-1"
                                                    />
                                                </div>
                                                <div className="col-span-6 sm:col-span-2">
                                                    <Label className="text-xs">Hasta km</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={zone.radiusKm}
                                                        onChange={(e) => updateRadiusZone(zone.id, { radiusKm: e.target.value })}
                                                        className="rounded-lg mt-1"
                                                    />
                                                </div>
                                                <div className="col-span-6 sm:col-span-2">
                                                    <Label className="text-xs">Costo</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={zone.deliveryFee}
                                                        onChange={(e) => updateRadiusZone(zone.id, { deliveryFee: e.target.value })}
                                                        className="rounded-lg mt-1"
                                                    />
                                                </div>
                                                <div className="col-span-6 sm:col-span-2">
                                                    <Label className="text-xs">Gratis desde</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={zone.minOrderAmount}
                                                        onChange={(e) => updateRadiusZone(zone.id, { minOrderAmount: e.target.value })}
                                                        placeholder="Opc."
                                                        className="rounded-lg mt-1"
                                                    />
                                                </div>
                                                <div className="col-span-4 sm:col-span-2">
                                                    <Label className="text-xs">Min</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={zone.estimatedTimeMin}
                                                        onChange={(e) => updateRadiusZone(zone.id, { estimatedTimeMin: e.target.value })}
                                                        className="rounded-lg mt-1"
                                                    />
                                                </div>
                                                <div className="col-span-12 sm:col-span-1 flex items-center gap-2">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-9 w-9 rounded-lg p-1"
                                                                title="Elegir color"
                                                            >
                                                                <span
                                                                    className="h-full w-full rounded-md"
                                                                    style={{ backgroundColor: zone.color }}
                                                                />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-2" align="end">
                                                            <div className="grid grid-cols-3 gap-2">
                                                                {ZONE_COLORS.map((color) => (
                                                                    <button
                                                                        key={color}
                                                                        type="button"
                                                                        className={cn(
                                                                            "h-8 w-8 rounded-md border transition-transform hover:scale-110",
                                                                            zone.color === color
                                                                                ? "border-foreground ring-2 ring-foreground/20"
                                                                                : "border-border"
                                                                        )}
                                                                        style={{ backgroundColor: color }}
                                                                        onClick={() => updateRadiusZone(zone.id, { color })}
                                                                        title={`Color ${color}`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                    {radiusZones.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-destructive"
                                                            onClick={() => removeRadiusZone(zone.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl gap-2"
                                        onClick={addRadiusZone}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Agregar radio
                                    </Button>
                                </div>

                                <div>
                                    <Label className="mb-2 block">Vista previa de zonas superpuestas</Label>
                                    {getBranchLocation(zoneBranchId) ? (
                                        <ZoneEditor
                                            initialCoordinates={[]}
                                            center={getBranchLocation(zoneBranchId)}
                                            branchMarker={getBranchLocation(zoneBranchId)}
                                            previewZones={radiusZones
                                                .map((zone) => ({
                                                    id: zone.id,
                                                    name: zone.name || "Zona",
                                                    color: zone.color,
                                                    radiusKm: parseFloat(zone.radiusKm),
                                                }))
                                                .filter(
                                                    (zone) =>
                                                        Number.isFinite(zone.radiusKm) &&
                                                        zone.radiusKm > 0
                                                )
                                                .map((zone) => ({
                                                    ...zone,
                                                    coordinates: generateCirclePolygon(
                                                        getBranchLocation(zoneBranchId)!,
                                                        zone.radiusKm
                                                    ),
                                                }))}
                                            onChange={() => {}}
                                            height="400px"
                                            readOnly
                                        />
                                    ) : (
                                        <div className="h-[400px] rounded-xl border border-dashed border-border flex items-center justify-center p-6 text-center">
                                            <p className="text-sm text-muted-foreground">
                                                Geolocalizá la sucursal para ver y crear zonas por radio.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
                                disabled={
                                    savingZone ||
                                    (editZone
                                        ? !zoneName || zoneCoordinates.length < 3
                                        : !getBranchLocation(zoneBranchId))
                                }
                            >
                                {savingZone ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : editZone ? (
                                    "Guardar"
                                ) : (
                                    "Crear zonas"
                                )}
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
                                                {formatPrice(viewZone.deliveryFee)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Costo de envío</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="rounded-xl">
                                        <CardContent className="p-4 text-center">
                                            <p className="text-2xl font-bold">
                                                {formatPrice(viewZone.minOrderAmount || 0)}
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
