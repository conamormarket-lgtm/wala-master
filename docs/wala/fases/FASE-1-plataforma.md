# Fase 1 — Plataforma y base del marketplace

> Estado global de la fase: **EN PROGRESO**
>
> Esta fase convierte a Walá / "Regala Con Amor" de una tienda mono-vendedor (CRA)
> en la **base técnica de un marketplace multi-vendor / multi-nicho con búsqueda y
> descubrimiento**, sin romper el catálogo ni el editor existentes. Todo lo aquí
> documentado está verificado en **LOCAL** (vite build + dev server en
> `http://localhost:3000`). **Nada está desplegado todavía**; el usuario aún no tiene
> acceso a Firebase (proyecto de producción `sistema-gestion-3b225`; `pruebas-cd728` NO se usa). El movimiento a
> Vercel/Firebase es posterior.

Proyecto / repo: `wala-master`, rama `fase-0-seguridad`.
Stack: React 18 + Vite 5 + Firebase 10 + Capacitor 8 + React Router 6.

## 0. Mapa de commits de la Fase 1

Del más antiguo al más nuevo (todos sobre `origin/master..HEAD`):

| Commit | Título | Qué entrega | Sección |
|--------|--------|-------------|---------|
| `a3c4d66` | fase-1: migración CRA -> Vite | Toolchain Vite, `index.html` a raíz, `vite.config.js`, `vercel.json` | §1 |
| `a652f60` | fase-1: base multi-vendor/multi-nicho + búsqueda | `constants/marketplace.js`, `services/{niches,vendors,search,products}.js`, regla `niches`, `scripts/backfill-vendor-niche.js` | §2, §3 |
| `f188260` | fase-1(fix): elimina `require()` CommonJS que rompía en runtime con Vite | Fix de bug de runtime detectado por revisión adversarial (`Footer.jsx`, `TiendaPage.jsx`, `firebase/config.js`) | §1.5 |
| `0f2414f` | fase-1: cablea búsqueda/nichos/vendedor a la UI | Rutas + páginas `SearchPage`, `NichePage`, `VendorPanel`, `App.jsx` | §4 |

Leyenda de estado usada en este documento:

- **HECHO (cerrado)** — implementado y verificado en local; sin trabajo residual conocido.
- **HECHO (parcial)** — implementado pero deliberadamente reducido a un *scaffold* o
  con seam para fases posteriores; hay trabajo residual identificado.
- **POR HACER** — pendiente dentro del alcance de la Fase 1 (ver §6).

---

## 1. Migración CRA → Vite — **HECHO (cerrado)**

Commit principal: `a3c4d66`. Fix de runtime asociado: `f188260` (ver §1.5).

### 1.1 Por qué

El proyecto venía de Create React App (`react-scripts`). Razones para migrar antes
de construir el marketplace:

- **Velocidad de build y de dev.** CRA/webpack tardaba ~60–90 s en build; Vite/Rollup
  baja a ~29 s en este repo (medición del commit `a3c4d66`), y el dev server arranca
  casi instantáneo con HMR real.
- **`react-scripts` está sin mantenimiento activo** y arrastra dependencias pesadas;
  el `package-lock.json` se redujo de ~27.000 a ~7.000 líneas en la migración.
- La Fase 1 añade páginas y servicios nuevos; conviene partir de un toolchain moderno
  antes de que el árbol crezca.

### 1.2 Cómo: `vite.config.js`

Archivo real: `vite.config.js`. Decisiones clave:

**a) NO renombrar el `.env` ni el código — compat `REACT_APP_*` / `process.env.*` vía `define`.**
El camino canónico de Vite sería `import.meta.env.VITE_*`, pero eso obligaría a
renombrar el `.env` local **y** todas las variables de entorno en Vercel. Para no
romper el entorno existente, se resuelven las claves `REACT_APP_*` en tiempo de build
mediante `define`:

```js
const env = loadEnv(mode, process.cwd(), ''); // carga TODO el .env (sin prefijo)
for (const k of REACT_APP_KEYS) {
  define[`process.env.${k}`] = JSON.stringify(env[k] || '');
}
```

