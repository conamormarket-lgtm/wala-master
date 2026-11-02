# Panel administrativo (`/admin`): el kit del admin (en marcha: D0 y D1 hechos en el kit, D2 por tramos)

Lo mismo que se hizo con la tienda, ahora con el panel: **primero todo en el
kit**, con datos de ejemplo en `/componentes.html`; **cuando un apartado está
completo en el kit, se une al admin real** con sus conectores y su
interruptor para volver a lo de antes. Nada se migra a medias: un apartado
entra entero o no entra.

Esta ficha es el único plan del admin. Cada avance se anota aquí (en su
apartado y en el **Registro** del final), con la fecha y qué se probó. Lo
viejo que quede sin uso va a [ELIMINAR.md](ELIMINAR.md), como siempre.

Numeración: **D** = admin. **D0** es el marco (menú, cabecera de página,
inicio) y **D1-D8** los apartados, en el orden en que se hacen.

## Para qué

1. **Un solo sistema.** El admin tiene que verse y comportarse como Walá
   clientes: las mismas piezas, los mismos tokens, el mismo modo noche.
2. **Mejor experiencia para quien administra.** Menos pasos, nada de
   `alert()` ni `window.confirm`, estados claros (cargando, vacío, error,
   guardado), deshacer donde se pueda y confirmar solo lo que no se deshace.
3. **Un celular de verdad.** Hoy el admin es de escritorio con el menú
   apretado. Tiene que poder usarse completo desde el teléfono (y la app con
   Capacitor): revisar un pedido, cambiar un stock, publicar un sorteo,
   responder un reclamo.

## Punto de partida (mapa del 2026-11-02)

- **91 archivos JSX** (`pages/admin`, `pages/Tienda/admin`, `components/admin`,
  `components/AdminLayout`), unas 38 mil líneas, y **26 mil líneas de CSS
  propio**: cada página dibuja lo suyo.
- **Solo 6 usan el kit**, y para algo suelto: `Boton` y `Sello` (Marcas),
  `Campo`/`Chip`/`useConfirmar` (Popups, Ruleta, Yoryo), `RuedaRuleta`,
  `VentanaCampana`, `TarjetaProducto` (Landing pages).
- **Cuatro familias de estilo a la vez**: `components/common/Button` (33
  páginas), los `Glass*` de `components/ui` (7), `GlassCard`/`KpiCard` de
  `components/dashboard` (8) y las piezas de `pages/admin/resultados/piezas.jsx` (7).
- Hecho a mano y repetido:

| Hecho a mano | Veces | Lo reemplaza |
|---|---|---|
| `<select>` nativo | 104 | `Selector` / `Campo` con `opciones` (`ListaOpciones`) |
| Modales con clases propias (`styles.modal…`) | 77 | `HojaInferior` / `HojaEdicion` |
| `alert(...)` | 58 | `useToast` |
| `window.confirm` | 42 | `useConfirmar` |
| `<input type="checkbox">` | 35 | `Casilla` / `Interruptor` |
| `<textarea>` | 30 | `Campo multilinea` |
| `<table>` | 26 (+ `ProductTable`) | `TablaAdmin` (nueva) |
| `type="file"` + subida propia | 17 | `CampoImagen` (nueva) |
| `type="color"` / `type="date"` | 10 / 10 | `ControlColor` / `CampoFecha` |
| `ToastContext` viejo | 10 | `useToast` del kit |
| Paginación o "cargar más" | 0 | `CargarMas` (nueva): hoy todas las listas bajan todo |

- **Ya está en el kit:** el editor del builder (`editor/PanelEditor`, por
  `components/constructor/EditorDeTienda.jsx`; `VisualEditorPanel` solo con
  `editorViejo`). Sus controles (`ControlImagen`, `ControlColor`,
  `ControlLista`, `ControlIcono`, `ControlEnlace`, `ControlFecha`) y
  `FormularioSeccion` + `esquemas.js` son un motor de formularios por
  esquema que el admin puede reutilizar.

## Diseño: el lenguaje de Walá, con la densidad de un panel

Es el mismo sistema del kit (README, "Lenguaje de marca"). Lo que cambia es
cuánto entra en pantalla, no la marca.

**Igual que en clientes**
- Tokens de `styles/variables.css` y `theme/tokens.css`, noche violeta
  (`--noche-wala`), nada de gris carbón.
- `--fuente-marca` (Montserrat 900) en títulos de página, cifras y nombres;
  Poppins en el resto.
- **Botón violeta liso** (`Boton`), sin el degradado de `GlassButton`.
- Íconos en `Sello` (el del menú, el de cada cabecera de página, el de los
  estados vacíos), con un tono por grupo del menú. Nada de emojis en los
  títulos (hoy: "🎯 Datos para recomendar", "📦 Recepción…").
- `Visto` para lo elegido; `EstadoVacio` con Kapi donde no hay datos.
- Animaciones livianas: `transform`/`opacity`, brillo solo al interactuar,
  sin bucles, sin glows, sin blur (el admin de hoy usa *liquid glass*: se va).
- Fotos de producto con `FotoProducto` (fondo blanco, `--escenario-foto`).

**Distinto a propósito**
- **Más denso**: filas de tabla de 44-48 px, márgenes menores, títulos más
  chicos que en la tienda. Un panel se lee rápido, no se recorre.
- **Sin etiqueta colgante** salvo en las vistas previas de producto (la
  regla de siempre: la etiqueta violeta es de productos; en datos y cuentas
  se confunde con "Combo"). Sin garabatos en tablas ni formularios; Kapi
  solo en vacíos y en el inicio.
- **Costos y cobros etiquetados** con texto ("CUESTA", "Cobrado"), nunca un
  ícono de moneda con un número solo.
- **Estados con texto y color** (`InsigniaEstado`), nunca solo color.

## En el celular

Regla: **todo lo que se hace en escritorio se puede hacer en el celular**,
con menos cosas a la vez.

- **Menú**: en el celular no hay barra lateral. Arriba, la cabecera del
  panel (logo, título de la sección y el botón del menú); el menú abre como
  hoja con los grupos y un buscador de secciones. Abajo, una
  **barra inferior del admin** con 4 accesos fijos (Inicio, Pedidos,
  Productos, Resultados) y "Más" (el menú). El botón atrás de Android cierra
  la hoja antes de salir de la página (`useCerrarConAtras`).
