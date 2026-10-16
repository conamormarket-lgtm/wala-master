# La ficha de un producto (`/producto/:id`)

Cómo verla en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **Un producto**. También se abre desde
**cualquier tarjeta** de la Tienda de prueba (inicio, tienda, buscar,
favoritos, el carrito). En "Cómo se abre": una prenda con colores y tallas,
uno sin opciones, un combo de pareja y un producto de un solo modelo. En los
estados: cargando, error, ya no está disponible, agotado, personalizable (para
ver el botón) y sin opiniones.

![La ficha en el celular: la galería, el precio, color y talla, los botones y la confianza](producto-celular.webp)

(Celular, 390 px, 2026-10-16. En escritorio es la misma columna a la derecha
de la galería; la captura de 1366 sale achicada en el panel y no se dejó.)

Revisado el 2026-10-15 contra `src/pages/ProductPage.jsx` y
`src/pages/Tienda/components/ProductDetail/ProductDetail.jsx` (905 líneas) y
`ProductReviews.jsx`. Datos del ejemplo: `demo/producto.json`, con 6
documentos reales de `productos_wala` (solo los campos que usa la ficha: la
descripción, las variantes y las dos prendas del combo "Rodar Contigo"). Los
demás productos de la demo abren su ficha con lo que trae la lista (sin
descripción).

**Rediseñada el 2026-10-16** para que no se sienta estática: la galería se
desliza, lo elegido viaja de una opción a otra, el precio corre, el botón
confirma "¡Agregado!" y en escritorio aparece la barra de compra al bajar.
Ver "Lo que hace".

**Las opiniones de la demo son de ejemplo.** Hoy `product_reviews` tiene 3
reseñas de prueba en un producto borrado, así que no sirven para ver el diseño.
`DemoProducto.jsx` lo dice en el código.

## Partes

| Parte | Componente | Piezas que usa | Diseño en | Datos (en la tienda) |
|---|---|---|---|---|
| P13 Página | `PaginaProducto` | `MarcoFicha`, `Migas`, `PrecioFicha`, `ConfianzaCompra`, `BarraCompra` (el marco de `piezas/Ficha`, el mismo de una creación y de un combo) | `paginas/Producto.module.css` | `fichaProductoDesde(producto, { catalogo, subproductos })` |
| Galería | `GaleriaProducto` | — | `piezas/GaleriaProducto.module.css` | `fotos.base` y `fotos[varianteId]` |
| Migas y precio | `Migas`, `PrecioFicha` | `useContador` (el precio corre) | `piezas/Ficha.module.css` | `producto.categoria`, `precio`, `precioAntes` |
| Opciones | `OpcionesProducto` (la misma de "Agregar rápido") | `SelectorColor`, `SelectorTalla`, `Cantidad` | `piezas/OpcionesProducto.module.css` y `Formulario.module.css` (`.colorAro`, `.tallaMarca`) | `opcionesDeProducto` (ya existía) |
| Compra | `.compra` de `PaginaProducto` (pegada abajo en el celular) | `Boton` | `paginas/Producto.module.css` | `onAgregar`, `onComprar`, `onPersonalizar`, `carrito`, `onPagarCarrito` |
| Confianza | `ConfianzaCompra` | `IconoWala` (`camion`, `cambio`, `escudo`) | `piezas/Ficha.module.css` | fija |
| Barra de compra (escritorio, al bajar) | `BarraCompra` (pieza nueva) | `FotoProducto`, `Boton` | `piezas/Ficha.module.css` | la foto, el nombre, lo elegido y el precio de la ficha |
| Opiniones | `ResumenOpiniones`, `TarjetaOpinion`, `FormularioOpinion`, `Estrellas` (piezas nuevas) | `Avatar`, `Sello`, `Campo`, `Boton` | `piezas/Opiniones.module.css` | `getProductReviews` → `opinionesDesde` |
| También te puede gustar | `Carrusel` + `TarjetaProducto` | — | los suyos | `getProductsByCategory` → `tarjetaDesdeProducto` |

### Lo que hace

