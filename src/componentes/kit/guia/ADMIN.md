# Panel administrativo (`/admin`): el kit del admin (en marcha: D0 hecho en el kit)

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
| `CargarMas` | "Cargar más" / paginación con cuántos hay | · |
| `InsigniaEstado` | Un estado con texto y color desde un mapa (borrador, activo, cerrado, pagado, pendiente, anulado…) | kit (2026-11-02) |
| `FilaRecurso` | Foto, nombre, datos y acciones: categorías, colecciones, marcas, cliparts | · |
| `ListaOrdenable` | Reordenar arrastrando, con subir/bajar como alternativa (en vez del número `order` escrito a mano) | · |
| `SelectorProductos` | Buscar y elegir productos con su foto (reemplaza `components/admin/BuscadorProducto`) | · |

### Formularios

| Pieza | Qué hace | Estado |
|---|---|---|
| `HojaEdicion` | Crear/editar: panel lateral o pantalla completa en el celular; Guardar/Cancelar; aviso de cambios sin guardar; bloqueada mientras guarda | kit (2026-11-02) |
| `GrupoCampos` | Un bloque de campos con su título y ayuda (hoy 19 versiones de `fieldGroup`/`formSection`) | kit (2026-11-02) |
| `CampoImagen` | Soltar o elegir, recortar (`RecortarFoto`), avance de la subida, cambiar y quitar. La subida llega por props | kit (2026-11-02) |
| `CampoFechaHora` | `CampoFecha` + la hora (sorteos, ofertas, popups) | · |
| `CampoDinero`, `CampoPorcentaje` | Soles (o céntimos guardados), dólares, comisión | · |
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
| `PaginaListaAdmin` | `CabezaAdmin` + `BarraFiltros` + `TablaAdmin` + `HojaEdicion` | Categorías, Colecciones, Atributos, Marcas, Cliparts, Envíos, Recompensas, Misiones, Retos, Popups, Sorteos, Enlaces, Landing pages, Temas, Referidos, Libro de reclamaciones… |
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
| D1 | Catálogo base | `categorias` (en el kit desde el 2026-11-02, como prueba de D0), `colecciones`, `atributos-catalogo`, `marcas` (+ productos de la marca), `envios`, `cliparts`, `destacados` | Lista | · | · |
| D2 | Productos | `productos` (lista, packs), `inventario`, `productos/:id` (la ficha), `plantillas-yoryo`, personalizables y combos de Crear, `blueprints`, `publico-productos` | Lista + herramientas propias | · | · |
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
- Sin errores en la consola. **No se pudo mirar en pantalla**: el panel del
  navegador estaba oculto (no dibujaba), así que lo visual de la hoja, el
  menú en el celular y el modo noche falta revisarlo a ojo; tampoco hay
  capturas en `guia/` todavía.

### Pendiente de D0

- Las capturas numeradas (`admin-*.webp`) y revisar a ojo el modo noche.
- Con algo elegido en el celular, `AccionesLote` y el botón de la página
  quedan uno encima del otro: decidir cuál se esconde cuando hay selección
  (ninguna página de D0 usa casillas todavía).
- `PaginaListaAdmin` (la plantilla) se saca cuando haya una segunda lista
  (Colecciones, D1): hoy Categorías arma las piezas a mano.
- Al unir: el inicio de hoy (`AdminDashboard.jsx`) trae además un editor
  viejo de secciones por zonas; ver si alguien lo usa antes de retirarlo.

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
