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
| Catálogo con filtros (sidebar: categorías, temporadas, colecciones, marcas, tipo, etiquetas, personajes) | módulo dentro de `/`, `/tienda` | Activo |
| Ficha de producto (galería, variantes, talla, cantidad, reseñas, compartir) | `/producto/:id` | Activo |
| Editor de personalización (POD) | `/editor/:id` | Activo |
| Página "Personalizar" (listado de productos personalizables) | `/personalizar` | Activo |
| Buscador con facetas y paginación | `/buscar` | Activo |
| Directorio de nichos | `/nichos` | Activo |
| Página de un nicho | `/nicho/:slug` | Activo |
| Tienda pública de un vendedor | `/tienda-vendedor/:slug` | Activo |
| Carrito | `/carrito` | Activo |
| Checkout (incl. venta internacional) | `/checkout` | Activo |
| Pago rápido (link directo) | `/pago-rapido/:id` | Activo |
| Mi Cuenta (layout con pestañas) | `/cuenta` | Activo (requiere login) |
| Mis Pedidos | `/cuenta/pedidos` | Activo |
| Lista de Deseos (privada) | `/cuenta/wishlist` | Activo |
| Lista de Deseos pública (compartible) | `/wishlist/:userCode` | Activo |
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
  - **Encabezado** (título), **Banner Principal** (hero con imagen/video y botón), **Carrusel de imágenes**, **Carrusel de colección**, **Barra de anuncios** (texto en movimiento), **Video** (YouTube/Vimeo/archivo), **Ventas Flash** (con cuenta regresiva), **Testimonios**, **Ubicación (mapa)**, **Sellos de confianza** (trust badges), **Marquesina de marcas**, **Fila "Lo más vendido"**, **Productos destacados**, **Grilla de productos** y **Catálogo con barra lateral de filtros** (`sidebar_catalog`).
  - El orden de productos puede ser: más nuevos, precio ascendente/descendente o nombre.
  - Incluye un **banner de descarga de la app** cuando no hay filtro de categoría/búsqueda activo.
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

---

## 2. Ficha de producto (`/producto/:id`)

- **Qué es:** la página de detalle de un producto (PDP). Soporta productos simples y **combos** (paquetes de varios sub-productos).
- **Qué hace:**
  - **Galería** de imágenes con miniaturas y **zoom** al pasar el mouse; las imágenes se arman según la variante/color seleccionado y las vistas de personalización (frente/espalda).
  - **Selector de color** (variantes con swatch de imagen o color) y **selector de talla**.
  - En combos: selector de talla y color por cada sub-producto, con vista previa compuesta.
  - **Selector de cantidad** (+/−).
  - **Precio** con soporte de precio original tachado y **badge de descuento** (%).
  - Botón **"Agregar al carrito"** (o "Agotado" si no hay stock).
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
  - Hoy filtra/ordena/pagina **en memoria** sobre el catálogo cacheado; está preparado para conectarse a Algolia/Typesense/Meilisearch en el futuro sin cambiar la interfaz.
- **Ruta:** `/buscar?q=...`
- **Archivos clave:**
  - `src/pages/SearchPage.jsx`
  - `src/services/search.js` (`searchCatalog`)
  - `src/constants/marketplace.js` (`FULFILLMENT_TYPES`)

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

### 6.2 Checkout (`/checkout`) — incluye VENTA INTERNACIONAL
- **Qué es:** el formulario de datos de envío + selección de método de pago.
- **Qué hace (datos de envío):**
  - **País** (selector con autodetección por geolocalización; no pisa la elección manual ni el país del perfil). Default seguro: Perú (`PE`).
  - **Nombre completo**, **Documento**, **Teléfono internacional**, **Email**, **Ciudad/Región** (Lima / Callao / Provincias), **Distrito** y **Dirección exacta**.
  - **Documento condicional:** si el país es **Perú**, valida DNI estricto (8 dígitos); para **otros países** el documento es texto libre (solo requerido). El tipo de documento se marca `DNI` (Perú) u `OTRO` (extranjero).
  - **Teléfono internacional:** componente con código de país (`PhoneIntlInput`); guarda el número completo (código + número local).
  - **Modo Regalo (gratis):** activa una experiencia digital para el destinatario (nombre del destinatario, mensaje de máx. 200 caracteres y sticker de Kapi: Amor/Fiesta/Feliz).
  - **Monedas (KapiSol):** si el usuario tiene monedas, puede aplicarlas como descuento (hasta el 50% del subtotal). Las monedas usadas se "congelan" en estado de espera hasta confirmar.
  - **Envío:** gratis si el subtotal (con descuento) supera S/100; si no, S/15.
