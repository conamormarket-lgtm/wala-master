# Sorteo por Suscripción ("No Hay Sin Suerte") — módulo completo

> Documentación del **módulo de Sorteo por Suscripción** de WALA (estilo Jorge Luna /
> "No Hay Sin Suerte"). Fuente: lectura directa del código
> (`src/services/suscripcionSorteos.js`, `src/pages/SuscripcionSorteoPage.jsx`,
> `src/pages/suscripcion/PagoSuscripcion.jsx`,
> `src/pages/admin/AdminSuscripcionSorteos.jsx`,
> `src/pages/admin/AdminSuscripcionDetalle.jsx`, `functions/index.js`,
> `firebase/firestore.rules`, `firestore.indexes.json`).
>
> **Complementa a [SORTEOS-Y-RIFAS.md](./SORTEOS-Y-RIFAS.md)** (módulo de sorteos de pago
> único) y a [MODELO-DATOS.md](./MODELO-DATOS.md). Este módulo es **100 % ADITIVO**: NO
> toca `processCulqiPayment` / `culqiWebhook` / `createPaypalOrderSecure` /
> `capturePaypalOrderSecure` ni sus locks (`culqiCharges`, `culqiWebhookEvents`), y reusa
> el mismo **motor de azar auditable** que `decidirGanadoresSorteo`
> (`crearDrbgSha256` + `elegirGanadoresPonderado` + semilla cripto + `poolHash`).
>
> **Estado de reglas e índices:** a diferencia del módulo de sorteos, las reglas
> (`firebase/firestore.rules`) y los índices (`firestore.indexes.json`) de **este**
> módulo **ya están escritos Y DESPLEGADOS** (ver §9 y §11).

---

## 1. Resumen y objetivo

La gente se **suscribe** a un plan con **auto-débito** (cobro automático recurrente de la
tarjeta / cuenta) y **por eso** participa en los sorteos de la campaña. Es el modelo
"suscripción → participación" popularizado por Jorge Luna ("No Hay Sin Suerte"):

```
  Landing pública /suscrito-sorteo ──► login Google ──► consentimiento de cobro recurrente
        │                                                        │
        │                                          Culqi (Perú) / PayPal (internacional)
        │                                                        ▼
        └──────► suscripción ACTIVA con auto-débito ──► participa en cada sorteo
                        (más meses de plan = más chances)
```

Ideas clave (regla dura del módulo):

- **Solo suscriptores con pago vigente pueden ganar.** La elegibilidad exige
  `estado == "activo"` **Y** `vigenciaHasta >= ahora`
  (`functions/index.js:5798-5799`).
- **Más meses = más chances.** El peso en el sorteo es proporcional a las chances del
  plan (mensual ×1 … anual ×12 por defecto).
- **El monto lo pone SIEMPRE el servidor** (`plan.precioCentimos` para Culqi/PEN,
  `plan.precioUsd` para PayPal); el cliente nunca lo reenvía como autoritativo.
- **Pocas lecturas:** la página pública lee 1 doc de campaña + subcolecciones cacheables
  + la suma de ~10 shards del contador; **nunca** escanea la subcolección de
  suscriptores (`src/services/suscripcionSorteos.js:4-8`).

Toda la lógica sensible (cobro, elegibilidad, azar) vive **server-side** en Cloud
Functions. El cliente **NUNCA** escribe en `sorteos_suscripcion` ni en sus subcolecciones
de suscriptores/recibos (las reglas lo bloquean: ver §9).

---

## 2. Tipos de plan y cobro recurrente

Cada campaña define uno o más **planes**. El `intervalo` fija automáticamente los `meses`
del ciclo de cobro (`AdminSuscripcionSorteos.jsx:36-43`):

| `intervalo` | `meses` | Chances por ciclo (por defecto) |
| --- | --- | --- |
| `mensual` | 1 | 1 |
| `trimestral` | 3 | 3 |
| `semestral` | 6 | 6 |
| `anual` | 12 | 12 |

