let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioCtx
}

function scheduleBeep(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.05)
}

export async function playNewOrderSound() {
  try {
    const ctx = getCtx()
    if (ctx.state === "suspended") await ctx.resume()
    const now = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      scheduleBeep(ctx, 880, now + i * 0.32, 0.25, 1.0, "square")
    }
  } catch { /* autoplay blocked */ }
}

export async function playOrderReadySound() {
  try {
    const ctx = getCtx()
    if (ctx.state === "suspended") await ctx.resume()
    const now = ctx.currentTime
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      scheduleBeep(ctx, freq, now + i * 0.2, 0.4, 0.9, "sine")
    })
  } catch { /* autoplay blocked */ }
}

export function unlockAudio() {
  try {
    getCtx().resume().catch(() => {})
  } catch { /* not yet created */ }
}
