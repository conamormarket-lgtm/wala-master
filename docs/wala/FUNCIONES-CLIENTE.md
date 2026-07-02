# Funciones del Cliente — wala.pe

> Referencia funcional de **todo lo que ve y usa el CLIENTE** (el comprador) en la web pública wala.pe.
> Escrito para el dueño del negocio (perfil semi-técnico). Para cada función se indica: **qué es**, **qué hace**, **ruta** y **archivos clave**.
>
> Fuente: recorrido del enrutador `src/App.jsx` (rutas públicas y `/cuenta`) y lectura del código real de cada página. Todo lo aquí descrito está implementado en el código a fecha de este documento.
>
> Nota importante: el panel `/admin` NO está cubierto aquí (es interno, solo para administradores). Este documento es solo la **experiencia del cliente**.

---

## Tabla resumen

| Área | Ruta(s) | Estado |
|---|---|---|
| Inicio / Tienda (catálogo escalable con secciones) | `/`, `/tienda` | Activo |
| Páginas de marca (catálogo propio de cada marca) | `/ConAmor`, `/MUSSA`, `/MUEBLERIA` (vía `/:slug`) | Activo (multi-marca) |
| Catálogo con filtros (sidebar: categorías, temporadas, colecciones, marcas, tipo, etiquetas, personajes) | módulo dentro de `/`, `/tienda` | Activo |
| Nav de categorías con miniaturas por marca (burbujas que filtran el catálogo de la marca) | módulo dentro de las páginas de marca | Activo (multi-marca) |
| Ficha de producto (galería, variantes, talla, cantidad, reseñas, compartir) | `/producto/:id` | Activo |
| Editor de personalización (POD) | `/editor/:id` | Activo |
| Página "Personalizar" (listado de productos personalizables) | `/personalizar` | Activo |
| Buscador con facetas y paginación (respeta la marca activa con `?brand=`) | `/buscar` | Activo (multi-marca) |
| Directorio de nichos | `/nichos` | Activo |
| Página de un nicho | `/nicho/:slug` | Activo |
| Tienda pública de un vendedor | `/tienda-vendedor/:slug` | Activo |
| Carrito | `/carrito` | Activo |
| Checkout (incl. venta internacional) | `/checkout` | Activo |
| Pago rápido (link directo) | `/pago-rapido/:id` | Activo |
| Mi Cuenta (layout con pestañas) | `/cuenta` | Activo (requiere login) |
| Mis Compras (lista de pedidos) | `/cuenta/pedidos` | Activo |
| Detalle de compra (estado real pago + producción) | `/cuenta/pedidos/:id` | Activo |
| Lista de Deseos (privada) | `/cuenta/wishlist` | Activo |
| Lista de Deseos pública (compartible) | `/wishlist/:userCode` | Activo |
| Registro de regalos por fecha ("Mis fechas especiales") | `/regalar/:referralCode` | Activo |
| Mis Creaciones (diseños guardados) | `/cuenta/creaciones` | Activo |
| Mis Referidos | `/cuenta/referidos` | Activo |
| Fechas Importantes | `/cuenta/fechas-importantes` | Activo |
| Misiones diarias / racha / tiers | `/cuenta/misiones` | Activo |
| Catálogo de Recompensas (canje de monedas) | `/cuenta/catalogo` | Activo |
| Mi Perfil (datos + avatar) | `/cuenta/perfil` | Activo |
| Zona Arcade (hub de minijuegos) | `/minijuegos` | Activo |
| Palabra del Día (Wordle) | `/palabra-del-dia` | Activo |
| Ruleta semanal | `/ruleta` | Activo (se desbloquea con racha) |
| Ball Sort (Las Bolitas de Kapi) | `/ball-sort` | Activo |
| Mascota Kapi (botón flotante global) | en todas las páginas | Activo |
| Ofertas Flash + Cofre diario | `/ofertas` | Activo |
| Sorteos y Rifas (participar gratis / comprar ticket / ganadores) | `/sorteos` | Activo (requiere login para participar) |
| Página de enlaces (link-in-bio tipo Linktree) | `/l/:slug` | Activo (pública) |
| Suscripciones (landing) | `/suscripciones` | Activo (pagos "muy pronto") |
| Encuesta de suscripción / perfil de regalos | `/encuesta-suscripcion` | Activo |
| Login / Registro / Completar perfil / Recuperar contraseña | `/login`, `/registro`, `/completar-perfil`, `/recuperar-contrasena` | Activo |
| Landing "Regalos con Amor" (nuevos usuarios) | `/regalos-con-amor` | Activo |
| Experiencia de regalo (modo regalo) | `/regalo/:orderId` | Activo |
| Landing pages dinámicas | `/:slug` (cualquier slug) | Activo |
| Páginas legales (privacidad, términos, libro de reclamaciones) | `/politicas-privacidad`, `/terminos-y-condiciones`, `/libro-de-reclamaciones` | Activo |
| Descargar app | `/app`, `/descargar` | Activo (redirección) |

> Nota: el "Estado" indica que la función está implementada y enrutada. Algunas dependen de que el admin cargue datos (productos, nichos, recompensas, ofertas). Las suscripciones tienen los pagos mensuales pendientes de habilitar.

---

## 1. Tienda / Catálogo y filtros

### 1.1 Inicio y Tienda
- **Qué es:** la página principal (`/`) y la tienda (`/tienda`) usan el **mismo** sistema de catálogo escalable. Antes `/tienda` usaba una versión vieja (solo categoría); se unificó el 2026-06-25 para que ambas monten el catálogo completo con todos los filtros.
- **Qué hace:** la página se arma con **secciones configurables** que el admin define desde el editor visual. Cada sección es un "módulo" que se renderiza en orden. Los tipos de sección disponibles son:
  - **Encabezado** (título), **Banner Principal** (hero con imagen/video y botón), **Carrusel de imágenes**, **Carrusel de colección**, **Barra de anuncios** (texto en movimiento), **Video** (YouTube/Vimeo/archivo), **Ventas Flash** (con cuenta regresiva), **Testimonios**, **Ubicación (mapa)**, **Sellos de confianza** (trust badges), **Marquesina/carrusel de marcas** (cada logo con **forma de marco** configurable — círculo / cuadrado / estrella / pentágono — **zoom** y **posición**; la foto del logo se sube desde `/admin/marcas`), **Fila "Lo más vendido"**, **Productos destacados**, **Grilla de productos** y **Catálogo con barra lateral de filtros** (`sidebar_catalog`).
  - El orden de productos puede ser: más nuevos, precio ascendente/descendente o nombre.
  - Incluye un **banner de descarga de la app** cuando no hay filtro de categoría/búsqueda activo.
  - **Texto enriquecido por sección (sesión 2026-06-28):** los textos que el cliente ve en cada sección (título, subtítulo, encabezado, contenido…) pueden venir con **alineación**, **subrayado**, **color de fondo** y un **enlace** que vuelve el texto clicable, y las secciones de texto pueden mostrar un **botón** opcional. Todo lo configura el admin desde el Editor Visual (ver FUNCIONES-ADMIN.md → "Texto enriquecido en TODAS las secciones"); render con `src/pages/Tienda/components/textStyleUtils.jsx`. Es retrocompatible: las secciones ya configuradas se ven igual.
- **Ruta:** `/` y `/tienda` (y cualquier landing dinámica `/:slug`).
- **Archivos clave:**
  - `src/pages/Tienda/TiendaPage.jsx` (orquestador y render de secciones)
  - `src/pages/Tienda/services/storefront.js` (configuración de secciones)
  - `src/pages/Tienda/components/` (cada módulo: `HeroBanner`, `HeroCarousel`, `FlashSales`, `CollectionCarousel`, `BestSellersRow`, `Testimonials`, `TrustBadges`, `BrandMarquee`, `ProductGrid`, etc.)

### 1.2 Catálogo con filtros (barra lateral)
- **Qué es:** el módulo `sidebar_catalog`: una barra lateral (en móvil es un cajón/drawer que se abre con el botón "Filtrar y Categorías") con todos los filtros del catálogo.
- **Qué hace:** filtra los productos mostrados por:
  - **Categorías**
  - **Temporadas** — no existe una colección propia de "temporadas"; se **derivan** de las colecciones cuyo nombre coincide con palabras clave estacionales (Verano, Invierno, Navidad, San Valentín, Día de la Madre, Halloween, etc.). Si ninguna colección es estacional, no aparece esta sección.
  - **Colecciones** (las no estacionales)
  - **Marcas**
  - **Tipo de producto**
  - **Etiquetas (tags)**
  - **Personajes**
  - Botón **"Limpiar filtros"** cuando hay alguno activo. Los filtros se aplican en memoria sobre los productos ya cargados.
- **Ruta:** módulo dentro de `/` y `/tienda`.
- **Archivos clave:**
  - `src/pages/Tienda/components/SidebarCatalogLayout.jsx`
  - servicios: `src/services/collections.js`, `brands.js`, `tags.js`, `characters.js`, `productTypes.js`, `products.js`

