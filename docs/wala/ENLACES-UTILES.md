# Enlaces útiles WALA — constructor link-in-bio (tipo Linktree)

> Documento del módulo **Enlaces útiles**: un constructor de páginas tipo *Linktree*
> (link-in-bio) para redes, lives y biografías. Fuente: lectura directa del código
> (`src/services/enlaces.js`, `src/pages/LinkInBioPage.jsx`, `src/pages/admin/AdminEnlaces.jsx`,
> `src/pages/admin/AdminEnlaceEditor.jsx`, `src/services/analytics/schema.js`, las Cloud
> Functions `registrarClicEnlace`/`registrarVisitaEnlace` en `functions/index.js`, la ruta
> pública en `src/App.jsx` y el `NavLink` del sidebar en `src/components/AdminLayout/AdminLayout.jsx`).
>
> **Complementa a [MODELO-DATOS.md](./MODELO-DATOS.md)** (colecciones generales) y al
> subsistema de **Analítica** (`analytics_events`/`analytics_sessions`), del que este módulo
> reusa la sesión para el desglose por país/dispositivo.
>
> **⚠️ Topología / reglas duras del dueño:**
> - Los contadores viven **en la NUBE** (`FieldValue.increment`), **NUNCA** en `localStorage`.
> - **Pocas lecturas**: la página pública lee 1 doc por `slug`; el admin lee la subcolección
>   `clics` una vez y los eventos de analítica con un tope acotado.
> - Las Cloud Functions son el **ÚNICO** emisor de los eventos de analítica (evita el doble
>   conteo; el cliente ya no los escribe).
> - Las reglas Firestore de este módulo están **ESCRITAS pero NO DESPLEGADAS** (la base es
>   compartida con un ERP que corre sin Firebase Auth; ver §9).

---

## 1. Resumen y objetivo

El módulo permite al dueño construir **páginas públicas de enlaces** (estilo *Linktree*),
100 % personalizables, servidas en `/l/{slug}`. Cada página reúne, en un layout móvil-first,
un avatar + título + descripción, una fila de **redes sociales** y una lista de **botones**
que apuntan a URLs (externas o internas del portal). Es la clásica página "link-in-bio" para
poner en la biografía de Instagram/TikTok o compartir en un live.

Cada página **mide** su rendimiento en la nube: cuántas **visitas** recibe y cuántos **clics**
tiene cada botón, con un desglose de **de dónde** vienen (país / dispositivo / día). Todo
desde un **constructor admin con vista previa móvil en vivo** (`/admin/enlaces/:id`).

Ruta pública: `/l/:slug` (registrada en `src/App.jsx:406`, **antes** del catch-all `/:slug`
para que no la intercepten las landing pages dinámicas). Menú admin: `NavLink` `🔗 Enlaces
útiles` → `/admin/enlaces`, ubicado en el grupo **"Diseño de Tienda"**, justo debajo de
`🎁 Raffles` (`src/components/AdminLayout/AdminLayout.jsx:110`).

---

## 2. Modelo de datos

Colección: **`link_pages/{pageId}`** (constante `COLLECTION = 'link_pages'` en
`src/services/enlaces.js:27`). El `pageId` es el auto-id de Firestore. Subcolección de
contadores de clic: **`link_pages/{pageId}/clics/{botonId}`**.

### 2.1 Documento `link_pages/{pageId}`

| Campo | Tipo | Descripción |
|---|---|---|
| `slug` | string | Identificador único de la URL pública (`/l/{slug}`). Se guarda `trim()`. Debe ser **único** (validado en front al crear y al editar). |
| `titulo` | string | Título mostrado en la cabecera. |
| `descripcion` | string | Frase corta / bio bajo el título. |
| `avatarUrl` | string | URL de la imagen de avatar (subida por `uploadFile`). Vacío = sin avatar. |
| `estado` | string | `'activo'` \| `'borrador'`. En **borrador** la página pública responde "no disponible". |
| `diseno` | objeto | Personalización visual (ver §2.2). |
| `botones` | arreglo | Botones principales (ver §2.3). |
| `redes` | arreglo | Íconos de redes sociales (ver §2.4). |
| `visitas` | number | **Contador denormalizado** de visitas. Se inicializa en `0` al crear y lo incrementa **solo** la CF `registrarVisitaEnlace`. |
| `createdAt` / `updatedAt` | timestamp | Marcas de tiempo del helper CRUD (`createDocument`/`updateDocument`). `getLinkPages` ordena por `updatedAt desc`. |

