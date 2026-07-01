# Plan — Sistema Multi-Marca (Con Amor / MUSSA / MUEBLERIA)

> Cada marca = línea de productos independiente, con su propia página (`WALA.PE/ConAmor`,
> `/MUSSA`, `/MUEBLERIA`), su catálogo sidebar filtrado solo a sus productos, su panel admin
> para asignarle productos, y su nav de categorías con miniaturas (estilo M\*\*\*SHAKES) que
> al hacer clic filtra el catálogo de esa marca.

> ## ✅ ESTADO FINAL (2026-06-29/30): AISLAMIENTO COMPLETO ENTRE MARCAS (P0–P2)
>
> Sobre las Fases 0–5 (catálogo/nav por marca, más abajo), se hizo un **segundo ciclo** para
> resolver un **bug reportado por el dueño**: en las páginas de marca (`/MUSSA`, `/MUEBLERIA`)
> aparecían **categorías/etiquetas/colecciones de Con Amor** (un mercado totalmente distinto).
> **Causa raíz:** esas taxonomías eran colecciones Firestore **globales sin `brandId`**, y ni
> el **sidebar** ni el **Header** recibían la marca de la página. Se cerró en **3 fases (P0,
> P1, P2)**, las 5 commits siguientes, **todas retrocompatibles** (sin marca / Con Amor /
> páginas globales = exactamente igual que antes) y **sin tocar pagos ni totales**. **No se
> requirieron índices Firestore nuevos** (todo el filtrado por marca es client-side).
>
> **Commits (orden cronológico):**
> - `e9290c1` — **P0:** `SidebarCatalogLayout` recibe `brandId` y deriva categorías/
>   colecciones/etiquetas/personajes/tipos **solo de los productos de esa marca**
>   (`getProductsByBrand` + cruce id→nombre), en vez de las listas globales. Oculta el filtro
>   "Marcas" si hay `brandId`.
> - `d87878d` — **Fix de fondo:** `getCategories()` une por id `'categories'` +
>   `'tienda_categories'` (antes eran dos colecciones distintas; categorías nuevas del admin
>   podían quedar sin nombre/ocultas).
> - `88bc5db` — **P1:** `Header.jsx` consciente de marca (detecta `brandActual` por
>   `slug`/`slugify(name)`); mega-menú y "Ver Todo" ya no llevan a Con Amor.
>   `getProductsByCollection`/`getFeaturedProducts` aceptan `brandId` (carruseles/flash/
>   destacados acotados). `brandId` de primera clase en `landingPages`
>   (`pageBrandIdOverride`). `slug` de primera clase en `tienda_brands` (`createBrand`/
>   `updateBrand`, campo en `AdminMarcas`).
> - `dc1fdab` — **P2a — Identidad por marca:** `storeTitle`/`storeSubtitle`/`storeEmpty` en
>   `tienda_brands` (editables en `AdminMarcas`, con fallback global). `WhatsAppButton`
>   flotante usa el `whatsappNumber` de la marca. Indicador **"Estás en: `<Marca>`"** en
>   `TiendaPage`.
> - `8eee5b2` — **P2b — Búsqueda y categoría por marca:** Header agrega `?brand=<id>` al
>   enlace de búsqueda; `SearchPage` filtra client-side por `p.brandId` y muestra "Buscando
>   en: `<Marca>`". `getProductsByCategory(categoryId, brandId)` acota la vista por categoría
>   dentro de una página de marca.
>
> **Qué quedó aislado por marca (checklist de lo que YA NO se mezcla):**
> - [x] Sidebar de filtros (categorías, colecciones, etiquetas, personajes, tipos de producto)
> - [x] Mega-menú de categorías del Header + enlace "Ver Todo el Catálogo"
> - [x] Carruseles de colección (`collection_carousel`)
> - [x] Ofertas flash (`flash_sales`)
> - [x] Productos destacados
> - [x] Título / subtítulo / mensaje de catálogo vacío de la tienda
> - [x] WhatsApp flotante (usa el asesor de la marca)
> - [x] Indicador visual de marca activa ("Estás en: `<Marca>`")
> - [x] Búsqueda (`/buscar?brand=<id>`, con indicador y opción de volver al catálogo global)
> - [x] Vista por categoría (`?categoria=ID`) dentro de una página de marca
> - [x] Nav de categorías con miniaturas (ya aislado desde la Fase 3, ver abajo)
> - [x] Catálogo paginado del sidebar (ya aislado desde la Fase 1, ver abajo)
>
> Detalle técnico completo, archivos tocados y patrón de detección de marca: ver
> ["## Estado real de implementación — Ciclo de AISLAMIENTO (P0–P2)"](#estado-real-de-implementación--ciclo-de-aislamiento-p0p2-2026-0629302026-06-30)
> más abajo. Checklist de prueba manual en
> [PRUEBAS-Y-DEBUGGING.md](./PRUEBAS-Y-DEBUGGING.md).

> ## ✅ ESTADO: FASES 0–5 HECHAS Y DESPLEGADAS + REFINAMIENTOS (frontend, 2026-06-28/29)
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
> - `fc8a0d2` — **Editor compartido del nav (`CategoryNavEditor`):** se extrae el editor del
>   nav a `src/components/admin/CategoryNavEditor/CategoryNavEditor.jsx` (reutilizable y
>   autosuficiente) y se **embebe inline en el Editor Visual** cuando la sección
>   "Navegación por categorías" tiene una marca seleccionada → el mismo editor en 3 lugares
>   (panel por marca, Elementos con diseño y editor visual), todos editan el mismo
>   `categoryNav` de la marca (sincronizado).
> - `425e9ce` — **"Elementos con diseño" v2 + "Estilo del nav":** la página `/admin/elementos-diseno`
>   pasa de hub de pestañas a **grid de tarjetas con slug por elemento** (registro extensible
>   `src/pages/admin/elementosDiseno/registry.jsx` + página por slug `AdminElementoDisenoPage` +
>   ruta `/:elementSlug`; hoy 1 elemento: `navegacion-categorias`). Además, el editor del nav
>   gana el **"Estilo del nav"** `categoryNavStyle = { align, animation }` (alineación
>   izq/centro/der/justificado + modo estático/slider), persistido junto al `categoryNav`
>   en `tienda_brands` y sincronizado en los 3 lugares.
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

> **Cómo quedó (final):** la **Identidad** (logo, fondo, WhatsApp, `slug`) se mantuvo en
> `/admin/marcas` (`AdminMarcas.jsx`); el panel por marca `AdminMarcaProductos` quedó con **2
> pestañas** (**Productos** + **Nav de categorías**). El editor del nav es el componente
> **compartido `CategoryNavEditor`** (mismo en 3 lugares) y suma el **"Estilo del nav"**
> (`categoryNavStyle = { align, animation }`). Ver "## Estado real de implementación".

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
  lote + buscador de NO asignados vía `getProducts({ includeHidden: true })` con asignar en lote) y
  **Nav de categorías** (monta el editor compartido `CategoryNavEditor`, ver el refinamiento más abajo).
  Botón "crear producto en esta marca" → `/admin/productos/nuevo?brandId=<id>` (preselecciona la marca).