### 1.3 Páginas de MARCA (`/ConAmor`, `/MUSSA`, `/MUEBLERIA`) — sistema multi-marca (sesión 2026-06-28, ✅ desplegado)
- **Qué es:** Walá ahora es **multi-marca**: cada producto pertenece a **una sola marca** (campo `brandId` = doc id de `tienda_brands`) y cada marca tiene su **propia página con su propio catálogo**. Las marcas actuales son **Con Amor** (`/ConAmor`, todos los productos existentes), **MUSSA** (`/MUSSA`) y **MUEBLERIA** (`/MUEBLERIA`).
- **Cómo se montan (ruteo):** no son páginas nuevas en código; reutilizan el **motor de landings dinámicas** `/:slug` → `DynamicLandingPage` → `TiendaPage`, cargando las secciones que el admin configuró para esa marca en el Editor Visual. La ruta vieja hardcodeada `/mussa` ("Próximamente") se **eliminó**; ahora `/MUSSA` cae en el catch-all `/:slug` y resuelve la landing de la marca.
- **Slug insensible a mayúsculas/minúsculas (fix `212bf0f`):** `/ConAmor`, `/CONAMOR` y `/conamor` abren la **misma** página. `getLandingPageBySlug` hace un *fallback* en memoria si el match exacto falla, y `DynamicLandingPage` pasa el **slug guardado (canónico)** como `pageIdOverride` a `TiendaPage`, para que todas las variantes de mayúsculas lean y guarden las **mismas** secciones (no se parten por *case*).
- **Catálogo acotado a la marca:** la página de marca lleva un módulo **"Catálogo con Sidebar"** (`sidebar_catalog`) con el **`brandId` de la marca** configurado. `TiendaPage` arranca el catálogo paginado con la faceta `{ type:'brand', value: brandId }`, de modo que `getStoreProductsPage` trae **solo los productos de esa marca** (filtrado **server-side**: `where('brandId','==',...)`, ver `facetToWhere` en `products.js`). La categoría elegida en el sidebar se aplica como **filtro de cliente** (Firestore permite una sola faceta + orden por query, así que la marca va en servidor y la categoría en cliente). Es **retrocompatible**: sin `brandId`, el catálogo es **global** (la home y `/tienda` siguen mostrando todo).
- **Nav de categorías con miniaturas (estilo M\*\*\*SHAKES):** la página de marca puede llevar también un módulo **"Navegación por categorías"** (`categories_nav`) con el `brandId` de la marca. Muestra **burbujas redondas con miniatura** (las categorías que el admin armó para esa marca, ver FUNCIONES-ADMIN.md → panel por marca). Al pulsar una burbuja, **filtra el catálogo de la misma página** por esa categoría (modo "filtro local": no navega a `/tienda?categoria=`, solo fija la categoría en memoria), conservando la marca; la burbuja **"Todos"** la quita. La categoría activa se **comparte** entre el nav y el sidebar (estado elevado en `TiendaPage`), así ambos quedan sincronizados.
- **Ruta:** `/ConAmor`, `/MUSSA`, `/MUEBLERIA` (y cualquier slug de marca futura, vía `/:slug`).
- **Archivos clave:**
  - `src/pages/Tienda/DynamicLandingPage.jsx` (pasa `pageIdOverride` = slug canónico), `src/pages/Tienda/TiendaPage.jsx` (faceta inicial por marca + estado `navCategoryId` compartido)
  - `src/pages/Tienda/components/VisualCategoryNav/VisualCategoryNav.jsx` (burbujas con miniatura; modo "filtro local" `onSelectCategory` vs. modo enlace global)
  - `src/pages/Tienda/components/SidebarCatalogLayout.jsx` (acepta categoría controlada por el nav)
  - `src/services/products.js` (`getProductsByBrand`, faceta `brand` en `getStoreProductsPage`), `src/services/brands.js` (`slug`, `categoryNav`)
  - `src/App.jsx` (ruta `/mussa` hardcodeada retirada; `/:slug` → `DynamicLandingPage`)

### 1.3-bis AISLAMIENTO ENTRE MARCAS — el sidebar, el Header y la búsqueda ya NO mezclan Con Amor con MUSSA/MUEBLERIA (sesión 2026-06-29/30, ✅ desplegado)
- **Qué era el problema:** aunque el catálogo de la página de marca ya venía acotado por `brandId` (ver §1.3), el **sidebar de filtros** y el **Header** seguían mostrando las **categorías/etiquetas/colecciones globales** (= las de Con Amor, que es un mercado totalmente distinto) porque esas taxonomías eran colecciones Firestore sin `brandId` y ni el sidebar ni el Header sabían en qué página de marca estaban.
- **Sidebar de filtros aislado por marca:** en `/MUSSA` y `/MUEBLERIA`, el sidebar ("Filtrar y Categorías") deriva sus opciones de **categorías, colecciones/temporadas, etiquetas, personajes y tipo de producto** SOLO de los productos que de hecho pertenecen a esa marca — ya no aparecen etiquetas ni colecciones que solo existen en Con Amor. El filtro **"Marcas"** directamente **no aparece** dentro de una página de una sola marca (no tendría sentido). Fuera de una página de marca (Con Amor, `/tienda`, home), el sidebar se ve **exactamente igual que siempre**.
- **Menú del Header consciente de la marca:** al navegar dentro de `/MUSSA` o `/MUEBLERIA`, el **mega-menú de categorías** del Header deja de mostrar categorías que en realidad pertenecen a Con Amor, y el enlace **"Ver Todo el Catálogo"** lleva a la página de **esa misma marca** (no salta a `/tienda`, que mezclaría todo).
- **Carruseles, ofertas flash y destacados por marca:** los carruseles de colección y las ofertas flash que se colocan en una página de marca muestran **solo productos de esa marca**; lo mismo la sección de productos destacados cuando está configurada con marca.
- **Indicador "Estás en: `<Marca>`":** en las páginas de marca aparece una franja sutil arriba del contenido con el **logo y el nombre** de la marca activa (MUSSA, MUEBLERIA, etc.), para que quede claro en qué catálogo está navegando el cliente. No aparece en páginas globales.
- **WhatsApp flotante por marca:** el botón flotante de WhatsApp, dentro de una página de marca, escribe al **asesor de esa marca** (si la marca tiene su propio número configurado); si un producto puntual tiene su propio número de WhatsApp, ese sigue ganando. Fuera de una página de marca, usa el número general de la tienda de siempre.
- **Mensajes propios de la tienda:** si el dueño configuró un título, subtítulo o mensaje de "catálogo vacío" propios para la marca, la página los muestra en vez del texto genérico; si no los configuró, se ve el mensaje de siempre.
- **Búsqueda respeta la marca activa (ver también §4):** el botón de buscar, estando en una página de marca, abre el buscador **ya filtrado a esa marca** (con opción de volver a buscar en todo el catálogo).
- **Vista por categoría respeta la marca:** al entrar a una categoría desde el nav o el sidebar de una página de marca, los resultados **no se mezclan** con productos de otras marcas.
- **Retrocompatible:** en Con Amor y en cualquier página sin marca, todo se comporta **exactamente igual que antes** de este ciclo — nada de esto se activa sin una marca de por medio.
- **Archivos clave:** `src/pages/Tienda/components/SidebarCatalogLayout.jsx`, `src/pages/Tienda/TiendaPage.jsx`, `src/components/common/Header/Header.jsx`, `src/components/common/WhatsAppButton/WhatsAppButton.jsx`, `src/pages/Tienda/components/CollectionCarousel/CollectionCarousel.jsx`, `src/pages/Tienda/components/FlashSales/FlashSales.jsx`, `src/services/products.js` (`getCategories` unificado, `getProductsByCollection`, `getFeaturedProducts`, `getProductsByCategory`). Detalle técnico completo en [PLAN-MULTIMARCA.md](./PLAN-MULTIMARCA.md) → "Estado real de implementación — Ciclo de AISLAMIENTO (P0–P2)".

---

## 2. Ficha de producto (`/producto/:id`)

- **Qué es:** la página de detalle de un producto (PDP). Soporta productos simples y **combos** (paquetes de varios sub-productos).
- **Producto borrado por el admin (soft-delete, sesión 2026-07-01, ✅ desplegado):** si el producto fue **eliminado (archivado)** del catálogo, la ficha muestra **"Ya no está disponible"** y **no deja comprarlo ni personalizarlo** (lo mismo aplica al editor `/editor/:id`). Los enlaces viejos (historial, wishlist compartida, WhatsApp) ya **no caen en una página rota**: el producto conserva su nombre e imagen aunque esté archivado.
- **Qué hace:**
  - **Galería** de imágenes con miniaturas y **zoom** al pasar el mouse; las imágenes se arman según la variante/color seleccionado y las vistas de personalización (frente/espalda).
  - **Selector de color** (variantes con swatch de imagen o color) y **selector de talla**.
  - En combos: selector de talla y color por cada sub-producto, con vista previa compuesta.
  - **Selector de cantidad** (+/−).
  - **Precio** con soporte de precio original tachado y **badge de descuento** (%).
  - Botón **"Agregar al carrito"** (o "Agotado" si no hay stock).
  - **Compra directa — botones "Comprar" / "Comprar todo el carrito" (sesión 2026-06-29, ✅ desplegado):** además del "Agregar al carrito", la ficha tiene dos botones que llevan **directo a la pasarela de pago** (`/checkout`) sin pasar por la página del carrito:
    - **"Comprar"** (solo si hay stock): agrega **ESTE** producto al carrito dejándolo como **único seleccionado** (los demás ítems del carrito quedan en `selected:false`, **no se borran**) y navega a `/checkout`, de modo que el checkout cobra **solo este producto**. Usa `addToCart(..., { selectOnly:true, silent:true })`.
    - **"Comprar todo el carrito"** (solo si el carrito no está vacío): marca **todos** los ítems del carrito como seleccionados (`selectAllItems()`) y navega a `/checkout` con todo cargado.
    - Se apoya en la **selección de ítems** ya existente del carrito (patrón "No comprar esta vez", §6.1-bis); el camino de "Agregar al carrito" no cambia. Lógica: `CartContext.jsx` (`selectOnly`, `selectAllItems`), handlers `handleComprarAhora` / `handleComprarCarrito` en `ProductDetail.jsx`.
  - Botón **"Personalizar"** → lleva al editor `/editor/:id` pasando talla/color elegidos. Si el producto usa el sistema "Yoryo Personalizado", el botón dice **"Personalizable"** y abre ese flujo (requiere login; permite reusar diseños previos).
  - **Sellos de confianza:** "Envío a todo el país", "Cambios y devoluciones", "Pago seguro".
  - **Descripción** enriquecida (acordeón). Dentro de la descripción puede haber botones tipo `cuestionario://` que abren un **modal de cuestionario** del producto.
  - **Reseñas** del producto (`ProductReviews`).
  - Botón **Compartir** que genera un enlace de referido (`?ref=...&shareId=...`) y lo copia; gana monedas si alguien compra por ese enlace (requiere login).
  - Registra analítica de vista de producto y comportamiento por variante.
- **Ruta:** `/producto/:id`
- **Archivos clave:**
  - `src/pages/ProductPage.jsx` (carga producto + categorías)
  - `src/pages/Tienda/components/ProductDetail/ProductDetail.jsx` (toda la ficha)
  - `src/pages/Tienda/components/ProductCuestionarioModal/`, `ProductReviews/`, `ComboProductImage/`
  - `src/components/YoryoPersonalizadoCliente/` (flujo "Personalizable")

---

## 3. Editor de personalización (POD) (`/editor/:id`)