Las **chances son proporcionales a los meses** del plan: `chancesPorCiclo` por defecto =
`meses` (`suscripcionSorteos.js:261`, `functions/index.js:4989-4992`), aunque el admin
puede sobrescribirlas. Cada ciclo pagado acredita `chancesPorCiclo` chances.

### Cobro recurrente por pasarela

- **Culqi (Perú)** — el backend crea un **Customer + Card** en Culqi (guarda la tarjeta),
  cobra el primer periodo al suscribirse, y a partir de ahí un **CRON diario** cobra las
  renovaciones vencidas usando la tarjeta guardada (`source_id = culqiCardId`).
  Ver §4 (`crearSuscripcionCulqi`, `cobrarSuscripcionesCulqi`).
- **PayPal (internacional)** — usa **PayPal Subscriptions**: el backend asegura un
  Product + Billing Plan y crea una Subscription (`vault:true`, `intent:"subscription"`);
  PayPal cobra automáticamente cada ciclo y notifica por **webhook firmado**.
  Ver §4 (`crearSuscripcionPaypal`, `confirmarSuscripcionPaypal`,
  `paypalSubscriptionWebhook`).

El monto autoritativo por pasarela es distinto: **Culqi cobra `plan.precioCentimos`**
(céntimos PEN, entero) y **PayPal cobra `plan.precioUsd`** (USD).

---

## 3. Modelo de datos (Firestore)

Colección raíz: **`sorteos_suscripcion/{campaignId}`**.

### 3.1 Documento de campaña — `sorteos_suscripcion/{id}`

Contrato construido en `suscripcionSorteos.js:229-268` (`construirDocCampana`):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `titulo` | string | Título de la campaña. |
| `slug` | string | URL-safe, **único** en la colección (`slugUnico`). |
| `descripcion` | string | Texto de la landing. |
| `estado` | `"borrador"` \| `"activo"` \| `"cerrado"` | `borrador` = oculta al público. |
| `heroImagenUrl`, `logoUrl` | string | Imágenes (Storage). |
| `colores` | `{ primario, fondo, texto, acento }` | Theming inyectado como vars CSS `--sus-*`. |
| `numGanadores` | number | Nº de ganadores por defecto del sorteo. |
| `premios` | `[{ nombre, imagenUrl }]` | Vitrina de premios. |
| `planes` | `[Plan]` | Ver estructura abajo (define el **monto autoritativo**). |
| `contadorSuscriptores` | number | Denormalizado (mantenido por la CF vía shards). **El cliente nunca lo escribe.** |
| `ganadores` | `[{ uid, nombre }]` | Ganadores fijados por `decidirGanadoresSuscripcion`. |
| `ultimoSorteoAt` | Timestamp | Fecha del último cierre. |

Estructura de cada **Plan** (`planes[]`):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | string | Id estable del plan (`plan_0`, `plan_<timestamp>`…). |
| `nombre` | string | Nombre visible. |
| `intervalo` | `mensual`\|`trimestral`\|`semestral`\|`anual` | Fija `meses`. |
| `meses` | `1`\|`3`\|`6`\|`12` | Duración del ciclo. |
| `precioCentimos` | number (entero) | **PEN en céntimos** — monto Culqi server-side. |
| `precioUsd` | number | **USD** — monto PayPal server-side. |
| `chancesPorCiclo` | number | Chances acreditadas por ciclo (por defecto = `meses`). |
| `beneficios` | string[] | Lista de beneficios del plan. |
| `destacado` | bool | Marca "⭐ Recomendado". |
| `orden` | number | Orden de presentación. |

### 3.2 Subcolecciones de la campaña