La lista `REACT_APP_KEYS` enumera explícitamente las 24 claves usadas (API, Culqi,
PayPal, Firebase del cliente y Firebase/ERP). Al ser una lista explícita, solo se
inyectan esas variables (no se filtra el `.env` entero al bundle).

**b) `global: 'globalThis'`.** Algunas libs de Firebase asumen `window.global`. Vite
no hace el shim automático que hacía webpack; este `define` lo cubre.

**c) `process.env.NODE_ENV` y `process.env.PUBLIC_URL`.**
- `NODE_ENV` se fija a `production`/`development` según `mode`.
- En CRA `PUBLIC_URL` era `''` (homepage `/`). En Vite el directorio `public/` se sirve
  en la raíz, así que `PUBLIC_URL` se define como `''` para que el código que lo
  concatena siga produciendo rutas absolutas correctas.

**d) `build.outDir: 'build'`.** Vite por defecto emite a `dist/`. Se fuerza `build/`
para mantener la **misma carpeta que CRA**, de modo que Vercel (`outputDirectory`),
Firebase Hosting (`public`) y Capacitor (`webDir`) sigan alineados sin tocar su config.

**e) `server: { port: 3000, open: false }`.** Mismo puerto que CRA; no abre navegador
automáticamente (mejor para entornos headless / CI).

### 1.3 `index.html` a la raíz

Vite usa `index.html` como punto de entrada y debe vivir en la raíz del proyecto
(antes estaba en `public/index.html`). Cambios:

- Movido `public/index.html` → `index.html` (raíz).
- Sustituidos los placeholders CRA `%PUBLIC_URL%/...` por rutas absolutas `/...`
  (manifest, favicon, apple-touch-icon).
- Añadido el módulo de entrada explícito: `<script type="module" src="/src/index.jsx"></script>`.
- Se conservan optimizaciones previas: `preconnect` a fuentes/Firebase/Cloudinary,
  carga diferida de fuentes del editor (`media="print" onload="this.media='all'"`) y
  el splash morado (`#7C3AED`) que cubre el `#root` mientras React monta, alineado con
  el splash nativo de Capacitor para una transición sin parpadeo.

### 1.4 `package.json` y `vercel.json`

`package.json` (real):

| Script | Valor | Nota |
|--------|-------|------|
| `start` | `vite` | reemplaza `react-scripts start` |
| `dev` | `vite` | alias |
| `dev:3001` | `vite --port 3001` | segunda instancia |
| `build` | `vite build` | reemplaza `react-scripts build` |
| `preview` | `vite preview` | sirve el build estático |
| `test:functions` | `node functions/test/economyLogic.test.js` | tests de economía (Fase 0) |

- **devDependencies añadidas:** `vite ^5.4.11`, `@vitejs/plugin-react ^4.3.4`.
- **Eliminado:** `react-scripts`, `cross-env` y el bloque `eslintConfig` con preset
  `react-app` (atado a CRA).
- Se mantiene `"homepage": "/"` (coherente con `PUBLIC_URL=''`).

`vercel.json` (real):

- `"buildCommand": "npm run build"` y **`"outputDirectory": "build"`** — necesario
  porque el preset Vite de Vercel asume `dist/` por defecto.
- `rewrites` SPA: `"/(.*)" -> "/index.html"` (todas las rutas al index, para React Router).
- Header `Cross-Origin-Opener-Policy: same-origin-allow-popups` (necesario para los
  popups de login OAuth).

### 1.5 BUG DE RUNTIME detectado por la revisión adversarial — `require()` CommonJS

Commit del fix: `f188260`.

**Síntoma latente:** CRA/webpack toleraba `require()` ejecutándose en el navegador
(lo resolvía en build). **Vite/Rollup lo deja tal cual**, así que en runtime lanza
`require is not defined`. Lo grave: **el build NO falla** — el error solo aparece al
ejecutar la ruta afectada. El caso más serio estaba en `src/pages/Tienda/TiendaPage.jsx`
(línea ~551), en la **ruta de render de la tienda pública**, es decir, la home.

**Fix — pasar de `require()` a imports ESM estáticos:**

