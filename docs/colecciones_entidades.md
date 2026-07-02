# Entidades y Colecciones del Proyecto Wala

A continuación se detalla absolutamente todas las colecciones identificadas en el proyecto (Firestore), separadas entre las que cuentan con un esquema JSON formal definido en `src/models/` y las que son generadas dinámicamente o gestionadas desde los servicios (`src/services/`).

---

## 1. Colecciones con Esquema Definido (Models V2 y Wala)

### `productos_wala` (o `products`)
Colección principal para almacenar los productos de la tienda.
**Campos:**
- `name` (string): Nombre público del producto.
- `sku` (string): Código interno de referencia.
- `vendor` (string): Vendedor/proveedor.
- `productType` (string): Tipo de producto (ej. Apparel).
- `description` (string): Descripción enriquecida en HTML.
- `price` (number): Precio regular.
- `salePrice` (number): Precio de oferta.
- `inStock` (number): Stock general.
- `visible` (boolean): Indica si el producto se muestra en la tienda.
- `featured` (boolean): Indica si el producto es destacado.
- `featuredOrder` (number): Orden de producto destacado.
- `whatsappEnabled` (boolean): Habilitar contacto por WhatsApp.
- `whatsappNumber` (string): Número de contacto de WhatsApp.
- `whatsappMessage` (string): Mensaje predeterminado de WhatsApp.
- `brandId` (string): Referencia a la marca (`tienda_brands`).
- `categories` (array de strings): IDs de las categorías asociadas.
- `collections` (array de strings): IDs de las colecciones asociadas.
- `tags` (array de strings): Etiquetas de búsqueda.
- `characters` (array): Personajes asociados.
- `mainImage` (string): URL de la imagen representativa global.
- `mainSizes` (array): Tallas principales (ej. `["S", "M", "L"]`).
- `hasVariants` (boolean): Indica si tiene variantes de color/estilo.
- `defaultVariantId` (string): ID de la variante por defecto.
- `variantDisplayBehavior` (string): Comportamiento de visualización de variantes.
- `behaviorImpressionsThreshold` (number): Umbral de impresiones.
- `variants` (array de objetos): Lista de variantes (colores/estilos). Cada una contiene `id`, `name`, `imageUrl`, `images`, `sizes` (con `size` y `stock`).
- `customizable` (boolean): Indica si el producto es personalizable.
- `thumbnailWithDesignUrl` (string): URL del thumbnail con diseño.
- `customizationViews` (array de objetos): Vistas de personalización (frente, espalda, zonas de impresión, capas, etc.).
- `productCliparts` (array): Cliparts asociados al producto.
- `isComboProduct` (boolean): Indica si es un combo/paquete.
- `comboPreviewImage`, `comboLayout`, `comboItems`, `comboItemCustomization`: Configuración de combos.
- `isV2` (boolean): Bandera para identificar si fue creado con AdminProductoFormV2.

### `tienda_categories`
Gestión de las categorías de productos (V2) con soporte visual.
**Campos:**
- `name` (string): Nombre público de la categoría.
- `imageUrl` (string): URL de la imagen representativa (1:1 circular).
- `order` (number): Prioridad de ordenamiento.
- `createdAt` (timestamp): Fecha y hora de creación.
- `updatedAt` (timestamp): Fecha y hora de modificación.

### `tienda_brands`
Gestión de las marcas de la tienda premium.
**Campos:**
- `name` (string): Nombre público de la marca.
- `description` (string): Descripción corta de la filosofía o historia.
- `imageUrl` (string): URL del logotipo principal.
- `config` (object): Configuración visual avanzada (`colorHex`, `bgOpacity`, `backgroundImageUrl`).
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `tienda_collections`
Agrupa productos en colecciones temporales o campañas (ej. Drop Summer 2024).
**Campos:**
- `name` (string): Nombre de la colección.
- `imageUrl` (string): URL del banner de la colección (16:9).
- `order` (number): Prioridad de ordenamiento.
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `tienda_landing_pages`
Landing pages dinámicas y personalizadas (V2).
**Campos:**
- `title` (string): Título principal del Landing Page.
- `slug` (string): Path de la URL.
- `heroImage` (string): URL de la imagen de cabecera principal.
- `theme` (object): Variables CSS (`backgroundColor`, `primaryColor`, `textColor`).
- `targetBrandId` (string): ID de la marca objetivo.
- `targetCollectionId` (string): ID de la colección objetivo.
- `isActive` (boolean): Habilitar o inhabilitar la URL.
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### `tienda_mockups`
Mockups (prendas/artículos en blanco) como base para productos.
**Campos:**
- `name` (string): Nombre identificador del mockup.
- `category` (string): Categoría del mockup.
- `baseImageUrl` (string): URL de la imagen base.
- `variants` (array de objetos): Colores o vistas disponibles (`colorName`, `colorHex`, `imageUrl`).
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

---

## 2. Otras Colecciones Operativas (Servicios e Integraciones)