- **Tablas → tarjetas**: la misma `TablaAdmin` se dibuja como lista de
  tarjetas por debajo de 720 px (container query, como `MarcoCuenta`): foto,
  título, 2-3 datos y el estado; las acciones en el `MenuContextual` (toque
  largo o "⋯").
- **Editar → pantalla completa**: `HojaEdicion` es un panel lateral en
  escritorio y una hoja de alto completo en el celular, con Guardar fijo
  abajo (encima del teclado).
- **Filtros → hoja**: el buscador queda arriba; los demás filtros, en una
  hoja con "Ver N resultados". Los filtros activos como chips quitables.
- **Acciones en lote**: al elegir filas aparece una barra fija abajo
  ("3 elegidos · Ocultar · Eliminar").
- Toques de 44 px como mínimo, nada que dependa del hover, nada de
  arrastrar sin una alternativa con botones (subir/bajar).
- Las vistas previas ("así se ve en la tienda") en el celular van en una
  pestaña aparte ("Editar · Ver"), no al costado.

## Reglas del kit (las de siempre, aplicadas al admin)

- **Los datos entran por props.** Ninguna pieza del admin lee Firestore,
  React Query, AuthContext ni permisos: la página real (el conector) se los
  pasa. El menú recibe los grupos ya filtrados por permiso.
- **Las acciones salen por props** (`onGuardar`, `onEliminar`…) y devuelven
  una promesa: la pieza pone sola el cargando, el error y el "Guardado".
- **Se arma con sus propias piezas**: la tabla usa `Casilla`, `Avatar`,
  `FotoProducto`, `InsigniaEstado`, `MenuContextual`; nada se dibuja dos veces.
- Todo en `src/componentes/kit/`: piezas del admin en `piezas/admin/`,
  páginas en `paginas/admin/`, adaptadores en `adaptadoresAdmin.js` (aparte,
  para no ir en el archivo principal de la tienda).
- En `/componentes.html`, una vista nueva **Admin** (como Piezas, Secciones
  y Páginas): las piezas sueltas y el "Panel de prueba" con el mismo marco,
  en escritorio y celular, con estados (cargando, vacío, error, sin permiso).

## Lo que ya sirve tal cual

| Pieza del kit | En el admin reemplaza |
|---|---|
| `Boton` | `common/Button`, `GlassButton` |
| `Campo`, `Selector`, `ListaOpciones`, `Interruptor`, `Casilla`, `CampoTelefono` | `<select>`, `<input>`, `<textarea>`, checkboxes, `common/Toggle`, `GlassInput` |
| `CampoFecha` | `type="date"` |
| `ControlColor`, `ControlImagen`, `ControlIcono`, `ControlLista`, `ControlEnlace` (`editor/CamposEditor.jsx`) | color, subida simple, listas repetibles (premios, planes, botones) |
| `Pestanas`, `Acordeon` | `tabBtn` propios (18 páginas) |
| `HojaInferior`, `Confirmar` + `useConfirmar` | modales propios, `GlassModal`, `common/Modal`, `window.confirm` |
| `useToast`, `Aviso` | `alert()`, `ToastContext` |
| `EstadoVacio`, `Esqueletos`, `Cargando`, `CapaCargando` | "No hay…", `Loader2`, `PageLoading` |
| `Chip`, `Etiqueta`, `Avatar`, `FotoProducto`, `Sello`, `BarraProgreso` | badges y miniaturas propias |
| `RecortarFoto`, `QuitarFondo` | `AdminImageCropper`, `ThumbnailCropEditor` |
| `MenuContextual` | botones de editar/eliminar sueltos por fila |
| `CodigoCopiable` | "copiar enlace / código" propios |
| `TarjetaProducto`, `VentanaCampana`, `RuedaRuleta`, `CabezaSorteo`, `BotonEnlace`, secciones del builder | vistas previas de la tienda dibujadas aparte |

## Piezas nuevas (por hacer)

Estado: **·** por hacer · **kit** hecha en el kit · **admin** ya en el panel.

### Marco

| Pieza | Qué hace | Estado |
|---|---|---|
| `MarcoAdmin` | Menú lateral con grupos plegables (el abierto se recuerda), buscador de secciones, sello por grupo; en el celular, cabecera + hoja + `BarraInferiorAdmin`. Recibe `grupos` ya filtrados por permiso | kit (2026-11-02) |
| `BarraInferiorAdmin` | Los 4 accesos fijos + "Más" en el celular | kit (2026-11-02) |
| `CabezaAdmin` | Sello, título, una línea de ayuda, migas, acciones ("Nuevo", "Exportar") y, en el celular, la acción principal como botón fijo | kit (2026-11-02) |
| `SinPermiso` | Lo que ve un admin sin el permiso de esa sección | kit (2026-11-02) |

### Datos

| Pieza | Qué hace | Estado |
|---|---|---|
| `TablaAdmin` | Columnas, ordenar, elegir filas, acciones por fila, esqueleto, vacío, error; tarjetas en el celular | kit (2026-11-02) |
| `BarraFiltros` | Buscador, chips de filtros, `Selector`, rango de fechas; en el celular los filtros en hoja | kit (2026-11-02) |
| `AccionesLote` | La barra de "N elegidos" (reemplaza `components/admin/BulkActions`) | kit (2026-11-02) |
| `CargarMas` | "Cargar más" / paginación con cuántos hay | kit (2026-11-02) |
| `InsigniaEstado` | Un estado con texto y color desde un mapa (borrador, activo, cerrado, pagado, pendiente, anulado…) | kit (2026-11-02) |
| `FilaRecurso` | Foto, nombre, datos y acciones: categorías, colecciones, marcas, cliparts | · |
| `ListaOrdenable` | Reordenar arrastrando, con subir/bajar como alternativa (en vez del número `order` escrito a mano) | kit (2026-11-02) |
| `SelectorProductos` | Buscar y elegir productos con su foto (reemplaza `components/admin/BuscadorProducto`) | kit (2026-11-02) |