| Archivo | Antes | Después |
|---------|-------|---------|
| `src/pages/Tienda/TiendaPage.jsx` | 2× `require()` (`SECTION_TYPES`, `getDefaultSettings`) | imports ESM estáticos |
| `src/components/common/Footer/Footer.jsx` | 1× `require()` (`getDefaultSettings`) | import ESM |
| `src/services/firebase/config.js` | 1× `require()` (`getFirestore` en el fallback) | import ESM |

**Verificación:** 0 `require()` en `src/`. El único `require()` que queda en el bundle
final es **benigno**: `framer-motion` hace `require('@emotion/is-prop-valid')` dentro
de un `try/catch`, por lo que su ausencia no rompe nada. Build OK tras el fix.

> Lección para fases siguientes: el build verde de Vite no garantiza ausencia de
> `require()`. Conviene un grep de `require(` en `src/` antes de cada release y un smoke
> test en navegador de las rutas críticas (ver §6).

### 1.6 Métricas de la migración

| Métrica | CRA (antes) | Vite (después) |
|---------|-------------|----------------|
| Tiempo de build | ~60–90 s | ~29 s (commit `a3c4d66`) |
| Arranque dev server | lento | casi instantáneo |
| `package-lock.json` | ~27.110 líneas | ~7.000 líneas |
| Code-splitting de rutas `lazy()` | intacto | intacto |
| Carpeta de salida | `build/` | `build/` (sin cambios para Vercel/Firebase/Capacitor) |

---

## 2. Base multi-vendor / multi-nicho — **HECHO (parcial)**

Commit principal: `a652f60`. Estrategia transversal: **cambios ADITIVOS**. Los
productos existentes sin `vendorId`/`nicheId` se leen como del vendedor "casa" y el
nicho base, sin migrar datos, para que la tienda siga funcionando intacta.

### 2.1 `src/constants/marketplace.js` — defaults y tipos de cumplimiento

Archivo real: `src/constants/marketplace.js`.

```js
export const DEFAULT_VENDOR_ID = 'casa';
export const DEFAULT_NICHE_ID  = 'regala-con-amor';

export const FULFILLMENT_TYPES = {
  PRINT_ON_DEMAND: 'print_on_demand', // personalizado (editor fabric.js)
  STOCK:           'stock',           // marketplace general con inventario
  MADE_TO_ORDER:   'made_to_order',   // bajo pedido / artesanal
  DROPSHIP:        'dropship',        // proveedor externo
};
```

Helpers:

- `defaultFulfillmentType(isCustomizable)` — heurística: personalizable → `print_on_demand`;
  si no → `stock`.
- `normalizeFulfillmentType(value, isCustomizable)` — valida contra
  `FULFILLMENT_TYPE_VALUES`; si el valor no es válido cae al default por heurística.

Estos defaults son la **única fuente de verdad**: los reusan `products.js` (lectura y
escritura) y el script de backfill (que los duplica como literales porque corre en
Node sin el bundler — ver §2.5).

### 2.2 Extensión aditiva de `products.js`

Archivo real: `src/services/products.js`. Colección Firestore: `productos_wala`.

**En lectura** (`normalizeProductForRead`, líneas ~218–224):

```js
vendorId: doc.vendorId || DEFAULT_VENDOR_ID,
nicheId:  doc.nicheId  || DEFAULT_NICHE_ID,
fulfillmentType: normalizeFulfillmentType(
  doc.fulfillmentType,
  Boolean(doc.customizable) || customizationViews.length > 0
),
```

**En escritura** (`normalizeProductPayload`, líneas ~800–803):

```js
vendorId: (data.vendorId ? String(data.vendorId).trim() : '') || DEFAULT_VENDOR_ID,
nicheId:  (data.nicheId  ? String(data.nicheId).trim()  : '') || DEFAULT_NICHE_ID,
fulfillmentType: normalizeFulfillmentType(data.fulfillmentType, Boolean(data.customizable)),
```

Clave: cualquier producto sin estos campos queda automáticamente clasificado como
`casa` / `regala-con-amor` / (POD o stock según sea personalizable). **No se requiere
migración para que la tienda siga operando.** El backfill (§2.5) solo persiste estos
defaults en Firestore cuando haya acceso, para poder filtrar/consultar por esos campos
en el servidor a futuro.

