# Generales: página no encontrada y descargar la app

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **No encontrada** y **Descargar la app**
(con "Se abre desde": Android, iPhone o Computadora).

| No encontrada (celular) | Descargar la app (Android y computadora) |
|---|---|
| ![No encontramos esta página, con el buscador y los dos botones](no-encontrada-celular.webp) | ![Abriendo la Play Store y la app es para Android](descargar-app.webp) |

**Las dos son una propuesta del kit (2026-10-16): hoy la tienda no tiene
ninguna de las dos pantallas.** Revisado contra `App.jsx`,
`pages/Tienda/DynamicLandingPage.jsx` y `pages/AppRedirect.jsx`.

## Cómo funciona hoy

- **Una dirección que no existe:** no hay página de "no encontrada".
  - `wala.pe/algo` cae en `/:slug` (las landings). Como no hay ninguna con
    ese nombre, `DynamicLandingPage` manda al inicio sin avisar.
  - Lo demás que no tiene ruta (`*`) va a `/cuenta`.
- **`/descargar` y `/app`** (`AppRedirect`): intenta abrir la Play Store en
  el teléfono (`market://`) y, al segundo, la Play Store en la web. Mientras
  tanto, un texto suelto ("Redirigiendo a la Play Store…") sin estilos de
  Walá. Desde un iPhone o la computadora también termina en la Play Store,
  aunque no sirva ahí. La usan "Descargar la app" del sorteo (solo desde la
  app) y del regalo sorpresa.

## Partes

| Parte | Componente | Piezas que usa | Datos |
|---|---|---|---|
| P22 No encontrada | `PaginaNoEncontrada` (`paginas/Generales.jsx`) | Kapi triste (`CARAS_KAPI`), el sello "404", `Trazo`, `Buscador` (`grande`, con botón), `Boton`, `Puntos`, `Destello` | `ruta` (la dirección pedida); `onBuscar` lleva a `/buscar?q=…` |
| P23 Descargar la app | `PaginaDescargarApp` (`paginas/Generales.jsx`) | `Sello` (el teléfono), `Cargando`, `Trazo`, `Boton` | `plataforma` (`android`, `iphone`, `computadora`: la tienda la saca del navegador) |

Esqueleto: `EsqueletoPagina forma="aviso"` (una tarjeta centrada). Las dos
páginas no cargan datos, así que casi nunca se ve.

### Lo que hace

- **No encontrada:** Kapi triste, "404" en un sello, "No encontramos esta
  página" con su trazo, qué pudo pasar, la dirección que se pidió, el
  buscador y "Ir a la tienda" / "Crear mi diseño". El Kapi del pie no sale
  (ya está en la tarjeta).
- **Descargar la app:**
  - **Android:** "Abriendo la Play Store", la etiqueta de Walá meciéndose y
    "Abrir la Play Store" por si no se abrió sola; "Seguir en la web".
  - **iPhone:** "La app de Walá es para Android" y que en la web se puede
    comprar, crear y ver los pedidos; "Seguir en la web".
  - **Computadora:** lo mismo, con `wala.pe/descargar` para abrirlo en el
    celular.

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

1. **No encontrada:**
   - En `DynamicLandingPage`, cuando no hay landing (y no es un slug viejo
     con `redirigirA`), mostrar `PaginaNoEncontrada` en vez de
     `<Navigate to="/" />`.
   - La ruta `*` también.
   - **Ojo:** las landings que se borraron o cambiaron de nombre sin
     `slugsAnteriores` dejarían de llevar al inicio: revisarlas antes.
2. **Descargar la app:** `AppRedirect` monta `PaginaDescargarApp`.
   - La plataforma sale del navegador:
     - `android` si `/android/i`;
     - `iphone` si `/iphone|ipad|ipod/i`;
     - si no, `computadora`.
   - Solo en Android se sigue intentando `market://` y luego la Play Store
     en la web.
