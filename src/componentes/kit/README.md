# Kit de componentes Walá

Piezas de interfaz reutilizables. Se ven todas juntas en `/componentes.html`
(`npm run dev` → http://localhost:3000/componentes.html).

Todo se importa desde un solo lugar:

```jsx
import { Boton, TarjetaProducto, Cabecera, useToast } from '../componentes/kit';
```

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
| `Etiquetas.jsx` | `Etiqueta`, `Chip`, `CostoMonedas`, `GananciaMonedas`, `SaldoMonedas`, `Contador` | Badges, filtros y monedas |
| `Formulario.jsx` | `Campo`, `Buscador`, `SelectorTalla`, `SelectorColor`, `Cantidad`, `Interruptor` | Formularios, búsqueda (atajo "/") y variantes de producto |
| `TarjetaProducto.jsx` | `TarjetaProducto`, `TarjetaProductoEsqueleto`, `soles` | Tarjeta de la tienda (fotos con fondo blanco, alturas parejas) |
| `Navegacion.jsx` | `Cabecera`, `BarraInferior`, `Pestanas`, `Logo` | Navegación |
| `Desplegable.jsx` | `Desplegable` | Base de todos los menús: hover en escritorio, hoja/globo en celular |
| `MenusCabecera.jsx` | `MenuTienda`, `AyudaMonedas`, `MenuCuenta`, `VistaFavoritos`, `VistaCarrito` | Contenido de los menús de la cabecera |
| `AgregarRapido.jsx` | `AgregarRapido` | Elegir talla, color y cantidad antes de agregar al carrito |
| `Pedido.jsx` | `SeguimientoPedido`, `ItemCarrito`, `BarraEnvioGratis`, `ResumenPedido` | Carrito y Mis pedidos |
| `Feedback.jsx` | `Aviso`, `ProveedorToasts`, `useToast`, `useNotificaciones`, `ListaNotificaciones`, `EstadoVacio`, `HojaInferior` | Avisos, notificaciones y modales |
| `Enlace.jsx` | `Enlace`, `ProveedorEnlaces`, `tipoDeEnlace` | La única regla de enlaces: internos por el router, externos en otra pestaña, `#ancla` con scroll suave |
| `adaptadores.js` | `accionDeProducto`, `tarjetaDesdeProducto`, `opcionesDeProducto`, `rutaDeMarca`, `tarjetaDesdeMarca` | Traducen un producto de `productos_wala` o una marca de `tienda_brands` (Firestore) a props del kit |
| `Carrusel.jsx` | `Carrusel` | El único carrusel: deslizar nativo, flechas, puntos, autoplay con pausas |
| `Marquesina.jsx` | `Marquesina` | Cinta sin fin (logos, anuncios, burbujas) |
| `CuentaRegresiva.jsx` | `CuentaRegresiva` | Hasta una fecha o "siempre activa" por visitante; variantes bloques, texto y evento (dígitos grandes para fondos oscuros) |
| `Acordeon.jsx` | `Acordeon` | Preguntas frecuentes y detalles plegables |
| `Seccion.jsx` | `BloqueSeccion`, `TituloSeccion`, `tituloDesdeAjustes` | Relleno, fondo y título iguales en todas las secciones |
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

Props de página por sección con `propsPara(sec)`: `{ cargando, hayMas,
onCargarMas, cargandoMas }` en grillas, `{ grupos, seleccion, onFiltrar,
busqueda, onBuscar, precio, onPrecio }` en el catálogo, `{ activa,
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

La tienda todavía no usa el kit. Conviene migrar por partes, de lo más
simple a lo más conectado, comprobando cada paso:

1. Proveedores (`ProveedorEnlaces` + `ProveedorToasts`) y `Boton`.
2. Avisos, toasts y `HojaInferior` (reemplazan modales sueltos).
3. `TarjetaProducto` en las grillas (adaptando los campos del producto).
4. Carrito, checkout y Mis pedidos.
5. `Cabecera` y `BarraInferior` (alimentadas por AuthContext, CartContext y la
   configuración de Firestore).

## Editor del builder (`editor/`)

Reemplaza a VisualEditorPanel + EditableSection + ModuleInserter. Cada tipo
de sección describe sus campos una sola vez en `editor/esquemas.js` (mismos
nombres que guarda Firestore y que escribe el editor de hoy) y
`FormularioSeccion` los dibuja en tres pestañas: Contenido, Diseño y Fondo y
espacio. Se ve en `/componentes.html#editor`.

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