> Nota de coexistencia: ya existía un campo plural `vendors` (array de etiquetas de
> texto libre) en los productos, que se conserva intacto. El nuevo `vendorId`
> (singular, identidad real del vendedor) es independiente y aditivo; no reemplaza a
> `vendors` en esta fase.

### 2.3 `src/services/niches.js` — entidad Nicho

Archivo real: `src/services/niches.js`. Colección: `niches`. Un nicho agrupa
catálogo/vendedores (p. ej. "ropa personalizada", "marketplace general").

CRUD completo sobre el helper genérico `./firebase/firestore`:

| Función | Acción |
|---------|--------|
| `getNiches()` | lista ordenada por `order` asc |
| `getNiche(id)` | lee un doc |
| `createNiche(data)` | crea con shape normalizado |
| `updateNiche(id, data)` | actualiza solo campos presentes + `updatedAt` |
| `deleteNiche(id)` | elimina |

Shape del documento `niche`: `slug`, `name`, `type` (`'personalizados' | 'general' | …`),
`commissionPct` (number, default 0), `imageUrl`, `active` (bool, default true),
`order` (number), `createdAt` / `updatedAt`.

### 2.4 `src/services/vendors.js` — entidad Vendedor

Archivo real: `src/services/vendors.js`. Colección: `vendors`. Evoluciona de una simple
etiqueta a una entidad real, manteniendo `getVendors()` / `createVendor({name})`
funcionales para no romper a los llamadores actuales.

Shape del documento `vendor`: `name`, `displayName`, `ownerUid` (uid del dueño, default
`null`), `status` (`'active' | 'pending' | 'suspended'`), `type` (`'house' | 'pod' |
'reseller' | 'self-fulfill'`), `niches` (array), `commissionPct`, `payout`
(`{ method, cci, walletPhone }`, default `null`), `slug`, `logoUrl`, `createdAt` /
`updatedAt`. `createVendor` lanza si el helper devuelve `error`.

> El campo `ownerUid` es el seam hacia el rol `vendor` por custom claims que llega en
> Fase 3: cuando exista, una regla podrá permitir que el vendedor edite solo sus
> propios productos.

### 2.5 Regla Firestore para `niches` y `vendors`

Archivo real: `firebase/firestore.rules` (líneas 71–72):

```
match /vendors/{id}  { allow read: if true; allow write: if isAdmin(); }
match /niches/{id}   { allow read: if true; allow write: if isAdmin(); }
```

Lectura pública (catálogo navegable por cualquiera) y **escritura solo admin**
(`isAdmin()` se apoya en los custom claims introducidos en Fase 0). Mismo patrón que
las demás colecciones de catálogo (`tags`, `characters`, `templates`, etc.).

### 2.6 Script de backfill — `scripts/backfill-vendor-niche.js`

Archivo real: `scripts/backfill-vendor-niche.js`. Asigna `vendorId` / `nicheId` /
`fulfillmentType` por defecto a los productos que NO los tengan.

Garantías:

- **No destructivo:** solo escribe campos faltantes (`if (!d.vendorId) ...`); nunca
  sobrescribe valores existentes.
- Reproduce los literales `'casa'` / `'regala-con-amor'` / `'print_on_demand'` /
  `'stock'` (no importa `constants/marketplace.js` porque corre en Node con
  `firebase-admin`, fuera del bundler).
- Modo simulación: `node scripts/backfill-vendor-niche.js --dry` (no escribe; imprime
  el conteo). Sin `--dry` aplica.
- Requiere `GOOGLE_APPLICATION_CREDENTIALS` apuntando al service account de
  `sistema-gestion-3b225`; aborta si falta.
- Salida: `Productos actualizados: N, sin cambios: M, total: T`.

**Estado:** el script está listo pero **NO se ha ejecutado** (no hay acceso a Firebase
todavía). Mientras tanto, la coexistencia funciona porque la normalización en lectura
(§2.2) aplica los defaults al vuelo. Ver §6.

