# FUNCIONES DEL PANEL ADMIN (`/admin`)

> Referencia funcional del panel de administración de Walá (wala.pe).
> Pensada para el dueño del negocio: explica **qué hace cada sección** y **dónde está** (su ruta).
> Fiel al código a fecha de esta guía. Archivos de referencia:
> `src/components/AdminLayout/AdminLayout.jsx` (el menú lateral) y `src/App.jsx` (las rutas `/admin/*`).

---

## Cómo está organizado el panel

Al entrar a `/admin` se ve una **barra lateral izquierda** (el menú) y, a la derecha, el contenido de la sección que elijas. El menú está dividido en **grupos plegables** (puedes abrir/cerrar cada grupo haciendo clic en su título):

1. **Ajustes** — solo para Super Admin.
2. **Diseño de Tienda** — apariencia de la tienda, analítica, **Recepción de Pedidos** y juegos.
3. **Catálogo** — productos, inventario, vendedores, envíos, ofertas, etc.
4. **Clientes y Pagos** — usuarios, métodos de pago, reclamos, referidos, etc.

> En el grupo *Diseño de Tienda*, justo **debajo de "📊 Dashboard Analítica"**, aparece el enlace **"📦 Recepción de Pedidos"** (`/admin/dashboard/recepcion`) para organizar los envíos del portal y, **debajo de este**, el enlace **"🎨 Elementos con diseño"** (`/admin/elementos-diseno`) para editar las piezas visuales de cada marca (hoy: el nav de categorías).

### Quién ve qué (permisos)

El menú **se adapta al permiso** de cada administrador. Los permisos se asignan en *Ajustes → Configuración*. Resumen (de `AdminLayout.jsx` y `AdminConfiguracion.jsx`):

| Permiso | Qué desbloquea |
|---|---|
| **Super Admin** | Acceso total, incluido el grupo *Ajustes* y poder crear otros administradores. |
| **Diseño de Tienda** (`manage_design`) | Grupo *Diseño de Tienda*: editor visual, banners, destacados, WhatsApp, mascota, juegos, backups. |
| **Catálogo de Productos** (`manage_products`) | Productos, categorías, colecciones, marcas, nichos, vendedores, blueprints, ofertas flash, recompensas, envíos, payouts, cliparts. |
| **Gestión de Inventario** (`manage_inventory`) | Acceso a la tabla de *Inventario*. |
| **Clientes y Pagos** (`manage_clients`) | Grupo *Clientes y Pagos*. |
| **Embudos y Landing Pages** (`manage_landing_pages`) | *Landing Pages* y *Gestor de Temas*. |

> El grupo *Catálogo* aparece si el admin tiene **alguno** de: productos, inventario o landing pages.

---

## Tabla resumen (Sección · Ruta · Qué hace)

| Sección | Ruta | Qué hace |
|---|---|---|
| **Panel Principal** | `/admin` | Pantalla de bienvenida con accesos rápidos a las secciones más usadas. |
| **Dashboard Analítica** | `/admin/dashboard` | Tablero de métricas (estilo liquid-glass): KPIs, tráfico por día, productos más vistos/agregados al carrito, categorías, páginas más visitadas, tags, embudo de conversión, origen/región, sesiones en vivo, búsquedas, más vendidos y **mapa de calor**. |
| **Recepción de Pedidos** | `/admin/dashboard/recepcion` | Panel **solo-lectura** para **organizar envíos** del portal: KPIs de pedidos + **tarjetas por pedido** con dirección de entrega, cliente, productos y WhatsApp. Lee `pedidos_web` + `pedidos` **y la red de seguridad `wala_pedidos`** (rescata pedidos que el ERP borró/desmarcó, con badge "Procesado en ERP"). **Enlace propio en el menú lateral** (📦 Recepción de Pedidos, justo **debajo de "Dashboard Analítica"**); también embebida al final del dashboard de analítica. |
| **Elementos con diseño** | `/admin/elementos-diseno` | **Catálogo de TARJETAS** de las piezas visuales editables de la tienda. Cada elemento tiene su **slug** y su propia página `/admin/elementos-diseno/{slug}`. **Hoy hay 1 elemento: "Navegación por categorías"** — eliges una marca y editas su **nav de categorías** (las burbujas: qué categoría filtra, nombre, miniatura, agregar/quitar/reordenar) **y su "Estilo del nav"** (alineación + modo estático/slider). **Enlace propio en el menú lateral** (🎨 Elementos con diseño, **debajo de "Recepción de Pedidos"**). **Registro extensible** (`registry.jsx`): pensado para sumar más elementos en el futuro. |
| **Vista Tienda (WYSIWYG)** | `/tienda` | Abre la tienda real con el **Editor Visual** flotante para construir las páginas arrastrando módulos (Hero, carruseles, catálogo, testimonios, etc.). |
| **Destacados** | `/admin/destacados` | Ordena qué productos salen como "destacados" en la portada. |
| **WhatsApp** | `/admin/whatsapp` | Números y mensajes prearmados de WhatsApp (tienda, creador libre, cuenta). |
| **Historial y Backups** | `/admin/backups` | Historial de cambios del diseño (restaurar versiones) y registro de movimientos de inventario (exportable a CSV). |
| **Mascota** | `/admin/mascota` | Imagen de la mascota de retención (Kapi) que aparece flotando en la tienda. |
| **La Palabra del Día (Wordle)** | `/admin/wordle` | Define la palabra del minijuego diario por fecha. |
| **Ruleta Semanal** | `/admin/ruleta` | Premios de la ruleta y sus probabilidades. |
| **Productos** | `/admin/productos` | Lista de productos: crear, editar, duplicar, ocultar/mostrar, eliminar, acciones masivas, exportar. |
| **Inventario** | `/admin/inventario` | Tabla rápida para editar el stock de muchos productos a la vez. |
| **Mockups Base** | `/admin/mockups` | Plantillas/mockups base de prendas (con variantes) para los productos personalizables. |
| **Categorías** | `/admin/categorias` | Categorías del catálogo (con imagen y orden). |
| **Colecciones** | `/admin/colecciones` | Colecciones del catálogo (con imagen y orden). |
| **Nichos** | `/admin/nichos` | Nichos/tiendas temáticas (slug, comisión, imagen). |
| **Vendedores** | `/admin/vendedores` | Vendedores del marketplace (tipo, estado, comisión, logo). |
| **Blueprints (POD)** | `/admin/blueprints` | Plantillas de impresión bajo demanda: prenda base, costo, áreas de impresión (cm/dpi) y métodos. |
| **Ofertas Flash** | `/admin/flash-offers` | Ofertas con descuento y cuenta regresiva + cálculo de segmentos de clientes (RFM). |
| **Recompensas** | `/admin/recompensas` | Catálogo de recompensas canjeables con monedas. |
| **Zonas de Envío** | `/admin/envios` | Zonas/departamentos con su costo y días estimados de entrega. |
| **Pagos a Vendedores (Payouts)** | `/admin/payouts` | Pagos a vendedores: saldos a pagar, registrar pagos, estado. |
| **Marcas** | `/admin/marcas` | Marcas de producto (logo, color, fondo, **slug**, **WhatsApp del asesor**) **+ panel por marca**: "Gestionar productos" abre `AdminMarcaProductos` (asignar/quitar productos en lote + **override opcional** del nav de categorías; por defecto el nav de la marca es automático). |
| **Landing Pages** | `/admin/landing-pages` | Páginas de aterrizaje/embudos (slug, tema, productos enlazados con su stock). |
| **Gestor de Temas** | `/admin/temas` | Temas visuales (CSS) que se aplican a landing pages o a toda la tienda. |
| **Cliparts** | `/admin/cliparts` | Galería de cliparts para el editor de personalización. |
| **Métodos de Pago** | `/admin/pagos` | Datos de Yape/Plin y WhatsApp de pagos. |
| **Generador de Enlaces** | `/admin/generador-pagos` | Crea enlaces de cobro rápido (concepto + monto) para enviar al cliente. |
| **Libro de Reclamaciones** | `/admin/libro-reclamaciones` | Bandeja de reclamos: ver, responder y marcar como atendidos. |
| **Gestión de Referidos** | `/admin/referidos` | Aprobar/rechazar referidos y liberar las monedas ganadas. |
| **Crear cuentas de pedidos** | `/admin/crear-cuentas-pedidos` | Crea cuentas de cliente automáticamente a partir de pedidos del ERP. |
| **Usuarios y métricas** | `/admin/usuarios-analytics` | Lista de usuarios con sus métricas individuales (web/app) y reconstrucción del histórico. |
| **Encuesta de Suscripción** | `/admin/encuestas` | Configura la encuesta de suscripción (textos, marcas, diseño). |
| **Fechas Importantes** | `/admin/fechas-importantes` | Calendario de campañas, fechas universales, fechas de usuarios y eventos. |
| **Retos Semanales** | `/admin/retos` | Retos semanales con recompensas y revisión de evidencias enviadas. |

