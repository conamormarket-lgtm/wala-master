# Guía: qué componente va en cada parte de cada página

Una ficha por página real de wala.pe. Cada ficha tiene:

- capturas con cada parte numerada (las mismas etiquetas que muestra
  **Ver componentes** en `/componentes.html` → Páginas → Tienda de prueba);
- una tabla por parte: componente del kit, piezas que usa, archivo donde se
  cambia su diseño, de dónde salen los datos en la tienda y quién la ve;
- qué piezas se repiten en varias partes (cambiar una cambia todas);
- "Llevar a la tienda (a futuro)": qué componente viejo reemplaza cada uno,
  de dónde salen los datos, qué comportamiento no se puede perder, las
  diferencias a propósito y los pasos. La migración todavía NO se hace: es
  la hoja de ruta para cuando se decida.

Lo común a todas las páginas (qué usa ya la tienda, cómo se importa y el
orden de los pasos) está en [MIGRACION.md](MIGRACION.md): es el único plan;
las fichas lo siguen.

Numeración: **M** = marco (cabecera, pie, barra inferior, flotantes: igual en
todas las páginas), **S** = secciones del builder en su orden, **P** =
contenido propio de una página que no es del builder (carrito, minijuegos,
búsqueda, encuesta), **C** = las secciones de la cuenta (C0 su marco, C1-C12 cada
página), **A** = las páginas de acceso (A1-A4).

