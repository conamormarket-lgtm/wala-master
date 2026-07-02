# Sorteos y Rifas (Raffles) — módulo completo

> Documentación del **módulo de Sorteos/Rifas** de WALA. Fuente: lectura directa del
> código (`src/services/sorteos.js`, `src/pages/SorteosPage.jsx`,
> `src/pages/admin/AdminSorteos.jsx`, `src/pages/admin/AdminSorteoDetalle.jsx`,
> `src/components/AdminLayout/AdminLayout.jsx`, `functions/index.js`,
> `firebase/firestore.rules`).
>
> **Complementa a [MODELO-DATOS.md](./MODELO-DATOS.md)** (colecciones del portal) y a
> [FLUJO-PEDIDOS.md](./FLUJO-PEDIDOS.md) (reusa `processCulqiPayment` / `culqiWebhook`
> y los patrones de idempotencia de pago).
>
> **⚠️ Base compartida:** todo vive en la misma base Firestore que el ERP externo. Las
> reglas de este módulo están **escritas pero NO desplegadas** (ver §10). NUNCA se
> despliega `firestore:rules` sin permiso explícito del dueño.

---

## 1. Resumen y objetivo

El módulo permite crear **sorteos y rifas** para captar y convertir el tráfico que llega
desde los **lives de TikTok / Instagram**. El embudo previsto es:

```
  Live TikTok/IG ──► /sorteos (móvil) ──► gate de login WALA ──► participar
        │                                        │
        │                                 (captura teléfono + DNI en el perfil)
        │                                        ▼
        └──────────► impulsa descargas del app (requisitoApp)  ──► más chances
```

Objetivos concretos:

- **Llegar** desde los lives con una URL corta y móvil-first (`/sorteos`).
- **Captar datos** reales del participante (el servidor exige `phone` + `dni` en el
  perfil antes de aceptar la participación — mismo criterio que `profileIncomplete`).
- **Impulsar descargas del app**: el `requisitoApp` puede recomendar, obligar o dar una
  **chance extra** por entrar desde el app nativo (Capacitor).
- **Monetizar** opcionalmente con rifas de ticket pagado (Culqi / PayPal).
- **Viralizar** con chances por compartir y por referidos.

Toda la lógica sensible (participación, cobro, elegibilidad, azar) vive **server-side** en
Cloud Functions callables. El cliente **NUNCA** escribe en `/sorteos` ni en sus
subcolecciones (las reglas lo bloquean: ver §10).

---

## 2. Tipos de sorteo

| Tipo | `tipo` | Cómo se participa | Chances base |
| --- | --- | --- | --- |
| **Gratis** | `"gratis"` | Botón "¡Participar gratis!" → `participarSorteoGratis` | 1 (`chancesBase`) |
| **Pago (rifa)** | `"pagado"` | Compra de ticket(s) con Culqi o PayPal | 1 + nº de tickets pagados |

### Requisito de app (`requisitoApp`)

Configurable por el admin. En el formulario admin se ofrecen **3 opciones**
(`AdminSorteos.jsx:35`): `ninguno`, `recomendado`, `obligatorio`. El backend además
reconoce el valor `chanceExtra` (`functions/index.js:3405`), usado por la página pública
para mostrar la regla "entrar desde el app te da 1 chance extra".

| Valor | Efecto (server-side, `participarSorteoGratis`) |
| --- | --- |
| `ninguno` / `recomendado` / `opcional` | Sin efecto sobre la participación. |
| `obligatorio` | Debe entrar desde el app; si no, `failed-precondition` "debes entrar desde el app" (`index.js:3402`). |
| `chanceExtra` | +1 chance si `origenApp === true` (`index.js:3405`). |

> El único dato de confianza que aporta el cliente para esto es `origenApp`, derivado de
> `getClientType() === 'APP'` (`SorteosPage.jsx:397`, `tracker.js`). Todo lo demás se lee
> del token y del perfil server-side.