> **Configuración** (Ajustes) — `/admin/configuracion` — solo Super Admin. Gestiona administradores/permisos y bloqueo de páginas.

> **Page Builder (Editor Visual WYSIWYG)** — se usa desde *Vista Tienda* (`/tienda`), no es un enlace propio del menú. Detalle más abajo.

---

# Detalle por sección

## Grupo: Ajustes (solo Super Admin)

### Configuración — `/admin/configuracion`
Archivo: `src/pages/admin/AdminConfiguracion.jsx`.
Dos pestañas:
- **Administradores**: añadir/editar admins por correo, asignándoles los permisos de la tabla de arriba (Super Admin, Diseño, Catálogo, Inventario, Clientes y Pagos, Landing Pages).
- **Bloqueos (locks)**: bloquear/desbloquear páginas (incluidas landing pages) para que no sean accesibles.

---

## Grupo: Diseño de Tienda

### Panel Principal — `/admin`
Archivo: `src/pages/AdminDashboard.jsx`.
Es la **pantalla de inicio** del panel. Muestra un mensaje de bienvenida y una rejilla de **accesos rápidos** a: Productos, Fechas Importantes, Categorías, Colecciones, Marcas, Destacados, Cliparts, Mascota Virtual e Historial y Backups. Indica que, para editar el diseño visualmente, se use *Vista Tienda* + el Editor Visual de la barra superior.

### Dashboard Analítica — `/admin/dashboard`
Archivo: `src/pages/admin/AdminDashboard.jsx`.
Tablero de analítica con diseño "liquid-glass" (fondo violeta con orbes y tarjetas de vidrio). Tiene un **selector de rango** (7 / 30 / 90 días) y un botón **Actualizar** (refresco manual; no recarga solo para no consumir lecturas de la base de datos). Incluye:
- **Fila de KPIs**: Sesiones, Identidades activas, Page views y Tiempo navegado (cada uno con mini-gráfico).
- **Tráfico por día**: gráfico de área de las visitas, con conmutador TOTAL / APP / WEB.
- **Productos más vistos**: top 10 por vistas, con miniatura y cuántas veces se agregó al carrito.
- **Carrito**: productos más agregados al carrito.
- **Categorías más vistas** y **Páginas más visitadas** (landings/rutas).
- **Tags populares**: etiquetas de los productos más vistos.
- **Embudo de conversión**: Visitas → Al carrito → Checkout → Compras, con % de caída por paso.
- **Origen y región**: fuentes de tráfico (UTM) y regiones.
- **En vivo**: sesiones navegando ahora mismo (con su última página).
- **Búsquedas**: términos más buscados.
- **Más vendidos** (sección dedicada) y **Mapa de calor** (`HeatmapViewer`): dónde hacen clic los usuarios.

> **Pre-agregación de analítica (sesión 2026-06-28):** para no releer miles de eventos crudos en cada carga, el dashboard lee documentos **pre-agregados por día** `analytics_daily/{YYYY-MM-DD}` (uno por día del rango: 7/30/90 lecturas en vez de ~5300). Esos documentos los genera la Cloud Function programada **`aggregateAnalyticsDaily`** (ver "Cloud Functions"). El **día en curso** se completa con una query EN VIVO pequeña, y si todavía no existe ningún doc diario (la CF no se desplegó/ejecutó) cae automáticamente al cálculo legacy (`getGlobalAnalytics`), de modo que el tablero nunca queda vacío. Servicio de lectura: `src/services/analyticsDaily.js` (`getAnalyticsDailyRange`).

### Recepción de Pedidos (organización de ENVÍOS) — `/admin/dashboard/recepcion`
Archivo: `src/pages/admin/dashboard/RecepcionPedidos.jsx` (hook `src/hooks/useAdminWalaOrders.js`, capa de datos `src/services/adminOrders.js`; KPIs en `DashRecepcion.jsx`).
Es un panel **SOLO LECTURA del ERP** que muestra **todos los pedidos del portal WALA** (no los del usuario logueado). La capa de datos `adminOrders.getWalaOrdersForAdmin` lee **en paralelo TRES fuentes** (`src/services/adminOrders.js:412-419`): las colecciones VIVAS del ERP **`pedidos_web` (fuente principal) + `pedidos`** (ordenadas por fecha desc con límite, 200 por colección) **y la copia-espejo `wala_pedidos`** (`getAllWalaMirrorOrders` de `src/services/walaOrders.js`, la **red de seguridad** WALA-only que el ERP no toca). De los VIVOS se queda solo con los pedidos del portal (regla **`esPedidoWala`**: `canalVenta:'Portal Web'` o los respaldos `web:true` / `activador:'portal_web'` / `vendedor:'Portal Web'`) y **deduplica por clave de negocio (`numeroPedido` → respaldos `portalPseudoOrderId`/`pedidoWebId`/`id`)**, porque un mismo pedido del portal puede existir a la vez en `pedidos_web` y, una vez validado, en `pedidos` con otro id (gana la versión de `pedidos_web`).

**Fusión con `wala_pedidos` (presencia garantizada + estado más avanzado):**
- Si para una clave **existe un doc vivo**, este conserva su etapa de producción del ERP y se le **adjunta** el `estadoWala`/`pagado` del espejo (`_walaEstado`/`_walaPagado`), para que `derivarEstadoCompra` muestre el **estado más avanzado** entre ambos (no degrada). No se duplica.
- Si para una clave **NO hay doc vivo** (el ERP lo absorbió/borró al aprobarlo), se incorpora la **copia solo-espejo** marcada **`_procesadoErp`** → la tarjeta muestra el badge **"Procesado en ERP"** (presencia garantizada sin confundirlo con un pendiente). El espejo nunca rompe la lectura: si falla, devuelve `[]`.

Está orientado a **preparar y organizar los envíos**:
- una **fila de KPIs**: **por entregar** (pagados/en curso aún no entregados ni anulados), **pendientes de pago** (estado no pagado), **en producción** (`en_preparacion`), **entregados** y **monto total**;
- una grilla de **tarjetas por pedido** que resaltan la **dirección de entrega**, el **cliente** y sus datos de contacto, y los **productos** del pedido, con **filtros** (estado + buscar por nombre/código), orden por fecha, botón **"WhatsApp al cliente"** y enlace al detalle.

**Tres accesos:** (1) **enlace propio en el menú lateral** — **📦 Recepción de Pedidos**, ubicado **justo debajo de "Dashboard Analítica"** en el grupo *Diseño de Tienda* (`src/components/AdminLayout/AdminLayout.jsx`); (2) **embebida al final** del dashboard de analítica (`/admin/dashboard`); y (3) la **ruta directa** `/admin/dashboard/recepcion`.

