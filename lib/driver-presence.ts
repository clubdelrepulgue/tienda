/**
 * Estado de conexión del repartidor.
 *
 * Antes el panel usaba `is_available` para esto, pero ese flag solo significa
 * ocupado/libre: lo pone en false `assignDriver` y en true `releaseDriverIfIdle`.
 * Un repartidor con el celular apagado seguía figurando como "Disponible" y
 * aparecía en la hoja de asignación.
 *
 * La verdad sobre "está conectado" son dos cosas distintas:
 *   - `isOnShift`: decisión explícita del repartidor (entró en turno).
 *   - `lastSeenAt`: prueba de vida, la escribe cada ping del GPS.
 *
 * Un repartidor en turno pero sin pings hace 2 minutos NO es asignable, aunque
 * el flag de turno diga que sí.
 */

/** Ping más reciente que esto ⇒ lo estamos viendo moverse ahora. */
export const LIVE_THRESHOLD_MS = 45_000
/** Todavía utilizable, pero la posición ya no es de fiar al metro. */
export const WEAK_THRESHOLD_MS = 3 * 60_000
/** Más viejo que esto ⇒ lo tratamos como desconectado. */
export const OFFLINE_THRESHOLD_MS = 10 * 60_000

export type PresenceLevel = "live" | "weak" | "stale" | "offline" | "off_shift"

export interface DriverPresence {
    level: PresenceLevel
    /** Etiqueta corta para badges. */
    label: string
    /** true si se le puede asignar un pedido con confianza. */
    assignable: boolean
    /** Milisegundos desde el último ping, null si nunca reportó. */
    ageMs: number | null
    /** Clases Tailwind para el badge. */
    className: string
    /** Color sólido para el pin del mapa. */
    dotColor: string
}

interface PresenceInput {
    isActive?: boolean
    isOnShift?: boolean | null
    lastSeenAt?: string | Date | null
    /** Fallback para bases sin la migración 016: la fecha de la última posición. */
    locationUpdatedAt?: string | Date | null
}

function toMs(value: string | Date | null | undefined): number | null {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    const ms = date.getTime()
    return Number.isNaN(ms) ? null : ms
}

export function getDriverPresence(
    driver: PresenceInput,
    now: number = Date.now()
): DriverPresence {
    // Si la migración 016 todavía no corrió, `last_seen_at` no existe y caemos
    // en la fecha de la última posición: menos preciso pero no miente.
    const seenMs = toMs(driver.lastSeenAt) ?? toMs(driver.locationUpdatedAt)
    const ageMs = seenMs == null ? null : Math.max(0, now - seenMs)

    // `isOnShift` undefined = base sin migrar: no bloqueamos por turno.
    const shiftKnown = driver.isOnShift === true || driver.isOnShift === false
    const offShift = shiftKnown && driver.isOnShift === false

    if (offShift) {
        return {
            level: "off_shift",
            label: "Fuera de turno",
            assignable: false,
            ageMs,
            className: "bg-muted text-muted-foreground border-transparent",
            dotColor: "#9ca3af",
        }
    }

    if (ageMs == null || ageMs >= OFFLINE_THRESHOLD_MS) {
        return {
            level: "offline",
            label: ageMs == null ? "Sin señal" : "Desconectado",
            assignable: false,
            ageMs,
            className: "bg-red-50 text-red-600 border-red-200",
            dotColor: "#ef4444",
        }
    }

    if (ageMs < LIVE_THRESHOLD_MS) {
        return {
            level: "live",
            label: "En vivo",
            assignable: true,
            ageMs,
            className: "bg-green-50 text-green-600 border-green-200",
            dotColor: "#22c55e",
        }
    }

    if (ageMs < WEAK_THRESHOLD_MS) {
        return {
            level: "weak",
            label: "Señal débil",
            assignable: true,
            ageMs,
            className: "bg-amber-50 text-amber-600 border-amber-200",
            dotColor: "#f59e0b",
        }
    }

    return {
        level: "stale",
        label: "Sin señal reciente",
        assignable: false,
        ageMs,
        className: "bg-orange-50 text-orange-600 border-orange-200",
        dotColor: "#f97316",
    }
}

/** "hace 12 s" / "hace 4 min" / "hace 2 h" — corto, para badges. */
export function formatAge(ageMs: number | null): string {
    if (ageMs == null) return "nunca"
    const seconds = Math.round(ageMs / 1000)
    if (seconds < 10) return "ahora"
    if (seconds < 60) return `hace ${seconds} s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `hace ${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `hace ${hours} h`
    return `hace ${Math.floor(hours / 24)} d`
}
