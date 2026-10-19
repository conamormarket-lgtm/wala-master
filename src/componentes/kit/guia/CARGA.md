# Cargando: la primera vez, al cambiar de página y mientras llega una página

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **Ver la carga**:

- **Primera vez (marca):** la pantalla de marca sobre la tienda. Se va sola
  a los 4 segundos, con su salida.
- **Cambio de página (esqueleto de esta página):** la cabecera queda y
  abajo, la forma de la página que llega. Cada apartado tiene la suya:
  - el inicio, sección por sección (las del builder);
  - la tienda, la búsqueda, el carrito, Minijuegos, la encuesta y el acceso;
  - cada módulo de Mi cuenta (resumen, perfil, pedidos, direcciones,
    ajustes, catálogo, cupones, misiones, referidos, creaciones, deseos y
    fechas importantes), con el menú al costado en ancho.
- **Esperando una acción (pago, landing…):** la página se queda a la vista
  detrás de un velo claro y encima una tarjeta con la etiqueta meciéndose:
  "Procesando tu pago".

**Con y sin sesión:** el esqueleto sigue a quien mira (`sesion`). Sin
sesión, Mi cuenta y la encuesta muestran la forma de la invitación a entrar
(Kapi, título y dos botones), y Minijuegos, el aviso para entrar en vez del
progreso. La cabecera es la de siempre (sin monedas ni campana).

**Regla:** para cambiar de página, siempre el esqueleto (ya se sabe la
forma de lo que viene). `CapaCargando` es solo para esperar algo que no
tiene forma conocida: un pago, verificar un documento, subir un diseño, o
una landing del builder antes de que llegue su configuración.

Las dos últimas vuelven solas a la página a los 4 s. Todos los esqueletos
sueltos (por componente, por sección y por página) están en **Piezas** →
**11 · Carga y esqueletos**.

| Primera vez (escritorio) | Esperando una acción (celular) | Cambio de página: el inicio (escritorio) |
|---|---|---|
| ![Pantalla de marca: la etiqueta meciéndose, WALÁ, la barra y una frase](carga-marca.webp) | ![Esperando una acción: la página detrás de un velo y "Procesando tu pago"](carga-pagina.webp) | ![El inicio cargando: banner, mosaico, categorías y filas de productos](carga-esqueleto.webp) |

| Tienda llegando (escritorio) | Carrito llegando (celular) |
|---|---|
| ![Catálogo: filtros al costado, chips y grilla](carga-esqueleto-tienda.webp) | ![Carrito: líneas y resumen](carga-esqueleto-carrito.webp) |

Revisado el 2026-10-14 contra wala.pe y el código de la tienda:

- el splash estático de `index.html` (~92-101);
- `components/common/BrandLoader/BrandLoader.jsx` y `BrandLoaderOverlay.jsx`;
- `Loading/Loading.jsx` (el círculo);
- `PageLoading/PageLoading.jsx`.

Es parte del marco: **M11**.

## Cómo se arma

Todo vive en `kit/Cargando.jsx`. La idea es una sola: **la etiqueta del logo
se mece colgada de su cordón**, como una etiqueta de verdad. Gira alrededor
del cordón, arriba a la derecha (`transform-origin: 75% 4%`), ±6° en 2,4 s.

- **No usa halos ni brillos:** el fondo es el degradado plano del logo.
- **Es lo único que se mueve en bucle en el kit**, porque es lo que dice
  "algo está pasando".
- **Va en CSS** (solo `transform` y `opacity`): sigue fluida mientras React
  monta la tienda (el motivo por el que `BrandLoader` dejó framer-motion).
- **Con `prefers-reduced-motion`,** la etiqueta queda quieta y la barra
  queda fija.

| Parte | Componente | Qué es | Archivo del diseño |
|---|---|---|---|
| M11 | `PantallaCarga` | La primera carga, con varias piezas. Ver la lista de abajo. | `kit/Cargando.module.css` |
| M11 | `CapaCargando` | Esperar una acción: velo claro sobre la página y una tarjeta con `Cargando` (`texto`, `detalle`; `pantallaCompleta` fija al viewport). Mientras está, **la página no se mueve** (`useBloquearScroll` y la rueda o el dedo sobre el velo no desplazan un marco con scroll propio) y la tarjeta se queda en el medio de lo que se ve aunque la página sea larga (2026-10-16). | `kit/Cargando.module.css` |
| M11 | `Cargando` | La etiqueta del logo actual (la imagen del splash como máscara, con el degradado; la W calada deja ver el fondo, como el logo de la cabecera) meciéndose y "Cargando…", con los puntos que aparecen uno tras otro. Es la pieza de `CapaCargando` y sirve suelta en zonas chicas (un menú, un panel). Tiene `tamano` (sm, md, lg) y `bloque`. | `kit/Cargando.module.css` |
| M11 | `EsqueletoPagina` | Mientras llega una página (Suspense): su forma. Ver «Esqueletos» abajo. | `kit/Esqueletos.module.css` |