- `setProductBrand(id, brandId)` (`products.js`): **escritura PARCIAL directa** del campo —
  `updateDoc(ref, { brandId })` para asignar, `updateDoc(ref, { brandId: deleteField() })` para
  quitar (remueve el campo, así `getProductsByBrand` deja de traerlo). Corrige el bug de que
  `brandId:''` por la normalización completa nunca llegaba a escribirse.
- **Sidebar con grupos de filtros COLAPSABLES** (`SidebarCatalogLayout.jsx`): acordeón por grupo
  (etiquetas/personajes arrancan colapsados); solo presentación, no cambia el filtrado.

### Fases 3–4 — Nav de categorías con miniaturas + clic filtra el sidebar ✅ (commit `5221ad5`)
- `categoryNav: [{ categoryId, name, imageUrl, order }]` embebido en `tienda_brands`
  (`brands.js`: `createBrand`/`updateBrand` con `normalizeCategoryNav`; **tras `fc8a0d2` se edita
  con el componente compartido `CategoryNavEditor`**, ver abajo). **Tras `3f0627c` este array es
  OPCIONAL** (override).
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

### Refinamiento — Editor compartido del nav + "Elementos con diseño" v2 + "Estilo del nav" ✅ (commits `fc8a0d2` + `425e9ce`)
- **Editor reutilizable `CategoryNavEditor`** (`src/components/admin/CategoryNavEditor/CategoryNavEditor.jsx`):
  autosuficiente (carga sus datos con react-query: `getBrand`, `getCategories`, `getProductsByBrand`).
  Por **cada burbuja** edita los 3 campos — **(a) qué categoría filtra** (`<select>` de
  `tienda_categories` → `categoryId`, con opción "Sin categoría / burbuja libre"), **(b) nombre**
  visible y **(c) miniatura** (subir+recortar 1:1 → `uploadFile` a `brand_nav/{brandId}/...`, o
  **heredar** la imagen de la categoría). Además **agregar / quitar / reordenar** (flechas),
  **"Generar automático"** (pre-llena con las categorías de los productos de la marca; **no guarda**
  hasta pulsar "Guardar nav") y **"Vaciar (volver a automático)"** (deja `categoryNav = []`). Guarda
  con `updateBrand(brandId, { categoryNav, categoryNavStyle })` e invalida `['brands']`,
  `['admin-brand-doc']` y `['categories-nav-brands']` (el storefront refresca al instante).