---

## 3. Modelo de datos

Colección raíz **`sorteos/{id}`** (`services/sorteos.js:24`) más subcolecciones. El
cliente lee el doc del sorteo y los **shards del contador**; NO escanea participantes.

### `sorteos/{id}` — documento del sorteo

Se construye en `construirDocSorteo` (`services/sorteos.js:158`); nunca se escribe
`contadorParticipantes` desde el cliente.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `titulo` | string | Obligatorio (validado en el form admin). |
| `descripcion` | string | — |
| `tipo` | `"gratis"` \| `"pagado"` | Fuerza `precioTicket=0` si es gratis. |
| `precioTicket` | number | Solo válido si `pagado`; **única fuente de verdad del cobro** (server-side). |
| `moneda` | string | Fijo `"PEN"`. |
| `requisitoApp` | string | `ninguno` / `recomendado` / `obligatorio` (+ `chanceExtra` reconocido en backend). Default `"ninguno"`. |
| `numGanadores` | number | Nº de ganadores por defecto (default 1). |
| `premio` | object | `{ nombre, imagenUrl, valor }`. |
| `heroImagenUrl` | string | Imagen principal (hero). |
| `fechaInicio` / `fechaFin` | string (`YYYY-MM-DD`) | `fechaFin` alimenta el countdown. |
| `estado` | `"borrador"` \| `"activo"` \| `"cerrado"` | La página pública solo muestra `activo`. |
| `chanceExtraCompartir` | bool | Habilita el botón "compartir → +1 chance". |
| `chanceExtraReferido` | bool | Habilita el enlace de referido. |
| `createdAt` / `updatedAt` | Timestamp | Los añade `createDocument`/`updateDocument`. |
| `contadorParticipantes` | number | **Denormalizado aproximado**; lo escribe SOLO la CF con `FieldValue.increment`. Referencia rápida en el admin. |
| `ganadores` | array | Lo escribe SOLO el servidor (`decidirGanadoresSorteo`): `[{ uid, nombre }]`. |
| `cerradoAt` | Timestamp | Lo pone el servidor al cerrar. |

### `sorteos/{id}/participantes/{uid}` — doc id = uid (idempotente)

Creado/actualizado SOLO por las CFs. `getMiParticipacion` lee **1 solo doc**.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `uid`, `nombre`, `telefono`, `correo`, `dni` | — | Snapshot del perfil server-side. |
| `tickets` | number | Gratis: 0. |
| `ticketsPagados` | number | Suma de tickets con pago confirmado. |
| `chancesBase` | number | 1. |
| `chancesExtra` | number | +1 por app / compartir / referido / ajuste admin. |
| `chancesTotal` | number | Peso usado en el sorteo. Se incrementa con `FieldValue.increment`. |
| `origenApp` | bool | Si participó desde el app. |
| `estado` | string | `"elegible"` → `"ganador"` tras el sorteo. |
| `compartioClaim` | bool | Lock de idempotencia de "compartir" (1 vez por sorteo). |
| `createdAt`, `compartioAt` | Timestamp | — |

### `sorteos/{id}/tickets/{ticketId}` — intención / auditoría de compra

Creado por `comprarTicketSorteoSecure` (autoId) o `asignarTicketsManual`.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `sorteoId`, `participanteUid` | — | — |
| `correo`, `telefono`, `dni` | — | Snapshot del comprador. |
| `cantidad` | number | Nº de tickets del intent. |
| `montoCentimos`, `moneda` | — | Monto autoritativo esperado (céntimos). |
| `pagoId` | string\|null | `chargeId` (Culqi) / `captureId` (PayPal); `null` hasta confirmar. |
| `metodoPago` | string\|null | `"culqi"` / `"paypal"` / `"manual"`. |
| `pagoConfirmado` | bool | **SOLO el servidor lo pone en `true`** (webhook/captura/manual). |
| `asignadoPor` | string | `"pago"` o `"admin"`. |
| `asignadoPorUid`, `confirmadoAt`, `createdAt` | — | Auditoría. |