- **Qué es:** el editor visual donde el cliente diseña su prenda/producto personalizado (Print On Demand).
- **Qué hace:**
  - Carga el producto y sus **vistas de personalización** (p. ej. Frente, Espalda) con sus **zonas de impresión** (print areas).
  - Permite agregar **capas**: textos e imágenes, moverlas y ajustarlas dentro de la zona.
  - Selector de **talla** y **color** (si es ropa); cambia la imagen base según el color.
  - Pestañas para cambiar de **vista** (frente/espalda) y botón **"Restablecer diseño original"**.
  - **Combos:** usa un editor especial (`ComboUserEditor`) para personalizar cada sub-producto sin tocar el producto original del admin.
  - **Guardar diseño:** lo guarda en "Mis Creaciones" del usuario (requiere login; si no está logueado, abre un modal invitando a iniciar sesión o registrarse).
  - **Agregar al carrito:** si tiene diseño y está logueado, hace un **autoguardado silencioso** antes de ir al carrito; genera la miniatura del diseño (y renders por lado para el sistema interno/ERP en combos). Si no se añadió ningún diseño, pregunta si desea agregar sin personalizar.
  - **Protección anti-pérdida:** si hay cambios sin guardar, intercepta el botón "atrás", el cierre de pestaña y los clics a otros enlaces, mostrando un modal "¿Salir sin guardar?".
  - Si vuelve a abrir un producto que ya estaba personalizando, ofrece **"Continuar Editando"** o ver el producto original.
- **Ruta:** `/editor/:id` (acepta `?size=`, `?color=`, `?designId=`, `?comboSelections=`)
- **Archivos clave:**
  - `src/pages/EditorPage.jsx`
  - `src/contexts/EditorContext.jsx`
  - `src/components/admin/AdminViewEditor/AdminViewEditor.jsx` (lienzo reutilizado en modo "designOnly")
  - `src/components/editor/ComboUserEditor/ComboUserEditor.jsx`
  - `src/services/designs.js` (guardar/recuperar diseños)

### 3.1 Página "Personalizar" (`/personalizar`)
- **Qué es:** una vitrina que lista **solo los productos personalizables** (`customizable !== false`).
- **Qué hace:** muestra la grilla de productos que se pueden personalizar; si está vacía, invita a entrar a la tienda y usar "Crear/Personalizar". También es el destino del enlace "Ir a personalizar" desde "Mis Creaciones".
- **Archivos clave:** `src/pages/PersonalizarPage.jsx`

---

## 4. Buscador (`/buscar`)

- **Qué es:** página de búsqueda y descubrimiento con **facetas y paginación** (Fase 1).
- **Qué hace:**
  - Barra de búsqueda por texto (busca en nombre, descripción, etiquetas y categorías).
  - **Facetas (chips):** tipo de cumplimiento **"Personalizado"** vs **"En stock"**, y por **nicho** (con conteo de resultados). El servicio de búsqueda también soporta facetas por vendedor, marca, categoría, colección, etiqueta, precio y "personalizable".
  - **Orden:** más nuevos, precio menor→mayor, precio mayor→menor, nombre A-Z.
  - **Paginación** (24 por página) con "Anterior / Siguiente".
  - La búsqueda de la tienda (la barra del catálogo) redirige aquí con `?q=...`.
  - `searchCatalog` filtra/ordena/pagina **en memoria** sobre el catálogo cacheado; está preparado para conectarse a Algolia/Typesense/Meilisearch en el futuro sin cambiar la interfaz.
  - **Búsqueda por Firestore que escala (sesión 2026-06-28):** `search.js` añade `searchProductsFirestore`, que resuelve la búsqueda **directamente en Firestore** (sin servicio externo) usando los campos derivados en write-time del producto (`nameLower` + `searchTokens`, ver `products.js`), con paginación **por cursor**. Dos estrategias: **prefijo** (por defecto: rango `nameLower >= q` … `< q+SENTINEL`, todo lo que empieza por `q`) y **token** (`searchTokens array-contains q`, coincide en cualquier palabra del nombre). **Fallback automático a la búsqueda en memoria** si los productos aún no tienen `nameLower`/`searchTokens` (antes del backfill) o si la query falla, así nunca deja de buscar.
  - **Filtro de marca activa (sesión 2026-06-30, aislamiento entre marcas P2b, ✅ desplegado):** cuando el cliente busca **estando dentro de una página de marca** (`/MUSSA`, `/MUEBLERIA`), el ícono de buscar del Header lo manda a `/buscar?...&brand=<id>` en vez de al buscador global. `SearchPage.jsx` lee ese parámetro `brand` y **filtra los resultados en cliente** por `p.brandId`; el filtro se **conserva** aunque el cliente cambie el término de búsqueda, y aparece un indicador **"Buscando en: `<Marca>`"** con un botón para **quitar el filtro y buscar en todo el catálogo**. Sin el parámetro `brand` (búsqueda desde la home/`/tienda`), el buscador funciona **exactamente igual que siempre** (todas las marcas).
- **Ruta:** `/buscar?q=...` (y `?brand=<id>` opcional dentro de una página de marca)
- **Archivos clave:**
  - `src/pages/SearchPage.jsx`
  - `src/services/search.js` (`searchCatalog`, `searchProductsFirestore`)
  - `src/services/products.js` (campos derivados `nameLower` / `searchTokens`, `getProductsByCategory` con `brandId` opcional)
  - `src/constants/marketplace.js` (`FULFILLMENT_TYPES`)
  - `src/components/common/Header/Header.jsx` (agrega `?brand=` al enlace de búsqueda en página de marca)

---

## 5. Nichos y tiendas de vendedor (multi-vendor, Fase 1)

### 5.1 Directorio de nichos (`/nichos`)
- **Qué es:** vitrina de todos los nichos disponibles en tarjetas.
- **Qué hace:** lista cada nicho (con imagen o inicial y una etiqueta de tipo: "Personalizados" / "General"); cada tarjeta enlaza a `/nicho/<slug>`. Si no hay nichos, indica que se creen en el admin.
- **Archivos clave:** `src/pages/NichesPage.jsx`, `src/services/niches.js`

### 5.2 Página de un nicho (`/nicho/:slug`)
- **Qué es:** muestra los productos de un nicho concreto.
- **Qué hace:** filtra el catálogo por `nicheId` (usando el buscador interno), muestra el nombre del nicho y sus productos paginados. Funciona con el nicho por defecto aunque la colección de nichos esté vacía.
- **Archivos clave:** `src/pages/NichePage.jsx`

### 5.3 Tienda pública de un vendedor (`/tienda-vendedor/:slug`)
- **Qué es:** la "tienda" pública de un vendedor del marketplace.
- **Qué hace:** busca el vendedor por slug (muestra su nombre y logo) y lista **sus** productos filtrando por `vendorId`, con paginación. Si el vendedor no tiene productos, lo indica y ofrece explorar otros.
- **Archivos clave:** `src/pages/VendorStorefrontPage.jsx`, `src/services/vendors.js`

> Nota: existe también `/vendedor` (`VendorPanel`), que es el **panel del propio vendedor** para gestionar su tienda; no es navegación de comprador.

---

## 6. Carrito y Checkout

### 6.1 Carrito (`/carrito`)
- **Qué es:** el carrito de compras.
- **Qué hace:** muestra los ítems agregados (incluyendo personalizados y combos), permite continuar comprando y avanzar al checkout. La lógica del listado vive en el componente `Cart`.
- **Archivos clave:** `src/pages/CartPage.jsx`, `src/pages/Tienda/components/Cart/`, `src/contexts/CartContext.jsx`

### 6.1-bis Carrito — Selección de productos ("No comprar esta vez") (sesión 2026-06-27, ✅ desplegado)
- **Qué es:** la posibilidad de **elegir qué productos del carrito pagar ahora y cuáles dejar guardados para después**, sin tener que eliminarlos. Es el patrón estándar de Amazon / MercadoLibre / Falabella.
- **Qué hace (para el cliente):**
  - Cada ítem del carrito tiene un botón **"No comprar esta vez"**. Al pulsarlo, ese producto queda **atenuado** y **no se cobra** en esta compra, pero **permanece en el carrito** (no se borra). El botón cambia a **"✓ Comprar esta vez"** para volver a incluirlo cuando quiera (es reversible).
  - Por defecto **todos los productos están seleccionados** (se compran). Solo lo que el cliente marque como "No comprar esta vez" queda fuera.
  - El **subtotal, el total y el contador del carrito** dejan de contar los productos no seleccionados: solo suman lo que sí se va a comprar.
  - Cuando hay productos excluidos, el carrito muestra un **aviso** del tipo **"N artículo(s) no se comprarán esta vez (quedarán en tu carrito)"**.
  - En el checkout **solo se cobra y se registra lo seleccionado** (el resumen del pedido, el monto, el mensaje de WhatsApp y la marca de regalos consideran únicamente esos productos). Si el cliente deseleccionó **todo**, el pago se **bloquea** con un aviso pidiendo elegir al menos un producto.
  - Tras pagar, **los productos no comprados PERSISTEN** en el carrito (listos para una próxima compra); solo desaparecen los que se pagaron.
- **Archivos clave:** `src/contexts/CartContext.jsx` (flag `selected`; `getTotalItems`/`getTotalPrice` excluyen los no seleccionados; `toggleItemSelected`, `clearSelectedItems`), `src/pages/Tienda/components/CartItem/CartItem.jsx` (botón y fila atenuada), `src/pages/Tienda/components/Cart/Cart.jsx` (aviso), `src/pages/CheckoutPage.jsx` (cobra/registra solo lo seleccionado; al pagar usa `clearSelectedItems` para conservar el resto).

### 6.1-ter Carrito — color que no se pierde + higiene de sesión (sesión 2026-07-01, ✅ desplegado)
Cuatro arreglos del carrito (`src/contexts/CartContext.jsx`, commit `88a3368`), sin tocar montos ni el flujo de cobro:
- **El COLOR elegido ya no se pierde:** al agregar un producto con variante de color, `addToCart` **normaliza `variant.color`** (lo toma de `selectedVariant.name` si la variante no traía el campo `color`), así el color llega al carrito, al pedido y al mensaje de WhatsApp. Antes algunos productos llegaban al pedido "sin color" aunque el cliente lo hubiera elegido.
- **Cerrar sesión limpia el carrito:** al hacer **logout**, el carrito visible se vacía — en una **PC compartida**, la siguiente persona no hereda el carrito del anterior. El flujo normal (llenar carrito anónimo → iniciar sesión → conservarlo) **no cambia**.
- **Sin cruces entre cuentas:** la sincronización del carrito con Firestore ya **no puede mezclar carritos de dos cuentas** distintas que usen el mismo navegador.
- **Varias pestañas a la vez:** si tienes la tienda abierta en varias pestañas, el carrito se **re-hidrata** entre ellas con un guard anti-ciclo (no se pisa a sí mismo).
- Extra: **"Agregar todo al carrito"** (wishlist) respeta el **stock real** (`inStock`), y regalar desde una wishlist pública conserva la **imagen** en productos con variantes.

