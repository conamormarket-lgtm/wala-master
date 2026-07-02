# Documentación WALA — Índice maestro

Esta carpeta (`docs/wala/`) reúne la documentación operativa y de arquitectura del
proyecto **WALA** (portal de clientes + tienda + fidelización, marca legal CATAS GROUP
S.A.C. / "CON AMOR"). El objetivo es que cualquier persona que entre al proyecto pueda,
en este orden: **entender el estado real → respaldar → trabajar en staging → aplicar el
cambio → desplegar → verificar**.

> Regla de oro: **producción primero se respalda, después se toca.** Ningún cambio en
> Firestore, Storage, Cloud Functions, hosting o reglas se hace directamente contra el
> proyecto de producción `sistema-gestion-3b225` sin un respaldo previo y una verificación en
> staging.

> ¿Buscas el panorama rápido? Empieza por
> **[ESTADO-DEL-PROYECTO.md](./ESTADO-DEL-PROYECTO.md)** (qué es Wala, qué se hizo, en qué
> fase estamos, qué hay desplegado y qué falta).

---

## 1. Mapa de documentos

| # | Documento | Qué contiene | Cuándo leerlo |
|---|-----------|--------------|---------------|
| 0 | [ESTADO-DEL-PROYECTO.md](./ESTADO-DEL-PROYECTO.md) | Panorama ejecutivo: qué es Wala, cronología del trabajo, tabla de las 6 fases, inventario de los 8 commits, estado de despliegue, cómo correr en local, riesgos residuales y próximos pasos. | Primero, para situarte en el estado real. |
| 0.5 | [EMULADOR-LOCAL.md](./EMULADOR-LOCAL.md) | Cómo correr TODO en local con el Emulador de Firebase (Firestore/Auth/Functions/Storage), datos de ejemplo y usuarios de prueba. | Para levantar y ver la app funcionando en tu PC. |
| 1 | [PLAN-MAESTRO.md](./PLAN-MAESTRO.md) | Visión, arquitectura objetivo, roadmap por fases (0–5), decisiones técnicas y riesgos. | Para entender hacia dónde va el producto. |
| 1.5 | [PLAN-FECHAS-ESPECIALES.md](./PLAN-FECHAS-ESPECIALES.md) | Plan (POR IMPLEMENTAR) de los features de wishlist **"Mis fechas especiales"** (registro de regalos por fecha en ruta pública `/regalar/:referralCode`, con cuidado de privacidad: no publicar hasta cerrar reglas + Cloud Function) y **"Agregar todo al carrito"**. Incluye flujo, archivos a tocar, modelo de datos y decisiones abiertas. | Antes de implementar esos dos botones de la wishlist. |
| 1.6 | [PLAN-AVATAR-3D.md](./PLAN-AVATAR-3D.md) | Plan (aspiracional) del **Avatar Studio 3D**: selfie → avatar 3D (anime/Meta/realista) vía servicio de IA externo → visor 3D girable "estilo Pacdora" → probador de ropa (try-on). Compara proveedores (Avaturn, RPM **en cierre**, Meshy/Tripo, VRoid…), arquitectura con Cloud Function + Storage, privacidad/PII de selfies, fases y costos. **Nota:** ya está desplegado un **Avatar Studio 2D propio (sin Ready Player Me)** en el perfil (`src/components/profile/AvatarStudio.jsx`); este plan es el siguiente paso 3D. | Antes de tocar el Avatar Studio del perfil. |
| 1.7 | [PLAN-I18N.md](./PLAN-I18N.md) | Plan de **internacionalización**: detección de idioma/país, UI traducida (es/en/pt, $0), popup "ver en tu idioma/original" + toggle en Header, y traducción de catálogo con **Google Cloud Translation v3 + caché Firestore**. **Nota:** la **base GRATIS ya está desplegada** (diccionarios `src/i18n/dictionaries.js` + `LanguageContext` + `LanguagePopup` + toggle ES/EN/PT con **banderas SVG** `FlagIcon`, apoyada en el traductor nativo del navegador) **y además la traducción DINÁMICA del catálogo ya corre gratis** vía **Lingva** (`src/services/translate.js` + `useTranslatedText`/`<T>`, con caché en `localStorage`); este plan describe la variante con **API de pago + caché Firestore** para mayor calidad/volumen. | Antes de ampliar i18n / traducción del catálogo. |
| 1.8 | [PLAN-MULTIMARCA.md](./PLAN-MULTIMARCA.md) | Sistema **multi-marca** (Con Amor / MUSSA / MUEBLERIA): cada producto = 1 marca (`brandId` = doc id de `tienda_brands`), cada marca con su página `WALA.PE/<slug>` (vía `/:slug` → `DynamicLandingPage`, slug **case-insensitive**), catálogo sidebar filtrado a su marca (faceta `brand` server-side), nav de categorías con miniaturas (`categoryNav` embebido) en modo filtro-local, y panel admin por marca (`AdminMarcaProductos`: asignar/quitar en lote + crear-con-marca). **Fases 0–5 HECHAS y DESPLEGADAS** (frontend, Vercel); incluye commits, brand IDs reales y el pendiente del dueño (correr `setup-marcas.js --apply` + configurar páginas/asignar productos a MUSSA/MUEBLERIA). | Antes de tocar marcas, `brandId`, las páginas por marca o el nav de categorías. |
| 1.9 | [MODO-NOCHE.md](./MODO-NOCHE.md) | **Modo Noche** (tema claro/oscuro/sistema): interruptor luna/sol en el Header, `ThemeProvider` con persistencia `wala-theme`, script anti-FOUC en `index.html`, paleta de variables (`:root` / `[data-theme="dark"]`) y overrides por componente (~40 `.module.css`). Respeta los `backgroundColor` inline del admin; garantiza contraste. **Desplegado 2026-06-29** (frontend, Vercel; sin backend). | Antes de tocar estilos globales, el Header o el tema. |
| 1.10 | [SORTEOS-Y-RIFAS.md](./SORTEOS-Y-RIFAS.md) | Módulo **Sorteos y Rifas ("Raffles")**: página pública `/sorteos` (participar gratis o comprar ticket Culqi/PayPal, contador en vivo por shards, compartir, referido, ganadores con confeti), admin `/admin/sorteos` + `/admin/sorteos/:id` ("Decidir ganadores" con **sorteo justo server-side** `crypto.randomBytes` + DRBG SHA-256 sin sesgo, ponderado-sin-reemplazo, evidencia auditable y re-sorteo), servicio `src/services/sorteos.js`, modelo `sorteos/{id}` + subcolecciones y las **9 Cloud Functions** del módulo. **Frontend desplegado** (Vercel); **CFs y reglas PENDIENTES** (ver PENDIENTES / DESPLIEGUE-ESTADO). | Antes de tocar sorteos, tickets, pagos de sorteo o el reparto de ganadores. |
| 1.11 | [ENLACES-UTILES.md](./ENLACES-UTILES.md) | Módulo **Enlaces útiles (Linktree / link-in-bio)**: página pública `/l/:slug` (`LinkInBioPage`, render móvil-first con botones/redes), admin `/admin/enlaces` + `/admin/enlaces/:id` (**constructor** con vista previa móvil en vivo, arrastrar-para-reordenar, panel de diseño y **Analítica** de visitas + clics por botón + país/dispositivo/día), servicio `src/services/enlaces.js`, modelo `link_pages/{pageId}` (`slug`, `diseno`, `botones[]`, `redes[]`, `visitas`) + subcolección `clics`, eventos `link_page_view`/`link_click` y las **2 Cloud Functions públicas** (`registrarVisitaEnlace`/`registrarClicEnlace`, contadores en la nube con `FieldValue.increment`). **Frontend desplegado**; **CFs y reglas PENDIENTES**. | Antes de tocar las páginas de enlaces, su analítica o sus contadores. |
| 2 | [fases/README.md](./fases/README.md) | Índice de la carpeta de fases: tabla por fase con estado y documento asociado, leyenda y flujo de lectura. | Para navegar el roadmap fase a fase. |
| 3 | [MODELO-DATOS.md](./MODELO-DATOS.md) | Colecciones Firestore actuales y objetivo (productos, fidelización, marketplace, ERP) + **sistema multi-marca** (`brandId`, `tienda_brands` con `slug`/`categoryNav`, `landingPages`/`pages`, faceta `brand`; §3.6). | Antes de tocar datos o reglas. |
| 3.5 | [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) | Ciclo completo del PEDIDO del portal: **creación** (único punto en CheckoutPage `onSubmit` → `createWebOrder` → `pedidos_web`), **pago** por método (WhatsApp por-confirmar / Culqi cobra y marca pagado / PayPal), **estado** derivado por dos ejes (producción × pago) y **visibilidad** (Mis Compras por DNI / Recepción admin). Incluye `wala_pedidos` como **FUENTE DE VERDAD** (`estadoWala` + sync de pago en functions, §4-bis.5/§4-bis.9/§3.4). Con archivo:línea y gotchas (`_raw`, `'tregado'`). | Antes de tocar checkout, pagos, "Mis Compras" o "Recepción". |
| 4 | [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md) | Trabajo bloqueante de seguridad: backdoor admin, reglas, economía en cliente, webhook sin secreto (hallazgos H-01..H-11). | Antes de cualquier release; es prerequisito de todo lo demás. |
| 5 | [BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md) | Snapshot del estado actual de producción (entornos, funciones, hosting, dominios, stack, variables). Es el respaldo documental del punto de partida. | Antes del primer cambio, para fijar el "estado conocido bueno". |
| 5.5 | [PENDIENTES.md](./PENDIENTES.md) | **Lista del DUEÑO** de qué falta **desplegar/confirmar** en producción (Cloud Shell + consola): **redeploy de las 4 Cloud Functions** del 2026-06-29 (sync de pago `estadoWala` en `processCulqiPayment`/`culqiWebhook`/`capturePaypalOrderSecure` + foto en `getPublicGiftRegistry`, comando combinado); **confirmar reglas** (`firebase/firestore.rules` con `delete:if isAdmin()`, **NO** `firestore.rules.produccion` con `delete:if isAuth()`; `firestore.rules.propuesto` guardado pero **NO** desplegado, precondición PayPal server-side); y la **FASE SIGUIENTE** (endpoint con API KEY para que el ERP lea y SOLO actualice `estadoWala`, jamás borre). | Cuando vas a desplegar lo de la última sesión. |
| 6 | [DESPLIEGUE.md](./DESPLIEGUE.md) | Procedimiento de despliegue (reglas, functions, hosting Firebase/Vercel, app móvil). | Cada vez que se va a desplegar. |
| 6.5 | [PRUEBAS-Y-DEBUGGING.md](./PRUEBAS-Y-DEBUGGING.md) | Guía de **QA manual** de wala.pe: cómo probar cada filtro de la tienda, el guardado de producto, editor/carrusel/banners/header, **errores comunes** (CORS = deploy al proyecto equivocado, índice faltante, `[object Object]`, permisos) y un **checklist POR PROBAR de la sesión 2026-06-29** (compra directa, pedidos que no desaparecen + `estadoWala`, modo noche, arrastre y foto en `/regalar`, nav de categorías, páginas de marca, tabs de cuenta). | Para probar a mano y diagnosticar sin ser experto. |
| 7 | [ops/backup/README.md](../../ops/backup/README.md) | Cómo respaldar Firestore, Storage, reglas y configuración antes de cambiar. | **Siempre antes** de un cambio en producción. |
| 8 | [ops/restore/README.md](../../ops/restore/README.md) | Cómo restaurar desde un respaldo si algo sale mal. | Solo en incidente / rollback. |
| 9 | [ESCALABILIDAD.md](./ESCALABILIDAD.md) | Plan de **escalabilidad** accionable y priorizado (Crítica/Alta/Media): seguridad y pagos (Fase 0), lecturas/escrituras e índices de Firestore, **pre-agregación diaria** de analítica/ventas, catálogo y **búsqueda server-side** (Algolia/Typesense), bundle de Vite (2.25 MB → `manualChunks`) e imágenes vía CDN, Cloud Functions (cold starts, gen1→gen2), i18n, acoplamiento ERP y observabilidad. Incluye **plan por fases** y tabla maestra de prioridades. | Antes de escalar tráfico/catálogo o de optimizar costos. |