**`sorteos_suscripcion/{id}/suscriptores/{uid}`** — 1 doc por usuario (id = uid). Escrito
SOLO por las CFs (`crearSuscripcionCulqi:5162`, `confirmarSuscripcionPaypal:5558`):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `uid` | string | Igual al id del doc. |
| `nombre`, `nombres`, `apellidos`, `correo`, `telefono`, `dni`, `tipoDocumento`, `fechaNacimiento`, `pais` | | Perfil normalizado (`normalizarDatosSuscriptor:4939`). |
| `planId`, `intervalo`, `meses` | | Plan contratado. |
| `chancesPorCiclo` | number | Del plan. |
| `chancesExtra` | number | Ajustes manuales del admin (clamp ≥ 0). |
| `chancesTotal` | number | Peso efectivo en el sorteo (`chancesPorCiclo + chancesExtra`). |
| `estado` | `activo`\|`vencido`\|`cancelado`\|`pendiente_pago` | Solo `activo` + vigente participa. |
| `metodoPago` | `culqi`\|`paypal` | |
| `vigenciaHasta` | Timestamp | Hasta cuándo está vigente el periodo pagado. |
| `proximoCobro` | Timestamp | Cuándo re-cobrar (lo usa el cron / índice). |
| `intentosFallidos` | number | Reintentos de cobro Culqi (> 3 → `vencido`). |
| `culqiCustomerId`, `culqiCardId` | string\|null | Solo Culqi. |
| `paypalSubscriptionId` | string\|null | Solo PayPal. |
| `createdAt`, `updatedAt` | Timestamp | |

**`.../suscriptores/{uid}/recibos/{id}`** — un recibo por cobro
(`crearSuscripcionCulqi:5182`, cron `:5332`, webhook PayPal `:5734`): `periodo` (YYYY-MM-DD
Lima), `montoCentimos`/`montoUsd`, `moneda`, `metodoPago`, `pagoId`, `fecha`. El id del
recibo es el `chargeId` de Culqi o `paypal_<pagoId>` / `paypal_confirm_<periodo>` para
idempotencia.

**`.../beneficios/{id}`** — marcas/descuentos aliados (`createBeneficio:309`): `marca`,
`titulo`, `descuento`, `imagenUrl`, `categoria`, `ubicacion`, `url`, `orden`.

**`.../ganadores_galeria/{gid}`** — galería de ganadores anteriores (`createGanadorGaleria:335`):
`nombre`, `premio`, `fotoUrl`, `fecha`, `orden`.

**`.../contador/{0..9}`** — shards del contador (`SUSCRIPCION_SHARDS = 10`,
`suscripcionSorteos.js:27` = `functions/index.js:4902`). Cada shard tiene `{ count }`; la
página suma los ~10 shards (`getContadorSuscriptores:132`) en vez de escanear
suscriptores.

**`.../sorteos_realizados/{drawId}`** — evidencia auditable de cada sorteo
(`decidirGanadoresSuscripcion:5847`): `seed`, `poolHash`, `totalElegibles`, `numGanadores`,
`ganadores[]` (con `pesoUsado`), `excluirUids`, `decididoPor`,
`algoritmo:"HMAC/SHA256-DRBG"`, `createdAt`.

**`.../chancesAjustes/{id}`** — auditoría de ajustes manuales de chances
(`grantChancesSuscripcion:5991`): `uid`, `chances`, `motivo`, `por`, `chancesTotalAntes`,
`chancesTotalDespues`, `at`.

### 3.3 Colecciones raíz de idempotencia (internas)

Escritas SOLO por las CFs (Admin SDK); el cliente no las lee ni escribe (ver §9):

| Colección | Doc id | Propósito |
| --- | --- | --- |
| `suscripcionCharges/{subId}__{periodo}` | `{uid}_{campaignId}__YYYY-MM-DD` | Lock de cobro por periodo (`t.create`); estados `processing`/`charged`/`succeeded`/`failed`. Evita re-cobrar el mismo periodo. |
| `paypalSubEvents/{eventId}` | id de evento PayPal | Idempotencia del webhook (`t.create`); marca eventos ya procesados. |
| `paypalPlanes/{campaignId__planId}` | | Cache del `paypalPlanId` / `productId` de PayPal por (campaña, plan), para no recrearlos (`asegurarPaypalPlan:5383`). |

---