- **Qué hace (pago — diferenciado por país):**
  - Al confirmar, genera el pedido y guarda una orden en `pedidos_web` (para validación previa), arma un mensaje de WhatsApp con el detalle, procesa referidos y regalos de wishlist, y actualiza el perfil del usuario con sus datos.
  - **Perú:** ofrece **Culqi** (tarjeta) **o** acordar pago por **WhatsApp (Yape / Plin / Transferencia)**. Para Culqi, el checkout **abre el formulario de pago automáticamente** (auto-cobro).
  - **Internacional:** ofrece **PayPal** (Culqi queda oculto) **o** acordar pago por WhatsApp.
  - **Moneda local + USD (sesión 2026-06-27):** el checkout muestra el total en la **moneda local del país del comprador** (con su nombre natural) y, para pagos por PayPal, el aviso **"Pagarás X USD por PayPal"** (PayPal cobra en USD). El tipo de cambio se lee de `config/fx` (poblado a diario por la Cloud Function `updateFxRate`) con un margen y un *fallback* si la config no está disponible; hay un monto mínimo de PayPal de 1 USD.
  - **Aviso de envío internacional:** si el país NO es Perú, muestra el aviso **"la entrega demora de 7 a 30 días hábiles"** (tanto en la pantalla de pago como en el mensaje de WhatsApp).
  - **Confirmación de pago en backend:** el pago con Culqi se confirma server-side (recálculo del monto en `processCulqiPayment`) y la Cloud Function `culqiWebhook` marca el pedido (`pedidos_web`) como pagado de forma idempotente. *(Nota operativa: la URL de `culqiWebhook` debe estar registrada en el panel de Culqi y `REACT_APP_PAYPAL_CLIENT_ID` debe existir en Vercel para que PayPal cobre en producción y no en sandbox.)*
  - **Validación del documento (sesión 2026-06-27):** se relajó la validación para no bloquear silenciosamente el botón de pago — el documento exige **≥3 caracteres** (cualquier tipo); si hay un campo con error, muestra un aviso (toast) y hace scroll al primero. En Perú el DNI sigue marcándose como tal.
  - Tras el pago/confirmación, vacía el carrito y lleva a "Mis Pedidos". Emite eventos de analítica (inicio de checkout y compra completada).
- **Ruta:** `/checkout`
- **Archivos clave:**
  - `src/pages/CheckoutPage.jsx`
  - `src/components/intl/CountrySelect.jsx`, `src/components/intl/PhoneIntlInput.jsx`
  - `src/services/geo.js` (autodetección de país)
  - `src/components/CulqiCustomCheckout/`, `src/components/PaypalCheckout/`
  - `src/services/erp/firebase.js` (`createWebOrder`), `src/services/referrals.js`, `src/services/wishlist.js`

### 6.3 Pago rápido (`/pago-rapido/:id`)
- **Qué es:** página para pagar un pedido directamente desde un enlace (sin pasar por todo el carrito).
- **Archivos clave:** `src/pages/PagoRapidoPage.jsx`

---

## 7. Mi Cuenta (`/cuenta`)

- **Qué es:** el área privada del cliente, con un layout de **pestañas**. Requiere iniciar sesión (si no, muestra un mensaje para loguearse).
- **Pestañas:** Mis Pedidos, Lista de Deseos, Mis Creaciones, Mis Referidos, Fechas Importantes, Misiones, Catálogo Recompensas, y el botón "Mi Perfil".
- **Archivo clave del layout:** `src/pages/CuentaLayout.jsx`
- (Entrar a `/cuenta` o `/pedidos` redirige a `/cuenta/pedidos`.)

### 7.1 Mi Perfil (`/cuenta/perfil`)
- **Qué es:** datos personales + saldo de recompensas + avatar.
- **Qué hace:**
  - **Datos personales:** nombre, país, documento y teléfono. En Perú usa toggle **DNI/CE** con validación estricta; fuera de Perú el documento es texto libre y el teléfono es internacional. También fecha de nacimiento.
  - **Cartera de recompensas (KapiSol):** muestra el saldo de monedas y las monedas "en espera"; código de referido copiable.
  - **Avatar Studio:** configurador de avatar (tono de piel, peinado, ojos, boca, accesorio, peso/altura y "vestir" con productos de ropa del catálogo).
  - Cerrar sesión.
- **Archivos clave:** `src/pages/cuenta/PerfilPage.jsx`, `src/components/profile/AvatarStudio.jsx`

### 7.2 Mis Pedidos (`/cuenta/pedidos`)
- **Qué es:** historial de pedidos del cliente.
- **Qué hace:** busca los pedidos por el **DNI/documento** del perfil (en el ERP). Si falta el documento, pide completar el perfil; si no hay pedidos, lo indica e invita a la tienda.
- **Archivos clave:** `src/pages/cuenta/CuentaPedidosPage.jsx`, `src/components/Results.jsx`, `src/hooks/usePedidos.js`