- **Se usa en 3 lugares, todos editando el MISMO `categoryNav`/`categoryNavStyle` de la marca**
  (sincronizados): (1) pestaña **"Nav de categorías"** de `AdminMarcaProductos`; (2) elemento
  **"Navegación por categorías"** de *Elementos con diseño*; (3) **inline en el Editor Visual** al
  seleccionar una sección "Navegación por categorías" con marca.
- **"Elementos con diseño" v2** (`src/pages/admin/AdminElementosDiseno.jsx`): la landing
  `/admin/elementos-diseno` deja de ser un hub de pestañas y pasa a una **grid de tarjetas**, una por
  cada entrada del **registro extensible** `src/pages/admin/elementosDiseno/registry.jsx`
  (`ELEMENTOS_DISENO = [{ slug, nombre, descripcion, icon, Editor }]`). Cada elemento tiene su **slug**
  y su propia página `/admin/elementos-diseno/{slug}` (`AdminElementoDisenoPage`, ruta
  `elementos-diseno/:elementSlug` en `App.jsx`) con encabezado + enlace "Volver a Elementos con diseño".
  **Hoy hay 1 elemento:** `navegacion-categorias`, cuyo `Editor` (`NavegacionCategoriasEditor`) tiene un
  selector de marca (`getBrands`) y, al elegir una, monta `CategoryNavEditor`. **Para sumar un elemento
  nuevo** basta con añadir otra entrada al registro: aparece sola como tarjeta y como ruta.
- **"Estilo del nav" (`categoryNavStyle`)** (`brands.js`: `normalizeCategoryNavStyle`,
  default `{ align: 'center', animation: 'static' }`): `CategoryNavEditor` añade una sub-sección que
  guarda **alineación** (`align`: `left`/`center`/`right`/`justify`, **solo aplica en modo estático**)
  y **modo** (`animation`: `static` = fila fija | `slider` = burbujas que se desplazan solas en bucle,
  pausan al pasar el cursor, respetan `prefers-reduced-motion` y siguen filtrando al clic). Se persiste
  **junto** al `categoryNav` y `TiendaPage` lo pasa como `align`/`animation` a `VisualCategoryNav`.

### Fase 5 — MUSSA + MUEBLERIA + colisión `/mussa` ✅ (commit `5221ad5`)
- Las 3 marcas comparten exactamente el mismo mecanismo (página `/:slug` + `sidebar_catalog`
  con su `brandId` + `categoryNav` propio).
- **Colisión resuelta:** la ruta `/MUSSA` hardcodeada (`MussaPage`) se **eliminó** de `App.jsx`;
  ahora `/MUSSA` (y `/mussa`) cae en el catch-all `/:slug` → `DynamicLandingPage`.

### Lo que el dueño debe hacer en datos (no código)
- `node scripts/setup-marcas.js --project sistema-gestion-3b225 --apply` (crea
  `landingPages/MUSSA` y `/MUEBLERIA`, termina el backfill de `brandId`).
- En el **editor visual**: configurar las páginas MUSSA/MUEBLERIA arrastrando, desde
  **"Añadir Nuevo Módulo"**, **"Productos {Marca}"** (inserta `sidebar_catalog` con `brandId` ya
  configurado) + **"Categorías {Marca}"** (inserta `categories_nav` con `brandId`). El **nav de
  categorías es AUTOMÁTICO** (se deriva de los productos de la marca); solo se arma a mano si se
  quiere personalizar orden/imágenes/estilo, desde `CategoryNavEditor` (panel por marca, Elementos
  con diseño o inline en el editor visual).
- En **`AdminMarcaProductos`**: asignar productos a MUSSA y MUEBLERIA (hoy todos son Con Amor).