No toca carrito, precios ni cobro: solo **muestra el estado ya derivado** (`derivarEstadoCompra`), que ahora combina la etapa del ERP con el `estadoWala` del espejo y se queda con el **más avanzado**. (Desplegado en la sesión 2026-06-28, commits `5903a6a` y `09d86a9`; la lectura de `wala_pedidos` se sumó en `68447dc`/`1d8f639`, sesión 2026-06-29.)

### Elementos con diseño — `/admin/elementos-diseno`
Archivos: `src/pages/admin/AdminElementosDiseno.jsx` (catálogo de tarjetas), `src/pages/admin/elementosDiseno/registry.jsx` (registro de elementos), `src/pages/admin/elementosDiseno/AdminElementoDisenoPage.jsx` (página por elemento) y `src/pages/admin/elementosDiseno/editores/NavegacionCategoriasEditor.jsx` (editor del 1.er elemento, monta el reutilizable `src/components/admin/CategoryNavEditor/CategoryNavEditor.jsx`).

**Catálogo de TARJETAS de las piezas visuales editables (v2, commit `425e9ce`).** La landing `/admin/elementos-diseno` ya **no es un hub de pestañas**: muestra una **grid de tarjetas**, **una por cada elemento** del registro. Cada elemento tiene su **slug** propio y su propia página `/admin/elementos-diseno/{slug}` (la abre `AdminElementoDisenoPage`, que busca el elemento por slug y renderiza su editor con un encabezado + enlace "Volver a Elementos con diseño"). Enlace propio en el menú lateral (**🎨 Elementos con diseño**, **debajo de "Recepción de Pedidos"** en el grupo *Diseño de Tienda*); gateada por `AdminRoute` + `canDesign` (Super Admin o permiso *Diseño de Tienda*).

> **Registro extensible (`registry.jsx`):** los elementos viven en el array `ELEMENTOS_DISENO`, donde cada entrada es `{ slug, nombre, descripcion, icon, Editor }`. **Para sumar un elemento nuevo** en el futuro (banners, destacados por marca, etc.) basta con **añadir otra entrada**: aparece sola como tarjeta en la landing y como ruta `/admin/elementos-diseno/{nuevo-slug}`. **Hoy hay UN elemento: "Navegación por categorías"** (slug `navegacion-categorias`).

#### Elemento "Navegación por categorías" — `/admin/elementos-diseno/navegacion-categorias`
Su editor (`NavegacionCategoriasEditor`) tiene un **selector de marca** arriba (`getBrands`) y, al elegir una, monta el editor reutilizable `CategoryNavEditor` para esa marca.

**Cómo el dueño edita el nav de categorías de una marca.** El nav de una marca es la **fila de burbujas de categoría** que aparece en su página y que, al pulsarse, **filtra el catálogo de esa marca sin navegar** (ver "Selector de MARCA por sección" más abajo). Por defecto ese nav es **AUTOMÁTICO**: se deriva solo de las categorías que tienen los productos de la marca. Esta pantalla sirve para **personalizarlo** cuando se quiere mandar el orden, los nombres o las imágenes a mano.

Eliges una marca y, **por cada burbuja**, editas tres cosas:
- **Qué categoría filtra** (`categoryId`): un desplegable de las categorías existentes (`/admin/categorías`). Es lo que se aplica al catálogo al pulsar la burbuja. (También puede dejarse "sin categoría" como burbuja libre.)
- **Nombre que se muestra**: el texto de la burbuja (por defecto, el nombre de la categoría).
- **Miniatura**: subir una imagen y **recortarla 1:1** (se guarda en `brand_nav/{marca}/...`) **o heredar** la imagen de la categoría vinculada (`/admin/categorías`).

Y sobre el conjunto: **Agregar** una burbuja (desde una categoría disponible), **Quitar**, **Reordenar** (flechas arriba/abajo), **"Generar automático"** (prellena la lista con las categorías de los productos de la marca, como punto de partida que luego editas; **no guarda** hasta que pulses "Guardar nav") y **"Vaciar (volver a automático)"** (deja el nav vacío → vuelve al modo automático). Al **Guardar**, el array `categoryNav` queda embebido en la marca (`tienda_brands`, vía `updateBrand`) y se invalidan las cachés del nav, así que el cambio se ve enseguida en la tienda.

**Estilo del nav (sub-sección "Estilo del nav", v2).** Además de las burbujas, esta pantalla edita **cómo se PINTA el nav** en la tienda, con dos controles que se guardan en el campo **`categoryNavStyle`** de la marca:
- **Alineación** (`align`): **Izquierda / Centro / Derecha / Justificado**. Coloca las burbujas dentro de su contenedor.
- **Modo** (`animation`): **Estático** (fila fija, como hoy) o **Slider (animación)** (las burbujas se desplazan solas en bucle tipo marquee; **pausa al pasar el cursor**, **respeta `prefers-reduced-motion`** y **el clic-para-filtrar sigue funcionando**).
- **NOTA importante:** la **alineación solo aplica en modo estático** (en slider las burbujas se desplazan solas, así que no hay nada que alinear).
- **Default retrocompatible:** `{ align: 'center', animation: 'static' }` (= como se ve hoy). El estilo se guarda **junto** al `categoryNav` (`updateBrand(brandId, { categoryNav, categoryNavStyle })`) y, como el editor es el mismo en los 3 lugares (ver abajo), **aparece también inline en el editor visual, sincronizado**.

> **Regla clave:** si el `categoryNav` de la marca **tiene burbujas**, esas **reemplazan** al nav automático; si está **vacío**, manda el **nav automático** (derivado de los productos). Como el nav (burbujas **y** estilo) vive en la **marca**, lo que edites aquí se refleja en **todas las páginas** que usen ese nav. *(`TiendaPage` lee `categoryNavStyle` de la marca y le pasa `align`/`animation` a `VisualCategoryNav`.)*

> **Tres caminos para lo MISMO:** este editor (`CategoryNavEditor`, que incluye burbujas **+ "Estilo del nav"**) es el **mismo** que aparece (a) aquí, (b) en *Marcas → "Gestionar productos" → pestaña "Nav de categorías"* y (c) **inline en el Editor Visual** al seleccionar una sección "Navegación por categorías" con marca. Los tres editan el `categoryNav` y el `categoryNavStyle` de la marca, así que los cambios están **sincronizados**.

### Vista Tienda (WYSIWYG) — `/tienda`
Enlace directo a la tienda. Es la puerta de entrada al **Page Builder / Editor Visual** (ver sección "Page Builder" al final).

### Destacados — `/admin/destacados`
Archivo: `src/pages/admin/AdminDestacados.jsx`.
Lista los productos marcados como destacados y permite **cambiar su orden** (campo de orden por producto) para decidir cómo aparecen en la portada.

### WhatsApp — `/admin/whatsapp`
Archivo: `src/pages/admin/AdminWhatsApp.jsx`.
Configura **tres números de WhatsApp** y sus mensajes prearmados según el contexto: *Tienda* (confirmar pedido), *Creador libre* (cotizar un diseño) y *Cuenta* (ayuda). Hay un número general de respaldo.

### Historial y Backups — `/admin/backups`
Archivo: `src/pages/admin/AdminBackups.jsx`.
Dos pestañas:
- **Diseño**: historial de cambios del diseño de la tienda (`storeConfigLogs`) para **restaurar** una versión anterior.
- **Inventario**: registro de cambios de stock, **exportable a CSV** (fecha, hora, usuario, producto, stock anterior y nuevo).

### Mascota — `/admin/mascota`
Archivo: `src/pages/admin/AdminMascota.jsx`.
Define la **imagen de la mascota** (Kapi) que flota en la tienda como elemento de retención. Permite pegar una URL o subir una imagen, con vista previa.