### 7.3 Lista de Deseos privada (`/cuenta/wishlist`)
- **Qué es:** los productos que el cliente guardó como favoritos.
- **Qué hace:** muestra la grilla de favoritos; permite **compartir la lista** (genera enlace público `/wishlist/<código>`); marca con un badge los productos que ya le regalaron. Sugiere registrar el cumpleaños para recordatorios.
- **Acceso desde el header (sesión 2026-06-27):** el corazón de favoritos del header muestra un **badge con la cantidad** de productos guardados y, al abrir el desplegable de favoritos, una **tira de miniaturas** de los productos en la lista.
- **Botones de la cabecera (sesión 2026-06-27, ✅ desplegados):**
  - **"🛒 Agregar todo al carrito":** atajo que agrega de un golpe todos los productos no regalados de la lista al propio carrito (compra para uno mismo, no es modo regalo). Omite productos borrados, sin stock/inactivos y los que ya están en el carrito; muestra un toast resumen.
  - **"📅 Mis fechas especiales":** copia y abre la **URL pública** del **registro de regalos por fecha** (`/regalar/:referralCode`, ver §7.4). Privacidad resuelta: la página pública consume una **Cloud Function** (`getPublicGiftRegistry`) que devuelve solo datos mínimos, no lee Firestore directo.
- **Estado y detalle completo:** ver [PLAN-FECHAS-ESPECIALES.md → "ESTADO Y FUNCIONAMIENTO — Registro de regalos por fecha (/regalar)"](./PLAN-FECHAS-ESPECIALES.md). Pendiente: REDESPLEGAR la Cloud Function `getPublicGiftRegistry` (fix del bug de wishlist vacía) + drag-and-drop en progreso.
- **Archivos clave:** `src/pages/cuenta/WishlistPage.jsx`, `src/contexts/WishlistContext.jsx`

### 7.4 Lista de Deseos pública (`/wishlist/:userCode`)
- **Qué es:** la versión **compartible** de la wishlist (la ve cualquiera con el enlace).
- **Qué hace:** muestra la lista de deseos de una persona (con su nombre) para que amigos/familia puedan comprarle y regalarle.
- **Archivos clave:** `src/pages/WishlistPublic/WishlistPublic.jsx`

### 7.4-bis Registro de regalos por fecha (`/regalar/:referralCode`) — "Mis fechas especiales"
- **Qué es:** página pública que funciona como **registro de regalos por fecha**. El dueño la comparte (botón "📅 Mis fechas especiales" de su wishlist); quien la abre ve las **fechas especiales del dueño** (cumpleaños/aniversarios/fechas especiales de su perfil) como **selector de fecha de entrega** + su **wishlist**.
- **Cómo funciona:** elige una fecha + un producto → "Regalar este 🎁" agrega el item al carrito en **Modo Regalo** con `deliveryDate` + el dueño como destinatario → el checkout preselecciona Modo Regalo y la fecha, guarda `giftDetails.deliveryDate` en el pedido (y lo pone en el WhatsApp) → al confirmar marca el producto como regalado y **notifica al dueño** (`markItemAsGifted`). La página **no lee Firestore directo**: pide los datos mínimos a la Cloud Function `getPublicGiftRegistry` (sin email/teléfono/dni del dueño ni datos sensibles de terceros).
- **Estado (✅ desplegado y funcionando):** flujo completo operativo. **Pendiente:** REDESPLEGAR la Cloud Function `getPublicGiftRegistry` por Cloud Shell (corrige un bug por el que la wishlist salía vacía aunque el dueño tuviera productos). **En progreso:** drag-and-drop (arrastrar productos sobre las fechas). Detalle completo, bugs y decisiones abiertas en [PLAN-FECHAS-ESPECIALES.md → "ESTADO Y FUNCIONAMIENTO — Registro de regalos por fecha (/regalar)"](./PLAN-FECHAS-ESPECIALES.md).
- **Archivos clave:** `src/pages/GiftRegistry/GiftRegistryPage.jsx`, `functions/index.js` (`getPublicGiftRegistry`), `src/contexts/CartContext.jsx`, `src/pages/CheckoutPage.jsx`, `src/services/wishlist.js`, `src/App.jsx`

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
  - Calcula **fechas globales** automáticas según rol/género (Día de la Madre/Padre, San Valentín, Día del Niño, Día de la Amistad, Día de la Mujer/Hombre).
  - Muestra **paquetes de regalo sugeridos** por persona y permite **"Agregar todo al carrito"**.
  - Editar y eliminar personas.