> **Nota:** `updateLinkPage` **nunca** toca `visitas` ni la subcolección `clics` (comentario
> explícito en `src/services/enlaces.js:151`): esos contadores solo los mueve la CF.

### 2.2 Objeto `diseno`

Valores por defecto en `disenoPorDefecto()` (`src/services/enlaces.js:75`) y normalización en
`normalizarDiseno()` (`src/services/enlaces.js:112`).

| Campo | Tipo / valores | Por defecto | Descripción |
|---|---|---|---|
| `buttonStyle` | `'solid'` \| `'glass'` \| `'outline'` | `'solid'` | Estilo visual del botón. |
| `cornerRoundness` | number (px) | `12` | Redondez de las esquinas del botón. Rango del slider en el editor: 0–40 px. |
| `buttonShadow` | `'none'` \| `'soft'` \| `'strong'` | `'soft'` | Intensidad de la sombra. |
| `buttonColor` | string (hex) | `'#111827'` | Color base del botón. |
| `buttonTextColor` | string (hex) | `'#ffffff'` | Color del texto del botón (y del texto de cabecera en la página pública). |
| `background` | objeto `{ type, value }` | `{ type: 'color', value: '#f3f4f6' }` | Fondo de la página. |
| `background.type` | `'color'` \| `'gradient'` \| `'image'` | `'color'` | Modo del fondo. |
| `background.value` | string | `'#f3f4f6'` | Color hex / CSS de degradado / URL de imagen según `type`. |
| `fontFamily` | string | `''` | Familia tipográfica CSS (`''` = `inherit`). |

### 2.3 Arreglo `botones` — contrato de cada botón

Normalizado en `normalizarBotones()` (`src/services/enlaces.js:86`).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Id único del botón (prefijo `btn_…`). Es la **clave** del contador en `clics/{botonId}`. |
| `titulo` | string | Texto visible del botón. |
| `url` | string | Destino (guardado con `trim()`). Externa → nueva pestaña; interna (empieza con `/`) → navegación SPA. |
| `thumbnailUrl` | string | URL de miniatura opcional a la izquierda del texto. |
| `order` | number | Orden de aparición (se ordena en cliente por `order`). |

### 2.4 Arreglo `redes` — contrato de cada red

Normalizado en `normalizarRedes()` (`src/services/enlaces.js:99`).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Id único (prefijo `red_…`). |
| `tipo` | `'instagram'` \| `'facebook'` \| `'tiktok'` \| `'whatsapp'` \| `'custom'` | Tipo de red; determina el ícono por defecto. Por defecto `'custom'`. |
| `nombre` | string | Etiqueta (ej. `@usuario`); se usa como `title`/`aria-label`. |
| `url` | string | Destino del ícono (con `trim()`). |
| `iconUrl` | string | Ícono propio subido (opcional). Si existe, **reemplaza** al ícono por tipo. |
| `order` | number | Orden en la fila de redes. |

### 2.5 Subcolección `link_pages/{pageId}/clics/{botonId}`

Un documento por botón, cuyo **id del doc = `botonId`**:

| Campo | Tipo | Descripción |
|---|---|---|
| `count` | number | Clics acumulados del botón. Se crea/incrementa con `FieldValue.increment(1)` (`{ merge: true }`) **solo** desde la CF `registrarClicEnlace`. |

---

## 3. Personalización disponible

Todo se edita en el constructor (`AdminEnlaceEditor.jsx`) con **vista previa móvil en vivo**:

- **Cabecera:** avatar (subida por `uploadFile`), título, descripción, slug (único).
- **Estilo de botón:** `Sólido` / `Glass` / `Contorno`.
  - *Glass* deriva un fondo translúcido del color del botón: `hexToRgba(buttonColor, 0.22)`
    + `backdrop-filter: blur(8px)` (misma fórmula en el editor y en la página pública para que
    la vista previa coincida exacto — `AdminEnlaceEditor.jsx:81` y `LinkInBioPage.jsx:76`).
  - *Contorno* usa fondo transparente + borde del color del botón y texto del color del botón.
- **Redondez de esquinas:** slider `0–40 px` (`cornerRoundness`).
- **Sombra:** `Ninguna` / `Suave` / `Fuerte` (`buttonShadow`).
- **Colores:** color del botón y color del texto (picker de color + campo hex).
- **Fondo de la página:** `Color` (picker), `Degradado` (se pega CSS `linear-gradient(...)`)
  o `Imagen` (se sube por `uploadFile`).
- **Tipografía:** selector con `Por defecto`, `Poppins`, `Montserrat`, `Georgia (serif)`,
  `Monoespaciada`.
- **Botones con miniatura:** cada botón admite un `thumbnailUrl`; el texto se centra con un
  espaciador espejo cuando hay miniatura (`LinkInBioPage.jsx:328`).
- **Redes con ícono/imagen/nombre:** por tipo (con ícono por defecto) o con ícono propio
  subido (`iconUrl`).
- **Arrastrar para reordenar:** botones y redes se reordenan con **drag & drop HTML5**
  (`draggable` + `onDragStart`/`onDragOver`/`onDrop`); al **guardar** se recalcula `order`
  según el orden visual (`AdminEnlaceEditor.jsx:264`).

---

## 4. Página pública `/l/:slug`

Componente: `src/pages/LinkInBioPage.jsx`. Móvil-first; renderiza **todo** el diseño.

### 4.1 Carga (1 sola lectura)

- Al montar llama `getLinkPageBySlug(slug)` (`src/services/enlaces.js:52`): **1 query de un
  solo campo** `slug == …` con `limit(1)`. Un `where` de igualdad sobre un solo campo **no
  exige índice compuesto**. Los arreglos `botones`/`redes` vuelven **ordenados por `order`**
  desde el servicio.

### 4.2 Estados

| Estado | Condición | Render |
|---|---|---|
| Cargando | `loading === true` | Spinner (`aria-label="Cargando"`). |
| No disponible | `error` \| sin doc \| `data.estado === 'borrador'` | "Página no disponible" + enlace "Ir al inicio". Cubre **inexistente** y **borrador** con el mismo mensaje (`LinkInBioPage.jsx:111`). |
| OK | Página `activo` encontrada | Cabecera + fila de redes + botones + pie "Creado con Wala". |

### 4.3 Render del diseño

El `diseno` se traduce a **variables CSS inline** (`--lb-bg`, `--lb-btn-bg`, `--lb-btn-text`,
`--lb-radius`, `--lb-shadow`, `--lb-btn-glass`, `--lb-font`, etc. — `LinkInBioPage.jsx:228`).
`construirFondo` maneja color / degradado / `url("…")`; `construirSombra` traduce
`none|soft|strong`; el estilo del botón se elige con `CLASE_ESTILO[estilo]`. Las imágenes rotas
caen a `PLACEHOLDER_IMG` (`onImgError`, con guarda anti-bucle).

### 4.4 Apertura de enlaces **sin bloquear**

`handleClic(e, item)` (`LinkInBioPage.jsx:163`):

1. Dispara `registrarClic(page.id, item.id, { url, ...ctx })` **fire-and-forget**, envuelto en
   `try/catch` para que **jamás** lance ni bloquee la apertura.
2. **Sin URL** → `preventDefault()` (no salta a `#`).
3. **Interna** (empieza con `/`) → `preventDefault()` + `navigate(url)` (SPA, sin recarga).
4. **Externa** → se deja abrir el `<a target="_blank" rel="noopener noreferrer">` por su cuenta
   (no se llama `preventDefault`), así el clic nunca se pierde aunque el tracking tarde o falle.

---

## 5. Constructor admin

### 5.1 Lista — `/admin/enlaces` (`AdminEnlaces.jsx`)

