# Buscar: el buscador de la cabecera y la página `/buscar`

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba**:

- **Panel de sugerencias:** toca el buscador de la cabecera. Vacío muestra lo
  que buscaste antes; al escribir (desde 2 letras) sugiere productos, marcas y
  categorías. En escritorio se abre debajo del campo; en el celular, en una
  hoja con su propio campo. Enter o "Ver todos los resultados" lleva a la
  página.
- **Página:** **Buscar** en "Página", o Enter en la cabecera. Buscar "casaca",
  ordenar, filtrar, "Ver más productos" (de a 24), "zzz" (sin resultados) y una
  marca sugerida en el panel (búsqueda acotada a esa marca).

| Panel (escritorio) | Panel (celular) |
|---|---|
| ![Panel de sugerencias debajo del buscador](buscar-panel.webp) | ![Hoja de búsqueda en el celular](buscar-hoja.webp) |

| Página (escritorio) | Página (celular) |
|---|---|
| ![Página de búsqueda en escritorio con cada parte marcada](buscar-escritorio.webp) | ![Página de búsqueda en el celular con cada parte marcada](buscar-celular.webp) |

Revisado el 2026-10-13 contra wala.pe/buscar, `src/pages/SearchPage.jsx` y
`src/components/common/HeaderSearch/HeaderSearch.jsx`. Datos del ejemplo: los
35 productos de `demo/tienda.json` (ver TIENDA.md), buscados por nombre,
categoría o marca y sin tildes, como `services/search.js`.

## Partes

| Parte | Componente | Piezas que usa | Diseño en | Datos (en la tienda) |
|---|---|---|---|---|
| Buscador de la cabecera (M4) | `Cabecera` con `buscarSugerencias` | `Buscador`, `PanelBusqueda`, `HojaInferior` (celular), `useBusquedasRecientes` | `Navegacion.module.css` (`.panelBusqueda`), `piezas/PanelBusqueda.module.css` | `getSearchSuggestions` → `sugerenciasDesdeBusqueda` |
| P4 Página | `PaginaBusqueda` | `TituloSeccion`, `Aviso` (búsqueda en una marca), `Buscador` (`grande`, `boton`), `CatalogoConFiltros`, `EstadoVacio` | `paginas/Paginas.module.css` (`.busquedaCabeza`) | ver abajo |
| Resultados | `CatalogoConFiltros` (el mismo de /tienda) | `Selector` ("Ordenar por"), `Acordeon`, `OpcionesFiltro`, `GrillaProductos`, `TarjetaProducto` | `SeccionesExtra.module.css` (`.catalogo…`, `.catalogoOrden`) | resultados ordenados y sus filtros |

### Lo que hace el panel

- **Vacío:** "Buscaste hace poco" con las últimas 6 búsquedas como chips (en
  este navegador, misma clave `wala_busquedas_recientes` que la tienda) y
  "Borrar".
- **Escribiendo:** productos con foto y precio (`FotoProducto`), y a la derecha
  las marcas (con su sello) y categorías de esos productos con su cuenta.
  Elegir una marca busca solo en ella (`/buscar?q=…&brand=…`); una categoría
  lleva a `/tienda?categoria=…`.
- **Siempre:** "Ver todos los resultados de «…»" con el total.
- Cierra al tocar afuera o con Esc; en el celular, como cualquier hoja
  (arrastrar, tocar afuera, botón atrás).

### Lo que hace la página

- Título, "Resultados para «…»" y un buscador grande con su botón.
- Acotada a una marca (`?brand=`): "Buscando solo en …" con "Buscar en todo el
  catálogo".
- Los resultados en el catálogo de /tienda: "N resultados" (con "+" si hay más
  por cargar), "Ordenar por" (más nuevos, precio, nombre), filtros con
  **Modalidad** (personalizado / en stock) primero, y los grupos de la tienda
  solo con lo que hay en los resultados.
- Sin resultados ni filtros: Kapi triste y "Prueba con otra palabra…". Con
  filtros, el catálogo sigue a la vista para poder quitarlos.

## Para cambiar el diseño rápido: qué se repite

| Pieza | Aparece en | Archivo |
|---|---|---|
| `CatalogoConFiltros` | la búsqueda y /tienda | `SeccionesExtra.module.css` |
| `Buscador` | cabecera, página de búsqueda (`grande`), catálogo de una marca | `Formulario.module.css` (`.buscador`, `.buscadorGrande`) |
| `Selector` | "Ordenar por" (sirve para cualquier lista de opciones) | `Formulario.module.css` (`.selector`) |
| `HojaInferior` | panel en el celular, filtros, menús | `Feedback.module.css` |
| `FotoProducto` | fotos del panel (y miniaturas del carrito, menús…) | `piezas/FotoProducto.module.css` |
| `LogoMarca` (`sello`) | marcas del panel, menú Marcas, tarjetas | `piezas/LogoMarca.module.css` |

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

