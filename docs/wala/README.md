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
| 1.7 | [PLAN-I18N.md](./PLAN-I18N.md) | Plan de **internacionalización**: detección de idioma/país, UI traducida (es/en/pt, $0), popup "ver en tu idioma/original" + toggle en Header, y traducción de catálogo con **Google Cloud Translation v3 + caché Firestore**. **Nota:** la **base GRATIS ya está desplegada** (diccionarios `src/i18n/dictionaries.js` + `LanguageContext` + `LanguagePopup` + toggle ES/EN/PT, apoyada en el traductor nativo del navegador); este plan describe el siguiente paso (catálogo con API + caché). | Antes de ampliar i18n / traducción del catálogo. |
| 2 | [fases/README.md](./fases/README.md) | Índice de la carpeta de fases: tabla por fase con estado y documento asociado, leyenda y flujo de lectura. | Para navegar el roadmap fase a fase. |
| 3 | [MODELO-DATOS.md](./MODELO-DATOS.md) | Colecciones Firestore actuales y objetivo (productos, fidelización, marketplace, ERP). | Antes de tocar datos o reglas. |
| 4 | [FASE-0-SEGURIDAD.md](./FASE-0-SEGURIDAD.md) | Trabajo bloqueante de seguridad: backdoor admin, reglas, economía en cliente, webhook sin secreto (hallazgos H-01..H-11). | Antes de cualquier release; es prerequisito de todo lo demás. |
| 5 | [BASELINE-PRODUCCION.md](./BASELINE-PRODUCCION.md) | Snapshot del estado actual de producción (entornos, funciones, hosting, dominios, stack, variables). Es el respaldo documental del punto de partida. | Antes del primer cambio, para fijar el "estado conocido bueno". |
| 6 | [DESPLIEGUE.md](./DESPLIEGUE.md) | Procedimiento de despliegue (reglas, functions, hosting Firebase/Vercel, app móvil). | Cada vez que se va a desplegar. |
| 7 | [ops/backup/README.md](../../ops/backup/README.md) | Cómo respaldar Firestore, Storage, reglas y configuración antes de cambiar. | **Siempre antes** de un cambio en producción. |
| 8 | [ops/restore/README.md](../../ops/restore/README.md) | Cómo restaurar desde un respaldo si algo sale mal. | Solo en incidente / rollback. |

### Orden de lectura recomendado

1. **ESTADO-DEL-PROYECTO.md** — el "dónde estamos" (estado real, cronología, fases, commits).
2. **PLAN-MAESTRO.md** — el "para qué" y el roadmap completo.
3. **fases/README.md** — el "qué fase es cuál" y su estado.
4. **BASELINE-PRODUCCION.md** — el "qué hay hoy" (este es tu punto cero).
5. **MODELO-DATOS.md** — el "cómo están organizados los datos".
6. **FASE-0-SEGURIDAD.md** — el "qué hay que arreglar antes de crecer".
7. **DESPLIEGUE.md** + **ops/backup** + **ops/restore** — el "cómo lo opero sin romperlo".

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

> Estado actual: **Wala YA está en producción.** En las tandas del **2026-06-25** y
> **2026-06-27** se desplegó a `sistema-gestion-3b225`: el **frontend** por **Vercel**
> (auto-deploy desde `master`) y el **backend** (Cloud Functions / índices) por **Cloud
> Shell**. Lo único que falta cerrar en seguridad son las **reglas completas** (siguen
> abiertas → fuga de PII; ver Prioridad 1). Detalle de qué se desplegó y qué falta en
> [ESTADO-DEL-PROYECTO.md §5](./ESTADO-DEL-PROYECTO.md) (y la sesión 2026-06-27 en §2, Paso 6).

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