### 6.2 Checkout (`/checkout`) — incluye VENTA INTERNACIONAL
- **Qué es:** el formulario de datos de envío + selección de método de pago.
- **Qué hace (datos de envío):**
  - **País** (selector con autodetección por geolocalización; no pisa la elección manual ni el país del perfil). Default seguro: Perú (`PE`).
  - **Nombre completo**, **Documento**, **Teléfono internacional**, **Email**, **Ciudad/Región** (Lima / Callao / Provincias), **Distrito** y **Dirección exacta**.
  - **Documento condicional (tipos DNI/CE/Pasaporte):** si el país es **Perú**, se elige el **tipo de documento de una lista cerrada — DNI / Carnet de Extranjería (CE) / Pasaporte** (`src/constants/documentTypes.js`); para **otros países** el documento es un **campo abierto único** ("Documento de identidad nacional", solo requerido).
  - **Teléfono internacional:** componente con código de país (`PhoneIntlInput`); guarda el número completo (código + número local).
  - **Modo Regalo (gratis):** activa una experiencia digital para el destinatario (nombre del destinatario, mensaje de máx. 200 caracteres y sticker de Kapi: Amor/Fiesta/Feliz).
  - **Monedas (KapiSol):** si el usuario tiene monedas, puede aplicarlas como descuento (hasta el 50% del subtotal). Las monedas usadas se "congelan" en estado de espera hasta confirmar.
  - **Envío:** gratis si el subtotal (con descuento) supera S/100; si no, S/15.
- **Qué hace (pago — diferenciado por país):**
  - Al confirmar, **crea el pedido en `pedidos_web` con `createWebOrder` (un único punto de creación para los 3 métodos de pago: Culqi, PayPal y WhatsApp/Yape-Plin-transferencia)**, arma un mensaje de WhatsApp con el detalle, procesa referidos y regalos de wishlist, y actualiza el perfil del usuario con sus datos. El pedido se marca con **`canalVenta: 'Portal Web'`** (más respaldos `web:true`, `activador:'portal_web'`, `vendedor:'Portal Web'`), que es lo que luego permite que "Mis Compras" y "Recepción de Pedidos" lo reconozcan como pedido del portal.
  - **Documento normalizado al guardar (fix `de1594b`, sesión 2026-06-28):** `createWebOrder` **normaliza el documento** (`clienteNumeroDocumento`/`dni`: `trim` + quita espacios) para que **case con el filtro exacto** del perfil en "Mis Compras" (que busca por el DNI normalizado); conserva el valor original tecleado en `dniRaw`. Antes el pedido se guardaba sin normalizar y no aparecía en el historial del cliente.
  - **Marca de la marca (brandId) por línea de producto:** cada producto del pedido persiste su **`brandId`** (también en los sub-productos de un combo), para poder enrutar después el WhatsApp de "Mis Compras" al **asesor de la marca correcta**.
  - **Aviso si el pedido NO se guarda (fix `de1594b`, sesión 2026-06-28):** si `createWebOrder` falla o no devuelve `id`, el checkout **avisa al cliente** con un toast ("No pudimos registrar tu pedido, intenta de nuevo o contáctanos.") y **aborta ANTES de mostrar el pago** (no abre WhatsApp ni Culqi/PayPal fingiendo éxito). Antes el error se tragaba silenciosamente y el flujo seguía como si todo hubiera salido bien aunque nada quedara guardado.
  - **Perú:** ofrece **Culqi** (tarjeta) **o** acordar pago por **WhatsApp (Yape / Plin / Transferencia)**. Para Culqi, el checkout **abre el formulario de pago automáticamente** (auto-cobro).
  - **Internacional:** ofrece **PayPal** (Culqi queda oculto) **o** acordar pago por WhatsApp.
  - **Moneda local + USD (sesión 2026-06-27):** el checkout muestra el total en la **moneda local del país del comprador** (con su nombre natural) y, para pagos por PayPal, el aviso **"Pagarás X USD por PayPal"** (PayPal cobra en USD). El tipo de cambio se lee de `config/fx` (poblado a diario por la Cloud Function `updateFxRate`) con un margen y un *fallback* si la config no está disponible; hay un monto mínimo de PayPal de 1 USD.
  - **Aviso de envío internacional:** si el país NO es Perú, muestra el aviso **"la entrega demora de 7 a 30 días hábiles"** (tanto en la pantalla de pago como en el mensaje de WhatsApp).
  - **Confirmación de pago en backend (endurecida — SEGURO POR DEFECTO, sesión 2026-06-28):** el pago con Culqi se confirma server-side: `processCulqiPayment` **recalcula el monto** desde el pedido real (`pedidos_web`/`pedidos`), cobra con la llave privada y aplica **idempotencia por `tokenId`** mediante el lock `culqiCharges`.
    - **El cobro de Culqi MARCA el pedido como pagado (fix `e84b6b1`, sesión 2026-06-28):** tras un cobro exitoso (dentro de la rama protegida por el lock, una sola vez por cobro real), `processCulqiPayment` **escribe en `pedidos_web`** los mismos campos que el webhook: `pagado:true`, `estadoPago:"pagado"`, `culqiChargeId`, `montoPagado`, `montoPendiente:0`, `pagadoAt`, `metodoPago:"culqi"`. Es **best-effort** (si esa escritura falla, NO rompe la respuesta del cobro, que ya ocurrió) e **idempotente**. Antes el cobro funcionaba pero el pedido quedaba indistinguible de uno sin pagar, y "Recepción de Pedidos" no podía separar pagados de "por confirmar pago". **Requiere redeploy de la CF por el dueño** (`firebase deploy --only functions:processCulqiPayment`).
    - **`culqiWebhook` = respaldo:** la Cloud Function `culqiWebhook` también marca el pedido (`pedidos_web`) como pagado de forma **idempotente** (colección `culqiWebhookEvents`), pero hoy actúa solo como **mecanismo de respaldo**: para que se dispare, **su URL debe estar registrada en el panel de Culqi** (mientras no lo esté, quien marca el pedido es `processCulqiPayment`).
    - La verificación de firma del webhook y la verificación de propiedad de la orden vienen detrás de flags **apagados por defecto** (`CULQI_VERIFY_SIGNATURE`, `ENFORCE_PAYMENT_OWNERSHIP`), así que desplegar el backend no cambia el cobro actual; ver el catálogo y los flags en [FUNCIONES-ADMIN.md → "Cloud Functions (backend)"](./FUNCIONES-ADMIN.md).
    - Para **PayPal** existe además un flujo **server-side seguro** (`createPaypalOrderSecure` / `capturePaypalOrderSecure`) que recalcula el USD y valida la captura en el servidor antes de marcar el pedido pagado en `pedidos_web`; el componente cliente `PaypalCheckout` lo usa **solo si el flag de build `VITE_PAYPAL_SERVER_SIDE` está en `'true'`** (default OFF = flujo PayPal cliente histórico). *(Nota operativa: la URL de `culqiWebhook` debe estar registrada en el panel de Culqi y `REACT_APP_PAYPAL_CLIENT_ID` debe existir en Vercel para que PayPal cobre en producción y no en sandbox.)*
  - **"Plan B" si el cliente cierra Culqi sin pagar (sesión 2026-06-27):** el modal de Culqi se **auto-abre una sola vez** (fix del doble-popup). Si el cliente lo **cierra/cancela sin pagar**, aparece una **tarjeta de recuperación** con **dos botones grandes**: (a) **"Continuar comprando con tarjeta"**, que **vuelve a abrir** el formulario de Culqi (reintento), y (b) **terminar la compra por WhatsApp** (el pedido ya quedó guardado y el asesor recibe la lista completa para coordinar Yape/Plin/transferencia).
  - **WhatsApp por marca + número principal "Todo a WALA" (sesión 2026-06-27):** el botón de "terminar por WhatsApp" usa por defecto el **número principal "Todo a WALA"** (configurable en `/admin/marcas`; fábrica `+51924426791`). Si el administrador activa el **toggle de confirmación multimarca**, y el pedido tiene productos de varias marcas con su propio `whatsappNumber`, se muestra **un botón por marca** y **cada asesor recibe SOLO sus productos**; con el toggle desactivado, todo va al número principal.
  - **Validación del documento (sesión 2026-06-27):** se relajó la validación para no bloquear silenciosamente el botón de pago — el documento exige **≥3 caracteres** (cualquier tipo); si hay un campo con error, muestra un aviso (toast) y hace scroll al primero. En Perú el DNI sigue marcándose como tal.
  - **Selección de compra (sesión 2026-06-27):** el checkout solo cobra y registra los productos marcados como **"Comprar esta vez"** en el carrito (ver §6.1-bis); el monto, el resumen del pedido, el mensaje de WhatsApp y la marca de regalos consideran únicamente esos ítems. Si no hay ninguno seleccionado, el pago se bloquea.
  - Tras el pago/confirmación, **quita del carrito solo los productos pagados y conserva los marcados como "No comprar esta vez"** (antes vaciaba todo el carrito), y lleva a "Mis Pedidos". Emite eventos de analítica (inicio de checkout y compra completada).
  - **La compra por WhatsApp también cuenta como compra (fix de analítica, sesión 2026-07-01):** el botón **"Listo, ya envié mis pedidos"** del flujo WhatsApp/Yape/Plin ahora **emite `purchase_complete`** (idempotente, fuera de la lógica de pago). Era la **causa real de la "conversión 0 %"** del dashboard: la mayoría de compras cierran por WhatsApp y no se estaban contando. No cambia nada del cobro.
  - **Imagen del producto congelada en el pedido (sesión 2026-07-01):** cada línea del pedido guarda `urlImagen` (la imagen del producto AL COMPRAR), para que "Mis Compras" muestre la foto correcta **aunque el producto se borre o cambie después** (ver §7.2).