### `sorteos/{id}/contador/{0..9}` — contador con shards

10 docs (`SORTEO_CONTADOR_SHARDS = 10`, cliente `services/sorteos.js:29`, backend
`index.js:3338`), cada uno `{ count }`. Evita el *hot-doc* en lives: cada +1 pega a un
shard **aleatorio**. Algún shard puede no existir todavía (cuenta 0). Ver §4.

### Otras subcolecciones (SOLO admin/CF)

| Subcolección | Escribe | Contenido |
| --- | --- | --- |
| `sorteos/{id}/sorteos_realizados/{drawId}` | `decidirGanadoresSorteo` | **Evidencia auditable**: `seed`, `poolHash`, `totalElegibles`, `numGanadores`, `ganadores`, `excluirUids`, `decididoPor`, `algoritmo`, `at`. |
| `sorteos/{id}/referralClaims/{referidoUid}` | `claimRaffleReferralSecure` | Lock: cada referido acredita 1 vez por sorteo. |
| `sorteos/{id}/chancesAjustes/{autoId}` | `grantRaffleChancesSecure` | Auditoría de ajustes manuales de chances (antes/después). |

---

## 4. Patrón de caché en la nube (pocas lecturas)

Regla dura del proyecto: **contadores en la NUBE, pocas lecturas, sin `onSnapshot` ni
escaneo de participantes**. La página pública lee 3 cosas baratas con **react-query** y
refresco por intervalo, no en tiempo real.

| Dato | Cómo se obtiene | Lecturas | Refresco |
| --- | --- | --- | --- |
| Sorteo activo | `getSorteoActivo` → filtro `estado=='activo'` (1 campo, sin índice compuesto) + orden por `createdAt` en cliente | 1 query | `staleTime` 30s |
| Mi participación | `getMiParticipacion(sorteoId, uid)` → `getDocument` id=uid | 1 doc | `staleTime` 30s |
| Contador en vivo | `getContadorSorteo` → `getDocs` de la subcolección `contador` y **suma los shards** | ≤10 docs | `refetchInterval` 20s |

- **Filtro de un solo campo** (`getSorteoActivo`, `services/sorteos.js:38`): evita índices
  compuestos; si hubiera varios activos, se ordena en cliente por `createdAt` desc (son
  poquísimos docs).
- **Suma de shards** (`getContadorSorteo`, `services/sorteos.js:88`): lee la subcolección
  `contador` completa (a lo sumo 10 docs) y suma `count`. Si un shard no existe, cuenta 0.
  **NO escanea `/participantes`**.
- **Escritura distribuida**: cada participación/confirmación incrementa un shard aleatorio
  (`Math.floor(Math.random()*SORTEO_CONTADOR_SHARDS)`), no un contador único. En la CF se
  usa `t.set(shardRef, { count: FieldValue.increment(1) }, { merge:true })`.
- La página NO usa `localStorage` para el estado del sorteo: la caché vive en react-query.
- El total mostrado prioriza la suma de shards; cae a `contadorParticipantes` denormalizado
  como respaldo aproximado (`SorteosPage.jsx:460`).

---

## 5. Cloud Functions

Todas en `functions/index.js`, API v1 (`functions.https.onCall`), salvo `culqiWebhook`
(`onRequest`). El cliente las invoca vía `httpsCallable`.

