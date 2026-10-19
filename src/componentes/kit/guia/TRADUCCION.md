# Traducción

Cómo verla en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **Ver en inglés**. También se activa con
"Switch to English" del aviso de idioma (**Mostrar también** → el aviso de
idioma).

En la demo, un traductor **de prueba** cambia palabras de un diccionario chico
(`demo/traduccionDemo.js`). Por eso sale "Jacket One Piece · Tripulación
Sombrero of Paja": solo sirve para ver qué textos pasan por la traducción.

## Cómo traduce la tienda hoy

- **Textos fijos** (botones, avisos): diccionarios (`src/i18n/dictionaries.js`)
  con `t('card.addToCart')`.
- **Textos de los datos:** `<T>` y `useTranslatedText` (nombres de producto,
  títulos del builder) y `useTranslatedHtml` (la descripción). Mientras llega
  la traducción muestran el original, guardan en caché y no tocan la red en
  español.

## Cómo traduce el kit

Igual que con los enlaces: el kit no traduce por su cuenta, la tienda le pasa
cómo hacerlo.

```jsx
// src/App.jsx (ya en la tienda), dentro de ProveedorEnlaces:
import { ProveedorTraduccion } from './componentes/kit/Traduccion';
import { useTranslatedText, useTranslatedHtml } from './i18n/useTranslatedText';

<ProveedorTraduccion texto={useTranslatedText} html={useTranslatedHtml}>
  …la app…
</ProveedorTraduccion>
```

- **`useTexto(texto)`** y **`<Texto>`**: un texto de los datos, traducido si
  hay proveedor. Lo que no es texto pasa igual.
- **`useHtml(html)`**: la descripción de un producto (solo los textos entre
  etiquetas).
- **Sin proveedor**, en la página de componentes y en los tests, todo queda
  como está.
- Los dos son **hooks**: el proveedor no debe cambiar de uno a otro mientras
  la página vive. En la tienda siempre son los mismos.

### Qué pasa hoy por la traducción