- **Ruta:** `/checkout`
- **Archivos clave:**
  - `src/pages/CheckoutPage.jsx`
  - `src/components/intl/CountrySelect.jsx`, `src/components/intl/PhoneIntlInput.jsx`
  - `src/constants/documentTypes.js` (tipos DNI/CE/Pasaporte)
  - `src/services/geo.js` (autodetección de país)
  - `src/components/CulqiCustomCheckout/` (auto-open único + `onClose` para el Plan B), `src/components/PaypalCheckout/`
  - `src/services/messages.js` (`whatsapp_number_main`, `whatsapp_multimarca`), `src/services/brands.js` (`whatsappNumber` por marca)
  - `src/services/erp/firebase.js` (`createWebOrder`), `src/services/referrals.js`, `src/services/wishlist.js`

### 6.3 Pago rápido (`/pago-rapido/:id`)
- **Qué es:** página para pagar un pedido directamente desde un enlace (sin pasar por todo el carrito).
- **Archivos clave:** `src/pages/PagoRapidoPage.jsx`

---

## 7. Mi Cuenta (`/cuenta`)

- **Qué es:** el área privada del cliente, con un layout de **pestañas**. Requiere iniciar sesión (si no, muestra un mensaje para loguearse).
- **Pestañas:** Mis Pedidos, Lista de Deseos, Mis Creaciones, Mis Referidos, Fechas Importantes, Misiones, Catálogo Recompensas, y el botón "Mi Perfil".
- **Navegación de pestañas (sesión 2026-06-29, ✅ desplegado):** en **desktop** los tabs se reparten en **dos líneas** (`flex-wrap: wrap`) para que no se corten ni saturen; en **móvil** la barra de tabs (`<nav>`) hace un **auto-scroll de "asomo"** al montar (si los tabs no caben: dos asomos lentos de ~56 px a la derecha y vuelta a 0) como **pista visual** de que hay más pestañas deslizables (no asoma si todo cabe, comprueba `scrollWidth > clientWidth`).
- **Archivo clave del layout:** `src/pages/CuentaLayout.jsx` (+ `src/pages/CuentaPage.module.css`)
- (Entrar a `/cuenta` o `/pedidos` redirige a `/cuenta/pedidos`.)

### 7.1 Mi Perfil (`/cuenta/perfil`)
- **Qué es:** datos personales + saldo de recompensas + avatar.
- **Qué hace:**
  - **Datos personales:** nombre, país, documento y teléfono. En Perú se ofrece una **lista cerrada de tipo de documento — DNI / Carnet de Extranjería (CE) / Pasaporte** (`src/constants/documentTypes.js`) con su validación; fuera de Perú el documento es un **campo abierto único** ("Documento de identidad nacional") y el teléfono es internacional. También **fecha de nacimiento** (cumpleaños).
  - **Cartera de recompensas (KapiSol):** muestra el saldo de monedas y las monedas "en espera"; código de referido copiable.
  - **Avatar Studio (foto de perfil):** configurador de avatar propio (tono de piel, peinado, ojos, boca, accesorio, peso/altura y "vestir" con productos de ropa del catálogo). **Reemplaza** el antiguo flujo de avatar 3D (Ready Player Me, descontinuado): ya **no** depende de ese servicio externo.
  - Cerrar sesión.
- **Archivos clave:** `src/pages/cuenta/PerfilPage.jsx`, `src/components/profile/AvatarStudio.jsx`, `src/constants/documentTypes.js`

### 7.2 Mis Compras / Mis Pedidos (`/cuenta/pedidos` + detalle `/cuenta/pedidos/:id`) — estilo MercadoLibre (sesión 2026-06-27)
- **Qué es:** el historial de pedidos del cliente con un **estado de compra real** y una **página de detalle por pedido**, al estilo "Mis Compras" de MercadoLibre.
- **Qué hace (lista, `/cuenta/pedidos`):** busca los pedidos por el **DNI/documento** del perfil (en el ERP, con `searchOrdersByDniInERP`). Si falta el documento, pide completar el perfil; si no hay pedidos, lo indica e invita a la tienda. Cada pedido muestra un **badge de estado** y enlaza a su detalle.
- **Tarjeta de compra clickeable completa (sesión 2026-06-29, ✅ desplegado):** **toda** la tarjeta del pedido es clickeable (no solo un enlace dentro), con navegación programática al detalle `/cuenta/pedidos/:id` (`role="link"` + `tabIndex={0}` + `onClick`/`onKeyDown`, también accesible por teclado).
- **Búsqueda por DNI normalizado + respaldo con DNI crudo (fix `de1594b`, sesión 2026-06-28):** `searchOrdersByDniInERP` busca primero por el **documento normalizado** (`trim` + sin espacios) en `pedidos` y `pedidos_web` — que es como lo guarda ahora `createWebOrder`. Si esa búsqueda da **0 resultados** y el valor original difería del normalizado, **reintenta con el DNI crudo** (tal cual se tecleó), para **rescatar pedidos históricos** guardados antes de la normalización. Así un cliente cuyo documento antiguo tenía espacios igual ve sus compras viejas.
- **El historial NO se rompe si el producto se borra del catálogo (sesión 2026-07-01, commit `88a3368`, ✅ desplegado):** "eliminar" un producto en el admin ahora es un **archivado** (soft-delete) que conserva nombre, imágenes y precio, y la lista y el detalle de compra leen el catálogo **incluyendo esos archivados** (`useProducts` con `includeHidden`) con **respaldo en la imagen congelada del propio pedido** (`linea.urlImagen`). Resultado: una compra vieja **siempre** muestra su nombre y su foto — nada de imágenes rotas ni "producto desconocido" porque el admin limpió el catálogo. *(Para productos borrados físicamente ANTES de este cambio existe el script de rescate del admin, ver [PENDIENTES.md](./PENDIENTES.md).)*
- **Filtrado a SOLO pedidos de WALA (sesión 2026-06-27):** el visor muestra únicamente las compras hechas por el **portal de clientes** y no otros pedidos del ERP (mayoreo, tienda física, etc.). `usePedidos.js` filtra con `esPedidoWala`: un pedido es de WALA si trae `canalVenta:'Portal Web'` (o, como respaldo, `web:true` / `activador:'portal_web'` / `vendedor:'Portal Web'`), que es lo que escribe el checkout del portal.
- **Qué hace (detalle, `/cuenta/pedidos/:id`):**
  - Muestra un **estado de compra unificado** que combina **dos ejes**: la **etapa de producción** del pedido (nuevo / en preparación / en camino / entregado / anulado) **y** si está **pagado**, con su color y una **etiqueta de método de pago** ("Pagado con tarjeta (Culqi)", "Pagado con PayPal", "Por validar (Yape/Plin/transf.)", "Pendiente de pago"). Esa derivación es pura y defensiva (`src/utils/estadoCompra.js`, `derivarEstadoCompra`): NO recalcula cobros, solo **deriva** un estado legible de los campos del pedido.
  - Lista los **productos** (miniatura, talla/color, "Personalizado", cantidad y subtotal), la **dirección de entrega**, y un **resumen de la compra** (productos, descuento por monedas, envío, total) — todo **solo lectura**.
  - **"También te puede interesar":** recomendación por la categoría del producto comprado, con fallback a destacados.
  - **WhatsApp al asesor:** botón para consultar el estado por WhatsApp **al asesor de la marca** del pedido (usa `whatsappNumber` de la marca); si la marca no tiene número, cae a un número general de la cuenta. Si el pedido tiene **varias marcas con asesor**, muestra un botón por marca.
- **Cómo obtiene el detalle:** el pedido normalizado de la lista descarta campos (productos, método de pago, dirección, `numeroPedido`), así que el detalle trae el **pedido CRUDO por id** buscándolo en **ambas colecciones** del ERP (`getOrderByIdAnyCollection` → `pedidos` y `pedidos_web`); como respaldo usa el `_raw` que `usePedidos` adjunta a cada pedido normalizado.
- **Archivos clave:** `src/pages/cuenta/CuentaPedidosPage.jsx` (lista), `src/pages/cuenta/CuentaCompraDetallePage.jsx` (detalle), `src/utils/estadoCompra.js` (`derivarEstadoCompra`, `esPagado`, `getProductosPedido`, `getCodigoPedido`, `getBrandIdsDePedido`), `src/hooks/usePedidos.js` (filtra `esPedidoWala` por `canalVenta:'Portal Web'` + adjunta `_raw`), `src/services/erp/firebase.js` (`searchOrdersByDniInERP` con respaldo de DNI crudo, `getOrderByIdAnyCollection`), `src/components/Results.jsx`

### 7.3 Lista de Deseos privada (`/cuenta/wishlist`)
- **Qué es:** los productos que el cliente guardó como favoritos.
- **Qué hace:** muestra la grilla de favoritos; permite **compartir la lista** (genera enlace público `/wishlist/<código>`); marca con un badge los productos que ya le regalaron. Sugiere registrar el cumpleaños para recordatorios.
- **Acceso desde el header (sesión 2026-06-27):** el corazón de favoritos del header muestra un **badge con la cantidad** de productos guardados y, al abrir el desplegable de favoritos, una **tira de miniaturas** de los productos en la lista.
- **Botones de la cabecera (sesión 2026-06-27, ✅ desplegados):**
  - **"🛒 Agregar todo al carrito":** atajo que agrega de un golpe todos los productos no regalados de la lista al propio carrito (compra para uno mismo, no es modo regalo). Omite productos borrados, sin stock/inactivos y los que ya están en el carrito; muestra un toast resumen.
  - **"📅 Mis fechas especiales":** copia y abre la **URL pública** del **registro de regalos por fecha** (`/regalar/:referralCode`, ver §7.4). Privacidad resuelta: la página pública consume una **Cloud Function** (`getPublicGiftRegistry`) que devuelve solo datos mínimos, no lee Firestore directo.
