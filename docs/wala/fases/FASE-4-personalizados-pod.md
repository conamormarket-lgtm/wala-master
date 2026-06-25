# FASE 4 — Personalizados como nicho POD escalable

> **Estado global de la fase: 🔧 PARCIAL — BASE hecha y verificada (local, emulador `demo-wala`, rama `fase-0-seguridad`, NO desplegado).**
> La **base POD** ya existe y está verificada en emulador: colección `blueprints` con CRUD + admin (`/admin/blueprints`) y la **utilidad de arte de producción** (`src/utils/productionArt.js`: cm→px por DPI, export PNG en alta resolución, validación de imprimibilidad). Lo **pendiente** es la integración real en el editor (EditorPage), el PDF de producción y el fix de `finalCustomizedImage` para productos simples (ver §"Estado de implementación" y §"Pendiente Fase 4").
> Documento de diseño a profundidad. Fuente: `docs/wala/PLAN-MAESTRO.md` §3.2, §5.6 y §6 (FASE 4), `docs/wala/MODELO-DATOS.md` §3.2, y lectura directa del código real (`src/services/blueprints.js`, `src/utils/productionArt.js`, `src/pages/admin/AdminBlueprints.jsx`, `src/services/productTypes.js`, `src/services/mockups.js`, `src/services/designs.js`, `src/pages/EditorPage.jsx`, `src/pages/CheckoutPage.jsx`, `src/components/YoryoPersonalizado/**`, `src/utils/comboImageComposer.js`).
>
> Convención de estado: ✅ hecho y verificado · 🔧 parcial · ⬜ por hacer.
>
> Objetivo de la fase: llevar el **editor POD ya funcional** (fabric.js: texto enriquecido, imágenes con quitar-fondo/recorte/tinte/máscara, cliparts, formas, multi-vista frente/espalda, zonas de impresión, undo/redo, combos) de "mini-Printful que produce miniaturas" a un **sistema de producción real estilo Printful**: blueprints reutilizables, arte de producción de alta resolución y un solo motor de edición.

---

## 0. Por qué esta fase (problema concreto, citado del código)

El editor es un activo diferencial, pero **no emite arte de producción** y tiene deuda estructural:

| Problema | Evidencia | Severidad |
|---|---|---|
| **Render de producción roto para producto simple**: `finalCustomizedImage` solo se genera para combos; en simples `imageURL` queda `null` y el ERP recibe solo JSON de capas → el operario recompone a mano | `src/pages/CheckoutPage.jsx` (`handleAddToCart`), `src/utils/comboImageComposer.js` (compone solo combos) | ALTO (retrabajo manual, errores de producción) |
| **Dos motores de edición casi idénticos** | `src/pages/EditorPage.jsx` + `src/components/editor/**` **y** `src/components/YoryoPersonalizado/WALA_Editor_Export/**` (47 archivos duplicados: `EditorCanvas`, `TextEditor`, `Toolbar`, `EditorContext`, `fabricPatch.js`…) | MEDIO (mantenimiento doble, bugs divergentes) |
| **Sin medidas físicas ni DPI**: las zonas de impresión son píxeles del canvas, no cm a una resolución de impresión | `printAreas` en `productTypes`/`tienda_mockups` (sin `widthCm`/`dpi`) | ALTO (imprimibilidad no garantizada) |
| **Sin validación de imprimibilidad** (imágenes de baja resolución se aceptan) | editor de imágenes | MEDIO (reclamos de calidad) |
| **`productTypes` no es reutilizable entre vendedores POD** | `src/services/productTypes.js` | MEDIO (no escala a multi-vendor POD de Fase 3) |

> Nota de priorización (del PLAN-MAESTRO §6): **el fix del render de producción simple puede adelantarse a Fase 0/operación** si la operación actual sufre. El resto (blueprints, DPI, PDF) es propio de Fase 4.

---

## 0bis. Estado de implementación (local, verificado en emulador)

> Verificado en **emulador local `demo-wala`**, rama `fase-0-seguridad`, build con Vite. **NO desplegado** (sin acceso a Firebase aún). Super usuario local: `admin@wala.test / wala1234`; cliente: `cliente@wala.test / wala1234`.

### ✅ Blueprints — plantilla POD reutilizable (BASE verificada)

- ✅ Colección **`blueprints`** (Firestore): lectura **pública**, escritura **admin**. Servicio `src/services/blueprints.js` con CRUD completo (`getBlueprints` ordenado por `order` asc, `getBlueprint`, `createBlueprint`, `updateBlueprint`, `deleteBlueprint`).
- ✅ Forma del documento (verificada en el servicio):
  `{ name, baseGarment, printAreas:[{ name, widthCm, heightCm, dpi }], decorationMethods:[], basePrintCost, active, order }`
  con `createdAt`/`updatedAt`. `normalizePrintArea` fuerza tipos numéricos (Firestore rechaza `NaN`/`undefined`) y aplica **`dpi=300` por defecto** (estándar de imprenta POD).