Página propia: paso 6 de [MIGRACION.md](MIGRACION.md); el panel va con la
cabecera (paso 7). Mantener al día si cambia un componente o su forma de
recibir datos.

### Reemplazos

| Parte | Hoy en la tienda | Pasa a (kit) |
|---|---|---|
| Panel | `components/common/HeaderSearch/HeaderSearch.jsx` (lupa + portal) | `Cabecera` con `buscarSugerencias` (o `PanelBusqueda` suelto debajo del buscador actual) |
| Página | `pages/SearchPage.jsx` | `PaginaBusqueda` |
| Barra de resultados | `.barra` con el `<select>` (~304-335) | la barra de `CatalogoConFiltros` con `orden` |
| Filtros | `SidebarCatalogLayout` + `gruposExtra` "Modalidad" (~203-236) | `CatalogoConFiltros` con `grupoModalidad` + `gruposDeCatalogo` |
| Vacío | `.vacio` (~349-354) | `EstadoVacio` |

### De dónde sale cada dato

| Prop del kit | En la tienda |
|---|---|
| `buscarSugerencias(texto)` | `getSearchSuggestions(texto)` y `sugerenciasDesdeBusqueda(r, { marcas: brandsData, categorias: categoriesData, termino: texto })` (queries `brands` y `categories`, ya en caché) |
| `onBuscar(q)` (cabecera) | `navigate('/buscar?q=…')` + `trackSearchQuery(q, user)`; desde una página de marca, con `&brand=brandActual.id` |
| `termino`, `marcaFiltro` | `useSearchParams`: `q` y `brand` (nombre con `getBrand`) |
| `productos` | `searchProductsFirestore({ term, cursor, pageSize: 24 })` acumulados, sin `visible === false`, acotados a la marca si hay, y `ordenarProductos(lista, orden)` |
| `hayMas`, `onCargarMas`, `cargandoMas` | el cursor (`hasMore`, `loadMore`, `loading`) |
| `grupos` | `[grupoModalidad(resultados), ...gruposDeCatalogo({ …listas, productos: resultados, marcaActual: brand })]` (las listas, como en TIENDA.md) |
| `seleccion`, `onFiltrar` | estado de la página; filtra en el navegador (`filtrarAqui`) |
| `orden`, `onOrden`, `ordenes` | estado de la página; `ORDENES_BUSQUEDA` |
| `textos` | `storeConfig/homePage.searchPage` (los edita el admin: título, subtítulo, marcador, botón, vacíos) |
| `catalogo` | `marcas`, `categorias` y `marcaActual: brand` |

### Comportamiento que no se puede perder

- **Respuestas viejas:** la página ignora las que llegan tarde de un término
  anterior (`reqRef`); el panel ya descarta las que llegan después de cerrar.
- **Modo edición:** el bloque de textos es una `EditableSection`
  (`sectionId="searchPage"`) en el editor visual.
- **Analítica:** `trackSearchQuery` al buscar.
- **Búsqueda en una marca:** se conserva `brand` al volver a buscar.
- **Traducción:** textos con `<T>`; los nombres de marca no se traducen.

### Diferencias a propósito (no "corregirlas" al migrar)

- El panel se abre debajo del campo de la cabecera (hoy la cabecera tiene una
  lupa que abre un panel aparte); en el celular, hoja que sube (hoy, pantalla
  completa).
- Productos con foto y precio en el panel (hoy solo el nombre).
- Recientes como chips; marcas con su sello.
- "Ordenar por" con el selector de Walá; en el celular comparte fila con
  "Filtros".
- Filtros como chips con su cuenta, igual que /tienda (hoy listas de texto).
- En el celular el marcador es "¿Qué buscas?" (la frase con ejemplos se
  cortaba).
- Sin resultados: Kapi triste (hoy solo texto).

### Qué le falta al kit antes de migrar

- Un `onIrA(url)` en `PanelBusqueda` si se quiere registrar en la analítica qué
  sugerencia se eligió (hoy los enlaces navegan solos).
- Traducción (`<T>`).

### Pasos (cada uno se verifica solo y se puede volver atrás)

1. `SearchPage`: cambiar la barra, los filtros y la grilla por
   `CatalogoConFiltros` (con `orden`, `unidad` y `grupoModalidad`) dejando la
   búsqueda, el cursor y los textos como están. Probar: término, orden, cada
   filtro, "Ver más", sin resultados, con marca y en el celular.
2. Cambiar el encabezado por el de `PaginaBusqueda` (o la página completa).
3. Con la cabecera (paso 7): pasarle `buscarSugerencias` y retirar
   `HeaderSearch`.

Para volver atrás: cada paso en su propio commit; `SearchPage` y
`HeaderSearch` no se borran hasta que lo nuevo lleve un tiempo en producción.