### Formularios

| Pieza | Qué hace | Estado |
|---|---|---|
| `HojaEdicion` | Crear/editar: panel lateral o pantalla completa en el celular; Guardar/Cancelar; aviso de cambios sin guardar; bloqueada mientras guarda | kit (2026-11-02) |
| `GrupoCampos` | Un bloque de campos con su título y ayuda (hoy 19 versiones de `fieldGroup`/`formSection`) | kit (2026-11-02) |
| `CampoImagen` | Soltar o elegir, recortar (`RecortarFoto`), avance de la subida, cambiar y quitar. La subida llega por props | kit (2026-11-02) |
| `CampoFechaHora` | `CampoFecha` + la hora (sorteos, ofertas, popups) | · |
| `CampoDinero`, `CampoPorcentaje` | Soles (o céntimos guardados), dólares, comisión | `CampoDinero` kit (2026-11-02) |
| `CampoColor` | La muestra del color sobre un damero y su código (#ffffff) | kit (2026-11-02) |
| `EstadoGuardado` | "Sin guardar · Guardando… · Guardado" en la cabecera del formulario | · |
| `VistaPrevia` | El marco "Así se ve en la tienda" con celular/escritorio; en el celular, pestaña "Ver" | · |

### Métricas

| Pieza | Qué hace | Estado |
|---|---|---|
| `Cifra` | Una cifra con su nombre y ▲/▼ frente al periodo anterior (reemplaza `KpiCard` y la de `resultados/piezas`) | · |
| `SelectorPeriodo` | Hoy, 7, 30, 90 días, fechas y "comparar" | · |
| `GraficoTendencia`, `GraficoBarras`, `GraficoDona`, `GraficoComparar` | Los de `components/dashboard/charts` y `resultados/piezas` en una sola versión | · |
| `RankingConFotos` | `RankingConMiniaturas` del dashboard | · |

## Plantillas de página

Casi todo el admin entra en cinco formas. Se hacen como páginas del kit
(`paginas/admin/`) que reciben las piezas de arriba.

| Plantilla | Forma | Páginas que cubre |
|---|---|---|
| `PaginaListaAdmin` (kit, 2026-11-02) | `CabezaAdmin` + `BarraFiltros` + `TablaAdmin` + `HojaEdicion` | Categorías, Colecciones, Atributos, Marcas, Cliparts, Envíos, Recompensas, Misiones, Retos, Popups, Sorteos, Enlaces, Landing pages, Temas, Referidos, Libro de reclamaciones… |
| `PaginaDetalleAdmin` | Cabeza con estado + `Pestanas` + tablas y acciones | Detalle de sorteo, de suscripción, ficha de cliente, un pedido |
| `PaginaEditorAdmin` | Formulario + `VistaPrevia` | Editor de enlaces, Popups, Ruleta, Encuestas, Palabra, Mascota |
| `PaginaResultadosAdmin` | `SelectorPeriodo` + `Cifra` + tarjetas con gráficos | Las pestañas de Resultados, el historial de pagos |
| `PaginaAjustesAdmin` | `GrupoCampos` + Guardar | Configuración, WhatsApp, Mascota, configuración de pagos |

Quedan fuera de las plantillas (herramientas propias, como el estudio):
`AdminProductoFormV2` (1.881 líneas), `PrintAreasEditor` (1.632),
`PersonalizacionPrenda` (899), `ShapeCreator`, `AdminViewEditor`. Se arman
con las mismas piezas, al final de su apartado.

## Apartados

Cada uno se hace **entero en el kit** (piezas que falten, sus páginas en el
Panel de prueba, celular y escritorio, capturas en `guia/`) y después **se
une** al admin. Columna "Kit" / "Admin": **·** por hacer, **en marcha**,
**hecho (fecha)**.

| # | Apartado | Páginas (ruta `/admin/…`) | Plantilla | Kit | Admin |
|---|---|---|---|---|---|
| D0 | Marco | el menú (`AdminLayout`), la cabecera de cada página, el inicio (`/admin`, `AdminDashboard`) | — | hecho (2026-11-02) | · |
| D1 | Catálogo base | `categorias`, `colecciones`, `atributos-catalogo`, `marcas` (+ productos de la marca), `envios`, `cliparts`, `destacados` | Lista | hecho (2026-11-02) | · |
| D2 | Productos | `productos` (lista, packs), `inventario`, `productos/:id` (la ficha), `plantillas-yoryo`, personalizables y combos de Crear, `blueprints`, `publico-productos` | Lista + herramientas propias | en marcha (D2a, 2026-11-02) | · |
| D3 | Pedidos y pagos | `recepcion-pedidos`, `gestion-pagos` (configuración, generar enlace, historial), `crear-cuentas-pedidos`, `libro-reclamaciones` | Lista · Detalle · Ajustes | · | · |
| D4 | Resultados | `resultados` (Resumen, Productos, Visitantes, Clientes con la ficha, Opiniones, Detalle técnico y sus pantallas) | Resultados · Detalle | · | · |
| D5 | Clientes y fidelidad | `referidos`, `recompensas`, `misiones`, `retos`, `notificaciones`, `fechas-importantes`, `encuestas` | Lista · Editor | · | · |
| D6 | Campañas | `sorteos` (+ detalle), `sorteos-suscripcion` (+ detalle), `enlaces` (+ editor), `popups`, `landing-pages`, `temas` | Lista · Detalle · Editor | · | · |
| D7 | Juegos y Kapi | `wordle`, `ruleta`, `bolitas`, `mascota` | Editor | · | · |
| D8 | Ajustes | `configuracion` (admins, permisos, bloqueos), `whatsapp`, `backups` | Ajustes · Lista | · | · |

El orden: D0 con las piezas base (tabla, hoja de edición, campo de imagen,
estado), probadas en **Categorías**, que es un CRUD simple con foto y toca
casi todo. Después el resto de D1, y así hacia abajo. D2 (la ficha de
producto) puede ir después de D3 si hace falta: es la más grande.

## D0 · El marco y las piezas base (en el kit desde el 2026-11-02)

Cómo verlo: `npm run dev` → http://localhost:3000/componentes.html → **Admin**.
**Panel de prueba**: el marco con el menú real; **Ver como** cambia los
permisos (Super Admin, Catálogo, Solo inventario, Clientes) y el menú, la
barra del celular y lo que se puede abrir cambian solos; **Tamaño**
Computadora · Celular; **Estado**: cargando, error al cargar, sin datos y
"Guardar y subir fallan". **Piezas del admin**: `InsigniaEstado`, una tabla
con casillas y `AccionesLote`, y `CampoImagen` con sus estados.

| Parte | Componente | Archivo | Qué hace |
|---|---|---|---|
| D0·1 Menú | `MarcoAdmin` | `piezas/admin/Marco.jsx` | Menú lateral (marco de 960 px o más, container query `admin`): logo con "Panel", buscador de secciones (sin tildes), Inicio suelto y los grupos plegables con su sello; el grupo de la sección actual se abre solo; abajo, quién eres, "Ver la tienda" y "Salir". En el celular: cabecera con el título de la sección y el botón del menú, el menú en una hoja |
| D0·2 Barra del celular | `BarraInferiorAdmin` | `piezas/admin/Marco.jsx` (dibujo de `BarraInferior.module.css`, sin blur) | Cuatro accesos que el admin puede abrir y "Más" (el menú) |
| D0·3 Cabecera de página | `CabezaAdmin` | `piezas/admin/Marco.jsx` | Migas, sello, título con la letra del logo, ayuda, acciones; `principal` ("Nueva categoría") baja en el celular a un botón sobre la barra (el marco lo recibe por contexto) |
| D0·4 Sin permiso | `SinPermiso` | `piezas/admin/Marco.jsx` | Qué permiso pedir y "Volver al inicio" |
| D0·5 Inicio | `PaginaInicioAdmin` | `paginas/admin/Inicio.jsx` | Saludo con la fecha y Kapi (con hambre si algo espera, feliz si todo está al día), "Para hoy" (lo que espera respuesta, con su cuenta o "Al día") y atajos |
| Tabla | `TablaAdmin` | `piezas/admin/Datos.jsx` | Tabla con cabecera pegada, ordenar, casillas, "⋯" y clic derecho (`MenuContextual`); a menos de 720 px de caja, tarjetas (foto, título, datos, estado); cargando, error con Reintentar y vacío |
| Filtros | `BarraFiltros` | `piezas/admin/Datos.jsx` | Buscador y filtros en una fila; angosta, "Filtros" abre una hoja y los puestos quedan como chips; cuántos quedan |
| Estado | `InsigniaEstado`, `ESTADOS_ADMIN` | `piezas/admin/Datos.jsx` | `Etiqueta` con punto y texto, desde un mapa |
| Lo elegido | `AccionesLote` | `piezas/admin/Datos.jsx` | Barra noche pegada abajo (sobre la barra del celular: `--admin-abajo`) |
| Editar | `HojaEdicion` | `piezas/admin/Formularios.jsx` | Panel derecho de 520 px en escritorio, pantalla entera en el celular; Guardar fijo; el error de guardar queda arriba; con cambios, cerrar (X, Cancelar, Esc, afuera o atrás) pregunta "¿Salir sin guardar?" |
| Bloques | `GrupoCampos` | `piezas/admin/Formularios.jsx` | Título en versalitas, ayuda, una o dos columnas |
| Imagen | `CampoImagen` | `piezas/admin/Formularios.jsx` | Elegir o soltar, `RecortarFoto` (círculo o cuadrado), avance de la subida, Cambiar, Quitar, error con Reintentar |
| Datos | `MENU_ADMIN`, `menuAdminPara`, `accesosAdminPara`, `opcionActiva`, `categoriaDesdeFirestore` / `categoriaAFirestore`, `marcaAdminDesdeFirestore` | `adaptadoresAdmin.js` (con pruebas: `npm run test:admin`) | El menú con el permiso de cada opción (las mismas reglas de `AdminLayout`), la barra del celular y las categorías |

La prueba de las piezas: **Categorías** (`paginas/admin/Categorias.jsx`,
`PaginaCategorias`; es de D1, se armó primero porque toca casi todo):
aviso de las que no tienen marca con "Verlas", buscar, filtrar por marca
(o "Sin marca"), ordenar por nombre u orden, crear y editar en la hoja
(nombre, orden, marcas con "Todas · Ninguna", la foto de la burbuja en
círculo) y eliminar con su pregunta. Datos de la demo: la copia real de
`categories` (`demo/tienda.json`) y `tienda_brands` (`demo/marcas.json`;
las marcas de cada categoría salen de su `categoryNav`, por eso varias
quedan "sin marca").

### Diferencias a propósito (no "corregirlas" al unir)

- **El menú se ordena por tarea**, no por permiso: Inicio · Pedidos y pagos ·
  Catálogo · Resultados · Clientes · Campañas · Diseño y juegos · Ajustes.
  Cada opción conserva su permiso de hoy (`adaptadoresAdmin.js`); un grupo
  sin opciones no sale. **Inicio lo ve cualquier admin** (antes su enlace
  estaba en el grupo de diseño, aunque `/admin` ya abría para todos).
- Sin emojis en el menú: cada opción tiene su ícono (`iconosAdmin.js`).
- **Categorías no deja dos con el mismo nombre** (sin tildes ni
  mayúsculas): propone sumarle marcas a la que ya existe.
- La orden de una categoría nueva es la mayor + 1 (antes, cuántas había).
- Guardar cierra la hoja y avisa con un toast; antes el formulario quedaba
  arriba de la lista y subía la página.
- `useCerrarConAtras` (`Efectos.jsx`) ganó `alBloquear`: con "atrás"
  bloqueado, avisa (la hoja de edición pregunta antes de salir). Lo de
  antes no cambia.

### Qué se probó (2026-11-02, demo en localhost)

- Escritorio (1180 px) y celular (375 px; también el tamaño Celular de la
  demo): el menú lateral o la cabecera + barra, la tabla o las tarjetas, el
  botón "Nueva categoría" sobre la barra; nada se sale del ancho a 375 px
  (el buscador de los filtros empujaba "Filtros": corregido).
- Crear sin nombre → el error en el campo y el foco ahí; crear con marca →
  toast y la fila nueva; editar → guardar falla ("Guardar y subir fallan")
  → el motivo arriba y lo escrito se queda → guardar bien.
- Con cambios: Esc → pregunta; "Seguir editando" → sigue la hoja; atrás →
  pregunta; atrás otra vez → solo se va la pregunta; "Salir sin guardar"
  → se cierra sin salir de la página.
- "⋯" → Editar · Eliminar → la pregunta → la fila se va y el toast.
- Permisos: "Solo inventario" ve Inicio e Inventario y Categorías dice qué
  permiso pedir; "Clientes" ve Pedidos y pagos, Resultados, Clientes y
  Campañas (solo Popups).
- En el celular: "Más" abre el menú en una hoja, buscar "ruleta" la
  encuentra y tocarla navega y cierra la hoja; la subida de una foto
  (recorte en círculo, avance, falla con Reintentar).
- Sin errores en la consola. Ese día el panel del navegador estaba oculto
  (no dibujaba): lo visual se revisó a ojo con D1 (abajo).

### Pendiente de D0

- ~~Las capturas y el modo noche~~: hechas con D1 (abajo); el modo noche se
  revisó a ojo el 2026-11-02 (la barra de lo elegido se perdía de noche:
  ahora violeta oscuro con borde).
- ~~`AccionesLote` encima del botón de la página~~: mientras hay algo
  elegido, el botón se esconde (`useMarcoAdmin().setConLote`).
- ~~`PaginaListaAdmin`~~: salió con D1.
- Al unir: el inicio de hoy (`AdminDashboard.jsx`) trae además un editor
  viejo de secciones por zonas; ver si alguien lo usa antes de retirarlo.

## D1 · Catálogo base (en el kit desde el 2026-11-02)

Cómo verlo: **Admin** → Panel de prueba → "Ir a" (Categorías, Colecciones,
Marcas, Atributos, Envíos, Cliparts, Destacados) o el menú. Datos: la copia
real de `categories`, `collections`, `tags`, `characters`, `productTypes`,
35 productos (`demo/tienda.json`) y `tienda_brands` (`demo/marcas.json`);
las zonas de envío y los cliparts son de ejemplo (no hay copia).

| Escritorio | Celular |
|---|---|
| ![Categorías en escritorio: menú lateral, aviso de las que no tienen marca, filtros y la tabla](admin-categorias-escritorio.webp) | ![Categorías en el celular: cabecera, tarjetas, el botón Nueva categoría sobre la barra](admin-categorias-celular.webp) |
| ![Editar una marca: la hoja al costado con dirección, logo, monedas y el fondo de sus tarjetas](admin-marca-editar.webp) | ![El menú del panel en una hoja, con buscador y grupos](admin-menu-celular.webp) |
| ![Destacados: la lista que se ordena a mano, buscar para destacar y lo más vendido](admin-destacados.webp) | ![El panel de noche](admin-noche.webp) |

### La plantilla: `PaginaListaAdmin` (`paginas/admin/Lista.jsx`)

Toda lista con su hoja: `CabezaAdmin` + `antes` (un aviso, pestañas) +
`BarraFiltros` + `TablaAdmin` (de a 50, con `CargarMas`) + `HojaEdicion` +
la pregunta de eliminar + los toasts. Cada página da sus columnas, sus
filtros (`filtrar(r, valor)`), sus órdenes, y un `formulario` con `vacio`,
`desde`, `validar` (el primer campo con error recibe el foco), `limpiar` y
`campos`. `eliminar.bloqueado(r)` no pregunta: avisa por qué no se puede.
Lo que se repite en las celdas está en `paginas/admin/celdas.jsx`
(`FotoCelda`, `MarcasCelda`, `NumeroCelda`, `ElegirMarcas`, `porNombre`,
`porOrden`). Categorías pasó a la plantilla.

### Las páginas

| Página | Componente | Archivo | Qué tiene |
|---|---|---|---|
| Categorías | `PaginaCategorias` | `paginas/admin/Categorias.jsx` | (D0) sobre la plantilla |
| Colecciones | `PaginaColecciones` | `paginas/admin/Catalogo.jsx` | Nombre, orden y el banner (ancho, sin recorte); no repite nombres |
| Atributos | `PaginaAtributos` | `paginas/admin/Catalogo.jsx` | Pestañas Tipos · Etiquetas · Personajes con su cuenta; etiquetas y personajes con marcas (sin ninguna: de todas); cuántos productos usa cada uno; **no deja eliminar uno en uso** (como antes) y dice en cuántos está |
| Zonas de envío | `PaginaEnvios` | `paginas/admin/Catalogo.jsx` | Zona y departamento, costo (`CampoDinero`; 0 = gratis), días, orden y activa (`Interruptor`); filtro activas/inactivas |
| Cliparts | `PaginaCliparts` | `paginas/admin/Catalogo.jsx` | Nombre, categoría (elegir o escribir una nueva), la imagen (PNG/SVG, sin recorte, también por enlace) |
| Marcas | `PaginaMarcas` | `paginas/admin/Marcas.jsx` | Arriba, "Pedidos por WhatsApp" (número principal y multimarca, en su hoja). La lista: logo, dirección, WhatsApp del asesor, tope de monedas. La hoja: nombre, dirección (`wala.pe/…`, **no deja repetir la de otra marca**), orden, logo, WhatsApp del asesor, mensaje sin productos, tope de monedas con el ejemplo de S/ 100, el fondo de sus tarjetas (`CampoColor`, textura, cuánto se ve) y la **vista previa de la tarjeta** con uno de sus productos. Menú "Páginas": aplicar la plantilla de página (pregunta) y quitar páginas repetidas. Por fila: sus productos y diseñar página |
| Productos de una marca | `PaginaProductosMarca` | `paginas/admin/Marcas.jsx` | Pestañas "En la marca · N" y "Agregar productos", buscar, casillas, `AccionesLote` (Quitar de la marca / Pasar a …), de a 50; "Crear producto en …" (`/admin/productos/nuevo?brandId=`) |
| Destacados | `PaginaDestacados` | `paginas/admin/Destacados.jsx` | Los de la portada en una `ListaOrdenable` (arrastrar o flechas; "Guardar orden" / "Deshacer" pegados abajo), quitar, `SelectorProductos` para destacar otro y lo más vendido de 30 días con Destacar / Quitar |

Piezas nuevas en D1: `ListaOrdenable`, `SelectorProductos`, `CargarMas`
(`piezas/admin/Datos.jsx`), `CampoDinero`, `CampoColor` y `conEnlace` /
`contener` en `CampoImagen` (`piezas/admin/Formularios.jsx`). Adaptadores
nuevos (con pruebas): colecciones, atributos (`ATRIBUTOS`,
`usosDeAtributo`), zonas, cliparts, marcas (`slugDeMarca`, `topeMonedasDe`),
`productoAdminDesde` y `mismoNombre`.

### Diferencias a propósito (D1)

- Colecciones, zonas y atributos **no dejan dos con el mismo nombre** (sin
  tildes ni mayúsculas); los atributos ya lo hacían.
- Una marca **no puede tomar la dirección de otra** (antes lo decía el
  servidor al guardar).
- **Destacar uno lo pone al final** (antes, con orden 0: al principio y
  empatado con otros). El orden se guarda de una vez para todos, con su
  posición (`featuredOrder` 0, 1, 2…); antes, uno por uno con un número.
- El WhatsApp de "Pedidos por WhatsApp" se cambia en su hoja, con el
  resto de la página quieta.
- "Aplicar plantilla" y "Quitar páginas repetidas" van en el menú
  "Páginas" (antes, dos botones grandes arriba); el resultado sale en un toast.
- "Gestionar productos" es una página con su dirección (en la demo,
  `/admin/marcas/:id/productos`); antes reemplazaba la lista sin cambiar
  la dirección (atrás salía de Marcas).

### Qué se probó (2026-11-02, demo en localhost, con el navegador dibujando)

- Las siete páginas cargan con sus datos; en el celular (375 px) nada se
  sale del ancho (las pestañas de Atributos y la lista de Destacados se
  salían: pestañas más cortas, que se deslizan si no entran, y el número
  de la lista y el texto "Quitar" se van en angosto).
- Destacados: bajar el primero con la flecha → aparece "Guardar orden" →
  guardar → toast y se va el aviso; buscar "conjunto" → los ya destacados
  dicen "Destacado" → destacar otro → queda al final; quitar → se va.
- Atributos: las tres pestañas con su cuenta; eliminar una etiqueta en uso
  → no pregunta y avisa "Está en 1 producto…".
- Marcas → "Sus productos" de MUSSA → "Agregar productos" → elegir dos →
  el botón de la página se esconde → "Pasar a MUSSA" → toast y la cuenta
  pasa de 11 a 13.
- Editar una marca: la hoja con la vista previa de la tarjeta; el color
  con su muestra (el `ControlColor` del editor no se veía fuera del editor:
  por eso `CampoColor`).
- Modo noche a ojo (Categorías y las piezas sueltas). Sin errores en la consola.

### Cómo se une D1 (cuando se decida)

Un conector por página en `src/components/panel/` con los servicios de hoy
y sus mismas `queryKey` (las de la tienda también: `['categories']`,
`['collections']`, `['brands']`, `['tags']`, `['characters']`,
`['productTypes']`, `['shipping-zones']`, `['cliparts']`,
`['featured-products']`, `['products']`…):

| Página | Lee | Escribe |
|---|---|---|
| Categorías | `getCategories`, `getBrands` | `createCategory` / `updateCategory` / `deleteCategory` con `categoriaAFirestore`; `uploadFile` en `categories/` |
| Colecciones | `getCollections` | `create/update/deleteCollection` con `coleccionAFirestore`; `uploadFile` en `collections/` |
| Atributos | `getProductTypes`, `getTags`, `getCharacters`, `getBrands`, `getProducts([], null, null, { includeHidden: true })` para `usosDeAtributo` | `create/update/delete` de cada uno con `atributoAFirestore(datos, tipo)` |
| Envíos | `getShippingZones` | `create/update/deleteShippingZone` con `zonaAFirestore` |
| Cliparts | `getCliparts` | `create/update/deleteClipart` con `clipartAFirestore(datos, toDirectImageUrl)`; `uploadFile` en `cliparts/` |
| Marcas | `getBrands`, `getMessage('whatsapp_number_principal' \| 'whatsapp_multimarca')`, `getProductsByBrand` (la muestra) | `create/update/deleteBrand` con `marcaAFirestore` (si `updateBrand` devuelve error, se lanza: la hoja lo muestra); `setMessage` ×2; `ensureAllBrandLandings({ force: false })` y `dedupeBrandLandings` con su texto de resultado; logo en `brands/logos/`, textura en `brands/backgrounds/` (`opciones.carpeta`) |
| Productos de una marca | `getProducts(… includeHidden)` con `productoAdminDesde` | `setProductBrand(id, brandId)` (vacío para quitar) uno por uno, contando los que fallan |
| Destacados | `getProducts(… includeHidden)`, `getTopSellingWala({ days: 30, topLimit: 10 })` (staleTime 15 min) | `updateProductField(id, { featured: true, featuredOrder: último + 1 })`, `{ featured: false, featuredOrder: 0 }` y el orden `{ featured: true, featuredOrder: i }` |

Interruptor: `adminCatalogoViejo`. No se pierde: el tope de monedas es el
mismo de `utils/topeMonedas` (y su espejo en `functions/checkoutTotals.js`);
eliminar una marca borra su landing (`deleteBrand`); `storeTitle` y
`storeSubtitle` no se escriben (se conservan).

## D2 · Productos (en marcha: D2a hecho en el kit el 2026-11-02)

D2 es el apartado más grande (la ficha sola tiene 1.881 líneas y se apoya
en editores de otras 3.000). Se hace por tramos; el apartado se une entero
cuando estén los cuatro.

| Tramo | Qué | Páginas de hoy | Kit |
|---|---|---|---|
| D2a | La lista, el inventario y los datos para recomendar | `pages/Tienda/admin/AdminProductos.jsx` (vistas Tienda y Todos), `ProductTable`, `BulkActions`, `pages/Tienda/admin/AdminInventario.jsx`, `pages/admin/AdminPublicoProductos.jsx` | hecho (2026-11-02) |
| D2b | La ficha de un producto: general (precio, stock, descripción, organización, WhatsApp, destacado), colores y tallas (variantes con sus fotos, el encuadre 3:4, la galería, frente y espalda), un combo (sus piezas y su portada) y "Dónde se ve" (personalizar en Crear) | `pages/Tienda/admin/AdminProductoFormV2.jsx`, `AdminComboEditor`, `ThumbnailCropEditor`, `GenerarFrenteEspalda`, `PersonalizarEnCrear` | · |
| D2c | Crear: la lista de personalizables, su ficha (colores, diseño con vistas y zonas, plantillas, dónde se ve) y los packs (lista, formulario y "Sugerir combos") | `pages/admin/AdminPrendasCrear.jsx`, `prendasCrear/PersonalizacionPrenda.jsx`, `ZonaEditor.jsx`, `PlantillasDeLaFicha.jsx`, `AdminCombosCrear.jsx` | · |
| D2d | Blueprints (una lista más, sobre la plantilla) y decidir qué pasa con las herramientas de una vez y lo viejo (abajo) | `pages/admin/AdminBlueprints.jsx`, `plantillasYoryo/ImportarPlantillasYoryo.jsx` | · |

**Por decidir (D2d)**
- **La personalización de antes no se rehace en el kit**: `AdminCustomizationViewsEditor`,
  `YoryoPersonalizado`, `AdminViewEditor` + `PrintAreasEditor` + `ShapeSelector`
  (y `ShapeCreator`, que ya no se importa en ningún lado) solo salen con el
  interruptor `personalizableViejo` y en `/editor/:id`. La tienda no los usa
  desde el 2026-10-20. Propuesta: dejarlos fuera del kit y, cuando no quede
  ningún producto con esa personalización (el aviso de D2a lo dice), pasarlos
  a [ELIMINAR.md](ELIMINAR.md).
- **Plantillas de cuadros** (`/admin/plantillas-yoryo`) son siete pasos de
  una sola vez (crear los productos de Yoryo, sus plantillas, la billetera,
  las cómodas de Daida…). Propuesta: una página del kit con los pasos en
  sellos y su estado, sin cambiar lo que hace cada paso.

### D2a: lo que hay

| Escritorio | Celular |
|---|---|
| ![Inventario en escritorio: el aviso de agotados, los filtros que bajan de línea y el stock que se cambia ahí](admin-inventario-escritorio.webp) | ![Productos en el celular: las pestañas, el borrador sin terminar y el aviso de la personalización de antes](admin-productos-celular.webp) |

| Página | Componente | Archivo | Qué tiene |
|---|---|---|---|
| Productos | `PaginaProductos` | `paginas/admin/Productos.jsx` | Pestañas Tienda · N, Personalizables · N, Packs de Crear · N (lo que ponga D2c; hoy, un aviso) y Todos. En Tienda: los borradores sin terminar de este aparato (Continuar · Descartar), el aviso de la personalización de antes (con la lista y "Quitarla"), Visibles · Ocultos · Piezas de combo · Todos con su cuenta, buscar (nombre, categoría o precio), filtrar por categoría y marca, ordenar por nombre, precio o stock; en cada fila, Destacado, Combo, Pieza de combo, Personalizable; mostrar u ocultar con un toque (al momento, y vuelve si falla); menú Editar · Mostrar/Ocultar · Duplicar · Archivar; casillas con Mostrar · Ocultar · CSV · Archivar; "Exportar CSV"; "Nuevo producto" y "Crear otro" (un personalizable o un pack). Todos: qué es cada uno (Pack de Crear, En Crear, Borrador, Reemplazado…) |
| Inventario | `PaginaInventario` | `paginas/admin/Productos.jsx` | Aviso de agotados con "Verlos"; buscar por nombre o SKU; filtros de stock (agotados, últimas, disponibles), categoría, colección, marca y tipo; el estado con su color; el stock con − / + que se guarda solo (un segundo después), con guardando, guardado o Reintentar. La fila no se mueve al guardar (el orden y el filtro usan el stock con que llegó) |
| Datos para recomendar | `PaginaRecomendar` | `paginas/admin/Productos.jsx` | Faltan datos · Todos · De un equipo · No para niños con su cuenta; para quién y la edad con un toque (`ElegirUno`: lo deducido punteado; tocar lo guardado lo quita); el equipo con sugerencias y "Usar"; "Aceptar sugerencias" y "Marcar los N como…" |

Piezas nuevas: `NumeroEnLinea` y `tarjeta: 'control'` en `TablaAdmin`
(lo que se toca va debajo de la tarjeta, nunca dentro de su botón) en
`piezas/admin/Datos.jsx`; `ElegirUno` en `piezas/admin/Formularios.jsx`.
Adaptadores: `productoAdminDesde` ahora trae stock, SKU, categorías,
colecciones, tipo, si es combo y sus piezas, lo de Crear (personalizable,
tal cual, en la tienda, pack, reemplazado), la personalización de antes y
los datos para recomendar, con la foto de la lista como AdminProductos;
`esDeLaTienda`, `piezasDeCombos`, `etiquetasDeProducto`,
`rutaAdminDeProducto` y `estadoDeStock` (con pruebas). Los filtros
(`BarraFiltros`) bajan de línea cuando no entran (Inventario tiene cinco).

### Diferencias a propósito (D2a)

- **Sin el cambio tarjetas / tabla**: la misma lista es tabla o tarjetas
  según el ancho (antes se elegía y se guardaba en el aparato).
- **Todo lo que pregunta usa `Confirmar`** (antes `window.confirm` en
  mostrar, ocultar y archivar varios, descartar un borrador y la
  personalización de antes) y los errores salen en toasts (antes `alert`
  en el inventario).
- **Inventario no lista los archivados** (antes sí, por no filtrar
  `deleted`), suma el filtro por stock y −/+ junto al número.
- Duplicar deja la copia en la lista (oculta) en vez de abrir su ficha a
  la fuerza; el conector decide si la abre.
- "Crear productos de referencia" no vuelve: no tenía botón.

### Qué se probó (2026-11-02, demo en localhost, escritorio y 375 px)

- Productos: las cuatro pestañas con su cuenta; ocultar con un toque
  cambia las cuentas (Visibles 31 → 30, Ocultos 4 → 5) y avisa; elegir dos
  y archivarlos con la pregunta; Todos muestra qué es cada uno; el aviso
  de la personalización de antes cuenta 2. En el celular, el botón de
  visible quedaba dentro del botón de la tarjeta (y se salía): ahora va
  abajo; los chips de estado no se parten.
- Inventario: − / + guarda solo y el estado pasa de Agotado a Últimas
  unidades; con "Guardar y subir fallan", Reintentar; reintentar sin la
  falla guarda. Dos toques rápidos en + contaban uno: arreglado.
- Recomendar: lo deducido sale punteado y tocarlo lo guarda; "Aceptar
  sugerencias" ya no se sale de la fila en el celular.
- Sin errores en la consola; nada se sale del ancho a 375 px.

### Cómo se une D2a (cuando D2 esté entero)

| Página | Lee | Escribe |
|---|---|---|
| Productos | `getProducts([], null, null, { includeHidden: true })` (`['admin-products']`), `getCategories`, `getBrands`; los borradores de `localStorage.wala_drafts` | Mostrar/ocultar: `updateProduct(id, { ...producto, visible })` y, si estaba `deleted`, `updateProductField(id, { visible: true, deleted: false })` (el arreglo anti-zombi de AdminProductos); archivar: `deleteProduct` (uno por uno, contando fallas); duplicar: `createProduct({ ...sin id ni createdAt, name: 'X (Copia)', visible: false })`; CSV: `exportProducts(productos, categorias, ids)`; la personalización de antes: `quitarPersonalizacionVieja` uno por uno; descartar un borrador: borra sus fotos de Storage **solo si nunca se publicó** (la regla P0 de AdminProductos) e invalida `admin-products`, `products`, `featured-products`, `collection-products` |
| Inventario | `getProducts(… includeHidden)` sin los `deleted`, y las seis listas de filtros | `updateProductField(id, { inStock })` y `logInventoryChange(id, nombre, antes, ahora, email)` |
| Recomendar | `getProducts(… includeHidden)`, `getCategories`; `sugerenciaDe` con `publicoDe`, `edadMinimaDe` y `equipoDe` de `utils/giftRecommender.mjs`; los equipos de sus SINONIMOS | `updateDocument('productos_wala', id, campos)` (null borra el campo); en lote, de a 20; invalida `['products']` y `['gift-catalog-dicts']` |

## Cómo se une un apartado (la misma lógica que clientes)

1. El apartado está **completo en el kit**: todas sus páginas en el Panel de
   prueba, con sus estados, en celular y escritorio, y su sección en esta
   ficha (qué pieza va en cada parte, de dónde salen los datos).
2. Un **conector por página** en `src/components/panel/` (`CategoriasDelPanel.jsx`…):
   lee con los mismos servicios y React Query de hoy (mismas `queryKey` e
   invalidaciones, también las de la tienda como `['categories']`) y le pasa
   datos y acciones a la página del kit. El kit no cambia por la migración.
3. **Interruptor** con `useLoViejo` (`configuracion/kit_interruptores`):
   `adminViejo` para el marco y uno por apartado (`adminCatalogoViejo`,
   `adminProductosViejo`…). La página vieja se renombra `…Viejo.jsx` y sigue
   cargándose aparte.
4. **Se prueba** en localhost con los emuladores, con un admin de cada
   permiso, y se anota aquí "Qué se probó".
5. Lo viejo que queda sin uso va a [ELIMINAR.md](ELIMINAR.md).

### Comportamiento que no se puede perder (todo el admin)

- **Permisos** de `AdminLayout` / `AdminConfiguracion`: Super Admin,
  `manage_design`, `manage_products`, `manage_inventory`, `manage_clients`,
  `manage_landing_pages`; el grupo Catálogo aparece con cualquiera de
  productos, inventario o landing pages. `AdminRoute` decide la entrada.
- **Eliminar un producto es archivar** (soft-delete desde 2026-07-01).
- Las **invalidaciones** de React Query que refrescan la tienda.
- Las **direcciones viejas** que redirigen (dashboard, usuarios-app…).
- Las reglas de Firestore no se tocan en esta migración (solo con el ok del
  dueño; ver [MIGRACION.md](MIGRACION.md) y la memoria de reglas).

## Registro

| Fecha | Qué | Dónde |
|---|---|---|
| 2026-11-02 | Paso 0: el mapa del admin y este plan | `guia/ADMIN.md` |
| 2026-11-02 | D0 en el kit: marco, barra del celular, cabecera, sin permiso, inicio, tabla, filtros, estados, lo elegido, hoja de edición, bloques, campo de imagen y el menú con permisos (con pruebas); Categorías como primera página; vista **Admin** en `/componentes.html` | `piezas/admin/`, `paginas/admin/`, `adaptadoresAdmin.js`, `DemoAdmin.jsx` |
| 2026-11-02 | D1 en el kit: `PaginaListaAdmin` (Categorías pasó a ella), Colecciones, Atributos, Zonas de envío, Cliparts, Marcas con sus productos y Destacados; `ListaOrdenable`, `SelectorProductos`, `CargarMas`, `CampoDinero`, `CampoColor`; capturas en `guia/admin-*.webp` y el modo noche revisado | `paginas/admin/`, `piezas/admin/`, `adaptadoresAdmin.js` |
| 2026-11-02 | D2 dividido en tramos (a: lista, b: ficha, c: Crear, d: blueprints y lo viejo). D2a en el kit: `PaginaProductos`, `PaginaInventario`, `PaginaRecomendar`; `NumeroEnLinea`, `ElegirUno`, controles en las tarjetas de `TablaAdmin` | `paginas/admin/Productos.jsx`, `piezas/admin/`, `adaptadoresAdmin.js` |
