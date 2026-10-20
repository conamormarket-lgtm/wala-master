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
las fichas lo siguen. Lo viejo que queda sin uso al migrar se anota en
[ELIMINAR.md](ELIMINAR.md) y se borra todo junto al final.

Numeración: **M** = marco (cabecera, pie, barra inferior, flotantes: igual en
todas las páginas), **S** = secciones del builder en su orden, **P** =
contenido propio de una página que no es del builder (carrito, minijuegos,
búsqueda, encuesta), **C** = las secciones de la cuenta (C0 su marco, C1-C12 cada
página), **A** = las páginas de acceso (A1-A4).

| Página | Ficha | Estado |
|---|---|---|
| Lo viejo que se borra al final | [ELIMINAR.md](ELIMINAR.md) | una fila por archivo o componente viejo: qué lo reemplazó, quién lo importa todavía y cuándo se puede borrar |
| Secciones del builder (paso 5) | [MIGRACION.md](MIGRACION.md) (paso 5), [INICIO.md](INICIO.md), [TIENDA.md](TIENDA.md) y [NAVEGAR.md](NAVEGAR.md) | hecho: el inicio, `/tienda` (catálogo con filtros) y las páginas de marca desde el 2026-10-16, las landings sin marca y los tipos restantes desde el 2026-10-17 (`SeccionDelKit` en `TiendaPage`); el cacherito (K-CHERO) se retiró el 2026-10-19; interruptor `seccionesViejo` |
| Tarjeta de producto (paso 4) | [MIGRACION.md](MIGRACION.md) (paso 4) e [INICIO.md](INICIO.md) | en la tienda desde el 2026-10-16 en carruseles y grillas (`TarjetaDeProducto`); interruptor `tarjetasViejo` |
| Avisos, hojas y confirmaciones (paso 3) | [MIGRACION.md](MIGRACION.md) (paso 3 e interruptores) | en la tienda desde el 2026-10-16: `HojaInferior` (`bloqueada`, `tamano`, foco), `Confirmar` + `useConfirmar` en vez de `confirm()`, toasts en vez de `alert()`; fichas en la demo de Piezas |
| Inicio (`/`) | [INICIO.md](INICIO.md) | armada en la Tienda de prueba; con plan de migración (a futuro). **El marco (M1-M3, M7-M12 y el pie legal) ya está en la tienda** desde el 2026-10-16 (paso 2); la barra inferior (M6) y la cabecera (M4) desde el 2026-10-19 (interruptores `barraVieja` y `cabeceraVieja`): **el marco entero**, con el pie desde el 2026-10-20 (`PieDeTienda`, interruptor `pieViejo`); el editor del builder también (`editorViejo`) |
| Tienda (`/tienda`) | [TIENDA.md](TIENDA.md) | armada en la Tienda de prueba (catálogo con filtros reales); con plan de migración (a futuro) |
| Kapi (M8, en todas las páginas) | [KAPI.md](KAPI.md) | botón y ventana (`KapiFlotante`, `VentanaKapi`, `RetoSemanal`); **en la tienda** desde el 2026-10-16 |
| Buscar (`/buscar` y el buscador de la cabecera) | [BUSCAR.md](BUSCAR.md) | armada (P4 `PaginaBusqueda`, panel de sugerencias en la `Cabecera`); **el panel en la tienda desde el 2026-10-19 con la cabecera y la página `/buscar` también** (`BusquedaDeTienda`, interruptor `busquedaVieja`), con los filtros de lo encontrado y sin bajar el catálogo de la marca |
| Minijuegos (`/minijuegos`) | [MINIJUEGOS.md](MINIJUEGOS.md) | armada (P3 `PaginaMinijuegos`, con los estados de cada juego); **en la tienda desde el 2026-10-19** (`MinijuegosDeTienda`, interruptor `minijuegosViejo`), con las ilustraciones más livianas |
| Mi cuenta (`/cuenta`: resumen, perfil, pedidos, direcciones, ajustes, catálogo, cupones, misiones, referidos, creaciones, lista de deseos, fechas importantes) | [CUENTA.md](CUENTA.md) | armada (C0 `MarcoCuenta` y C1-C12); **en la tienda desde el 2026-10-17: el marco, el resumen, los ajustes, Mi perfil, Mis direcciones, el catálogo, Mis cupones, Misiones, Mis referidos, la lista de deseos, Fechas importantes, Mis creaciones y Mis pedidos con el detalle y sus pagos**; la carga (esqueletos entre páginas, la pantalla de marca y el splash) desde el 2026-10-19 ([CARGA.md](CARGA.md)) (`components/cuenta/`, interruptor `cuentaVieja`); las demás secciones, con plan de migración. Mis pedidos (antes P2) es C3 |
| Encuesta (`/encuesta-suscripcion`) | [ENCUESTA.md](ENCUESTA.md) | armada (P6 `PaginaEncuesta`, con los estados sin sesión, ya respondida, cargando y falla); **en la tienda desde el 2026-10-19** (`EncuestaDeTienda`, interruptor `encuestaVieja`), con el catálogo de regalos al empezar |
| Acceso (`/login`, `/registro`, `/recuperar-contrasena`, `/completar-perfil`) | [ACCESO.md](ACCESO.md) | armadas (A1-A4 con `MarcoAcceso`; los datos personales son los de Mi perfil); **en la tienda desde el 2026-10-19 las cuatro** (`components/acceso/`, interruptor `accesoViejo`) |
| Traducción (los textos de los datos en otro idioma) | [TRADUCCION.md](TRADUCCION.md) | `ProveedorTraduccion`, `useTexto`, `useHtml` y `<Texto>` en tarjetas, títulos, migas, ficha y carrito; **conectado en `App.jsx`** (2026-10-16); los textos fijos van por `useTexto`, empezando por el marco |
| Cargando (primera carga, cambio de página, página llegando) | [CARGA.md](CARGA.md) | armada (M11 `PantallaCarga`, `Cargando` y los esqueletos de `Esqueletos.jsx` por componente, sección y página; en la Tienda de prueba, "Ver la carga"); con plan de migración (a futuro) |
| Un producto (`/producto/:id`) | [PRODUCTO.md](PRODUCTO.md) | armada (P13 `PaginaProducto` con el marco de `piezas/Ficha`, `OpcionesProducto` y las opiniones); rediseñada el 2026-10-16 (galería que se desliza, lo elegido que viaja, "¡Agregado!", `BarraCompra` al bajar); **en la tienda desde el 2026-10-17** (`FichaDeProducto`, interruptor `fichaVieja`), con "Agregar rápido" en las tarjetas, lo de abajo al acercarse y las fotos en su tamaño |
| El estudio (`/crear/:id`) | [CREAR.md](CREAR.md) | **en la tienda desde el 2026-10-19** (`EstudioDeTienda`, con Fabric); comparte `MarcoEstudio`, compra, hojas y controles con la demo; respaldo `crearViejo` |
| Un combo (`/combo/:id`) | [CREAR.md](CREAR.md) | armada (P11 `PaginaCombo` con `FilaPiezaCombo` y el marco de `piezas/Ficha`); **en la tienda desde el 2026-10-19** (`components/crear/ComboDeTienda.jsx` con `useComboCrear`, interruptor `crearViejo`) |
| Una creación (`/creacion/:id`) y Ver diseño (`/ver/:id`) | [CREAR.md](CREAR.md) | armadas (P9 `PaginaCreacion` con `GaleriaProducto`, P10 `PaginaVerDiseno`); **en la tienda desde el 2026-10-19** (`CreacionDeTienda`, `VerDisenoDeTienda`, interruptor `crearViejo`) |
| Comunidad (`/comunidad`) | [CREAR.md](CREAR.md#p8--comunidad-paginascomunidadjsx) | armada (P8 `PaginaComunidad`: galería con filtro por prenda); **en la tienda desde el 2026-10-19** (`ComunidadDeTienda`, interruptor `crearViejo`) |
| Crear (`/personalizar`) | [CREAR.md](CREAR.md) | armada (P7 `PaginaCrear`: portada con los pasos, borradores, creaciones, comunidad y ¿para cuántos? con prendas y combos); **en la tienda desde el 2026-10-19** (`CrearDeTienda`, las tarjetas de Mis creaciones con `useTarjetasCreaciones`, interruptor `crearViejo`) |
| Carrito (`/carrito`) | [CARRITO.md](CARRITO.md) | armada (P1 `PaginaCarrito`: qué se compra esta vez, pedido esperando el pago, productos sin talla y la regla de envío real); **en la tienda desde el 2026-10-17** (`CarritoDeTienda`, interruptor `carritoViejo`), con el catálogo leído una vez y los recomendados al acercarse |
| Regalar (`/wishlist/:código`, `/regalar/:código`, `/regalo/:pedido`) y Pago rápido (`/pago-rapido/:id`) | [REGALAR.md](REGALAR.md) | armadas (P15 `PaginaListaPublica`, `PaginaRegalar`, `PaginaRegaloSorpresa`; P16 `PaginaPagoRapido`; las piezas de pago `PagoTarjeta` y `PagoPaypal`, también en el checkout); **el pago rápido en la tienda desde el 2026-10-17** (`PagoRapidoDeTienda`, interruptor `pagosViejo`); **la lista pública, regalar para una fecha y abrir el regalo también** (`ListaPublicaDeTienda`, `RegalarDeTienda`, `RegaloSorpresaDeTienda`, interruptor `regalarViejo`); lo demás, con plan de migración (a futuro) |
| Checkout (`/checkout`) | [CHECKOUT.md](CHECKOUT.md) | armada (P14 `PaginaCheckout` con `CamposDireccion`, `ResumenCompra` y `MetodoPago`); **en la tienda desde el 2026-10-17** (`CheckoutDeTienda`, el pedido en `services/pedidoCheckout.js`, interruptor `pagosViejo`) |
| Sorteos y campañas: Sorteo (`/sorteos`), Sorteo por suscripción (`/suscrito-sorteo`), Suscripciones (`/suscripciones`), Invitar (`/invitar/:código`, con su página) y Link en bio (`/l/:slug`) | [CAMPANAS.md](CAMPANAS.md) | armadas (P21 `PaginaSorteo`, `PaginaSuscripcionSorteo`, `PaginaSuscripciones`, `PaginaEnlaces`; M12 `AvisoInvitacion`); el premio del sorteo como boleto y "+1" en cada forma de ganar (2026-10-16); Link en bio con datos reales, sola y con "Compartir"; cómo funcionan el Link en bio y la invitación, y cómo deben funcionar; Regalos con amor salió del kit el 2026-10-16 (sigue en la tienda); **en la tienda desde el 2026-10-19** la invitación, el Link en bio, Suscripciones y el sorteo (`components/campanas/`, interruptor `campanasViejo`); el sorteo por suscripción sigue con la página de antes |
| Los juegos por dentro: Palabra del día (`/palabra-del-dia`), Ruleta Semanal (`/ruleta`) y Las Bolitas de Kapi (`/ball-sort`) | [JUEGOS.md](JUEGOS.md) | armados (P20 `PaginaPalabra`, `PaginaRuleta`, `PaginaBolitas` con `MarcoJuego`, `AyudaJuego` y `ResultadoJuego`; la palabra de hoy y la rueda son las reales); **en la tienda desde el 2026-10-19** (`components/minijuegos/`, interruptor `juegosViejo`), las bolitas sin cuenta |
| Legales: Libro de reclamaciones (`/libro-de-reclamaciones`), Política de privacidad (`/politicas-privacidad`) y Términos y condiciones (`/terminos-y-condiciones`) | [LEGALES.md](LEGALES.md) | armadas (P19 `PaginaReclamaciones` con `DatosProveedor`, los 3 pasos y `CodigoCopiable`; `PaginaLegal` con `IndiceLegal` y `SeccionLegal`, textos reales); **en la tienda desde el 2026-10-19** (`components/legales/`, interruptor `legalesViejo`), con país en el libro y los textos en `config/legales/` |
| Generales: no encontrada y descargar la app (`/descargar`, `/app`) | [GENERALES.md](GENERALES.md) | armadas (P22 `PaginaNoEncontrada`, P23 `PaginaDescargarApp`); propuestas: hoy la tienda manda al inicio sin avisar y salta a la Play Store desde cualquier aparato; con plan de migración (a futuro) |
| Navegar la tienda: las landings de marca (`/:slug`) | [NAVEGAR.md](NAVEGAR.md) | las ofertas flash, el cofre, los nichos y los vendedores se retiraron el 2026-10-16 (la ficha dice qué y cómo volver); las 18 landings reales comprobadas con `PaginaTienda`; la página de marca sin armarla (`PaginaMarca`: el color de la marca en su portada y los trazos con `TemaMarca`, portada foto · color · collage y plantilla automática; en la demo, solo este diseño nuevo, con 3 marcas con identidad de ejemplo); con plan de migración (a futuro) |

Para una página nueva: se mapea la página real, lo que falte se crea como
pieza en `piezas/`, después la sección, y la página se arma en la Tienda de
prueba con el mismo marco. Al final se agrega su ficha aquí.
