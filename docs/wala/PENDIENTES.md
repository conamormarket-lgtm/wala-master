# Pendientes del DUEÑO — qué desplegar / actualizar (Cloud Shell + consola)

> **Para el dueño (no requiere programar).** Esta es la lista corta y clara de lo que **falta
> hacer del lado de producción** para que lo construido en la sesión del **2026-06-29** quede
> 100 % activo. El **frontend ya está desplegado** (Vercel auto-deploy desde `master`); lo que
> queda es **backend** (Cloud Functions) y un par de **confirmaciones de configuración**.
>
> Regla de oro del proyecto: **producción primero se respalda, después se toca** (ver
> [README.md](./README.md) y [ops/backup](../../ops/backup/README.md)). Y **nunca** se despliegan
> reglas (`firestore:rules`) tal cual sin fusionarlas con las del ERP (ver
> [PRUEBAS-Y-DEBUGGING.md §6](./PRUEBAS-Y-DEBUGGING.md) y
> [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md)).

**Proyecto de producción:** `sistema-gestion-3b225` (ÚNICO; NO `pruebas-cd728`). Portal y ERP
comparten ese proyecto y la misma base Firestore.

Leyenda: ✅ hecho · 🔧 parcial · ⬜ por hacer.

---

## 1. Desplegar Cloud Functions (lo único que bloquea features ya en vivo) ⬜

El frontend del **2026-06-29** ya está en producción, pero **dos cosas no se ven completas hasta
redesplegar funciones**:

1. **Sync de pago a la FUENTE DE VERDAD** (`wala_pedidos.estadoWala`): hoy el frontend ya escribe
   y lee `estadoWala`, pero **el pago no lo marca "pagado" hasta redesplegar** las 3 funciones de
   confirmación de pago. Sin esto, un pedido pagado puede seguir mostrándose como
   "Por confirmar pago" en "Mis Compras"/"Recepción". (Código: `marcarWalaPedidoPagado(...)` en
   `functions/index.js`, en `processCulqiPayment`, `culqiWebhook` y `capturePaypalOrderSecure`;
   ver [FLUJO-PEDIDOS.md §4-bis.5 / §4-bis.9](./FLUJO-PEDIDOS.md).)
2. **Foto de la persona en `/regalar`**: el frontend ya muestra las **tarjetas grandes**, pero la
   **foto** (y `roleKey`/`gender` para las ocasiones) solo llegan a la página pública cuando se
   redesplega `getPublicGiftRegistry`. (Código: `getPublicGiftRegistry` en `functions/index.js`;
   ver [FUNCIONES-CLIENTE.md](./FUNCIONES-CLIENTE.md) y
   [PLAN-FECHAS-ESPECIALES.md](./PLAN-FECHAS-ESPECIALES.md).)

### Comando combinado (un solo deploy, recomendado)

En **Cloud Shell**, desde la carpeta del proyecto:

```bash
firebase deploy \
  --only functions:processCulqiPayment,functions:culqiWebhook,functions:capturePaypalOrderSecure,functions:getPublicGiftRegistry \
  --project sistema-gestion-3b225
```

- Si quieres separarlos, puedes hacer dos deploys (uno con las 3 de pago, otro con
  `functions:getPublicGiftRegistry`); el combinado de arriba hace lo mismo en un paso.
- **Si te pregunta si borrar funciones/índices del ERP → responde `N` (No).** Son del ERP/CRM
  compartido (ver [DESPLIEGUE-ESTADO.md §4](./DESPLIEGUE-ESTADO.md)).
- Estas funciones marcan pago/exponen la foto pero **no cambian montos ni la firma del pedido**:
  el cambio es **aditivo, idempotente y best-effort** (un fallo no rompe el cobro ni el checkout).

> **Nota:** desplegar el **sync de pago no rompe nada si aún no está**: hasta entonces el portal
> simplemente muestra el estado derivado del ERP como siempre; el campo `estadoWala` ya existe y
> queda listo para cuando se redesplegue.

---

## 2. Confirmar las REGLAS de Firestore en producción 🔧

> **NUNCA `deploy --only firestore:rules` sin consultar.** Tumbó el ERP una vez (base compartida
> sin Firebase Auth). Esta sección es para **CONFIRMAR**, no para desplegar a ciegas.

Hay **tres** archivos de reglas en el repo (`firebase/`), y es clave saber **cuál está vivo**:

| Archivo | Borrado de `wala_pedidos` y demás | Cuándo usarlo |
|---|---|---|
| **`firebase/firestore.rules`** | `delete: if isAdmin()` (modelo restrictivo, sin catch-all abierto) | ✅ **El que debe estar en producción** |
| `firebase/firestore.rules.produccion` | catch-all `match /{document=**} { allow read, write: if isAuth() }` → **`delete: if isAuth()`** | ⚠️ Modelo abierto a cualquier logueado |
| `firebase/firestore.rules.propuesto` | Cierra el `update` de `pedidos_web` | ⬜ **Guardado pero NO desplegado** |

