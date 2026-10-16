# Crear (`/personalizar`): qué componente va en cada parte

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → página **Crear** (también el enlace
"Crear" de la cabecera y el botón central de la barra inferior).

- **Ver como:**
  - "Visitante": solo la portada, la comunidad y las prendas.
  - "Con sesión": suma tus borradores y tus creaciones.
  - "Admin": suma las prendas en borrador.
- **Estado de Crear:** Cargando prendas, Sin prendas y Sin combos.
- **¿Para cuántos?:** cambia entre prendas sueltas y combos.

| Escritorio (con sesión) | Celular | ¿Para cuántos? En pareja |
|---|---|---|
| ![Crear en escritorio](crear-escritorio.webp) | ![Crear en el celular](crear-celular.webp) | ![Los combos de pareja con su ahorro](crear-combos.webp) |

**Datos de la demo:** son los reales de Walá, en `src/componentes/demo/crear.json`, y pasan por los mismos adaptadores que usaría la tienda.

- **Qué se leyó (2026-10-15):** las prendas base y los combos de
  `productos_wala`, y los diseños de la comunidad (`listarComunidad`).
- **Con sesión:** esos diseños personalizados hacen de borradores y
  creaciones del cliente, también en Mis creaciones.

Revisado el 2026-10-15 contra wala.pe/personalizar (admin) y:

- `src/pages/PersonalizarPage.jsx` y `pages/Crear/TusBorradores.jsx`;
- `pages/Comunidad/TarjetaComunidad.jsx`;
- `pages/cuenta/components/MiCreacionCard.jsx` y `pages/Crear/TarjetaMiCombo.jsx`.

No es del builder: contenido propio, numerado **P7**.

## Cómo se arma

**P7 · `PaginaCrear`** (`paginas/Crear.jsx`) va dentro de `MarcoTienda`. Lleva
`kapiEnPie={false}` y no muestra el Kapi flotante, porque Kapi ya está en el
arte de la portada.

Sus partes, en orden:

1. **`PortadaCrear`**:
   - el arte de Kapi diseñando, ancho en escritorio y vertical en el
     celular;
   - en el lado libre, el título con la letra del logo y su `Trazo`;
   - los tres pasos en **sellos numerados unidos por una costura punteada**,
     como una prenda; el sello se gira al pasar.
2. **Tus borradores, Tus creaciones y Diseños de la comunidad**: cada una es
   una fila con `TituloSeccion`, "Ver todas (13)" y el `Carrusel` del kit
   (4 tarjetas en escritorio, 1,35 en el celular).
   - Las tres usan `TarjetaCreacion` con `vertical`: no se acuesta, como una
     tarjeta de producto.
   - Los borradores llevan `borrador`, con un solo botón, "Continuar".
   - La comunidad lleva `usar`: dice "Por Walá" y cuántos lo usaron, y su
     botón es "Usar diseño".