| Función | Línea | Propósito | Idempotencia / seguridad |
| --- | --- | --- | --- |
| `participarSorteoGratis` | `index.js:3345` | Participar en sorteo gratis. Valida sorteo activo+gratis, perfil (`phone`+`dni`), `requisitoApp`. | Doc participante id=`uid`; reentrar es **no-op** (`t.get` → `yaParticipa:true`). |
| `comprarTicketSorteoSecure` | `index.js:3511` | Crea la **intención** de compra (`pagoConfirmado=false`). NO cobra. Recalcula `precioTicket*cantidad` (céntimos) desde el doc del sorteo. | Precio 100% server-side; devuelve `metadata{tipo:"sorteo"}` para casar el pago. |
| `processCulqiPayment` (rama sorteo) | `index.js:743` / rama en `821` | Cobra el ticket con Culqi. Rama `metadata.tipo==="sorteo"`: recalcula el monto y **aborta si el ticket ya está pagado**. | Lock `culqiCharges/{tokenId}` + **guard anti-doble-cargo** `ticket.pagoConfirmado===true` → `throw` (`index.js:836`). |
| `culqiWebhook` (rama sorteo) | `index.js:2542` / rama en `2664` | Respaldo asíncrono del cobro Culqi. | Idempotente por `culqiWebhookEvents/{chargeId}` + `pagoId` en el helper. |
| `createPaypalTicketSorteoSecure` | `index.js:3902` | Crea la orden PayPal del ticket (monto USD derivado server-side, `reference_id=ticketId`). | Valida propiedad del ticket y que no esté pagado. |
| `capturePaypalTicketSorteoSecure` | `index.js:3955` | Captura PayPal; valida `COMPLETED` + USD esperado + `reference_id`, luego confirma. | Idempotente por `captureId` en el helper; revalida monto (tolerancia 0.01). |
| `asignarTicketsManual` | `index.js:3705` | Admin asigna tickets pagados offline. Resuelve `uid` por correo/teléfono/DNI (participante o cuenta portal; nunca crea cuentas fantasma). | Solo admin; upsert transaccional + doc de auditoría `metodoPago:"manual"`. |
| `decidirGanadoresSorteo` | `index.js:4134` | **Sorteo justo** server-side (ver §7). Cierre o re-sorteo. | Solo admin; lock `t.create(drawRef)`; no re-cierra un sorteo ya cerrado en modo cierre. |
| `sumarChanceCompartir` | `index.js:4296` | +1 chance por compartir (sistema de honor), 1 vez por sorteo. | Flag `compartioClaim` (idempotente); requiere sorteo activo + `chanceExtraCompartir`. |
| `claimRaffleReferralSecure` | `index.js:4353` | El referido acredita +1 chance al DUEÑO del `refCode`. | Lock `referralClaims/{referidoUid}` con `t.create`; anti self-referral. |
| `grantRaffleChancesSecure` | `index.js:4449` | Admin ajusta ±chances de un participante. | Solo admin; `chances` entero ≠0 (negativo permitido); **clamp `>=0`**; auditoría. |

> Helper **NO exportado**: `confirmarTicketSorteoDesdePago` (`index.js:3602`). Lo invocan
> los puntos de éxito de pago (Culqi callable, webhook, captura PayPal) cuando
> `metadata.tipo==="sorteo"`. Marca el ticket pagado + incrementa `ticketsPagados`/
> `chancesTotal` y (si el participante es nuevo) el shard del contador. Es **best-effort**
> (nunca lanza: el cobro ya ocurrió) e **idempotente por `pagoId`** (`index.js:3629`).

---

## 6. Flujo de pago (rifas de ticket)

Regla dura de dinero: **el monto lo fija SIEMPRE el servidor** (`precioTicket*cantidad`);
el `amount` del cliente es solo referencial. `pagoConfirmado` lo escribe SOLO el servidor.

