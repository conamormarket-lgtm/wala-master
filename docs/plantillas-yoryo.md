# Cuadros, mousepads y tomatodos en Crear

Desde el 28-10-2026 se diseñan en el mismo estudio que las prendas (`/crear/:id`). El personalizador aparte de octubre (plantillas por formulario, `/admin/plantillas-yoryo` como editor) se quitó.

## Cómo se arma un producto

En **Admin → Prendas de Crear**:

1. Crear la prenda: nombre, precio y sus colores (variantes, sin tallas).
2. En **Qué se personaliza**:
   - **Tipo: Producto.** El estudio y la grilla dicen "producto" en vez de "prenda".
   - **Técnica: Grabado láser** solo para el tomatodo. El diseño se ve en un solo tono y el taller recibe el PNG en escala de grises.
3. Subir la foto de cada color en **Colores y tallas**. Un producto no se tiñe bien.
4. Marcar la zona y la línea de referencia con el ancho útil real en cm:
   - cuadro: 31 × 25 cm;
   - mousepad: 23.5 × 19.5 cm;
   - tomatodo: la medida del taller.

   Así el PNG sale a tamaño real a 300 ppp.

El **Pack de oficina** es un combo normal en **Admin → Combos de Crear**.

Para que un producto de la tienda lleve a Crear, se elige la prenda o el combo en **Personalizar en Crear**, en su ficha del admin. La tienda lo sigue vendiendo tal cual.

## Diseños para empezar

El estudio muestra los diseños de la comunidad de esa prenda en el paso **Empieza con un diseño**. El cliente elige uno y lo cambia como quiera:

- **Cambiar foto** pone la suya en el mismo lugar.
- Los textos se editan tocándolos.

Las capas marcadas como **Parte fija de la plantilla** (fondo, marco) no se mueven sin querer. El cliente las suelta con **Editar el fondo y el marco**. Solo un admin ve ese interruptor en el panel de cada capa.

Para publicar uno nuevo:

1. Diseñarlo en el estudio con la cuenta de admin.
2. Guardarlo.
3. Publicarlo desde Mis creaciones.

## Crear los productos (una sola vez)

En **Admin → Catálogo → Importar plantillas de cuadros**, el botón **Crear productos y pack**:

- crea `yoryo-crear-cuadro`, `yoryo-crear-mousepad` y `yoryo-crear-tomatodo` con la foto de la tienda sin fondo y recortada;
- crea el Pack de oficina como combo de Crear;
- enlaza los productos de la tienda con "Personalizar en Crear".

Lo que ya exista no se repite. Las zonas se midieron sobre las fotos de la tienda del 28-10-2026. El tomatodo queda con unos 10 cm de cuerpo estimados: se confirma con el taller y se ajusta en Prendas de Crear.

## Importar las plantillas anteriores (una sola vez)

**Admin → Catálogo → Importar plantillas de cuadros** (`/admin/plantillas-yoryo`) convierte las plantillas anteriores en diseños de la comunidad: 6 equipos y 3 de parejas, para el cuadro y el mousepad.

- Si se editaron en la pantalla anterior, usa esas ediciones (`templates/yoryo-composiciones-v4`).
- Sube a Storage los fondos, escudos y decoraciones de `public/yoryo/capas/` y una foto de muestra ("Tu foto").
- Guarda cada diseño en la cuenta del admin y lo publica.

El tamaño de las letras es aproximado y conviene revisarlo en el estudio.

Después de importar, `public/yoryo/` y la carpeta `src/pages/admin/plantillasYoryo/` se pueden borrar. Los originales siguen en `assets/yoryo-plantillas/`.

## Lo ya guardado con el editor anterior

- **Carrito:** las líneas con `datosYoryo` piden volver a crearlas en Crear y no dejan pagar.
- **Pedidos hechos:** conservan sus archivos (`designs.js` → `urlsDeDiseno` los protege de la limpieza).
