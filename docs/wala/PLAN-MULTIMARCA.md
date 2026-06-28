# Plan — Sistema Multi-Marca (Con Amor / MUSSA / MUEBLERIA)

> Cada marca = línea de productos independiente, con su propia página (`WALA.PE/ConAmor`,
> `/MUSSA`, `/MUEBLERIA`), su catálogo sidebar filtrado solo a sus productos, su panel admin
> para asignarle productos, y su nav de categorías con miniaturas (estilo M\*\*\*SHAKES) que
> al hacer clic filtra el catálogo de esa marca.

## Conclusión central
**No hay que inventar un modelo nuevo.** El ~80% ya existe; solo falta **cablear 5 piezas** hoy
desconectadas. La llave es el campo **`brandId`** del producto (= doc id de `tienda_brands`), ya
soportado end-to-end: se asigna en `AdminProductoFormV2` (carrusel de miniaturas), se persiste y
se lee (`products.js`), y ya tiene faceta server-side `{type:'brand'}` → `where('brandId','==',value)`.

### Los 5 "cables" que faltan
1. Dar a `sidebar_catalog` un setting `brandId` y que `TiendaPage` lo use como faceta inicial del catálogo paginado.
2. Renderizar `categories_nav` (hoy devuelve `null`) reutilizando `VisualCategoryNav` + darle editor + settings.
3. Modelar "categorías por marca con miniatura" (array `categoryNav` embebido en `tienda_brands`).
4. Cablear **clic en el nav → faceta de categoría** del sidebar de la misma página, combinada con el `brandId` fijo de la marca.
5. Ampliar `AdminMarcas` (hoy solo identidad visual) para **asignar/quitar productos en lote** y configurar el nav por marca.

## Modelo de datos (mínimo)
- **Producto → marca:** `brandId` en `productos_wala` (ya existe). **1 producto = 1 marca**.
- **Marca:** colección `tienda_brands` (ya existe: name, logoUrl, fondo, whatsappNumber). **Añadir:** `slug` + (opcional) array `categoryNav: [{ categoryId, name, imageUrl, order }]`.
- **Settings de secciones:** `brandId` en `sidebar_catalog` y `categories_nav`.
- Sin colecciones nuevas.

## Panel admin por marca (amplía `/admin/marcas`)
Marca con **detalle** y 3 pestañas:
- **Identidad:** lo de hoy (logo, fondo, WhatsApp) + `slug`.
- **Productos:** lista por `getProductsByBrand(brandId)`; asignar/quitar marca **en lote**; botón "Crear producto en esta marca" que abre `AdminProductoFormV2` con la marca **preseleccionada** (ya soporta brandId). Conecta con el inventario y la creación existentes, sin reescribir nada.
- **Nav de categorías:** editor del array `categoryNav` (elegir categorías de `tienda_categories` con su `imageUrl`, o crear entradas con foto propia).

## Storefront + ruteo
Reutiliza el mecanismo de páginas dinámicas: `/:slug` → `DynamicLandingPage` → `TiendaPage` carga las secciones de `pages/{slug}` (editor visual). Por marca: crear un `landingPage` con su slug y colocar `categories_nav` + `sidebar_catalog` (con su `brandId`). `TiendaPage` inicializa `catalogFacet = {type:'brand', value: brandId}` → el catálogo trae **solo esa marca** (server-side), con paginación; la categoría del nav se aplica como filtro de cliente (el sidebar ya filtra categoría en cliente). Requiere índice `brandId + createdAt`.

## Nav de categorías con miniaturas
`VisualCategoryNav` ya renderiza las burbujas con foto. Gaps: (1) renderizarlo por sección (hoy el case devuelve null); (2) modo "filtro local": el clic llama un callback que empuja la faceta de categoría al sidebar de la misma página (en vez de navegar a `/tienda?categoria=`); (3) compartir la categoría activa entre nav y sidebar.

## Fases (cada una desplegable y verificable)
- **Fase 0 — Datos:** crear las 3 marcas con `slug`; backfill `brandId = ConAmor` en productos sin marca; índice `brandId+createdAt`. *Verif.:* `getProductsByBrand(conAmor)` = catálogo actual; MUSSA/MUEBLERIA = 0.
- **Fase 1 — `WALA.PE/ConAmor` funcionando (prioridad):** setting `brandId` en sidebar_catalog + selector en el editor + `getProductsByBrand` + TiendaPage usa la faceta + crear el landingPage ConAmor. *Verif.:* `/ConAmor` muestra solo productos Con Amor; `/tienda` global intacta.
- **Fase 2 — Panel admin por marca:** asignación masiva + crear-con-marca.
- **Fase 3 — Nav de categorías con miniaturas por marca.**
- **Fase 4 — Clic en el nav filtra el sidebar de la marca.**
- **Fase 5 — Replicar MUSSA + MUEBLERIA** + resolver colisión de la ruta `/mussa` hardcodeada.

## Riesgos clave
- **Firestore:** solo 1 faceta server-side + orderBy por query → marca server-side + categoría cliente (ya soportado).
- **Índice** `brandId+createdAt` necesario (si falta, cae a catálogo completo sin paginación).
- **Colisión `/mussa`:** ya existe `/mussa` hardcodeada (`MussaPage`, ajena a esto) que gana a `/:slug`.
- **`brandId` guarda DOC ID** (no slug) — el selector debe guardar `b.id`.
- **Retrocompatible:** `brandId` vacío = catálogo global (no rompe la home).

## Decisiones del usuario (antes de arrancar)
1. ¿1 producto = 1 marca (recomendado) o varias?
2. ¿Todos los productos actuales son "Con Amor" (para el backfill)?
3. Colisión `/mussa`: ¿otro slug / quitar la ruta vieja / convertir `MussaPage` en la página de la marca?
4. Formato de slug (`ConAmor` vs `conamor`).
5. Categorías por marca: array embebido (recomendado) vs `brandIds` en la categoría (compartibles).
6. ¿Se mantiene `/tienda` global con todo, o a futuro solo páginas por marca?