### Orden de lectura recomendado

1. **ESTADO-DEL-PROYECTO.md** — el "dónde estamos" (estado real, cronología, fases, commits).
2. **PLAN-MAESTRO.md** — el "para qué" y el roadmap completo.
3. **fases/README.md** — el "qué fase es cuál" y su estado.
4. **BASELINE-PRODUCCION.md** — el "qué hay hoy" (este es tu punto cero).
5. **MODELO-DATOS.md** — el "cómo están organizados los datos".
6. **FASE-0-SEGURIDAD.md** — el "qué hay que arreglar antes de crecer".
7. **DESPLIEGUE.md** + **ops/backup** + **ops/restore** — el "cómo lo opero sin romperlo".
8. **PENDIENTES.md** — el "qué me toca a mí (dueño) desplegar/confirmar ya" y
   **PRUEBAS-Y-DEBUGGING.md** — el "cómo lo pruebo a mano y diagnostico errores".

---

## 2. Flujo de trabajo operativo

El ciclo de cualquier cambio que toque producción es siempre el mismo:

```
  ┌──────────────┐   ┌───────────┐   ┌──────────┐   ┌─────────┐   ┌────────────┐
  │ 1. RESPALDAR │ → │ 2. STAGING│ → │ 3. CAMBIO│ → │4. DEPLOY│ → │5. VERIFICAR│
  └──────────────┘   └───────────┘   └──────────┘   └─────────┘   └────────────┘
        │                                                                 │
        └──────────────── si algo falla: RESTORE (ops/restore) ──────────┘
```