- ✅ Admin CRUD en **`/admin/blueprints`** (`src/pages/admin/AdminBlueprints.jsx`), enlazado desde `src/components/AdminLayout/AdminLayout.jsx`.
- ✅ **Seed** `bp-polo`: "Polo clásico", **2 áreas** (Frente / Espalda) de **30×40 cm @ 300 dpi**.

### ✅ Utilidad de arte de producción (BASE verificada)

`src/utils/productionArt.js` — lógica pura/reutilizable (sin acoplarse aún al editor):

- ✅ **`pxFromCm(cm, dpi)`** → `Math.round((cm / 2.54) * dpi)`. **Verificado: 30 cm @ 300 dpi = 3543 px** (la medida nativa para imprenta del área del polo).
- ✅ **`exportProductionArtPNG(fabricCanvas, { dpiMultiplier = 4 })`** → exporta el lienzo fabric en **alta resolución** vía `toDataURL({ format:'png', multiplier })` (escala por encima del tamaño visible para calidad de impresión).
- ✅ **`validatePrintResolution({ imgWidthPx, areaWidthCm, dpi = 300 })`** → calcula los px necesarios (`(areaWidthCm/2.54)*dpi`) y compara con el ancho real de la imagen; devuelve `{ ok, needed, have }` para advertir/rechazar arte de baja resolución.

> En la práctica: estas piezas son la **base** del pipeline (medidas físicas → píxeles, export alta-res, validación de imprimibilidad). Todavía **no** están cableadas al flujo del editor ni al pedido; esa integración es el grueso de lo pendiente (ver abajo).

---

## 1. Objetivo

Convertir Personalizados en un **nicho POD escalable** que:

1. Genera **arte de producción real** (PNG transparente a resolución nativa / PDF con sangrado), separado del thumbnail, persistido en Storage y referenciado en el pedido.
2. Define productos sobre **blueprints reutilizables** (prenda base + zonas de impresión en cm/DPI + matriz de variantes + costo base de impresión + métodos de decoración), para que varios vendedores POD publiquen sobre el mismo blueprint.
3. **Arregla el render de productos simples** (todo producto personalizado emite `finalCustomizedImage`).
4. **Consolida los dos editores** en uno solo (deprecar `YoryoPersonalizado/WALA_Editor_Export`).
5. Valida **imprimibilidad** (resolución mínima por zona, baja-resolución bloqueada/advertida).

---

## 2. Alcance / entregables (POR HACER)

- Colección `blueprints` (evolución de `productTypes` + `tienda_mockups`) con `printAreas` en cm + DPI objetivo.
- Pipeline de arte de producción: composición a resolución nativa (no la del canvas de pantalla), export PNG transparente alta resolución y, opcionalmente, PDF/SVG con sangrado; subida a Storage; referencia en `subOrders[].items[].customizationRef` (Fase 3) o `pedidos_web` (ERP).
- Fix del render simple: `finalCustomizedImage` para todo producto personalizado, no solo combos.
- Validación de imprimibilidad: DPI efectivo por imagen colocada vs DPI objetivo de la zona; advertencia/bloqueo bajo umbral.
- Consolidación a un solo editor; eliminación de `YoryoPersonalizado/WALA_Editor_Export`.
- `fulfillmentType='print_on_demand'` (ya existe en `src/constants/marketplace.js`) como tipo de cumplimiento de estos productos; vendor POD (Fase 3).

**Excluye:** split de pago/comisiones (Fase 3), mecánicas de impulso (Fase 5).

---

## 3. Modelo de datos

Referencia: `docs/wala/MODELO-DATOS.md` §3.2. Todo **POR HACER**.

### 3.1 `blueprints/{id}` — plantilla POD reutilizable (POR HACER)

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | string | Nombre del blueprint (p.ej. "Polo algodón unisex"). |
| `baseGarment` | string | Prenda base / categoría. |
| `printAreas[]` | array | `{ id, name (frente/espalda/manga), widthCm, heightCm, dpi, bleedMm, shape (rect|vector), maskUrl }` — **medidas físicas y DPI**, no solo píxeles. |
| `mockupTemplates[]` | array | `{ viewId, baseImageUrl, areaTransform }` por vista/color (de `tienda_mockups`). |
| `variantMatrix` | map | Tallas × colores → `{ sku, extraCost, mockupRef }`. |
| `basePrintCost` | number | Costo base de impresión (insumo para comisión/precio). |
| `decorationMethods[]` | array | `dtf` \| `sublimacion` \| `bordado` \| `vinil` (afecta restricciones de arte). |
| `active` | bool | — |