### La Palabra del Día (Wordle) — `/admin/wordle`
Archivo: `src/pages/admin/AdminWordlePage.jsx`.
Programa la **palabra del minijuego diario** por fecha (5 a 8 letras, solo letras; quita tildes y la guarda en mayúsculas). Lista las palabras ya programadas y permite eliminarlas.

### Ruleta Semanal — `/admin/ruleta`
Archivo: `src/pages/admin/AdminRuletaPage.jsx`.
Gestiona los **premios de la ruleta** (nombre, tipo —ej. Monedas—, monto y **probabilidad**). Muestra la suma total de probabilidades para que cuadre el sorteo.

---

## Grupo: Catálogo

### Productos — `/admin/productos`
Archivo: `src/pages/Tienda/admin/AdminProductos.jsx`.
Gestión completa del catálogo: ver en **tarjetas o tabla**, **buscar**, crear, **editar**, **duplicar**, ocultar/mostrar (visibilidad), eliminar, **acciones masivas** (selección múltiple) y **exportar** productos. Conserva borradores locales. El alta/edición abre el formulario en `/admin/productos/nuevo` o `/admin/productos/:id`.

> **Editor de producto** — `/admin/productos/nuevo` y `/admin/productos/:id` (`AdminProductoFormV2.jsx`). Formulario avanzado del producto: imágenes, mockups, **marca**/nicho/vendedor, categorías, colecciones, tags, personajes, descripción con editor de texto enriquecido (ReactQuill), vistas de personalización (canvas con Fabric.js) y editor de combos. La **marca** se elige en un carrusel de miniaturas (clic para asignar/quitar) y se persiste en `brandId`. **Preselección de marca (multi-marca):** si el formulario se abre con `?brandId=<id>` (lo hace el botón "Crear producto en {marca}" del panel por marca), la marca queda **preseleccionada** en un producto nuevo, sin tocar nada de precios/stock.

### Inventario — `/admin/inventario`
Archivo: `src/pages/Tienda/admin/AdminInventario.jsx`.
**Tabla rápida de stock**: edita el inventario de muchos productos a la vez, con **filtros** (búsqueda, categoría, colección, marca, tipo). Guarda automáticamente y registra cada cambio en el historial de inventario.

### Mockups Base — `/admin/mockups`
Archivo: `src/pages/Tienda/admin/AdminMockups.jsx`.
Plantillas base de prendas (mockups) con **variantes**, imagen base y categoría. Son la base sobre la que se montan los productos personalizables.

### Categorías — `/admin/categorias`
Archivo: `src/pages/admin/AdminCategorias.jsx`.
CRUD de **categorías** del catálogo: nombre, **orden** e imagen (con recorte de imagen integrado).

### Colecciones — `/admin/colecciones`
Archivo: `src/pages/admin/AdminColecciones.jsx`.
CRUD de **colecciones** (igual que categorías: nombre, orden e imagen con recorte). Las colecciones se usan, por ejemplo, en los carruseles del Page Builder.

### Nichos — `/admin/nichos`
Archivo: `src/pages/admin/AdminNichos.jsx`.
CRUD de **nichos** (tiendas temáticas multi-vendor): nombre, slug, tipo, **% de comisión**, orden, imagen y activo/inactivo. Cada nicho tiene su página pública en `/nicho/:slug`.

### Vendedores — `/admin/vendedores`
Archivo: `src/pages/admin/AdminVendors.jsx`.
CRUD de **vendedores del marketplace**: nombre, nombre visible, slug, **tipo** (House, POD, Reseller, Self-fulfill), **estado** (Activo, Pendiente, Suspendido), **% de comisión** y logo.

### Blueprints (POD) — `/admin/blueprints`
Archivo: `src/pages/admin/AdminBlueprints.jsx`.
Plantillas de **impresión bajo demanda (Print On Demand)**: prenda base, **costo base de impresión**, orden, activo, **áreas de impresión** (nombre, ancho y alto en cm, dpi) y **métodos de decoración** (ej. DTG). Son la base técnica de los productos personalizables fabricados por POD.

### Ofertas Flash — `/admin/flash-offers`
Archivo: `src/pages/admin/AdminFlashOffers.jsx`.
Crea **ofertas relámpago**: producto, **% de descuento**, fecha de inicio y fin, orden, activo. Además calcula **segmentos de clientes (RFM)** para dirigir las ofertas a los grupos correctos.

### Recompensas — `/admin/recompensas`
Archivo: `src/pages/admin/AdminRecompensas.jsx`.
Catálogo de **recompensas canjeables con monedas** (fidelización): título, descripción, **costo en monedas**, valor, orden y activo.

### Zonas de Envío — `/admin/envios`
Archivo: `src/pages/admin/AdminEnviosZonas.jsx`.
CRUD de **zonas de envío**: nombre, departamento, **costo**, **días estimados de entrega**, orden y activo.

### Pagos a Vendedores — `/admin/payouts`
Archivo: `src/pages/admin/AdminPayouts.jsx`.
**Payouts a vendedores**: muestra un **resumen de saldos** por vendedor y permite **registrar pagos** (vendedor, monto, estado —Por pagar / Pagado / Cancelado— y nota). Cierra el ciclo del marketplace junto con comisiones y sub-órdenes.

### Marcas — `/admin/marcas`
Archivo: `src/pages/admin/AdminMarcas.jsx`.
CRUD de **marcas**: nombre, logo (subida con recorte), orden, color de fondo, imagen de fondo, opacidad, **slug** (la URL de su página, p. ej. `ConAmor`) y **WhatsApp del asesor** de la marca (para enrutar consultas/pedidos al asesor correcto). Estas marcas alimentan el módulo "Carrusel de Logos / Marcas" del Page Builder **y son la base del sistema multi-marca** (cada producto pertenece a una marca por su `brandId` = doc id de `tienda_brands`). Las marcas actuales: **Con Amor** (todos los productos existentes), **MUSSA** y **MUEBLERIA**.

> **Toggle de confirmación multimarca:** desde aquí se configura el **número principal "Todo a WALA"** y un *toggle* que, al activarse, hace que un pedido con productos de varias marcas se reparta a **cada asesor por su `whatsappNumber`** (con el toggle apagado, todo va al número principal). Ver FUNCIONES-CLIENTE.md → Checkout / "Mis Compras".

> **Slug robusto (commit `88bc5db`, sesión 2026-06-29):** `createBrand`/`updateBrand` (`src/services/brands.js`) **persisten** el campo `slug` — si el admin lo deja vacío, se **deriva automáticamente** del `name` con el helper compartido `slugify` (normaliza tildes, mayúsculas y espacios). El formulario tiene un campo **"Slug (URL)"** opcional con **vista previa** de la URL resultante (`wala.pe/<slug>`). Este `slug` es lo que usan el ruteo de páginas de marca y la detección de marca del Header/WhatsApp (ver PLAN-MULTIMARCA.md → "Patrón común de detección de marca"); si una marca no tiene `slug` guardado, esos componentes igual la reconocen comparando contra `slugify(name)`.

> **Identidad de tienda por marca — `storeTitle`/`storeSubtitle`/`storeEmpty` (commit `dc1fdab`, sesión 2026-06-30, aislamiento entre marcas P2a):** tres campos **opcionales** nuevos en el formulario de marca:
> - **`storeTitle`** — título propio que reemplaza el título genérico de la tienda cuando el visitante está en la página de esa marca.
> - **`storeSubtitle`** — subtítulo propio (acompaña al título).
> - **`storeEmpty`** — mensaje propio para cuando el catálogo de esa marca no tiene productos que mostrar (p. ej. tras aplicar un filtro sin resultados).
>
> `TiendaPage.jsx` los usa **solo** cuando la página tiene marca (`pageBrandId`) y la marca configuró el campo; si el campo está vacío, cae al **mensaje global** de siempre (retrocompatible). Sirven para que MUSSA y MUEBLERIA tengan su propia voz de marca sin depender del texto genérico de Con Amor.

