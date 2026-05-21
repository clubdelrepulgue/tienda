"use client"

import { APIProvider } from "@vis.gl/react-google-maps"

interface GoogleMapsProviderProps {
    children: React.ReactNode
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
        console.warn("Google Maps API key not configured")
        return (
            <div className="flex items-center justify-center h-full bg-muted rounded-xl">
                <p className="text-muted-foreground text-sm">
                    Configure Google Maps API key
                </p>
            </div>
        )
    }

    return (
        <APIProvider apiKey={apiKey}>
            {children}
        </APIProvider>
    )
}