1. **Respaldar** (`ops/backup/`): exportar Firestore, Storage, reglas y configuración del
   proyecto de producción `sistema-gestion-3b225` (portal y ERP comparten ese mismo proyecto
   y la misma base Firestore). Anotar la fecha y el commit/tag baseline. Ver
   [BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md).
2. **Staging**: aplicar y probar el cambio en un proyecto separado (objetivo del roadmap:
   separar `prod` real de `staging`; ver Fase 0 del plan). Nunca probar en producción.
3. **Cambio**: implementar en una rama (`dev` o feature), nunca commitear directo a `master`.
4. **Deploy** (`DESPLIEGUE.md`): desplegar reglas / functions / hosting / app por el canal
   correspondiente, una pieza a la vez.
5. **Verificar**: smoke test funcional (login, catálogo, checkout, fidelización), revisar
   logs de Cloud Functions y métricas, confirmar que las reglas desplegadas coinciden con
   el repo.
6. **Rollback** (`ops/restore/`): si la verificación falla, restaurar desde el respaldo del
   paso 1 y volver a `git` al commit/tag baseline.

> Estado actual: **Wala YA está en producción.** En las tandas del **2026-06-25**,
> **2026-06-27** y **2026-06-28** se desplegó a `sistema-gestion-3b225`: el **frontend** por
> **Vercel** (auto-deploy desde `master`) y el **backend** (Cloud Functions / índices /
> backfills) por **Cloud Shell**. La del **2026-06-28** desplegó las **Fases 0–4 del plan de
> [ESCALABILIDAD.md](./ESCALABILIDAD.md)** (bundle, seguridad de pagos seguro-por-defecto,
> pre-agregación de analítica, paginación/búsqueda de catálogo, observabilidad) + un **editor
> de texto enriquecido**; el dueño corrió **7 Cloud Functions + índices + 2 backfills**
> (`createdAt` recuperó 77 productos ocultos; `searchTokens`) sobre 123 productos. Lo único que
> falta cerrar en seguridad son las **reglas completas** (siguen **100 % abiertas** en
> `(default)` por el ERP compartido → fuga de PII; ver Prioridad 1; el
> `firestore.rules.propuesto` está guardado pero NO desplegado). La tanda del **2026-06-29**
> (multimarca, modo noche, **`wala_pedidos` como FUENTE DE VERDAD** con `estadoWala`, compra
> directa, regalos v3) desplegó el **frontend** por Vercel; quedan **pendientes del dueño** unos
> **redeploys de Cloud Functions** (sync de pago a `estadoWala` + foto de `/regalar`): ver
> **[PENDIENTES.md](./PENDIENTES.md)**. Detalle de qué se desplegó y
> qué falta en [ESTADO-DEL-PROYECTO.md §5](./ESTADO-DEL-PROYECTO.md) (sesión 2026-06-27 en §2
> Paso 6, sesión 2026-06-28 en §2 Paso 7, sesión 2026-06-29 en §2 Pasos 11–14).