3. **Empieza una nueva**:
   - el título subrayado y "¿Para cuántos?" con **`Chip`** ("Para ti", "En
     pareja", "Conjunto");
   - la grilla con **`TarjetaProducto`**, la misma de la tienda, ya sin
     tarjetas propias de Crear:
     - **una prenda** usa `accion="crear"`: "Tu diseño", el botón con la
       paleta que lleva al estudio, la espalda al pasar (`imagenHover`), sus
       colores y en la categoría los lados que se diseñan ("Frente +
       Espalda");
     - **un combo** usa `piezas`, que muestra la etiqueta "Combo · 2" y sus
       prendas como cartas, y `precioAntes`, el precio por separado, que da
       el "-23%" y el tachado.

## Partes

| N.º | Qué es | Componente | Piezas | Archivo del diseño | Datos en la tienda |
|---|---|---|---|---|---|
| P7 | La página | `PaginaCrear` | las de abajo | `paginas/Crear.module.css` | — |
| — | Portada | `PortadaCrear` | `Sello`, `Trazo`, `Garabatos`; arte en `/crear/banner-crear*.webp` | `piezas/Crear.module.css` | `PASOS_CREAR` (texto fijo) |
| — | Tus borradores | `TarjetaCreacion borrador vertical` | `Carrusel`, `TituloSeccion` | `piezas/Creaciones.module.css` | `useBorradoresCrear` (+ `agruparCombos`) |
| — | Tus creaciones | `TarjetaCreacion vertical` (combo con `imagenes`) | ídem | ídem | `getDesignsByUser` filtrado por `tipo === 'crear'` o `esMiCombo` → `creacionDesdeDiseno` |
| — | Diseños de la comunidad | `TarjetaCreacion vertical usar` | ídem | ídem | `useComunidad` → `disenoComunidadDesde` |
| — | ¿Para cuántos? | `Chip` | — | `Etiquetas.module.css` | los tamaños de los combos (`textoPara`) |
| — | Prenda para diseñar | `TarjetaProducto accion="crear"` | `FotoProducto`, `Etiqueta` | `TarjetaProducto.module.css` | `getPrendasBase` → `prendaCrearDesdeProducto` |
| — | Combo | `TarjetaProducto` con `piezas` y `precioAntes` | ídem | ídem | `getCombosCrear` → `comboCrearDesde` |
| — | Cargando / vacío | `EsqueletoProducto` / `EstadoVacio` (Kapi 3D) | — | — | `isLoading`, sin prendas |
| M11 | Cambio de página | `EsqueletoPagina forma="crear"` | portada, fila y grilla | `Esqueletos.module.css` | — |

## Para cambiar el diseño rápido: qué se repite

- **`TarjetaCreacion`** es la misma de Mis creaciones. `vertical` y `usar`
  son props, no copias.
- **El gesto de las tarjetas** es el de `TarjetaProducto`: inclinación,
  canto con luz y barrido.
- **`Carrusel`, `TituloSeccion` y `EstadoVacio`** son los de todo el kit.

## Las páginas que salen de Crear

| Página | Estado en el kit | Se llega desde |
|---|---|---|
| Comunidad (`/comunidad`) | **P8 · `PaginaComunidad`** | "Ver todos (8)" de Diseños de la comunidad |
| Creación (`/creacion/:id`) | **P9 · `PaginaCreacion`** | "Comprar" de una creación |
| Ver diseño (`/ver/:id`) | **P10 · `PaginaVerDiseno`** | el enlace del WhatsApp de un pedido |
| Combo (`/combo/:id`) | **P11 · `PaginaCombo`** | "Armar" de un combo, "Usar diseño" de un combo de la comunidad, un combo de Mis creaciones |
| Estudio (`/crear/:id`) | **P12 · `PaginaEstudio`** | "Diseñar", "Continuar", "Editar", "Personalizar" y "Usar diseño" (Crear, Comunidad, una creación y un combo) |

### P8 · Comunidad (`paginas/Comunidad.jsx`)

Es la galería de los diseños que publica Walá. Se ve también sin iniciar
sesión.

- **Cabeza:** `CabezaCuenta` con el sello rosa, el título, "8 diseños listos
  para usar" y "Empezar desde cero" (lleva a Crear).
- **Filtro por prenda:** `Chip` con cuántos diseños tiene cada una. Agrupa
  por `productId` como `ComunidadPage`, pero el chip lleva el nombre de la
  prenda ("Polera clásica 7"), no el del primer combo que aparece.
- **Galería:** `TarjetaCreacion vertical usar`. Al cambiar de filtro, las
  tarjetas entran una tras otra.
- **Estados:** cargando (`EsqueletoProducto`), error (`Aviso` con
  "Reintentar") y vacío (Kapi con "Muy pronto").
- **Esqueleto al llegar:** `EsqueletoPagina forma="comunidad"`.

En la Tienda de prueba es la página **Comunidad**, con los estados en
"Estado de la galería". Para llevarla a la tienda, `ComunidadPage.jsx`
pasa a `<PaginaComunidad disenos={disenos.map(disenoComunidadDesde)}
cargando={isLoading} error={Boolean(error)} onReintentar={refetch} />`.

### P9 · Una creación (`paginas/Creacion.jsx`)

Es el "producto propio" del cliente, con la forma de una ficha de producto.
Solo la ve su dueño.

- **Galería:** `GaleriaProducto`, una pieza nueva que también servirá para la
  ficha de producto:
  - las miniaturas van en columna (debajo en el celular) y cada foto lleva su
    lado en una píldora;
  - con ratón, la foto se acerca donde está el cursor;
  - con el dedo, se desliza y unos puntos dicen cuál se ve.
- **Cabeza:**
  - migas a Mi cuenta y Mis creaciones;
  - "Mi creación" en etiqueta colgante (es cosa del producto);
  - el nombre con lápiz para renombrarlo ahí mismo;
  - "Hecha sobre Polo clásico · guardada el…".
- **Precio:** con la letra de la marca y, si hay oferta, el descuento en un
  sello inclinado con el degradado.
- **Combo:** "Es parte de tu combo", con "Ir al combo". Si no es parte de uno,
  "Llévala en combo" para cada combo que usa esa prenda.
- **Color, lados con diseño, talla y cantidad:**
  - el color es una muestra fija, porque va con el diseño;
  - la talla es `SelectorTalla` y queda guardada; si falta al agregar, se
    sacude y avisa;
  - la cantidad es `Cantidad`.
- **Botones:** "Agregar al carrito", "Editar diseño" y "Comprar ahora". Debajo,
  envío, cambios y pago seguro.
- **Detalles:** `Acordeon` con la prenda, el color, las zonas de impresión en
  cm, "Ver imagen completa" y "Sobre la prenda".
- **Al final:** publicar o retirar de la comunidad (solo el admin) y
  "Eliminar creación". Las dos se confirman en la página, sin ventanas del
  navegador.
- **Estados:** cargando (`EsqueletoPagina forma="producto"`), sin sesión, no
  encontrada, prenda no disponible y guardada con una versión vieja.
- **Datos:** `fichaCreacionDesde(diseno, prenda, { fecha, esAdmin })` hace lo
  mismo que `CreacionPage` (fotos, tallas del color, precio, combo).
  `itemDeCreacion` y `addToCart` siguen en la página de la tienda, en
  `onAgregar` y `onComprar`.

### P10 · Ver diseño (`paginas/VerDiseno.jsx`)

Es lo que abre el asesor desde el WhatsApp de un pedido, sin sesión.

- **Cabeza:** "Combo · 2 prendas" y el nombre del diseño.
- **Cada prenda:** una tarjeta con su número en un sello y el color con su
  punto, la talla en una píldora y el nombre de la pieza.
- **Fotos:** las de cada lado, con su nombre. Un lado **sin diseño** va
  punteado y dice "Este lado va liso, en Blanco", para que no parezca que
  falta la foto.
- **Estados:** cargando (`Cargando`) y no disponible (Kapi triste).

Hoy `VerDisenoPage.jsx` ya usa `Cargando` y `EstadoVacio` del kit. Para
llevarla a la tienda, devuelve `<PaginaVerDiseno titulo piezas cargando
noDisponible />` con los datos de `verDisenoCompartido`.

### P11 · Un combo (`paginas/Combo.jsx`)

Pareja, trío o conjunto: cada prenda con su propio diseño, color y talla, a
precio de combo. Usa el mismo marco de ficha que una creación
(`piezas/Ficha.jsx`: `MarcoFicha`, `Migas`, `PrecioFicha`,
`ConfianzaCompra`, `TituloEditable`) y `GaleriaProducto`, con todas las
prendas y sus lados.

- **Cabeza:** "Combo · 2 prendas" o "Mi combo" en etiqueta colgante; el
  nombre se renombra si es suyo. El precio lleva el de por separado tachado
  y "Ahorras S/ 59.00".
- **Desde la comunidad:** un aviso con "Personalizar". **Mi combo** dice
  "Guardado en Mis creaciones" y el admin puede publicarlo.
- **Este combo incluye:** "1 de 2 listas" y una barra de un tramo por
  prenda, que se pone verde al quedar lista. Cada prenda es
  **`FilaPiezaCombo`** (pieza nueva), con lo que se puede hacer según cómo
  está:
  - **vacía:** Diseñar, "Copiar de la prenda N" y Mis creaciones (en una
    `HojaInferior`);
  - **desde la comunidad:** Personalizar;
  - **diseñada:** su nombre se renombra, color, lados, su talla
    (`SelectorTalla`), Editar, "Usar en la otra / las demás" y Quitar;
  - **borrador o versión vieja:** su aviso.
- **Conjunto:** una sola talla para todas las prendas.
- **Agregar al carrito:** si falta una talla, una `HojaInferior` la pide
  antes, por prenda (o una para el conjunto).
- **Estados:** cargando (esqueleto de ficha), error y no disponible.

En la Tienda de prueba es la página **Un combo**, con "Cómo se abre" (nuevo,
conjunto, desde la comunidad, mi combo) y sus estados. "Armar" de Crear y
los combos de Mis creaciones llevan ahí.

En la Tienda de prueba son las páginas **Una creación** ("Comprar" de una
creación lleva ahí) y **Ver diseño**, cada una con sus estados.

### P12 · El estudio (`paginas/Estudio.jsx`)

Donde se diseña una prenda: el color, la zona y una imagen o un texto. En la
tienda el lienzo que se arrastra es fabric.js (`CrearStudioPage`, ~3.900
líneas); en el kit el diseño vive en el estado de la página y
**`LienzoPrenda`** lo dibuja con CSS, así se ve y se prueba todo lo demás.
Las piezas están en `piezas/Estudio.jsx`:

- **`LienzoPrenda`** (pieza nueva): la foto del lado. Si el color no tiene
  foto propia, la foto blanca se tiñe: el color recortado con la silueta
  (`mask-image`) y la foto encima en `multiply`; en una prenda oscura la
  foto vuelve tenue en `screen` para que se vean los pliegues. Un bicolor al
  revés voltea la foto. Las zonas son costuras punteadas (`x`, `y`, `w`,
  `proporcion`, `angulo` de la prenda base; el alto es `altoZonaFraccion`) y
  la elegida lleva su nombre. Las capas se arrastran dentro de su zona y lo
  que sale de ella se recorta, como en la impresión. El texto se mide en
  `cqw` de la zona, así escala con la prenda; con `curva` se dibuja en un
  arco (SVG). Con `guias={false}` es la foto final (sin zonas), la de
  "Guarda tu creación". Además:
  - `seleccion`: una capa o varias (Shift o Ctrl + clic las suma; arrastrar
    una de ellas mueve todas) · `onMenu`: clic derecho o toque largo ·
    `onDobleClic`: en una zona vacía escribe un texto ahí; en un texto lo
    edita; en una imagen la recorta.
  - `onSoltarArchivo(archivo, zona)`: una imagen arrastrada desde la
    computadora, con "Suelta tu imagen en …" sobre la zona.
  - `zoom` y `camara` (la vista): con zoom, arrastrar el fondo, Espacio o el
    botón del medio la recorren; `onRueda` con Ctrl acerca hacia el puntero.
  - `onGesto({ fase, factor, giro, centro })`: dos dedos. Con algo elegido o
    con zoom los dedos son del lienzo (`touch-action: none`); si no, un dedo
    desplaza la página y dos acercan la prenda (`pan-x pan-y`).
  - Asas de lo elegido (una sola capa, con `onGesto`): las cuatro esquinas
    agrandan y achican desde el centro y la de arriba gira; van fuera del
    recorte de la zona, así se ven aunque la capa llegue al borde, y no
    crecen con el zoom.
  - `cargando`: "Cargando tu diseño…" encima, con `aria-busy`.
  - Con el teclado: Tab llega a cada zona y a cada capa; Enter la elige.
- **`BarraLienzo`**: deshacer y rehacer; con algo elegido, achicar, agrandar,
  centrar, quitar y, en el celular, **Editar** (baja al panel); + Imagen y +
  Texto; el zoom (1× a 8×; no en el celular: ahí se acerca con los dedos) y
  los atajos (solo con ratón).
- **`PasosEstudio`**: los tres pasos en sellos unidos por una costura, como
  la portada de Crear: **1** el color (`SelectorColor`; si el color tiene
  versión al revés, el `Interruptor` "Invertir colores"), **2** la zona por
  lado (`Chip`, con un punto si ya lleva algo), **3** "Subir imagen" o
  "Escribir texto" y dónde se agrega.
- **`PanelCapa`**: lo elegido, con "Listo". La imagen dice su calidad de
  impresión (buena, aceptable o baja, con la regla de `calidadDeCapa`) y
  tiene quitar fondo, recortar (sin sesión van apagados, como en la tienda)
  y "Llenar zona". El texto: el texto, la letra (`Campo` con `opciones`, cada
  una con su muestra y su grupo), el **alto de la letra en cm** (`Cantidad
  editable`, si la zona trae `anchoCm`), negrita y cursiva (`Chip`), el color
  (`SelectorColor` con `libre`: el arcoíris abre el hex) y **`EfectosTexto`**
  (Normal, Contorno, Sombra, Sticker, Arco y, en un `Acordeon`, contorno,
  sombra y curva a medida con `Deslizador`). Los dos: ajustar, girar de 90°
  en 90°, alinear contra los bordes de la zona, "Una parte queda fuera de la
  zona" y, en `Acordeon`, voltear, traer adelante, enviar atrás, duplicar y
  pasar a otra zona. Al final, **Agregar otro: Imagen · Texto**.
- **`PanelVarios`**: con dos o más elegidas, alinearlas entre ellas,
  repartirlas (tres o más), centrar el grupo, duplicar y quitar.
- **`EstadoEdicion`**: al editar algo guardado, cómo va el borrador
  (guardando, guardado o error) o "Estás editando «nombre» ✎" (se renombra
  ahí mismo, `TituloEditable`) y si hay cambios sin guardar; siempre,
  "Empezar uno nuevo".
- **`GuiaGestos`**: la primera vez que se toca algo con el dedo, sobre la
  prenda: un dedo mueve, dos agrandan y giran, dos toques escriben.
- **`AtajosEstudio`**: la lista de atajos por grupos (editar, mover y
  ordenar, vista, agregar).

Piezas sueltas que usa (sirven en otras páginas):

- **`RecortarFoto forma="libre"`**: un recuadro con sus 4 esquinas, "Quitar
  bordes transparentes" y "Restablecer"; conserva la transparencia y la
  imagen se queda en el mismo lugar de la prenda.
- **`QuitarFondo`**: el editor de quitar el fondo (varita, borrar, restaurar,
  mover; tolerancia, pincel, zoom, fondos para ver, deshacer). Los píxeles
  los hace el `motor` que llega por props (en la tienda,
  `pages/Crear/fondoPixeles.js`).
- **`MenuContextual`**: en escritorio una lista flotante con los atajos; en
  el celular, una `HojaInferior` con las mismas opciones.
- En `Formulario`: `Deslizador`, `CampoHex` y `SelectorColor libre`.

La página (`PaginaEstudio`):

- **Cabeza:** volver (`etiquetaVolver`), la prenda con su color y los lados
  con diseño, el precio y "Mis creaciones". Debajo, `EstadoEdicion` y un
  `Aviso` según cómo se abrió: una prenda de un combo, desde un diseño de la
  comunidad, sin sesión, o una prenda en borrador (`borradorAdmin`, no se
  compra).
- **Ancho:** la prenda a la izquierda (fija al bajar) con las pestañas de
  lado (`Pestanas`, con cuántas capas lleva cada uno) y la barra; el panel a
  la derecha. **Celular:** una columna, y la compra pegada abajo. El lienzo
  vacío dice "Empieza tu diseño en …" con Subir imagen y Escribir texto.
- **Compra:** "Agregar al carrito · S/ X" (o "Listo, usar en el combo", con
  casillas para ponerlo también en las otras prendas del combo; o "Agotado
  por ahora"), Guardar (sin cambios se apaga y dice "Guardado"; si ya se
  guardó, guarda sin preguntar el nombre) y Descargar.
- **Hojas (`HojaInferior`):** la talla y la cantidad antes de agregar; el
  nombre al guardar, con la foto; "¡Creación guardada!" (agregar o volver al
  combo, "Ver mi creación" si `onGuardar` devuelve `{ urlCreacion }`, o
  seguir); sin sesión, iniciar sesión o crear una cuenta (al guardar, subir
  una imagen o agregar al carrito: `requiereSesion`); los atajos. Lo que
  hace la tienda mientras tanto (`procesando`) espera con `CapaCargando`.
- **Color:** al cambiarlo, el texto negro o blanco pasa al que se lee y lo
  que estaba en una zona que el nuevo color no tiene (un bicolor) pasa a la
  de igual nombre (`onAviso` lo cuenta).
- **Imágenes:** subir, pegar (Ctrl+V) o soltar sobre la prenda
  (`onSubirImagen(archivo?)`); lo recortado o sin fondo se sube con
  `onImagenEditada` (sin ella, una URL local).
- **Teclado:** ver `AtajosEstudio`. Deshacer, rehacer, guardar (Ctrl+S),
  elegir todo, copiar, cortar, pegar (también de un lado al otro), duplicar,
  flechas para mover (con Shift, más), + y −, R para girar, F para voltear,
  C para centrar, [ y ] para el orden, T e I para agregar, 1–9 para el lado,
  zoom (Ctrl + / − / 0, Shift+1, Shift+2), Supr y Esc.
- **Mouse y dedos:** las asas de lo elegido agrandan y giran; en el celular,
  además, dos dedos agrandan y giran lo elegido o acercan la prenda. Cerca
  de un múltiplo de 90° se queda derecho, y se guarda una sola vez en el
  deshacer, al soltar.
- **Estados:** cargando (`EsqueletoPagina forma="estudio"`), error, prenda no
  disponible, agotada, en borrador y el diseño que aún llega
  (`cargandoDiseno`).

Los datos llegan por `prendaEstudioDesde(producto)` (adaptadores): los lados
y, por color, sus zonas (`vistasDelColor`: un bicolor usa las suyas) con su
medida en cm (`medidaZona`), su foto, su tinte y sus tallas. La tienda pasa
además `calidadDe` y `fueraDeZona` (los suyos, con fabric); sin ellos, el kit
usa una aproximación con la medida de la zona.

En la Tienda de prueba es la página **Estudio**, con la polera y el polo
reales y "Cómo se abre": nuevo, editar una creación, desde la comunidad y
una prenda de un combo (al terminar vuelve al combo). Todos los "Diseñar",
"Continuar", "Editar" y "Personalizar" de Crear, una creación y un combo
llevan ahí. "Subir imagen" pone las caras de Kapi como si fueran fotos (una
buena, una regular y una chica, para ver los avisos de calidad) y "Quitar
fondo" usa el motor real de la tienda. En "Estados" están agotada, en
borrador, editando un borrador, el borrador que no se guardó y el diseño
que aún llega.

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

Va en el paso 6 de [MIGRACION.md](MIGRACION.md), después de Mis creaciones,
porque comparten `TarjetaCreacion`.

### Reemplazos

| Parte | Hoy en la tienda | Pasa a (kit) |
|---|---|---|
| Portada | `.hero` de `PersonalizarPage.jsx` | `PortadaCrear` |
| Borradores | `TusBorradores` + `TarjetaBorrador` | fila con `TarjetaCreacion borrador vertical` |
| Creaciones | `TusCreaciones` con `MiCreacionCard` / `TarjetaMiCombo` y `FilaCarrusel` | fila con `TarjetaCreacion vertical` + `Carrusel` |
| Comunidad | `DisenosComunidad` + `TarjetaComunidad` | fila con `TarjetaCreacion vertical usar` |
| ¿Para cuántos? | `.selectorPara` (`etiquetaPara`) | `Chip` + `textoPara` |
| Prenda | `TarjetaPrenda` | `TarjetaProducto accion="crear"` |
| Combo | `TarjetaCombo` | `TarjetaProducto` con `piezas` |
| Cargando | `.esqueleto` ×3 | `EsqueletoProducto` |
| Sin prendas | `.emptyState` con un ícono de polera | `EstadoVacio` con Kapi |

### De dónde sale cada dato

- **`prendas`**: `getPrendasBase({ incluirBorradores: isAdmin })`, cada una
  con `prendaCrearDesdeProducto`. Solo pasan los colores que se pueden pedir
  (`colorDisponible`), igual que hoy.
- **`combos`**: `getCombosCrear(...)`, cada uno con `comboCrearDesde(combo,
  prendaPorId)`; si falta una prenda, devuelve `null` y se filtra.
- **`para` y `onPara`**: el `?para=2` de la dirección (`useSearchParams`, con
  `replace`).
- **`borradores` y `creaciones`**: las mismas consultas de hoy, con
  `agruparCombos`. Las 8 más recientes, con `totalCreaciones`.
- **`comunidad`**: `useComunidad()`, cada uno con `disenoComunidadDesde`.
- Eliminar, renombrar y publicar van dentro de cada tarjeta (`onEliminar`…),
  como en Mis creaciones.

### Comportamiento que no se puede perder

- `useVersionesReemplazadas`, que marca y borra versiones viejas de los
  combos, sigue en la página de la tienda; no es del kit.
- El admin ve las prendas y los combos en borrador, con su etiqueta.
- "Armar" empieza un combo limpio (`?nuevo=1`) y "Usar diseño" abre el
  estudio con la plantilla (`?plantilla=`).
- Los borradores se vuelven a leer al volver del estudio
  (`refetchOnMount: 'always'`).

### Diferencias a propósito

- Las tarjetas de las filas son las de Mis creaciones, en vertical.
- "Ahorras" va en un sello dorado; los pasos van en sellos con su número.
- Sin prendas, Kapi en vez de una polera gris.

### El estudio (P12)

Es lo más delicado: el lienzo de fabric.js arma los archivos de impresión,
las vistas previas y el pedido. **No se cambia el lienzo**: se cambia lo de
alrededor, por partes.

| Parte | Hoy en `CrearStudioPage` | Pasa a (kit) |
|---|---|---|
| Barra de arriba y avisos | `.barraSuperior`, avisos de edición e invitado | cabeza de `PaginaEstudio` + `Aviso` |
| Barra rápida | la de debajo del lienzo | `BarraLienzo` |
| Panel sin selección | los tres pasos | `PasosEstudio` |
| Panel con un elemento | texto / imagen (con `SelectorFuente`) | `PanelCapa` (+ `EfectosTexto`) |
| Panel con varios | la barra de alinear y repartir | `PanelVarios` |
| Edición y borrador | los avisos de "Estás editando" y el autoguardado | `EstadoEdicion` |
| Modales | talla, guardar, guardada, login, atajos | `HojaInferior` (+ `AtajosEstudio`) |
| Menú del clic derecho | su menú propio | `MenuContextual` |
| Guía de los dedos | `.guiaGestos` | `GuiaGestos` |
| Recortar | su modal propio | `RecortarFoto forma="libre"` |
| Quitar fondo | `pages/Crear/QuitarFondo.jsx` | `QuitarFondo` con `motor` = `fondoPixeles.js` |
| Miniatura al guardar | la vista previa renderizada | se queda la de la tienda (`renderVistaPrevia`) |

- `PanelCapa` recibe la capa elegida de fabric traducida a sus campos
  (`texto`, `fuente`, `tamano`, `color`, y los efectos con los mismos
  números que `propiedadesTexto` de `renderDiseno.js`: `contorno` y `sombra`
  en % del tamaño de la letra, `curva` de −100 a 100, `espaciado` en
  milésimas de em, `interlineado`, `alineacion`, `sinRelleno`) y sus
  `onCambiar` se aplican al objeto de fabric. El tamaño en cm sale de
  `anchoZonaCm`; la guía de los dedos se marca como vista con
  `onGuiaGestosVista` (hoy, `localStorage` `crear_guia_gestos`). `LienzoPrenda` sirve para las
  miniaturas y para la vista previa de Crear, no reemplaza al lienzo.
- No se puede perder: el autoguardado del borrador, el aviso al salir sin
  guardar, la regla de la calidad (`calidadDeCapa`), quitar el fondo y
  recortar solo con sesión, `?combo=&pieza=` que vuelve al combo, `?copiar=`
  y `?plantilla=`, y los archivos de impresión por zona.
- Las letras se cargan al abrir el estudio (Google Fonts y
  `public/fonts/fonts.css`), no en toda la tienda.

### Pasos

1. Hacer los adaptadores con los datos reales y comparar las tarjetas.
2. Cambiar la portada y la grilla (prendas y combos) por las del kit.
3. Cambiar las tres filas por las del kit (después de Mis creaciones).
4. Borrar `PersonalizarPage.module.css` cuando lleve un tiempo en
   producción.