Qué lleva `PantallaCarga`:

- el degradado del logo;
- la etiqueta blanca meciéndose;
- WALÁ;
- una barra que va y viene;
- frases que cambian cada 2,4 s (`FRASES_CARGA`).

Cómo se comporta:

- **Sin entrada animada,** para relevar sin costura al splash estático.
- **Al terminar** se funde y se abre un poco hacia la tienda.
- **Con `pantallaCompleta`** va fija al viewport.
- **`relevo`** la hace salir en seco, porque hay otra igual detrás.

## Esqueletos (`kit/Esqueletos.jsx`)

Se arman en cadena, como el resto del kit, y todos comparten el mismo
brillo: un barrido suave en violeta muy claro (con poco movimiento,
quieto). Las piezas sueltas van `aria-hidden`; `EsqueletoSeccion` y
`EsqueletoPagina` avisan "Cargando" a los lectores de pantalla.

| Nivel | Componente | Para qué |
|---|---|---|
| Pieza | `Hueso` | `forma` linea, bloque, circulo o pildora; `ancho`, `alto`, `proporcion`; `claro` sobre otro hueso |
| Componente | `EsqueletoTexto`, `EsqueletoCabeza` | párrafos y títulos |
| Componente | `EsqueletoProducto` | la silueta de `TarjetaProducto` (es su `TarjetaProductoEsqueleto`) |
| Componente | `EsqueletoFila` | listas: misiones, ranking de referidos |
| Componente | `EsqueletoPedido` | Mis pedidos y el detalle de una compra |
| Componente | `EsqueletoTarjeta` | direcciones, cupones, personas |
| Componente | `EsqueletoFormulario` | completar perfil, encuesta |
| Sección | `EsqueletoSeccion tipo` | una forma por tipo del builder (`FORMA_DE_SECCION`): banner, fila, grilla, catalogo, categorias, beneficios, testimonios, preguntas, marcas, mosaico, texto, medio, ubicacion, anuncio |
| Página | `EsqueletoPagina` | `secciones` (los tipos del builder, en orden) o `forma`: productos, inicio, tienda, busqueda, producto, carrito, minijuegos, encuesta, acceso, cuenta (con `modulo`: resumen, perfil, pedidos, direcciones, ajustes, catalogo, cupones, misiones, referidos, creaciones, deseos, fechas), lista, formulario, legal, reclamaciones (LEGALES.md; con lo que sigue y cuánto falta, medida real 2317 px en escritorio y 2885 a 390), verDiseno (Ver diseño: la cabeza con "Copiar resumen" y las prendas con sus lados; con `tarjetas` = cuántas prendas, si no dos; una sola o la última de un número impar, a lo ancho; medida real 503 px en escritorio con dos, cada prenda ~700 px en el celular; CREAR.md P10), palabra, ruleta, bolitas (JUEGOS.md), sorteo, suscripcionSorteo, landing, invitacion, enlaces (CAMPANAS.md), aviso (no encontrada y descargar la app: GENERALES.md). La página de marca usa `secciones={ESQUELETO_MARCA}`: portada, burbujas, una fila y el catálogo (NAVEGAR.md) |

**Del tamaño de la página real.** Cada forma de página está medida contra
la página del kit a 1366px y a 390px:

- **Contenedor:** 1280px, como `BloqueSeccion`.
- **Tarjeta de producto:** 418px de alto.
- **Filtros del catálogo:** 264px.
- **Mi cuenta:** el menú mide 264×725px y el contenido 918px; la cabeza de
  cada módulo mide 57px, y Mi perfil no tiene cabeza.
- **Carrito:** la lista y un resumen de 370×425px.
- **Zona Arcade:** dos columnas hasta 1080px.
- **Encuesta:** abre en su portada.

Cada bloque cae a pocos píxeles de donde aparece el real, así que al llegar
los datos nada salta. Si una página real cambia, se ajusta su forma en
`Esqueletos.jsx` (la comparación lado a lado está en «Ver la carga» de la
Tienda de prueba).