Estas colecciones no tienen un JSON schema rígido en el repositorio, pero son llamadas explícitamente en el código fuente (CRUD en `src/services/` y `functions/`):

### Usuarios y Autenticación
- **`portal_clientes_users`** (y su versión legacy **`users`**): Contiene los perfiles de los usuarios de la tienda (datos personales, referidos, roles).
- **`adminRoles`**: Gestión de permisos y roles para el panel de administración.

### E-commerce y Pedidos (ERP)
- **`pedidos`**: Registro principal de pedidos generados (conectado a `erpDb`).
- **`pedidos_web`**: Registro específico de pedidos ingresados por la web.
- **`producto_cliente_personalizado`**: Productos customizados creados por el cliente antes de la compra.
- **`wishlists`**: Listas de deseos de los usuarios.
- **`product_reviews`**: Reseñas y calificaciones de los productos.
- **`referrals`**: Sistema de referidos (campos como `orderId`, `createdAt`, quién refiere y referido).

### Componentes de Personalización (Diseño)
- **`cliparts`**: Imágenes pre-diseñadas para personalización de prendas.
- **`fonts`**: Fuentes tipográficas para el personalizador.
- **`characters`**: Personajes para estampar.
- **`customShapes`**: Formas personalizadas en el diseñador.
- **`productTypes`**: Tipos de productos base.
- **`tags`**: Gestión de etiquetas de búsqueda o agrupamiento.
- **`vendors`**: Proveedores de las prendas.

### Herramientas de Marketing, Eventos y Fidelización
- **`suggested_packages`**: Paquetes de productos sugeridos.
- **`universal_dates`**: Fechas importantes universales (ej. Día de la Madre).
- **`organizable_events`**: Eventos creados u organizables (cumpleaños, aniversarios).
- **`ruletaPrizes`**: Premios para el juego de la ruleta (campos como `probability`, `prize`).
- **`wordle_daily_words`**: Palabras diarias para el juego Wordle integrado.
- **`wordle`**: Partidas y estadísticas de los jugadores del Wordle.

### Temas, UI y Analítica
- **`storefront`**: Configuración dinámica de la interfaz principal de la tienda.
- **`tienda_themes`**: Paletas y configuraciones de temas de color.
- **`heatmap_events`**: Rastreo de clics y comportamiento del usuario (mapas de calor).
- **`storeConfigLogs`**: Logs y backups de configuración de la tienda.
- **`inventoryLogs`**: Historial de movimientos de inventario (`timestamp`, etc).
- **`users/{uid}/notifications`**: Subcolección de notificaciones individuales para cada usuario.

### Formularios y Encuestas
- **`cuestionarios_templates`**: Plantillas para cuestionarios y formularios.
- **`tienda_encuesta_config`**: Configuraciones para encuestas de satisfacción.

---

## 3. Módulos Nuevos: Sorteos/Rifas y Enlaces útiles

Colecciones añadidas por los módulos **Sorteos y Rifas ("Raffles")** y **Enlaces útiles
(link-in-bio)**. Los contadores, chances, pagos, ganadores y eventos de analítica los mantienen
**exclusivamente Cloud Functions** (`functions/index.js`, onCall); el cliente nunca los escribe.
Detalle con campos EXACTOS en `docs/wala/MODELO-DATOS.md` §3.9 y §3.10.

### Sorteos y Rifas ("Raffles")

#### `sorteos`
Colección raíz de cada sorteo/rifa. Servicio: `src/services/sorteos.js`. Público en `/sorteos`,
admin en `/admin/sorteos` y `/admin/sorteos/:id`.
**Campos (config escrita por el admin, `construirDocSorteo`):**
- `titulo` (string), `descripcion` (string).
- `tipo` (string): `"gratis"` | `"pagado"`.
- `precioTicket` (number): soles; solo si `tipo=="pagado"` (en gratis = 0). Fuente única de verdad del cobro server-side.
- `moneda` (string): `"PEN"`.
- `requisitoApp` (string): `"ninguno"` | `"obligatorio"` (debe entrar desde el app) | `"chanceExtra"` (+1 chance si entra desde el app).
- `numGanadores` (number): N ganadores por defecto.
- `premio` (object): `{ nombre, imagenUrl, valor }`.
- `heroImagenUrl` (string), `fechaInicio` (string), `fechaFin` (string).
- `estado` (string): `"borrador"` | `"activo"` | `"cerrado"`.
- `chanceExtraCompartir` (boolean): habilita +1 chance por compartir (honor).
- `chanceExtraReferido` (boolean): habilita +1 chance por referido.
- **Contadores/ganadores denormalizados (SOLO servidor):** `contadorParticipantes` (number, aproximado), `ganadores` (array `[{uid, nombre}]`, se fija al cerrar / `arrayUnion` al re-sortear), `cerradoAt` (timestamp).
- `createdAt`, `updatedAt` (timestamp).