- **Producto borrado = "Ya no disponible" (sesión 2026-07-01, ✅ desplegado):** si un producto de la lista fue **eliminado/archivado** del catálogo, la tarjeta ya **no desaparece en silencio**: se muestra atenuada con la etiqueta **"Ya no disponible"** (con su nombre y, si hay, su imagen del tombstone) y un botón para **quitarla** de la lista. Además, cada item guarda su **precio al momento de agregarlo** (snapshot `price`), así la lista y `/regalar` no muestran `S/ 0.00`. "Agregar todo al carrito" **omite** los no disponibles y respeta el stock real.
- **Estado y detalle completo:** ver [PLAN-FECHAS-ESPECIALES.md → "ESTADO Y FUNCIONAMIENTO — Registro de regalos por fecha (/regalar)"](./PLAN-FECHAS-ESPECIALES.md). Drag-and-drop ✅ terminado. *(El redeploy de `getPublicGiftRegistry` —fix de wishlist vacía + foto + `price`— **ya lo hizo el dueño**.)*
- **Archivos clave:** `src/pages/cuenta/WishlistPage.jsx`, `src/contexts/WishlistContext.jsx`, `src/services/wishlist.js` (snapshot `price`)

### 7.4 Lista de Deseos pública (`/wishlist/:userCode`)
- **Qué es:** la versión **compartible** de la wishlist (la ve cualquiera con el enlace).
- **Qué hace:** muestra la lista de deseos de una persona (con su nombre) para que amigos/familia puedan comprarle y regalarle.
- **Archivos clave:** `src/pages/WishlistPublic/WishlistPublic.jsx`

### 7.4-bis Registro de regalos por fecha (`/regalar/:referralCode`) — "Mis fechas especiales"
- **Qué es:** página pública que funciona como **registro de regalos por fecha**. El dueño la comparte (botón "📅 Mis fechas especiales" de su wishlist); quien la abre ve las **fechas especiales del dueño** (cumpleaños/aniversarios/fechas especiales de su perfil) como **columnas de entrega** + su **wishlist** en tarjetas.
- **Fechas como TARJETAS GRANDES de persona (sesión 2026-06-29, ✅ frontend; CF requiere redeploy):** cada fecha ya no es un simple chip, sino una **tarjeta grande de persona** que replica el look de "Mis Fechas Importantes": **foto circular** de la persona (o **inicial** si no hay foto) + **nombre** + **chip de relación** + **chips de ocasiones globales** (Día de la Madre/Padre, San Valentín…, derivadas en el cliente del `roleKey`/`gender`) + la **fecha del evento** (cumpleaños/aniversario). Incluye también la **tarjeta del propio dueño** (el festejado). La tarjeta **sigue siendo el control de selección** de fecha (`role="radio"`, conserva las clases `.dateChip`/`.dateChipActive` para no romper estilos ni lógica). La **foto** la sube el dueño en su cuenta (ver §7.7) y la expone la Cloud Function `getPublicGiftRegistry` (campos nuevos `recipientPhoto`, `roleKey`, `gender`; siguen siendo datos mínimos, sin PII sensible). *(El frontend ya está desplegado; para que la foto/roleKey/gender lleguen a la página pública hay que **redeployar** `getPublicGiftRegistry`.)*
- **Cómo funciona (drag-and-drop ✅, arrastre reescrito 2026-06-29):** cada producto es una **tarjeta** cuya **imagen se arrastra** y cuyo **nombre es un enlace** a la ficha del producto. El arrastre se reescribió sobre **Pointer Events** (hook `useGiftDrag` **dentro** de `GiftRegistryPage.jsx`) con un **clon visual (ghost)** anclado al puntero y la `<img>` con `draggable={false}` para matar el drag nativo del navegador → **sin parpadeo** ni cursor "denegado". **Arrastrar** una tarjeta sobre una fecha la **ASIGNA** a ese día (aparece una **miniatura** bajo la fecha, con × para quitarla) — todavía NO se agrega al carrito. Un botón **"Proceder a regalar (N) 🎁"** encima de la fecha agrega esos regalos al carrito en **Modo Regalo** con `deliveryDate` + el dueño como destinatario y lleva al carrito. Como alternativa, sigue el botón **"Regalar este 🎁"** de cada tarjeta (regala 1 directo con la fecha elegida). Luego: el checkout preselecciona Modo Regalo y la fecha, guarda `giftDetails.deliveryDate` en el pedido (y lo pone en el WhatsApp) → al confirmar marca el producto como regalado y **notifica al dueño** (`markItemAsGifted`). La página **no lee Firestore directo**: pide los datos mínimos a la Cloud Function `getPublicGiftRegistry` (sin email/teléfono/dni del dueño ni datos sensibles de terceros).
- **Producto borrado = "No disponible" (sesión 2026-07-01, commit `88a3368`, ✅ desplegado):** si un producto de la wishlist fue **eliminado/archivado** del catálogo, su tarjeta en `/regalar` muestra la etiqueta **"No disponible"** — **sin imagen rota, sin `S/ 0.00`** (usa el **precio snapshot** del item, que ahora también expone la CF `getPublicGiftRegistry` con el campo `price`) **y sin link roto** (el nombre deja de enlazar); el botón **"Regalar este" queda deshabilitado** para ese producto. Quien visita el registro nunca puede "regalar" algo que ya no existe.
- **Estado (✅ frontend y CF desplegados):** flujo completo operativo, **incluido el drag-and-drop** (terminado y reescrito sobre Pointer Events) y las **tarjetas grandes con foto**. El redeploy de la Cloud Function `getPublicGiftRegistry` **ya lo hizo el dueño**: corrige el bug de la wishlist vacía y hace llegar a la página `recipientPhoto`/`roleKey`/`gender` (foto + ocasiones) y el **`price`** de cada item (sesión 2026-07-01). Detalle completo, bugs y decisiones abiertas en [PLAN-FECHAS-ESPECIALES.md → "ESTADO Y FUNCIONAMIENTO — Registro de regalos por fecha (/regalar)"](./PLAN-FECHAS-ESPECIALES.md).
- **Archivos clave:** `src/pages/GiftRegistry/GiftRegistryPage.jsx` (tarjetas grandes + hook `useGiftDrag` por Pointer Events + estado "No disponible"), `functions/index.js` (`getPublicGiftRegistry`, expone `recipientPhoto`/`roleKey`/`gender`/`price`), `src/pages/cuenta/CuentaFechasImportantesPage.jsx` (subida de la foto, `recipient.photoUrl`), `src/contexts/CartContext.jsx`, `src/pages/CheckoutPage.jsx`, `src/services/wishlist.js`, `src/App.jsx`

### 7.5 Mis Creaciones (`/cuenta/creaciones`)
- **Qué es:** los **diseños personalizados guardados** por el usuario en el editor.
- **Qué hace:** muestra cada diseño en tarjetas (con miniatura, fecha y enlace) y marca cuáles ya fueron **comprados** (cruzando con sus pedidos). Si no hay diseños, invita a ir a `/personalizar`.
- **Archivos clave:** `src/pages/cuenta/MisCreacionesPage.jsx`, `src/pages/cuenta/components/MiCreacionCard.jsx`, `src/services/designs.js`

### 7.6 Mis Referidos (`/cuenta/referidos`)
- **Qué es:** el panel de referidos y recompensas por traer compradores.
- **Qué hace:**
  - Muestra **saldo de monedas** y estadísticas (visitas, compras, monedas ganadas).
  - **Código de referido** (editable una sola vez) y botón para **generar/copiar** el enlace de referido.
  - Gana **10 monedas** por cada venta finalizada; **multiplicador x2** a partir de la 3.ª compra completada del mes.
  - **Historial** con un stepper de 4 etapas por referido: Enviado → Clic → Compra → Reclamar. Cuando una venta califica y está completada, aparece el botón **"Reclamar Monedas"**. Marca como "no califica" las compras que no completan tramos de S/100.
  - Notificaciones tipo toast cuando alguien ve o compra por tu enlace.
  - **Ranking mensual** de referidos.
- **Archivos clave:** `src/pages/cuenta/CuentaReferidosPage.jsx`, `src/services/referrals.js`, `src/components/analytics/ReferralRanking.jsx`

### 7.7 Fechas Importantes (`/cuenta/fechas-importantes`)
- **Qué es:** agenda de fechas especiales de los seres queridos del cliente, con sugerencias de regalo.
- **Qué hace:**
  - Si el usuario **no completó la encuesta**, lo invita a hacerla (gana Kapicoins).
  - Permite **añadir personas** (nombre, género, relación/parentesco) y sus **eventos** (cumpleaños obligatorio, aniversario, fecha especial con nombre libre).
  - **Foto de la persona (sesión 2026-06-29, ✅ desplegado):** cada persona puede llevar una **foto circular** (avatar). Desde el modal de edición se sube con `uploadFile` (Firebase **Storage**, mismo helper que AvatarStudio) y se guarda como `recipient.photoUrl`; botones **"Subir / Cambiar foto"** y **"Quitar foto"**, con estado "Subiendo…" y aviso de error. Sin foto, la tarjeta de la persona cae a un **placeholder con su inicial**. Esa misma foto es la que aparece en las **tarjetas grandes** del registro de regalos público `/regalar` (§7.4-bis), expuesta por la Cloud Function `getPublicGiftRegistry`.
  - Calcula **fechas globales** automáticas según rol/género (Día de la Madre/Padre, San Valentín, Día del Niño, Día de la Amistad, Día de la Mujer/Hombre).
  - Muestra **paquetes de regalo sugeridos** por persona y permite **"Agregar todo al carrito"**.
  - Editar y eliminar personas.
- **Archivos clave:** `src/pages/cuenta/CuentaFechasImportantesPage.jsx` (incl. subida de foto vía `src/services/firebase/storage.js` → `uploadFile`), `src/services/fechasImportantes.js`

### 7.8 Misiones diarias / racha / tiers (`/cuenta/misiones`)
- **Qué es:** el hub de gamificación de fidelización.
- **Qué hace:**
  - **Check-in diario** automático al entrar (idempotente) que suma a la **racha** (🔥) y puede dar monedas.
  - Muestra saldos de **Monedas** y **Experiencia (XP)**.
  - **Nivel/Tier** derivado de la XP, con barra de progreso y "faltan X XP para el siguiente nivel".
  - Lista de **misiones del día**, cada una con su recompensa en monedas y botón **"Completar"**.
- **Archivos clave:** `src/pages/cuenta/MisionesPage.jsx`, `src/services/loyalty.js` (`dailyCheckIn`, `getDailyMissions`, `completeMission`), `src/constants/tiers.js`

