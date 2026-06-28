# Plan — Sistema Multi-Marca (Con Amor / MUSSA / MUEBLERIA)

> Cada marca = línea de productos independiente, con su propia página (`WALA.PE/ConAmor`,
> `/MUSSA`, `/MUEBLERIA`), su catálogo sidebar filtrado solo a sus productos, su panel admin
> para asignarle productos, y su nav de categorías con miniaturas (estilo M\*\*\*SHAKES) que
> al hacer clic filtra el catálogo de esa marca.

> ## ✅ ESTADO: FASES 0–5 HECHAS Y DESPLEGADAS (frontend, 2026-06-28)
>
> Todo el plan está **implementado**. El **frontend** se desplegó por **Vercel** (auto-deploy
> desde `master`). Lo único que falta es **trabajo de datos del dueño** (ver "Pendiente del
> dueño" abajo), no código.
>
> **Commits (orden cronológico):**
> - `44b0745` — docs: este plan (línea base).
> - `281823a` — **Fase 0:** `scripts/setup-marcas.js` (crea las 3 marcas con `slug`, backfill
>   `brandId = ConAmor`, crea `landingPages/{slug}`); índice `brandId + createdAt`.
> - `a687fd5` — **Fase 1:** `sidebar_catalog` filtrable por marca (setting `brandId` + selector
>   en el editor; `getProductsByBrand`; `TiendaPage` deriva la faceta `brand`).
> - `212bf0f` — **Fix de ruteo:** páginas de marca/landing resuelven con cualquier mayús/minús
>   (slug **case-insensitive** en `getLandingPageBySlug`).
> - `ac7e53d` — **Fase 2 + sidebar:** panel `AdminMarcaProductos` (asignar/quitar en lote,
>   crear-con-marca) + `setProductBrand` (escritura parcial / `deleteField`) + sidebar con
>   grupos de filtros **colapsables**.
> - `5221ad5` — **Fases 3, 4 y 5:** nav de categorías con miniaturas por marca (`categoryNav`
>   en `tienda_brands` + `VisualCategoryNav` en modo filtro-local + editor en el panel) y
>   **MUSSA/MUEBLERIA operativas** (ruta `/mussa` hardcodeada **eliminada**).
> - `041742f` — **Refinamiento del editor:** "Añadir Nuevo Módulo" ofrece **"Productos {Marca}"**
>   y **"Categorías {Marca}"** (dinámicas, `getBrands`) que insertan `sidebar_catalog`/`categories_nav`
>   **ya filtrados** — sin tocar el dropdown. Label genérico → "Catálogo (todas las marcas)".
> - `3f0627c` — **NAV DE CATEGORÍAS AUTOMÁTICO ✅:** si el `categoryNav` manual está vacío,
>   `categories_nav` **deriva las burbujas de las categorías de los productos** de la marca
>   (`getProductsByBrand`), con la imagen de `tienda_categories` (sin imagen → inicial). El
>   `categoryNav` manual queda como **override**. El nav de marca también acota el catálogo a esa marca.
>
> **Brand IDs reales (doc id de `tienda_brands`):**
> | Marca | `brandId` | slug |
> |---|---|---|
> | Con Amor | `m3P26agqw7BjeYTDjs6j` | `ConAmor` |
> | MUSSA | `pMujqcyIIDUF2EdSSX5V` | `MUSSA` |
> | MUEBLERIA | `RMLsCQGvLo7c3NHgfkLO` | `MUEBLERIA` |
>
> **Decisiones tomadas por el dueño** (resuelven las "Decisiones del usuario" del final):
> 1. **1 producto = 1 marca**. 2. **Todos los productos actuales = Con Amor** (backfill).
> 3. Colisión `/mussa`: se **eliminó la ruta hardcodeada** (`MussaPage` retirado); `/MUSSA`
>    (y `/mussa`) cae en el catch-all `/:slug` → `DynamicLandingPage`. 4. Formato de slug =
>    `ConAmor`/`MUSSA`/`MUEBLERIA` (**CamelCase/MAYÚS**, pero el match es case-insensitive).
>    5. Categorías por marca = **array embebido** `categoryNav` en `tienda_brands`. 6. Se
>    **mantiene `/tienda` global** con todo el catálogo (`brandId` vacío = global).
>
> **Pendiente del dueño (datos, NO código):** correr `node scripts/setup-marcas.js --apply`
> (crea `landingPages/MUSSA` y `/MUEBLERIA` + termina el backfill de `brandId`), **configurar
> las páginas MUSSA/MUEBLERIA en el editor visual** (arrastrar **"Productos {Marca}"** +
> **"Categorías {Marca}"** desde "Añadir Nuevo Módulo"; el **nav de categorías es automático**,
> no hay que armarlo a mano) y **asignar productos a MUSSA/MUEBLERIA** desde `AdminMarcaProductos`
> (al asignarlos, sus categorías aparecen solas en las burbujas).
>
> El resto de este documento es el **plan original** (se conserva como referencia de diseño);
> la sección "## Estado real de implementación" más abajo detalla, fase por fase, lo que de
> hecho se construyó y dónde vive en el código.

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

## Decisiones del usuario (RESUELTAS)
1. **1 producto = 1 marca.** ✅
2. **Todos los productos actuales = "Con Amor"** (backfill `brandId = m3P26agqw7BjeYTDjs6j`). ✅
3. Colisión `/mussa`: **se quitó la ruta vieja** (`MussaPage` retirado); `/MUSSA` resuelve por `/:slug`. ✅
4. Formato de slug: `ConAmor` / `MUSSA` / `MUEBLERIA` (con **match case-insensitive** en el ruteo). ✅
5. Categorías por marca: **array embebido** `categoryNav` en `tienda_brands`. ✅
6. **Se mantiene `/tienda` global** con todo (`brandId` vacío = catálogo global). ✅

---

## Estado real de implementación (lo que de hecho se construyó)

> Verificado leyendo el código (no inventado). Archivos clave entre paréntesis.

### Fase 0 — Datos ✅ (commit `281823a`)
`scripts/setup-marcas.js` (idempotente, **DRY-RUN por defecto**, `--apply` para escribir):
1. Garantiza las 3 marcas en `tienda_brands` con `slug` (reutiliza por slug/nombre, no duplica).
2. **Backfill:** a cada `productos_wala` con `brandId` vacío/ausente le pone `brandId = <id Con Amor>`
   (en lotes de 400, `merge:true`). Solo toca `brandId`; NO toca precios/stock.
3. Crea `landingPages/{slug}` con **id === slug** (`ConAmor`/`MUSSA`/`MUEBLERIA`) para que las
   rutas resuelvan; las secciones las coloca el dueño en el editor.
Índice `brandId ASC + createdAt DESC` añadido a `firestore.indexes.json`.

### Fase 1 — Storefront por marca ✅ (commit `a687fd5`)
- `sidebar_catalog` y `categories_nav` ganan setting **`brandId`** con un **selector** en el editor
  visual (`VisualEditorPanel.jsx`: `<select value={s.brandId}>` que guarda `b.id`, no el slug).
- `getProductsByBrand(brandId)` (`src/services/products.js`) — `where('brandId','==',brandId)`,
  solo visibles.
- `getStoreProductsPage({ facet })` acepta la faceta server-side `{ type:'brand', value }`
  → `facetToWhere` la traduce a `where('brandId','==',value)` (`products.js`). Una sola faceta
  server-side + `orderBy` (límite Firestore); la **categoría** se aplica como filtro de **cliente**.
- `TiendaPage.jsx` **deriva `pageBrandId`** de la sección `sidebar_catalog` de la página y arranca
  `catalogFacet = { type:'brand', value: brandId }` → el catálogo trae SOLO esa marca, paginado.

### Fix de ruteo — slug case-insensitive ✅ (commit `212bf0f`)
`getLandingPageBySlug` (`landingPages.js`): match exacto y, si falla, **fallback en memoria
case-insensitive** (la colección es pequeña). Así `/CONAMOR`, `/conamor` y `/ConAmor` resuelven
a la misma página. `DynamicLandingPage` pasa `pageIdOverride={landingPage.slug || landingPage.id}`
a `TiendaPage`, que usa ese **slug guardado** como `pageId` (lee secciones de `pages/{slug}`).

### Fase 2 — Panel admin por marca ✅ (commit `ac7e53d`)
- `AdminMarcaProductos.jsx` (se abre desde `/admin/marcas`, botón "gestionar productos" de cada
  marca). **2 pestañas:** **Productos** (lista asignados vía `getProductsByBrand` con quitar en
  lote + buscador de NO asignados vía `getProducts` con asignar en lote) y **Nav de categorías**.
  Botón "crear producto en esta marca" → `/admin/productos/nuevo?brandId=<id>` (preselecciona la marca).
- `setProductBrand(id, brandId)` (`products.js`): **escritura PARCIAL directa** del campo —
  `updateDoc(ref, { brandId })` para asignar, `updateDoc(ref, { brandId: deleteField() })` para
  quitar (remueve el campo, así `getProductsByBrand` deja de traerlo). Corrige el bug de que
  `brandId:''` por la normalización completa nunca llegaba a escribirse.
- **Sidebar con grupos de filtros COLAPSABLES** (`SidebarCatalogLayout.jsx`): acordeón por grupo
  (etiquetas/personajes arrancan colapsados); solo presentación, no cambia el filtrado.

### Fases 3–4 — Nav de categorías con miniaturas + clic filtra el sidebar ✅ (commit `5221ad5`)
- `categoryNav: [{ categoryId, name, imageUrl, order }]` embebido en `tienda_brands`
  (`brands.js`: `createBrand`/`updateBrand` con `normalizeCategoryNav`; editado en la pestaña
  "Nav de categorías" de `AdminMarcaProductos`). **Tras `3f0627c` este array es OPCIONAL** (override).
- `VisualCategoryNav.jsx` gana **modo filtro-local**: si recibe `onSelectCategory`, cada burbuja
  (con miniatura) es un `<button>` que filtra el catálogo de la marca **sin navegar** (resalta por
  `activeCategory`, no por la URL). "Todos" = `onSelectCategory(null)`.
- `TiendaPage.jsx` carga el `categoryNav` de los `brandId` referenciados por las secciones
  `categories_nav` y comparte la categoría activa entre el nav y el sidebar de la misma página
  (la categoría se aplica como faceta de cliente sobre el catálogo ya acotado a la marca).

### Refinamiento — Editor con módulos por marca + NAV DE CATEGORÍAS AUTOMÁTICO ✅ (commits `041742f` + `3f0627c`)
- **Módulos por marca en "Añadir Nuevo Módulo"** (`VisualEditorPanel.jsx`): para `sidebar_catalog`
  y `categories_nav`, el `<select>` agrega un `<optgroup>` con la opción genérica + una **por cada
  marca** (`getBrands`): **"Productos {Marca}"** (inserta `sidebar_catalog` con `brandId` + `title`)
  y **"Categorías {Marca}"** (inserta `categories_nav` con `brandId`). La opción de marca se codifica
  en el `value` como JSON `{type, brandId, title}`; `addSection(type, settingsOverride)` la aplica.
  El label de `sidebar_catalog` en `SECTION_TYPES` pasó a **"Catálogo (todas las marcas)"**.
- **Nav de categorías AUTOMÁTICO** (`TiendaPage.jsx`): si el `categoryNav` manual de la marca está
  **vacío**, las burbujas se **derivan de los productos** — `getProductsByBrand(brandId)` → ids de
  categoría **distintos** (misma extracción `idOf` que el sidebar) mapeados a `tienda_categories`
  (`getCategories`) para nombre + `imageUrl`, ordenados por `order` y luego nombre. El manual
  **gana** si tiene items. Categoría **sin imagen** → burbuja con **inicial + color estable**
  (`VisualCategoryNav.jsx`, ya no usa Unsplash).
- **`pageBrandId` considera el nav:** si la página tiene un `categories_nav` de marca pero **no** un
  catálogo de marca, la marca del nav **acota el catálogo** → pulsar una burbuja de la marca A no
  muestra esa categoría de todas las marcas.

### Fase 5 — MUSSA + MUEBLERIA + colisión `/mussa` ✅ (commit `5221ad5`)
- Las 3 marcas comparten exactamente el mismo mecanismo (página `/:slug` + `sidebar_catalog`
  con su `brandId` + `categoryNav` propio).
- **Colisión resuelta:** la ruta `/MUSSA` hardcodeada (`MussaPage`) se **eliminó** de `App.jsx`;
  ahora `/MUSSA` (y `/mussa`) cae en el catch-all `/:slug` → `DynamicLandingPage`.

### Lo que el dueño debe hacer en datos (no código)
- `node scripts/setup-marcas.js --project sistema-gestion-3b225 --apply` (crea
  `landingPages/MUSSA` y `/MUEBLERIA`, termina el backfill de `brandId`).
- En el **editor visual**: configurar las páginas MUSSA/MUEBLERIA (añadir `categories_nav` +
  `sidebar_catalog` con su `brandId`).
- En **`AdminMarcaProductos`**: asignar productos a MUSSA y MUEBLERIA (hoy todos son Con Amor).
