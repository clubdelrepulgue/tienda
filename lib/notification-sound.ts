let audioCtx: AudioContext | null = null
let notificationPermission: NotificationPermission = "default"

export async function requestNotificationPermission() {
    if (!("Notification" in window)) return
    if (Notification.permission === "granted") {
        notificationPermission = "granted"
        return
    }
    if (Notification.permission === "denied") {
        notificationPermission = "denied"
        return
    }
    try {
        const permission = await Notification.requestPermission()
        notificationPermission = permission
    } catch {}
}

export function unlockAudio() {
    if (audioCtx) {
        if (audioCtx.state === "suspended") audioCtx.resume()
        return
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    audioCtx = new Ctx()
}

export function playChime() {
    const now = audioCtx?.currentTime ?? 0

    // Try Web Audio API first (works when tab is active)
    if (audioCtx) {
        if (audioCtx.state === "suspended") audioCtx.resume()

        const notes = [880, 1318.5] // A5 -> E6
        notes.forEach((freq, i) => {
            const offset = i * 0.16
            const osc = audioCtx!.createOscillator()
            const gain = audioCtx!.createGain()

            osc.type = "sine"
            osc.frequency.value = freq

            gain.gain.setValueAtTime(0.0001, now + offset)
            gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35)

            osc.connect(gain)
            gain.connect(audioCtx!.destination)
            osc.start(now + offset)
            osc.stop(now + offset + 0.4)
        })
    }

    // Notification API fallback (works when tab is inactive or audio fails)
    if (notificationPermission === "granted" && "Notification" in window) {
        try {
            new Notification("Nuevo pedido", {
                tag: "new-order",
                requireInteraction: false,
                silent: false,
            })
        } catch {}
    }

    // Vibration as fallback
    if (navigator.vibrate) {
        try {
            navigator.vibrate([120, 60, 120])
        } catch {}
    }
}
