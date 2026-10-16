# Sorteos y campañas: Sorteos, Sorteo por suscripción, Suscripciones, Invitar y Link en bio

> **Regalos con amor salió del kit el 2026-10-16** (se pidió así): en el kit,
> `PaginaRegalosConAmor`, `AntesDespues` y `TarjetaResena` (y sus estilos);
> en la demo, su opción en "Cómo se abre" y sus datos. **En la tienda no se
> tocó nada:** `/regalos-con-amor` sigue con `NuevosUsuariosPage`, y
> `public/diseno` y `public/regalos-con-amor` siguen igual. Para volver, todo
> está en el historial de git.

Cómo verlo en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → **Sorteos y campañas**. "Cómo se abre"
tiene cinco opciones:

- **Sorteo** (`/sorteos` y `/sorteos/:slug`). Estados: ya participa, con
  tickets, cerrado, ganó, solo desde la app, sin sorteo, error y cargando.
  "¡Participar gratis!" abre la hoja con tus datos; con tickets, ahí mismo se
  paga.
- **Sorteo por suscripción** (`/suscrito-sorteo`). Estados: ya suscrito,
  PayPal queda pendiente, no disponible y cargando. "Suscribirme" abre la
  hoja con tres pasos: entrar, los datos con la autorización y el pago.
- **Suscripciones** (`/suscripciones`).
- **Link en bio** (`/l/sorteos-y-atencion`). Estados: no disponible y
  cargando.
- **Invitar** (`/invitar/ISAAC7K`): como en la tienda, lleva al registro con
  el aviso de la invitación arriba. El aviso también se prende en cualquier
  página desde "Mostrar también" → "Aviso de invitación", con sus tres
  estados.

| El sorteo (celular, noche: el boleto y la cuenta atrás) | Por suscripción | Link en bio (el real) |
|---|---|---|
| ![El sorteo con tu participación](sorteo-celular.webp) | ![La portada y los planes](suscrito-sorteo-celular.webp) | ![La página de enlaces real](enlaces-celular.webp) |

| Suscripciones | La invitación en el registro (claro) |
|---|---|
| ![La suscripción de regalos](suscripciones-celular.webp) | ![El aviso de la invitación sobre el registro](invitar-celular.webp) |

Las capturas son del celular. En escritorio también se revisaron (claro y
noche), pero el panel del navegador de esta sesión no daba para una captura
nítida a 1366.

Revisado el 2026-10-15 contra estos archivos:

| Página | Archivo | Líneas |
|---|---|---|
| Sorteo | `pages/SorteosPage.jsx` (+ `services/sorteos.js`) | 1224 |
| Sorteo por suscripción | `pages/SuscripcionSorteoPage.jsx` (+ `services/suscripcionSorteos.js`, `pages/suscripcion/PagoSuscripcion.jsx`) | 896 |
| Suscripciones | `pages/SubscriptionLandingPage.jsx` | 93 |
| Invitar | `pages/InvitarPage.jsx` (solo redirige), `components/analytics/ReferralTracker.jsx`, `components/common/AvisoInvitacion` | 27 + 125 + 133 |
| Link en bio | `pages/LinkInBioPage.jsx` (+ `services/enlaces.js`, `services/linkThemes.js`) | 326 |

**Qué es real y qué es de ejemplo.**

- **Reales:**
  - Link en bio: la única página de `link_pages`, "Sorteos y Atencion", con
    su diseño, sus botones y sus redes (`demo/campanas.json`).
  - Suscripciones: los textos (la página no lee datos).
  - La encuesta a la que lleva Suscripciones es la que ya está en el kit
    (ENCUESTA.md).
- **De ejemplo:**
  - El sorteo y la campaña por suscripción. En wala.pe hoy hay un solo
    sorteo, de prueba (terminó el 2 de julio pero sigue activo), y ninguna
    campaña por suscripción.
  - El ranking de ganadores, los planes, las marcas aliadas y los recibos.
    Las fotos son de productos y marcas reales.

## Partes