Las páginas del kit ya los usan: los bloques grises que latían en la
cuenta, la encuesta y el acceso son ahora esqueletos con la forma de lo que
viene (pedidos, productos, tarjetas, filas y formularios).

La **fase compartida** viene de la idea de `BrandLoader`. Dos cargas
seguidas (la landing y la tienda) toman el vaivén desde el reloj de la
página, así que el relevo no se nota.

## En la tienda (paso 7 de MIGRACION.md, desde el 2026-10-19)

- **Entre páginas** (el fallback de `Suspense` en `App.jsx`) y mientras
  `RutaPrivada` espera la sesión: `components/carga/CargandoRuta.jsx`
  dibuja `EsqueletoPagina` con la forma de la ruta
  (`components/carga/formaDeRuta.js`: `/` el inicio, `/carrito` el carrito,
  `/cuenta/…` la cuenta con su módulo, `/:slug` una landing…; el admin no
  es del kit y sigue con `PageLoading`). Con la sesión aún cargando se
  asume que la hay (si no, quien sí entró veía un instante la invitación a
  entrar). Antes, una grilla de 8 productos para todo.
- Con `v7_startTransition` del router, al navegar dentro de la tienda la
  página de antes se queda hasta que llega la nueva: el esqueleto se ve al
  abrir un enlace o recargar (y mientras llega la sesión).
- **Después de la marca, bajo la cabecera** (`BrandLoaderOverlay`, en el
  inicio, `/tienda` y las landings del builder, también la del cacherito):
  `EsqueletoPagina` de la ruta en vez del círculo; en el inicio y las
  landings, con los tipos de sus secciones (`secciones`, las 8 primeras)
  cuando ya llegaron. Va arriba como la página, no al centro. Lo demás del
  overlay no cambia (una sola vez la marca, bajo la cabecera, el tope de 15
  s, el scroll quieto, el relevo).
- **Esperar una acción a pantalla completa** (iniciar sesión, crear la
  cuenta, mandar el enlace de la contraseña):
  `components/carga/EsperaPantalla.jsx` → `CapaCargando pantallaCompleta`
  en `<body>` (antes, `Loading fullScreen portal`), con el texto sin los
  puntos (los pone `Cargando`, animados) y traducido.
- **La primera vez (marca):** `BrandLoaderOverlay` dibuja `PantallaCarga`
  (sin frases, como el splash) y el splash estático de `index.html` es el
  mismo: degradado plano, sin halos, la etiqueta de 88 px colgada que se mece
  (`vaiven`, 2,4 s, ±6°, origen 75% 4%), WALÁ de 122 px y la barra blanca de
  132 × 4 que va y viene. Medido el 2026-10-19 a 390 px: WALÁ en (127, 439)
  y la barra en (122, 510) en los dos; el relevo no salta. La salida la sigue
  haciendo el `motion.div` del overlay (se funde y se abre un poco).
- **Las cargas siguientes** (la marca ya se vio): el splash estático pinta el
  fondo de la página según el tema (`data-theme`, ya puesto en el `<head>`)
  con la etiqueta chica a color que se mece (como `Cargando`), y React
  pinta enseguida la cabecera y el esqueleto. Antes, un círculo gris.
- **Interruptor `cargaVieja`** (`useLoViejo('carga')`): vuelve
  `PageLoading`, el círculo bajo la cabecera, el círculo a pantalla completa
  y `BrandLoader`. El splash de `index.html` no lo sigue (es estático): se
  queda el nuevo.

## Llevar a la tienda (el plan; los pasos hechos llevan ✓)

Va con el marco, en el paso 7 de [MIGRACION.md](MIGRACION.md) (junto a la
cabecera), o antes y suelto, porque no depende de datos.

### Reemplazos

| Hoy en la tienda | Pasa a (kit) |
|---|---|
| `BrandLoader` (dentro de `BrandLoaderOverlay`, cuando `useBrand`) | `PantallaCarga` (`pantallaCompleta`, `frases` opcional, `relevo` igual que hoy) |
| `Loading` (el círculo) en `BrandLoaderOverlay` cuando ya se vio la marca (cambio de página) | `EsqueletoPagina` con la forma de la ruta |
| `Loading fullScreen` en el login y el registro, y las esperas de pagos o subidas | El botón con `cargando`; si hay que bloquear la página, `CapaCargando pantallaCompleta` |
| `PageLoading` (fallback de `Suspense` en `App.jsx`) | `EsqueletoPagina` con la `forma` de la ruta. En el inicio y `/tienda`, `secciones` con los tipos del layout del builder (se conocen antes que los productos). |
| `ProductCardSkeleton` y los "Cargando..." sueltos de cada página | `EsqueletoProducto` y el esqueleto del componente que corresponda |
| El splash estático de `index.html` | El mismo lockup que `PantallaCarga`. Ver la lista de abajo. |