```
  Selector cantidad [− N +]  (SorteosPage)
        │  handleComprar → comprarTicketSorteoSecure({ sorteoId, cantidad })
        ▼
  Ticket intención  (pagoConfirmado=false, montoCentimos, metadata{tipo:"sorteo"})
        │
   elige método
        ├──► Culqi:  processCulqiPayment({ tokenId, amount(ref), metadata })
        │            · recalcula precioTicket*cantidad (céntimos)  [index.js:821]
        │            · GUARD: si ticket.pagoConfirmado → throw     [index.js:836]
        │            · chargeAmount = montoCentimos autoritativo
        │            · confirmarTicketSorteoDesdePago(pagoId=chargeId) [index.js:1006]
        │            · webhook de respaldo, idempotente por chargeId  [index.js:2664]
        │
        └──► PayPal: createPaypalTicketSorteoSecure → orderID (USD server-side)
                     onApprove → capturePaypalTicketSorteoSecure
                     · valida COMPLETED + USD esperado + reference_id
                     · confirmarTicketSorteoDesdePago(pagoId=captureId) [index.js:4023]
```

Puntos clave:

- **El cliente reenvía la `metadata` TAL CUAL** devuelta por `comprarTicketSorteoSecure`;
  es lo que casa el cobro con el ticket y activa el recálculo/confirmación (`SorteosPage.jsx:244`).
- **Culqi**: reusa el mismo SDK `checkout-js` y la misma callable `processCulqiPayment`
  que el checkout de pedidos, sin duplicar lógica de montos. Guard síncrono anti
  doble-click con `processingRef` en el cliente (`SorteosPage.jsx:160`) **y** guard
  server-side por `ticket.pagoConfirmado` (`index.js:836`) — este último aborta ANTES de
  llamar a la API de Culqi, cubriendo un reintento con token nuevo sobre un ticket ya
  cobrado.
- **PayPal**: la orden y la captura las hace el SERVIDOR; el front solo confía en lo que
  devuelve la CF (`success===true` y `status==="COMPLETED"`). Los tickets se cobran en PEN
  vía Culqi, y el monto USD de PayPal se deriva de los céntimos PEN con la config/fx del
  proyecto (`penCentimosAUsd`, `index.js:3877`).
- **Idempotencia por `pagoId`**: `chargeId` (Culqi) / `captureId` (PayPal). Si el mismo
  cobro llega dos veces (p. ej. callable + webhook), el helper no dobla el crédito
  (`index.js:3629`). Si el ticket ya estaba confirmado por OTRO `pagoId`, se ignora y se
  loguea (sin doble crédito, `index.js:3634`).
- En error de pago, el cliente **mantiene el intento vivo** para reintentar (el backend es
  idempotente por `pagoId`).

---

## 7. "Decidir ganadores" (sorteo justo, auditable)

El RNG y la elegibilidad viven SOLO en `decidirGanadoresSorteo` (`index.js:4134`). El
cliente admin **solo dispara** la llamada y muestra el resultado + la evidencia.

### Algoritmo

1. **Azar seguro**: semilla de 32 bytes con `crypto.randomBytes(32).toString("hex")`
   (`index.js:4212`).
2. **DRBG determinista** sembrado con SHA-256 (`crearDrbgSha256`, `index.js:4077`): a partir
   de la semilla produce enteros deterministas mezclando un contador monótono en el hash
   (`sha256(seed|contador)`, 6 bytes = 48 bits por paso). Reproducible desde la semilla
   (auditable) pero impredecible sin ella.
3. **Sin sesgo**: entero uniforme en `[0, max)` por **rechazo de módulo** — descarta los
   valores por encima del mayor múltiplo de `m` que cabe en `2^48` (`index.js:4087`).
4. **Ponderado sin reemplazo** (`elegirGanadoresPonderado`, `index.js:4102`): en cada paso
   sortea un ganador con probabilidad proporcional a su `peso = max(1, chancesTotal)`, lo
   quita del pool y renormaliza. Repite hasta `N` ganadores.
5. **Solo elegibles** (`index.js:4188`):
   - Sorteo **pagado** → solo participantes con `ticketsPagados >= 1` (**regla dura: solo
     tickets con pago confirmado pueden ganar**).
   - Sorteo **gratis** → solo `estado === "elegible"` (perfil completo).
