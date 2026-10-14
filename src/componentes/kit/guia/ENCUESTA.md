# Encuesta (`/encuesta-suscripcion`): qué componente va en cada parte

Cómo verla en vivo: `npm run dev` → http://localhost:3000/componentes.html →
**Páginas** → **Tienda de prueba** → página **Encuesta** (también la abren la
píldora "Gana 15 monedas", la campana y el aviso de Fechas importantes). Con
**Ver como** → "Con sesión" aparecen los estados **Ya respondida**, **Con
personas guardadas** (la pareja y una hermana del perfil), **Cargando** y
**Falla al guardar**. "Visitante" muestra la invitación a entrar.
Las piezas sueltas están en **Piezas** → **10 · Piezas de la cuenta**.
El marco de la tienda (M) es el de siempre: ver
[INICIO.md](INICIO.md#marco-m-lo-que-rodea-a-las-secciones).

| Portada (escritorio) | Un poco sobre ti (celular) | A quiénes regalas (celular) |
|---|---|---|
| ![Portada: Kapi, título con trazo, premio en monedas y los dos botones](encuesta-portada.webp) | ![Paso 1: nombre, preguntas de la config y tu cumpleaños](encuesta-sobre-ti.webp) | ![Paso 2: los grupos en tarjetas con sello](encuesta-grupos.webp) |

| Un grupo (escritorio) | Datos de una persona (celular) | Gracias (escritorio) |
|---|---|---|
| ![Paso 3: las personas del grupo, con su estado](encuesta-personas.webp) | ![La hoja con el formulario de la persona](encuesta-hoja.webp) | ![Monedas ganadas, ideas de regalo y el consejo de Fechas importantes](encuesta-gracias.webp) |

Revisado el 2026-10-14 contra wala.pe/encuesta-suscripcion y
`src/pages/SubscriptionSurveyPage.jsx` (+ `services/encuestaConfig.js`). No es
del builder: contenido propio, numerado **P6**.

## Cómo se arma

- **P6 · `PaginaEncuesta`** (`paginas/Encuesta.jsx`) dentro de `MarcoTienda`
  (con `kapiEnPie={false}`: Kapi ya está en la portada). Una columna de
  620px como máximo: arriba **`ProgresoEncuesta`** ("Paso 2 de 3" y la barra
  con el degradado del logo; en el paso 3 avanza también grupo por grupo) y
  debajo una tarjeta por paso que entra de lado según se avance o se vuelva
  (una vez, sin bucle; nada con `prefers-reduced-motion`).
- Cada paso empieza con un **`Sello`** con su ícono (la pareja en rosa,
  "Gracias" en menta), el título con la letra del logo y una línea de ayuda.
  La portada lleva a Kapi en vez del sello y un `Trazo` bajo el título;
  garabatos quietos en la esquina de la tarjeta.
- Los botones van abajo: atrás a la izquierda (fantasma) y seguir a la
  derecha (violeta liso). En el celular los dos ocupan todo el ancho y el de
  seguir queda arriba, al pulgar.
- **Sin `alert` ni `confirm`**: los errores y las preguntas ("No agregaste a
  nadie en hijos. ¿Sigues igual?") salen en un `Aviso` encima de los botones,
  con su botón ("Seguir sin nadie", "Terminar sin personas").
- Las personas se guardan **en la página** hasta "Terminar encuesta"; recién
  ahí sale `onTerminar` con todo junto.

## Partes

| N.º | Qué es | Componente | Piezas | Archivo del diseño | Datos en la tienda |
|---|---|---|---|---|---|
| P6 | La encuesta | `PaginaEncuesta` | las de abajo | `paginas/Encuesta.module.css` | `getSurveyConfig` → `encuestaDesdeConfig`; `userProfile` (`surveyBasicData`, `birthDate`, `giftRoles`, `giftRecipients` → `personaDesdeRecipient`) |
| — | Avance | `ProgresoEncuesta` | `BarraProgreso` (`--bp-relleno`) | `piezas/Encuesta.module.css` | el paso y el grupo actual |
| 0 | Portada | — | Kapi, `Trazo`, `Moneda`, `Boton` | `paginas/Encuesta.module.css` (`.portada`, `.premio`) | `introPanel`; premio: `recompensa` (15 + 5 por fecha, tope 50) |
| 1 | Un poco sobre ti | — | `Campo` (texto o `ListaOpciones`), `CampoFecha` | `Formulario.module.css`, `Fecha.module.css` | `basicDataPanel.fields`; el cumpleaños propio va a `birthDate` |
| 2 | A quiénes regalas | `ElegirVarios` | `Sello` (suave → degradado al elegir) y el visto en la esquina | `piezas/Encuesta.module.css` | `GRUPOS_ENCUESTA` (los `roleKey` de siempre) |
| 3 | Las personas de cada grupo | `FichaPersonaEncuesta` | `Avatar`, `GananciaMonedas` ("+5 por cada fecha nueva") | `piezas/Encuesta.module.css` | las personas con `relacion` igual al grupo |
| 3·h | Datos de una persona | `HojaPersona` (`relacionFija`, `familia`) | `HojaInferior`, `Campo`, `CampoFecha`, `Interruptor`, `Casilla`, `RecortarFoto` | `piezas/FormularioPersona.module.css` | `brandsPanel.categories` → `conjuntos` (sugerencias de `useGiftCatalog`) |
| 4 | Gracias | — | `Sello` menta, `Moneda`, `IdeaRegalo`, `Enlace` | `paginas/Encuesta.module.css`, `piezas/Regalos.module.css` | `completionPanel`; monedas y ideas: lo que devuelve `onTerminar` |
| — | Sin sesión / ya respondida | `EstadoVacio` | Kapi feliz, `Boton` | `Feedback.module.css` | `user`, `userProfile.hasCompletedSurvey` |

## Para cambiar el diseño rápido: qué se repite

- **`HojaPersona`** (`piezas/FormularioPersona.jsx`) es el mismo formulario
  de Fechas importantes (C12): cambiarlo cambia los dos. La encuesta lo usa
  sin el campo Relación (la sabe por el grupo) y con el "Conjunto familia".
- **`IdeaRegalo`** es la misma de Fechas importantes; cuando su caja es
  angosta (menos de 340px) el precio baja bajo el nombre.
- **`Sello`**, **`BarraProgreso`**, **`Campo`**, **`CampoFecha`** y
  **`EstadoVacio`** son los de todo el kit.

## Llevar a la tienda (a futuro: TODAVÍA NO se hace)

Página propia: va en el paso 6 de [MIGRACION.md](MIGRACION.md), después de
Fechas importantes (comparten `HojaPersona`). Mantener al día si cambia un
componente o su forma de recibir datos.

### Reemplazos

| Parte | Hoy en la tienda | Pasa a (kit) |
|---|---|---|
| Página | `pages/SubscriptionSurveyPage.jsx` (ruta en `App.jsx` ~391) | `PaginaEncuesta` dentro de `MarcoTienda kapiEnPie={false}` |
| Avance | `.progreso` + `.progressBarContainer` (~382-390 y ~410) | `ProgresoEncuesta` |
| Portada | `currentStep === 0` (~419-441) | paso 0 de `PaginaEncuesta` |
| Sobre ti | `currentStep === 1` (~443-477): `<input>`, `<select>` y `<input type="date">` nativos | `Campo` / `ListaOpciones` y `CampoFecha` |
| Grupos | `currentStep === 2` (~479-508): `.groupCard` | `ElegirVarios` con `GRUPOS_ENCUESTA` |
| Personas de un grupo | `currentStep === 3` hub (~510-570): `.recipientCard` | `FichaPersonaEncuesta` + botón "Añadir…" |
| Datos de una persona | el formulario en la misma tarjeta (~572-800), con `FechaEventoInput` y `<datalist>` | `HojaPersona relacionFija familia` (en una hoja) |
| Gracias | `currentStep === 4` (~803-860): `ideasFinal`, `tipBox` | paso 4 de `PaginaEncuesta` con `IdeaRegalo` |

### De dónde sale cada dato

- **Textos y preguntas**: `getSurveyConfig()` (con `DEFAULT_SURVEY_CONFIG`)
  → `encuestaDesdeConfig(config, sugerenciasCampo)` → `{ config, conjuntos }`.
- **`inicial`**: `{ respuestas: userProfile.surveyBasicData, cumpleanos:
  userProfile.birthDate, grupos: claves de giftRoles en true, personas:
  giftRecipients.map(personaDesdeRecipient) }`.
- **`completada`**: `userProfile.hasCompletedSurvey`. **`sesion`**: `user`.
  **`cargando`**: `authLoading || configLoading`.
- **`onOmitir`**: `updateUserProfile({ lastSurveyPromptedAt: Date.now() })` y
  `navigate('/', { replace: true })` (lo de `handleSkip` ~128).
- **`onTerminar({ respuestas, cumpleanos, grupos, personas, quitadas })`**:
  lo de `handleFinalSave` (~323): `updateUserProfile({ surveyBasicData:
  respuestas, giftRoles: { [grupo]: true… }, giftRecipients, hasCompletedSurvey:
  true, birthDate (solo si hay) })` con `personas.map(personaARecipient)` más
  los del perfil que no se tocaron **menos los `quitadas`**; después
  `registrarConversionPopup('encuesta', …)` y `grantSurveyReward()` +
  `claimDatesReward()`; si pagaron, `volarMonedasGanadas(null, total)`.
  Devuelve `{ monedas: total, ideas: personas.map((p) => ({ id, nombre,
  ideas: recomendar(recipient, { limite: 3 }).filter(tipo === 'gusto') →
  props de IdeaRegalo })) }`.
- **`onSubirFoto`**: la misma subida de Fechas importantes.
  **`onAgregarIdea`**: agregar al carrito (o abrir la ficha si necesita talla).

### Comportamiento que no se puede perder

- Precargar las personas del perfil y **fusionar** al guardar: nunca
  reemplazar `giftRecipients` entero (se perderían las que no se ven aquí).
- La pareja: si se marca, su grupo trae una ficha para completar; no se
  puede quitar ni añadir otra.
- Una persona está lista con nombre, género y la fecha de cada evento (y el
  nombre de la fecha especial): `validarPersona`. Con alguna incompleta no se
  pasa de grupo.
- Las monedas las calcula el servidor; la animación sale solo con lo que de
  verdad pagó (15 una vez + 5 por fecha nueva, tope 50).
- El cumpleaños propio no pisa uno guardado con vacío.

### Diferencias a propósito (no "corregirlas" al migrar)

- **Sin sesión** hay invitación a entrar (la ruta no tiene guardia: hoy se ve
  la encuesta y falla al guardar).
- **Ya respondida**: pantalla con "Ver mis fechas" y "Volver a responder" en
  vez de empezar de cero sin avisar.
- Avisos en la tarjeta en vez de `alert`/`confirm`; si no se elige ningún
  grupo, "Terminar sin personas" (antes había que volver atrás).
- **Quitar a alguien lo quita de verdad** (`quitadas`): antes la fusión lo
  traía de vuelta.
- El formulario de una persona es el de Fechas importantes, en una hoja
  (foto con recorte, gustos con sugerencias, presupuesto en una lista).
- Sin emojis (🎂, 🎁, 💡): sellos e íconos.

### Pasos (cada uno se verifica solo y se puede volver atrás)

1. Agregar `familia` al formulario de Fechas importantes no hace falta; sí
   verificar que `personaARecipient` guarda `familySet`/`familyAnswers` (ya lo
   hace el adaptador).
2. En `SubscriptionSurveyPage.jsx`, armar `config`, `conjuntos`, `inicial`,
   `onOmitir` y `onTerminar` con lo de arriba y devolver `<PaginaEncuesta>`
   en lugar del JSX actual (mantener el archivo viejo hasta probar).
3. Probar: sin sesión, primera vez, volver a responder (no se pierde nadie),
   quitar a alguien, pareja sin datos, falla de red, monedas pagadas.
4. Borrar `SubscriptionSurveyPage.module.css` cuando lleve un tiempo en
   producción.
