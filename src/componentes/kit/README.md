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
| `adaptadores.js` | `accionDeProducto`, `tarjetaDesdeProducto`, `opcionesDeProducto` | Traducen un producto de `productos_wala` (Firestore) a props del kit |
| `Carrusel.jsx` | `Carrusel` | El único carrusel: deslizar nativo, flechas, puntos, autoplay con pausas |
| `Marquesina.jsx` | `Marquesina` | Cinta sin fin (logos, anuncios, burbujas) |
| `CuentaRegresiva.jsx` | `CuentaRegresiva` | Hasta una fecha o "siempre activa" por visitante |
| `Acordeon.jsx` | `Acordeon` | Preguntas frecuentes y detalles plegables |
| `Seccion.jsx` | `BloqueSeccion`, `TituloSeccion`, `tituloDesdeAjustes` | Relleno, fondo y título iguales en todas las secciones |
| `Secciones.jsx` | `BarraAnuncios`, `HeroCarrusel`, `InsigniasConfianza`, `CarruselProductos`, `OfertaRelampago`, `Testimonios`, `PreguntasFrecuentes`, `MarcasMarquesina`, `GrillaCategorias`, `RenderSecciones`, `REGISTRO_SECCIONES` | Secciones del builder; reciben el mismo `settings` que guarda Firestore |
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
  onAgregar={(producto) => () => …}
  respaldo={(sec) => renderSectionViejo(sec)} // tipos que el kit aún no tiene
/>
```

Ya cubiertos: `announcement_bar`, `hero_carousel`, `trust_badges`,
`featured_carousel`, `new_arrivals_carousel`, `sale_carousel`,
`category_carousel`, `collection_carousel`, `flash_sales`, `testimonials`,
`faq_accordion`, `marquee`, `category_grid`. El resto sigue con el switch de
`TiendaPage.jsx` mediante `respaldo`.

## Llevarlo a la tienda

La tienda todavía no usa el kit. Conviene migrar por partes, de lo más
simple a lo más conectado, comprobando cada paso:

1. Proveedores (`ProveedorEnlaces` + `ProveedorToasts`) y `Boton`.
2. Avisos, toasts y `HojaInferior` (reemplazan modales sueltos).
3. `TarjetaProducto` en las grillas (adaptando los campos del producto).
4. Carrito, checkout y Mis pedidos.
5. `Cabecera` y `BarraInferior` (alimentadas por AuthContext, CartContext y la
   configuración de Firestore).
