# Inicio (`/`): qué componente va en cada parte

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → enciende **Ver componentes**. Cada parte
lleva el mismo número que aquí (M = marco, igual en todas las páginas;
S = sección del builder, en el orden de `pages/home`). Con **Ver como**
cambias entre visitante, con sesión y admin; con los chips aparecen los avisos
y ventanas que no siempre están.

| Escritorio | Celular |
|---|---|
| ![Inicio en escritorio con cada parte marcada](inicio-escritorio.webp) | ![Inicio en el celular con cada parte marcada](inicio-celular.webp) |

Revisado el 2026-10-13 contra wala.pe, `pages/home` y `pages/footer`.

## Marco (M): lo que rodea a las secciones

Se arma con `MarcoTienda` (`paginas/Paginas.jsx`). Es el mismo en el inicio,
el carrito y Mis pedidos.

| # | Parte | Componente | Piezas que usa | Diseño en | Datos (en la tienda) | Quién lo ve |
|---|---|---|---|---|---|---|
| M1 | Aviso del sistema (franja arriba) | `AvisoSistema` | — | `piezas/Marco.module.css` | `configuracion/estado_app` | todos, si está activo |
| M2 | Banner "Walá App" | `BannerApp` | ícono de la app en el violeta de la cabecera (`public/assets/marca/app-icono.webp`), `Boton` | `piezas/Marco.module.css` | — | celular web, no en la app |
| M3 | Barra de admin | `BarraAdmin` | `Boton`, `Enlace` | `piezas/Marco.module.css` | `isAdmin` (AuthContext) | admins. En el celular "Panel" queda como botón con escudo: es el acceso al panel (la barra inferior no lleva pestaña Admin) |
| M4 | Cabecera | `Cabecera` | `Logo`, `Desplegable`, `MenuTienda`, `MenuMarcas`, `SaldoMonedas` + `AyudaMonedas`, `ListaNotificaciones`, `VistaFavoritos`, `VistaCarrito`, `MenuCuenta`, `Buscador`, `BotonTema`, `Boton`, `Contador` | `Navegacion.module.css` (+ `MenusCabecera.module.css`) | enlaces: `storeConfig/homePage.header.navLinks`; categorías y marcas; AuthContext, CartContext, WishlistContext, NotificationsContext | todos (monedas y campana con sesión; la cuenta solo en escritorio) |
| M5 | Pie | `PiePagina` (`footer_columns`) + `PieLegal` | `LogoWala`, `EtiquetaColgante`, `Garabatos`, `Enlace` | `SeccionesExtra.module.css` (`.pie…`) y `piezas/Marco.module.css` (`.legal…`) | columnas: `pages/footer`; contacto: `config/empresa.js` | todos (no en la app) |
| M6 | Barra inferior | `BarraInferior` (siempre 5 pestañas, "Crear" al centro; en "Mi cuenta" las iniciales o la foto en un aro del mismo trazo que los íconos) | `Enlace`, `Contador` | `Navegacion.module.css` (`.barra`, `.tab…`) | ruta actual, AuthContext | celular |
| M7 | WhatsApp flotante | `BotonWhatsApp` (dentro de `PilaFlotante`) | `Enlace` | `piezas/Flotantes.module.css` | Firestore `messages` (número por zona) | todos (no admin, checkout ni landings) |
| M8 | Kapi | `KapiFlotante` | — | `piezas/Flotantes.module.css` | perfil (comida del día, tutorial) | con sesión |
| M9 | Regalos sugeridos | `BurbujaRegalos` | `IconoWala`, `Contador` | `piezas/Flotantes.module.css` | `suggested_packages` sin ver | con sesión, si hay |
| M10 | "Gana 15 monedas" | `PildoraRecompensa` | `IconoWala` (moneda), `Enlace` | `piezas/Flotantes.module.css` | perfil sin encuesta | con sesión. Sello blanco con aro dorado y "+15": no confundir con M9 (regalo violeta) |
| M11 | Anuncio de campaña | `VentanaCampana` (`formato: 'imagen'`, como la tienda: solo la imagen, que es el botón, y una X; tocar afuera cierra) o `'tarjeta'` | `EtiquetaColgante`, `Boton`, `HojaInferior` (solo en tarjeta) | `piezas/Marco.module.css` (`.anuncio…`) | `storeConfig/popups` (las reglas siguen en la tienda) | según reglas |
| M12 | Sugerencia de idioma | `AvisoIdioma` | `Boton` | `piezas/Marco.module.css` | idioma del navegador | una vez, si no es español |

