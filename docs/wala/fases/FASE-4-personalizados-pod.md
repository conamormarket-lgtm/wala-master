# FASE 4 — Personalizados como nicho POD escalable

> **Estado global de la fase: POR HACER.**
> Documento de diseño a profundidad. Fuente: `docs/wala/PLAN-MAESTRO.md` §3.2, §5.6 y §6 (FASE 4), `docs/wala/MODELO-DATOS.md` §3.2, y lectura directa del código real (`src/services/productTypes.js`, `src/services/mockups.js`, `src/services/designs.js`, `src/pages/EditorPage.jsx`, `src/pages/CheckoutPage.jsx`, `src/components/YoryoPersonalizado/**`, `src/utils/comboImageComposer.js`).
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
- [ ] C1. Diseñar `blueprints` y migrar `productTypes`/`tienda_mockups` a esa forma (aditivo: conservar campos actuales).
- [ ] C2. Añadir `widthCm`/`heightCm`/`dpi`/`bleedMm` a cada `printArea`.
- [ ] C3. Admin de blueprints reutilizables (reusar `PrintAreaEditor`/`AdminViewEditor` del editor consolidado).
- [ ] C4. Vincular productos a blueprint vía `productionBlueprintId`.

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