| Página | Ficha | Estado |
|---|---|---|
| Inicio (`/`) | [INICIO.md](INICIO.md) | armada en la Tienda de prueba; con plan de migración (a futuro) |
| Tienda (`/tienda`) | [TIENDA.md](TIENDA.md) | armada en la Tienda de prueba (catálogo con filtros reales); con plan de migración (a futuro) |
| Kapi (M8, en todas las páginas) | [KAPI.md](KAPI.md) | botón y ventana (`KapiFlotante`, `VentanaKapi`, `RetoSemanal`); con plan de migración (a futuro) |
| Buscar (`/buscar` y el buscador de la cabecera) | [BUSCAR.md](BUSCAR.md) | armada (P4 `PaginaBusqueda`, panel de sugerencias en la `Cabecera`); con plan de migración (a futuro) |
| Minijuegos (`/minijuegos`) | [MINIJUEGOS.md](MINIJUEGOS.md) | armada (P3 `PaginaMinijuegos`, con los estados de cada juego); con plan de migración (a futuro) |
| Mi cuenta (`/cuenta`: resumen, perfil, pedidos, direcciones, ajustes, catálogo, cupones, misiones, referidos, creaciones, lista de deseos, fechas importantes) | [CUENTA.md](CUENTA.md) | armada (C0 `MarcoCuenta` y C1-C12); con plan de migración (a futuro). Mis pedidos (antes P2) es C3 |
| Encuesta (`/encuesta-suscripcion`) | [ENCUESTA.md](ENCUESTA.md) | armada (P6 `PaginaEncuesta`, con los estados sin sesión, ya respondida, cargando y falla); con plan de migración (a futuro) |
| Acceso (`/login`, `/registro`, `/recuperar-contrasena`, `/completar-perfil`) | [ACCESO.md](ACCESO.md) | armadas (A1-A4 con `MarcoAcceso`; los datos personales son los de Mi perfil); con plan de migración (a futuro) |
| Traducción (los textos de los datos en otro idioma) | [TRADUCCION.md](TRADUCCION.md) | `ProveedorTraduccion`, `useTexto`, `useHtml` y `<Texto>` en tarjetas, títulos, migas, ficha y carrito; falta conectarlo en `App.jsx` y decidir los textos fijos del kit |
| Cargando (primera carga, cambio de página, página llegando) | [CARGA.md](CARGA.md) | armada (M11 `PantallaCarga`, `Cargando` y los esqueletos de `Esqueletos.jsx` por componente, sección y página; en la Tienda de prueba, "Ver la carga"); con plan de migración (a futuro) |
| Un producto (`/producto/:id`) | [PRODUCTO.md](PRODUCTO.md) | armada (P13 `PaginaProducto` con el marco de `piezas/Ficha`, `OpcionesProducto` y las opiniones); rediseñada el 2026-10-16 (galería que se desliza, lo elegido que viaja, "¡Agregado!", `BarraCompra` al bajar); con plan de migración (a futuro) |
| El estudio (`/crear/:id`) | [CREAR.md](CREAR.md) | armada (P12 `PaginaEstudio` con `LienzoPrenda`, `BarraLienzo`, `PasosEstudio` y `PanelCapa`; el lienzo de fabric.js se queda en la tienda); con plan de migración (a futuro) |
| Un combo (`/combo/:id`) | [CREAR.md](CREAR.md) | armada (P11 `PaginaCombo` con `FilaPiezaCombo` y el marco de `piezas/Ficha`); con plan de migración (a futuro) |
| Una creación (`/creacion/:id`) y Ver diseño (`/ver/:id`) | [CREAR.md](CREAR.md) | armadas (P9 `PaginaCreacion` con `GaleriaProducto`, P10 `PaginaVerDiseno`); con plan de migración (a futuro) |
| Comunidad (`/comunidad`) | [CREAR.md](CREAR.md#p8--comunidad-paginascomunidadjsx) | armada (P8 `PaginaComunidad`: galería con filtro por prenda); con plan de migración (a futuro) |
| Crear (`/personalizar`) | [CREAR.md](CREAR.md) | armada (P7 `PaginaCrear`: portada con los pasos, borradores, creaciones, comunidad y ¿para cuántos? con prendas y combos); con plan de migración (a futuro) |
| Carrito (`/carrito`) | [CARRITO.md](CARRITO.md) | armada (P1 `PaginaCarrito`: qué se compra esta vez, pedido esperando el pago, productos sin talla y la regla de envío real); con plan de migración (a futuro) |
| Regalar (`/wishlist/:código`, `/regalar/:código`, `/regalo/:pedido`) y Pago rápido (`/pago-rapido/:id`) | [REGALAR.md](REGALAR.md) | armadas (P15 `PaginaListaPublica`, `PaginaRegalar`, `PaginaRegaloSorpresa`; P16 `PaginaPagoRapido`; las piezas de pago `PagoTarjeta` y `PagoPaypal`, también en el checkout); con plan de migración (a futuro) |
| Checkout (`/checkout`) | [CHECKOUT.md](CHECKOUT.md) | armada (P14 `PaginaCheckout` con `CamposDireccion`, `ResumenCompra` y `MetodoPago`); con plan de migración (a futuro) |
| Sorteos y campañas: Sorteo (`/sorteos`), Sorteo por suscripción (`/suscrito-sorteo`), Suscripciones (`/suscripciones`), Regalos con amor (`/regalos-con-amor`), Invitar (`/invitar/:código`) y Link en bio (`/l/:slug`) | [CAMPANAS.md](CAMPANAS.md) | armadas (P21 `PaginaSorteo`, `PaginaSuscripcionSorteo`, `PaginaSuscripciones`, `PaginaRegalosConAmor`, `PaginaEnlaces`; M12 `AvisoInvitacion`); Link en bio y Regalos con amor con datos reales; con plan de migración (a futuro) |
| Los juegos por dentro: Palabra del día (`/palabra-del-dia`), Ruleta Semanal (`/ruleta`) y Las Bolitas de Kapi (`/ball-sort`) | [JUEGOS.md](JUEGOS.md) | armados (P20 `PaginaPalabra`, `PaginaRuleta`, `PaginaBolitas` con `MarcoJuego`, `AyudaJuego` y `ResultadoJuego`; la palabra de hoy y la rueda son las reales); con plan de migración (a futuro) |
| Legales: Libro de reclamaciones (`/libro-de-reclamaciones`), Política de privacidad (`/politicas-privacidad`) y Términos y condiciones (`/terminos-y-condiciones`) | [LEGALES.md](LEGALES.md) | armadas (P19 `PaginaReclamaciones` con `DatosProveedor`, los 3 pasos y `CodigoCopiable`; `PaginaLegal` con `IndiceLegal` y `SeccionLegal`, textos reales); con plan de migración (a futuro) |
| Navegar la tienda: las landings de marca (`/:slug`) | [NAVEGAR.md](NAVEGAR.md) | las ofertas flash, el cofre, los nichos y los vendedores se retiraron el 2026-10-16 (la ficha dice qué y cómo volver); las 18 landings reales comprobadas con `PaginaTienda`; la página de marca sin armarla (`PaginaMarca`: el color de la marca en su portada y los trazos con `TemaMarca`, portada foto · color · collage y plantilla automática; en la demo, solo este diseño nuevo, con 3 marcas con identidad de ejemplo); con plan de migración (a futuro) |

Para una página nueva: se mapea la página real, lo que falte se crea como
pieza en `piezas/`, después la sección, y la página se arma en la Tienda de
prueba con el mismo marco. Al final se agrega su ficha aquí.
