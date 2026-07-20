"use client"

import { useEffect, useRef } from "react"
import { Wifi, WifiOff } from "lucide-react"
import { toast } from "sonner"
import { useConnectivity } from "@/hooks/use-connectivity"

export function ConnectivityBanner() {
  const isOnline = useConnectivity()
  const wasOnline = useRef<boolean | null>(null)

  useEffect(() => {
    if (wasOnline.current === false && isOnline) {
      toast.success("Conexión restablecida", { icon: <Wifi className="h-4 w-4" /> })
    }
    wasOnline.current = isOnline
  }, [isOnline])

  if (isOnline) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    >
      <WifiOff className="h-4 w-4" />
      Sin conexión · algunos datos pueden estar desactualizados
    </div>
  )
}