- **Cabeza:** las migas (Inicio / la categoría / el producto). La categoría
  lleva a `/tienda?categoria=…`; en la tienda las dos llevan a `/`. Después,
  la marca con su logo como enlace a su página, el nombre con la letra de la
  marca y, con sesión, **Compartir y ganar monedas**. Si hay opiniones, las
  estrellas con el promedio llevan a la sección de opiniones.
- **Precio:** `PrecioFicha`, con el precio de antes y el descuento en su sello.
  Con 10 o menos unidades, "¡Quedan N!" (la misma regla que la tarjeta).
- **Combo:** "Este conjunto incluye (2)", cada prenda con su foto. Después,
  un color por prenda (abre con el color del combo, `variantMapping.color`) y
  una talla para todas, con "Se aplica a las 2 prendas". La talla es la que
  comparten las prendas.
- **Galería:** las fotos van en una tira que se desliza. En el celular sigue
  al dedo y encaja foto por foto, con puntos abajo. En escritorio, al tocar o
  pasar por una miniatura, la tira se desliza hasta esa foto. El borde de la
  miniatura elegida viaja de una a otra. Con ratón, la foto se acerca donde
  está el cursor. La foto se funde con el escenario (`multiply`), así que su
  fondo blanco no deja una franja.
- **Opciones:** el color en muestras (o el modelo en botones, si las
  variantes no tienen color) y la talla con su nombre (`sizeLabel`: Talla,
  Medida…). **Lo elegido viaja**: el aro del color y el fondo violeta de la
  talla se deslizan de la opción anterior a la nueva (con resorte; sin
  movimiento si se pide reducirlo). Al cambiar de color, la galería pasa a
  sus fotos y **la talla elegida se queda** si el nuevo color la tiene (igual
  que "Agregar rápido"). Abre con la variante principal (`defaultVariantId`);
  la tienda abre siempre la primera. Cada cambio de variante (y la de
  entrada) llega a `onVariante`.
- **Precio:** si cambia (otra variante), corre hasta el nuevo; el descuento
  entra con un golpe de sello.
- **Comprar:** Agregar al carrito (y Personalizar, si es personalizable),
  Comprar ahora y, si ya hay algo en el carrito, "Ir a pagar mi carrito (N)".
  Sin talla no se agrega: se marca la talla y dice "Elige una talla para
  continuar". Agotado: "Agotado por ahora", sin "Comprar ahora" ni cantidad.
  Al agregar, el botón dice **"¡Agregado!"** con un check un momento (1,8 s).
  **En el celular, Agregar y Personalizar quedan pegados abajo**, sobre la
  barra inferior, y los flotantes (WhatsApp, Kapi) suben por encima
  (`data-compra-fija` → `--flotante-extra`). **En escritorio, al bajar**
  hasta la descripción o las opiniones, sube desde abajo la `BarraCompra`:
  la foto, el nombre, lo elegido ("Perla · M" o "Elige talla"), el precio y
  Agregar. Si falta la talla, la vista vuelve hasta ella.
  "Ir a pagar mi carrito" llama a `onPagarCarrito` si se pasa.
- **Confianza:** envío, cambios y pago seguro con los íconos de Walá
  (`IconoWala`), no con íconos de línea.
- **Descripción:** también da formato a lo que escribe el editor de
  productos: títulos, listas, imágenes, videos (`iframe` 16:9), enlaces y la
  alineación (`ql-align-*` o `text-align`).
- **Descripción:** el HTML del producto en un `Acordeon` abierto (las líneas
  vacías del editor no dejan huecos).
- **Opiniones:** a la izquierda, el resumen (fijo al bajar): el promedio
  grande, las estrellas y una barra por estrella (tocarla deja solo esas).
  Debajo, "Escribir una opinión". A la derecha:
  - **Fotos de clientes:** una tira con todas las fotos de las opiniones. Al
    tocar una se abre grande en una hoja.
  - **La más útil:** la opinión con más votos (desde 1) va primero, en una
    tarjeta con costura y "La más útil para la comunidad".
  - **Las demás:** de a 4, con "Ver más opiniones (N)". Cada una muestra
    quién (nombre e inicial del apellido), la fecha, las estrellas, el texto,
    sus fotos y **Útil · N**. Sin sesión, votar pide entrar.
  - **El formulario:** las estrellas (radios: flechas y Enter), el texto y
    hasta 5 fotos con vista previa y quitar. Sin estrellas o sin texto avisa
    abajo, sin `alert`. Sin sesión, invita a entrar.
