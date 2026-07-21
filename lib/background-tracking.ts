// Register and communicate with the Service Worker for background location tracking + Realtime.

let swRegistration: ServiceWorkerRegistration | null = null

export async function registerBackgroundTracking() {
    if (!('serviceWorker' in navigator)) return

    try {
        swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        console.log('[Background Tracking] Service Worker registered')

        // Listen for messages from the SW (e.g., new order events)
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', handleSWMessage)
        }
    } catch (err) {
        console.error('[Background Tracking] Service Worker registration failed:', err)
    }
}

export function startBackgroundTracking(driverId: string) {
    if (!swRegistration?.active) return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    swRegistration.active.postMessage({
        type: 'START_TRACKING',
        driverId,
        supabaseUrl,
        supabaseKey,
        isActive: true,
    })

    console.log(`[Background Tracking] Started for driver ${driverId}`)
}

export function stopBackgroundTracking() {
    if (!swRegistration?.active) return

    swRegistration.active.postMessage({ type: 'STOP_TRACKING' })
    console.log('[Background Tracking] Stopped')
}

export function notifyAppState(isActive: boolean, driverId: string) {
    if (!swRegistration?.active) return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    swRegistration.active.postMessage({
        type: 'APP_STATE_CHANGED',
        isActive,
        driverId,
        supabaseUrl,
        supabaseKey,
    })

    console.log(`[Background Tracking] App state: ${isActive ? 'active' : 'inactive'}`)
}

function handleSWMessage(event: MessageEvent) {
    const { type, order } = event.data

    if (type === 'NEW_ORDER_EVENT') {
        // This can be used to trigger additional UI updates if needed
        console.log('[SW Message] New order event:', order)
        // You can dispatch a custom event here that the dashboard listens to
        window.dispatchEvent(new CustomEvent('sw-new-order', { detail: order }))
    }
}