## 4. Cloud Functions

Todas viven en `functions/index.js`. `requireAuth` exige usuario logueado;
`callerIsAdmin` exige admin. El módulo reusa helpers propios: `suscripcionPeriodoStr`
(`:4913`), `sumarMeses` (`:4926`), `normalizarDatosSuscriptor` (`:4939`),
`leerCampanaYPlan` (`:4966`), `incrementarContadorSuscriptores` (`:4998`).

| CF | Tipo / Trigger | Propósito | Idempotencia | Seguridad |
| --- | --- | --- | --- | --- |
| `crearSuscripcionCulqi` (`:5011`) | `onCall` | Crea Customer + Card en Culqi, cobra el 1.er periodo (`plan.precioCentimos`, PEN, server-side) y hace UPSERT del suscriptor + recibo (+ shard si es nuevo). | Lock `suscripcionCharges/{subId}__{periodo}` con `t.create` (`:5037-5060`); `succeeded` = devuelve estado vigente; `processing` = rechaza; `failed` = pide reintentar (token de un solo uso). | `requireAuth`. Monto autoritativo del plan; `tokenId` nunca fija el precio. |
| `cobrarSuscripcionesCulqi` (`:5216`) | `onSchedule` `"0 9 * * *"` `America/Lima`, `retryCount:2` | **CRON diario**: cobra las **renovaciones Culqi vencidas**. `collectionGroup("suscriptores")` acotado por índice `(estado, proximoCobro)` → solo `estado=="activo"` con `proximoCobro <= ahora`; filtra `metodoPago=="culqi"` en memoria; pagina por lotes de 100. Extiende vigencia; en fallo +1 intento y `> 3` → `vencido`. | Lock `suscripcionCharges/{subId}__{periodoActual}` por periodo (`:5260`); registra `chargeId` en el lock ANTES de acreditar (no pierde el hecho del cobro). Recibo con id = `chargeId`. | **Best-effort: nunca lanza**; loguea. Nunca marca `vencido` a quien ya pagó (reconciliación manual si cobró pero no acreditó, `:5346-5348`). |
| `crearSuscripcionPaypal` (`:5460`) | `onCall` | Asegura Product + Billing Plan (`asegurarPaypalPlan`, USD, ciclos infinitos) y crea la **Subscription**; devuelve `subscriptionId` + `approveUrl`. `custom_id = "campaignId\|planId\|uid"` liga la subscription al webhook. | `PayPal-Request-Id` estable por campaña/plan para Product/Plan; cache en `paypalPlanes`. | `requireAuth`. Monto = `plan.precioUsd` server-side. |
| `confirmarSuscripcionPaypal` (`:5501`) | `onCall` | Tras aprobar, hace `GET` de la subscription. **Solo acredita vigencia + recibo si `status == ACTIVE`** (primer cobro confirmado). `APPROVED` = queda `pendiente_pago` (NO elegible) hasta que el webhook lo active. | Recibo `paypal_confirm_{periodo}` (`set merge`). | `requireAuth`. No acredita sin cobro real. |
| `paypalSubscriptionWebhook` (`:5640`) | `onRequest` (endpoint HTTP) | Eventos de facturación recurrente PayPal: `PAYMENT.SALE.COMPLETED` / `BILLING.SUBSCRIPTION.ACTIVATED` → extiende vigencia + recibo; `CANCELLED` → `cancelado`; `SUSPENDED`/`EXPIRED` → `vencido`. Localiza al suscriptor por `paypalSubscriptionId` (o fallback `custom_id`). | Lock `paypalSubEvents/{eventId}` con `t.create` (`:5658`). Nunca crea un suscriptor "fantasma" desde el webhook. | **FIRMA VERIFICADA + FAIL-CLOSED** (ver abajo). Nunca responde 500 (evita reintentos infinitos). |
| `decidirGanadoresSuscripcion` (`:5763`) | `onCall` | Ejecuta el sorteo entre elegibles (ver §6). Sin `excluirUids` = cierre normal (`set` ganadores); con `excluirUids` = **re-sorteo** (`arrayUnion`). Escribe evidencia en `sorteos_realizados`. | Doc `sorteos_realizados/{drawId}` con `t.create`. | `callerIsAdmin`. |
| `cancelarSuscripcion` (`:5879`) | `onCall` | El propio usuario cancela SU suscripción. Si es PayPal, cancela la subscription en PayPal (detiene el auto-débito). Marca `estado="cancelado"` pero **respeta `vigenciaHasta`** (sigue participando hasta el fin del periodo pagado). | — | `requireAuth`; solo su propio doc (id = uid). |
| `grantChancesSuscripcion` (`:5927`) | `onCall` | Ajusta `chancesExtra`/`chancesTotal` de un suscriptor (busca por correo/telefono/dni). Permite negativo; `clamp >= 0`. Registra auditoría en `chancesAjustes`. | Ajuste transaccional + `chancesAjustes/{id}` con `t.create`. | `callerIsAdmin`. Nunca crea suscriptores fantasma. |

