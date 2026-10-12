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
| `Enlace.jsx` | `Enlace`, `ProveedorEnlaces` | Enlace que usa el router de la app |
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

## Llevarlo a la tienda

La tienda todavía no usa el kit. Conviene migrar por partes, de lo más
simple a lo más conectado, comprobando cada paso:

1. Proveedores (`ProveedorEnlaces` + `ProveedorToasts`) y `Boton`.
2. Avisos, toasts y `HojaInferior` (reemplazan modales sueltos).
3. `TarjetaProducto` en las grillas (adaptando los campos del producto).
4. Carrito, checkout y Mis pedidos.
5. `Cabecera` y `BarraInferior` (alimentadas por AuthContext, CartContext y la
   configuración de Firestore).
