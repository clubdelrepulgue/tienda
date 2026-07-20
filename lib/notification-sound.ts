// Two-tone chime for new-order alerts, synthesized via Web Audio so no
// audio asset is needed. Mobile browsers (notably iOS Safari) suspend
// AudioContext until it's created/resumed from within a user gesture, so
// callers must call unlockAudio() from a click/touch handler before any
// later programmatic playChime() call will actually produce sound.

let audioCtx: AudioContext | null = null

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
    if (!audioCtx) return
    if (audioCtx.state === "suspended") audioCtx.resume()

    const now = audioCtx.currentTime
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

    if (navigator.vibrate) {
        try {
            navigator.vibrate([120, 60, 120])
        } catch {}
    }
}