### Firma del webhook de PayPal (fail-closed)

`verificarFirmaPaypalWebhook` (`functions/index.js:5594-5631`) verifica cada evento contra
la API oficial **`/v1/notifications/verify-webhook-signature`**. Es **FAIL-CLOSED**:

- Si falta **`PAYPAL_WEBHOOK_ID`** → devuelve `false` y **rechaza** el evento (`:5595-5599`).
- Si faltan las cabeceras de transmisión (`paypal-transmission-id/-time/-sig`,
  `paypal-cert-url`, `paypal-auth-algo`) → rechaza (`:5606-5609`).
- Solo procesa si la API responde `verification_status == "SUCCESS"` (`:5626`).

Esto impide que alguien **forje** un `PAYMENT.SALE.COMPLETED` para activar una suscripción
sin pagar (lo que contaminaría la elegibilidad del sorteo). El handler responde `403` a las
firmas inválidas (`:5647-5649`).

---

## 5. Flujo de suscripción (UX)

El modal `ModalSuscripcion` (`SuscripcionSorteoPage.jsx:680`) tiene 4 pasos: **login →
datos + consentimiento → pago → éxito**.

1. **Gate de login (prioriza Google).** Sin usuario, el modal muestra "Continuar con
   Google" (`signInWithGoogle`, web + nativo Capacitor) (`:803-813`).
2. **Datos mínimos + consentimiento de cobro recurrente.** Se piden nombres (correo
   autocompletado, no editable) y un **checkbox de consentimiento explícito** que declara
   el monto y periodicidad reales del plan y es **obligatorio** para avanzar
   (`:834-847`, `continuarAPago:739`).
3. **Método de pago** (`PagoSuscripcion.jsx`):
   - **Culqi (Perú)** — `CulqiSuscripcionButton` carga el SDK `checkout-js`, tokeniza la
     tarjeta y en el callback `culqi()` toma `token.id`, luego llama
     `crearSuscripcionCulqi({ campaignId, planId, tokenId, datos, origenApp })`
     (`PagoSuscripcion.jsx:89-117`). Guard síncrono anti doble-suscripción.
   - **PayPal (internacional)** — `PaypalSuscripcionButtons` con
     `{ vault:true, intent:"subscription" }`; `createSubscription` →
     `crearSuscripcionPaypal` (devuelve el `subscriptionId`), `onApprove` →
     `confirmarSuscripcionPaypal` (`PagoSuscripcion.jsx:175-208`). Si el backend responde
     `pendiente=true`, el modal muestra el paso "⏳ Tu suscripción se está activando"
     (se activará al confirmarse el primer cobro).
4. **Éxito** — toast "¡Suscripción activada! Ya participas en los sorteos."

El **monto lo procesa el servidor**: el importe mostrado en el botón es solo referencial
(`PagoSuscripcion.jsx:67`, `:12-13`).

---

## 6. Decidir ganadores (solo activos + vigentes, RNG cripto ponderado)

