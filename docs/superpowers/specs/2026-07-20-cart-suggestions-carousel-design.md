# Diseño: carrusel de sugerencias en el carrito

## Objetivo

Mostrar las sugerencias de productos configuradas desde administración dentro del carrito como un carrusel horizontal, permitiendo agregarlas rápidamente y respetando el descuento de la regla.

## Comportamiento

- Las sugerencias se calculan a partir de las reglas activas de la sucursal actual.
- Una regla se activa cuando algún producto o categoría del carrito coincide con sus disparadores.
- Se muestran hasta tres productos sugeridos únicos.
- Los productos con variantes activas no se agregan directamente; se excluyen del carrusel para evitar agregar una opción incompleta.
- Cada tarjeta muestra imagen, nombre, precio final, precio original tachado cuando hay descuento y botón “Agregar”.
- El carrusel se puede deslizar en móvil y tiene controles de flecha en desktop.
- Luego de agregar una sugerencia, el estado del carrito se actualiza y esa sugerencia deja de mostrarse si ya está agregada.
- Si la regla no tiene disparadores, se tratará como una regla general para carritos con al menos un producto de la misma sucursal. Esto permite que las reglas existentes sigan funcionando.

## Cambios de administración

El formulario de reglas incorporará selección de:

- Productos disparadores.
- Categorías disparadoras.
- Productos sugeridos.

Se mantendrá la validación existente para que todos los productos y categorías pertenezcan a la sucursal seleccionada.

## Arquitectura y flujo de datos

1. La página del menú obtiene productos y reglas activas de la sucursal.
2. `StorefrontShell` pasa esos datos a `CartSheet`.
3. `CartSheet` deriva las sugerencias usando los productos y categorías presentes en el carrito.
4. Un componente visual de carrusel renderiza las sugerencias y comunica el producto seleccionado.
5. La acción de agregar usa el store del carrito con el precio descontado de la regla.

La lógica de selección seguirá en el carrito; el carrusel solo será responsable de presentación y navegación, para mantener separadas las responsabilidades.

## Estados y errores

- Sin sugerencias: no se renderiza la sección.
- Producto inactivo o inexistente: se descarta.
- Producto con variantes activas: se descarta del agregado rápido.
- Error de sucursal al agregar: se muestra el error existente mediante toast.
- Regla sin disparadores: se considera general, limitada a productos de la sucursal actual.

## Verificación

- Configurar una regla “Agregar bebida” con productos sugeridos y un producto/categoría disparadora.
- Agregar el disparador al carrito y comprobar que aparece el carrusel.
- Navegar por las tarjetas en móvil y desktop.
- Agregar una bebida y verificar precio descontado, subtotal y desaparición de la sugerencia repetida.
- Comprobar que una regla sin disparadores también aparece con un carrito no vacío.
- Ejecutar lint y build.
