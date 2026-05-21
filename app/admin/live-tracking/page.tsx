"use client"

import { GoogleMapsProvider, DriversOverviewMap } from "@/components/maps"

export default function LiveTrackingPage() {
    return (
        <GoogleMapsProvider>
            <div className="flex flex-col gap-6 max-w-6xl">
                <div>
                    <h1
                        className="text-2xl font-bold text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Tracking en Vivo
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Ubicación de repartidores en tiempo real
                    </p>
                </div>

                <DriversOverviewMap height="600px" />
            </div>
        </GoogleMapsProvider>
    )
}
