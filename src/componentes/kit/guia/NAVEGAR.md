# Navegar la tienda: las landings de marca

> **Retirado el 2026-10-16** (en la tienda y en el kit; nadie lo usaba):
>
> - **Ofertas flash y cofre diario.** En la tienda: `OfertasFlashPage`,
>   `AdminFlashOffers` (y su enlace del admin), `services/flashOffers.js` y
>   `services/chest.js`. En el kit: `PaginaOfertas`, `CofreDiario`,
>   `TarjetaOferta`, `ofertaDesdeFirestore`, `ofertasVigentes`, el esqueleto
>   `forma="ofertas"` y su demo. `/ofertas` lleva a `/tienda`.
> - **Nichos y vendedores.** En la tienda: `NichesPage`, `NichePage`,
>   `VendorStorefrontPage`, el panel `VendorPanel` (`/vendedor`), el admin de
>   Nichos, Vendedores y Pagos a vendedores (`AdminNichos`, `AdminVendors`,
>   `AdminPayouts` y sus enlaces del menú), `services/niches.js`,
>   `services/vendors.js`, `services/payouts.js` y los selectores "Nicho" y
>   "Vendedor" del formulario de producto. En el kit: `PaginaNichos`,
>   `PaginaColeccion`, `nichoDesdeFirestore`, los esqueletos `forma="nichos"`
>   y `"coleccion"` y su demo. `/nichos`, `/nicho/:slug`,
>   `/tienda-vendedor/:slug` y `/vendedor` llevan a `/tienda`.
>
> **Se dejó sin tocar:** el servidor (`openDailyChestSecure`,
> `createOrderWithSubordersSecure`, `createCheckoutPreferenceSecure` y los
> pagos: ninguna pantalla los llama; el checkout real usa
> `prepareCheckoutPayment`), las colecciones (`flashOffers`, `niches`,
> `vendors` con WALA, `payouts`) con sus reglas, y las etiquetas `vendorId` y
> `nicheId` de los productos (`products.js` sigue leyendo sus valores por
> defecto; el buscador sigue filtrando por ellas si llegan). Un producto que
> se edita conserva las suyas. Para volver, todo está en el historial de git
> (los commits dicen "retirados").

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **Landing de marca** (`/:slug`): dos
landings reales del builder, Con Amor Geeks (catálogo con filtros) y Yoryo
(carruseles por categoría). El menú Marcas de la cabecera también lleva a la
de Con Amor Geeks.

![La landing de Con Amor Geeks](landing-marca.webp)

Revisado el 2026-10-15 contra `pages/Tienda/DynamicLandingPage.jsx` →
`TiendaPage` (143 líneas). Las landings de la demo son reales:
`landingPages`, `pages/{slug}` y los productos de esas marcas, leídos con la
API pública (`demo/landings.json`).

## Partes

| Parte | Componente | Piezas que usa | Datos (en la tienda) |
|---|---|---|---|
| S1… Landing | `PaginaTienda` + `RenderSecciones` | las secciones del builder | `landingPages` (`slug`, `brandId`, `hideHeader`, `hideFooter`) y `pages/{slug}` |

Esqueleto: la landing por sus secciones (`EsqueletoPagina secciones={…}`).

### Lo que hace

`PaginaTienda` con las secciones guardadas. Las burbujas de categorías
filtran el catálogo de la misma página, como en la tienda. Con `hideHeader` /
`hideFooter`, sin cabecera o sin pie.

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
| `TiendaPage isLandingPage` dentro de `DynamicLandingPage` | `PaginaTienda` (`secciones`, `marcaActual = brandId`, `respaldo` para el cacherito) |

**Lo que no cambia:** `DynamicLandingPage` sigue resolviendo el slug (por
`slug`, sin mayúsculas, y `slugsAnteriores` → `redirigirA`), el tema
(`themeId` → `cssContent`) y el atajo del slug viejo de K-CHERO. Solo cambia
lo que dibuja.

### De dónde sale cada dato

Las secciones de `loadStorefrontPage(slug)`, `marcaActual` es
`landing.brandId` y los productos, los mismos que reparte `TiendaPage` con
`pageBrandId` (destacados y catálogo acotados a la marca).

### Comportamiento que no se puede perder

Las landings esconden la cabecera y el pie según `hideHeader` / `hideFooter`.

### Lo que se encontró de paso (para decidir aparte)

- La landing `regalos-con-amor` no se ve nunca: la ruta `/regalos-con-amor`
  de `NuevosUsuariosPage` está declarada antes que `/:slug`.
- Si algún día vuelven las ofertas flash: la consulta (`active == true` +
  `orderBy('order')`) necesita un índice compuesto que no está en
  `firestore.indexes.json`.

### Pasos

Junto con la migración del inicio y /tienda a `PaginaTienda` (paso 5 de
MIGRACION.md): `DynamicLandingPage` deja de montar `TiendaPage` y monta
`PaginaTienda` con `respaldo` para el cacherito.