#### Panel por marca — `AdminMarcaProductos` (botón "Gestionar productos")
Archivo: `src/pages/admin/AdminMarcaProductos.jsx` (servicios: `getProductsByBrand` / `setProductBrand` en `products.js`; `getBrand` / `updateBrand` con `categoryNav` en `brands.js`). **No es una ruta propia**: se abre **dentro de `/admin/marcas`** al pulsar **"Gestionar productos"** en la tarjeta de una marca. Tiene **dos pestañas**:

- **Productos:** muestra los productos **ya asignados** a la marca (`getProductsByBrand`) con opción de **quitarlos en lote**, y la lista de productos **sin esa marca** para **asignarlos en lote**. La única escritura sobre el producto es el campo **`brandId`** vía `setProductBrand(id, brandId)` — una **escritura PARCIAL directa** (`updateDoc`): asignar pone `brandId:<marca>`, **quitar REMUEVE el campo** con `deleteField()`. **No toca** precio, stock, imágenes, variantes ni cobro. *(Detalle: esa escritura parcial arregla el bug por el que "Quitar de la marca" era un no-op, porque la ruta normal de guardado "limpiaba" los vacíos y nunca borraba el campo.)* También hay un botón **"Crear producto en {marca}"** que abre el formulario en `/admin/productos/nuevo?brandId=<id>` con la **marca preseleccionada**.
- **Nav de categorías** — **OVERRIDE OPCIONAL**: por defecto el módulo "Navegación por categorías" de la marca **NO necesita esta pestaña**, porque las burbujas se generan **automáticamente** desde las categorías de los productos de la marca (ver más abajo, "Selector de MARCA por sección"). Esta pestaña monta el **mismo editor reutilizable `CategoryNavEditor`** que la sección *Elementos con diseño* (`/admin/elementos-diseno/navegacion-categorias`): por cada burbuja edita **qué categoría filtra** (`categoryId`), su **nombre** y su **miniatura** (subir+recortar 1:1 o **heredar** de la categoría), además de **agregar/quitar/reordenar**, **"Generar automático"** (prellena con las categorías de los productos de la marca), **"Vaciar (volver a automático)"** y el **"Estilo del nav"** (alineación + modo estático/slider). Guarda el array **`categoryNav`** (`[{ categoryId, name, imageUrl, order }]`) y el objeto **`categoryNavStyle`** (`{ align, animation }`) con `updateBrand(brand.id, { categoryNav, categoryNavStyle })`, embebidos en `tienda_brands`. **Si `categoryNav` tiene items, REEMPLAZA a las burbujas automáticas**; si está vacío, manda el nav automático. *(Como el `categoryNav`/`categoryNavStyle` viven en la marca, esta pestaña, "Elementos con diseño" y el inline del Editor Visual editan lo mismo y quedan sincronizados.)*

### Landing Pages — `/admin/landing-pages` *(requiere permiso de Landing Pages)*
Archivo: `src/pages/Tienda/admin/AdminLandingPages.jsx`.
Crea y edita **páginas de aterrizaje / embudos**: título, **slug** (su URL), ocultar header/footer, **tema** aplicado y **productos enlazados** con su tipo de stock (global, infinito o exclusivo) y stock asignado. El contenido de cada landing se diseña con el Page Builder.

> **Campo de marca (`brandId`) — de primera clase (commit `88bc5db`, sesión 2026-06-29, aislamiento entre marcas P1):** el formulario gana un **selector de marca** opcional (lista `tienda_brands` vía `getBrands`) que persiste el **doc id** de la marca en el propio doc `landingPages/{slug}` (servicio `src/pages/Tienda/services/landingPages.js`). Cuando la landing tiene marca asignada, `DynamicLandingPage.jsx` la propaga a `TiendaPage.jsx` como **`pageBrandIdOverride`**, que **gana** sobre la inferencia automática de marca por las secciones de la página (el mecanismo que ya usaban `/MUSSA`/`/MUEBLERIA` desde la Fase 1). Es la forma más directa y explícita de decirle a una landing "esta página es de la marca X", sin depender de que sus secciones (`sidebar_catalog`/`categories_nav`) tengan el `brandId` configurado. `scripts/setup-marcas.js` ya escribe este campo al crear las landing pages de MUSSA/MUEBLERIA. Opcional y retrocompatible: sin marca, la landing se comporta como página global.

### Gestor de Temas — `/admin/temas` *(requiere permiso de Landing Pages)*
Archivo: `src/pages/Tienda/admin/AdminThemes.jsx`.
Gestiona **temas visuales (CSS)**: crearlos manualmente (nombre, autor, CSS) o subirlos, editarlos y eliminarlos. Los temas se asignan a landing pages (o como tema global) para cambiar el aspecto sin tocar el código.

### Cliparts — `/admin/cliparts`
Archivo: `src/pages/admin/AdminCliparts.jsx`.
Galería de **cliparts** (nombre, URL/imagen subida y categoría) que los clientes pueden usar en el editor de personalización.

---

## Grupo: Clientes y Pagos

### Métodos de Pago — `/admin/pagos`
Archivo: `src/pages/admin/AdminPagos.jsx`.
Configura los **datos de cobro**: número y nombre de **Yape**, número y nombre de **Plin**, y el **WhatsApp de pagos** con su mensaje prearmado (con variables como el código de pedido y el monto).

### Generador de Enlaces — `/admin/generador-pagos`
Archivo: `src/pages/admin/AdminGeneradorPagos.jsx`.
Crea **enlaces de cobro rápido**: ingresas concepto, moneda (PEN/USD) y monto, y genera un enlace tipo `wala.pe/pago-rapido/...` para enviar al cliente y que pague.

### Libro de Reclamaciones — `/admin/libro-reclamaciones`
Archivo: `src/pages/admin/AdminLibroReclamaciones.jsx`.
Bandeja del **libro de reclamaciones** (obligatorio en Perú): lista los reclamos con su estado (Pendiente / Respondido), permite **filtrar**, escribir una **respuesta** y marcarlos como atendidos.

### Gestión de Referidos — `/admin/referidos`
Archivo: `src/pages/admin/AdminReferidos.jsx`.
Revisa los **referidos**: cuando un pedido referido se entrega, el admin **aprueba** para liberar las monedas ganadas, o **rechaza** el referido.

### Crear cuentas de pedidos — `/admin/crear-cuentas-pedidos`
Archivo: `src/pages/admin/AdminCrearCuentasPedidos.jsx`.
Herramienta para **crear cuentas de cliente automáticamente** a partir de los pedidos del ERP (toma el correo del pedido). Procesa por lotes, evita duplicados por correo y puede migrar usuarios auto-creados antiguos.

### Usuarios y métricas — `/admin/usuarios-analytics`
Archivo: `src/pages/admin/AdminUsuariosAnalyticsPage.jsx`.
Listado de **usuarios con sus métricas individuales** (separadas en APP / WEB / Total): visitas, tiempo, compras, etc., con gráficos. Incluye la opción de **reconstruir el resumen histórico** de analítica.

### Encuesta de Suscripción — `/admin/encuestas`
Archivo: `src/pages/admin/AdminEncuestas.jsx`.
Configura la **encuesta de suscripción** que se muestra a los clientes, por pestañas: introducción, datos básicos, marcas, pantalla final y diseño.

### Fechas Importantes — `/admin/fechas-importantes`
Archivo: `src/pages/admin/AdminFechasImportantesPage.jsx`.
Centro de **campañas y fechas**, con un sub-menú interno de 4 vistas:
- **Calendario Global**: vista de calendario de todas las fechas.
- **Fechas Universales**: fechas comerciales para todos (ej. Día de la Madre).
- **Fechas de Usuarios**: cumpleaños/aniversarios que registran los clientes.
- **Eventos Organizables**: eventos para organizar campañas.