- **Estados:**
  - Cargando: `EsqueletoPagina forma="producto"`.
  - Error: Kapi triste y "Reintentar". En la tienda se ve un `div` con
    "Error al cargar el producto: Documento no encontrado".
  - Retirado (`deleted` o `visible: false`): "Este producto ya no está
    disponible" e "Ir a la tienda".

## Para cambiar el diseño rápido: qué se repite

- **El marco de ficha** (`piezas/Ficha.module.css`) es el de una creación, un
  combo y este producto. Lo que cambie ahí cambia en las tres.
- **Los selectores** (`OpcionesProducto`) son los mismos de la hoja "Agregar
  rápido" de las tarjetas.
- **Las estrellas** usan el mismo dorado (`#f5b301`) en el resumen, en cada
  opinión y en la cabeza.
- **Lo que viaja al elegir** (`SelectorColor`, `SelectorTalla` en
  `Formulario.jsx`) es lo mismo en "Agregar rápido", Crear (las tallas de un
  combo) y el estudio. En `CrearStudioPage` se hizo igual (CREAR.md, P12).
- **`ConfianzaCompra` y `GaleriaProducto`** son las de una creación y un combo.

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

### Reemplazos

| Parte | Hoy en la tienda | Pasa a (kit) |
|---|---|---|
| Galería | `Gallery` (interno de ProductDetail) | `GaleriaProducto` |
| Migas, título, marca, precio | el bloque de `.infoCol` | `Migas`, cabeza de `PaginaProducto`, `PrecioFicha` |
| Color, talla, cantidad, combo | swatches con `DraggableContainer`, píldoras, − / + | `OpcionesProducto` |
| CTAs y barra fija del celular | `.ctaStack` | `.compra` de `PaginaProducto` |
| Insignias | las tres fijas | `ConfianzaCompra` |
| Descripción | `<details open>` | `Acordeon` |
| Reseñas | `ProductReviews` (406 + 598 líneas de CSS) | `ResumenOpiniones`, `TarjetaOpinion`, `FormularioOpinion` |
| Relacionados | `FeaturedCarousel` con `PremiumProductCard` | `Carrusel` + `TarjetaProducto` |
| Barra de compra en escritorio | no existe | `BarraCompra` (nueva) |
| Retirado y error | tarjeta de ProductPage y un `div` sin estilos | estados de `PaginaProducto` |

### De dónde sale cada dato

- **`producto`, `opciones`, `varianteInicial`, `fotos`:** `useProduct(id)`, los
  sub-productos del combo (el mismo efecto de hoy) y `getBrands()` y las
  categorías para `catalogo`, todo por `fichaProductoDesde`.
- **`opiniones`:** `getProductReviews(id)` → `opinionesDesde(resenas, { uid })`.
  `onOpinar` sube las fotos y llama a `addReview`; `onUtil` llama a
  `toggleHelpfulVote`.
- **`relacionados`:** `getProductsByCategory(categoria, marca)`, sin el
  producto, máximo 12, con `tarjetaDesdeProducto`.
- **`onAgregar` y `onComprar`:** `addToCart` con el mismo item de hoy
  (`variant { size, color, colorHex, selectedVariant }` y, en combos,
  `comboVariantSelections`). Comprar va con `{ selectOnly: true, silent: true }`
  y navega a `/checkout`.
- **`onPersonalizar`:** `/editor/{id}?size=&color=&comboSelections=`.
- **`onVariante`:** `recordVariantViewTime` (el contador por variante de hoy).
- **`onPagarCarrito`:** `selectAllItems()` y `/checkout` (con el toast si el
  carrito está vacío, como hoy).
- **`onCompartir`:** `linkProducto` con el código del cliente, copiado al
  portapapeles.
- **`carrito`:** cuántos hay en el carrito (`useCart`).

### Comportamiento que no se puede perder

- Las redirecciones de ProductPage: `esPrendaBase` → `/crear/:id` y
  `esComboCrear` → `/combo/:id`.
