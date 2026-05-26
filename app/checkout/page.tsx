"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Store, CreditCard, Banknote, Loader2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useCartStore } from "@/lib/store"
import type { PaymentMethod, Branch, DeliveryZone } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createOrder } from "@/app/actions"
import { CouponInput } from "@/components/storefront/coupon-input"
import { GoogleMapsProvider, AddressSelector } from "@/components/maps"
import { findDeliveryZoneForPoint, formatZoneMeta, getZoneDeliveryFee } from "@/lib/delivery-zones"

function getBranchCity(address: string) {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) return parts[parts.length - 2]
  return parts[0] || "Ciudad no configurada"
}

function getDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const earthRadiusKm = 6371
  const dLat = ((to.lat - from.lat) * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const fromLat = (from.lat * Math.PI) / 180
  const toLat = (to.lat * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getBranchesCenter(branches: Branch[]) {
  const locatedBranches = branches.filter(
    (branch) => branch.isOpen && branch.lat != null && branch.lng != null
  )

  if (locatedBranches.length === 0) return undefined

  return {
    lat:
      locatedBranches.reduce((sum, branch) => sum + branch.lat!, 0) /
      locatedBranches.length,
    lng:
      locatedBranches.reduce((sum, branch) => sum + branch.lng!, 0) /
      locatedBranches.length,
  }
}

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice())
  const clearCart = useCartStore((s) => s.clearCart)
  const router = useRouter()

  const [deliveryMethod, setDeliveryMethod] =
    useState<"delivery" | "pickup">("delivery")
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("mercadopago")

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [allDeliveryZones, setAllDeliveryZones] = useState<DeliveryZone[]>([])
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
  const [selectedZone, setSelectedZone] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount: number
    discountType: string
    discountValue: number
  } | null>(null)

  // Map location state
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number
    lng: number
    address: string
  } | null>(null)

  useEffect(() => {
    fetch("/api/checkout-data")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.branches)) {
          setBranches(data.branches)
          const openBranch = data.branches.find((b: Branch) => b.isOpen)
          if (openBranch) setSelectedBranch(openBranch.id)
        }
        if (Array.isArray(data?.deliveryZones)) setAllDeliveryZones(data.deliveryZones)
      })
      .catch(() => {
        toast.error("No se pudieron cargar las zonas de envío")
      })
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    setDeliveryZones(allDeliveryZones.filter((z) => z.branchId === selectedBranch))
  }, [allDeliveryZones, selectedBranch])

  // Update address when location is selected from map
  useEffect(() => {
    if (selectedLocation) {
      setAddress(selectedLocation.address)

      const openBranches = branches.filter(
        (branch) => branch.isOpen && branch.lat != null && branch.lng != null
      )

      const candidates = openBranches
        .map((branch) => {
          const branchZones = allDeliveryZones.filter((zone) => zone.branchId === branch.id)
          const zone = findDeliveryZoneForPoint(branchZones, selectedLocation)

          return {
            branch,
            branchZones,
            zone,
            distanceKm: getDistanceKm(
              { lat: branch.lat!, lng: branch.lng! },
              selectedLocation
            ),
          }
        })
        .sort((a, b) => {
          if (a.zone && !b.zone) return -1
          if (!a.zone && b.zone) return 1
          return a.distanceKm - b.distanceKm
        })

      const best = candidates[0]
      if (best) {
        setSelectedBranch(best.branch.id)
        setDeliveryZones(best.branchZones)
        setSelectedZone(best.zone?.id || "")
      }

      if (!best?.zone && allDeliveryZones.length > 0) {
        toast.warning("Esa dirección está fuera de las zonas de envío")
      }
    }
  }, [allDeliveryZones, branches, selectedLocation])

  const selectedBranchInfo = branches.find((branch) => branch.id === selectedBranch)
  const selectedBranchLocation =
    selectedBranchInfo?.lat != null && selectedBranchInfo?.lng != null
      ? {
          lat: selectedBranchInfo.lat,
          lng: selectedBranchInfo.lng,
          title: selectedBranchInfo.name,
        }
      : undefined
  const branchesSearchCenter = getBranchesCenter(branches)
  const openBranchIds = new Set(
    branches.filter((branch) => branch.isOpen).map((branch) => branch.id)
  )
  const visibleDeliveryZones = selectedLocation
    ? deliveryZones
    : allDeliveryZones.filter(
        (zone) => zone.isActive && openBranchIds.has(zone.branchId)
      )
  const selectedZoneInfo = deliveryZones.find((z) => z.id === selectedZone)
  const hasCoverageCheck = deliveryMethod === "delivery" && deliveryZones.length > 0
  const isOutsideCoverage = hasCoverageCheck && selectedLocation && !selectedZoneInfo
  const shouldCalculateDelivery = hasCoverageCheck && !selectedZoneInfo

  const getDeliveryFee = () => {
    if (deliveryMethod !== "delivery") return 0
    return getZoneDeliveryFee(selectedZoneInfo, subtotalAfterDiscount)
  }

  const couponDiscount = appliedCoupon?.discount || 0
  const subtotalAfterDiscount = Math.max(0, totalPrice - couponDiscount)
  const deliveryFee = getDeliveryFee()
  const grandTotal = subtotalAfterDiscount + deliveryFee

  const handlePlaceOrder = async () => {
    if (!name || !phone) {
      toast.error("Por favor completá tu nombre y teléfono")
      return
    }
    if (deliveryMethod === "delivery" && !address) {
      toast.error("Por favor ingresá una dirección de entrega")
      return
    }
    if (deliveryMethod === "delivery" && deliveryZones.length > 0 && !selectedLocation) {
      toast.error("Marcá tu ubicación en el mapa para confirmar la zona de envío")
      return
    }
    if (deliveryMethod === "delivery" && deliveryZones.length > 0 && !selectedZone) {
      toast.error("La dirección está fuera de las zonas de envío disponibles")
      return
    }
    if (items.length === 0) {
      toast.error("Tu carrito está vacío")
      return
    }

    setLoading(true)
    try {
      const result = await createOrder({
        customerName: name,
        customerPhone: phone,
        fulfillmentType: deliveryMethod,
        addressText: address,
        notes,
        paymentMethod,
        sucursalId: selectedBranch,
        items,
        subtotal: totalPrice,
        deliveryFee,
        total: grandTotal,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscount,
        deliveryZoneId: selectedZone || undefined,
        orderType: "online",
        addressLat: selectedLocation?.lat,
        addressLng: selectedLocation?.lng,
      })

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      clearCart()
      toast.success(`¡Pedido #${result.orderNumber} realizado!`)
      router.push(`/order/${result.trackingToken}`)
    } catch {
      toast.error("Algo salió mal. Por favor intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Tu carrito está vacío</p>
        <Button asChild className="rounded-full bg-primary text-white hover:bg-primary/90">
          <Link href="/">Ver menú</Link>
        </Button>
      </div>
    )
  }

  return (
    <GoogleMapsProvider>
      <div className="min-h-screen bg-secondary">
        <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
          <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary" asChild>
              <Link href="/" aria-label="Volver al menú">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1
              className="text-lg font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Finalizar pedido
            </h1>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 flex flex-col gap-6">
            {/* Delivery Method */}
            <section className="rounded-2xl bg-card border border-border p-5">
              <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                Método de entrega
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                    deliveryMethod === "delivery"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => setDeliveryMethod("delivery")}
                >
                  <MapPin
                    className={cn(
                      "h-5 w-5",
                      deliveryMethod === "delivery"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      deliveryMethod === "delivery"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    Delivery
                  </span>
                </button>
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                    deliveryMethod === "pickup"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => setDeliveryMethod("pickup")}
                >
                  <Store
                    className={cn(
                      "h-5 w-5",
                      deliveryMethod === "pickup"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      deliveryMethod === "pickup"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    Retiro en local
                  </span>
                </button>
              </div>
            </section>

            {/* Contact Info */}
            <section className="rounded-2xl bg-card border border-border p-5">
              <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                Datos de contacto
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="name" className="text-sm text-muted-foreground mb-1.5 block">
                    Nombre
                  </Label>
                  <Input
                    id="name"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl bg-white border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm text-muted-foreground mb-1.5 block">
                    Teléfono
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+54 11 5555-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl bg-white border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  />
                </div>
                {deliveryMethod === "delivery" && (
                  <>
                    {/* Map Address Selector */}
                    <div className="pt-2">
                      <Label className="text-sm text-muted-foreground mb-1.5 block">
                        Dirección de entrega
                      </Label>
                      <AddressSelector
                        value={selectedLocation || undefined}
                        onChange={setSelectedLocation}
                        defaultCenter={selectedBranchLocation}
                        searchCenter={branchesSearchCenter}
                        searchRadiusKm={80}
                        branchMarker={selectedBranchLocation}
                        zones={visibleDeliveryZones.map(z => ({
                          id: z.id,
                          name: z.name,
                          color: z.color,
                          coordinates: z.coordinates || []
                        }))}
                        height="300px"
                        placeholder="Buscar dirección de entrega..."
                        showInstructions={false}
                        simpleMap
                        lazyMap
                      />
                      <div className="mt-3 rounded-xl border border-border bg-white p-3">
                        {selectedZoneInfo ? (
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-1 h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: selectedZoneInfo.color }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {selectedZoneInfo.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatZoneMeta(selectedZoneInfo)}
                              </p>
                              {selectedBranchInfo && (
                                <p className="text-xs text-muted-foreground">
                                  Sale desde {getBranchCity(selectedBranchInfo.address)}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : isOutsideCoverage ? (
                          <p className="text-sm text-destructive">
                            Esta dirección está fuera de nuestras zonas de envío.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Buscá tu dirección o mové el pin para calcular envío.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notes" className="text-sm text-muted-foreground mb-1.5 block">
                        Notas de entrega
                      </Label>
                      <Textarea
                        id="notes"
                        placeholder="Tocar timbre, dejar en puerta, etc."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground resize-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Payment Method */}
            <section className="rounded-2xl bg-card border border-border p-5">
              <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                Método de pago
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                    paymentMethod === "mercadopago"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => setPaymentMethod("mercadopago")}
                >
                  <CreditCard
                    className={cn(
                      "h-5 w-5",
                      paymentMethod === "mercadopago"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      paymentMethod === "mercadopago"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    MercadoPago
                  </span>
                </button>
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                    paymentMethod === "cash"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote
                    className={cn(
                      "h-5 w-5",
                      paymentMethod === "cash"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      paymentMethod === "cash"
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    Efectivo
                  </span>
                </button>
              </div>
            </section>
          </div>

          {/* Order Summary Sidebar */}
          <aside className="lg:w-80 shrink-0">
            <div className="rounded-2xl bg-card border border-border p-5 lg:sticky lg:top-20 space-y-4">
              <h2 className="font-semibold text-card-foreground text-sm uppercase tracking-wide">
                Resumen del pedido
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((item) => {
                  const modPrice = item.modifiers.reduce(
                    (sum, m) => sum + m.price,
                    0
                  )
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-card-foreground truncate">
                          {item.quantity}x {item.name}
                        </p>
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.modifiers
                              .map((m) => m.optionName)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-card-foreground shrink-0">
                        ${((item.price + modPrice) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <Separator />

              {/* Coupon Input */}
              <CouponInput
                cartTotal={totalPrice}
                onCouponApplied={setAppliedCoupon}
                appliedCoupon={appliedCoupon}
              />

              <Separator />

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                
                {appliedCoupon && appliedCoupon.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({appliedCoupon.code})</span>
                    <span>-${appliedCoupon.discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    {selectedZoneInfo ? `Delivery · ${selectedZoneInfo.name}` : "Delivery"}
                  </span>
                  <span>
                    {shouldCalculateDelivery
                      ? "A calcular"
                      : deliveryFee > 0
                        ? `$${deliveryFee.toFixed(2)}`
                        : "Gratis"}
                  </span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-bold text-lg text-card-foreground">
                  <span>Total</span>
                  <span className="text-primary">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base"
                onClick={handlePlaceOrder}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Procesando pedido...
                  </>
                ) : (
                  "Confirmar pedido"
                )}
              </Button>
            </div>
          </aside>
        </main>
      </div>
    </GoogleMapsProvider>
  )
}