## Secciones (S): las de `pages/home`, en orden

Se dibujan con `PaginaTienda` → `RenderSecciones`. Cada una va dentro de
`BloqueSeccion` (relleno y fondo iguales en todas) y casi todas empiezan con
`TituloSeccion`. Los campos son los que el editor guarda en `settings`.

| # | Parte | `type` | Componente | Piezas que usa | Diseño en | Datos | Campos del editor |
|---|---|---|---|---|---|---|---|
| S1 | Barra de anuncios | `announcement_bar` | `BarraAnuncios` | `IconoWala`, `Marquesina`, `Enlace` | `Secciones.module.css` (`.anuncios…`) | settings | messages (text, link, icon), animationType, speed, variant, bgColor, textColor |
| S2 | Carrusel principal | `hero_carousel` | `HeroCarrusel` | `Carrusel`, `Boton` | `Secciones.module.css` (`.hero…`) | settings | slides (imageUrl, mobileImageUrl, title, subtitle, buttonText, buttonLink), autoPlaySpeed, heightDesktop, heightMobile |
| S3 | "Explora nuestros mundos" | `banner_grid` (`dataSource: 'brands'`) | `MosaicoBanners` | `TituloSeccion`, `Carrusel`, `TarjetaMarca` (`EtiquetaColgante`, `LogoMarca`) | `SeccionesContenido.module.css` + `piezas/TarjetaMarca.module.css` | `tienda_brands` | title, subtitle, columns, brandCardStyle (editorial = de color · uniform = todas violeta · outline = con borde), showBrandName, autoPlay |
| S4 | "¿Qué estás buscando?" | `category_grid` (`cardStyle: 'round'`) | `GrillaCategorias` | `TituloSeccion`, `TarjetaCategoria` (cuadro: cantidad en etiqueta colgante · círculo: aro punteado) | `Secciones.module.css` (`.categorias`) + `piezas/TarjetaCategoria.module.css` | categorías con productos, orden del admin | dataSource (sin valor = a mano), sortMode (admin · más productos · alfabético), limit (solo automático), imageSource (producto · categoría), columns (se ajusta si hay menos), cardStyle (compact = cuadros · round = círculos), showProductCount |
| S5 | "Lo más buscado en Walá" | `featured_carousel` | `CarruselProductos` | `TituloSeccion`, `Carrusel`, `TarjetaProducto` | `TarjetaProducto.module.css` | productos con `featured`, por `featuredOrder` | eyebrow, title, visibleItems, autoPlay |
| S6 | "Recién llegaron" | `new_arrivals_carousel` | `CarruselProductos` | igual que S5 | `TarjetaProducto.module.css` | los más nuevos | igual que S5 |
| S7 | "Ofertas para ti" | `sale_carousel` | `CarruselProductos` | igual que S5 | `TarjetaProducto.module.css` | con `salePrice` | igual que S5 |
| S8 | Íconos de confianza | `trust_badges` | `InsigniasConfianza` | `Beneficio`, `IconoWala` | `piezas/Beneficio.module.css` | settings | badges (text, icon) |
| S9 | "Lo que dicen nuestros clientes" | `testimonials` | `Testimonios` | `TituloSeccion`, `Carrusel`, `TarjetaTestimonio` | `piezas/TarjetaTestimonio.module.css` | settings | title, testimonials (text, author, topic, rating, avatar, verified) |
| S10 | "Preguntas frecuentes" | `faq_accordion` | `PreguntasFrecuentes` | `TituloSeccion`, `Acordeon`, `TarjetaAyuda` (Kapi asomado) | `Secciones.module.css` (`.faq…`), `Acordeon.module.css`, `piezas/TarjetaAyuda.module.css` | settings; el botón "Escríbenos" usa el WhatsApp de la tienda (`contacto` por `propsPara`) | title, items (question, answer), layout, defaultOpen |

