# Navegar la tienda: nichos, vendedores y landings

> **Ofertas flash y cofre diario: retirados el 2026-10-16** (en la tienda y
> en el kit). En la tienda se borraron `OfertasFlashPage`, `AdminFlashOffers`
> (y su enlace del menú de admin), `services/flashOffers.js` y
> `services/chest.js`; `/ofertas` lleva a `/tienda`. En el kit, `PaginaOfertas`,
> `CofreDiario`, `TarjetaOferta`, `ofertaDesdeFirestore`, `ofertasVigentes`,
> el esqueleto `forma="ofertas"` y su demo. **Se dejó** la función
> `openDailyChestSecure` en el servidor y la colección `flashOffers` (vacía)
> con sus reglas: para volver, se recupera todo del historial de git (el
> commit dice "Ofertas flash y cofre diario: retirados").

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba**:

- **Nichos y vendedores**, con "Cómo se abre":
  - todos los nichos (`/nichos`);
  - un nicho (`/nicho/regala-con-amor`) y un nicho sin productos;
  - la tienda de un vendedor (`/tienda-vendedor/mussa`) y "WALA", el único
    vendedor real.

  Estados: no encontrado, sin nichos y cargando.
- **Landing de marca** (`/:slug`): dos landings reales del builder, Con Amor
  Geeks (catálogo con filtros) y Yoryo (carruseles por categoría). El menú
  Marcas de la cabecera también lleva a la de Con Amor Geeks.

| Nichos | Landing de marca |
|---|---|
| ![Los nichos en cuadros](nichos-escritorio.webp) | ![La landing de Con Amor Geeks](landing-marca.webp) |

| Nichos (celular, noche) | Un nicho (celular, noche) |
|---|---|
| ![Nichos en el celular](nichos-celular.webp) | ![Los productos de un nicho](nicho-celular.webp) |

Revisado el 2026-10-15 contra estos archivos:

| Página | Archivo | Líneas |
|---|---|---|
| Nichos | `pages/NichesPage.jsx` | 116 |
| Un nicho | `pages/NichePage.jsx` | 107 |
| Tienda de un vendedor | `pages/VendorStorefrontPage.jsx` | — |
| Landings | `pages/Tienda/DynamicLandingPage.jsx` → `TiendaPage` | 143 |

**Qué es real y qué es de ejemplo en la demo.** Las landings son reales:
`landingPages`, `pages/{slug}` y los productos de esas marcas, leídos con la
API pública (`demo/landings.json`). Los nichos son **de ejemplo**, porque
hoy `niches` está vacía en wala.pe. Sí son reales los productos a los que
apuntan. De los vendedores, "WALA" es el único
real: no tiene slug, logo ni productos. El otro vendedor es de ejemplo, con
los productos de MUSSA.

## Partes

| Parte | Componente | Piezas que usa | Datos (en la tienda) |
|---|---|---|---|
| P18 Nichos | `PaginaNichos` | `Encabezado`, `TarjetaCategoria` cuadro (nuevo: `detalle`), `EstadoVacio`, `Boton` | `getNiches` (`niches` por `order`) con `nichoDesdeFirestore` (adaptador nuevo) |
| P18 Un nicho y un vendedor | `PaginaColeccion` (`tipo="nicho"` o `"vendedor"`) | `Migas`, `Avatar` o `Sello`, `Trazo`, `GrillaProductos` (con "Ver más"), `EstadoVacio` | `searchCatalog({ facets: { nicheId } })` o `{ vendorId }`, `getNiches` / `getVendors` |
| S1… Landing | `PaginaTienda` + `RenderSecciones` | las secciones del builder | `landingPages` (`slug`, `brandId`, `hideHeader`, `hideFooter`) y `pages/{slug}` |

Esqueletos: `EsqueletoPagina forma="nichos"` y `"coleccion"`
(nuevas, con la medida real), y la landing por sus secciones
(`EsqueletoPagina secciones={…}`).

### Lo que hace

- **Nichos:** "Explora por nicho", cuántos hay y un cuadro por nicho: foto (o
  su inicial), nombre y, en texto, el tipo y cuántos productos tiene
  ("Personalizados · 7 productos"). Abajo, "Buscar productos" y "Volver a la
  tienda".
- **Un nicho o un vendedor:**
  - Migas (Inicio / Nichos / Regala con amor), la foto del nicho o el logo
    del vendedor, el nombre con su trazo y "35 productos en este nicho".
  - Debajo, la grilla de la tienda de a 12, con "Ver más productos" (y al
    llegar abajo).
  - Sin productos: "Aún no hay productos en este nicho" o "Esta tienda aún no
    tiene productos publicados".
  - No encontrado: Kapi triste y "Ver todos los nichos" o "Ir a la tienda".
- **Landing de marca:** `PaginaTienda` con las secciones guardadas. Las
  burbujas de categorías filtran el catálogo de la misma página, como en la
  tienda. Con `hideHeader` / `hideFooter`, sin cabecera o sin pie.

## Las landings del builder salen con el kit

Comprobado el 2026-10-15 contra las 18 landings de `landingPages`:

| Landings | Secciones | ¿Las dibuja el kit? |
|---|---|---|
| catas, conamorequipos, conamorgeeks, conamorparejas, factos, lumi, nova | `hero_banner`, `categories_nav`, `featured_carousel`, `sale_carousel`, `sidebar_catalog`, `marquee` | Sí (en la demo, Con Amor Geeks) |
| yoryo | `hero_carousel`, 4 × `category_carousel`, `marquee` | Sí (en la demo) |
| muebleria | `header`, `sidebar_catalog` | Sí |
| regalos-con-amor | `header`, `text`, `video`, `marquee`, `map_location`, `image` | Sí, pero hoy nadie la ve (ver abajo) |
| testing | `text` | Sí |
| reloj-kchero-2026, reloj-matador-pro-2026, combo-reloj-billetera-2026 | `announcement_bar`, `header`, `video`, `conversion_fold`, `landing_payment`, `faq_accordion` | Todo menos `conversion_fold` y `landing_payment`: son del cacherito y siguen con su componente por `respaldo` |
| deportes-top, pareja-viral, relojes-promocion, veranito-promo | ninguna | Página vacía (también hoy) |

Hoy ni `DynamicLandingPage` ni `TiendaPage` usan el kit: dibujan con su
propio `renderSection`. Migrarlas es el mismo paso que el inicio y /tienda
(INICIO.md, TIENDA.md).

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

### Reemplazos

| Hoy | Pasa a (kit) |
|---|---|
| `NichesPage` (estilos en línea, tarjetas con degradado lila) | `PaginaNichos` + `TarjetaCategoria` cuadro |
| `NichePage` y `VendorStorefrontPage` (estilos en línea, `ProductCard`, "‹ Anterior / Siguiente ›") | `PaginaColeccion` + `GrillaProductos` |
| `TiendaPage isLandingPage` dentro de `DynamicLandingPage` | `PaginaTienda` (`secciones`, `marcaActual = brandId`, `respaldo` para el cacherito) |

**Lo que no cambia:** `DynamicLandingPage` sigue resolviendo el slug (por
`slug`, sin mayúsculas, y `slugsAnteriores` → `redirigirA`), el tema
(`themeId` → `cssContent`) y el atajo del slug viejo de K-CHERO. Solo cambia
lo que dibuja.

### De dónde sale cada dato

- **Nichos:** `getNiches()` sin los `active === false`, cada uno con
  `nichoDesdeFirestore(n, { cuenta })`. `cuenta` sale de contar
  `productos_wala` por `nicheId` en la caché de productos, si está a mano;
  sin ella, solo el tipo.
- **Un nicho:** `titulo` es `niche.name`, `imagen` es `niche.imageUrl` y
  `total` es `result.total`. `productos` son las páginas de
  `searchCatalog({ facets: { nicheId: niche.slug || niche.id } })` ya
  cargadas, una tras otra. `hayMas` es `page < totalPages`.
- **Un vendedor:** `titulo` es `displayName || name`, `imagen` es `logoUrl`,
  y lo demás igual, con `{ vendorId: vendor.id }`.
- **Landing:** las secciones de `loadStorefrontPage(slug)`, `marcaActual` es
  `landing.brandId` y los productos, los mismos que reparte `TiendaPage` con
  `pageBrandId` (destacados y catálogo acotados a la marca).

### Comportamiento que no se puede perder

- `trackCollectionView` al abrir un nicho (una vez por slug).
- `GlobalLayout` (cabecera y pie) en nichos y vendedores. Las landings
  esconden la cabecera y el pie según `hideHeader` / `hideFooter`.

### Diferencias a propósito (no "corregirlas" al migrar)

- **Nichos:** la cuenta va en texto ("General · 13 productos"), no en una
  etiqueta colgante (esa es para productos). Los inactivos no salen; hoy sí.
- **Un nicho no encontrado dice que no existe.** Hoy se muestra el slug crudo
  como título con "0 productos" y "(Conecta Firebase para cargar el
  catálogo.)". Ese paréntesis es para desarrolladores y no va.
- **"Ver más" en vez de páginas numeradas**, como el resto de la tienda.
- La foto del nicho (`imageUrl`) también se ve dentro del nicho, no solo en la
  lista.

### Lo que se encontró de paso (para decidir aparte)

- `niches` está vacía en producción, y nada del sitio público enlaza a
  `/nichos`.
- Si algún día vuelven las ofertas flash: la consulta (`active == true` +
  `orderBy('order')`) necesita un índice compuesto que no está en
  `firestore.indexes.json`.
- `/nicho/<id>` no encuentra productos si el nicho tiene slug: compara el
  parámetro de la URL con `nicheId`, y el admin guarda `slug || id`. Los nichos
  sin `order` no salen (`orderBy`). `NichePage` busca dos veces al abrir.
- La landing `regalos-con-amor` no se ve nunca: la ruta `/regalos-con-amor`
  de `NuevosUsuariosPage` está declarada antes que `/:slug`.

### Pasos

1. `PaginaColeccion` en `VendorStorefrontPage` y `NichePage` (las dos chicas
   y casi iguales). Arreglar a la vez el filtro por `slug || id`.
2. `PaginaNichos` en `NichesPage`.
3. Las landings, junto con la migración del inicio y /tienda a
   `PaginaTienda` (paso 5 de MIGRACION.md): `DynamicLandingPage` deja de
   montar `TiendaPage` y monta `PaginaTienda` con `respaldo` para el
   cacherito.