---

## 3. Capa de búsqueda — `src/services/search.js` — **HECHO (parcial, con seam)**

Archivo real: `src/services/search.js`. Función pública: `searchCatalog(opts)`.

### 3.1 Cómo funciona HOY

Filtra, ordena y pagina **en memoria** sobre el catálogo cacheado. Funciona ya en
local sin servicio externo:

- `fetchAll()` usa `getCachedProducts()` (caché de `products.js`); si está vacío hace
  `getProducts()`. Filtra `p.visible !== false`.
- Búsqueda por término (`matchesTerm`): substring case-insensitive sobre `name`,
  `description`, `tags`, `categories`.
- Facetas (`matchesFacets`): `nicheId`, `vendorId`, `fulfillmentType`, `category`
  (array-contains), `collection`, `brandId`, `tag`, `minPrice`/`maxPrice` (sobre
  `salePrice ?? price`), `customizable` (booleano).
- Orden (`SORTERS`): `newest` (por `createdAt` desc, default), `price` (asc),
  `price-desc`, `name` (A-Z).
- Paginación: `page` / `pageSize` (default 24); devuelve `total` y `totalPages`.
- **Conteo de facetas** (`facetCounts`): devuelve, sobre el conjunto YA filtrado,
  cuántos resultados hay por cada valor de `nicheId`, `vendorId`, `fulfillmentType`,
  `brandId` — material para construir filtros con contadores estilo MercadoLibre.

Firma y forma de retorno:

```js
searchCatalog({ term = '', facets = {}, sort = 'newest', page = 1, pageSize = 24 })
// -> { items, total, page, pageSize, totalPages, facets }
```

### 3.2 Seam de escalado (Fase 3)

Cuando el catálogo crezca, se reemplaza `fetchAll()` por un adaptador
Algolia/Typesense/Meilisearch alimentado on-write por Cloud Functions. **La firma de
`searchCatalog()` NO cambia**, así que ninguno de los consumidores (`SearchPage`,
`NichePage`) se toca. Este es el límite explícito entre la implementación in-memory
actual y el índice de servidor futuro.

---

## 4. Cableado de la UI — **HECHO (parcial — rutas existen, no descubribles)**

Commit: `0f2414f`. Archivo de rutas: `src/App.jsx`.

### 4.1 Rutas registradas

Las tres páginas se cargan con `React.lazy()` (líneas 61–63) y se registran dentro del
`<Suspense>` / `<Routes>` (líneas 286–288):

```jsx
<Route path="/buscar"        element={<SearchPage />} />
<Route path="/nicho/:slug"   element={<NichePage />} />
<Route path="/vendedor"      element={<VendorPanel />} />
```

> Importante: están **antes** del interceptor de landing dinámica
> `<Route path="/:slug" element={<DynamicLandingPage />} />` (línea 291), por lo que
> `/buscar` y `/vendedor` no son capturados por error como slugs de landing.

### 4.2 `src/pages/SearchPage.jsx` — búsqueda con facetas

- Lee/escribe el término en la URL (`?q=`) vía `useSearchParams` (URL compartible).
- Llama `searchCatalog` reactivamente ante cambios de `term`, `facets`, `sort`, `page`.
- Chips de faceta: "Personalizado" (`fulfillmentType=print_on_demand`), "En stock"
  (`fulfillmentType=stock`) y un chip por cada `nicheId` presente en
  `result.facets.nicheId` con su contador.
- Selector de orden (4 opciones) y paginador (`‹ Anterior` / `Siguiente ›`).
- **Reusa `ProductCard`** (`./Tienda/components/ProductCard/ProductCard`), el mismo de
  la tienda, alimentado con las `categories` cargadas vía `getCategories()`.
- **Estado vacío sin Firebase:** "Sin resultados. (Si el catálogo está vacío, conecta
  Firebase para cargar productos.)".

### 4.3 `src/pages/NichePage.jsx` — página por nicho (`/nicho/:slug`)

- El `slug` de la URL se usa directamente como `nicheId` en
  `searchCatalog({ facets: { nicheId: slug } })`.
