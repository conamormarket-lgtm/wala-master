# Kit de componentes Walá

Piezas de interfaz reutilizables. Se ven en `/componentes.html`
(`npm run dev` → http://localhost:3000/componentes.html), en tres vistas:

- **Piezas**: componentes sueltos (botones, etiquetas, íconos, formularios,
  tarjeta de producto, navegación, menús, avisos).
- **Secciones**: cada tipo del builder por separado, agrupado como en el
  catálogo del editor, con su `type` y sus variantes (`DemoSecciones.jsx`).
- **Páginas**: la Tienda de prueba: inicio, tienda, minijuegos, búsqueda,
  carrito y Mi cuenta (sus 12 secciones) con el mismo marco, el editor del
  builder sobre el inicio (como admin) y "Ver componentes".

Todo se importa desde un solo lugar:

```jsx
import { Boton, TarjetaProducto, Cabecera, useToast } from '../componentes/kit';
```

## La cadena: piezas → secciones → páginas

Todo se arma con lo del nivel de abajo; nada se dibuja dos veces.

1. **Piezas**: `Boton`, `Chip`, `Etiqueta(Colgante)`, `IconoWala`, `Carrusel`,
   `TarjetaProducto`, y las de `piezas/`: `TarjetaCategoria` (cuadro · círculo
   · burbuja), `TarjetaTestimonio`, `TarjetaMarca`, `LogoMarca`,
   `TarjetaDestacado`, `Beneficio` (píldora · fila), `BarraProgreso` /
   `StockBajo`, `TarjetaAyuda` (Kapi asomado), `FotoProducto`, `Avatar`,
   `OpcionesFiltro`, `TarjetaJuego`, y las del marco (`piezas/Flotantes.jsx`, `piezas/Marco.jsx`).
2. **Secciones** (`Secciones*.jsx`): cada tipo del builder, hecho solo con
   piezas. En `/componentes.html` (vista Secciones) cada ficha dice con qué
   piezas está hecha.
3. **Páginas** (`paginas/Paginas.jsx`): `MarcoTienda` (cabecera, pie y barra
   inferior), `PaginaTienda` (marco + secciones del builder), `PaginaCarrito`
   (piezas del pedido + la sección de carrusel para recomendar),
   `PaginaPedidos`, `PaginaMinijuegos` (Zona Arcade: `Encabezado` +
   `TarjetaJuego`) y `PaginaBusqueda` (el catálogo de /tienda con orden).
   La cuenta (`paginas/Cuenta.jsx`, `CuentaRecompensas.jsx`,
   `CuentaPersonalizacion.jsx`): `MarcoCuenta` (menú lateral o "← Mi cuenta")
   y sus páginas, armadas con las piezas de `piezas/Cuenta.jsx`,
   `Recompensas.jsx`, `Referidos.jsx`, `Creaciones.jsx`, `Regalos.jsx` y
   `TarjetaDireccion.jsx` (guía: `guia/CUENTA.md`). La encuesta
   (`paginas/Encuesta.jsx`): `PaginaEncuesta`, con `piezas/Encuesta.jsx` y
   el formulario de una persona de `piezas/FormularioPersona.jsx` (guía:
   `guia/ENCUESTA.md`).

Si una sección necesita algo nuevo (una tarjeta, un chip…), va primero como
pieza en `piezas/` y después se usa en la sección.

Lo pequeño también es una sola pieza; no se vuelve a dibujar a mano:

- **Foto de producto** (escenario `--escenario-foto` + `multiply`):
  `FotoProducto`. La usan las miniaturas del carrito, pedidos, toasts,
  notificaciones, menús, "Agregar rápido", las piezas de un combo,
  `TarjetaDestacado`, el polaroid de beneficios y las burbujas de categoría.
  Solo la foto grande de `TarjetaProducto` tiene la suya (dos fotos y
  barrido), con el mismo token.
- **Persona** (foto o iniciales): `Avatar`, con `iniciales()` para todo lo
  que muestre iniciales (marcas incluidas).
- **Logo de marca**: `LogoMarca` (sticker con nombre, o `variante="sello"`
  en la tarjeta de producto y el menú de marcas).
- **Moneda**: `Moneda` / `MONEDA` (`Etiquetas.jsx`).

Las piezas base (`FotoProducto`, `Avatar`, el sello) escriben sus reglas con
`:where()`: no pesan, y la clase de quien las usa (tamaño, radio, borde)
siempre gana.

`guia/` dice qué componente va en cada parte de cada página real, con
capturas numeradas y en qué archivo se cambia el diseño de cada parte
(empieza por `guia/README.md`). En `/componentes.html` → Páginas → Tienda de
prueba, **Ver componentes** muestra esos mismos números sobre la página.

## Reglas del kit

- **Los datos entran por props.** Ningún componente lee Firestore, AuthContext
  ni CartContext: la página se los pasa. Así se pueden probar solos y
  reutilizar en cualquier pantalla.
- **Mismos colores que la app.** Usan las variables de `src/styles/variables.css`
  y `src/theme/tokens.css`, con modo noche incluido.
- **Pensado para la app (Capacitor).** Todo funciona sin hover; los menús en
  celular abren como hoja inferior; el botón atrás de Android cierra la hoja.
- **Liviano.** Animaciones con `transform`/`opacity`; brillo solo al interactuar.
- **Se arma con sus propias piezas.** La `Cabecera` usa `Boton`, `Buscador`,
  `SaldoMonedas`, `Contador`, `Desplegable` y los menús; no repite estilos.

## Lenguaje de marca (`Marca.jsx`)

Lo que hace que una pieza se vea "de Walá" y no de cualquier plantilla. Sale
del logo (la W vive en una etiqueta de precio con su hilo; la tilde de la Á
también es una etiqueta) y de los banners de la tienda.

- **Etiqueta colgante** (`EtiquetaColgante`): descuentos, "Nuevo", "Tu
  diseño", antetítulos (`eyebrow` en el builder), "Universo Walá", "Compra
  verificada". Un poco inclinada; se mece al pasar el ratón por la tarjeta.
  Las `Etiqueta solida` ya salen así.
- **Letra del logo**: `--fuente-marca` (Montserrat 900, tracking -0.035em) en
  títulos, precios, nombres de marca y del editor. Poppins para el resto.
- **Sellos**: íconos blancos en un círculo con el degradado del logo
  (`--degradado-logo`), girados -8°. Nada de cuadritos lila.
- **Sello** (`Sello`): el ícono blanco en el círculo con el degradado, girado.
  Tonos `degradado` · `suave` · `oro` · `rosa` · `menta` · `bronce` · `plata`.
  Todos los íconos de la cuenta van así.
- **Garabatos** (`Garabatos`, `Destello`, `Corazon`, `Puntos`, `Trazo`):
  destellos ✦, corazones, puntos de medio tono y subrayado a mano para las
  palabras resaltadas. Siempre quietos.
- **Íconos de Walá** (`IconosWala.jsx`: `IconoWala`, `ICONOS_WALA`,
  `iconoDesde`): dibujados como Kapi (contorno violeta grueso, colores planos
  de la marca, brillo blanco) en un sticker redondo. Reemplazan a los emojis
  (cada celular los dibuja distinto) y a los íconos de línea en beneficios e
  íconos de confianza. Los emojis o nombres viejos guardados (🚚, truck…) se
  traducen solos; en el editor el campo "Ícono" es un selector visual.
- **Kapi** con voz propia: FAQ ("¿Te quedó otra duda?"), pie de página
  asomándose, vacíos del editor ("Esta página tiene hambre").
- **Noche violeta** (`--noche-wala: #14121c`), no gris carbón.

## Proveedores (una vez, arriba de todo)

```jsx
import { Link } from 'react-router-dom';
import { ProveedorEnlaces, ProveedorToasts } from '../componentes/kit';

<ProveedorEnlaces componente={Link}>   {/* los enlaces del kit usan el router */}
  <ProveedorToasts iniciales={notificaciones}>   {/* toasts + centro de notificaciones */}
    <App />
  </ProveedorToasts>
</ProveedorEnlaces>
```

## Qué hay

| Archivo | Componentes | Para qué |
|---|---|---|
| `Boton.jsx` | `Boton` | Botón violeta liso; variantes, tamaños, cargando, `brillo` para CTA de pago. Con `to` es un enlace; con `insignia` lleva un contador en la esquina |
| `Etiquetas.jsx` | `Etiqueta`, `Chip`, `Moneda`, `MONEDA`, `CostoMonedas`, `GananciaMonedas`, `SaldoMonedas` (sube de a una con cada moneda que aterriza), `Contador` | Badges, filtros y monedas |
| `Formulario.jsx` | `Campo` (con `opciones` es una `ListaOpciones`; `control` para otro control en la misma caja), `Buscador` (`grande`, `boton`), `Selector`, `SelectorTalla`, `SelectorColor`, `Cantidad`, `Interruptor`, `Casilla`, `CampoTelefono`, `CampoContrasena` (con el ojo que parpadea) | Formularios, búsqueda (atajo "/"), "Ordenar por" y variantes de producto |
| `ListaOpciones.jsx` | `ListaOpciones` | Lista desplegable de Walá: panel en escritorio, hoja en el celular, buscador, teclado, `creable` |
| `Fecha.jsx` | `CampoFecha`, `Calendario`, `fechaEnTexto` | Fechas con el calendario de Walá (años, meses, días; "No sé el año") |
| `PanelFlotante.jsx` | `PanelFlotante`, `enCelular` | Lo que se abre desde un campo: panel pegado (escritorio) u hoja (celular); como un `<select>`, se cierra con el scroll de afuera |
| `TarjetaProducto.jsx` | `TarjetaProducto`, `TarjetaProductoEsqueleto`, `soles` | Tarjeta de la tienda (fotos con fondo blanco, alturas parejas; corazón controlado con `deseado` + `onDeseo`) |
| `Navegacion.jsx` | `Cabecera`, `BarraInferior`, `Pestanas`, `Logo` | Navegación |
| `Desplegable.jsx` | `Desplegable` | Base de todos los menús: hover en escritorio, hoja/globo en celular |
| `MenusCabecera.jsx` | `MenuTienda`, `MenuMarcas`, `AyudaMonedas`, `MenuCuenta` (`lateral` + `activo`: el menú al costado de /cuenta), `VistaFavoritos`, `VistaCarrito` (filas que entran una tras otra y se levantan al pasar, `metaEnvio` con la `BarraEnvioGratis compacta`, total que corre) | Contenido de los menús de la cabecera |
| `AgregarRapido.jsx` | `AgregarRapido` | Elegir talla, color y cantidad antes de agregar al carrito |
| `Pedido.jsx` | `SeguimientoPedido` (`pasos`, `estado`, `deuda`, `anulado`, `urlDetalle`, `onPagar`), `ItemCarrito`, `BarraEnvioGratis`, `ResumenPedido`, `PASOS_PEDIDO`, `ETAPAS_PRODUCCION` | Carrito y Mis pedidos |
| `Feedback.jsx` | `Aviso`, `ProveedorToasts`, `useToast`, `useNotificaciones`, `ListaNotificaciones`, `EstadoVacio`, `HojaInferior` | Avisos, notificaciones y modales |
| `Enlace.jsx` | `Enlace`, `ProveedorEnlaces`, `tipoDeEnlace` | La única regla de enlaces: internos por el router, externos en otra pestaña, `#ancla` con scroll suave |
| `adaptadores.js` | `accionDeProducto`, `tarjetaDesdeProducto`, `opcionesDeProducto`, `rutaDeMarca`, `tarjetaDesdeMarca`, `testimonioDesdeAjuste`, `precioEfectivo`, `limitesDePrecio`, `esTemporada`, `gruposDeCatalogo`, `grillaDesdeConfiguracion`, `juegosDelArcade`, `kapiDesdePerfil`, `retoDesdePerfil`, `sugerenciasDesdeBusqueda`, `grupoModalidad`, `ORDENES_BUSQUEDA`, `ordenarProductos`, y de la cuenta: `perfilDesdeUsuario`, `direccionDesdeFirestore` / `direccionAFirestore`, `recompensaDesdeFirestore`, `cuponDesdeFirestore`, `misionDesdeServidor`, `creacionDesdeDiseno`, `personaDesdeRecipient` / `personaARecipient` (con el "Conjunto familia"), `encuestaDesdeConfig` (config de la encuesta → textos y conjuntos) | Traducen datos de Firestore a props del kit: un producto de `productos_wala`, una marca de `tienda_brands`, las listas de filtros del catálogo (categorías, colecciones, etiquetas, personajes, tipos), `storeConfig.layout` y el perfil del cliente (Zona Arcade, Kapi y su reto) |
| `Carrusel.jsx` | `Carrusel` | El único carrusel: deslizar nativo, flechas, puntos, autoplay con pausas |
| `Marquesina.jsx` | `Marquesina` | Cinta sin fin (logos, anuncios, burbujas) |
| `CuentaRegresiva.jsx` | `CuentaRegresiva` | Hasta una fecha o "siempre activa" por visitante; variantes bloques, texto y evento (dígitos grandes para fondos oscuros) |
| `Acordeon.jsx` | `Acordeon` | Plegables: preguntas frecuentes (variante de tarjetas) y grupos de filtros o detalles (`variante="lista"`); la respuesta puede ser texto o cualquier contenido |
| `Seccion.jsx` | `BloqueSeccion`, `TituloSeccion`, `tituloDesdeAjustes` | Relleno, fondo y título iguales en todas las secciones |
| `piezas/FotoProducto.jsx` | `FotoProducto` | Foto de producto sobre su escenario (`src`, `relleno`, `respaldo` sin foto, `children` encima) |
| `piezas/Avatar.jsx` | `Avatar`, `iniciales` | Foto o iniciales de una persona |
| `piezas/OpcionesFiltro.jsx` | `OpcionesFiltro` | Opciones de un filtro como chips con su cuenta; una a la vez y "Ver N más" |
| `piezas/PanelBusqueda.jsx` | `PanelBusqueda`, `useBusquedasRecientes`, `TextoResaltado`, `ChipsBusqueda`, `InvitacionBusqueda` | Sugerencias del buscador: recientes, productos con foto y precio, marcas y categorías, "Ver todos los resultados" |
| `piezas/Cuenta.jsx` | `CabezaCuenta`, `TarjetaCuenta`, `ListaDatos`, `Estadistica`, `AccesosCuenta`, `IdentidadCuenta`, `ListaEleccion` | Lo común de las páginas de la cuenta |
| `piezas/DetallePedido.jsx` | `LineaProduccion`, `PagosPedido`, `HojaPagarSaldo` | Detalle de una compra |
| `piezas/PedidosPorVerificar.jsx` | `PedidosPorVerificar` | Pedidos que coinciden con el documento: verificar el correo o vincular |
| `piezas/RecortarFoto.jsx` | `RecortarFoto` | Recortar una foto antes de subirla (arrastrar, zoom) |
| `piezas/TarjetaDireccion.jsx` | `TarjetaDireccion` | Una dirección guardada (principal, editar, eliminar con confirmación) |
| `piezas/Recompensas.jsx` | `TarjetaRecompensa`, `TarjetaCupon`, `TarjetaMision`, `NivelCuenta`, `NIVELES` | Catálogo, cupones, misiones y nivel por XP |
| `piezas/Referidos.jsx` | `FormaGanar`, `EnlaceInvitacion`, `FilaReferido`, `DetallePedidoReferido`, `RankingReferidos` | Mis referidos |
| `piezas/Creaciones.jsx` | `TarjetaCreacion` | Un diseño guardado (frente y espalda, renombrar, eliminar; también borradores) |
| `piezas/Regalos.jsx` | `IdeaRegalo`, `TarjetaPersonaRegalo`, `AvisoFestiva` (cuenta atrás), `HojaCalendario`, `AgendaFechas` ("Lo que se viene"), `faltanDias`, `textoFaltan`, `diaYMes` | Fechas importantes |
| `piezas/FormularioPersona.jsx` | `HojaPersona` (formulario de una persona en una hoja: foto, género, relación o fija, presupuesto, gustos, "Conjunto familia", fechas), `validarPersona`, `RELACIONES`, `GENEROS`, `PRESUPUESTOS` | Fechas importantes y la encuesta |
| `Cargando.jsx` | `PantallaCarga` (primera carga: la etiqueta se mece de su cordón), `Cargando` (la etiqueta a color), `CapaCargando` (esperar una acción: velo y tarjeta), `FRASES_CARGA` | Cargar (guía: `guia/CARGA.md`) |
| `Esqueletos.jsx` | `Hueso` (la pieza que brilla), `EsqueletoTexto`, `EsqueletoCabeza`, `EsqueletoProducto`, `EsqueletoFila`, `EsqueletoPedido`, `EsqueletoTarjeta`, `EsqueletoFormulario`, `EsqueletoSeccion` (una forma por tipo del builder, `FORMA_DE_SECCION`), `EsqueletoPagina` (por `forma`, con `modulo` en la cuenta, o por `secciones`), `MODULOS_ESQUELETO_CUENTA` | Mientras llegan los datos (guía: `guia/CARGA.md`; en Piezas: «Carga y esqueletos») |
| `piezas/DatosPersonales.jsx` | `CamposDatosPersonales` (nombre, país, documento, celular y cumpleaños), `validarPerfil`, `TIPOS_DOCUMENTO`, `NOMBRE_DOCUMENTO` | Mi perfil, Crear cuenta y Completar perfil |
| `piezas/Acceso.jsx` | `RequisitosContrasena` (reglas con barra de 5 tramos), `requisitosContrasena`, `contrasenaValida`, `BotonGoogle`, `SeparadorAcceso` | Login y registro |
| `paginas/Acceso.jsx` | `MarcoAcceso`, `PaginaLogin`, `PaginaRegistro`, `PaginaRecuperar`, `PaginaCompletarPerfil` | /login, /registro, /recuperar-contrasena, /completar-perfil (guía: `guia/ACCESO.md`) |
| `piezas/Encuesta.jsx` | `ProgresoEncuesta`, `ElegirVarios` (varias opciones en tarjetas con sello), `FichaPersonaEncuesta` | La encuesta |
| `paginas/Cuenta.jsx`, `CuentaPedidos.jsx`, `CuentaRecompensas.jsx`, `CuentaPersonalizacion.jsx` | `MarcoCuenta`, `PaginaCuentaInvitado`, `PaginaResumenCuenta`, `PaginaPerfil`, `PaginaPedidos`, `PaginaDetallePedido`, `PaginaDirecciones`, `PaginaAjustes`, `PaginaCatalogo`, `PaginaCupones`, `PaginaMisiones`, `PaginaReferidos`, `PaginaCreaciones`, `PaginaListaDeseos`, `PaginaFechas` (+ `validarPerfil`, `validarDireccion`) | Las páginas de /cuenta (guía: `guia/CUENTA.md`) |
| `paginas/Encuesta.jsx` | `PaginaEncuesta`, `GRUPOS_ENCUESTA`, `CONFIG_ENCUESTA` | /encuesta-suscripcion (guía: `guia/ENCUESTA.md`) |
| `piezas/VentanaKapi.jsx` | `VentanaKapi` | La ventana de Kapi: ánimo, felicidad, moneda del día, alimentar y el reto (hoja en el celular, centrada en escritorio) |
| `piezas/RetoSemanal.jsx` | `RetoSemanal` | El reto de la semana: premio, avance y envío de evidencia |
| `piezas/TarjetaJuego.jsx` | `TarjetaJuego` | Tarjeta de un minijuego: banner, estado, recompensa, racha, nota, botón y cuenta atrás (recibe datos; `juegosDelArcade` los arma) |
| `piezas/LogoMarca.jsx` | `LogoMarca` | Logo de una marca: `sticker` (con nombre) o `sello` (círculo chico girado) |
| `piezas/Flotantes.jsx` | `PilaFlotante`, `BotonWhatsApp`, `KapiFlotante`, `CARAS_KAPI`, `BurbujaRegalos`, `PildoraRecompensa` | Lo que flota sobre la página (sobre la barra inferior en el celular) |
| `piezas/Marco.jsx` | `AvisoSistema`, `BannerApp`, `BarraAdmin`, `PieLegal`, `AvisoIdioma`, `VentanaCampana`, `BotonTema` | Lo que rodea a las secciones: avisos arriba, barra de admin, pie legal, ventanas |
| `Secciones.jsx` | `BarraAnuncios`, `HeroCarrusel`, `InsigniasConfianza`, `CarruselProductos`, `OfertaRelampago`, `Testimonios`, `PreguntasFrecuentes`, `MarcasMarquesina`, `GrillaCategorias`, `RenderSecciones`, `REGISTRO_SECCIONES` | Secciones del builder; reciben el mismo `settings` que guarda Firestore |
| `SeccionesContenido.jsx` | `Encabezado`, `BloqueTexto`, `BloqueImagen`, `BloqueVideo`, `MosaicoBanners`, `FilaDestacados`, `videoIncrustado` | Secciones de contenido del builder (header, text, image, video, banner_grid, bestsellers_row) |
| `SeccionesExtra.jsx` | `BannerPrincipal`, `ListaBeneficios`, `Ubicacion`, `NavCategorias`, `GrillaProductos`, `CatalogoConFiltros`, `PiePagina` | Resto de secciones (hero_banner, feature_list, map_location, categories_nav, featured_products, product_grid, sidebar_catalog, footer_columns) |
| `editor/` | `PanelEditor`, `useBorrador`, `SeccionEditable`, `InsertarAqui`, `FormularioSeccion`, `ESQUEMAS` | Editor del builder armado por esquemas (ver abajo) |
| `Efectos.jsx` | `Revelar`, `useContador`, `Estallido`, `useBloquearScroll`, `useCerrarConAtras`, `esApp` | Utilidades de animación y de app |

## Ejemplos rápidos

```jsx
// Toast (se guarda también en el centro de notificaciones)
const toast = useToast();
toast({ titulo: 'Agregado al carrito', texto: 'Polera · M', imagen: foto, accion: 'Ver' });

// Un menú propio con el mismo comportamiento que los de la cabecera
<Desplegable
  titulo="Filtros"
  disparador={(props) => <button {...props}>Filtrar</button>}
>
  {(cerrar) => <MisFiltros onAplicar={cerrar} />}
</Desplegable>

// Tarjeta desde un producto de la tienda (campos que usa hoy ProductCard.jsx;
// la miniatura real sale de useProductThumbnailVariant / toThumbnailImageUrl).
<TarjetaProducto
  url={`/producto/${product.id}`}
  imagen={thumbnailImageUrl || product.mainImage || product.images?.[0]}
  nombre={product.name}
  precio={product.salePrice || product.price}
  precioAntes={product.salePrice ? product.price : undefined}
  personalizable={product.customizable}
  agotado={product.inStock === false}
  onAgregar={() => agregarAlCarrito(product)}
/>
// puntuacion / resenas: pasarlas solo cuando haya reseñas reales.
```

## Productos que no son ropa

El botón de la tarjeta depende del producto (`accionDeProducto`, misma regla
que `productNeedsVariantSelection`):

- **Agregar**: sin opciones (taza, llavero, producto con una sola variante).
- **Elegir**: varias variantes (color o estilo), opciones con su etiqueta
  (Talla, Medida, Número…) o combo → abre `AgregarRapido`.
- **Diseñar**: prenda base del estudio Crear (`esPrendaBase`).

```jsx
<TarjetaProducto {...tarjetaDesdeProducto(producto)} onAgregar={() => …} />
<AgregarRapido abierto {...opcionesDeProducto(producto, { subproductos })} onConfirmar={…} />
```

## Datos de ejemplo

`src/componentes/demo/marcas.json` es una copia de las marcas reales
(`tienda_brands`, leída con la API pública, sin permisos de admin). Si se
agregan marcas en la tienda, se puede volver a copiar; la demo no lee
Firestore.

## Builder

Una página del builder (`pages/{pageId}` en Firestore) se dibuja así:

```jsx
<RenderSecciones
  secciones={config.sections}               // [{ id, type, order, settings }]
  productosPara={(sec) => productosDe(sec)}  // productos_wala de esa sección
  categoriasPara={(sec) => categoriasDe(sec)}
  marcasPara={() => marcas}                 // tienda_brands (getBrands), para banner_grid
  onAgregar={(producto) => () => …}
  respaldo={(sec) => renderSectionViejo(sec)} // tipos que el kit aún no tiene
/>
```

Ya cubiertos: todos los tipos del builder menos `conversion_fold` y
`landing_payment`, que son de la landing del reloj (cacherito) y siguen con su
componente vía `respaldo`.

Con `PaginaTienda` no hace falta repartir los productos a mano: recibe
`productos = { destacados, nuevos, ofertas, porCategoria, porColeccion,
todos }` y cada sección toma la suya (`productosDeSeccion`, la misma regla
que TiendaPage), más `categorias`, `marcas` y `marcaActual`. Con `marcas` y
`categorias` las tarjetas muestran el sello de la marca y la categoría
(`catalogo` en `RenderSecciones` / `tarjetaDesdeProducto`).

Props de página por sección con `propsPara(sec)`: `{ cargando, hayMas,
onCargarMas, cargandoMas, columnas, segundaFoto }` en grillas
(`grillaDesdeConfiguracion(storeConfig.layout)`), `{ grupos, seleccion,
onFiltrar, filtrarAqui, conBuscador, busqueda, onBuscar, precio, onPrecio,
limitesPrecio, total }` en el catálogo (`gruposDeCatalogo` arma los grupos), `{ activa,
onSeleccionar }` en categories_nav y `{ onClicBoton }` en hero_banner.

Las secciones se acomodan al ancho de su contenedor (container queries en
`BloqueSeccion` y en `Carrusel`), no al de la ventana: la vista de celular del
editor se ve igual que en un celular.

Notas de las secciones de contenido:

- Los colores que el builder guardaba por defecto (`#000000`, `#333333`,
  `#666666`) se tratan como "sin color": manda el tema y se leen en modo noche.
- El botón opcional (`buttonText` + `buttonLink`) es el `Boton` violeta liso;
  `buttonBgColor` / `buttonTextColor` siguen mandando si el editor los fijó.
- Los videos .mp4 no se descargan hasta acercarse, se pausan fuera de pantalla
  y con "reducir movimiento" no arrancan solos (muestran controles).
- `banner_grid` con marcas usa el `Carrusel` (una fila deslizable con puntos)
  en vez del mosaico paginado de dos filas.
- Las excepciones de una landing concreta (p. ej. `isKcheroLanding` en
  TiendaPage) se filtran antes de pasar `secciones`, no dentro del kit.
- El kit no traduce: TextoSeccion de la tienda envuelve los textos en `<T>`.
  Al migrar, hará falta un proveedor de traducción o pasar los textos ya
  traducidos.

## Llevarlo a la tienda

Se migra por partes, de lo más simple a lo más conectado, comprobando cada
paso. En la tienda, importar **directo del archivo**
(`componentes/kit/Boton`), no de `kit/index.js`: el índice arrastraría el CSS
de todo el kit al paquete principal.

Qué usa ya la tienda y el orden de los pasos: [`guia/MIGRACION.md`](guia/MIGRACION.md)
(el único plan; cada ficha de `guia/` agrega lo propio de su página).

## Editor del builder (`editor/`)

Reemplaza a VisualEditorPanel + EditableSection + ModuleInserter. Cada tipo
de sección describe sus campos una sola vez en `editor/esquemas.js` (mismos
nombres que guarda Firestore y que escribe el editor de hoy) y
`FormularioSeccion` los dibuja en tres pestañas: Contenido, Diseño y Fondo y
espacio. Se ve en `/componentes.html#tienda` viendo como Admin → "Editar esta
página".

```jsx
const borrador = useBorrador(seccionesDeFirestore);   // deshacer/rehacer y "sin publicar"

<RenderSecciones
  secciones={borrador.secciones}
  envolver={(sec, nodo, i) => (
    <>
      <InsertarAqui indice={i} onInsertar={setInsertarEn} />
      <SeccionEditable id={sec.id} tipo={sec.type} activa={sel === sec.id} onEditar={setSel}>{nodo}</SeccionEditable>
    </>
  )}
  …
/>
<PanelEditor
  secciones={borrador.secciones} onCambiar={borrador.cambiar}
  seleccionada={sel} onSeleccionar={setSel} insertarEn={insertarEn} onInsertarEn={setInsertarEn}
  crearAjustes={getDefaultSettings}                       // de services/storefront.js
  fuentes={{ colecciones, categorias, marcas, subirArchivo: uploadFile }}
  extensiones={{ burbujasDeMarca: ({ ajustes }) => <CategoryNavEditor brandId={ajustes.brandId} /> }}
  onGuardar={publicar} guardando={…} sinGuardar={borrador.sinGuardar}
  onDeshacer={borrador.deshacer} onRehacer={borrador.rehacer}
  puedeDeshacer={borrador.puedeDeshacer} puedeRehacer={borrador.puedeRehacer}
  vista={vista} onVista={setVista} lado={lado} onLado={setLado} onCerrar={salir}
  ajustesPagina={<TemaYVisibilidad />}
/>
```

- Escritorio: panel fijo a un lado (se cambia de lado). Celular/app: hoja
  inferior que se agranda; la página queda visible arriba.
- Colores con opción "del tema" (guarda `''`): el modo noche sigue funcionando.
- Fechas en hora local (el editor de hoy mostraba UTC, 5 h corrida).
- Eliminar pide confirmación en el mismo botón (sin `window.confirm`); publicar
  no usa `alert` (la página decide: toast).
- Ctrl+Z / Ctrl+Shift+Z fuera de los campos y Ctrl+S para publicar.
- Arrastrar filas para reordenar (o flechas), duplicar secciones y elementos.
- `feature_list` por fin se puede editar completo (antes solo el título).