`decidirGanadoresSuscripcion` (`functions/index.js:5763`):

1. **Elegibilidad server-side.** Lee suscriptores paginados (300/página) con
   `estado == "activo"` **Y** `vigenciaHasta >= ahora` (`:5797-5801`). Un suscriptor
   `vencido`, `cancelado` o `pendiente_pago`, o cuyo periodo ya expiró, **no entra al
   pool**. Si `excluirUids` está presente, se descartan (re-sorteo).
2. **Pool ponderado.** `peso = max(1, chancesTotal)` por suscriptor (`:5824`): más meses de
   plan / más chances = más peso.
3. **RNG seguro y auditable** (mismo motor que `decidirGanadoresSorteo`): semilla
   `crypto.randomBytes(32)` → `crearDrbgSha256(seed)` → `elegirGanadoresPonderado`; se
   calcula un `poolHash` = SHA-256 del pool ordenado por uid (`:5828-5836`).
4. **Evidencia.** Se guarda `sorteos_realizados/{drawId}` con `seed`, `poolHash`,
   `totalElegibles`, `ganadores` (con `pesoUsado`), `algoritmo`, `decididoPor`
   (`:5847-5857`). La semilla + el hash permiten **verificar el resultado de forma
   independiente**.
5. **Fijado de ganadores.** Cierre normal → `set` en `campaign.ganadores`; re-sorteo →
   `arrayUnion` (`:5859-5863`).

