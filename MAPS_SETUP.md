# 🗺️ Sistema de Geolocalización y Mapas

Este documento describe la implementación del sistema de geolocalización, mapas y tracking en tiempo real para el sistema de delivery.

## Características

### 1. **Administrador - Editor de Zonas de Delivery**
- Dibuja polígonos directamente en el mapa para definir áreas de cobertura
- Asigna colores diferentes a cada zona
- Visualiza la ubicación de las sucursales
- Gestiona costos de envío por zona

### 2. **Administrador - Mapa de Repartidores en Tiempo Real**
- Visualiza todos los repartidores en un mapa
- Indicadores de disponibilidad y estado de entrega
- Información en tiempo real de ubicación
- Acceso rápido desde el menú "Live Tracking"

### 3. **Checkout - Selector de Dirección con Mapa**
- Los clientes seleccionan su ubicación exacta en el mapa
- Búsqueda de direcciones con autocompletado
- Detección automática de zona de delivery
- Validación visual de cobertura

### 4. **Tracking del Pedido - Mapa en Vivo**
- El cliente ve la ubicación del repartidor en tiempo real
- Estimación de distancia y tiempo de llegada
- Actualizaciones automáticas cada 10 segundos
- Indicador visual en vivo (pulsing marker)

### 5. **Driver App - Ubicación y Navegación**
- Envío automático de ubicación GPS cada 10 segundos
- Mapa con ruta al destino
- Botón de navegación integrado con Google Maps
- Indicador de estado GPS activo

## Configuración

### 1. Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita las siguientes APIs:
   - ✅ **Maps JavaScript API** (obligatoria)
   - ✅ **Places API** (para búsqueda de direcciones)
   - ✅ **Geocoding API** (para convertir direcciones a coordenadas)

### 2. Obtener API Key

1. Ve a "Credentials" en el menú lateral
2. Clic en "Create Credentials" → "API Key"
3. Copia la API key generada
4. En **Application restrictions** selecciona **HTTP referrers (websites)**
5. Agrega tu dominio:
   ```
   https://tu-dominio.com/*
   https://*.vercel.app/*     (para previews)
   http://localhost:3000/*    (para desarrollo)
   ```

### 3. Configurar Variables de Entorno

Agrega a tu archivo `.env`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

### 4. Configurar Map ID (Opcional pero Recomendado)