| Parte | Componente | Piezas que usa | Datos (en la tienda) |
|---|---|---|---|
| P21 Sorteo | `PaginaSorteo` (`paginas/Sorteos.jsx`) | `CabezaSorteo` (el premio como boleto), `ListaGanadores` (nuevas, `piezas/Sorteos.jsx`); `TarjetaCuenta`, `Estadistica`, `FormaGanar` (con `premio`: "+1"), `EnlaceInvitacion`, `CamposDatosPersonales` + `validarPerfil`, `Cantidad`, `PagoTarjeta`, `PagoPaypal`, `HojaInferior`, `Estallido`, `CuentaRegresiva` | `getSorteoActivo` / `getSorteoBySlug`, `getMiParticipacion`, `getContadorSorteo`; `participarSorteoGratis`, `comprarTicketSorteoSecure` + Culqi / PayPal, `sumarChanceCompartir` |
| P21 Sorteo por suscripción | `PaginaSuscripcionSorteo` | `TarjetaPlan`, `TarjetaAliado`, `ListaGanadores` (nuevas); `Pestanas`, `ListaDatos`, `Estadistica`, `BotonGoogle`, `Casilla`, `PagoTarjeta`, `PagoPaypal`, `Chip` | `getCampaignBySlug`, `getContadorSuscriptores`, `getBeneficios`, `getGanadoresGaleria`, `getMiSuscripcion`, `getRecibos`; `crearSuscripcionCulqi`, `crearSuscripcionPaypal` + `confirmarSuscripcionPaypal`, `cancelarSuscripcion` |
| P21 Suscripciones | `PaginaSuscripciones` (`paginas/Campanas.jsx`) | `FormaGanar` (los 4 pasos), `IconoWala`, `Garabatos`, `Trazo`, `TituloSeccion` | — (textos fijos) |
| P21 Link en bio | `PaginaEnlaces` | `RedesEnlaces` y `BotonEnlace` (nuevas), `Avatar`, `LogoWala` | `getLinkPageBySlug` (`link_pages`), `registrarClicEnlace`, `registrarVisitaEnlace`; el fondo y los botones con `construirFondoStyle` / `estiloBotonStyle` (`services/linkThemes`) |
| M12 La invitación | `AvisoInvitacion` (nueva, `piezas/Campanas.jsx`) | `IconoWala`, `Trazo`, `Boton` | `useInvitacionReferido` (localStorage `wala_referral`), `getNombreInvitacion` |

Esqueletos: `EsqueletoPagina forma="sorteo"`, `"suscripcionSorteo"`,
`"landing"` (Suscripciones) y `"enlaces"`. El del sorteo trae el talón del
boleto y la píldora de la cuenta atrás.

### Lo que hace