---

## 3. Notas importantes

- **Producción es `sistema-gestion-3b225`** (ÚNICO proyecto de producción, `default` en
  `.firebaserc`). El antiguo `pruebas-cd728` **NO debe usarse**: era el proyecto equivocado
  (hubo un deploy por error ahí el 2026-06-25; ver
  [ESTADO-DEL-PROYECTO.md](./ESTADO-DEL-PROYECTO.md)).
- **Un solo proyecto Firebase compartido**: el Portal de clientes **y** el ERP viven en el
  mismo proyecto `sistema-gestion-3b225` y la misma base Firestore. Las colecciones del ERP
  (`pedidos`/`pedidos_web`) y las de analytics conviven ahí y deben estar cubiertas por sus
  reglas. **No hay un proyecto Firebase separado para el ERP**; las variables
  `REACT_APP_ERP_FIREBASE_*` quedaron obsoletas para producción.
- **Doble hosting**: Vercel (`portal-clientes-regala-con-amor`) **y** Firebase Hosting.
  Confirmar a cuál apunta el dominio antes de desplegar (ver BASELINE y DESPLIEGUE).
- **La app migró de CRA a Vite** (commit `a3c4d66`); el dev server corre en
  **http://localhost:3000** (`npm run dev`). Las variables de entorno siguen con prefijo
  **`REACT_APP_*`** (no se renombraron a `VITE_*`).
- **Herramientas no instaladas localmente** (`node`/`npm`, `firebase-tools`, `gcloud`,
  `gsutil`, `vercel`): los scripts de `ops/` y `DESPLIEGUE.md` indican qué instalar primero.
  El usuario los ejecuta manualmente; esta documentación no toca la nube por sí sola.
- Todos los scripts operativos de esta carpeta están en **PowerShell (`.ps1`)** porque el
  entorno de trabajo es **Windows / PowerShell 7**.