Qué cambia en el splash estático de `index.html`:

- quitar los dos halos (`#app-loading-halo*`);
- quitar el brillo de la barra (el `box-shadow` y el degradado);
- cambiar `appLoadingBreathe` por el mismo `vaiven` (2,4 s, ±6°, origen
  75% 4%).

Sin esos cambios, el relevo a React se notaría.

Ya en la tienda (paso 5, 2026-10-16): dentro de las secciones del kit, el
catálogo y la grilla esperan con `TarjetaProductoEsqueleto` (8 al empezar, 4
al pedir más o mientras un filtro busca en las páginas siguientes) y las
burbujas de una marca con `TarjetaCategoriaEsqueleto` (5).

Ya en la tienda (paso 6, la ficha de producto, 2026-10-17):

- `/producto/:id` sin el producto en caché: `EsqueletoPagina forma="producto"`
  (lo dibuja `PaginaProducto` con `estado="cargando"`).
- Las opiniones, hasta que se piden y llegan (se piden al acercarse): dos
  tarjetas con un `Hueso` de 35% × 13px y `EsqueletoTexto` de 2 líneas.
- Los colores de cada prenda de un combo mientras llegan las prendas (en la
  ficha y en "Agregar rápido"): por prenda, un `Hueso` de 40-45% × 12px y
  cinco círculos de 34px (las muestras de `SelectorColor`).
- Los relacionados no tienen esqueleto: aparecen debajo de las opiniones
  cuando llegan, fuera de la vista.

Ya en la tienda (paso 6, el checkout, 2026-10-17): `EsqueletoPagina
forma="checkout"` mientras llegan la sesión, el perfil y la libreta (la página
se monta de nuevo al terminar: su estado inicial sale de ellos).

Ya en la tienda (paso 6, el pago rápido, 2026-10-17): mientras llega el
enlace (y la sesión), `EsqueletoPagina forma="formulario"`.

Ya en la tienda (paso 6, la lista pública, 2026-10-17): mientras llegan la
lista y el nombre del dueño, `EsqueletoPagina forma="productos"`. Después
no hay esqueleto por tarjeta: cada una se ve con lo que guardó la lista
(nombre, foto, precio) y su "Regalar esto" lleva el spinner del `Boton`
(`cargando`) hasta que llega su producto.

Ya en la tienda (paso 6, regalar para una fecha, 2026-10-17): mientras llega
el registro, `EsqueletoPagina forma="productos"` (si se llega desde la lista
pública ya está en caché y no se ve); las tarjetas, como en la lista pública.