- Lista todas las páginas con `getLinkPages()` (**1 query de colección**, `updatedAt desc`;
  con *fallback* de orden en cliente si faltara el índice).
- Cada tarjeta muestra: badge de estado (`Activo`/`Borrador`), `visitas` (leídas del **propio
  doc**, sin lecturas extra), título, `/l/{slug}` y acciones **Editar / Ver / Eliminar**.
- **Crear:** formulario mínimo (título + slug). El `slug` se deriva del título con `slugify`
  (minúsculas, sin acentos, `a-z0-9` y guiones) salvo que se escriba a mano. Choca si el slug
  ya existe (`window.alert`). Al crear, entra directo a `/admin/enlaces/{id}`.
- **Eliminar:** modal de confirmación; advierte que se pierden visitas y clics.

### 5.2 Editor / constructor — `/admin/enlaces/:id` (`AdminEnlaceEditor.jsx`)

Layout de dos columnas: **editor** a la izquierda, **vista previa móvil en vivo** a la derecha
(un `phoneFrame` que refleja diseño, redes y botones en tiempo real). Secciones del editor:

- **(a) Cabecera:** avatar (subida), título, descripción, slug (único), estado `activo/borrador`.
- **(b) Botones:** tarjetas `{ miniatura, título, url }` con **agregar/eliminar** y
  **arrastrar para reordenar**; cada fila muestra sus clics acumulados.
- **(c) Redes:** filas `{ tipo (select), nombre, url, ícono }`, también reordenables.
- **(d) Diseño:** todo lo de §3.
- **(e) Analítica:** ver §6.

**Subida de imágenes:** `subirImagen()` usa `uploadFile` a rutas
`link_pages/{carpeta}/{id}/{ts}_{name}` con carpetas `avatars` / `thumbnails` / `redes` /
`backgrounds` (`AdminEnlaceEditor.jsx:349`). Solo acepta `image/*`.

**Guardado:** botón **Guardar** (no en cada tecla → pocas escrituras). Antes de escribir,
`saveMutation` valida que **ninguna otra** página use el mismo `slug` (si no,
`getLinkPageBySlug` con `limit(1)` devolvería una arbitraria y dejaría la otra inalcanzable);
luego reasigna `order` de botones/redes y llama `updateLinkPage` (`AdminEnlaceEditor.jsx:234`).

**Drag-reorder:** índice del ítem arrastrado en `useRef` (`dragBtn`/`dragRed`); `onDrop`
mueve el ítem en el arreglo con `reordenar(lista, from, to)` (`AdminEnlaceEditor.jsx:327`).

---

## 6. Analítica

### 6.1 Contadores en la nube

- **Visitas:** campo denormalizado `link_pages/{id}.visitas`. Lo lee el editor del **propio
  doc** (`pageData.visitas`) y la lista de `AdminEnlaces`. Lo incrementa solo `registrarVisitaEnlace`.
- **Clics por botón:** subcolección `clics/{botonId}.count`. El editor los lee **una vez** con
  `getClicsDeLinkPage(pageId)` (`src/services/enlaces.js:161`) → `{ [botonId]: count }`. El total
  se calcula sumando esos valores en cliente; se muestra un mini-desglose por botón con barras
  de porcentaje.

### 6.2 Eventos de analítica (único emisor = las CFs)

En `src/services/analytics/schema.js:41`:

- `ANALYTICS_EVENT_TYPES.LINK_PAGE_VIEW = 'link_page_view'`
- `ANALYTICS_EVENT_TYPES.LINK_CLICK = 'link_click'`

Ambos se escriben en `analytics_events` **exclusivamente** desde las Cloud Functions
(`registrarVisitaEnlace` / `registrarClicEnlace`). El cliente **ya no** escribe estos eventos:
así se evita el **doble conteo**. Cada evento lleva `pageId` a nivel raíz (top-level) más el
contexto de sesión: `countryCode`, `device`, `clientType`, `sessionId`, `anonymousId`, `uid`,
`clientTsMs`, `serverTs`, `path` (`/l/{slug}`) y `eventData` (`{ pageId, botonId, url }` o
`{ pageId, slug }`).