### 3.2 Extensión a `productos_wala` (POR HACER)

- `productionBlueprintId` (FK a `blueprints`) — ya previsto en MODELO-DATOS §3.1.
- Mantener `customizationViews[]`/`printAreas`/`designs` existentes para compatibilidad; el blueprint pasa a ser la fuente de las medidas/DPI.

### 3.3 Arte de producción en el pedido (POR HACER)

Estructura del artefacto generado (referenciada desde `pedidos_web`/`subOrders`):

| Campo | Tipo | Descripción |
|---|---|---|
| `thumbnailUrl` | string | Imagen de presentación (la que hoy se genera para combos). |
| `productionArt[]` | array | Por zona: `{ printAreaId, pngUrl (alta res), pdfUrl?, widthPx, heightPx, dpiEffective, decorationMethod }`. |
| `layersJson` | object | JSON de capas (se conserva como respaldo editable, como hoy). |
| `printability` | map | `{ ok, warnings[] (baja resolución, fuera de zona) }`. |

---

## 4. Tareas detalladas (checklist) — POR HACER

### Bloque A — Fix render de producción simple (adelantable)
- [ ] A1. En `handleAddToCart` (`CheckoutPage.jsx`), generar `finalCustomizedImage` también para productos simples (no solo combos).
- [ ] A2. Asegurar que `imageURL` enviado al ERP nunca sea `null` para personalizados; el JSON de capas pasa a ser respaldo, no la única salida.
- [ ] A3. Verificar contra un pedido real que el operario recibe la imagen compuesta.

### Bloque B — Pipeline de arte de producción
- [ ] B1. Separar "thumbnail de pantalla" de "arte de producción": componer a **resolución nativa** (px = cm × dpi/2.54), no a la del canvas visible.
- [ ] B2. Export PNG transparente alta resolución por zona de impresión; subida a Storage con ruta `production-art/{orderId}/{subOrderId}/{printAreaId}.png`.
- [ ] B3. (Opcional) Export PDF/SVG con sangrado (`bleedMm`) para métodos que lo requieran.
- [ ] B4. Referenciar `productionArt[]` en el pedido/sub-orden; reglas de Storage que solo permitan a admin/operario ERP leer el arte.

### Bloque C — Blueprints y medidas físicas/DPI
- [x] ✅ C1. Diseñar `blueprints` — colección + servicio `src/services/blueprints.js` con CRUD (lectura pública / escritura admin). Verificado en emulador. _Migración aditiva de `productTypes`/`tienda_mockups`: ⬜ pendiente._
- [🔧] 🔧 C2. `printArea` con `widthCm`/`heightCm`/`dpi` ✅ (seed `bp-polo` 30×40 cm @ 300 dpi). Falta `bleedMm`/`shape`/`maskUrl`: ⬜.
- [x] ✅ C3. Admin de blueprints reutilizables — `/admin/blueprints` (`src/pages/admin/AdminBlueprints.jsx`). _Reúso de `PrintAreaEditor`/`AdminViewEditor`: ⬜ pendiente (depende del editor consolidado)._
- [ ] ⬜ C4. Vincular productos a blueprint vía `productionBlueprintId`.

> Nota Bloque C: la **base** de blueprints está hecha y verificada; queda la migración aditiva de los campos legados, `bleedMm`/`shape`/`maskUrl` y el enlace producto→blueprint.

### Bloque D — Validación de imprimibilidad
- [ ] D1. Calcular DPI efectivo de cada imagen colocada (px de la imagen / tamaño físico en la zona).
- [ ] D2. Advertir bajo `dpi` objetivo (p.ej. <150 dpi) y bloquear bajo un mínimo duro (p.ej. <72 dpi); registrar en `printability.warnings`.
- [ ] D3. Avisar si un objeto queda fuera de la zona/sangrado.

### Bloque E — Consolidación de editores
- [ ] E1. Diff funcional `src/components/editor/**` vs `src/components/YoryoPersonalizado/WALA_Editor_Export/**`; elegir el canónico.
- [ ] E2. Portar cualquier capacidad exclusiva del duplicado al canónico.
- [ ] E3. Eliminar `src/components/YoryoPersonalizado/**` y actualizar imports.
- [ ] E4. Regresión del editor (texto, imagen/quitar-fondo, formas, multi-vista, undo/redo, combos, móvil).

### Bloque F — Verificación
- [ ] F1. Producto simple personalizado → pedido con `productionArt` a DPI correcto.
- [ ] F2. Imagen de baja resolución → advertencia/bloqueo según umbral.
- [ ] F3. Mismo blueprint usado por dos productos/vendedores POD.

---

## 4bis. Pendiente Fase 4 (requiere editor/navegador y servicios externos)