6. **N ganadores + re-sorteo**:
   - **Cierre** (sin `excluirUids`): fija `sorteos/{id}.ganadores`, pone `estado="cerrado"`
     y `cerradoAt`. **No** se puede re-cerrar un sorteo ya cerrado en modo cierre
     (`failed-precondition`, `index.js:4167`) — protege contra doble-click.
   - **Re-sorteo** (con `excluirUids` = uids de ganadores previos): vuelve a sortear
     excluyendo esos uids y **agrega** los nuevos con `arrayUnion`, sin re-cerrar
     (`index.js:4261`).

### Evidencia auditable

Se guarda en `sorteos/{id}/sorteos_realizados/{drawId}` bajo lock `t.create` y se devuelve
en la respuesta: `seed` (hex 64 chars), `poolHash` (SHA-256 del array de `{uid,peso}`
ORDENADO por uid, `index.js:4215`), `totalElegibles`, `numGanadores`, `ganadores`
(`{uid,nombre,correo,telefono,pesoUsado}`), `algoritmo: "HMAC/SHA256-DRBG"`. El modal admin
muestra Draw ID, total elegibles, semilla y hash del pool
(`AdminSorteoDetalle.jsx:616`) — la semilla + el hash permiten reproducir y verificar el
resultado de forma independiente.

---

## 8. Chances extra (mecánicas virales)

Las chances SIEMPRE las suma la CF server-side (el cliente NUNCA suma sus propias chances).

| Mecánica | Callable | Idempotencia | Notas |
| --- | --- | --- | --- |
| **Manual admin ±** | `grantRaffleChancesSecure` | Sin lock (acción admin puntual); auditoría en `chancesAjustes` | `chances` entero ≠0, **negativo permitido**; `chancesTotal`/`chancesExtra` con **clamp `>=0`** (`index.js:4564`). |
| **Compartir (honor)** | `sumarChanceCompartir` | Flag `compartioClaim` (1 vez por sorteo) | Requiere sorteo activo + `chanceExtraCompartir=true`; si ya reclamó → `{ok:true, yaReclamado:true}`. |
| **Referido** | `claimRaffleReferralSecure` | Lock `referralClaims/{referidoUid}` con `t.create` | El referido acredita +1 al DUEÑO del `refCode` (KS-XXXXXX). Anti self-referral; el dueño debe participar. |

En la página pública (`SorteosPage.jsx`):

- **Compartir**: `handleCompartir` usa `navigator.share` (móvil) o copia el enlace, y
  luego llama a `sumarChanceCompartir`. `AbortError` (usuario cerró el diálogo) no bloquea
  el reclamo.
- **Referido**: el usuario ve su `enlaceReferido = /sorteos?ref=KS-XXXXXX`. Al entrar otro
  usuario con `?ref=CODE` y participar, un `useEffect` llama a `claimRaffleReferral` UNA vez
  por montaje (guard `referidoIntentadoRef`), evitando autoacreditarse con el propio código.

---

## 9. UX admin y pública

### Rutas

| Ruta | Componente | Acceso |
| --- | --- | --- |
| `/sorteos` | `SorteosPage.jsx` (`App.jsx:401`) | Pública (carga el sorteo activo; sin id en la ruta). |
| `/admin/sorteos` | `AdminSorteos.jsx` (`App.jsx:344`) | Admin: lista + CRUD, título "🎁 Raffles — Sorteos y Rifas". |
| `/admin/sorteos/:id` | `AdminSorteoDetalle.jsx` (`App.jsx:345`) | Admin: participantes, asignar tickets, decidir ganadores, otorgar chances. |

### Sidebar

NavLink **"🎁 Raffles"** en el grupo "Diseño de Tienda", justo **debajo de "🎨 Elementos
con diseño"** y **encima de "🔗 Enlaces útiles"** (`AdminLayout.jsx:102`).

### Página pública (`/sorteos`)

- **Móvil-first** (el tráfico viene de lives en el teléfono).
- Hero del premio con fallback a placeholder, badges (GRATIS / `PEN X / ticket`, nº
  ganadores), countdown a `fechaFin` (intervalo local, no toca Firestore), contador en vivo
  (suma de shards).