- La analítica: `recordProductClick`, `trackProductView`,
  `recordVariantViewTime` (el contador por variante, con `onVariante`) y
  `trackAddToCart`.
- `initialData` desde la caché de las listas: la ficha se pinta al instante.
- Combos: no se agrega mientras cargan las prendas ("Un momento: estamos
  cargando las prendas del combo").
- **Lo que se queda en la tienda, sin pasar al kit:**
  - El personalizador **Yoryo** (`YoryoPersonalizado`, con su historial de
    diseños). El botón se muestra con el texto "Personalizable".
  - El **cuestionario** (`cuestionario://` dentro de la descripción), que crea
    el pedido en el ERP y abre WhatsApp. Al migrar, el clic en ese enlace se
    sigue escuchando sobre el HTML de la descripción.
- El botón de WhatsApp global lee `whatsappEnabled`, `whatsappNumber` y
  `whatsappMessage` del producto.

### Diferencias a propósito (no "corregirlas" al migrar)

- La categoría de las migas lleva a su página de la tienda, no al inicio.
- Abre con la variante principal (`defaultVariantId`), no con la primera.
- La galería no repite el nombre del producto en cada foto: solo dice el
  color, o la prenda en un combo.
- Las opiniones van a todo el ancho, debajo de la ficha (en la tienda van
  apretadas en la columna derecha de 520px).
- La firma de una opinión es el nombre y la inicial del apellido.
- El error y el retirado tienen su estado con Kapi y una salida.
- Sin emojis ("🔍 Hover para zoom", "✨", "✅").
- No elige la primera talla sola: se elige y, si falta, se avisa.
- Al cambiar de color la talla se conserva si existe.
- En escritorio, la barra de compra al bajar (la tienda no la tiene).
- El botón confirma "¡Agregado!" además del toast.

### Lo encontrado de paso (2026-10-16, comparando con `ProductDetail.jsx`)

Falta en el kit y queda para cuando se migre (o se pida):

- **Combo:** en la tienda, al cambiar el color de una prenda la galería salta
  a la foto de esa prenda en ese color, y las tallas se recalculan por
  color. En el kit las fotos de cada prenda son fijas (`comboItems[].imageUrl`)
  y las tallas se juntan de todos los colores.
- **Muestras con foto:** la tienda usa la foto de la variante
  (`imageUrl` + `thumbnailCrop`) como muestra y deduce un color del nombre
  (`getFallbackHex`). `SelectorColor` solo dibuja círculos; si a una
  variante le falta `colorHex`, el kit pasa a botones "Modelo".
- **Una sola variante con tallas:** la tienda muestra igual su color; el kit
  no muestra selector con una sola variante.
- **Fotos:** la tienda pide el tamaño justo (`imagesVariantes`), la primera
  con `fetchPriority="high"`, precarga las demás y usa las vistas de
  personalización por color. El kit usa la URL tal cual.
- **Muchas fotos:** en la tienda la columna de miniaturas tiene alto máximo y
  scroll; en el kit crece con ellas.
- **`cuestionario://`** en la descripción y el **WhatsApp del producto**
  (`whatsappEnabled`, `whatsappNumber`, `whatsappMessage`) siguen siendo de
  la tienda.
- **En la tienda sale un toast doble al agregar** (`ProductDetail.jsx` y
  `CartContext.jsx` muestran uno cada uno).
- `--alto-barra-inferior` (la altura que usa `.compra`) no está definida en
  ningún lado: vale su respaldo de 72px. La tienda usa `--bottom-nav-height`.
- Con "Ver componentes", el resumen de opiniones dejaba de quedarse fijo al
  bajar (la regla de la demo le ganaba al `sticky`): arreglado con `:where()`
  en `DemoTienda.module.css`.

### Pasos

1. Usar `fichaProductoDesde` y `opinionesDesde` con los datos reales y
   comparar con la ficha de hoy, producto por producto (prenda, combo, sin
   opciones, agotado).
2. Cambiar las reseñas por las piezas del kit. Es lo más aislado.
3. Cambiar la columna de información (opciones y CTAs) y la galería.
4. Cambiar los relacionados y los estados.
5. Borrar `ProductDetail.module.css` y `ProductReviews.module.css` cuando
   lleve un tiempo en producción.