Para usar **Advanced Markers** (mejor rendimiento y estilos):

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → **Map Management**
2. Clic en **Create Map ID**
3. Selecciona **JavaScript** como plataforma
4. Copia el Map ID generado
5. Agrega a tu `.env`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_ID=tu_map_id_aqui
```

> **Nota**: Si no configuras un Map ID, la aplicación funcionará perfectamente usando marcadores tradicionales. El Map ID solo habilita los "Advanced Markers" que tienen mejor rendimiento y animaciones más suaves.

### 5. Habilitar Facturación

Google Maps requiere tener una cuenta de facturación configurada (tienes **$200 créditos gratis mensuales**).

---

## Migraciones de Base de Datos

Ejecuta el script de migración en Supabase:

```bash
scripts/006_geolocation_and_maps.sql
```

Esta migración agrega:
- Coordenadas a las sucursales (`lat`, `lng`, `coverage_radius_km`)
- Coordenadas a los pedidos (`address_lat`, `address_lng`, `address_formatted`)
- Nueva tabla `driver_location_history` con tracking histórico
- Funciones SQL para búsqueda de zonas por coordenadas
- Realtime habilitado para tracking en vivo

---

## Estructura de Componentes

```
components/maps/
├── google-maps-provider.tsx    # Provider de Google Maps
├── map-view.tsx                 # Vista de mapa básica (soporta con/sin Map ID)
├── polygon.tsx                  # Componente de polígono
├── zone-editor.tsx              # Editor de zonas de delivery
├── address-selector.tsx         # Selector de dirección
├── live-tracking-map.tsx        # Mapa de tracking en vivo
├── drivers-overview-map.tsx     # Vista general de repartidores
└── index.ts                     # Exports
```

---

## Uso de Componentes

### Editor de Zonas

```tsx
import { ZoneEditor, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <ZoneEditor
    initialCoordinates={zone.coordinates}
    center={{ lat: -34.6037, lng: -58.3816 }}
    branchMarker={{ lat: -34.6037, lng: -58.3816, title: "Sucursal" }}
    zoneColor="#3b82f6"
    onChange={(coordinates) => setCoordinates(coordinates)}
    height="400px"
  />
</GoogleMapsProvider>
```

### Selector de Dirección

```tsx
import { AddressSelector, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <AddressSelector
    value={selectedLocation}
    onChange={setSelectedLocation}
    zones={deliveryZones}
    height="300px"
  />
</GoogleMapsProvider>
```

### Tracking en Vivo

```tsx
import { LiveTrackingMap, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <LiveTrackingMap
    orderId={order.id}
    driverId={order.driverId}
    destination={{ lat, lng, address }}
    branchLocation={{ lat, lng }}
    height="350px"
  />
</GoogleMapsProvider>
```

### Vista General de Repartidores

```tsx
import { DriversOverviewMap, GoogleMapsProvider } from "@/components/maps"

<GoogleMapsProvider>
  <DriversOverviewMap height="600px" />
</GoogleMapsProvider>
```

---

## Hook de Ubicación del Driver

```tsx
import { useDriverLocation } from "@/hooks/use-driver-location"

const { isTracking, lastLocation, error } = useDriverLocation({
  driverId: "uuid-del-driver",
  enabled: true,
  interval: 10000, // 10 segundos
  onError: (err) => console.error(err),
})
```

---

## APIs Adicionales

### Actualizar Ubicación del Driver

```typescript
import { updateDriverLocation } from "@/app/actions"

await updateDriverLocation(driverId, lat, lng)
```

### Buscar Zona por Coordenadas

```sql
-- Función SQL disponible en Supabase
SELECT * FROM find_zone_by_coordinates(-34.6037, -58.3816, branch_id)
```

---

## Consideraciones de Rendimiento

### 1. **Rate Limits de Google Maps**

Google Maps API tiene límites de uso gratuito:
- **28,500 cargas de mapa por mes** (gratis)
- Límites adicionales para Places y Geocoding

### 2. **Optimización de Costos**

- **Con Map ID**: Mejor rendimiento, caché de marcadores, menos llamadas a API
- **Sin Map ID**: Funciona igual, solo que con marcadores tradicionales

### 3. **Seguridad**

- ✅ Restringe la API key por dominio en Google Cloud Console
- ✅ Nunca expongas la API key en el servidor
- ✅ Usa variables de entorno

---

## Solución de Problemas

### ❌ "The map is initialized without a valid Map ID"

**Solución**: Este es solo un warning. El mapa funciona igual usando marcadores tradicionales. Para eliminarlo:
1. Crea un Map ID en Google Cloud Console
2. Agrega `NEXT_PUBLIC_GOOGLE_MAPS_ID=tu_id` a tu `.env`

### ❌ "Google Maps JavaScript API error: RefererNotAllowedMapError"

**Solución**: Tu dominio no está autorizado. En Google Cloud Console:
1. Ve a Credentials → Tu API Key
2. En "HTTP referrers" agrega: `https://tu-dominio.com/*`

### ❌ "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT"

**Solución**: Tienes un ad blocker (uBlock, AdBlock, etc.) activado. Desactívalo para tu sitio o ignora el error (no afecta el funcionamiento).

### ❌ El mapa no carga

1. Verifica que la API key esté configurada en Vercel (Environment Variables)
2. Asegúrate de que las APIs necesarias estén habilitadas
3. Revisa que la facturación esté activada en Google Cloud

### ❌ Ubicación no disponible

- El usuario debe permitir acceso a la ubicación
- En desarrollo local, usa HTTPS o localhost
- Algunos navegadores bloquean geolocalización en HTTP

### ❌ Zonas no detectadas

- Verifica que las coordenadas del polígono sean correctas
- El algoritmo point-in-polygon requiere al menos 3 puntos
- Considera usar PostGIS para cálculos más precisos

---

## Map ID vs Sin Map ID

| Característica | Con Map ID | Sin Map ID |
|---------------|------------|------------|
| Marcadores | Advanced Markers | Tradicionales |
| Rendimiento | Mejor | Bueno |
| Animaciones | Más suaves | Estándar |
| Estilos personalizados | ✅ Sí | ❌ No |
| Costo | Menor | Estándar |
| Funcionalidad | Completa | Completa |

> **Recomendación**: Empieza sin Map ID para probar. Cuando todo funcione, crea un Map ID para optimizar.

---

## Mejoras Futuras

- [ ] Integración con rutas de Google Directions API
- [ ] Cálculo de tiempo estimado con tráfico real
- [ ] Notificaciones push cuando el repartidor esté cerca
- [ ] Historial de rutas de repartidores
- [ ] Análisis de zonas más rentables
- [ ] Optimización automática de zonas basada en pedidos