| Componente | Qué se traduce |
|---|---|
| `TarjetaProducto` | el nombre y la categoría (también en el aria-label) |
| `TituloSeccion` | título, subtítulo y antetítulo (los del builder) |
| Secciones del builder | lo que escribe el admin: anuncios y su "Ver", diapositivas (título, subtítulo, botón), encabezado, texto (`TextoCampo`), banner (botón), insignias y beneficios (`Beneficio`), testimonios (opinión y tema; nombre y ciudad, tal cual), preguntas y respuestas (`Acordeon`), la tarjeta de ayuda, la fila de destacados (`TarjetaDestacado`), la cita, la oferta relámpago y las líneas del mapa. Como `<T>`: solo textos sueltos; un título con resalte va tal cual |
| `Migas` | cada miga (la categoría) |
| `PaginaProducto` | el nombre, la galería y la descripción (`useHtml`); desde el 2026-10-17 también sus textos fijos (botones, estados, "Este conjunto incluye", "¡Quedan N!", opiniones, el aviso del regalo) con `<Texto>` y `useTexto` en los atributos |
| `OpcionesProducto`, `SelectorColor`, `SelectorTalla` | la etiqueta ("Color · Ella", "Talla"), "Cantidad", el aviso de la talla y la nota del combo; los nombres de los colores y las tallas, todavía no |
| `Opiniones` (`ResumenOpiniones`, `TarjetaOpinion`, `FormularioOpinion`) | sus textos fijos, el placeholder y los errores |
| `AgregarRapido` | el nombre del producto, "Personalizar", "Agregar" y "Elige…" (el título lo traduce `HojaInferior`) |
| `GaleriaProducto`, `ConfianzaCompra` | "Pasa el cursor para ver de cerca" y las tres líneas de confianza |
| `ItemCarrito` | el nombre; desde el 2026-10-17 también "Combo", "Con tu diseño", los detalles, las prendas, lo que falta y los textos ocultos |
| `PaginaCheckout`, `ResumenCompra`, `FilaMonedas`, `CampoCupon`, `MetodoPago`, `PasosCompra`, `CamposDireccion` | los textos fijos, las etiquetas y placeholders de los campos, los avisos y la nota de invitación (desde el 2026-10-17) |
| `PaginaPagoRapido`, `PagoTarjeta`, `PagoPaypal` | los textos fijos y el concepto del enlace (desde el 2026-10-17) |
| `MarcoCuenta`, `MenuCuenta`, `PaginaResumenCuenta`, `PaginaAjustes`, `ListaDatos`, `AccesosCuenta`, `IdentidadCuenta` | los textos fijos y los aria-label (desde el 2026-10-17). Los grupos del menú y los accesos llegan traducidos por el diccionario (`t()`); `CabezaCuenta`, `TarjetaCuenta`, `Estadistica` e `Interruptor` muestran lo que reciben (quien los usa pasa `<Texto>`, porque a veces es un dato) |
| `Cabecera`, `MenuTienda`, `MenuMarcas` (no los nombres de marca), `AyudaMonedas`, `VistaFavoritos`, `VistaCarrito`, `ListaNotificaciones`, `SaldoMonedas`, `MenuCuenta` sin sesión | los textos fijos, los aria-label, los nombres de categoría y los textos del admin (menú de cuenta y favoritos) (desde el 2026-10-19). Los enlaces de la cabecera pasan por la traducción salvo `traducir: false` (la tienda traduce los rótulos estándar con su diccionario) |
| `PaginaBusqueda`, `PanelBusqueda`, `InvitacionBusqueda`, `ChipsBusqueda` | los textos fijos, los textos del admin (`searchPage`), el marcador y los aria-label, las ideas ("Lo más buscado") y los nombres de categoría; traducida, la pregunta "¿Qué se te antoja hoy?" y "Ver los N resultados de" van como frase entera, sin el subrayado ni la negrita (desde el 2026-10-19; el panel de la cabecera estaba en la tienda sin traducir). Lo que escribiste antes, los nombres de producto del panel (para resaltar lo escrito) y las marcas van tal cual |
| `BarraInferior` | las cinco pestañas y el aria-label (desde el 2026-10-19; antes solo "Inicio" y "Mi cuenta") |
| `EsperaPantalla` (tienda) → `CapaCargando` | "Iniciando sesión", "Creando cuenta", "Enviando enlace" (desde el 2026-10-19, con `useTexto`); los esqueletos no tienen texto |
| `PaginaDetallePedido`, `LineaProduccion`, `PagosPedido`, `HojaPagarSaldo` | los textos fijos, las etapas, el estado y el texto del pago, el aviso del taller, los textos de pagos, boletas y monedas (desde el 2026-10-19); los códigos, montos, números de Yape/Plin y nombres de producto van tal cual |
| `PaginaPedidos`, `SeguimientoPedido`, `PedidosPorVerificar` | los textos fijos, las pestañas, los pasos, el estado del pedido, la deuda y los mensajes del servidor al vincular (desde el 2026-10-19); los códigos de pedido y los nombres de producto van tal cual |
| `PaginaCreaciones`, `TarjetaCreacion`, `VersionesAnteriores` | los textos fijos, las etiquetas, las fechas ("Guardada hace…"), las confirmaciones y sus notas, la comunidad y "Llevar en combo" (desde el 2026-10-19); los nombres de las creaciones, productos y combos van tal cual |
| `PaginaFechas`, `TarjetaPersonaRegalo`, `AvisoFestiva`, `AgendaFechas`, `IdeaRegalo`, `HojaPersona` | los textos fijos, las etiquetas del formulario, los avisos, las notas de paquetes e ideas y los nombres de las fechas (desde el 2026-10-19); los nombres de las personas, de los productos y las opciones de las listas (relación, género, presupuesto) van tal cual |
| `PaginaListaDeseos` | los textos fijos, el resultado de "Agregar todo", "Guardado hace…" y "¡Ya te lo regalaron!" (desde el 2026-10-19); las tarjetas de la tienda, igual que en la tienda; los nombres de producto van tal cual |
| `PaginaReferidos`, `FormaGanar`, `EnlaceInvitacion`, `FilaReferido`, `DetallePedidoReferido`, `RankingReferidos` | los textos fijos, los chips, el detalle de cada persona, la etapa y la nota del pedido (desde el 2026-10-19); los nombres de las personas, los códigos y los productos del pedido van tal cual |
| `PaginaCatalogo`, `PaginaCupones`, `PaginaMisiones`, `TarjetaRecompensa`, `TarjetaCupon`, `TarjetaMision`, `NivelCuenta`, `CostoMonedas` ("Cuesta"), `GananciaMonedas` (`etiqueta`) | los textos fijos y también los de los datos (título, beneficio y descripción de la recompensa, texto del cupón, título y descripción de la misión, nombre del nivel) (desde el 2026-10-17) |
| `PaginaPerfil`, `PaginaDirecciones`, `TarjetaDireccion`, `CamposDatosPersonales` | los textos fijos, las etiquetas, los ejemplos y los mensajes de error (desde el 2026-10-17); `CamposDireccion` ya traducía sus etiquetas y ahora también los errores. Los tipos de documento de las listas, todavía no |
| `PaginaListaPublica`, `PaginaRegalar`, `PaginaRegaloSorpresa`, `TarjetaRegalo`, `FechaEntrega`, `SobreRegalo` | los textos fijos, la relación, la ocasión, "En 9 días" y las fechas festivas (desde el 2026-10-17); el nombre de la persona y el mensaje del regalo van tal cual |
| `PaginaCarrito`, `ResumenPedido`, `BarraEnvioGratis`, `Casilla` | los textos fijos (botones, avisos, la selección, el resumen, el envío gratis, la etiqueta de la casilla) |
| `ResumenCompra` (checkout) y el menú del carrito | el nombre de cada producto |

### Lo que falta (a futuro)

- **Los textos fijos del kit** ("Agregar al carrito", "Talla", los avisos)
  están en español. Hay dos caminos: pasarlos por el mismo `useTexto`, que
  traduce cualquier texto con caché, o un diccionario del kit con las
  mismas claves de `dictionaries.js`. Conviene decidirlo antes de migrar la
  cabecera, que es lo más visible.
- **Los nombres de las marcas** no se traducen (igual que en la tienda).
- **Otros datos:** los nombres de los colores y de las tallas, y las
  descripciones de las creaciones.

## Llevar a la tienda

Hecho el 2026-10-16: el proveedor está en `App.jsx`, dentro de
`ProveedorEnlaces`. No cambia nada en español. En inglés, las piezas del
kit que ya estén en la tienda traducen sus textos como `<T>`.

**Textos fijos del kit:** se decidió pasarlos por el mismo `useTexto`
(`<Texto>` en JSX), pieza por pieza al llevarlas a la tienda, empezando por
el marco. Así no hace falta un diccionario aparte y en español no cambia
nada. Los textos que la tienda ya trae de su diccionario
(`t('lang.popupTitle')`…) se pasan tal cual, sin volver a traducirlos.

**En local** el traductor no responde (tampoco el `<T>` viejo), así que en
inglés solo se puede comprobar que nada se rompe; la traducción real se ve
en producción.