> La **base** (blueprints + utilidad `productionArt`) está hecha y verificada en emulador. Lo que sigue requiere trabajo dentro del **editor fabric** (navegador) y/o servicios externos (Storage, CF):

- ⬜ **Integrar `productionArt` en `EditorPage`**: generar el **arte de producción** al agregar al carrito, **recortar por el área** del blueprint (`printAreas[].widthCm/heightCm/dpi`) y **validar la resolución** de las imágenes colocadas con `validatePrintResolution` (advertir bajo el DPI objetivo, bloquear bajo el mínimo duro). Hoy `productionArt.js` es lógica pura **no cableada** al flujo del editor ni al pedido.
- ⬜ **Fix del render de producto simple** (`finalCustomizedImage`): hoy solo se genera para combos; el producto simple deja `imageURL=null` y el ERP recibe solo JSON de capas (ver §0 Bloque A). Todo producto personalizado debe emitir `finalCustomizedImage`.
- ⬜ **Generación de PDF de producción** (y, opcional, SVG con `bleedMm`) por zona, además del PNG alta-res.
- ⬜ **Pipeline al pedido**: subir el arte a **Storage** (`production-art/{orderId}/{subOrderId}/{printAreaId}.png`) y referenciar `productionArt[]` en `subOrders[].items[].customizationRef`/`pedidos_web`; reglas de Storage que restrinjan la lectura a admin/operario.
- ⬜ **Blueprints — completar el modelo**: `bleedMm`/`shape`/`maskUrl` por área, `mockupTemplates[]`, `variantMatrix`, enlace `productionBlueprintId` y migración aditiva de `productTypes`/`tienda_mockups`.
- ⬜ **Consolidación de editores**: deprecar/eliminar `src/components/YoryoPersonalizado/WALA_Editor_Export/**` y dejar un solo motor (Bloque E).

---

## 5. Criterios de aceptación

1. **Todo** producto personalizado (simple o combo) genera `finalCustomizedImage`; el ERP nunca recibe solo JSON de capas.
2. El pedido incluye **arte de producción** por zona a la resolución/DPI definidos en el blueprint (px = cm × dpi).
3. Colocar una imagen por debajo del DPI objetivo produce una **advertencia visible**; por debajo del mínimo duro se **bloquea** el checkout o se exige reemplazo.
4. Un mismo `blueprint` puede ser base de **varios productos** (y de distintos vendedores POD de Fase 3) sin redefinir zonas.
5. Existe **un solo** motor de edición en el repo; `YoryoPersonalizado/WALA_Editor_Export` ya no existe y el editor consolidado pasa la regresión completa.
6. El arte de producción se guarda en Storage con reglas que lo restringen a admin/operario.

---

## 6. Dependencias

- **Depende de Fase 1** (HECHO): `fulfillmentType='print_on_demand'` ya definido en `src/constants/marketplace.js`.
- **Se integra con Fase 3**: los productos POD son de un vendor POD; el arte se referencia desde `subOrders[].items[].customizationRef`. El **fix del render simple (Bloque A)** es independiente y adelantable.
- **Independiente de Fase 2 y Fase 5** (puede ir en paralelo).
- Requiere acceso a **Firebase Storage** y, si se genera arte server-side, una CF o servicio de composición de imágenes.

---

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Composición de arte a alta resolución pesada en el cliente (memoria/CPU móvil) | Cuelgues en gama baja | Componer server-side (CF) o por lotes; degradar a generar arte al confirmar pedido, no en tiempo real. |
| Consolidar editores rompe capacidades sutiles del duplicado | Pérdida de features del editor | Diff exhaustivo + regresión guiada antes de borrar `YoryoPersonalizado`. |
| Medidas físicas mal mapeadas (px↔cm) | Arte mal escalado en producción | Calibrar contra una prenda real impresa; pruebas de impresión por método de decoración. |
| Umbral de DPI demasiado estricto frustra al usuario | Caída de conversión | Advertencia por defecto; bloqueo solo bajo mínimo duro; permitir continuar con aceptación explícita salvo casos extremos. |
| Storage de arte alta resolución crece rápido | Costo | TTL/limpieza de arte de pedidos antiguos completados; compresión sin pérdida razonable. |

---

## 8. Esfuerzo estimado

**~4 semanas** (coincide con PLAN-MAESTRO §6, FASE 4).

| Bloque | Estimado |
|---|---|
| A — Fix render simple (adelantable) | ~0.5 sem |
| B — Pipeline de arte de producción | ~1 sem |
| C — Blueprints + cm/DPI | ~1 sem |
| D — Validación de imprimibilidad | ~0.5 sem |
| E — Consolidación de editores | ~0.5–1 sem |
| F — Verificación | ~0.5 sem |

> Punto fino: la consolidación de editores (E) puede expandirse si el duplicado tiene divergencias; presupuestar holgura.