Ya en la tienda (paso 6, abrir el regalo, 2026-10-17): mientras llega el
regalo, `EsqueletoPagina forma="formulario"` (antes, "Preparando tu
sorpresa...").

Ya en la tienda (paso 6, el marco de la cuenta, 2026-10-17): mientras carga
la sesión, `EsqueletoPagina forma="cuenta"` con el módulo de la sección
(`moduloDeRuta`: /cuenta → resumen, /cuenta/wishlist → deseos…). Antes era
una caja del menú y otra del contenido.

Ya en la tienda (paso 6, Mi perfil y Mis direcciones, 2026-10-17): Mi perfil
con el perfil sin llegar, dos `EsqueletoTarjeta` (150 y 260 px de alto, 2 y
4 líneas) en la rejilla del perfil (antes no se dibujaba nada); Mis
direcciones, las dos `EsqueletoTarjeta` de 190 px que ya tenía (antes,
"Cargando tus direcciones…").

Ya en la tienda (paso 6, Catálogo, Cupones y Misiones, 2026-10-17): los
esqueletos que ya tenían las páginas del kit: tres `EsqueletoProducto` en el
catálogo, dos `EsqueletoTarjeta` de 150 px en cupones y tres `EsqueletoFila`
en las misiones (antes, textos "Cargando…").

Ya en la tienda (paso 6, Mis referidos, 2026-10-19): mientras llegan los
referidos, dos `EsqueletoTarjeta` de 180 px (como antes, dos cajas); el
ranking no se pide ni se dibuja hasta acercarse, y entonces tres
`EsqueletoFila` con foto en círculo mientras llega. "Ver pedido" y el
botón de reclamar dicen "Cargando el pedido…" y "Revisando pedido…".

Ya en la tienda (paso 6, Lista de deseos, 2026-10-19): mientras llega la
lista, cuatro `EsqueletoProducto` (antes, "Cargando tu lista de
deseos..."); con la lista ya, cada producto que todavía no llega es su
propio `EsqueletoProducto` en su lugar (antes se esperaba el catálogo
entero). La lista sale de la caché local de WishlistContext, así que al
volver aparece al instante.

Ya en la tienda (paso 6, Fechas importantes, 2026-10-19): sin perfil, dos
`EsqueletoTarjeta` de 360 px; con las personas ya, cada tarjeta dice
"Buscando ideas…" (y cada festiva por persona) mientras se arma el
buscador de regalos, y los paquetes aparecen cuando llega el catálogo
(antes no se pintaba nada hasta entonces). Agregar rápido baja su código la
primera vez que se toca "Elegir".

Ya en la tienda (paso 6, Mis creaciones, 2026-10-19): la primera vez, seis
`EsqueletoCreacion` (la tarjeta acostada, como `EsqueletoPagina` con
`modulo="creaciones"`; antes, seis esqueletos de la tarjeta vieja); al
volver, las creaciones de la caché al instante mientras se piden de nuevo.
Un diseño del editor de antes deja su foto vacía mientras llega su
producto; precios y combos aparecen al llegar (las tarjetas no saltan).

Ya en la tienda (paso 7, Mis pedidos, 2026-10-19): la primera vez, las
pestañas y cuatro `EsqueletoPedido` (la misma forma que `EsqueletoPagina`
con `modulo="pedidos"`; antes, tres cajas grises); al volver, la copia en
memoria de `usePedidos` al instante mientras se pide de nuevo. Las fotos de
las líneas sin foto propia llegan después (la tarjeta no salta).

Ya en la tienda (paso 7, el detalle de una compra, 2026-10-19): con la lista
ya en memoria el pedido sale al instante; si no, `EsqueletoPedido` y una
tarjeta de 240 px en la columna principal y dos tarjetas al costado (la forma
de la página; antes, dos cajas grises). Los recomendados se piden al
acercarse; los datos de pago, al abrir "Pagar el saldo" ("Cargando los
datos de pago…").

Ya en la tienda (paso 6, el carrito, 2026-10-17): el carrito sale de
localStorage al instante, así que no tiene esqueleto propio (la ruta sigue con
el `PageLoading` de `App.jsx` hasta el paso 7). "También te puede gustar" no
tiene esqueleto: llega al acercarse, debajo del resumen.

### Qué se queda en la tienda (no es del kit)

`BrandLoaderOverlay` sigue siendo el que decide. El kit solo dibuja, y la
lógica es de la tienda:

- **Marca solo una vez.** El splash de marca se ve una sola vez por
  navegador (`wala_brand_seen`) y después va el `Cargando`.
- **No tapa la cabecera.** El círculo se ancla bajo la cabecera.
- **Tiene un tope de 15 segundos.**
- **Bloquea el scroll hasta que termina la salida.**
- **Deja de bloquear clics al ocultarse** (`pointer-events: none`).
- **Marca o relevo.** Ahí solo cambia `<BrandLoader />` por `<PantallaCarga />`.
- **El momento de la salida.** En la tienda la sigue animando el
  `motion.div` de `BrandLoaderOverlay` (como con `BrandLoader`): `PantallaCarga`
  solo dibuja. Si algún día la anima el kit (`saliendo` y `onSalio`),
  `AnimatePresence` tiene que esperar a `onSalio`.

### Diferencias a propósito

- Vaivén colgado del cordón en vez de "respirar", y sin halos.
- La etiqueta del logo en vez del círculo que gira (en la tienda).
- Frases de Walá mientras se espera (opcionales).
- El esqueleto tiene la forma de la página y de cada sección, no siempre una grilla de productos.

### Pasos

1. ✓ `PageLoading` → `EsqueletoPagina` (lo más simple: sin estado; la forma sale de la ruta). Hecho el 2026-10-19 (arriba, "En la tienda").
2. ✓ El círculo de `BrandLoaderOverlay` → `EsqueletoPagina` de la ruta (y `CapaCargando` donde hoy hay esperas de una acción). Hecho el 2026-10-19.
3. ✓ `BrandLoader` → `PantallaCarga`, **en el mismo commit** que el splash de
   `index.html`. Probar la primera carga con la caché vacía y la red
   lenta: el relevo no debe saltar. Hecho el 2026-10-19 (medido: las mismas
   posiciones en el splash y en `PantallaCarga`).