### 6.3 Desglose "de dónde" (país / dispositivo / día)

`getAnaliticaEnlace(pageId)` (`src/services/enlaces.js:218`) agrega en cliente:

1. Lee los eventos de la página con un **filtro simple** `pageId == …` (índice automático, sin
   índice compuesto) y un **tope** `EVENT_CAP = 2000`.
2. Para los eventos a los que les falte `countryCode`/`device` propio (visitante cuyo país aún
   no estaba en caché al emitir), **une el evento con su sesión** (`analytics_sessions`) por
   `sessionId`, resolviéndolas en **lotes de 10** con `where(documentId(), 'in', lote)` — el
   mismo mecanismo que el dashboard.
3. Agrega por **país**, **dispositivo** y **día** (`formatDayKey(clientTsMs)`), contando
   visitas (`link_page_view`) y clics (`link_click`) por separado.

Devuelve `{ totalVisitas, totalClics, porPais[], porDispositivo[], porDia[] }`. Es una lectura
**acotada** (como mucho `EVENT_CAP` eventos + las sesiones faltantes en lotes) y solo se
consulta desde el editor admin (`staleTime: 60_000`), nunca en público.

---

## 7. Cloud Functions

Ambas son `functions.https.onCall` **públicas** (sin `auth` obligatorio: el visitante puede ser
anónimo). Si viene token, se usa su `uid`; si no, el `uid` del payload (solo metadata de
analítica, jamás de confianza para saldos).

| Cloud Function | Ref | Propósito | Validaciones / notas |
|---|---|---|---|
| `registrarVisitaEnlace` | `functions/index.js:4726` | Registrar una visita a `/l/{slug}`. Incrementa `link_pages/{pageId}.visitas` con `FieldValue.increment(1)` (`{ merge: true }`) y escribe el **único** evento `link_page_view`. | Exige `pageId` string no vacío (`invalid-argument`); la página debe existir (`not-found`). El fallo del evento **no** revierte el contador (fire-and-forget interno). |
| `registrarClicEnlace` | `functions/index.js:4638` | Registrar un clic en un botón. Incrementa `link_pages/{pageId}/clics/{botonId}.count` y escribe el **único** evento `link_click`. | Exige `pageId` y `botonId` (`invalid-argument`); la página debe existir y el botón debe pertenecer a ella (busca `page.botones.find(b => b.id === botonId)`, `not-found`). La **URL de confianza** es la del modelo server-side (`boton.url`), no la que envíe el cliente (`functions/index.js:4660`). El fallo del evento **no** revierte el contador. |

Ambas validan **server-side** contra `link_pages` para que un cliente malicioso no infle
contadores de páginas/botones inexistentes. El cliente **nunca** escribe la subcolección `clics`
ni los eventos (lo bloquean las reglas; ver §9).

---

## 8. Patrón de caché en la nube y pocas lecturas

- **Contadores denormalizados en la nube** (`visitas` + `clics/{botonId}.count`) con
  `FieldValue.increment` → lecturas O(1) y **cero** `localStorage`.
- **Página pública:** exactamente **1 lectura** (`getLinkPageBySlug`, `where` de un campo).
- **Lista admin:** **1 query de colección** (`getLinkPages`); las visitas ya vienen en el doc.
- **Editor admin:** 1 lectura de la subcolección `clics` + 1 lectura acotada de analítica
  (con tope `EVENT_CAP` y `staleTime: 60_000`).
- **Escrituras acotadas:** el editor guarda **al pulsar Guardar**, no en cada tecla.

---

## 9. Seguridad y reglas Firestore

> **⚠️ Reglas ESCRITAS pero NO DESPLEGADAS.** Nunca desplegar `firestore:rules` sin permiso
> explícito del dueño: la base es compartida con el ERP (que corre **sin** Firebase Auth) y
> desplegar reglas ya tumbó el ERP una vez.

En `firebase/firestore.rules:105`:

```
match /link_pages/{id} {
  allow read: if true;         // Vitrina pública de la página de enlaces.
  allow write: if isAdmin();   // Solo el admin crea/edita/borra páginas.

  // Contadores de clic por botón (id del doc = botonId). Lectura pública
  // (el admin los suma en el editor); solo la CF los incrementa.
  match /clics/{botonId} {
    allow read: if true;
    allow write: if false;
  }
}
```

- `link_pages`: **lectura pública** (la página `/l/{slug}` lee 1 doc), **escritura solo admin**.
- Subcolección `clics`: **lectura pública** (el admin la suma), **`write: false`** → nadie la
  escribe desde el cliente; solo la CF `registrarClicEnlace` (admin SDK, que **bypassa** las
  reglas). El campo `visitas` se incrementa igualmente solo desde la CF (admin SDK).

---

## 10. Nota sobre `lucide-react` 1.8.0 (sin íconos de marca)

La versión instalada de `lucide-react` (**1.8.0**) **no exporta íconos de marca** (Instagram,
Facebook, etc., fueron retirados por marca registrada). Por eso, en el constructor los tipos de
red usan **íconos genéricos** de `lucide` (`Camera` para Instagram, `Globe` para Facebook,
`Music2` para TikTok, `MessageCircle` para WhatsApp, `Link2` para "Otro" — `AdminEnlaceEditor.jsx:57`)
y en la página pública se usan emojis/letras (`ICONO_RED` en `LinkInBioPage.jsx:39`). Para tener
el logo real, el dueño **sube su propio ícono/imagen por red** (`iconUrl`), que reemplaza al
genérico tanto en la vista previa como en la página pública.

---

## 11. Guía de pruebas

1. **Crear página:** `/admin/enlaces` → "Nueva página" → título + slug → "Crear y editar".
   Verifica que entra a `/admin/enlaces/{id}` y que el slug se derivó bien del título.
2. **Personalizar:** en el editor cambia estilo de botón, redondez, sombra, colores y fondo
   (color/degradado/imagen); confirma que la **vista previa móvil** refleja cada cambio al
   instante (el *glass* debe verse igual que en público).
3. **Botones y redes:** agrega botones con miniatura y URL; agrega redes con ícono propio o por
   tipo; **arrastra** para reordenar y pulsa **Guardar**; recarga y confirma que el orden persiste.
4. **Slug único:** intenta guardar un slug ya usado por otra página → debe fallar con
   "Ese slug ya lo usa otra página".
5. **Página pública:** abre `/l/{slug}`; verifica avatar, título, descripción, redes y botones
   en el orden guardado. Los enlaces **externos** abren en pestaña nueva; los **internos** (`/…`)
   navegan sin recarga; sin URL no salta a `#`.
6. **Estados:** pon la página en **borrador** y abre `/l/{slug}` → "Página no disponible".
   Prueba un slug inexistente → mismo mensaje.
7. **Contadores en la nube (requiere CFs desplegadas):** abre `/l/{slug}` varias veces y haz
   clic en botones; en el editor confirma que **Visitas** sube (campo `visitas`) y que los
   **clics por botón** suben (subcolección `clics`). Recuerda: el conteo lo hacen las CFs; sin
   despliegue, los contadores no se moverán (pero la página y los enlaces funcionan igual).
8. **Analítica "de dónde":** con tráfico real, revisa los desgloses **Por país / Por dispositivo
   / Por día** en la sección Analítica del editor; deben cuadrar visitas y clics.
9. **No doble conteo:** confirma en `analytics_events` que por cada visita hay **un solo**
   `link_page_view` y por cada clic **un solo** `link_click` (los emiten solo las CFs).

---

## 12. Despliegue de las Cloud Functions

Las despliega **solo el dueño** desde Cloud Shell, respondiendo **N** a los prompts de borrado
(para **NUNCA** borrar funciones del ERP). Las dos CFs de este módulo van en el comando único de
despliegue de ambos módulos nuevos (Raffles + Enlaces útiles):

```
firebase deploy --only functions:registrarClicEnlace,functions:registrarVisitaEnlace
```

> **Nunca** desplegar `firestore:rules` sin permiso explícito del dueño (ver §9).