---

## Estado real de implementación — Ciclo de AISLAMIENTO (P0–P2) (2026-06-29/30–2026-06-30)

> Segundo ciclo, posterior a las Fases 0–5 de arriba. Resuelve el bug de taxonomías globales
> (Con Amor) filtrándose en las páginas de marca. Verificado leyendo el código de cada commit.

### P0 — Sidebar aislado por marca ✅ (commit `e9290c1`)
- `TiendaPage.jsx` pasa **`brandId={pageBrandId}`** a `SidebarCatalogLayout`.
- `SidebarCatalogLayout.jsx`: cuando recibe `brandId`, en vez de leer las listas **globales** de
  `tienda_categories` / `tienda_collections` / `tags` / `characters` / `productTypes`, llama
  **`getProductsByBrand(brandId)`** y deriva de esos productos los ids **distintos** de cada
  taxonomía, cruzándolos contra las listas globales solo para sacar **nombre/imagen** (mismo
  patrón `idOf` + mapeo que ya usaba `categories_nav` desde la Fase 3). Así el sidebar de
  `/MUSSA` solo puede mostrar categorías/colecciones/etiquetas/personajes/tipos que **de hecho
  tienen** productos MUSSA.
- El filtro **"Marcas"** del sidebar se **oculta por completo** cuando hay `brandId` (no tiene
  sentido filtrar por marca dentro de la página de una sola marca).
- **Sin `brandId`** (Con Amor, `/tienda`, home): el sidebar sigue leyendo las listas globales
  exactamente como antes de este commit — cero cambio de comportamiento.

### Fix de fondo — categorías del admin no se perdían (commit `d87878d`)
- **Causa:** el storefront (`getCategories()` en `src/services/products.js`) leía la colección
  `'categories'`, pero el admin (`AdminCategorias.jsx`) escribe en **`'tienda_categories'`**.
  Eran colecciones distintas: una categoría creada/editada desde el admin podía no tener nombre
  ni imagen en el storefront y quedar **invisible** en el nav o el sidebar — bug preexistente,
  no introducido por P0, pero que el aislamiento por marca hizo **visible** de inmediato (menos
  productos por marca = más probable toparse con una categoría "huérfana").
- **Fix:** `getCategories()` ahora hace la **unión por id** de `'categories'` +
  `'tienda_categories'`, con `tienda_categories` **ganando** el nombre/imagen si el id existe en
  ambas. Aditivo, no borra ni migra datos; Con Amor sigue resolviendo todas sus categorías igual
  que antes.

### P1 — Header por marca + carruseles/destacados/flash por marca + brandId/slug de primera clase ✅ (commit `88bc5db`)
- **`Header.jsx` detecta `brandActual`:** compara el primer segmento de la URL (`/MUSSA/...`)
  contra `tienda_brands.slug` **o**, si la marca no tiene `slug` explícito, contra
  **`slugify(name)`** (nuevo helper compartido y robusto — normaliza tildes/mayúsculas/espacios).
  En página de marca: el **mega-menú de categorías deja de listar las categorías globales**
  (que antes enlazaban a `/tienda?categoria=...`, es decir, al catálogo de Con Amor), y el
  enlace **"Ver Todo el Catálogo" apunta a la página de la marca actual**, no a `/tienda`.
- **`getProductsByCollection(collectionName, brandId=null)`** y **`getFeaturedProducts(brandId=null)`**
  (`src/services/products.js`): nuevo parámetro opcional que filtra **en cliente** (sin nuevas
  queries/índices Firestore) los resultados a la marca dada. `CollectionCarousel.jsx` y
  `FlashSales.jsx` reciben y usan `brandId`; sus `queryKeys` de react-query incluyen el
  `brandId` para no mezclar caché entre marcas.
- **`brandId` de primera clase en landing pages:** campo editable en `AdminLandingPages.jsx`,
  persistido en el doc `landingPages/{slug}`, leído por `landingPages.js` y propagado por
  `DynamicLandingPage.jsx` → `TiendaPage.jsx` como **`pageBrandIdOverride`** — si está presente,
  **gana** sobre la inferencia automática de marca por las secciones de la página.
- **`slug` de primera clase en marcas:** `createBrand`/`updateBrand` (`src/services/brands.js`)
  ahora **persisten** `slug` (si no se especifica, se deriva del `name` con `slugify`).
  `AdminMarcas.jsx` gana el campo **"Slug (URL)"** opcional con vista previa de la URL resultante;
  `tienda_marca_schema.json` documenta el campo. `scripts/setup-marcas.js` escribe también
  `brandId` en las `landingPages` que crea (antes solo creaba el doc).