### Retos Semanales — `/admin/retos`
Archivo: `src/pages/admin/AdminRetos.jsx`.
Gestiona los **retos semanales** de fidelización: crear retos (título, descripción, tipo de acción, meta, **recompensa en monedas**), activar el reto global y **revisar las evidencias** que envían los clientes (aprobar/rechazar lo pendiente).

---

## Page Builder — Editor Visual WYSIWYG de la tienda

El **Page Builder** es el editor visual con el que se arma la apariencia de la tienda y de cada página, **arrastrando módulos**. No es un enlace propio del menú: se entra desde **Vista Tienda** (`/tienda`) y se activa el **Editor Visual** desde la barra superior de administrador.

- Componente del panel flotante: `src/pages/Tienda/admin/VisualEditorPanel.jsx`.
- Tipos de sección/módulo y sus opciones: `src/pages/Tienda/services/storefront.js`.

El panel flotante (se puede arrastrar, anclar a izquierda/derecha y **previsualizar en móvil**) tiene dos pestañas: **Módulos** (las secciones de la página) y **Ajustes**. Permite añadir, reordenar (arrastrar), editar, ocultar y eliminar secciones, y guardar los cambios. En landing pages también se elige el **tema** a aplicar.

> Existe además un editor más simple en `/admin/store-editor` (`AdminStoreEditor.jsx`) para el Hero principal y el layout de la grilla (columnas en PC/móvil, imagen secundaria al pasar el mouse). No está enlazado en el menú actual; el flujo recomendado es el Editor Visual descrito arriba.

### Texto enriquecido en TODAS las secciones (sesión 2026-06-28, ✅ desplegado)

Cada editor de sección con texto (Hero, Encabezado, Texto, Testimonios, Mapa, Marquesina, carruseles, Ventas Flash, etc.) incorpora dos bloques reutilizables de control:

- **Estilo de texto** (`TextStyleControl`) — por cada campo de texto editable de la sección (título, subtítulo, encabezado, contenido, descripción…) permite ajustar: **alineación** (izquierda / centro / derecha / por defecto), **subrayado**, **color de fondo del texto** y un **enlace de destino** (la palabra/título se vuelve clicable). Persiste con el contrato de claves `<campo>Align`, `<campo>Underline`, `<campo>Bg`, `<campo>Link`.
- **Botón de Acción (opcional)** (`ButtonFieldsControl`) — añade un botón con **texto** y **enlace** (`buttonText` / `buttonLink`) a las secciones de texto que no tenían botón propio. (Las que ya traen su propio editor de botón, como el Hero, no lo usan.)

Es **100% retrocompatible**: con los campos vacíos, las secciones se ven exactamente como antes (sin alineación forzada, sin subrayado, sin fondo, sin enlace, sin botón). El render aplica estos estilos con utilidades compartidas (`<TextoSeccion>` / `<BotonSeccion>`), y los enlaces internos (que empiezan con `/`) usan navegación SPA (`<Link>`) mientras que los externos abren en pestaña nueva.

- **Archivos clave:** `src/pages/Tienda/admin/editor/controls/TextStyleControl.jsx`, `src/pages/Tienda/admin/editor/controls/ButtonFieldsControl.jsx`, `src/pages/Tienda/components/textStyleUtils.jsx` (`estiloTexto`, `<TextoSeccion>`, `<BotonSeccion>`), `src/pages/Tienda/admin/VisualEditorPanel.jsx`, `src/pages/Tienda/services/storefront.js` (`getDefaultSettings`), `src/pages/Tienda/TiendaPage.jsx`.

### Selector de MARCA por sección (multi-marca, sesión 2026-06-28, ✅ desplegado)

Para construir una **página de marca** (`/ConAmor`, `/MUSSA`, `/MUEBLERIA`, ver FUNCIONES-CLIENTE.md → §1.3), el Editor Visual ofrece **dos caminos** que dejan la sección ya filtrada a la marca:

**(A) Módulos POR MARCA en "Añadir Nuevo Módulo" (la forma directa, recomendada).** El menú **"Añadir Nuevo Módulo"** lista, **además de las genéricas**, una opción **por cada marca** (generada **dinámicamente** con `getBrands`, agrupada bajo cada tipo):
- **"Productos {Marca}"** → arrastra un **`sidebar_catalog`** con `brandId` + `title` ("Productos {Marca}") **ya configurados**.
- **"Categorías {Marca}"** → arrastra un **`categories_nav`** con `brandId` **ya configurado**.

Así el dueño coloca el catálogo/nav de una marca **ya filtrado**, **sin tocar el dropdown** "Marca de esta sección". La opción genérica de catálogo se llama **"Catálogo (todas las marcas)"** (= global).

**(B) Selector "Marca de esta sección" (manual).** En los ajustes de **Catálogo con Sidebar** (`sidebar_catalog`), **Grid de productos** (`product_grid`) y **Navegación por categorías** (`categories_nav`) sigue habiendo un **selector** que lista las marcas (`getBrands`) y guarda el **doc id** en `settings.brandId` ("(Todas las marcas)" = vacío = global). Sirve para cambiar la marca de una sección ya colocada.

- En `sidebar_catalog` / `product_grid`, `TiendaPage` detecta ese `brandId` y arranca el catálogo paginado con la faceta `{ type:'brand', value: brandId }` → `getStoreProductsPage` trae **solo esa marca**, **server-side** (`where('brandId','==',...)`). La categoría del sidebar se aplica como filtro de cliente.
- En `categories_nav`, las burbujas son **AUTOMÁTICAS**: si la marca **no** tiene un `categoryNav` manual, `TiendaPage` **deriva las categorías de los PRODUCTOS de la marca** (`getProductsByBrand` → categorías distintas, con la **misma extracción de id** que el filtro del sidebar) y las **mapea a `tienda_categories`** (`getCategories`) para sacar **nombre + imagen**. Las **imágenes salen de `/admin/categorías`** (`tienda_categories.imageUrl`); **una categoría sin imagen = burbuja con la inicial + un color estable** (ya no se usan fotos de stock). Al pulsar una burbuja se **fija la categoría** (estado **compartido** con el sidebar de la misma página → filtra el catálogo **sin navegar**). El `categoryNav` manual sigue como **OVERRIDE opcional**.
  - **Editor inline del nav (commit `fc8a0d2`; "Estilo del nav" añadido en `425e9ce`):** cuando la sección "Navegación por categorías" tiene una **marca seleccionada**, el Editor Visual **embebe inline el mismo `CategoryNavEditor`** que la sección *Elementos con diseño* y el panel por marca. Así el dueño edita las burbujas (qué filtra, nombre, miniatura, orden, generar/vaciar) **y el "Estilo del nav"** (alineación + modo estático/slider) **sin salir del editor**. Como el `categoryNav` y el `categoryNavStyle` **viven en la marca**, esos cambios se **sincronizan** con los otros dos lugares y afectan a **todas las páginas** que usen ese nav. Sin marca, las burbujas son automáticas.
- **Acotado de marca por el nav:** una página que tiene un `categories_nav` de una marca **también acota su catálogo a esa marca** (`pageBrandId` considera el nav cuando no hay catálogo de marca) → pulsar una burbuja del nav de la marca A no muestra esa categoría de **todas** las marcas.
- **Retrocompatible:** sin `brandId`, el comportamiento es el de siempre (catálogo global, nav por enlaces). Índice Firestore `brandId + createdAt` necesario para la paginación por marca (ya existía).