### 7.9 Catálogo de Recompensas (`/cuenta/catalogo`)
- **Qué es:** la tienda de **canje de monedas** por beneficios.
- **Qué hace:** lista las recompensas activas (título, descripción, valor de referencia y costo en monedas) y permite **Canjear** si alcanza el saldo. El canje se hace de forma segura (Cloud Function `redeemRewardSecure`) y entrega un **código de cupón**.
- **Archivos clave:** `src/pages/cuenta/CatalogReward.jsx` (colección `rewardsCatalog`)

---

## 8. Gamificación

### 8.1 Zona Arcade — hub de minijuegos (`/minijuegos`)
- **Qué es:** la portada de los juegos.
- **Qué hace:** tarjetas de acceso a: **Palabra del Día**, **Alimenta a Kapi** (reclamar la moneda diaria, abre la mascota Kapi), **Ruleta Semanal** (con barra de progreso de días reclamados y bloqueada hasta completar 7 días seguidos) y **Las Bolitas de Kapi** (Ball Sort). Si el usuario no está logueado, lo invita a iniciar sesión para ganar recompensas.
- **Archivos clave:** `src/pages/Minijuegos/MinijuegosPage.jsx`

### 8.2 Palabra del Día / Wordle (`/palabra-del-dia`)
- **Qué es:** un Wordle en español (adivinar la palabra del día en 6 intentos).
- **Qué hace:** teclado en pantalla, palabra del día, validación con diccionario, guardado del resultado, **rachas** y **ranking** (del día y global histórico).
- **Archivos clave:** `src/pages/Tienda/WordlePage.jsx`, `src/services/wordle.js`, `src/data/wordleDictionary.js`

### 8.3 Ruleta semanal (`/ruleta`)
- **Qué es:** ruleta de premios que se **desbloquea** tras reclamar la moneda diaria 7 días seguidos.
- **Qué hace:** girar para ganar premios; la elegibilidad se calcula desde el perfil (días reclamados / si se perdió un día).
- **Archivos clave:** `src/pages/Minijuegos/RuletaPage.jsx`, `src/services/firebase/ruleta.js`

### 8.4 Ball Sort — "Las Bolitas de Kapi" (`/ball-sort`)
- **Qué es:** juego de ordenar bolitas de colores en tubos.
- **Qué hace:** al completarlo, otorga monedas (2 Wala Coins diarios). Marca "Completado hoy" cuando ya se reclamó.
- **Archivos clave:** `src/pages/Minijuegos/BallSortPage.jsx`

### 8.5 Mascota Kapi (botón flotante global)
- **Qué es:** la mascota/capibara "Kapi" que aparece como botón flotante en todas las páginas (junto a WhatsApp y el "Package Bubble").
- **Qué hace:** se abre desde la tarjeta "Alimenta a Kapi" o automáticamente para usuarios nuevos (tutorial de onboarding con `driver.js`). Permite **alimentar a Kapi** (reclamar la moneda diaria gratis), participa en el **reto semanal** (incluye subir evidencia) y programa notificaciones.
- **Archivos clave:** `src/components/common/KapiPet/KapiPet.jsx` (montado en `src/App.jsx` dentro de `floating-action-stack`)

### 8.6 Cofre diario
- Ver sección 9 (vive en la página de Ofertas Flash).

---

## 9. Ofertas Flash + Cofre diario (`/ofertas`)

- **Qué es:** promociones por tiempo limitado y el cofre diario de monedas.
- **Qué hace:**
  - **Cofre diario:** botón "Abrir cofre diario" que da monedas sorpresa una vez al día (requiere login; si ya se abrió, avisa "vuelve mañana").
  - **Ofertas Flash:** lista de ofertas activas con porcentaje de descuento, fechas de inicio/fin y enlace al producto.
- **Archivos clave:** `src/pages/OfertasFlashPage.jsx`, `src/services/flashOffers.js`, `src/services/chest.js`

> Las "Ventas Flash" también pueden aparecer como un **módulo dentro del Inicio/Tienda** (sección `flash_sales` con cuenta regresiva), ver sección 1.1.

---

## 9-bis. Sorteos y Rifas (`/sorteos`)

- **Qué es:** la página pública del módulo de **sorteos** (gratuitos) y **rifas** (pagadas), **móvil-first** (el tráfico llega de los lives en el teléfono). Muestra el **sorteo activo** con el hero del premio, cuenta regresiva, reglas de cómo ganar chances, y la acción de participar. Lo administra el dueño desde `/admin/sorteos` (ver FUNCIONES-ADMIN.md → "🎁 Raffles").
- **Qué hace:**
  - **Hero del premio + countdown en vivo** hacia la fecha de fin, con un **contador de participantes en vivo** (suma de shards, refresco suave; sin `onSnapshot` ni escaneo, para pocas lecturas) y badges (GRATIS o precio por ticket, número de ganadores).
  - **Gate de login (con retorno):** si el visitante **no ha iniciado sesión**, se le invita a **"Iniciar sesión"** (vuelve a `/sorteos` tras loguearse). Para participar/comprar también exige el **perfil completo** (DNI + teléfono): si falta, lleva a `/completar-perfil` y **el servidor lo revalida**.
  - **Participar gratis** (sorteos tipo *gratis*): botón **"¡Participar gratis!"** que llama a la Cloud Function `participarSorteoGratis` (idempotente, 1 doc por uid). Si ya participa, muestra **"Ya estás participando ✓"** con sus tickets/chances.
  - **Comprar ticket** (rifas tipo *pagado*): selector de **cantidad** de tickets con su total (solo display; **el servidor recalcula el precio real** `precioTicket * cantidad`), y luego elige método de pago **Culqi (tarjeta)** o **PayPal** — ambos por sus Cloud Functions seguras (el ticket se marca **pagado solo cuando el servidor confirma el cargo/captura**, idempotente). Muestra **"Tus tickets pagados: N"**.
  - **Chances por compartir:** si el sorteo lo habilita, un botón **"📢 Compartir y ganar +1 chance"** (usa el compartir nativo del móvil o copia el enlace) que acredita **+1 chance una sola vez** vía `sumarChanceCompartir` (el servidor es la única fuente de verdad).
  - **Chances por referir:** si está habilitado, muestra el **enlace de referido** del usuario (`/sorteos?ref=SU-CODIGO`) con botón **"Copiar"**; quien participe con ese enlace le suma **+1 chance** al dueño del código (`claimRaffleReferralSecure`, idempotente; no se autoacredita con su propio enlace).
  - **Requisito de app:** si el sorteo es *obligatorio desde el app* y el visitante entró por la web, se bloquea la participación y se ofrece **"Descargar app"**.
  - **Revelación de ganadores:** cuando el sorteo está **cerrado** y hay ganadores oficiales (los escribe **solo el servidor** en `decidirGanadoresSorteo`), se listan los ganadores; si el usuario actual ganó, ve un banner **"¡FELICIDADES, GANASTE!"** con **confeti** (CSS, sin dependencias).
- **Ruta:** `/sorteos` (acepta `?ref=CODIGO` para acreditar el referido).
- **Archivos clave:**
  - `src/pages/SorteosPage.jsx` (+ `SorteosPage.module.css`)
  - `src/services/sorteos.js` (`getSorteoActivo`, `getMiParticipacion`, `getContadorSorteo`, `participarGratis`, `sumarChanceCompartir`, `claimRaffleReferral`, wrappers de las callables)
  - `functions/index.js` (`participarSorteoGratis`, `comprarTicketSorteoSecure`, `processCulqiPayment` rama sorteo, `culqiWebhook`, `createPaypalTicketSorteoSecure` / `capturePaypalTicketSorteoSecure`, `decidirGanadoresSorteo`)
  - `src/components/CulqiCustomCheckout/` y `@paypal/react-paypal-js` (reusa los mismos SDKs de pago del checkout)

---

## 9-ter. Página de enlaces / link-in-bio (`/l/:slug`)

- **Qué es:** una **página pública tipo Linktree** (link-in-bio), **móvil-first**, que el dueño arma desde el admin (ver FUNCIONES-ADMIN.md → "🔗 Enlaces útiles"). Cada página tiene su propia URL `/l/tu-enlace`.
- **Qué hace:**
  - Renderiza **todo el diseño** que configuró el dueño: **fondo** (color / degradado / imagen), **avatar**, **título**, **descripción**, la **fila de redes sociales** y los **botones** (con su miniatura), aplicando estilo/redondez/sombra/colores/tipografía. Los botones y redes salen **ya ordenados** por su `order`.
  - **Analítica sin bloquear el enlace:** al abrir la página se **asegura la sesión de analítica** (para capturar país/dispositivo) y se registra la **visita** (`registrarVisita` → la Cloud Function incrementa `visitas` y escribe el único evento `link_page_view`). Al pulsar un botón se registra el **clic** (`registrarClic` → la CF incrementa el contador del botón y escribe el único evento `link_click`). El clic **abre el enlace igual** aunque el tracking falle o tarde (fire-and-forget): los enlaces internos navegan por SPA y los externos abren en pestaña nueva con `rel="noopener noreferrer"`.
  - **Estados:** mientras carga muestra un spinner; si el slug no existe o la página está en **borrador**, muestra **"Página no disponible"** con enlace al inicio.
- **Lecturas:** **una sola** query por slug (`getLinkPageBySlug`). Los contadores viven **en la nube** (los mueven las CFs), nunca en localStorage.
- **Ruta:** `/l/:slug` (declarada **antes** del catch-all `/:slug` en `src/App.jsx`).
- **Archivos clave:**
  - `src/pages/LinkInBioPage.jsx` (+ `LinkInBioPage.module.css`)
  - `src/services/enlaces.js` (`getLinkPageBySlug`, `registrarClic`, `registrarVisita`)
  - `src/services/analytics/tracker.js` (`ensureAnalyticsSession`, contexto de sesión), `functions/index.js` (`registrarVisitaEnlace` / `registrarClicEnlace`)

---

## 10. Suscripciones (Wala Box)

### 10.1 Landing de suscripciones (`/suscripciones`)
- **Qué es:** la página de venta del modelo de suscripción de regalos ("Wala Box").
- **Qué hace:** explica el modelo (programar fechas → curaduría → pago mensual → entrega a tiempo) e invita a configurar las fechas. Indica que el **pago mensual estará disponible "muy pronto"**; por ahora el cliente puede separar/configurar sus fechas.
- **Archivos clave:** `src/pages/SubscriptionLandingPage.jsx`

