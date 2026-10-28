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

## Plantillas del producto

Cada producto de Crear puede traer sus plantillas en `prendaBase.plantillas` (`{ id, nombre, grupo, imagen, capas }`). El estudio las muestra en el paso **Empieza con un diseño**:

- son de ese producto: no van a la comunidad ni a Mis creaciones;
- si hay grupos (Parejas, Equipos), se muestran como pestañas;
- cada tarjeta muestra el diseño plano. En un producto láser se ve sobre el producto, recortado alrededor del grabado.

El cliente elige una y la cambia como quiera:

- **Cambiar foto** pone su foto en la ventana de la plantilla. La foto tiene una `ventana`: se mueve y agranda por dentro, pero no se sale del marco (`recorteDeCapa` en `renderDiseno.js`).
- Los textos se editan tocándolos.
- Las capas marcadas como **Parte fija de la plantilla** (fondo, marco) no se mueven sin querer. El cliente las suelta con **Editar el fondo y el marco**.

Las imágenes de las plantillas viven en `productos_v2/{id}/plantillas/`, así la limpieza de creaciones no las toca.

**Agregar una:** un admin la diseña en el estudio y usa **Guardar como plantilla**, debajo de los pasos.

**Renombrar, cambiar de grupo o quitar:** en Admin → Prendas de Crear → Plantillas.

## Crear los productos (una sola vez)

En **Admin → Catálogo → Importar plantillas de cuadros** (`/admin/plantillas-yoryo`), el botón **Crear productos y pack**:

- crea `yoryo-crear-cuadro`, `yoryo-crear-mousepad` y `yoryo-crear-tomatodo` con la foto de la tienda sin fondo y recortada;
- crea el Pack de oficina como combo de Crear;
- enlaza los productos de la tienda con "Personalizar en Crear".

Lo que ya exista no se repite. La única excepción es la zona del tomatodo, que se agranda si sigue como la dejó la primera versión. Las zonas se midieron sobre las fotos de la tienda del 28-10-2026. El tomatodo queda con unos 10 cm de cuerpo estimados: se confirma con el taller y se ajusta en Prendas de Crear.

## Guardar las plantillas anteriores (una sola vez)

**Guardar plantillas en los productos** convierte las plantillas de GPT:

- cuadro y mousepad: 3 de Parejas y 6 de Equipos;
- tomatodo: 6 de Equipos, con los escudos SVG de `public/yoryo/laser/` pintados en blanco.

Usa las ediciones de la pantalla anterior si las hay (`templates/yoryo-composiciones-v4`). Volver a guardarlas reemplaza las mismas, por id. El tamaño de las letras es aproximado.

**Quitar copias** retira de la comunidad y borra de Mis creaciones lo que publicó la primera versión de esta pantalla.

Después de guardar, `public/yoryo/` y `src/pages/admin/plantillasYoryo/` se pueden borrar. Los originales siguen en `assets/yoryo-plantillas/`.

## Lo ya guardado con el editor anterior

- **Carrito:** las líneas con `datosYoryo` piden volver a crearlas en Crear y no dejan pagar.
- **Pedidos hechos:** conservan sus archivos (`designs.js` → `urlsDeDiseno` los protege de la limpieza).
