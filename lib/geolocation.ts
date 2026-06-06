/**
 * Geolocalización robusta.
 *
 * El error `kCLErrorLocationUnknown` (CoreLocation, macOS/iOS) se propaga al
 * navegador como `GeolocationPositionError code 2` (POSITION_UNAVAILABLE).
 * Ocurre típicamente cuando se pide `enableHighAccuracy: true` y el dispositivo
 * no tiene fix de GPS: escritorio sin GPS, interiores, primer intento "frío", etc.
 *
 * La solución: intentar primero alta precisión y, si falla con POSITION_UNAVAILABLE
 * o TIMEOUT, reintentar con baja precisión (usa WiFi/red/IP, mucho más confiable).
 */

export interface GeolocateOptions {
    /** Timeout para el intento de alta precisión (ms). */
    highAccuracyTimeout?: number
    /** Timeout para el reintento de baja precisión (ms). */
    lowAccuracyTimeout?: number
    /** Antigüedad máxima aceptable de una posición cacheada (ms). */
    maximumAge?: number
}

/**
 * Obtiene la posición actual con reintento automático en baja precisión.
 * Devuelve una Promise para poder usar async/await y manejar el error en un solo lugar.
 */
export function getCurrentPositionWithFallback(
    options: GeolocateOptions = {}
): Promise<GeolocationPosition> {
    const {
        highAccuracyTimeout = 10000,
        lowAccuracyTimeout = 12000,
        maximumAge = 30000,
    } = options

    return new Promise((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            reject(makeError(2, "Geolocation no soportada"))
            return
        }

        const tryLowAccuracy = (prevError: GeolocationPositionError) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                // Si la baja precisión también falla, devolvemos el error más informativo.
                (err) => reject(err.code === 1 ? err : prevError),
                {
                    enableHighAccuracy: false,
                    timeout: lowAccuracyTimeout,
                    maximumAge,
                }
            )
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => {
                // PERMISSION_DENIED (1): no tiene sentido reintentar, falla de inmediato.
                if (error.code === 1) {
                    reject(error)
                    return
                }
                // POSITION_UNAVAILABLE (2) o TIMEOUT (3): reintentamos con baja precisión.
                tryLowAccuracy(error)
            },
            {
                enableHighAccuracy: true,
                timeout: highAccuracyTimeout,
                maximumAge,
            }
        )
    })
}

/** Mensaje legible para el usuario según el código de error. */
export function geolocationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
        case 1:
            return "El navegador no tiene permiso para usar tu ubicación. Habilitalo en la barra de dirección."
        case 3:
            return "La búsqueda de ubicación tardó demasiado. Probá de nuevo o buscá la dirección manualmente."
        case 2:
        default:
            return "No se pudo obtener tu ubicación (sin señal GPS). Probá buscar la dirección o mover el pin."
    }
}

function makeError(code: number, message: string): GeolocationPositionError {
    return {
        code,
        message,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
    } as GeolocationPositionError
}