#### `sorteos/{id}/participantes` (subcolección, id del doc = `uid`)
Un doc por participante, idempotente. Lo crea `participarSorteoGratis` o la confirmación de pago de ticket.
**Campos:** `uid`, `nombre`, `telefono`, `correo`, `dni`, `tickets` (0 en gratis), `ticketsPagados` (Σ tickets con pago confirmado), `chancesBase` (1), `chancesExtra`, `chancesTotal` (peso del sorteo), `origenApp` (boolean), `estado` (`"elegible"` → `"ganador"`), `compartioClaim`/`compartioAt` (flag idempotente de la chance por compartir), `createdAt`.

#### `sorteos/{id}/tickets` (subcolección, id autogenerado)
Intención de compra de tickets pagados. La crea `comprarTicketSorteoSecure`; el pago lo confirma server-side (`confirmarTicketSorteoDesdePago`). El cliente jamás escribe `pagoConfirmado`.
**Campos:** `sorteoId`, `participanteUid`, `correo`, `telefono`, `dni`, `cantidad`, `montoCentimos` (autoritativo = `precioTicket*100*cantidad`), `moneda`, `pagoId` (chargeId Culqi / captureId PayPal, al confirmar), `metodoPago` (`"culqi"`|`"paypal"`), `pagoConfirmado` (boolean; SOLO servidor), `asignadoPor` (`"pago"`), `confirmadoAt`, `createdAt`.

#### `sorteos/{id}/sorteos_realizados` (subcolección, id = `drawId`)
Evidencia auditable de cada sorteo (RNG seguro `crypto.randomBytes(32)` + DRBG SHA-256, ponderado sin reemplazo). La escribe `decidirGanadoresSorteo` con lock `t.create`. Varios docs = cierre + re-sorteos.
**Campos:** `seed` (hex 64), `poolHash` (sha256 del pool ordenado por uid de `{uid,peso}`), `totalElegibles`, `numGanadores`, `ganadores` (`[{uid, nombre, correo, telefono, pesoUsado}]`), `excluirUids` (no vacío ⇒ re-sorteo), `decididoPor` (admin uid), `algoritmo` (`"HMAC/SHA256-DRBG"`), `at`.

#### `sorteos/{id}/contador` (subcolección, ids `"0".."9"`)
Contador distribuido por **shards** (`SORTEO_CONTADOR_SHARDS = 10`) para evitar el hot-doc en lives. Cada participante nuevo hace +1 en un shard aleatorio; la página pública lee ≤10 docs y suma (`getContadorSorteo`).
**Campos:** `count` (number).

### Enlaces útiles (link-in-bio / Linktree)

#### `link_pages`
Cada doc es una página pública de botones servida en `/l/{slug}`. Servicio: `src/services/enlaces.js`. Admin en `/admin/enlaces` y `/admin/enlaces/:id` (constructor con vista previa móvil + Analítica). Los contadores viven en la nube (nunca localStorage).
**Campos:**
- `slug` (string): único; identifica la URL pública `/l/{slug}`.
- `titulo` (string), `descripcion` (string), `avatarUrl` (string, sube por `uploadFile`).
- `estado` (string): `"activo"` | `"borrador"`.
- `diseno` (object): `{ buttonStyle ("solid"|"glass"|"outline"), cornerRoundness (px), buttonShadow ("none"|"soft"|"strong"), buttonColor, buttonTextColor, background {type ("color"|"gradient"|"image"), value}, fontFamily }`.
- `botones` (array de objetos): `{ id, titulo, url, thumbnailUrl, order }` (arrastrar-para-reordenar).
- `redes` (array de objetos): `{ id, tipo ("instagram"|"facebook"|"tiktok"|"whatsapp"|"custom"), nombre, url, iconUrl, order }`.
- `visitas` (number): contador denormalizado (lo incrementa la CF de visita).
- `createdAt`, `updatedAt` (timestamp).

#### `link_pages/{pageId}/clics` (subcolección, id del doc = `botonId`)
Contador de clics por botón. Lo incrementa SOLO `registrarClicEnlace` (`FieldValue.increment(1)`). El admin lo lee con `getClicsDeLinkPage`.
**Campos:** `count` (number).

### Eventos de analítica nuevos en `analytics_events`

Los módulos añaden dos tipos de evento al esquema (`src/services/analytics/schema.js`), emitidos **únicamente** por las Cloud Functions (evita doble conteo):
- **`link_page_view`**: visita a `/l/{slug}` (la escribe `registrarVisitaEnlace`). Campos: `type`, `pageId` (top-level), `path` (`/l/{slug}`), `uid`, `anonymousId`, `sessionId`, `clientType` (`APP`/`WEB`), `countryCode`, `device`, `clientTsMs`, `serverTs`, `eventData:{pageId, slug}`.
- **`link_click`**: clic en un botón (la escribe `registrarClicEnlace`). Igual que arriba + `botonId` y `url`; `eventData:{pageId, botonId, url}`.

El país/dispositivo se completa uniendo el evento con `analytics_sessions` por `sessionId` (mismo mecanismo que el dashboard). `getAnaliticaEnlace` consulta `where pageId=='…'` (índice de un solo campo, sin compuesto).