- **Sorteo:**
  - **La cabeza (desde el 2026-10-16):** el premio como un **boleto**: la
    foto arriba con "Gratis" (o "S/ 5.00 por ticket") y, debajo de una
    línea punteada con dos muescas, el talón: "Se sortea el 20 de octubre"
    (o "Sorteo cerrado") y "3 ganadores". "Gana: …" con su trazo y la
    descripción. La cuenta atrás va en una píldora con su reloj ("Termina en
    4 d 7 h") y en bloques los dos últimos días. Debajo, "1,284 personas ya
    participan". Con la cabeza en dos columnas, puntos y destellos quietos
    junto al título.
  - Si ganaste: el sello del trofeo con confeti y "¡Felicidades, ganaste!".
  - **Tu participación:** tickets y chances.
  - **Suma más chances:** "Compartir y ganar 1 chance" (una vez) y tu link
    con "Copiar link".
  - **Cómo ganar más chances:** cada forma con su ícono de Walá y lo que
    suma en un sello ("+1", "+1 por ticket", "+1 por amigo"), en dos columnas
    cuando hay sitio.
  - **Quiénes ganaron:** con la tuya marcada.
  - **El botón:**
    - "¡Participar gratis!", "Quiero participar" / "Comprar más tickets"
      con su precio, "Ya estás participando", "El sorteo ya cerró", "Inicia
      sesión para participar", o "Descargar la app" si solo se juega desde
      la app.
    - En el celular va pegado abajo.
  - **La hoja:** tus datos (los de Mi perfil, ya puestos y con sus reglas) y
    el correo. Con tickets, la cantidad y el total; luego "Elige cómo
    pagar" con tarjeta o PayPal.
- **Sorteo por suscripción:**
  - **La portada:** de color, con el título, cuántos suscriptores participan
    y "Quiero suscribirme". Debajo, las anclas (Planes, Premios, Ganadores,
    Beneficios, Mi cuenta).
  - **Los planes:** el precio con la letra de la marca, "Es como pagar S/
    16.63 al mes", las chances por ciclo y lo que incluye. El recomendado va
    con su borde. Los tres en una fila desde unos 700 px (antes el tercero
    quedaba solo abajo).
  - Los premios, los ganadores y las marcas aliadas (con filtro por
    categoría).
  - **Mi cuenta:** el estado, el plan, el método, la vigencia y el próximo
    cobro; "Cancelar suscripción" pide confirmar en el mismo lugar. También
    Mis chances y Mis recibos.
  - **La hoja:**
    - sin sesión, "Continuar con Google";
    - nombres, el correo de la cuenta y "Autorizo el cobro automático de S/
      49.90 cada 3 meses…";
    - el pago con tarjeta o PayPal.
    - Si PayPal queda pendiente: "Tu suscripción se está activando".
- **Suscripciones:**
  - "Regalos perfectos, todo el año" con la Walá Box, que se endereza al
    pasar el ratón.
  - Los cuatro pasos y el llamado oscuro con su lista y "Separar mis fechas
    ahora".
  - Los dos botones llevan a la encuesta.
- **Link en bio:** la foto (o las iniciales), el título, la descripción, las
  redes en círculos (íconos de línea), los botones con el diseño del admin y
  "Creado con Walá". Cada clic se cuenta, también el de las redes.
- **La invitación:**
  - "**Isaac** te invitó a Walá" (con su trazo rosa).
  - Tres estados:
    - sin cuenta: "Crea tu cuenta y recibe 10 monedas", con el botón "Crear
      cuenta", salvo si ya estás en el registro;
    - aceptada: "Ya tienes tus 10 monedas…";
    - link de compra: "Compra hasta … y Isaac gana monedas".
  - En el celular, el texto corto.

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

### Reemplazos

| Hoy | Pasa a (kit) |
|---|---|
| `SorteosPage` (GlassCard, Badge, emojis, el modal `FormularioDatosSorteo`, `CulqiTicketButton`, `PaypalTicketButtons`) | `PaginaSorteo` (con `onPagarTarjeta` / `onPagarPaypal` que abren Culqi y PayPal como hoy) |
| `SuscripcionSorteoPage` (GlassModal, `--sus-*`) | `PaginaSuscripcionSorteo` |
| `SubscriptionLandingPage` | `PaginaSuscripciones` |
| `LinkInBioPage` | `PaginaEnlaces` |
| `AvisoInvitacion` (common) | `AvisoInvitacion` (kit), en el mismo `#app-top-banner-slot` |

**Lo que no cambia:**

- Todas las funciones del servidor y sus reglas: participar, tickets,
  chances, el sorteo de ganadores, cobros recurrentes, webhooks, clics y
  visitas.
- `ReferralTracker` y `useInvitacionReferido`: la invitación sigue
  aceptándose sola.
- `InvitarPage` sigue redirigiendo.
- `linkThemes.js` se comparte con el editor del admin, para que la vista
  previa sea igual a la página.

### De dónde sale cada dato

- **Sorteo:**
  - `sorteo` sale del doc de `sorteos`:
    - `premio: premio.nombre || titulo`, `imagen: heroImagenUrl || premio.imagenUrl`;
    - `hasta`: `fechaFin` (al final del día, hora de Lima);
    - `cerrado`: `estado === 'cerrado'`;
    - `participantes`: la suma de `contador/*`;
    - `reglas`: `chanceExtraCompartir`, `chanceExtraReferido`, y
      `requisitoApp` (`'chanceExtra'` → `appExtra`, `'obligatorio'` →
      `appObligatorio`);
    - `ganadores`: `[{ id: uid, nombre }]`.
  - `participacion`: `participantes/{uid}` →
    `{ tickets: ticketsPagados || 1, chances: chancesTotal, compartio: compartioClaim }`.
  - `urlInvitacion`: `${origin}/sorteos/${slug}?ref=${referralCode}`, con el
    slug.
  - `onComprar`: devuelve `{ monto, moneda }` de `comprarTicketSorteoSecure`.
  - `onPagarTarjeta`: abre Culqi con la `metadata` del ticket.
- **Sorteo por suscripción:**
  - `campana.planes`:
    - `precio: precioCentimos / 100`;
    - `chances: chancesPorCiclo`.
  - `aliados`: `beneficios`.
  - `ganadores`: `ganadores_galeria`.
  - `suscripcion`: `suscriptores/{uid}`, con el **nombre** del plan en vez
    del `planId` y las fechas en palabras.
  - `onPagarTarjeta`: Culqi → `crearSuscripcionCulqi`.
  - `onPagarPaypal`: `crearSuscripcionPaypal` + `confirmarSuscripcionPaypal`.
    Devuelve `{ pendiente }` si queda APPROVED.
- **Link en bio:**
  - Del doc de `link_pages`: `avatarUrl` → `avatar`, `botones[].thumbnailUrl`
    → `imagen`, `redes[].iconUrl` → `icono`, `diseno` tal cual.
  - `onClic(item)`: `registrarClic(pagina.id, item.id, ctx)`.
- **Invitación:**
  - `nombre`: el de `useInvitacionReferido()`.
  - `estado`:
    - `'aceptada'` si `invitacion === 'aceptada'`;
    - `'nueva'` si es una invitación sin decidir y sin cuenta;
    - si no, `'compra'`.
  - `plazo`: `plazoLegible(vence)` precedido de "hasta".
  - `urlRegistro`: `null` en `/registro`.

### Comportamiento que no se puede perder

- Participar y pagar los decide el servidor. El monto del ticket o del plan
  sale del doc, nunca del cliente.
- Al volver del login, el sorteo vuelve al mismo slug.
- Sorteo por suscripción: el cobro automático necesita la casilla
  marcada; cancelar deja vigente lo ya pagado.
- Link en bio: las internas (`/…`) navegan sin recargar, las externas
  abren otra pestaña, y la visita se cuenta al cargar.
- La invitación no sale en `/checkout` (ahí está la línea del checkout:
  `invitacion` en `PaginaCheckout`). Cerrarla dura la sesión.

### Diferencias a propósito (no "corregirlas" al migrar)

- **Sin emojis** (🎁, 🎟️, ⭐, 🏆, 🎉, 📢, 💳, 🅿️, 📷, 🟢) y sin
  `GlassCard`: tarjetas, sellos e íconos de Walá.
- **Sorteo:**
  - La cuenta atrás en palabras cuando falta mucho. Ya no dice "Termina en
    Finalizado": dice que pronto se anuncia quién ganó.
  - Los datos se validan con las reglas de Mi perfil.
  - El botón va pegado abajo solo en el celular.
- **Sorteo por suscripción:**
  - Una portada con los colores de Walá (no `--sus-*` por campaña: si se
    quieren colores por campaña, se agregan como variables).
  - El plan con su nombre.
- **Suscripciones:** la caja es la Walá Box con el ícono de Walá. Los textos
  son un poco más cortos, sin cambiar lo que prometen.
- **Link en bio:**
  - Los íconos de las redes son de línea (Instagram y Facebook dibujados
    en el kit: la versión de lucide no trae marcas).
  - Sin botones: "Pronto habrá enlaces aquí".
  - Página no disponible con Kapi.

### Lo que se encontró de paso (para decidir aparte)

- **Sorteo:**
  - Compartir, referir y volver del login pierden el slug: siempre llevan a
    `/sorteos`.
  - El admin ofrece `requisitoApp: 'recomendado'`, que no hace nada, y no
    ofrece `'chanceExtra'`, que sí existe en la página y en la función.
  - Un borrador se ve si se abre por su slug.
  - La imagen de respaldo tiene un `<T>` dentro del SVG. Pasa también en la
    suscripción.
- **Sorteo por suscripción:**
  - "Plan" muestra el `planId`.
  - Los ganadores son la galería del admin, no los que salieron en el
    sorteo.
  - Una campaña cerrada se sigue mostrando y falla al suscribirse.
- **Regalos con amor** (fuera del kit, sigue en la tienda): promete "S/15
  en monedas", pero la encuesta da 15 monedas más 5 por fecha (hasta 50); y
  la landing del builder con el mismo slug nunca se ve (NAVEGAR.md).
- **Link en bio:** los clics en las redes no se cuentan:
  `registrarClicEnlace` solo busca en `botones`. El kit ya los manda.
- **Enlaces sin entrada:** nada del sitio público enlaza a `/sorteos`,
  `/suscrito-sorteo`, `/regalos-con-amor` ni `/l/`. Se comparten desde
  afuera.

### Pasos

1. `AvisoInvitacion` del kit en `#app-top-banner-slot` (chico y aislado).
2. `PaginaEnlaces` en `LinkInBioPage`, compartiendo `linkThemes`; de paso,
   que la función también cuente las redes.
3. `PaginaSuscripciones` (Regalos con amor se queda con
   `NuevosUsuariosPage`).
4. `PaginaSorteo` con el mismo flujo de Culqi y PayPal (y el slug en
   compartir y en el login).
5. `PaginaSuscripcionSorteo` cuando haya una campaña real para probarla de
   punta a punta.