**Cómo dejar lista una marca (flujo del dueño):** correr `scripts/setup-marcas.js --apply` (crea las marcas con su slug, backfill `brandId = Con Amor` en productos sin marca y crea las `landingPages` de ConAmor/MUSSA/MUEBLERIA) → entrar al Editor Visual de cada página de marca y, desde **"Añadir Nuevo Módulo"**, arrastrar **"Productos {Marca}"** + **"Categorías {Marca}"** (ya vienen filtrados) → asignar productos a la marca desde el panel por marca (al asignarlos, sus categorías aparecen **solas** en las burbujas). **El nav de categorías NO hay que armarlo a mano**; para personalizar orden/imágenes, define un `categoryNav` manual en el panel de la marca. *(Brand IDs reales: Con Amor `m3P26agqw7BjeYTDjs6j`, MUSSA `pMujqcyIIDUF2EdSSX5V`, MUEBLERIA `RMLsCQGvLo7c3NHgfkLO`.)*

- **Archivos clave:** `src/pages/Tienda/admin/VisualEditorPanel.jsx` (módulos por marca en "Añadir" + selector de marca + **inline `CategoryNavEditor`**), `src/pages/admin/AdminElementosDiseno.jsx` (catálogo de tarjetas "Elementos con diseño") + `src/pages/admin/elementosDiseno/registry.jsx` (registro extensible), `src/pages/admin/elementosDiseno/AdminElementoDisenoPage.jsx` (página por slug) y `src/pages/admin/elementosDiseno/editores/NavegacionCategoriasEditor.jsx` (editor del elemento "Navegación por categorías"), `src/components/admin/CategoryNavEditor/CategoryNavEditor.jsx` (editor reutilizable del nav **+ "Estilo del nav"**, embebido en los 3 lugares), `src/pages/admin/AdminMarcaProductos.jsx` (pestaña "Nav de categorías"), `src/pages/Tienda/services/storefront.js` (defaults `brandId:''`; label "Catálogo (todas las marcas)"), `src/pages/Tienda/TiendaPage.jsx` (nav AUTO-derivado + `pageBrandId` por nav + pasa `align`/`animation` del `categoryNavStyle`), `src/pages/Tienda/components/VisualCategoryNav/VisualCategoryNav.jsx` (burbuja con inicial cuando no hay imagen + alineación/slider), `src/services/products.js` (`getProductsByBrand`, faceta `brand`), `src/services/brands.js` (`slug`, `categoryNav`, **`categoryNavStyle`**), `scripts/setup-marcas.js`.

### Módulos disponibles (de `SECTION_TYPES`)

| Módulo | Para qué sirve |
|---|---|
| **Banner Principal (Hero)** | Imagen/video grande con título, subtítulo y botón. |
| **Encabezado** | Título + subtítulo de una sección. |
| **Texto** | Bloque de texto con título y contenido. |
| **Imagen** | Una imagen (con alt y enlace opcional). |
| **Video** | Un video (con poster opcional). |
| **Productos destacados** | Muestra los productos marcados como destacados. |
| **Carrusel de colección** | Carrusel con los productos de una colección elegida. |
| **Navegación por categorías** | Fila/burbujas de accesos a categorías. **Con setting `brandId`** (multi-marca): las burbujas son **AUTOMÁTICAS** — se derivan de las categorías que tienen los **productos de esa marca**, con la imagen de cada categoría (de `/admin/categorías`; sin imagen = burbuja con inicial). Al pulsarlas, **filtra el catálogo de la misma página** (no navega a `/tienda?categoria=`). Un `categoryNav` manual en el panel de la marca actúa como **override**, y el **`categoryNavStyle`** define su **alineación** (izq/centro/der/justificado, solo en modo estático) y **modo** (estático / slider animado). Sin `brandId`, es navegación global por enlaces. *Se inserta listo desde "Añadir Nuevo Módulo" → "Categorías {Marca}".* |
| **Grid de productos simple** | Rejilla de productos (con búsqueda/orden opcional). Acepta setting **`brandId`** para acotarlo a una marca. |
| **Catálogo (todas las marcas) / Catálogo con Sidebar** | Catálogo completo con barra lateral de filtros (estilo Mercado Libre). **Con setting `brandId`** (multi-marca): acota el catálogo paginado a **una sola marca** (server-side); la categoría del sidebar filtra en cliente. Vacío = catálogo global. *Para una marca, insértalo listo desde "Añadir Nuevo Módulo" → "Productos {Marca}".* |
| **Barra de Anuncios Superior** | Banda de avisos rotativos (colores y velocidad configurables). |
| **Carrusel Principal (Hero Slider)** | Carrusel de varias imágenes en la cabecera. |
| **Íconos de Confianza (Badges)** | Fila de íconos (envío, pago seguro, etc.). |
| **Ofertas Flash (Cuenta Regresiva)** | Sección de oferta con temporizador, sobre una colección. |
| **Testimonios / Opiniones** | Opiniones de clientes para dar confianza. |
| **Carrusel de Logos / Marcas** | Carrusel rotativo de logos de marcas. |
| **Lo Más Vendido (Fila de 5)** | Fila de 5 tarjetas destacadas. |
| **Pie de Página (Columnas/Enlaces)** | Footer configurable por columnas y enlaces. |
| **Ubicación / Mapa** | Bloque con mapa embebido y datos de la tienda física. |

---

## Cloud Functions (backend) — catálogo y endurecimiento (sesión 2026-06-28)

> Esta sección documenta las Cloud Functions **nuevas o endurecidas** y sus **flags/variables de entorno**. No son enlaces del menú: son código de servidor (`functions/`) que el dueño despliega por Cloud Shell / `firebase deploy --only functions`. Para el contexto de seguridad ver [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md) y [ESCALABILIDAD.md](./ESCALABILIDAD.md).
>
> **Principio rector: SEGURO POR DEFECTO.** Todo el endurecimiento de pagos viene **detrás de flags apagados** (`process.env.* !== 'true'`), por lo que **desplegar este código NO cambia el comportamiento actual** de los cobros. El dueño activa cada protección cuando esté listo (configura el secreto, prueba y enciende el flag). Con los flags apagados, los pagos se comportan exactamente como hoy.

### Pre-agregación de analítica

| Función | Tipo | Qué hace |
|---|---|---|
| **`aggregateAnalyticsDaily`** | `onSchedule` (gen2) | Cron diario (**00:20 hora de Lima**, `America/Lima`, `retryCount: 2`, `512MiB`, `timeoutSeconds: 540`) que agrega el **día anterior completo** de `analytics_events` + `analytics_sessions` en un único doc `analytics_daily/{YYYY-MM-DD}`. **Idempotente** (reescribe el doc con `.set()` sin merge) y paginado con cursor (páginas de 2000) para escalar. Reduce las lecturas del dashboard 60–170×. Archivo: `functions/analyticsDaily.js` (lógica pura en `functions/analyticsAggregations.js`). |
| **`aggregateAnalyticsDailyBackfill`** | `onCall` (callable) | **Solo admin** (exige `context.auth.token.admin === true`; si no, `permission-denied`). Reconstruye días concretos con la MISMA lógica (`procesarDia`): acepta `{ day }` o `{ fromDay, toDay }` (máximo 120 días por llamada). Pensado para **llenar el histórico una vez** tras desplegar, o re-agregar un día que cambió. |

> El dashboard ya lee estos docs (ver "Dashboard Analítica" arriba) con fallback automático al cálculo legacy si aún no existen.

### Pagos — endurecimiento (S-1 … S-4), todo SEGURO POR DEFECTO

