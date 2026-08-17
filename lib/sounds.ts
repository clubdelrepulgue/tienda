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

/**
 * Firmas sonoras. Cada panel/sucursal recibe una distinta y estable, para que
 * dos pantallas sonando en el mismo local se distingan de oido.
 * La clave (`soundKey`) es tipicamente `"<panel>:<sucursalId>"`.
 */
const NEW_ORDER_PATTERNS: number[][] = [
  [880],              // A5 plano (patron historico)
  [660, 990],         // ascendente
  [1175, 784],        // descendente
  [740, 740, 988],    // doble + remate agudo
  [523, 784],         // quinta grave
  [988, 1319],        // agudo ascendente
  [880, 660, 880],    // vaiven
  [1047, 784, 1047],  // campana
]

const READY_ROOTS = [523, 587, 659, 698, 784, 831, 880, 932]

function variantIndex(key: string | undefined, total: number): number {
  if (!key) return 0
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash % total
}

export async function playNewOrderSound(soundKey?: string) {
  try {
    const ctx = getCtx()
    if (ctx.state === "suspended") await ctx.resume()
    const now = ctx.currentTime
    const pattern = NEW_ORDER_PATTERNS[variantIndex(soundKey, NEW_ORDER_PATTERNS.length)]
    // Sonido persistente y fuerte: 6 beeps con volumen maximo, siguiendo el
    // patron de frecuencias propio de este panel/sucursal.
    for (let i = 0; i < 6; i++) {
      scheduleBeep(ctx, pattern[i % pattern.length], now + i * 0.25, 0.4, 1.0, "square")
    }
  } catch { /* autoplay blocked */ }
}

export async function playOrderReadySound(soundKey?: string) {
  try {
    const ctx = getCtx()
    if (ctx.state === "suspended") await ctx.resume()
    const now = ctx.currentTime
    const root = READY_ROOTS[variantIndex(soundKey, READY_ROOTS.length)]
    const notes = [root, root * 1.26, root * 1.5, root * 2]
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