- **Gate de login** con retorno: si no hay usuario, invita a `/login` con
  `state={{ from: '/sorteos' }}`; si el perfil está incompleto, redirige a
  `/completar-perfil`.
- **Gratis**: botón "¡Participar gratis!" → `participarSorteoGratis`.
- **Pago**: selector `[− N +]` → "Comprar N tickets" → intención → elegir Culqi/PayPal.
- **Chances virales**: bloque "Suma más chances" (compartir + enlace de referido) solo si el
  usuario participa, el sorteo sigue abierto y el admin activó la mecánica.
- **Revelación de ganadores**: solo con `estado==="cerrado"` y `ganadores` publicados;
  **confeti** CSS si el usuario actual ganó (`Confeti`, `SorteosPage.jsx:106`).
- Si `requisitoApp==='obligatorio'` y no viene del app: bloquea y muestra "Descargar app".

### Panel admin

- **`AdminSorteos`**: formulario (título, descripción, tipo, precio ticket si pagado,
  requisito app, nº ganadores, fechas, premio con imagen por `uploadFile`, hero, chances
  extra, estado) + vista previa en vivo + lista con editar/eliminar y enlace
  "Ver participantes / Decidir ganadores". Valida: título obligatorio; si pagado, precio > 0.
- **`AdminSorteoDetalle`**: tabla de participantes (con tope de lectura ~200; el sorteo real
  procesa TODOS server-side), "Asignar tickets manual" (correo/teléfono/DNI), "Decidir
  ganadores" (nº opcional, botón + modal de evidencia + re-sorteo) y "Otorgar chances"
  (± permite negativo).

---

## 10. Seguridad y reglas de Firestore

Las reglas (`firebase/firestore.rules`) están **ESCRITAS pero NO DESPLEGADAS**.

> ⚠️ **NUNCA** desplegar `firestore:rules` sin permiso explícito del dueño: la base es
> compartida con el ERP que corre **sin Firebase Auth**; desplegar reglas tumbó el ERP una
> vez.

```
match /sorteos/{id} {
  allow read: if true;               // Vitrina pública del sorteo.
  allow write: if isAdmin();         // Solo el admin crea/edita/cierra sorteos.

  match /participantes/{uid} {
    allow read: if isAuthenticated(); // Verificar la propia participación.
    allow write: if false;            // SOLO la CF (admin SDK) escribe.
  }
  match /contador/{shardId} {
    allow read: if true;              // La página pública suma los shards.
    allow write: if false;            // SOLO la CF escribe.
  }
  match /tickets/{ticketId} {
    allow read: if isAdmin();
    allow write: if false;            // SOLO la CF escribe.
  }
  match /sorteos_realizados/{realizadoId} {
    allow read: if isAdmin();
    allow write: if false;            // SOLO la CF escribe.
  }
}
```

Modelo de seguridad:

- El cliente **NUNCA** escribe participaciones, tickets, contadores ni ganadores: todo pasa
  por CFs que usan el admin SDK y bypasean las reglas.
- Las callables validan **server-side** el uid del token, el perfil (`phone`+`dni`), el
  estado del sorteo, el requisito de app y (en admin) `callerIsAdmin(context)`.
- El monto del ticket se recalcula server-side; `pagoConfirmado` lo escribe solo el servidor.

### Despliegue de las Cloud Functions

Las CFs las despliega **SOLO el dueño** desde Cloud Shell, respondiendo **N** a los prompts
de borrado (para NUNCA borrar funciones del ERP). Comando único de ambos módulos (Sorteos +
Enlaces):