- **Archivos clave:** `src/pages/cuenta/CuentaFechasImportantesPage.jsx`, `src/services/fechasImportantes.js`

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

## 10. Suscripciones (Wala Box)

### 10.1 Landing de suscripciones (`/suscripciones`)
- **Qué es:** la página de venta del modelo de suscripción de regalos ("Wala Box").
- **Qué hace:** explica el modelo (programar fechas → curaduría → pago mensual → entrega a tiempo) e invita a configurar las fechas. Indica que el **pago mensual estará disponible "muy pronto"**; por ahora el cliente puede separar/configurar sus fechas.
- **Archivos clave:** `src/pages/SubscriptionLandingPage.jsx`

### 10.2 Encuesta de suscripción / perfil de regalos (`/encuesta-suscripcion`)
- **Qué es:** la encuesta para construir el perfil de regalos del cliente (alimenta "Fechas Importantes" y los paquetes sugeridos).
- **Archivos clave:** `src/pages/SubscriptionSurveyPage.jsx`

---

## 11. Otras páginas del cliente

### 11.1 Acceso: Login / Registro / Completar perfil / Recuperar contraseña
- **Rutas:** `/login`, `/registro`, `/completar-perfil`, `/recuperar-contrasena`
- **Qué hacen:** autenticación del cliente. `completar-perfil` se usa cuando falta el DNI/teléfono (necesario para ver pedidos). El login/registro aceptan `?redirect=` para volver a donde estaba el usuario (p. ej. desde el editor).
- **Archivos clave:** `src/pages/LoginPage.jsx`, `RegisterPage.jsx`, `CompleteProfilePage.jsx`, `ResetPasswordPage.jsx`, `src/contexts/AuthContext.jsx`

### 11.2 Landing "Regalos con Amor" / Nuevos usuarios (`/regalos-con-amor`)
- **Qué es:** una landing independiente (sin header/footer normales) orientada a captar nuevos usuarios, con testimonios, comparativas y reseñas.
- **Nota:** `/nuevos-usuarios` redirige aquí. Esta ruta usa un layout especial "independiente".
- **Archivos clave:** `src/pages/NuevosUsuariosPage.jsx`

### 11.3 Experiencia de regalo (`/regalo/:orderId`)
- **Qué es:** la experiencia digital inmersiva que recibe el **destinatario** cuando se compró en "Modo Regalo".
- **Archivos clave:** `src/pages/GiftExperiencePage.jsx`

### 11.4 Landing pages dinámicas (`/:slug`)
- **Qué es:** páginas de aterrizaje creadas por el admin con su propio contenido y tema (CSS), reutilizando el motor de secciones de la Tienda.
- **Qué hace:** carga la landing por slug; si no existe, redirige a inicio (logueado) o a login. Puede ocultar header/footer.
- **Archivos clave:** `src/pages/Tienda/DynamicLandingPage.jsx`

### 11.5 Páginas legales
- **Rutas:** `/politicas-privacidad`, `/terminos-y-condiciones`, `/libro-de-reclamaciones`
- **Archivos clave:** `src/pages/PoliticasPrivacidadPage.jsx`, `TerminosCondicionesPage.jsx`, `LibroReclamacionesPage.jsx`

### 11.6 Descargar app (`/app`, `/descargar`)
- **Qué es:** redirección a la descarga de la app (web/Android vía Capacitor).
- **Archivos clave:** `src/pages/AppRedirect.jsx`

### 11.7 Otras landings de campaña
- `/mussa` (`MussaPage`), `/regalos-catas` (`RegalosCatasPage`): landings/experiencias puntuales accesibles públicamente.

---

## 12. Elementos globales presentes en toda la web (no son rutas)

Estos componentes acompañan al cliente en casi todas las páginas (definidos en `GlobalLayout` dentro de `src/App.jsx`):

- **Header** (cabecera con navegación, categorías y buscador) — `src/components/common/Header`
- **Footer** — `src/components/common/Footer`
- **BottomNav** (barra inferior en móvil) — `src/components/common/BottomNav`
- **Botón de WhatsApp** flotante — `src/components/common/WhatsAppButton`
- **Mascota Kapi** flotante — ver 8.5
- **Package Bubble** (burbuja de seguimiento de pedido) — `src/components/common/PackageBubble`
- **System Alert** (avisos del sistema) y **barra de progreso de navegación**
- **Aviso de Firebase** si la conexión falla — `src/components/common/FirebaseWarning`
- Trackers de analítica de cliente: ruta, scroll, heatmap de clics y referidos.

> En la ruta `/regalos-con-amor` y en landings que lo configuren, el layout es "independiente" (sin header/footer ni elementos flotantes), para una experiencia de aterrizaje limpia.
