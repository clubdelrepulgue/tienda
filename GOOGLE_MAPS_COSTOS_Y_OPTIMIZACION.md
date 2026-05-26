# Google Maps: costos y optimizacion

Fecha de referencia: 2026-05-25.

Fuentes oficiales usadas:

- Pricing global: https://developers.google.com/maps/billing-and-pricing/pricing
- Detalle de SKUs: https://developers.google.com/maps/billing-and-pricing/sku-details
- Maps JavaScript API billing: https://developers.google.com/maps/documentation/javascript/usage-and-billing
- Geocoding API billing: https://developers.google.com/maps/documentation/geocoding/usage-and-billing
- Geolocation API billing: https://developers.google.com/maps/documentation/geolocation/usage-and-billing
- Pricing overview: https://developers.google.com/maps/billing-and-pricing/overview

## Resumen ejecutivo

Si queremos bajar costos, no conviene eliminar Google Maps por completo. Conviene separar:

1. Uso necesario: mostrar mapa en checkout/admin/driver y geocodificar cuando el usuario busca una direccion.
2. Uso opcional: reverse geocoding automatico al hacer click en el mapa, rutas recalculadas cada pocos segundos, Google Geolocation API como fallback de GPS.
3. Uso evitable: Directions API legacy fallando como fallback, requests repetidos de ruta para coordenadas casi iguales.

Cambios aplicados en el codigo:

- Checkout ya no usa `/api/admin` para zonas/sucursales. Usa `/api/checkout-data`, publico y limitado.
- El selector de direccion ya no hace reverse geocoding automatico al click/GPS por defecto.
- El GPS usa `navigator.geolocation`, que no factura a Google Maps.
- Google Geolocation API fallback quedo desactivado por defecto.
- Las rutas del tracking tienen cache de 60 segundos por origen/destino aproximado.
- El fallback a Directions API legacy quedo desactivado por defecto con `GOOGLE_MAPS_ENABLE_LEGACY_DIRECTIONS`.

## APIs/SKUs que estamos usando

### Maps JavaScript API

SKU principal: `Dynamic Maps`.

Se dispara cuando se carga un mapa interactivo con Maps JavaScript API. En este proyecto ocurre en:

- Checkout: selector de direccion.
- Admin sucursales/zonas.
- Tracking de pedido.
- Dashboard de driver cuando abre ruta.

Precio oficial global, por 1.000 eventos:

| SKU | Gratis mensual | 0-100k | 100k-500k | 500k-1M | 1M-5M | 5M+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dynamic Maps | 10.000 | USD 7.00 | USD 5.60 | USD 4.20 | USD 2.10 | USD 0.53 |

Notas:

- Google factura por carga exitosa de mapa, no por cada pan/zoom normal.
- Si una pantalla monta varios mapas, puede contar mas de una carga.
- La mayor optimizacion aca es no montar el mapa hasta que haga falta.

### Geocoding API

SKU: `Geocoding`.

Se dispara cuando convertimos texto a coordenadas o coordenadas a direccion. En este proyecto:

- Checkout: al buscar una direccion escrita.
- Admin sucursales: al buscar direccion de sucursal.
- Antes tambien se disparaba al hacer click/GPS para obtener direccion inversa; eso quedo apagado por defecto.

Precio oficial global, por 1.000 eventos:

| SKU | Gratis mensual | 0-100k | 100k-500k | 500k-1M | 1M-5M | 5M+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Geocoding | 10.000 | USD 5.00 | USD 4.00 | USD 3.00 | USD 1.50 | USD 0.38 |

Notas:

- Google indica que Geocoding se cobra por request.
- Hay limite de queries por minuto. La documentacion oficial menciona 3.000 QPM sumando cliente y servidor.
- Para checkout conviene geocodificar solo cuando el usuario presiona buscar/enter, no en cada tecla.

### Routes API

SKU usado si Routes API responde: `Routes: Compute Routes Essentials`.

Se dispara desde `/api/directions` para calcular distancia, duracion y polyline.

Precio oficial global, por 1.000 eventos:

| SKU | Gratis mensual | 0-100k | 100k-500k | 500k-1M | 1M-5M | 5M+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Routes: Compute Routes Essentials | 10.000 | USD 5.00 | USD 4.00 | USD 3.00 | USD 1.50 | USD 0.38 |

Notas:

- Antes el tracking podia pedir ruta cada vez que llegaba ubicacion del driver.
- Ahora se cachea 60 segundos por coordenada redondeada a 4 decimales.
- Si Routes no responde, el cliente usa distancia Haversine aproximada sin seguir pegandole a Directions legacy.

### Directions API legacy

SKU legacy: `Directions`.

Precio oficial global, por 1.000 eventos:

| SKU | Gratis mensual | 0-100k | 100k+ |
| --- | ---: | ---: | ---: |
| Directions legacy | 10.000 | USD 5.00 | USD 4.00 |

Estado recomendado en este proyecto:

- No usar por defecto.
- Mantener apagado salvo necesidad puntual: `GOOGLE_MAPS_ENABLE_LEGACY_DIRECTIONS=false`.
- Tu captura mostraba `Directions API` con 100% de errores, lo que sugiere fallback inutil o configuracion/API no habilitada.

### Geolocation API de Google

SKU: `Geolocation`.

Precio oficial global, por 1.000 eventos:

| SKU | Gratis mensual | 0-100k | 100k-500k | 500k-1M | 1M-5M | 5M+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Geolocation | 10.000 | USD 5.00 | USD 4.00 | USD 3.00 | USD 1.50 | USD 0.38 |

Estado recomendado:

- Evitar en este proyecto.
- Usar `navigator.geolocation` del navegador para driver/cliente; no factura a Google Maps.
- El fallback a Google Geolocation quedo desactivado por defecto.

## Estimacion con la captura

La captura muestra:

| API | Requests | Error |
| --- | ---: | ---: |
| Maps JavaScript API | 54 | 0% |
| Directions API | 52 | 100% |
| Geocoding API | 30 | 0% |

Lectura:

- 54 cargas de mapa es razonable en desarrollo si se entra muchas veces a checkout/admin/driver.
- 52 Directions con 100% error no aporta valor. Conviene eliminar ese fallback o habilitar/configurar correctamente Routes API.
- 30 Geocoding en pruebas puede bajar bastante si no hacemos reverse geocoding automatico.

Con los cambios aplicados, el patron esperado deberia ser:

- Maps JavaScript API: baja solo si evitamos montar mapas de entrada.
- Directions API legacy: deberia caer a 0 salvo que actives el env `GOOGLE_MAPS_ENABLE_LEGACY_DIRECTIONS=true`.
- Geocoding API: deberia ocurrir solo cuando alguien busca direccion o admin geolocaliza una sucursal.
- Routes API: deberia tener menos llamadas por cache/throttle.

## Recomendaciones de producto

### Checkout

Mantener mapa visible, pero:

- No usar reverse geocoding al click.
- No pedir GPS automaticamente al entrar.
- Pedir GPS solo cuando el usuario toca el boton de ubicacion.
- Geocodificar solo al presionar buscar/enter.
- Guardar coordenadas y direccion en la orden para no recalcular despues.

### Driver

Mantener `navigator.geolocation` cada 10 segundos para tracking propio.

Para rutas:

- Recalcular ruta cada 60 segundos como maximo.
- Recalcular antes si el driver se movio mas de 150-300 metros.
- Mientras tanto, mostrar distancia aproximada o la ultima ruta.
- Usar el boton "Navegar" para abrir Google Maps externo; eso no deberia facturarse como Directions API de tu proyecto.

### Admin

Admin puede usar mas APIs porque tiene poco trafico:

- Buscar direccion de sucursal con Geocoding esta bien.
- Dibujar zonas no necesita llamadas adicionales de Google, salvo la carga del mapa.

## Recomendaciones de Google Cloud

1. Crear presupuestos y alertas.
2. Poner cuotas diarias por API:
   - Directions API legacy: 0 o muy bajo si no se usa.
   - Geolocation API: 0 o muy bajo si no se usa.
   - Geocoding API: limite acorde al trafico real.
   - Routes API: limite acorde a pedidos diarios.
3. Restringir API key por HTTP referrers:
   - Produccion: `https://tu-dominio.com/*`
   - Preview: `https://*.vercel.app/*`
   - Desarrollo: `http://localhost:3000/*`, `http://localhost:3001/*`
4. Separar keys:
   - Key publica browser: Maps JavaScript + Geocoding client-side si se mantiene.
   - Key server: Routes API/Directions, restringida por IP o server si aplica.

## Plan de mayor ahorro posible

Nivel 1, ya aplicado:

- Cache/throttle rutas.
- Apagar Directions legacy.
- Apagar Google Geolocation fallback.
- No reverse-geocode automatico al click/GPS.

Nivel 2:

- Cargar mapa del checkout solo cuando el usuario toca "Elegir en mapa".
- En mobile, mostrar primero input + boton "Usar ubicacion"; montar mapa despues.
- Usar un debounce/manual search estricto para Geocoding.

Nivel 3:

- Reemplazar mapa de checkout por mapa liviano propio con zonas SVG/canvas y usar Google solo para buscar direccion.
- Guardar cache server-side de geocoding por texto normalizado.
- Usar rutas solo para tracking de pedidos activos, nunca para pedidos ya entregados o sin driver.