- ⬜ **Confirmar que en producción esté el equivalente a `firebase/firestore.rules`**
  (`delete: if isAdmin()`) y **NO** `firestore.rules.produccion` (`delete: if isAuth()`). La
  colección **`wala_pedidos` es la FUENTE DE VERDAD y jamás debe poder borrarla un cliente
  logueado** — solo admin (o, idealmente, nadie). Con el modelo restrictivo de
  `firestore.rules`, una colección sin regla propia **no se puede borrar** por defecto; con el
  catch-all de `.produccion`, **cualquier usuario autenticado podría borrarla**.
- ⬜ **`firestore.rules.propuesto` queda guardado pero NO se despliega todavía.**
  **Precondición:** que **PayPal esté validado server-side** (cierra el `update` de `pedidos_web`
  que hoy aún necesita el flujo de pago). Ver
  [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md) y
  [ESTADO-DEL-PROYECTO.md](./ESTADO-DEL-PROYECTO.md).
- Cualquier despliegue de reglas debe **fusionarse** antes con las reglas vivas del ERP/CRM (el
  repo no cubre las decenas de colecciones del ERP) y validarse en **Rules Playground**.

---

## 3. FASE SIGUIENTE — Endpoint con API KEY para el ERP ⬜

> **No hecha. El campo ya está listo; falta el endpoint/credencial.**

La base interna **`wala_pedidos`** ya es la **FUENTE DE VERDAD** con su propio `estadoWala`
(`pendiente_pago → pagado → en_preparacion → enviado → entregado`; `cancelado` terminal). El
siguiente paso es conectar el **ERP externo** para que la mantenga al día **sin poder borrarla**:

- ⬜ **Endpoint protegido con API KEY** que permita al ERP **LEER** los pedidos y **SOLO
  ACTUALIZAR el estado** (`estadoWala`) — **jamás borrar**.
- El frontend ya expone `updateWalaOrderEstado({ numeroPedido, pedidoWebId, estado, extra })` en
  `src/services/walaOrders.js` (idempotente, best-effort), así que la lógica de actualización ya
  existe; lo que falta es el **endpoint + la credencial** del lado del ERP.
- Detalle del flujo y del contrato en [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) (§4-bis) y modelo en
  [MODELO-DATOS.md](./MODELO-DATOS.md) (§3.7).

---

## 4. Recordatorio de lo que NO toca esta tanda

- **No** hay cambios de **montos, firma del pedido, ni del marcado de `pedidos_web`**: todo lo de
  pedidos del 2026-06-29 es **aditivo** (`estadoWala` + el espejo `wala_pedidos`).
- **No** se desplegaron **reglas** ni **Storage** en esta sesión (solo se documentan).
- El **modo noche**, **compra directa**, **tabs de la cuenta** y **tarjeta clickeable** son
  **frontend puro** (CSS + estado de cliente): **ya están en vivo, no requieren backend**.

---

## 5. Checklist rápido (marca al terminar)

- [ ] Respaldo hecho antes de tocar producción (regla de oro).
- [ ] `firebase deploy --only functions:processCulqiPayment,functions:culqiWebhook,functions:capturePaypalOrderSecure,functions:getPublicGiftRegistry --project sistema-gestion-3b225` ejecutado, respondiendo **`N`** a borrar funciones/índices del ERP.
- [ ] Probado: pagar un pedido y ver que en "Mis Compras" queda **"Pagado"** y **persiste** (ver [PRUEBAS-Y-DEBUGGING.md](./PRUEBAS-Y-DEBUGGING.md)).
- [ ] Probado: en `/regalar` se ve la **foto de la persona** en su tarjeta.
- [ ] Confirmado que producción tiene `firebase/firestore.rules` (`delete: if isAdmin()`) y **NO** `firestore.rules.produccion`.
- [ ] `firestore.rules.propuesto` **NO** desplegado (esperando PayPal server-side).
- [ ] (Futuro) Endpoint con API KEY para que el ERP actualice `estadoWala` sin borrar.

---

> Documentos relacionados: [PRUEBAS-Y-DEBUGGING.md](./PRUEBAS-Y-DEBUGGING.md) (qué probar tras
> desplegar), [DESPLIEGUE-ESTADO.md](./DESPLIEGUE-ESTADO.md) (qué está desplegado y qué falta),
> [DESPLIEGUE.md](./DESPLIEGUE.md) (procedimiento), [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) y
> [MODELO-DATOS.md](./MODELO-DATOS.md) (`wala_pedidos`/`estadoWala`),
> [PLAN-SEGURIDAD-REGLAS.md](./PLAN-SEGURIDAD-REGLAS.md) (las reglas) y
> [README.md](./README.md) (índice).