**Distancias entre secciones:** las pone el builder (espacio arriba y abajo
de cada sección, `paddingTop` / `paddingBottom`), pero nunca bajan de
`--seccion-min` (1 a 1.5rem según el ancho): si el builder guarda `0`, manda
el mínimo, y si guarda más, manda el builder. Así dos secciones nunca quedan
pegadas (los componentes viejos traían ese aire por dentro). La única que va
pegada a propósito es la barra de anuncios (S1).

Qué lista de productos va en S5, S6 y S7 lo decide `productosDeSeccion`
(`paginas/Paginas.jsx`), con la misma regla que TiendaPage.

**Título de las secciones (`TituloSeccion`):** todas las que llevan título
entienden los campos de estilo del editor: `titleAlign` (izquierda · centro ·
derecha), `titleUnderline` (trazo a mano), `titleBg` (resaltado), `titleLink`
(el título lleva a una ruta, con flecha), `eyebrow` (etiqueta colgante) y el
botón `buttonText` / `buttonLink` con sus colores si el editor los fijó.

## Para cambiar el diseño rápido: qué se repite

Cambiar una pieza cambia todas las partes que la usan. Antes de tocar, mira
esta tabla:

| Pieza | Aparece en | Archivo |
|---|---|---|
| `TarjetaProducto` | S5, S6, S7, "También te puede gustar" del carrito | `TarjetaProducto.module.css` |
| `TituloSeccion` | S3, S4, S5, S6, S7, S9, S10 | `Seccion.module.css` |
| `BloqueSeccion` (relleno y fondo) | todas las S | `Seccion.module.css` (`--seccion-min`) |
| `Carrusel` (flechas, puntos) | S2, S3, S5, S6, S7, S9 | `Carrusel.module.css` |
| `EtiquetaColgante` | descuentos y "Nuevo" de S5-S7, "Universo Walá" de S3, antetítulos, M11 | `Marca.module.css` |
| `Boton` | M2, M3, M4, M11, M12, S2, carrito, Mis pedidos | `Boton.module.css` |
| `IconoWala` | S1, S8, M9, M10 | `IconosWala.jsx` (dibujos) + `IconosWala.module.css` |
| Colores, radios, sombras | todo | `src/styles/variables.css`, `src/theme/tokens.css` |
| Letra del logo (`--fuente-marca`) | títulos, precios, marcas | `Marca.module.css` / variables |

Reglas que no hay que romper al cambiar algo (ver `README.md` del kit):
botones violeta lisos, brillo solo al interactuar, fotos de producto sobre
`#f5f4f8` con `multiply` (nunca color detrás), modo claro y noche, nada de
emojis (usar `IconoWala`), y probar en celular (390 px).

## El editor en el celular

Viendo como Admin → "Editar esta página":

1. El editor sube como **hoja inferior** (la mitad baja); la página sigue a
   la vista arriba y se puede desplazar.
2. Se toca una sección en la página (o en la lista) y la página la deja
   arriba, visible sobre la hoja; la hoja muestra su formulario con las
   pestañas Contenido · Diseño · Fondo y espacio.
3. Cada cambio se ve al instante en la página de arriba ("Cambios sin
   publicar" hasta tocar **Publicar**).
4. El botón de flechas agranda la hoja casi a pantalla completa (para
   formularios largos) y la vuelve a achicar; deslizarla no cierra nada.
5. Mientras se edita se esconden los flotantes (WhatsApp, Kapi, regalos,
   monedas) para que no tapen el panel. En el celular no aparece el botón
   "ver en celular/escritorio" (ya estás en uno).

Es el mismo `PanelEditor`: en la tienda va fijo a la pantalla; en la demo,
dentro del marco (`incrustado`). Diseño en `editor/Editor.module.css`.

## Datos del ejemplo

`demo/inicio.json` es una copia de solo lectura de `pages/home`,
`pages/footer`, 10 destacados, 10 recientes, 10 ofertas y las categorías con
productos (con su cuenta). `demo/marcas.json` son las marcas de
`tienda_brands`. Se pueden volver a copiar con la API pública de Firestore; la
demo no lee Firestore.

## Cómo rehacer las imágenes

Con el servidor de desarrollo corriendo, abre la Tienda de prueba, elige
"Con sesión", enciende "Ver componentes" y captura el lienzo completo
(escritorio 1366 px y celular 390 px).