### 10.2 Encuesta de suscripción / perfil de regalos (`/encuesta-suscripcion`)
- **Qué es:** la encuesta para construir el perfil de regalos del cliente (alimenta "Fechas Importantes", los paquetes sugeridos y el **registro de regalos por fecha** `/regalar`, §7.4-bis).
- **Qué hace:** registra a los seres queridos como **destinatarios** (`giftRecipients`) con **nombre y relación/parentesco** y sus **eventos** (cumpleaños obligatorio, aniversario, fecha especial con nombre libre); esos nombre+relación son los que rotulan las columnas de fecha en `/regalar`. También captura el **cumpleaños del propio dueño** (`birthDate`), que aparece como una fecha más en su registro de regalos.
- **Archivos clave:** `src/pages/SubscriptionSurveyPage.jsx`

---

## 11. Otras páginas del cliente

### 11.1 Acceso: Login / Registro / Completar perfil / Recuperar contraseña
- **Rutas:** `/login`, `/registro`, `/completar-perfil`, `/recuperar-contrasena`
- **Qué hacen:** autenticación del cliente. `completar-perfil` se usa cuando falta el DNI/teléfono (necesario para ver pedidos); ahí se elige el **tipo de documento** (DNI/CE/Pasaporte en Perú) y se captura el **cumpleaños** (`birthDate`). El login/registro aceptan `?redirect=` para volver a donde estaba el usuario (p. ej. desde el editor).
- **Captura de cumpleaños con import opcional desde Google (sesión 2026-06-27):** al **iniciar sesión con Google** se pide (opcionalmente) permiso de lectura del cumpleaños vía **Google People API** (scope `user.birthday.read`, gratis y best-effort: si no se concede o no existe, el login sigue normal). Si se obtiene, se guarda temporalmente (`localStorage` → `wala_google_birthday`) y se **precarga** en "Completar perfil" para que el cliente solo confirme. El cumpleaños también se puede capturar en la encuesta de suscripción (§10.2).
- **Archivos clave:** `src/pages/LoginPage.jsx`, `RegisterPage.jsx`, `CompleteProfilePage.jsx` (`birthDate`), `ResetPasswordPage.jsx`, `src/services/firebase/auth.js` (People API), `src/contexts/AuthContext.jsx`

### 11.2 Landing "Regalos con Amor" / Nuevos usuarios (`/regalos-con-amor`)
- **Qué es:** una landing independiente (sin header/footer normales) orientada a captar nuevos usuarios, con testimonios, comparativas y reseñas.
- **Nota:** `/nuevos-usuarios` redirige aquí. Esta ruta usa un layout especial "independiente".
- **Archivos clave:** `src/pages/NuevosUsuariosPage.jsx`

### 11.3 Experiencia de regalo (`/regalo/:orderId`)
- **Qué es:** la experiencia digital inmersiva que recibe el **destinatario** cuando se compró en "Modo Regalo".
- **Archivos clave:** `src/pages/GiftExperiencePage.jsx`

### 11.4 Landing pages dinámicas (`/:slug`)
- **Qué es:** páginas de aterrizaje creadas por el admin con su propio contenido y tema (CSS), reutilizando el motor de secciones de la Tienda. **Las páginas de marca** (`/ConAmor`, `/MUSSA`, `/MUEBLERIA`, ver §1.3) son landings dinámicas con los módulos `categories_nav` + `sidebar_catalog` apuntando a su `brandId`.
- **Qué hace:** carga la landing por slug (**insensible a mayúsculas/minúsculas**: `getLandingPageBySlug` cae a un match en memoria si el exacto falla, y `DynamicLandingPage` pasa el slug canónico como `pageIdOverride` para que todas las variantes lean las mismas secciones); si no existe, redirige a inicio (logueado) o a login. Puede ocultar header/footer.
- **Archivos clave:** `src/pages/Tienda/DynamicLandingPage.jsx`

### 11.5 Páginas legales
- **Rutas:** `/politicas-privacidad`, `/terminos-y-condiciones`, `/libro-de-reclamaciones`
- **Archivos clave:** `src/pages/PoliticasPrivacidadPage.jsx`, `TerminosCondicionesPage.jsx`, `LibroReclamacionesPage.jsx`

### 11.6 Descargar app (`/app`, `/descargar`)
- **Qué es:** redirección a la descarga de la app (web/Android vía Capacitor).
- **Archivos clave:** `src/pages/AppRedirect.jsx`

### 11.7 Otras landings de campaña
- `/regalos-catas` (`RegalosCatasPage`): landing/experiencia puntual accesible públicamente.
- **Nota (multi-marca):** la antigua ruta hardcodeada `/mussa` (`MussaPage`, "Próximamente") **se retiró**. Hoy `/MUSSA` es la **página de la marca MUSSA**, resuelta vía `/:slug` → `DynamicLandingPage` como landing editable (ver §1.3).

---

## 12. Elementos globales presentes en toda la web (no son rutas)

Estos componentes acompañan al cliente en casi todas las páginas (definidos en `GlobalLayout` dentro de `src/App.jsx`):

- **Header** (cabecera con navegación, categorías y buscador) — `src/components/common/Header`. Incluye el **interruptor de Modo Noche** (luna/sol, ver abajo), el **toggle de idioma ES / EN / PT** (ver i18n abajo) y el corazón de favoritos (badge + tira de miniaturas, sesión 2026-06-27).
- **Modo Noche — tema claro / oscuro / sistema (sesión 2026-06-29, ✅ desplegado):** un **interruptor luna/sol** en el Header (`src/components/common/ThemeToggle/`, un solo nodo sirve desktop y móvil; en claro muestra la **luna** = ir a oscuro, en oscuro el **sol**) deja que el visitante elija **claro**, **oscuro** o **seguir al sistema** (default: sigue el `prefers-color-scheme` del navegador/SO y reacciona en vivo si el visitante cambia el modo de su sistema). La elección se **recuerda** en `localStorage` (clave `wala-theme`) y se aplica a **toda la web** (tienda, cuenta, admin) vía `data-theme` en `<html>`; un **script anti-parpadeo** en `index.html` la fija **antes** de cargar para que la página no "salte" del claro al oscuro. Respeta los **colores de fondo que el admin configure** en cada sección (no los pisa, sin `!important`) y garantiza **contraste** (fondo oscuro → texto claro), afinado en **dos pases** (`a442251` + `649a42e`). Motor: `src/contexts/ThemeContext.jsx`; paleta/tokens y red de oscurecimiento en `src/styles/variables.css` + red de legibilidad en `src/styles/globals.css` + overrides en ~95 `.module.css`. **No afecta carrito, precios, pagos ni datos.** Detalle en [MODO-NOCHE.md](./MODO-NOCHE.md).
- **Idioma / i18n GRATIS (ES/EN/PT) (sesión 2026-06-27):** un **toggle de idioma** en el Header (con **banderas SVG** propias de España/EEUU/Brasil, `src/components/i18n/FlagIcon.jsx` — los emoji de bandera no se ven en Windows) y un **popup "¿Ver Walá en tu idioma?"** (`src/components/i18n/LanguagePopup.jsx`) permiten cambiar entre Español, Inglés y Portugués sin costo. Los textos fijos principales (navegación, CTAs como **"Al carrito"**, secciones de cuenta) salen de diccionarios propios (`src/i18n/dictionaries.js`); el idioma elegido se persiste en `localStorage` y se fija en `document.documentElement.lang` (`src/contexts/LanguageContext.jsx`).
  - **Traducción dinámica del catálogo (gratis):** además del traductor nativo del navegador, el **contenido del catálogo** (nombres y descripciones de producto, categorías) se traduce en runtime con `src/services/translate.js`, que usa instancias públicas de **Lingva** (proxy gratuito de Google Translate) con **caché en `localStorage`** y **tolerancia a fallos** (si la red falla, muestra el texto original; nunca rompe la página). Se aplica vía el hook/componente `src/i18n/useTranslatedText.js` (`useTranslatedText` y `<T>`) en las tarjetas y fichas de producto, el nav de categorías y el carrito.
    - **Endurecimiento del traductor (sesión 2026-06-28, misma API pública):** caché con TTL largo por (texto, idioma destino); **dedupe de peticiones en vuelo** (si el mismo texto ya se está traduciendo, se reutiliza la misma promesa en vez de disparar N llamadas); **circuit-breaker por instancia** (una instancia que falla/da timeout se marca como caída un tiempo y se rota entre los mirrors de Lingva); y **timeout por petición** vía `AbortController`. Solo se cachean traducciones exitosas (nunca el fallback al original). El hook `useTranslatedText` siembra el texto **original** como estado inicial, así el DOM nunca queda vacío mientras llega la traducción.
- **Observabilidad de cliente (Fase 4, sesión 2026-06-28):** un arranque global (`src/services/observability/`, montado desde `src/App.jsx` con `initObservability()`) captura, **sin PII y fire-and-forget**, los errores del navegador y los registra en `analytics_events`:
  - **Errores de render** vía un **ErrorBoundary** (`src/components/common/ErrorBoundary/`, además del `AppErrorBoundary` de sistema), más `window.onerror` y `unhandledrejection` → evento **`client_error`** (con dedupe/throttle por sesión, recorte de mensaje/stack, e ignorando ruido conocido como chunks obsoletos o el `clearRect` de Fabric).
  - **Web Vitals** (LCP/CLS/INP/FID) → evento **`web_vital`** al ocultar la página.
  - Todo es aditivo y a prueba de fallos: si Firestore no está o algo falla, la app se comporta como hoy (no rompe el render ni el rendimiento). Archivos: `src/services/observability/index.js`, `errorReporter.js`, `webVitals.js`.
- **Footer** — `src/components/common/Footer`
- **BottomNav** (barra inferior en móvil) — `src/components/common/BottomNav`
- **Botón de WhatsApp** flotante — `src/components/common/WhatsAppButton`
- **Mascota Kapi** flotante — ver 8.5
- **Package Bubble** (burbuja de seguimiento de pedido) — `src/components/common/PackageBubble`
- **System Alert** (avisos del sistema) y **barra de progreso de navegación**
- **Aviso de Firebase** si la conexión falla — `src/components/common/FirebaseWarning`
- Trackers de analítica de cliente: ruta, scroll, heatmap de clics y referidos.

> En la ruta `/regalos-con-amor` y en landings que lo configuren, el layout es "independiente" (sin header/footer ni elementos flotantes), para una experiencia de aterrizaje limpia.