Si no hay elegibles, lanza `failed-precondition` ("No hay suscriptores elegibles con pago
vigente"). El admin ve ganadores + evidencia (drawId, semilla, poolHash) en el modal de
`AdminSuscripcionDetalle.jsx:468-568`.

---

## 7. UX pública y admin (rutas, sidebar)

### Rutas públicas

| Ruta | Página | Notas |
| --- | --- | --- |
| `/suscrito-sorteo` | `SuscripcionSorteoPage.jsx` | Sin slug: intenta `getCampaignBySlug("suscrito-sorteo")`; si no, la 1.ª campaña `activo`. |
| `/suscrito-sorteo/:slug` | `SuscripcionSorteoPage.jsx` | Campaña por slug. Solo se muestra si `estado != "borrador"`. |

La landing muestra: hero + logo + **contador de suscriptores en vivo** (suma de shards,
refetch suave cada 30 s, **no** `onSnapshot`), planes, premios, galería de ganadores,
beneficios (con filtro por categoría) y, si el usuario está logueado, **"Mi cuenta"** con
pestañas **Mi suscripción** (estado/vigencia/próximo cobro + cancelar), **Mis chances** y
**Mis recibos** (bajo demanda).

### Rutas admin

| Ruta | Página | Notas |
| --- | --- | --- |
| `/admin/sorteos-suscripcion` | `AdminSuscripcionSorteos.jsx` | Lista de campañas + editor (datos, colores, planes, premios, beneficios, galería) + vista previa. |
| `/admin/sorteos-suscripcion/:id` | `AdminSuscripcionDetalle.jsx` | Tabla de suscriptores (parcial, tope admin) + **Decidir ganadores** / **Re-sortear** + **Otorgar/quitar chances**. |

**Sidebar:** NavLink **"🎟️ Sorteo por suscripción"** justo debajo de **"🎁 Raffles"**.

> **Publicar una campaña** (`estado="activo"`) exige al menos un plan **comprable**
> (`precioCentimos > 0` o `precioUsd > 0`); el editor lo valida antes de guardar
> (`AdminSuscripcionSorteos.jsx:255-263`).

---

## 8. Servicio de front (`suscripcionSorteos.js`)

Convención de retorno `{ data, error }`. Lecturas públicas: `getCampaignBySlug`,
`getCampaignById`, `getMiSuscripcion` (1 doc por uid), `getContadorSuscriptores` (suma de
shards), `getBeneficios`, `getGanadoresGaleria`, `getRecibos`. CRUD admin de campañas /
beneficios / galería. Wrappers de callables: `crearSuscripcionCulqi`,
`crearSuscripcionPaypal`, `confirmarSuscripcionPaypal`, `cancelarSuscripcion`,
`decidirGanadoresSuscripcion`, `grantChancesSuscripcion`. Helpers de presentación:
`slugify`, `formatoPrecioPen` (céntimos → "S/ X.XX"), `formatoPrecioUsd`.

---

## 9. Seguridad y reglas (desplegadas)

`firebase/firestore.rules:343-393`. Las reglas **están desplegadas** para este módulo.

```
match /sorteos_suscripcion/{id} {
  allow read: if true;                 // vitrina pública de la campaña
  allow write: if isAdmin();           // solo el admin crea/edita
  match /beneficios/{b}        { allow read: if true;  allow write: if isAdmin(); }
  match /ganadores_galeria/{g} { allow read: if true;  allow write: if isAdmin(); }
  match /contador/{s}          { allow read: if true;  allow write: if false; }   // suma de shards; solo la CF escribe
  match /suscriptores/{uid} {
    allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());  // dueño o admin
    allow write: if false;             // solo la CF (Admin SDK) escribe
    match /recibos/{r} {
      allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
      allow write: if false;
    }
  }
  match /sorteos_realizados/{d} { allow read: if isAdmin(); allow write: if false; }
}
match /suscripcionCharges/{c} { allow read: if false; allow write: if false; }   // interno
match /paypalSubEvents/{e}    { allow read: if false; allow write: if false; }   // interno
```

Notas:

- Suscriptores y recibos: **read dueño-o-admin, write `false`** (los escribe solo la CF con
  Admin SDK, que **bypassa** estas reglas).
- Campaña, beneficios, galería y shards del contador: **read público**; write admin (o solo
  CF para el contador).
- `suscripcionCharges` y `paypalSubEvents`: **read/write `false`** (internas).
- `paypalPlanes` y `chancesAjustes` **no tienen match explícito** → caen en el
  **default-deny** de Firestore para el cliente; solo la CF (Admin SDK) las escribe.
- **Regla dura:** SOLO suscriptores con pago vigente ganan (la elegibilidad se calcula
  server-side, ver §6); el módulo es **100 % aditivo** (no toca el pago único).

> ⚠️ **Base compartida con el ERP externo.** NUNCA se despliega `firestore:rules` sin
> permiso explícito del dueño (ver [MEMORY / no desplegar rules sin permiso]).

---

## 10. Índices (desplegados)

`firestore.indexes.json` — **desplegados**:

- **collectionGroup** `suscriptores` `(estado ASC, proximoCobro ASC)` — usado por el cron
  `cobrarSuscripcionesCulqi` para tocar solo las suscripciones vencidas.
- **collection** `suscriptores` `(estado ASC, vigenciaHasta ASC)` — usado por
  `decidirGanadoresSuscripcion` para leer solo elegibles vigentes.

---

## 11. Despliegue

El dueño despliega en **Cloud Shell** (responder **N** a "¿borrar funciones?"):

```bash
firebase deploy --only \
  functions:crearSuscripcionCulqi,\
functions:cobrarSuscripcionesCulqi,\
functions:crearSuscripcionPaypal,\
functions:confirmarSuscripcionPaypal,\
functions:paypalSubscriptionWebhook,\
functions:decidirGanadoresSuscripcion,\
functions:cancelarSuscripcion,\
functions:grantChancesSuscripcion,\
functions:processCulqiPayment \
  --project sistema-gestion-3b225

# Índices (responder N a borrar):
firebase deploy --only firestore:indexes --project sistema-gestion-3b225
```

> Se incluye `processCulqiPayment` porque el FIX del módulo de Gestión de Pagos marca
> `enlaces_pago` como pagado tras el cobro Culqi.

### Configuración por pasarela

- **Culqi / Perú — opera SIN configuración extra** (usa `CULQI_SECRET_KEY` ya existente).
- **PayPal / internacional** requiere:
  1. Registrar el webhook en el panel de PayPal apuntando a
     `https://us-central1-sistema-gestion-3b225.cloudfunctions.net/paypalSubscriptionWebhook`.
  2. Configurar **`PAYPAL_WEBHOOK_ID`** en `functions/.env.sistema-gestion-3b225`.
     **Sin este valor el webhook rechaza TODOS los eventos** (fail-closed, §4) — las
     suscripciones PayPal quedarían `pendiente_pago` sin activarse.

---

## 12. Guía de pruebas paso a paso

### A. Crear y publicar una campaña (admin)

1. Ir a `/admin/sorteos-suscripcion` → **Nueva campaña**.
2. Completar título, slug, descripción, colores, hero/logo.
3. Agregar al menos **un plan con precio** (S/ y/o USD) — el editor exige un plan
   comprable para poder poner `estado="activo"`.
4. (Opcional) Agregar premios, beneficios y galería de ganadores.
5. Guardar con **estado = Activo**. Verificar la landing en `/suscrito-sorteo/<slug>`
   ("🔗 Ver pública").

### B. Suscribirse con Culqi (Perú)

1. En la landing pulsar **¡Suscribirme!** en un plan.
2. Iniciar sesión con Google → completar nombres → **marcar el consentimiento** de cobro
   recurrente → **Continuar al pago**.
3. Pagar con **Culqi** (tarjeta de prueba). Al éxito: toast de activación.
4. Verificar en Firestore: `sorteos_suscripcion/{id}/suscriptores/{uid}` con
   `estado="activo"`, `metodoPago="culqi"`, `vigenciaHasta`/`proximoCobro` a +`meses`,
   `culqiCustomerId`/`culqiCardId`, y un recibo en `.../recibos/{chargeId}`. El contador
   (suma de shards) debe subir en 1.

### C. Suscribirse con PayPal (internacional)

1. Igual que B, pero elegir **PayPal**. Aprobar en el flujo de PayPal.
2. Si PayPal ya cobró (`ACTIVE`) → suscriptor `activo` + recibo `paypal_confirm_<periodo>`.
   Si quedó `APPROVED` → suscriptor `pendiente_pago` (NO elegible) y el modal muestra "se
   está activando"; al llegar `PAYMENT.SALE.COMPLETED`/`ACTIVATED` por webhook pasa a
   `activo`.
3. Verificar que el webhook **rechaza** eventos sin firma (403) — requiere
   `PAYPAL_WEBHOOK_ID` configurado.

### D. Cobro recurrente (cron Culqi)

1. Forzar `proximoCobro <= ahora` en un suscriptor Culqi de prueba.
2. Esperar / disparar `cobrarSuscripcionesCulqi` (09:00 Lima). Verificar que extiende
   `vigenciaHasta`/`proximoCobro`, resetea `intentosFallidos` y agrega un recibo. Un cobro
   rechazado incrementa `intentosFallidos`; tras `> 3` → `estado="vencido"`.
3. Verificar idempotencia: el lock `suscripcionCharges/{subId}__{periodo}` impide
   re-cobrar el mismo periodo.

### E. Decidir ganadores (admin)

1. En `/admin/sorteos-suscripcion/:id` → **Decidir ganadores** (opcionalmente indicar Nº).
2. Verificar el modal con ganadores + **evidencia** (drawId, total elegibles, semilla,
   poolHash) y que solo salieron suscriptores **activos + vigentes**.
3. Probar **Re-sortear** (excluye a los ganadores actuales, `arrayUnion`).

### F. Chances manuales y cancelación

1. **Otorgar chances**: buscar por correo/teléfono/DNI, aplicar `+N` o `-N` (clamp ≥ 0);
   verificar `chancesTotal` y el doc de auditoría en `chancesAjustes`.
2. **Cancelar** (desde "Mi cuenta" del usuario): `estado="cancelado"`, PayPal cancela la
   subscription, pero `vigenciaHasta` se respeta hasta el fin del periodo pagado.