```bash
firebase deploy --only functions:participarSorteoGratis,functions:comprarTicketSorteoSecure,functions:asignarTicketsManual,functions:createPaypalTicketSorteoSecure,functions:capturePaypalTicketSorteoSecure,functions:decidirGanadoresSorteo,functions:sumarChanceCompartir,functions:claimRaffleReferralSecure,functions:grantRaffleChancesSecure,functions:processCulqiPayment,functions:culqiWebhook,functions:registrarClicEnlace,functions:registrarVisitaEnlace
```

---

## 11. Guía de pruebas manual (paso a paso)

> Requiere que las CFs estén desplegadas y (para lecturas del cliente) las reglas activas o
> el emulador. NO desplegar reglas en producción sin permiso.

### A. Sorteo gratis

1. Como admin, en `/admin/sorteos` crea un sorteo **tipo Gratis**, `requisitoApp = Sin
   requisito`, `estado = Activo`, con premio e imagen. Marca "Chance extra por compartir" y
   "Chance extra por referido".
2. Abre `/sorteos` sin sesión → debe verse el hero, countdown y contador, con el gate
   "Inicia sesión". Verifica el retorno tras login.
3. Con un usuario de **perfil incompleto** (sin `phone`/`dni`), pulsa "¡Participar gratis!"
   → debe redirigir a `/completar-perfil`.
4. Completa el perfil y participa → el botón pasa a "Ya estás participando ✓", el panel
   muestra "Chances: 1" y el contador sube. Reentra: **no duplica** (idempotente).
5. Pulsa "Compartir y ganar +1 chance" → chances sube a 2; púlsalo de nuevo → botón
   deshabilitado (`yaReclamado`).
6. Copia tu enlace de referido y ábrelo con **otro** usuario que participe → al dueño del
   código le sube 1 chance (verificable en la tabla del admin). Con tu propio enlace: no se
   autoacredita.

### B. Rifa pagada (Culqi)

1. Crea un sorteo **tipo Pagado** con `precioTicket = 5`, `estado = Activo`.
2. En `/sorteos`, ajusta cantidad a 2 → "Total: PEN 10.00" (display). Pulsa "Comprar 2
   tickets" → se crea la intención y aparecen los métodos.
3. Paga con **tarjeta (Culqi)** con una tarjeta de prueba → tras el cargo, el panel muestra
   "Tus tickets pagados: 2" y "Chances: 3".
4. Intenta pagar de nuevo el **mismo** ticket → el servidor aborta ("Este ticket ya está
   pagado") antes de cobrar. Verifica en el admin que no hubo doble crédito.
5. (Opcional) Repite el paso 2-3 con **PayPal** en sandbox.

### C. Asignar tickets manual (admin, pago offline)

1. En `/admin/sorteos/:id` → "Asignar tickets manual", ingresa el correo/teléfono/DNI de un
   usuario **existente** y cantidad 3 → confirma. La tabla refleja `Pagados: 3`.
2. Con datos de un usuario inexistente → error claro ("no se encontró un usuario…"), sin
   crear cuentas fantasma.

### D. Decidir ganadores + evidencia

1. Con varios participantes elegibles, en "Decidir ganadores" deja el nº por defecto y pulsa
   "Decidir ganadores" → aparece el modal con ganador(es), Draw ID, total elegibles,
   **semilla** y **hash del pool**; el estado pasa a `cerrado`.
2. En un sorteo **pagado**, confirma que solo entran al pool los que tienen
   `ticketsPagados >= 1`.
3. Pulsa "Re-sortear (excluir estos ganadores)" → elige ganadores adicionales sin repetir a
   los previos; el sorteo sigue cerrado y la lista se **agrega**.
4. En `/sorteos`, con el sorteo cerrado, verifica la revelación de ganadores y (si tu uid
   ganó) el **confeti** y el banner "¡FELICIDADES, GANASTE!".

### E. Otorgar / quitar chances (admin)

1. En "Otorgar chances", suma `+2` a un participante → la tabla muestra el nuevo
   `chancesTotal`.
2. Ingresa `-100` → el total queda **clamp a 0** (no negativo). Verifica el mensaje de
   confirmación.