| Función | Tipo | Qué hace / endurecimiento |
|---|---|---|
| **`processCulqiPayment`** | `onCall` | Cobro con Culqi (tarjeta, Perú). **S-4 idempotencia (SIEMPRE activa, no detrás de flag):** antes de cobrar reserva un **lock** `culqiCharges/{tokenId}` con `runTransaction` + `create()`; un doble clic / retry de red con el mismo `tokenId` (de un solo uso en Culqi) **NO vuelve a cobrar** y devuelve el resultado previo. **H-11:** recalcula el monto en PEN **server-side** desde el pedido real (`pedidos_web`/`pedidos`), no confía en el monto del cliente. La llave privada viene de `CULQI_SECRET_KEY` (secret de Functions, sin fallback dummy). Conservador: si el lock falla de forma inesperada, NO bloquea el cobro. **MARCA el pedido como pagado (fix `e84b6b1`, sesión 2026-06-28):** tras el cobro exitoso (dentro de la rama del lock, una vez por cobro real) escribe en `pedidos_web` los **mismos 7 campos** que el webhook (`pagado:true`, `estadoPago:"pagado"`, `culqiChargeId`, `montoPagado`, `montoPendiente:0`, `pagadoAt`, `metodoPago:"culqi"`) de forma **best-effort** (no rompe la respuesta del cobro) e **idempotente**; así "Recepción de Pedidos" ya distingue los pagados con tarjeta de los "por confirmar pago". Esto cubre el caso de hoy en que `culqiWebhook` aún no está registrado en Culqi. **Requiere redeploy:** `firebase deploy --only functions:processCulqiPayment`. |
| **`culqiWebhook`** | `onRequest` | **Mecanismo de RESPALDO:** confirma el pago **server-side** y marca el pedido (`pedidos_web`) como pagado de forma **idempotente** (colección de marcas `culqiWebhookEvents/{chargeId}`), con los **mismos campos** que `processCulqiPayment`. Hoy el que marca el pedido en la práctica es `processCulqiPayment`; el webhook **solo se dispara si su URL está registrada en el panel de Culqi** (pendiente). **S-2 verificación de firma** detrás del flag **`CULQI_VERIFY_SIGNATURE`** (default `'false'`): con el flag en `'true'` exige y valida la firma HMAC del webhook usando **`CULQI_WEBHOOK_SECRET`** (rechaza con 401 si la firma es inválida/ausente; si falta el secreto, error claro). Con el flag apagado, registra las cabeceras de firma en los logs para que el dueño confirme el nombre exacto antes de activarlo. |
| **`confirmPaymentSecure`** | `onCall` | Marca una orden del marketplace como `paid` y genera los payouts (idempotente). **S-3 verificación de propiedad (ownership)** detrás del flag **`ENFORCE_PAYMENT_OWNERSHIP`** (default `'false'`): con el flag en `'true'`, exige que el `uid` autenticado sea el **`buyerUid`** de la orden (o un admin); así un usuario no puede confirmar el pago de una orden ajena y disparar payouts indebidos. Con el flag activo, ante un fallo de lectura **falla cerrado** (no confirma). Con el flag apagado, comportamiento idéntico al de hoy (cualquier autenticado puede confirmar). |
| **`createPaypalOrderSecure`** | `onCall` | **S-1 PayPal server-side** (flujo robusto, igual que `processCulqiPayment`/H-11): autentica, **recalcula el monto USD server-side** desde el pedido real (PEN→USD con `config/fx`, sin confiar en montos del cliente) y crea la orden en PayPal (intent CAPTURE) vía OAuth. Devuelve `{ orderID }`. Requiere las envs **`PAYPAL_CLIENT_ID`** / **`PAYPAL_SECRET`** (y opcional `PAYPAL_ENV='live'`, default sandbox = seguro para probar); si faltan, responde un error claro (`failed-precondition`). |
| **`capturePaypalOrderSecure`** | `onCall` | Captura la orden en PayPal, verifica `status === 'COMPLETED'` y que el monto capturado coincide con el recalculado server-side, y **solo entonces** marca el pedido como pagado en `pedidos_web` (Admin SDK), de forma **idempotente** por `captureId`. |

> **PayPal seguro — activación desde el cliente:** el componente `PaypalCheckout` delega el cobro a estas dos funciones **solo** cuando el flag de build **`VITE_PAYPAL_SERVER_SIDE`** está en `'true'` (default OFF). Con el flag apagado, el checkout usa el flujo PayPal cliente histórico, sin cambios de riesgo. Así, ambas funciones pueden estar desplegadas sin afectar a nadie hasta que se configuren las credenciales y se encienda el flag.

### Resumen de flags / variables de entorno

| Variable | Dónde | Default | Qué activa |
|---|---|---|---|
| `CULQI_VERIFY_SIGNATURE` | `culqiWebhook` (server) | `'false'` (OFF) | Verificación de firma HMAC del webhook de Culqi (S-2). |
| `CULQI_WEBHOOK_SECRET` | `culqiWebhook` (server) | — | Secreto para validar la firma (requerido cuando `CULQI_VERIFY_SIGNATURE='true'`). |
| `CULQI_SECRET_KEY` | `processCulqiPayment` (server) | — | Llave privada de Culqi para cobrar (secret de Functions). |
| `ENFORCE_PAYMENT_OWNERSHIP` | `confirmPaymentSecure` (server) | `'false'` (OFF) | Exige que quien confirma el pago sea el dueño de la orden (o admin) (S-3). |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` | PayPal server-side (server) | — | Credenciales OAuth de PayPal para `createPaypalOrderSecure` / `capturePaypalOrderSecure` (S-1). |
| `PAYPAL_ENV` | PayPal server-side (server) | `sandbox` | `'live'` para producción. |
| `VITE_PAYPAL_SERVER_SIDE` | `PaypalCheckout` (build/cliente) | `'false'` (OFF) | Hace que el checkout delegue el cobro de PayPal a las CFs seguras. |

> **Estado real desplegado (sesión 2026-06-28, `functions/.env.sistema-gestion-3b225`):**
> - `CULQI_VERIFY_SIGNATURE=false` — **apagado** hasta tener el **secret real de Culqi**; `CULQI_WEBHOOK_SECRET` quedó con un **placeholder** pero es **INERTE** (con `verify=false` no se valida firma).
> - `ENFORCE_PAYMENT_OWNERSHIP=true` — **desplegado**; **pendiente validar con una compra real**.
> - **PayPal server-side**: el código está **completo y desplegado** con `VITE_PAYPAL_SERVER_SIDE` en **OFF**. La **activación quedó PENDIENTE**: el dueño debe conseguir las credenciales de su app de PayPal (Client ID + Secret de `developer.paypal.com`) y ponerlas en `functions/.env` → redeploy → `VITE_PAYPAL_SERVER_SIDE=true` en Vercel. Se removieron del `.env` unas credenciales de ejemplo puestas por error (inertes con el flag OFF).
> - El **deploy de estas CFs** se hace por **Cloud Shell** (copiar/pegar): `firebase-tools` no corre bien con el **Node 24** local (se corta con `Premature close`); automatizarlo desde la PC exigiría **Node 20/22 LTS**.

> Otras CFs relacionadas ya documentadas: **`updateFxRate`** (cron diario que pobla `config/fx` con el tipo de cambio), **`getPublicGiftRegistry`** (registro de regalos por fecha, callable que devuelve datos mínimos sin Firestore directo), **`redeemRewardSecure`** (canje de recompensas). Ver [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md).

---

## Notas de fidelidad al código

- **Hay dos "dashboards" distintos**: el **Panel Principal** (`/admin`, `src/pages/AdminDashboard.jsx`, accesos rápidos) y el **Dashboard Analítica** (`/admin/dashboard`, `src/pages/admin/AdminDashboard.jsx`, métricas).
- **Rutas existentes que no figuran en el menú actual**: `/admin/store-editor` (editor simple del Hero/layout) y `/admin/notificaciones` (`AdminNotifications`). Funcionan por URL aunque no tengan enlace en la barra.
- La ruta antigua `/admin/zonas` redirige a `/admin`.
- Los enlaces del grupo *Catálogo* (Productos, Inventario, Mockups, etc.) y de *Clientes y Pagos* solo aparecen si el admin tiene el permiso correspondiente; **Marcas, Landing Pages y Gestor de Temas** están dentro del grupo Catálogo en el menú.
