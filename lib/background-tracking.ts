// Register and communicate with the Service Worker for background location tracking.

let swRegistration: ServiceWorkerRegistration | null = null

export async function registerBackgroundTracking() {
    if (!('serviceWorker' in navigator)) return

    try {
        swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        console.log('[Background Tracking] Service Worker registered')
    } catch (err) {
        console.error('[Background Tracking] Service Worker registration failed:', err)
    }
}

export function startBackgroundTracking(driverId: string) {
    if (!swRegistration?.active) return

    swRegistration.active.postMessage({
        type: 'START_TRACKING',
        driverId,
    })

    console.log(`[Background Tracking] Started for driver ${driverId}`)
}

export function stopBackgroundTracking() {
    if (!swRegistration?.active) return

    swRegistration.active.postMessage({ type: 'STOP_TRACKING' })
    console.log('[Background Tracking] Stopped')
}

export function setBackgroundTrackingDriver(driverId: string) {
    if (!swRegistration?.active) return

    swRegistration.active.postMessage({
        type: 'SET_DRIVER_ID',
        driverId,
    })
}