- Si existe un doc en `niches` con ese `slug` (o `id`), muestra su `name`; si no, usa
  el slug como título. Funciona con el nicho por defecto `regala-con-amor` aunque la
  colección `niches` esté vacía.
- **Reusa `ProductCard`** y `getCategories()`. Paginador propio.
- Estado vacío: "Aún no hay productos en este nicho. (Conecta Firebase para cargar el
  catálogo.)".
- Enlaces de retorno a `/buscar` y `/`.

> Detalle técnico: hay dos `useEffect` que llaman `searchCatalog` (uno al cambiar
> `slug`, otro al cambiar `page`). Es un punto menor de simplificación para más
> adelante, no un bug.

### 4.4 `src/pages/VendorPanel.jsx` — panel de vendedor (scaffold)

- Usa `useAuth()` (`user`, `userProfile`, `isAdmin`).
- **Vendedor efectivo:** `userProfile.vendorId`; si es admin y no tiene `vendorId`,
  usa `DEFAULT_VENDOR_ID` ("casa").
- Carga `getProducts()` y filtra `p.vendorId === vendorId`. Tabla con Producto / Nicho /
  Tipo / Precio / Stock. Botón "+ Nuevo producto" → `/admin/productos/nuevo`.
- Tres estados claramente diferenciados:
  - **Sin sesión:** invita a iniciar sesión (`/login`).
  - **Sin `vendorId`:** mensaje explícito de que el alta de vendedores (rol `vendor`)
    se habilita en **Fase 3**.
  - **Con `vendorId`:** lista los productos; estado vacío menciona conectar Firebase.

> Alcance deliberado: es la **base visible** del área multi-vendor. El rol `vendor`
> por custom claims y el CRUD completo del vendedor llegan en Fase 3.

---

## 5. Verificación local — **HECHO**

Todo verificado en LOCAL (sin despliegue, sin acceso a Firebase del usuario):

| Verificación | Resultado |
|--------------|-----------|
| `vite build` (`npm run build`) | OK (~29 s; salida en `build/`) |
| Dev server (`npm run dev`) | OK en `http://localhost:3000` |
| Rutas `/buscar`, `/nicho/:slug`, `/vendedor` | responden 200 (no caen en el interceptor `/:slug`) |
| HMR | funcional |
| `require()` en `src/` tras el fix `f188260` | 0 (único en bundle: `framer-motion`, benigno) |
| Code-splitting de rutas `lazy()` | intacto tras migración |
| Tests de economía (Fase 0, `npm run test:functions`) | 44/44 (contexto Fase 0, no Fase 1) |
| Revisión adversarial con agentes | detectó y se corrigió el bug `require()` (§1.5) |

Estado vacío: como el catálogo se sirve desde caché/`getProducts()` y no hay acceso a
Firebase, las páginas muestran sus mensajes de "conecta Firebase" sin errores — el
comportamiento esperado en local.

---

## 6. Pendiente de la Fase 1 — **POR HACER**

Las rutas y servicios existen, pero la fase **no está cerrada**. Falta hacerla
descubrible, conectar la home y completar la administración de nichos.

### 6.1 Hacer las rutas descubribles (header / bottom-nav)

- **Por hacer.** Hoy `/buscar`, `/nicho/:slug` y `/vendedor` solo se alcanzan
  escribiendo la URL. Falta:
  - Barra/ícono de búsqueda en el `Header` que enrute a `/buscar?q=...`.
  - Entrada a nichos (menú o sección destacada) hacia `/nicho/:slug`.
  - Acceso a `/vendedor` desde el menú de cuenta (visible solo si hay `vendorId` o es
    admin).
- **Criterio de aceptación:** un usuario puede llegar a las tres rutas **sin teclear
  la URL**, desde header y/o bottom-nav, en móvil y desktop.

### 6.2 Conectar la `TiendaPage` principal a `searchCatalog`

- **Por hacer.** La home (`src/pages/Tienda/TiendaPage.jsx`) aún usa su filtrado
  client-side propio. Migrar su listado/filtros a `searchCatalog` para unificar la
  lógica de descubrimiento.
