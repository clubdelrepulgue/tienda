# Diseño: PWA con experiencia offline para clientes y repartidores

## Objetivo

Convertir El Club del Repulgue en una aplicación web instalable para todas sus áreas. La experiencia offline avanzada se limita al menú y carrito del cliente y a la consulta de la última asignación del repartidor. Las operaciones que modifican el estado del negocio continúan requiriendo conexión.

## Alcance

### Toda la plataforma

- La aplicación se puede instalar desde navegadores compatibles y se abre en modo `standalone`.
- El manifiesto declara nombre, nombre corto, colores, URL inicial e iconos de 192 y 512 píxeles, incluyendo un icono `maskable`.
- Un indicador global informa si el dispositivo está sin conexión y avisa cuando la conexión vuelve.
- Administración, cocina, POS y despacho no reutilizan datos operativos desde caché. Si se abren sin conexión, muestran una pantalla offline clara.

### Experiencia del cliente

- Se conservan la estructura de la aplicación, el último menú visitado y las imágenes necesarias para volver a verlo sin conexión.
- El carrito, perfil del cliente y borrador de checkout siguen persistiendo localmente con sus vencimientos actuales.
- Sin conexión, el cliente puede consultar el último menú disponible y agregar, quitar o modificar productos en el carrito.
- El checkout puede abrirse con el borrador guardado, pero no permite confirmar el pedido sin conexión.
- Al recuperar la conexión, antes de habilitar la confirmación se actualizan los datos de checkout y se vuelven a validar sucursal, disponibilidad, precios, mínimo, cupón y zona de entrega en el servidor.
- Si el menú en caché está vencido o nunca se visitó, se muestra una experiencia offline explícita; no se inventan productos ni precios.
- No se crea una cola local de pedidos ni se envían pedidos automáticamente al recuperar conexión.

### Experiencia del repartidor

- Se conserva localmente la última respuesta válida de pedidos asignados y los datos de apoyo del recorrido activo.
- Sin conexión se puede consultar número de pedido, dirección, teléfono, origen, destino, coordenadas y detalles necesarios para completar el recorrido existente.
- La vista distingue claramente los datos guardados de los datos en vivo e indica cuándo se actualizaron por última vez.
- Google Maps y sus mosaicos no se prometen como disponibles offline. Se muestra una alternativa textual con dirección y coordenadas; el enlace a navegación externa puede funcionar si el dispositivo tiene mapas descargados.
- Los cambios `en camino` y `entregado`, así como la transmisión de ubicación, requieren conexión. No se encolan para evitar estados tardíos, duplicados o inconsistentes.

## Arquitectura

### Manifiesto e instalación

Se añadirá un manifiesto mediante la convención `app/manifest.ts` de Next.js. Los iconos PWA se generarán a partir del recurso de marca disponible y se declararán también en los metadatos de la aplicación. La URL inicial será la entrada pública y el alcance cubrirá toda la aplicación.

No se añadirá una promoción de instalación personalizada en la primera versión. Se utilizará el flujo nativo del navegador para evitar una interfaz inconsistente entre Android e iOS.

### Service worker

Se usará Serwist con su integración para Next.js y un service worker TypeScript propio. El build inyectará una lista versionada de recursos estáticos y limpiará versiones antiguas al activar una actualización.

Las estrategias se separarán por tipo de recurso:

- Recursos compilados y estáticos con hash: precaché versionada.
- Imágenes públicas y de productos: `CacheFirst` con límite de entradas y vencimiento.
- Navegaciones públicas de cliente: red primero con fallback a la última respuesta compatible o a una página offline.
- Datos del menú público: red primero con timeout y fallback a la última respuesta válida.
- APIs y páginas autenticadas u operativas: solo red, sin almacenamiento de respuestas sensibles en Cache Storage.
- Mutaciones, Server Actions y solicitudes distintas de `GET`: siempre red, nunca interceptadas para reintento.

Las claves de caché incluirán una versión controlada. La activación de un worker nuevo eliminará únicamente cachés PWA antiguas de esta aplicación.

### Persistencia de datos

El estado actual de Zustand continuará almacenando carrito, perfil y checkout en `localStorage`; no se migrará sin necesidad. Los snapshots estructurados del menú y del repartidor se guardarán en IndexedDB porque pueden crecer y necesitan metadatos de versión y fecha.

Los repositorios locales expondrán interfaces separadas:

- `menuSnapshot`: lectura, escritura y expiración del último menú por sucursal.
- `driverSnapshot`: lectura, escritura y limpieza de la última asignación por repartidor.
- `connectivity`: estado observable de conexión y señal de revalidación.

Los componentes consumirán estas interfaces sin conocer los detalles de IndexedDB ni del service worker.

## Flujo de datos

### Cliente conectado

1. Se solicita el menú al servidor.
2. Una respuesta válida actualiza la pantalla y el snapshot local de esa sucursal.
3. El carrito se modifica mediante el store existente.
4. Al entrar al checkout se cargan datos actuales de sucursal, zonas, disponibilidad y cupones.
5. Al confirmar, el servidor vuelve a validar el pedido y recién entonces se limpia el carrito.

### Cliente sin conexión

1. La aplicación carga el shell disponible y el snapshot del último menú visitado.
2. La interfaz muestra que el contenido puede estar desactualizado y la fecha de la última actualización.
3. El cliente puede editar el carrito y el borrador.
4. La acción de confirmar permanece deshabilitada y explica que requiere internet.
5. Cuando vuelve la conexión, el checkout revalida sus datos; cualquier diferencia se comunica antes de permitir confirmar.

### Repartidor

1. Una carga válida de pedidos actualiza el snapshot asociado al `driverId`.
2. Si falla la red, el dashboard usa el snapshot y muestra su antigüedad.
3. El recorrido activo conserva dirección, teléfono, coordenadas y ubicación de la sucursal.
4. Las acciones y la ubicación se bloquean o quedan en estado de espera visual mientras no haya conexión, sin crear una cola de mutaciones.

## Interfaz y estados de error

- Una banda discreta y persistente indica `Sin conexión`; al reconectar muestra `Conexión restablecida` y dispara revalidación.
- El contenido recuperado localmente incluye `Última actualización: ...`.
- El botón principal del checkout queda deshabilitado offline y muestra `Necesitás conexión para confirmar el pedido`.
- Los errores de red no se presentan como carritos vacíos ni como ausencia de pedidos; se diferencia entre datos no disponibles y listas realmente vacías.
- Si IndexedDB no está disponible, la aplicación conserva la experiencia online y muestra el fallback offline general sin romper la navegación.
- Al instalar una versión nueva, el worker la activa de forma controlada y la interfaz evita recargas mientras se envía un pedido.

## Seguridad y consistencia

- No se cachean respuestas autenticadas de administración ni datos privados compartibles entre usuarios.
- El snapshot del repartidor se separa por identificador y se elimina al cerrar sesión.
- Cerrar sesión también elimina cualquier información local del recorrido del repartidor.
- El servidor sigue siendo la única autoridad sobre precios, disponibilidad, cupones, zonas, totales y estados de pedido.
- El estado `navigator.onLine` se usa solo como señal de interfaz; una comprobación real de red y la validación del servidor determinan si puede confirmarse un pedido.

## Pruebas y criterios de aceptación

### Instalación

- El manifiesto es válido y Lighthouse reconoce la aplicación como instalable en HTTPS.
- Los iconos normales y `maskable` se visualizan correctamente.
- La aplicación instalada abre en modo independiente y dentro del alcance esperado.

### Cliente

- Tras visitar un menú conectado, ese menú vuelve a abrir sin conexión y permite editar el carrito.
- Un primer acceso sin caché muestra la página offline, no un error técnico.
- El checkout nunca envía ni encola pedidos sin conexión.
- Al reconectar, el checkout revalida datos antes de habilitar la confirmación.
- Una actualización de la app no borra el carrito válido.

### Repartidor

- Tras cargar una asignación conectado, el último recorrido sigue visible sin conexión.
- Se muestra la antigüedad de los datos y una alternativa textual cuando el mapa no carga.
- Las acciones de estado y el envío de ubicación no se encolan offline.
- Cerrar sesión elimina el snapshot local del repartidor.

### Resto de la plataforma

- Administración, cocina, POS y despacho muestran el fallback offline y no presentan datos operativos cacheados como actuales.
- Las solicitudes de escritura nunca son respondidas desde caché.

## Fuera de alcance

- Confirmar o sincronizar pedidos de clientes creados offline.
- Cachear mosaicos o instrucciones paso a paso de Google Maps.
- Encolar estados o ubicaciones del repartidor.
- Notificaciones push.
- Un botón o banner personalizado de instalación.
- Soporte offline operativo para administración, cocina, POS o despacho.