### P2a — Identidad por marca ✅ (commit `dc1fdab`)
- **Mensajes propios de la tienda:** `tienda_brands` admite **`storeTitle`**, **`storeSubtitle`**
  y **`storeEmpty`** (los tres opcionales), editables en `AdminMarcas.jsx`. `TiendaPage.jsx` los
  usa cuando la página tiene `pageBrandId` **y** la marca los tiene configurados; si no,
  **fallback al mensaje global** de siempre. Sin marca = comportamiento idéntico al de antes.
- **WhatsApp propio de la marca:** `WhatsAppButton.jsx` (el botón flotante) replica el mismo
  patrón de detección `brandActual` (slug o `slugify(name)`) que el Header, y en página de marca
  usa el **`whatsappNumber`** de esa marca en vez del número general de la tienda. El número
  específico configurado a nivel de **producto** sigue ganando sobre el de la marca.
- **Indicador visual "Estás en: `<Marca>`":** franja sutil con **logo + nombre** de la marca,
  arriba del contenido en `TiendaPage.jsx` (`TiendaPage.module.css`), visible **solo** en
  páginas de marca.

### P2b — Búsqueda y vista de categoría respetan la marca ✅ (commit `8eee5b2`)
- **`Header.jsx`:** en página de marca, el ícono de búsqueda navega a **`/buscar?brand=<id>`**
  en vez de mandar al buscador global sin contexto.
- **`SearchPage.jsx`:** lee el parámetro `?brand=`, **filtra client-side por `p.brandId`**, lo
  **conserva** al re-buscar (no se pierde al escribir un nuevo término) y muestra un indicador
  **"Buscando en: `<Marca>`"** con opción explícita de **volver al catálogo global** (quita el
  filtro de marca sin perder el término buscado).
- **`getProductsByCategory(categoryId, brandId=null)`** (`src/services/products.js`): acota los
  resultados a la marca cuando se pasa `brandId` (client-side, sin índices nuevos). `TiendaPage.jsx`
  lo usa en la **vista por categoría** (`?categoria=ID`) cuando la página tiene `pageBrandId`, para
  que pulsar una categoría dentro de `/MUSSA` no mezcle productos de otras marcas.

### Patrón común de detección de marca (P1/P2)
Tanto `Header.jsx` como `WhatsAppButton.jsx` resuelven la marca activa de la misma forma:
toman el primer segmento de la URL actual y lo comparan contra `tienda_brands.slug`; si una
marca no tiene `slug` guardado, cae a compararlo contra `slugify(brand.name)`. Esto hace que el
aislamiento **no dependa de que todas las marcas tengan `slug` explícito** en Firestore — el
`slugify` compartido cubre el caso de datos antiguos/incompletos.

### Archivos clave del ciclo P0–P2
`src/pages/Tienda/components/SidebarCatalogLayout.jsx`, `src/pages/Tienda/TiendaPage.jsx`,
`src/pages/Tienda/TiendaPage.module.css`, `src/services/products.js` (`getCategories`,
`getProductsByCollection`, `getFeaturedProducts`, `getProductsByCategory`),
`src/components/common/Header/Header.jsx`, `src/components/common/WhatsAppButton/WhatsAppButton.jsx`,
`src/pages/Tienda/components/CollectionCarousel/CollectionCarousel.jsx`,
`src/pages/Tienda/components/FlashSales/FlashSales.jsx`, `src/pages/Tienda/DynamicLandingPage.jsx`,
`src/pages/Tienda/admin/AdminLandingPages.jsx`, `src/pages/Tienda/services/landingPages.js`,
`src/services/brands.js` (`slug`), `src/pages/admin/AdminMarcas.jsx` (slug + storeTitle/
storeSubtitle/storeEmpty), `src/models/tienda_marca_schema.json`, `scripts/setup-marcas.js`,
`src/pages/SearchPage.jsx`.

### Pendiente (no bloqueante)
- Ninguna tarea de datos/deploy pendiente para este ciclo: es 100% frontend, sin índices nuevos
  y sin cambios de reglas de Firestore. Queda como buena práctica ir asignando `slug` explícito
  a cada marca nueva desde `AdminMarcas` (aunque `slugify(name)` cubre el caso sin slug).
