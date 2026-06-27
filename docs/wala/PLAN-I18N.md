# PLAN — Internacionalización (i18n): detección de idioma/país + traducción automática

> Documento de arquitectura de producto/técnico. **No es código.** Aterriza la visión de
> "atender a extranjeros" en el codebase real de WALA (React + Vite + Firebase).
> Regla heredada: **donde el código actual contradice lo aspiracional, gana el código.**

---

## 0. TL;DR para el dueño

1. **Hay dos problemas distintos que se resuelven con dos herramientas distintas.**
   - **(a) Textos fijos de la interfaz** (botones, menús, "Comprar", "Al carrito", "Mi
     perfil"…). Son **finitos y los escribimos nosotros** → se traducen con **diccionarios
     `react-i18next`**. Costo: **$0** (lo hace el navegador, sin API). Trabajo: una vez.
   - **(b) Contenido dinámico del catálogo** (nombres y descripciones de productos que el
     admin escribe en español). Son **muchísimos y cambian** → se traducen con una **API de
     traducción (Google Cloud Translation o DeepL)**, **con caché en Firestore** para no
     pagar dos veces lo mismo. Costo: **por carácter**, controlable con caché.

2. **El "popup de idioma" es sencillo y va al final del incremento de UI.** Si el navegador
   del visitante **no está en español**, aparece un aviso "¿Ver en tu idioma? / Ver original".
   La elección se recuerda en `localStorage` y hay un selector global en el Header.

3. **Ya existe casi toda la infraestructura de detección.** `src/services/geo.js`
   (`detectCountry`) ya detecta el país por IP y lo cachea 24h; `CountrySelect.jsx` ya existe;
   `navigator.language` da el idioma del navegador. **No hay que construir la detección desde
   cero**, solo decidir cómo combinar señales (§1).

4. **El incremento 1 ya está hecho** (CTA "Quick Add" → "Al carrito" en parte de la tienda).
   Ese cambio fue **hardcodeado**, no por i18n. El siguiente paso es **mover esos textos a un
   diccionario** para no repetir el patrón manual en cada idioma.

5. **Recomendación de API para el catálogo: Google Cloud Translation v3.** Es **más barata**
   que DeepL para volumen ($10–20/M de caracteres vs $25/M), soporta **más idiomas** (incluido
   todo lo que un marketplace peruano necesita), y tiene **free tier de 500.000 chars/mes**.
   DeepL suena algo más natural en europeos, pero para nombres/descripciones de productos la
   diferencia no justifica el sobrecosto. **Con caché agresiva, el costo real es marginal.**

---

## 1. Detección de idioma/país del visitante

### 1.1 Señales disponibles (ya en el código)

| Señal | Fuente | Qué da | Estado |
|---|---|---|---|
| **Idioma del navegador** | `navigator.language` / `navigator.languages` | `"es-PE"`, `"en-US"`, `"pt-BR"`… | Disponible nativo, **gratis e instantáneo**. |
| **País por IP** | `src/services/geo.js` → `detectCountry()` | `{ code: 'US', name, dialCode }`, cacheado 24h en `localStorage` (`wala_geo_country`), fallback **PE**. | **Ya existe y funciona.** |
| **Selección manual** | `src/components/intl/CountrySelect.jsx` | El usuario elige país. | **Ya existe.** |
| **Preferencia guardada** | `localStorage` / perfil de usuario | Idioma que el usuario ya eligió. | **A crear** (clave nueva, p. ej. `wala_lang`). |

### 1.2 Cómo decidir el idioma por defecto (orden de prioridad recomendado)

```
1. ¿El usuario ya eligió idioma?  → localStorage 'wala_lang' (o perfil)   → usar ese. FIN.
2. ¿navigator.language indica un idioma soportado (es/en/pt)?              → usar ese.
3. ¿geo.detectCountry() sugiere país no-hispano?                          → ofrecer su idioma.
4. Fallback                                                                → 'es' (español).
```

**Principios:**
- **El idioma lo manda el navegador, no el país.** Un peruano viajando con el teléfono en
  inglés probablemente quiere inglés; un español en Perú quiere español. Por eso
  `navigator.language` pesa **más** que la IP. La IP sirve para **moneda/envío** (ya se usa
  así) y como desempate.
- **Nunca romper el flujo español.** Igual que `geo.js` tiene fallback innegociable a PE, el
  idioma debe caer a **`es`** ante cualquier duda. El público base es peruano.
- **Mapear `navigator.language` a idioma base:** `"pt-BR"` → `pt`, `"en-GB"` → `en`, etc.
  (quedarse con el prefijo antes del `-`).

### 1.3 Idiomas a priorizar (decisión del dueño)

El dueño mencionó "atención a extranjeros". Recomendación de arranque:
- **`es`** (base, ya existe todo el texto).
- **`en`** (inglés: el "idioma puente" para cualquier extranjero no hispano).
- **`pt`** (portugués: Brasil es el vecino grande; alto tráfico potencial).

Con esos 3 se cubre la mayoría. Otros (francés, alemán, italiano) se añaden **solo si los
datos de tráfico** (la geo ya detecta país) muestran demanda real. **No traducir a 20 idiomas
"por si acaso"** — multiplica costo de catálogo sin retorno.

---

## 2. Las dos capas de traducción

### 2.1 Capa A — Textos de UI estáticos → `react-i18next`

**Qué cubre:** botones, CTAs, menús, labels, mensajes de estado, errores de formulario,
títulos de sección. Todo lo que está **escrito en el código** y no cambia con el catálogo.

**Herramienta:** `react-i18next` + `i18next` (estándar de facto en React; **no instalado
aún** — no aparece en `package.json`). **Costo: $0** (no llama a ninguna API; son
diccionarios JSON que viajan en el bundle o se cargan por idioma).

**Estructura propuesta:**
```
src/i18n/
  index.js          ← init de i18next (detección + fallback 'es')
  locales/
    es/common.json  ← { "cart.add": "Al carrito", "buy": "Comprar", ... }
    en/common.json  ← { "cart.add": "Add to cart", "buy": "Buy", ... }
    pt/common.json  ← { "cart.add": "Adicionar", "buy": "Comprar", ... }
```

**Uso en componentes:** `const { t } = useTranslation(); ... t('cart.add')`.

**Punto de partida concreto (el incremento 1):** el CTA que ya se cambió a "Al carrito"
(hoy hardcodeado; en `PremiumProductCard.jsx` todavía dice literalmente "Quick Add", y en
`DashCategorias.jsx`/`DashProductos.jsx` aparece "Al carrito" escrito a mano). El primer
trabajo de esta capa es **reemplazar esos literales por `t('cart.add')`** y empezar el
diccionario con los CTAs más visibles:

> "Al carrito", "Comprar", "Comprar ahora", "Agregar", "Agotado", "Ver más", "Buscar",
> "Mi perfil", "Mis compras", "Iniciar sesión", "Carrito", "Probármelo" (si se hace el
> Avatar Studio), etc.

**Importante:** `react-i18next` **no traduce solo**; alguien escribe cada idioma. Para 3
idiomas y ~100–200 strings de UI es perfectamente abarcable a mano (o con una pasada de
traducción asistida + revisión). **No se paga API por esto.**

### 2.2 Capa B — Contenido dinámico del catálogo → API de traducción + caché

**Qué cubre:** `producto.name`, `producto.description`, nombres de categorías, textos de
landings del page-builder, etc. — todo lo que el **admin escribe en español** y es
**ilimitado/cambiante**.

**Problema:** no se pueden meter en diccionarios (no los conocemos de antemano y cambian).
Hay que **traducirlos con una API** (Google/DeepL). Pero traducir el mismo producto en cada
carga de página sería **caro y lento**.

**Solución: caché en Firestore por `(texto, idioma)`.** Antes de llamar a la API, se busca en
una colección de traducciones; si existe, se usa; si no, se traduce **una vez**, se guarda, y
las siguientes veces es gratis.

**Modelo de datos propuesto:**
```
Colección:  traducciones/{hash}
  hash      = sha1(idiomaDestino + "|" + textoOriginal)   ← clave determinista
  origen    : "Polo de algodón pima"
  idioma    : "en"
  traduccion: "Pima cotton polo"
  proveedor : "google"
  fecha     : <timestamp>
```
- La **clave es un hash** del par (idioma + texto), así la búsqueda es O(1) por `doc id`.
- Si el admin **edita** el producto, el texto cambia → hash nuevo → se traduce de nuevo
  (la traducción vieja queda huérfana; un job opcional la limpia). Esto es correcto: una
  edición **debe** re-traducir.

**Dónde traducir (arquitectura):**
- **Recomendado: traducir bajo demanda vía Cloud Function**, no en el cliente. Igual que el
  Avatar Studio y los pagos, la **API key de traducción es un secret** y no puede ir en el
  bundle de Vite. Patrón ya usado en el repo (`processCulqiPayment` lee
  `process.env.CULQI_SECRET_KEY`). La function: recibe `{ textos[], idioma }`, busca en
  caché Firestore, traduce solo los faltantes, guarda y devuelve todo.
- **Alternativa (peor): traducción on-write** (al guardar el producto en admin, traducir a
  todos los idiomas). Pre-paga la traducción de productos que nadie de ese idioma verá.
  **No recomendado** salvo catálogo chico y estable.

### 2.3 Google Cloud Translation v3 vs. DeepL (comparativa)

| Criterio | **Google Cloud Translation v3** | **DeepL API** |
|---|---|---|
| Precio (NMT estándar) | ~**$20/M** caracteres (Advanced v3); free tier **500.000 chars/mes** | ~**$25/M** caracteres + cuota base mensual |
| Idiomas | **~135+** (cobertura casi total) | **~30+** (fuerte en europeos) |
| Portugués | Sí (incl. variantes) | Sí (Europeo y Brasileño separados) |
| Calidad | Muy buena; suficiente para e-commerce | Ligeramente más natural en europeos |
| Free tier | **500k chars/mes gratis** | Plan Free **discontinuado para nuevos registros** (mediados 2026) |
| Integración GCP | **Nativa** (wala ya es Firebase/Google Cloud → misma factura, mismo IAM) | API externa, otra cuenta/clave |
| Disponibilidad | Estable | API Free/Pro **en discontinuación para nuevos**, verificar acceso |

**Recomendación: Google Cloud Translation v3.** Razones decisivas para wala:
1. **Más barato a volumen** y con **free tier** que probablemente cubra el MVP entero.
2. **Mismo ecosistema** (ya usan Firebase/GCP): la factura, los permisos (IAM) y los secrets
   viven donde ya está todo. Menos fricción operativa.
3. **Cobertura de idiomas** mucho mayor (si mañana aparece tráfico francés/alemán, ya está).
4. **DeepL ha discontinuado sus planes Free/Pro para nuevos registros** (mediados 2026), lo
   que añade riesgo de acceso — justo el tipo de dependencia frágil que el cierre de Ready
   Player Me (ver PLAN-AVATAR-3D) enseñó a evitar.

> DeepL solo valdría la pena si el dueño prioriza **máxima naturalidad en textos europeos**
> y el volumen es bajo. Para nombres/descripciones de productos, Google es la elección
> pragmática.

---

## 3. El popup "¿Ver en tu idioma? / Ver original"

### 3.1 Comportamiento

- **Cuándo aparece:** al cargar la web, si `navigator.language` ≠ español **y** el usuario
  **no** tiene preferencia guardada (`localStorage 'wala_lang'`). Una sola vez por decisión.
- **Qué ofrece:** dos botones —
  - **"Ver en {idioma detectado}"** (p. ej. "View in English") → fija `wala_lang = 'en'`,
    activa i18n de UI + traducción de catálogo.
  - **"Ver original (Español)"** → fija `wala_lang = 'es'`, no molesta más.
- **Persistencia:** la elección se guarda en `localStorage` (clave `wala_lang`) **y**, si el
  usuario está logueado, en su perfil (`updateUserProfile({ lang })`) para que sea consistente
  entre dispositivos. Mismo patrón que `wala_geo_country` ya usa para el país.
- **No reaparece** una vez elegido. Cambiar de idioma luego se hace desde el **selector del
  Header** (§3.2).

### 3.2 Toggle global en el Header

- Un selector de idioma en `src/components/common/Header/Header.jsx` (junto a, o reusando el
  estilo de, `CountrySelect`). Banderitas o códigos (`ES / EN / PT`).
- Cambiarlo actualiza `wala_lang`, recarga los textos de UI (i18next es instantáneo) y dispara
  la traducción del catálogo visible.
- **Separar idioma de país/moneda:** hoy `CountrySelect` maneja país (para teléfono/envío).
  El idioma es **otra cosa** (un peruano puede querer la web en inglés sin cambiar de país).
  No fusionarlos.

---

## 4. Costos estimados y control

### 4.1 Capa A (UI) — $0
Diccionarios estáticos. No hay costo recurrente. Único "costo" = el trabajo de traducir
~100–200 strings × 3 idiomas, una vez.

### 4.2 Capa B (catálogo) — bajo y controlable

Modelo de costo de Google Translation v3 ≈ **$20 por millón de caracteres** (con 500k/mes
gratis). Estimación de orden de magnitud:

- Supón **2.000 productos**, ~**300 caracteres** entre nombre+descripción → **600.000 chars**
  por idioma para traducir **todo el catálogo una vez**.
- A 2 idiomas (en + pt) = **1.200.000 chars** ≈ **~$24 una sola vez** (menos el free tier).
- **Con caché, eso se paga UNA vez.** Las visualizaciones posteriores son **gratis** (salen
  de Firestore). Solo se re-traduce lo que el admin **edita** o los **productos nuevos**.
- **Costo recurrente real** = solo el catálogo nuevo/editado del mes. Probablemente **dentro
  del free tier** la mayoría de los meses → **~$0–pocos dólares/mes**.

### 4.3 Palancas de control de costo
1. **Caché Firestore agresiva** (la palanca principal: traducir cada texto **una sola vez**).
2. **Traducir bajo demanda**, no todo el catálogo de golpe: solo se traduce un producto la
   primera vez que **alguien con ese idioma** lo ve.
3. **Lazy / por lotes:** traducir en bloque los productos de una página de catálogo en una
   sola llamada (la API acepta arrays), no uno por uno.
4. **Límite de idiomas** (3, no 20).
5. **Monitoreo:** alerta de presupuesto en GCP. La traducción de UI no cuenta (es $0).
6. **No traducir lo intraducible:** SKUs, marcas, códigos — saltarlos.

---

## 5. Fases incrementales

> Esfuerzo relativo (S=días, M=1–2 semanas, L=3+ semanas).

### Fase 1 — CTA hardcodeado · ✅ HECHO
"Quick Add" → "Al carrito" (manual). Demostró la intención. **Pendiente de "promover" a
diccionario** (entra en Fase 2). Nota: aún quedan literales sin migrar (p. ej. "Quick Add"
sigue en `PremiumProductCard.jsx`).

### Fase 2 — i18n de UI con react-i18next · Esfuerzo M
- Instalar `react-i18next` + `i18next` + detector de idioma.
- Crear `src/i18n/` con `es/en/pt`.
- **Reemplazar literales por `t(...)`**, empezando por CTAs y navegación (lo más visible),
  luego el resto por pantallas.
- Detección de idioma por defecto (§1.2), fallback `es`.
- **Costo: $0.**

### Fase 3 — Popup + toggle de idioma · Esfuerzo S–M
- Popup "¿Ver en tu idioma? / Original" (§3.1).
- Selector de idioma en el Header (§3.2).
- Persistencia en `localStorage` (+ perfil si logueado).

### Fase 4 — Traducción de catálogo con caché · Esfuerzo L
- Habilitar **Cloud Translation API** en GCP; key como secret de Functions.
- **Cloud Function** `traducirTextos({ textos[], idioma })` con caché en `traducciones/`.
- Hook en cliente (p. ej. `useTranslatedProduct`) que, cuando `wala_lang ≠ 'es'`, pide la
  traducción de nombre/descripción y la muestra (con fallback al español mientras carga).
- Integrar en catálogo y `ProductDetail`.
- **Costo: bajo, controlado por caché.**

### Fase 5 (opcional) — Pulido · Esfuerzo S–M
- Traducir landings del page-builder, correos, notificaciones push.
- Más idiomas según datos de tráfico (la geo ya los detecta).
- `hreflang` / SEO multi-idioma si importa el posicionamiento internacional.

---

## 6. Riesgos y decisiones abiertas

### Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Costo de catálogo sin caché** | Factura recurrente innecesaria. | Caché Firestore obligatoria desde el día 1 de la Fase 4. |
| **Romper el flujo español** | El público base sufre. | Fallback `es` innegociable (como `geo.js` con PE). i18n nunca debe dejar texto vacío. |
| **Calidad de traducción automática** | Descripciones raras dañan confianza. | Revisar a mano los textos clave; permitir override manual por producto (campo opcional `nameTraducido`). |
| **Mezclar idioma con país/moneda** | Bugs de UX (cambiar país cambia idioma sin querer). | Mantenerlos **separados** (`wala_lang` vs `wala_geo_country`). |
| **DeepL discontinúa acceso** | Si se eligiera DeepL, riesgo de proveedor. | Recomendado **Google** (mismo ecosistema, estable). |
| **Strings olvidados sin traducir** | UI "mitad inglés, mitad español". | Auditar literales; lint/regla para detectar texto fuera de `t()`; ir pantalla por pantalla. |
| **Caché desactualizada tras editar** | Se muestra traducción vieja. | Clave = hash del texto: al editar, hash nuevo → re-traduce automáticamente. |

### Decisiones que necesita tomar el dueño
1. **¿Qué idiomas en v1?** Recomendación: **es + en + pt**. ¿Suficiente?
2. **¿Qué API de catálogo?** Recomendación: **Google Cloud Translation v3** (más barato,
   mismo ecosistema, más idiomas). ¿Aprobado?
3. **¿Presupuesto/mes para traducción?** Probablemente **~$0–pocos USD** con caché. Fijar un
   tope de alerta en GCP.
4. **¿Override manual?** ¿Quiere poder corregir a mano la traducción de productos estrella, o
   confía 100% en la automática?
5. **¿Quién escribe las traducciones de UI (Capa A)?** ~100–200 strings × 3 idiomas, una vez.
6. **¿Prioridad relativa?** Este plan compite con seguridad (Fase 0) y el resto del roadmap.
   La **Capa A (UI) es barata y de alto impacto visible**; la **Capa B (catálogo) da el
   verdadero "para extranjeros"** pero cuesta más trabajo.

---

## 7. Recomendación final (una frase)

**Instala `react-i18next` y traduce la UI a es/en/pt (Capa A, costo $0, alto impacto visible),
añade el popup + toggle, y solo después conecta Google Cloud Translation v3 con caché en
Firestore para el catálogo (Capa B, costo marginal gracias a la caché).** Mantén idioma y país
separados, y deja siempre `es` como red de seguridad.

---

### Fuentes consultadas (precios/servicios; reconfirmar antes de comprometer presupuesto)
- Google Cloud Translation v3: pricing (~$20/M chars Advanced, free tier 500k/mes) — cloud.google.com/translate/pricing.
- DeepL API: ~$25/M chars + cuota base; planes Free/Pro discontinuados para nuevos registros (mediados 2026) — support.deepl.com, developers.deepl.com.
- Comparativas Google vs DeepL 2026 (precio/idiomas/calidad): simplelocalize.io, smartling.com, buildmvpfast.com.
- Código wala existente: `src/services/geo.js`, `src/components/intl/CountrySelect.jsx`, `src/components/common/Header/Header.jsx`.