- **Criterio de aceptación:** la home obtiene su grilla principal vía `searchCatalog`
  (mismos resultados que hoy, mismas `ProductCard`), sin regresiones visuales ni de
  rendimiento perceptibles.

### 6.3 Panel admin de nichos (CRUD)

- **Por hacer.** `services/niches.js` ya expone el CRUD, pero no hay UI de
  administración. Falta una pantalla admin para crear/editar/ordenar/activar nichos
  (`name`, `slug`, `type`, `commissionPct`, `imageUrl`, `active`, `order`).
- **Criterio de aceptación:** un admin puede crear un nicho, verlo en `/nicho/:slug`
  con su `name`, y desactivarlo; la escritura pasa por la regla `niches` (`isAdmin()`).

### 6.4 Correr el backfill cuando haya Firebase

- **Por hacer (bloqueado por acceso a Firebase).** Ejecutar primero en seco
  (`--dry`) y luego aplicar `scripts/backfill-vendor-niche.js` en `sistema-gestion-3b225`,
  con `GOOGLE_APPLICATION_CREDENTIALS` apuntando al service account.
- **Criterio de aceptación:** tras correrlo, **todos** los docs de `productos_wala`
  tienen `vendorId`, `nicheId` y `fulfillmentType` persistidos; el conteo `sin cambios`
  en una segunda corrida `--dry` es igual al total (idempotente).

### 6.5 Smoke test en navegador

- **Por hacer.** Con catálogo real (post-backfill), abrir manualmente las rutas
  críticas y confirmar ausencia de errores de consola (especialmente el patrón
  `require is not defined`, ver §1.5): home `/`, `/buscar`, `/nicho/regala-con-amor`,
  `/vendedor`, ficha de producto y editor.
- **Criterio de aceptación:** las rutas críticas cargan sin errores de consola y
  renderizan productos reales; la búsqueda y las facetas devuelven resultados
  coherentes.

### 6.6 Evaluar migrar env a `import.meta.env.VITE_` (a futuro)

- **Por hacer (opcional, diferido).** El `define` de `REACT_APP_*` (§1.2) es una
  solución de compat. A futuro conviene evaluar migrar al canónico
  `import.meta.env.VITE_*` (renombrando `.env` local y env de Vercel) para alinearse
  con Vite y poder remover la lista `REACT_APP_KEYS`.
- **Criterio de aceptación:** decisión documentada (migrar o mantener); si se migra,
  build y runtime OK con las nuevas variables y sin referencias residuales a
  `process.env.REACT_APP_*`.

### 6.7 Resumen de criterios de aceptación de cierre de Fase 1

La Fase 1 se considera **cerrada** cuando, de forma acumulada:

1. Las tres rutas son descubribles desde la UI (§6.1).
2. La home consume `searchCatalog` (§6.2).
3. Existe panel admin de nichos con CRUD funcional bajo la regla `niches` (§6.3).
4. El backfill se ejecutó y es idempotente sobre `productos_wala` (§6.4).
5. Smoke test en navegador sin errores de consola en rutas críticas (§6.5).
6. Decisión registrada sobre la estrategia de variables de entorno (§6.6).

---

## 7. Referencias rápidas de archivos

| Área | Archivo |
|------|---------|
| Config Vite | `vite.config.js` |
| HTML de entrada | `index.html` |
| Scripts / deps | `package.json` |
| Deploy estático | `vercel.json` |
| Defaults marketplace | `src/constants/marketplace.js` |
| Productos (lectura/escritura aditiva) | `src/services/products.js` |
| Nichos (CRUD) | `src/services/niches.js` |
| Vendedores (entidad) | `src/services/vendors.js` |
| Búsqueda / facetas | `src/services/search.js` |
| Backfill | `scripts/backfill-vendor-niche.js` |
| Reglas `niches` / `vendors` | `firebase/firestore.rules` (líneas 71–72) |
| Página de búsqueda | `src/pages/SearchPage.jsx` |
| Página de nicho | `src/pages/NichePage.jsx` |
| Panel de vendedor | `src/pages/VendorPanel.jsx` |
| Rutas | `src/App.jsx` (líneas 61–63, 286–288) |
