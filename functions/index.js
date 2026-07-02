/**
 * Cloud Function HTTP: el ERP debe llamar a esta URL cuando cree un pedido.
 * Crea la cuenta en el Portal (Auth + Firestore users) si el correo no tiene cuenta.
 * Una sola cuenta por email; contraseña inicial ALEATORIA + enlace de restablecimiento (H-03).
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // robusto en emulador (FieldValue puede ser undefined ahí)
const crypto = require("crypto");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  KAPI_MONTHLY_CAP, BALLSORT_REWARD, STREAK_DATES_BONUS, SURVEY_REWARD_MAX, REWARD_COINS_PER_ORDER,
  limaTodayStr, limaWeekStartStr, applyDebit, randomPassword, pickWeightedPrize, verifyWebhookSignature,
} = require("./economyLogic");

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();
const PORTAL_USERS_COLLECTION = "portal_clientes_users";
const ADMIN_USERS_COLLECTION = "adminUsers";

const MIN_PASSWORD_LENGTH = 6;

// ── Autorización (Fase 0, H-01/H-09) ──────────────────────────────────────────
// El llamante es admin si tiene el custom claim `admin: true`. Como puente de
// bootstrap (mientras se asignan los claims) se acepta también un doc
// adminUsers/{uid} con role 'admin'. La meta es depender solo del claim.
async function callerIsAdmin(context) {
  if (!context || !context.auth) return false;
  if (context.auth.token && context.auth.token.admin === true) return true;
  try {
    const snap = await db.collection(ADMIN_USERS_COLLECTION).doc(context.auth.uid).get();
    return snap.exists && snap.data().role === "admin";
  } catch (e) {
    return false;
  }
}

// ── Acceso al Firebase del ERP (Fase 0, H-02) ─────────────────────────────────
// Los pedidos viven en el proyecto del ERP. Para validarlos server-side se
// inicializa una segunda app con la cuenta de servicio del ERP, provista como
// secret JSON en ERP_SERVICE_ACCOUNT. Si no está configurada, devuelve null y
// el llamador debe FALLAR CERRADO (no acreditar monedas sin validar el pedido).
let erpApp = null;
function getErpDb() {
  const raw = process.env.ERP_SERVICE_ACCOUNT;
  if (!raw) {
    // En el emulador, los pedidos del ERP se siembran en el MISMO proyecto demo,
    // así que se usa el Firestore por defecto (evita exigir credenciales del ERP en local).
    if (process.env.FUNCTIONS_EMULATOR === "true") return db;
    return null;
  }
  if (!erpApp) {
    try {
      const sa = JSON.parse(raw);
      erpApp = admin.initializeApp({ credential: admin.credential.cert(sa) }, "erp");
    } catch (e) {
      console.error("ERP_SERVICE_ACCOUNT inválido (no es JSON de service account):", e.message);
      return null;
    }
  }
  return erpApp.firestore();
}

// ── wala_pedidos: marca de pago en la FUENTE DE VERDAD de WALA (best-effort) ───
// wala_pedidos es la colección propia de WALA (espejo independiente del ERP) cuyo
// `estadoWala` es la fuente de verdad mostrada en el Portal. Cuando un pago se
// confirma (Culqi/PayPal), ADEMÁS de marcar pedidos_web como hoy, actualizamos el
// doc de wala_pedidos a estadoWala:"pagado". Es 100% ADITIVO e IDEMPOTENTE y va
// envuelto en try/catch: NUNCA debe hacer fallar el flujo de pago (el cobro ya
// ocurrió). Usa la MISMA instancia admin del ERP (getErpDb) que pedidos_web.
//
// Contrato del doc (ver src/services/walaOrders.js): doc id = sanearDocId(numeroPedido)
// || sanearDocId(pedidoWebId). Para localizarlo, como aquí solo tenemos el id del
// pedido (pedidoId / pseudoOrderId / numeroPedido, todos el mismo valor de negocio),
// consultamos por where("pedidoWebId","==",id) Y por where("numeroPedido","==",id),
// y actualizamos TODOS los match. Si no hay ninguno, no se falla (best-effort).
const WALA_ORDERS_COLLECTION = "wala_pedidos";

// Replica de sanearDocId de src/services/walaOrders.js (para construir el id estable).
function sanearWalaDocId(valor) {
  if (valor == null) return "";
  return String(valor)
    .trim()
    .replace(/[/\\#?[\].]/g, "-")
    .replace(/\s+/g, "-");
}

/**
 * Marca como pagado el/los doc(s) de wala_pedidos asociados a un pedido.
 * ADITIVO, IDEMPOTENTE y BEST-EFFORT: nunca lanza; ante cualquier error solo loguea.
 * NO recalcula montos: montoPagado es informativo (solo se escribe si se pasa).
 *
 * @param {object} params
 * @param {string|number} params.pedidoId   - id del pedido (pedidoWebId / numeroPedido / pseudoOrderId).
 * @param {string} [params.metodoPago]       - 'culqi' | 'paypal' (informativo).
 * @param {number} [params.montoPagado]       - monto cobrado ya calculado (informativo).
 */
async function marcarWalaPedidoPagado({ pedidoId, metodoPago, montoPagado } = {}) {
  try {
    if (pedidoId == null || pedidoId === "") return;
    const erpDb = getErpDb();
    if (!erpDb) {
      console.warn("marcarWalaPedidoPagado: ERP no disponible (getErpDb null); se omite wala_pedidos.");
      return;
    }
    const id = String(pedidoId);
    const coll = erpDb.collection(WALA_ORDERS_COLLECTION);

    // Campos de la marca de pago (mismo contrato que markWalaOrderPagado del cliente).
    const marca = {
      estadoWala: "pagado",
      pagado: true,
      pagadoAt: FieldValue.serverTimestamp(),
      estadoWalaUpdatedAt: FieldValue.serverTimestamp(),
    };
    if (metodoPago != null) marca.metodoPago = metodoPago;
    if (montoPagado != null) marca.montoPagado = montoPagado;

    // Localiza por pedidoWebId Y por numeroPedido (queries de una sola condición →
    // sin índice compuesto). Se deduplican los match por path para no escribir dos veces.
    const refs = new Map();
    for (const campo of ["pedidoWebId", "numeroPedido"]) {
      try {
        const snap = await coll.where(campo, "==", id).get();
        snap.forEach((d) => refs.set(d.ref.path, d.ref));
      } catch (e) {
        console.warn(`marcarWalaPedidoPagado: query por ${campo} falló:`, e.message);
      }
    }

    if (refs.size > 0) {
      // Actualiza todos los espejos encontrados (idempotente: set merge).
      for (const ref of refs.values()) {
        try {
          await ref.set(marca, { merge: true });
        } catch (e) {
          console.warn(`marcarWalaPedidoPagado: no se pudo marcar ${ref.path}:`, e.message);
        }
      }
      return;
    }

    // Fallback: no se halló por query. Intentamos por id estable saneado (= como lo
    // crea el espejo). Solo escribimos si el doc YA existe, para no fabricar espejos
    // huérfanos sin el resto de campos del pedido. setDoc{merge} mantiene idempotencia.
    const idSaneado = sanearWalaDocId(id);
    if (idSaneado) {
      try {
        const ref = coll.doc(idSaneado);
        const snap = await ref.get();
        if (snap.exists) {
          await ref.set(marca, { merge: true });
          return;
        }
      } catch (e) {
        console.warn("marcarWalaPedidoPagado: fallback por id saneado falló:", e.message);
      }
    }

    // Sin match: no se falla. El espejo puede no existir aún (best-effort); pedidos_web
    // ya quedó marcado y es la vía que el ERP recibe.
    console.warn(`marcarWalaPedidoPagado: no se encontró doc en wala_pedidos para pedido ${id}; se omite (best-effort).`);
  } catch (e) {
    // BEST-EFFORT total: jamás propagar (el cobro ya ocurrió).
    console.error("marcarWalaPedidoPagado: error inesperado (ignorado, pago ya confirmado):", e);
  }
}

const ERP_NOMBRE = [
  "clienteNombre",
  "clienteApellidos",
  "clienteNombreCompleto",
  "nombreCompleto",
  "customerName",
  "nombreCliente",
  "nombre",
];
const ERP_CORREO = ["clienteCorreo", "correo", "email", "correoElectronico"];
const ERP_TELEFONO1 = ["clienteContacto", "telefono1", "numero1", "phone", "telefono", "phone1"];

function getFirst(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function extraerDatos(body) {
  if (!body || typeof body !== "object") {
    return { email: null, displayName: null, dni: null, phone: null, tipoDocumento: null };
  }
  const nombrePartes = [body.clienteNombre, body.clienteApellidos].filter(Boolean);
  const displayName =
    nombrePartes.length > 0 ? nombrePartes.join(" ") : getFirst(body, ERP_NOMBRE) || null;
  const emailRaw = getFirst(body, ERP_CORREO);
  const email =
    typeof emailRaw === "string" && emailRaw.trim()
      ? emailRaw.trim().toLowerCase()
      : null;
  const dniRaw = body.clienteNumeroDocumento ?? body.dni ?? body.documento;
  const dni =
    dniRaw != null && String(dniRaw).trim()
      ? String(dniRaw).trim().replace(/\s/g, "")
      : null;
  const phoneRaw = getFirst(body, ERP_TELEFONO1);
  const phone =
    phoneRaw != null && String(phoneRaw).trim()
      ? String(phoneRaw).replace(/\D/g, "")
      : null;
  const tipoDocumento =
    body.tipoDocumento != null && String(body.tipoDocumento).trim()
      ? String(body.tipoDocumento).trim()
      : null;
  return { email, displayName, dni, phone, tipoDocumento };
}

function isValidEmail(str) {
  if (typeof str !== "string" || !str.trim()) return false;
  const t = str.trim().toLowerCase();
  return t.includes("@") && t.length >= 5;
}

// H-03: la contraseña inicial ya NO es el DNI; se usa randomPassword() de economyLogic
// más un enlace de restablecimiento. El DNI se conserva solo como dato, no credencial.

/**
 * URL: https://<region>-<project>.cloudfunctions.net/ensureAccountFromOrder
 * Método: POST
 * Body (JSON): datos del pedido/cliente, p.ej.:
 *   { "email": "a@b.com", "nombreCliente": "Juan Pérez", "dni": "12345678", "phone": "999888777" }
 * También acepta: clienteCorreo, customerName, clienteNombre, clienteNumeroDocumento, clienteContacto, etc.
 *
 * Respuesta 200:
 *   { "created": true, "userId": "..." }  o  { "created": false, "existing": true }  o  { "created": false, "error": "..." }
 */
exports.ensureAccountFromOrder = functions.https.onRequest(async (req, res) => {
  // CORS: webhook server-to-server. NO se emite Access-Control-Allow-Origin: * (H-03);
  // solo se expone el origen del ERP si se configura ERP_ALLOWED_ORIGIN.
  const allowedOrigin = process.env.ERP_ALLOWED_ORIGIN;
  if (allowedOrigin) res.set("Access-Control-Allow-Origin", allowedOrigin);
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Signature");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido. Use POST." });
    return;
  }

  // Autenticación del webhook por HMAC-SHA256 (H-03). El ERP firma el body crudo con
  // ERP_WEBHOOK_SECRET y envía la firma hex en X-Webhook-Signature. Si el secreto está
  // configurado se exige y valida; si no, se advierte y se permite (transición —
  // configurar ERP_WEBHOOK_SECRET y firmar desde el ERP para cerrar el agujero).
  const webhookSecret = process.env.ERP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const valid = verifyWebhookSignature(rawBody, req.get("X-Webhook-Signature"), webhookSecret);
    if (!valid) {
      console.warn("ensureAccountFromOrder: firma HMAC inválida o ausente.");
      res.status(401).json({ created: false, error: "INVALID_SIGNATURE" });
      return;
    }
  } else {
    console.warn(
      "ensureAccountFromOrder: ERP_WEBHOOK_SECRET no configurado; webhook SIN autenticar. " +
      "Configúrelo y firme el payload desde el ERP para cerrar H-03."
    );
  }

  const body = typeof req.body === "object" ? req.body : {};
  const { email, displayName, dni, phone, tipoDocumento } = extraerDatos(body);

  if (!isValidEmail(email)) {
    res.status(400).json({ created: false, error: "NO_EMAIL" });
    return;
  }

  // H-03: el DNI ya no es obligatorio para crear la cuenta (no se usa como contraseña).

  try {
    let existingUser = null;
    try {
      existingUser = await auth.getUserByEmail(email);
    } catch (e) {
      if (e.code !== "auth/user-not-found") {
        throw e;
      }
    }

    if (existingUser) {
      res.status(200).json({ created: false, existing: true, userId: existingUser.uid });
      return;
    }

    const userRecord = await auth.createUser({
      email,
      password: randomPassword(), // H-03: aleatoria, nunca el DNI
      displayName: displayName || email,
    });
    const uid = userRecord.uid;

    await db.collection(PORTAL_USERS_COLLECTION).doc(uid).set(
      {
        email,
        displayName: displayName || email,
        dni: dni || null,
        phone: phone || null,
        tipoDocumento: tipoDocumento || null,
        accessSystem: "portal_clientes",
        accountOrigin: "erp_auto",
        createdForPortalClientes: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // H-03: enlace para que el cliente DEFINA su propia contraseña. El ERP/portal lo
    // entrega por correo. (El envío del correo es responsabilidad del ERP o de una
    // extensión "Trigger Email"; aquí solo se genera el enlace.)
    let passwordSetupLink = null;
    try {
      passwordSetupLink = await auth.generatePasswordResetLink(email);
    } catch (linkErr) {
      console.warn("ensureAccountFromOrder: no se pudo generar el enlace de contraseña:", linkErr.message);
    }

    res.status(200).json({ created: true, userId: uid, passwordSetupLink });
  } catch (err) {
    console.error("ensureAccountFromOrder error:", err);
    const code = err.code || "";
    const msg = err.message || "";
    res.status(500).json({
      created: false,
      error: code ? `${code}: ${msg}` : msg,
    });
  }
});

/**
 * Cloud Function (Callable): Securely claim coins for an order.
 * Ensures the order exists, is completed, belongs to the user, and hasn't been claimed yet.
 */
exports.secureClaimMonedas = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debe estar autenticado para reclamar monedas."
    );
  }

  // Normalizado a string una sola vez (H-06 #6): evita doble reclamo por '123' vs 123.
  const pedidoId = data && data.pedidoId != null ? String(data.pedidoId) : null;
  if (!pedidoId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Se requiere el ID del pedido."
    );
  }

  const uid = context.auth.uid;
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);

  // Monto SERVER-AUTHORITATIVE: se ignora cualquier `amount` enviado por el cliente (H-02/H-06).
  const amount = REWARD_COINS_PER_ORDER;

  // 1) Validar el pedido contra el ERP (H-02). FALLA CERRADO si el ERP no está
  //    configurado: sin verificar propiedad/estado del pedido NO se acuñan monedas.
  const erpDb = getErpDb();
  if (!erpDb) {
    console.error("secureClaimMonedas: ERP_SERVICE_ACCOUNT no configurado; reclamo rechazado (fail-closed).");
    throw new functions.https.HttpsError(
      "failed-precondition",
      "La validación de pedidos no está disponible temporalmente. Intenta más tarde."
    );
  }

  const preUserDoc = await userRef.get();
  if (!preUserDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
  }
  const userData0 = preUserDoc.data();

  // Buscar el pedido en el ERP (pedidos_web o pedidos).
  let orderData = null;
  for (const coll of ["pedidos_web", "pedidos"]) {
    const snap = await erpDb.collection(coll).doc(String(pedidoId)).get();
    if (snap.exists) { orderData = snap.data(); break; }
  }
  if (!orderData) {
    throw new functions.https.HttpsError("not-found", "Pedido no encontrado.");
  }

  // Propiedad: por userId o por DNI del usuario.
  const ownsByUid = orderData.userId && orderData.userId === uid;
  const ownsByDni = orderData.dni && userData0.dni && String(orderData.dni) === String(userData0.dni);
  if (!ownsByUid && !ownsByDni) {
    throw new functions.https.HttpsError("permission-denied", "Este pedido no le pertenece.");
  }

  // Estado: debe estar finalizado/entregado/completado.
  const estado = (orderData.estadoGeneral || orderData.estado || "")
    .toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!["finalizado", "entregado", "completado"].includes(estado)) {
    throw new functions.https.HttpsError("failed-precondition", "El pedido aún no está finalizado.");
  }

  try {
    return await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data() || {};


      // Check if already claimed
      const reclamadas = userData.monedasReclamadas || [];
      if (reclamadas.includes(pedidoId)) {
        throw new functions.https.HttpsError("already-exists", "Las monedas de este pedido ya fueron reclamadas.");
      }

      // Manejo de Monedas con TTL (90 días por defecto para pedidos)
      const TTL_DAYS = 90;
      const now = new Date();
      
      // Fecha de expiración al final del día (23:59:59) para agrupar mejor
      const expirationDate = new Date(now);
      expirationDate.setDate(expirationDate.getDate() + TTL_DAYS);
      expirationDate.setHours(23, 59, 59, 999);
      const expiresAtIso = expirationDate.toISOString();

      let monedasActivas = userData.monedasActivas || [];
      
      // Intentar encontrar un lote existente con exactamente la misma fecha de expiración
      const existingBatchIndex = monedasActivas.findIndex(b => b.expiresAt === expiresAtIso);
      
      if (existingBatchIndex >= 0) {
        monedasActivas[existingBatchIndex].amount += amount;
      } else {
        monedasActivas.push({
          amount: amount,
          expiresAt: expiresAtIso,
          source: "pedido_" + pedidoId,
          createdAt: now.toISOString()
        });
      }

      // Update user document safely
      const currentMonedas = userData.monedas || 0;
      const newBalance = currentMonedas + amount;
      transaction.update(userRef, {
        monedas: newBalance, // Mantenemos el campo global por compatibilidad, aunque el cliente calculará sobre monedasActivas
        monedasActivas: monedasActivas,
        monedasReclamadas: FieldValue.arrayUnion(pedidoId)
      });

      writeLedger(transaction, uid, {
        type: "earn",
        amount,
        source: "pedido_" + pedidoId,
        balanceAfter: newBalance,
      });

      return { success: true, nuevasMonedas: newBalance, monedasActivas };
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error("secureClaimMonedas error:", error);
    throw new functions.https.HttpsError("internal", error.message || "Error al procesar el reclamo.");
  }
});

/**
 * Cron Job mensual: Resetea kapiCoins a 0 el último día de cada mes a las 23:59.
 * Utiliza Firebase Scheduler (Cloud Scheduler).
 */
exports.resetKapiCoins = onSchedule("59 23 28-31 * *", async (event) => {
  // Asegurarnos de que hoy es realmente el último día del mes
  // (ya que el cron se corre del 28 al 31)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (tomorrow.getDate() !== 1) {
    // No es el último día del mes, ignorar
    console.log("Not the last day of the month, skipping KapiCoins reset.");
    return;
  }

  console.log("Running monthly KapiCoins reset...");

  try {
    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION)
      .where("kapiCoins", ">", 0)
      .get();
      
    if (usersSnapshot.empty) {
      console.log("No users with kapiCoins > 0 found.");
      return;
    }

    const batch = db.batch();
    const analyticsRef = db.collection("analytics_kapi");
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    let totalUnspent = 0;
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const unspent = data.kapiCoins || 0;
      totalUnspent += unspent;

      // Reset in user document
      batch.update(doc.ref, { kapiCoins: 0 });
    });

    // Save analytics document for the month
    const analyticsDocRef = analyticsRef.doc(currentMonthStr);
    batch.set(analyticsDocRef, {
      month: currentMonthStr,
      totalUnspentCoins: totalUnspent,
      usersAffected: usersSnapshot.size,
      timestamp: FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    console.log(`Successfully reset KapiCoins for ${usersSnapshot.size} users. Total unspent: ${totalUnspent}`);

  } catch (error) {
    console.error("Error resetting KapiCoins:", error);
  }
});

/**
 * Cron Job diario: Notifica a los usuarios 14 días antes de su cumpleaños
 * para que compartan su Wishlist. Se ejecuta a las 9:00 AM.
 */
exports.notifyWishlistBirthdays = onSchedule("0 9 * * *", async (event) => {
  console.log("Running daily birthday wishlist notification...");

  try {
    // Calcular la fecha objetivo: hoy + 14 días
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);
    
    // Extraer mes y día en formato MM-DD
    const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
    const targetDay = String(targetDate.getDate()).padStart(2, '0');
    const targetSuffix = `-${targetMonth}-${targetDay}`;

    // Obtener todos los usuarios (idealmente indexados, o se filtra en memoria si no son muchos)
    // Para bases de datos grandes, sería mejor guardar birthMonthDay como un campo aparte.
    const usersSnapshot = await db.collection(PORTAL_USERS_COLLECTION).get();
    
    if (usersSnapshot.empty) {
      console.log("No users found.");
      return;
    }

    let notifiedCount = 0;
    const batch = db.batch();

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      if (!data.birthDate) continue; // Formato esperado: YYYY-MM-DD o similar

      if (data.birthDate.endsWith(targetSuffix)) {
        // Verificar si tiene una wishlist
        const wishlistRef = db.collection('wishlists').doc(doc.id);
        const wishlistSnap = await wishlistRef.get();
        
        if (wishlistSnap.exists) {
          const items = wishlistSnap.data().items || [];
          if (items.length > 0) {
            // Generar notificación in-app
            const notifRef = db.collection(`users/${doc.id}/notifications`).doc();
            batch.set(notifRef, {
              title: '¡Tu cumpleaños se acerca! 🎂',
              body: 'Faltan 14 días para tu cumpleaños. ¡Comparte tu lista de deseos para que tus amigos sepan exactamente qué regalarte!',
              createdAt: new Date().toISOString(),
              read: false,
              type: 'wishlist_birthday_reminder'
            });
            notifiedCount++;
          }
        }
      }
    }

    if (notifiedCount > 0) {
      await batch.commit();
      console.log(`Successfully notified ${notifiedCount} users for upcoming birthdays.`);
    } else {
      console.log("No users match the 14-day birthday criteria with active wishlists.");
    }

  } catch (error) {
    console.error("Error in notifyWishlistBirthdays:", error);
  }
});

// ====== RETOS SEMANALES ======

/**
 * Cron Job: Se ejecuta cada lunes a las 00:00 (Zona horaria America/Lima).
 * Rota el reto semanal seleccionando uno de los retos disponibles en la colección "weeklyChallenges".
 */
exports.rotateWeeklyChallenge = onSchedule({
  schedule: "0 0 * * 1",
  timeZone: "America/Lima"
}, async (event) => {
  try {
    const challengesSnap = await db.collection("weeklyChallenges").get();
    if (challengesSnap.empty) {
      console.log("No hay retos disponibles para rotar.");
      return;
    }
    
    // Convertir a array
    const challenges = [];
    challengesSnap.forEach(doc => challenges.push({ id: doc.id, ...doc.data() }));
    
    // Seleccionar uno al azar
    const randomIndex = Math.floor(Math.random() * challenges.length);
    const selectedChallenge = challenges[randomIndex];
    
    // Actualizar o crear el documento global 'activeChallenge'
    await db.collection("globals").doc("activeChallenge").set({
      challengeId: selectedChallenge.id,
      title: selectedChallenge.title,
      description: selectedChallenge.description,
      actionType: selectedChallenge.actionType,
      goal: selectedChallenge.goal,
      rewardCoins: selectedChallenge.rewardCoins,
      rewardType: selectedChallenge.rewardType || "main", // "main" o "kapi_double_3d"
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    
    console.log("Reto semanal rotado exitosamente:", selectedChallenge.title);
  } catch (err) {
    console.error("Error al rotar reto semanal:", err);
  }
});

/**
 * Callable Function: Enviar evidencia manual para el reto (ej. link a story, foto)
 */
exports.submitChallengeEvidence = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  const { evidenceUrl, challengeId, evidenceType } = data;
  if (!evidenceUrl || !challengeId) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos de la evidencia.");
  }

  const uid = context.auth.uid;
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const userDoc = await userRef.get();
  const userName = userDoc.exists ? userDoc.data().displayName : "Usuario";
  
  await db.collection("challengeEvidences").add({
    userId: uid,
    userName: userName,
    challengeId,
    evidenceUrl,
    evidenceType: evidenceType || "image",
    status: "pending",
    submittedAt: FieldValue.serverTimestamp()
  });

  return { success: true };
});

/**
 * Callable Function (Admin Solo): Aprobar o rechazar evidencia
 */
exports.approveChallengeEvidence = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  
  const { evidenceId, action, rewardCoins, rewardType } = data; // action: 'approve' | 'reject'
  if (!evidenceId || !action) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos.");
  }

  const evidenceRef = db.collection("challengeEvidences").doc(evidenceId);
  
  await db.runTransaction(async (transaction) => {
    const evidenceDoc = await transaction.get(evidenceRef);
    if (!evidenceDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Evidencia no encontrada.");
    }
    const evData = evidenceDoc.data();
    if (evData.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "La evidencia ya fue procesada.");
    }

    transaction.update(evidenceRef, { 
      status: action === "approve" ? "approved" : "rejected",
      processedAt: FieldValue.serverTimestamp(),
      processedBy: context.auth.uid
    });

    if (action === "approve") {
      const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(evData.userId);
      const userDoc = await transaction.get(userRef);
      if(userDoc.exists) {
        const userData = userDoc.data();
        let updates = {
           challengeEvidencesApproved: FieldValue.arrayUnion(evData.challengeId)
        };
        // Acreditar monedas si se aprobaron directamente acá
        if (rewardType === 'main') {
           // Usamos la misma lógica de earnMainCoins pero en backend
           let activas = userData.monedasActivas || [];
           const tzOffset = -5 * 60; // Peru
           const expirationDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000 + tzOffset * 60000);
           const expiresAt = expirationDate.toISOString().replace('Z', '-05:00');
           activas.push({ amount: rewardCoins, reason: 'Reto Manual Completado', expiresAt, createdAt: new Date().toISOString() });
           updates.monedas = (userData.monedas || 0) + rewardCoins;
           updates.monedasActivas = activas;
        } else if (rewardType === 'kapi_double_3d') {
           updates.activeMultiplier = 'kapi_double_3d';
           updates.multiplierExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        }
        transaction.set(userRef, updates, { merge: true });
      }
    }
  });

  return { success: true };
});

/**
 * Callable Function: Procesar pago con Culqi
 */
exports.processCulqiPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado para pagar.");
  }

  const { amount, currency, email, tokenId, description, metadata } = data || {};

  if (!amount || !email || !tokenId) {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos requeridos para el pago.");
  }

  // El monto llega en céntimos (integer). Validación básica server-side (H-11).
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Monto inválido.");
  }

  // ── H-11: RECÁLCULO DEL MONTO SERVER-SIDE (cierra el TODO) ──────────────────
  // No se confía 100% en el `amount` enviado por el cliente. Cuando el pago es en
  // PEN y la metadata trae el id del pedido (`pedidoId`, escrito por el frontend en
  // CulqiCustomCheckout), se relee el total REAL desde pedidos_web en el ERP y se
  // usa ese total (en céntimos) como monto autoritativo del cargo.
  //
  // IMPORTANTE (regla dura de dinero): el total en PEN NO se modifica aquí; el
  // descuento por monedas ya viene aplicado en montoTotal/montoPendiente del pedido.
  // Solo se sustituye el `amount` del cargo por el derivado del pedido real.
  //
  // Tolerancia a fallos: si no hay ERP configurado, no se encuentra el pedido, o el
  // total no es válido, se CONSERVA el `amount` del cliente (ya validado > 0) para no
  // bloquear el cobro. Para pagos en USD/extranjero NO se recalcula aquí: PayPal cobra
  // en USD por su propio flujo y Culqi-USD usa enlaces de monto fijo ya validados.
  let chargeAmount = amount;
  const payCurrency = currency || "PEN";
  const pedidoId = metadata && (metadata.pedidoId || metadata.orderId);
  // Se capturan en scope de función para reusarlos al marcar el pedido pagado tras el cobro.
  let erpDbForOrder = null;
  let orderColl = null;
  if (payCurrency === "PEN" && pedidoId) {
    try {
      const erpDb = getErpDb();
      if (erpDb) {
        erpDbForOrder = erpDb;
        let orderData = null;
        for (const coll of ["pedidos_web", "pedidos"]) {
          const snap = await erpDb.collection(coll).doc(String(pedidoId)).get();
          if (snap.exists) { orderData = snap.data(); orderColl = coll; break; }
        }
        if (orderData) {
          // Total final en soles (con descuento ya aplicado). Se prioriza el pendiente.
          const penTotal = Number(
            orderData.montoPendiente ?? orderData.montoTotal ?? orderData.montoDeuda
          );
          if (Number.isFinite(penTotal) && penTotal > 0) {
            const recomputed = Math.round(penTotal * 100); // a céntimos
            if (recomputed > 0) {
              if (recomputed !== amount) {
                console.warn(
                  `processCulqiPayment H-11: monto del cliente (${amount}) != monto del pedido ` +
                  `${pedidoId} (${recomputed}). Se usa el del servidor.`
                );
              }
              chargeAmount = recomputed;
            }
          }
        } else {
          console.warn(`processCulqiPayment H-11: pedido ${pedidoId} no encontrado; se usa el monto del cliente.`);
        }
      }
    } catch (e) {
      // Nunca se bloquea el cobro por un fallo al recalcular: se usa el monto del cliente.
      console.warn("processCulqiPayment H-11: fallo al recalcular monto, se usa el del cliente:", e.message);
    }
  }

  // La llave privada de Culqi DEBE venir de un secret de Functions. Sin fallback dummy
  // y sin prefijo REACT_APP_ (que se expondría en el bundle del cliente).
  const secretKey = process.env.CULQI_SECRET_KEY;
  if (!secretKey) {
    console.error("processCulqiPayment: CULQI_SECRET_KEY no configurada.");
    throw new functions.https.HttpsError("failed-precondition", "Pago no disponible temporalmente.");
  }

  // ── S-4: IDEMPOTENCIA (aditivo y seguro) ───────────────────────────────────
  // ANTES de cobrar se intenta crear un doc de bloqueo `culqiCharges/{tokenId}`
  // con runTransaction + t.create(): si el doc ya existe (mismo tokenId por doble
  // click / retry de red), NO se vuelve a cobrar y se devuelve el resultado previo
  // (o un estado "en proceso" si el primer intento aún no terminó). El tokenId de
  // Culqi es de un solo uso, por lo que es una clave de idempotencia natural.
  //
  // Comportamiento conservador (no rompe pagos): si por cualquier motivo falla la
  // adquisición del lock de forma inesperada, NO se bloquea el cobro (se procede
  // como hoy); la transacción solo aborta el camino normal cuando detecta de forma
  // fiable que ya hubo (o hay) un cobro para este tokenId.
  const lockRef = db.collection("culqiCharges").doc(String(tokenId));
  let lockAcquired = false;
  try {
    const prev = await db.runTransaction(async (t) => {
      const snap = await t.get(lockRef);
      if (snap.exists) {
        // Ya existe un intento para este tokenId.
        return snap.data() || {};
      }
      // Se reserva el tokenId ANTES de llamar a la API de Culqi.
      t.create(lockRef, {
        tokenId: String(tokenId),
        status: "processing",
        amount: chargeAmount,
        currency: payCurrency,
        uid: context.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return null; // null = lock recién adquirido por esta llamada
    });

    if (prev) {
      // Reintento detectado: NO se recobra.
      if (prev.status === "succeeded") {
        // Devuelve el resultado previo guardado (mismo shape que el éxito normal).
        return {
          success: true,
          charge_id: prev.charge_id || null,
          outcome: prev.outcome || null,
          amount: prev.amount ?? chargeAmount,
          idempotent: true, // marca informativa: respuesta servida desde el lock
        };
      }
      if (prev.status === "failed") {
        // El intento previo con este token falló en Culqi. El token es de un solo
        // uso, así que reintentarlo daría error igualmente: se informa con claridad.
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Este pago ya fue intentado y no se completó. Vuelve a iniciar el pago para generar un nuevo token."
        );
      }
      // status "processing": otra ejecución concurrente está cobrando este token.
      throw new functions.https.HttpsError(
        "already-exists",
        "El pago con esta tarjeta ya se está procesando. Espera unos segundos antes de reintentar."
      );
    }
    lockAcquired = true;
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    // Fallo inesperado del lock: no se bloquea el cobro (comportamiento de hoy).
    console.warn("processCulqiPayment S-4: no se pudo adquirir el lock de idempotencia, se procede sin él:", e.message);
  }

  try {
    const response = await fetch("https://api.culqi.com/v2/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`
      },
      body: JSON.stringify({
        amount: chargeAmount, // H-11: monto autoritativo (recalculado server-side cuando aplica)
        currency_code: payCurrency,
        email: email,
        source_id: tokenId,
        description: description || "Pago en Walá",
        metadata: metadata || {}
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Error de Culqi:", result);
      // S-4: marca el lock como fallido para que un reintento del mismo token no
      // vuelva a llamar a Culqi (best-effort, nunca bloquea la respuesta de error).
      if (lockAcquired) {
        try {
          await lockRef.set({
            status: "failed",
            error: result.user_message || "rechazo de Culqi",
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.warn("processCulqiPayment S-4: no se pudo marcar el lock como failed:", e.message);
        }
      }
      throw new functions.https.HttpsError("internal", result.user_message || "Error al procesar la tarjeta con Culqi.");
    }

    // S-4: guarda el resultado exitoso en el lock para servir reintentos sin recobrar.
    if (lockAcquired) {
      try {
        await lockRef.set({
          status: "succeeded",
          charge_id: result.id || null,
          outcome: result.outcome || null,
          amount: chargeAmount,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.warn("processCulqiPayment S-4: no se pudo marcar el lock como succeeded:", e.message);
      }
    }

    // ── Marcar el PEDIDO como pagado en el ERP (best-effort) ───────────────────
    // El culqiWebhook ya hace esto, pero hoy no está registrado en Culqi y no se
    // dispara; por eso, en la rama de ÉXITO del cobro (protegida por el lock de
    // idempotencia, corre una sola vez por cobro real) se marca aquí el pedido con
    // EXACTAMENTE los mismos campos que el webhook (set merge → idempotente y sin
    // conflicto si el webhook también corriera). NUNCA debe hacer fallar la respuesta
    // al cliente: el cobro ya ocurrió, así que ante cualquier error solo se loguea.
    if (pedidoId && erpDbForOrder && orderColl) {
      try {
        await erpDbForOrder.collection(orderColl).doc(String(pedidoId)).set({
          pagado: true,
          estadoPago: "pagado",
          culqiChargeId: String(result.id), // igual forma que el webhook (idempotencia)
          montoPagado: chargeAmount, // céntimos realmente cobrados
          montoPendiente: 0, // saldado
          pagadoAt: FieldValue.serverTimestamp(),
          metodoPago: "culqi",
        }, { merge: true });
      } catch (e) {
        // El cobro ya se realizó: no se propaga el error al cliente, solo se registra.
        console.error(`processCulqiPayment: error al marcar pedido ${pedidoId} pagado (cobro ya realizado, charge ${result.id}):`, e);
      }
    }

    // ── ADITIVO: marca el espejo wala_pedidos como pagado (fuente de verdad WALA) ─
    // Best-effort e idempotente; no afecta el cálculo del monto ni la respuesta al
    // cliente. Se ejecuta ADEMÁS de la marca en pedidos_web de arriba.
    await marcarWalaPedidoPagado({ pedidoId, metodoPago: "culqi", montoPagado: chargeAmount });

    return {
      success: true,
      charge_id: result.id,
      outcome: result.outcome,
      amount: chargeAmount, // H-11: monto realmente cobrado (céntimos), por si difería del cliente
    };

  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error("Excepción en processCulqiPayment:", err);
    // S-4: ante una excepción de red NO se puede saber si Culqi cobró o no. Se marca
    // el lock como "failed" para evitar un recobro automático con el mismo token;
    // el cliente debe iniciar un pago nuevo (token nuevo). best-effort.
    if (lockAcquired) {
      try {
        await lockRef.set({
          status: "failed",
          error: err.message || "excepción de red",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.warn("processCulqiPayment S-4: no se pudo marcar el lock como failed (excepción):", e.message);
      }
    }
    throw new functions.https.HttpsError("internal", err.message || "Excepción interna al procesar el pago.");
  }
});

/**
 * Callable (Admin): asigna o revoca el rol admin de un usuario vía custom claims (H-01/H-09).
 * Solo un admin (claim o, como puente de bootstrap, doc adminUsers) puede ejecutarla.
 * El bootstrap inicial de los primeros superadmins se hace con scripts/set-admin-claims.js
 * (cuenta de servicio), porque al inicio nadie tiene aún el claim.
 */
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  if (!(await callerIsAdmin(context))) {
    throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede asignar roles.");
  }

  let { targetUid, targetEmail, makeAdmin = true } = data || {};
  if (!targetUid && !targetEmail) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere targetUid o targetEmail.");
  }

  try {
    if (!targetUid) {
      const u = await auth.getUserByEmail(String(targetEmail).trim().toLowerCase());
      targetUid = u.uid;
    }
    await auth.setCustomUserClaims(
      targetUid,
      makeAdmin === true ? { admin: true, role: "superadmin" } : { admin: false }
    );
    return { success: true, uid: targetUid, admin: makeAdmin === true };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    console.error("setAdminClaim error:", err);
    throw new functions.https.HttpsError("internal", err.message || "No se pudo asignar el claim.");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ECONOMÍA SERVER-AUTHORITATIVE (Fase 0, H-06)
// Todo earn/spend de monedas/kapiCoins se hace aquí, transaccional e idempotente.
// El cliente solo invoca estas callables; nunca escribe campos de saldo (las reglas
// los bloquean). La lógica pura (fechas Lima, débito FIFO, sorteo, HMAC) está en
// ./economyLogic y se prueba en functions/test/economyLogic.test.js.
// ════════════════════════════════════════════════════════════════════════════

function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
  }
  return context.auth.uid;
}

// ── Alimentar a Kapi (kapiCoins + racha) ──────────────────────────────────────
exports.feedKapiSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const today = limaTodayStr();
  const weekStart = limaWeekStartStr();
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      if (u.lastKapiClaimDate === today) {
        throw new functions.https.HttpsError("already-exists", "Ya alimentaste a Kapi hoy.");
      }
      const currentKapi = u.kapiCoins || 0;
      if (currentKapi >= KAPI_MONTHLY_CAP) {
        throw new functions.https.HttpsError("failed-precondition", "Límite mensual de Kapi Coins alcanzado.");
      }
      let weekly = u.weeklyClaimsData || { weekStart, daysClaimed: [] };
      if (weekly.weekStart !== weekStart) weekly = { weekStart, daysClaimed: [today] };
      else if (!weekly.daysClaimed.includes(today)) weekly.daysClaimed.push(today);

      let add = 1;
      if (u.activeMultiplier === "kapi_double_3d" && u.multiplierExpiresAt &&
          new Date(u.multiplierExpiresAt) > new Date()) {
        add = 2;
      }
      const updates = {
        kapiCoins: currentKapi + add,
        lastKapiClaimDate: today,
        kapiHappiness: Math.min(100, (u.kapiHappiness || 0) + 10),
        weeklyClaimsData: weekly,
      };
      t.update(userRef, updates);
      // Ledger: feedKapi otorga kapiCoins (no monedas). Se registra el evento con el
      // monto de kapiCoins; balanceAfter refleja el saldo de monedas sin cambios.
      writeLedger(t, uid, {
        type: "earn",
        amount: add,
        source: "feed_kapi",
        balanceAfter: u.monedas || 0,
      });
      return { success: true, ...updates };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("feedKapiSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al alimentar a Kapi.");
  }
});

// ── Recompensa diaria de Ball Sort ────────────────────────────────────────────
exports.claimBallSortRewardSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const today = limaTodayStr();
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      if (u.lastBallSortReward === today) {
        throw new functions.https.HttpsError("already-exists", "Ya reclamaste tu recompensa de hoy.");
      }
      const newBalance = (u.monedas || 0) + BALLSORT_REWARD;
      t.update(userRef, {
        monedas: newBalance,
        lastBallSortReward: today,
      });
      writeLedger(t, uid, {
        type: "earn",
        amount: BALLSORT_REWARD,
        source: "ball_sort_daily",
        balanceAfter: newBalance,
      });
      return { success: true, reward: BALLSORT_REWARD };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("claimBallSortRewardSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al reclamar la recompensa.");
  }
});

// ── Girar la ruleta (RNG server-side) ─────────────────────────────────────────
exports.spinRuletaSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const weekStart = limaWeekStartStr();

  const prizesSnap = await db.collection("ruletaPrizes").orderBy("probability", "desc").get();
  if (prizesSnap.empty) {
    throw new functions.https.HttpsError("failed-precondition", "No hay premios configurados.");
  }
  const prizes = prizesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const selected = pickWeightedPrize(prizes, Math.random() * 100);

  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      const weekly = u.weeklyClaimsData || { weekStart: "", daysClaimed: [] };
      const daysCount = weekly.weekStart === weekStart ? (weekly.daysClaimed || []).length : 0;
      if (daysCount < 7) {
        throw new functions.https.HttpsError("failed-precondition", "Ruleta no desbloqueada.");
      }
      if (u.lastRuletaSpinWeek === weekStart) {
        throw new functions.https.HttpsError("already-exists", "Ya giraste la ruleta esta semana.");
      }
      const updates = { lastRuletaSpinWeek: weekStart };
      let ruletaEarn = 0;
      if (selected.type === "Monedas") {
        ruletaEarn = Number(selected.amount || 0);
        updates.monedas = (u.monedas || 0) + ruletaEarn;
      }
      t.update(userRef, updates);
      if (ruletaEarn > 0) {
        writeLedger(t, uid, {
          type: "earn",
          amount: ruletaEarn,
          source: "ruleta_semanal",
          balanceAfter: updates.monedas,
        });
      }
      return { success: true, prize: selected };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("spinRuletaSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al girar la ruleta.");
  }
});

// ── Progreso de reto semanal ──────────────────────────────────────────────────
exports.recordChallengeEventSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const actionType = data && data.actionType;
  // H-05: el conteo se FUERZA a 1 por llamada (no se confía en el cliente). La
  // verificación real de que la acción ocurrió debe moverse a triggers server-side
  // (p.ej. onWrite de wishlist/compra/reseña) en Fase 2; hoy esto solo limita el abuso.
  const count = 1;
  if (!actionType) {
    throw new functions.https.HttpsError("invalid-argument", "Falta actionType.");
  }
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const challengeSnap = await db.collection("globals").doc("activeChallenge").get();
  if (!challengeSnap.exists) return { success: true, noActiveChallenge: true };
  const ch = challengeSnap.data();
  if (ch.actionType !== actionType) return { success: true, noMatch: true };

  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      let progress = u.weeklyChallengeProgress || {};
      if (progress.challengeId !== ch.challengeId) {
        progress = { challengeId: ch.challengeId, progress: 0, completed: false };
      }
      if (progress.completed) return { success: true, alreadyCompleted: true };

      const newProgress = Math.min((progress.progress || 0) + count, ch.goal);
      const nowCompleted = newProgress >= ch.goal;
      const updates = {
        weeklyChallengeProgress: { challengeId: ch.challengeId, progress: newProgress, completed: nowCompleted },
      };
      let challengeEarn = 0;
      if (nowCompleted) {
        if (ch.rewardType === "kapi_double_3d") {
          updates.activeMultiplier = "kapi_double_3d";
          updates.multiplierExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          challengeEarn = Number(ch.rewardCoins) || 0;
          updates.monedas = (u.monedas || 0) + challengeEarn;
        }
      }
      t.update(userRef, updates);
      if (challengeEarn > 0) {
        writeLedger(t, uid, {
          type: "earn",
          amount: challengeEarn,
          source: "reto_semanal_" + ch.challengeId,
          balanceAfter: updates.monedas,
        });
      }
      return { success: true, completed: nowCompleted };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("recordChallengeEventSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al registrar el progreso.");
  }
});

// ── Gastar monedas (canje de catálogo) ────────────────────────────────────────
exports.spendCoinsSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const amount = Number(data && data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Monto inválido.");
  }
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      if ((u.monedas || 0) < amount) {
        throw new functions.https.HttpsError("failed-precondition", "Monedas insuficientes.");
      }
      t.update(userRef, applyDebit(u, amount));
      return { success: true };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("spendCoinsSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al gastar monedas.");
  }
});

// ── Congelar monedas para un pedido (descuento en checkout) ────────────────────
exports.freezeCoinsSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const amount = Number(data && data.amount);
  const orderId = data && data.orderId;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Monto inválido.");
  }
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      if ((u.monedas || 0) < amount) {
        throw new functions.https.HttpsError("failed-precondition", "Monedas insuficientes.");
      }
      const debit = applyDebit(u, amount);
      const history = u.historialMonedasEspera || [];
      t.update(userRef, {
        ...debit,
        monedasEnEspera: (u.monedasEnEspera || 0) + amount,
        historialMonedasEspera: [
          ...history,
          { orderId: orderId || null, amount, status: "pending", date: new Date().toISOString() },
        ],
      });
      return { success: true };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("freezeCoinsSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al congelar monedas.");
  }
});

// ── Bono por encuesta (idempotente) ───────────────────────────────────────────
exports.grantSurveyRewardSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const requested = Number(data && data.coins) || 0;
  const reward = Math.max(0, Math.min(requested, SURVEY_REWARD_MAX)); // clamp anti-abuso
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      if (u.surveyRewardClaimed) return { success: true, alreadyClaimed: true };
      const newBalance = (u.monedas || 0) + reward;
      t.update(userRef, {
        monedas: newBalance,
        surveyRewardClaimed: true,
      });
      if (reward > 0) {
        writeLedger(t, uid, {
          type: "earn",
          amount: reward,
          source: "encuesta",
          balanceAfter: newBalance,
        });
      }
      return { success: true, reward };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("grantSurveyRewardSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al otorgar el bono.");
  }
});

// ── Bono por streak de fechas (idempotente) ───────────────────────────────────
exports.claimDatesStreakSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const uniqueDates = Number(data && data.uniqueDates) || 0;
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();
      if (u.streakBonusReceived) return { success: true, alreadyClaimed: true };
      if (uniqueDates < 3) return { success: true, notEligible: true };
      const newBalance = (u.monedas || 0) + STREAK_DATES_BONUS;
      t.update(userRef, {
        monedas: newBalance,
        streakBonusReceived: true,
      });
      writeLedger(t, uid, {
        type: "earn",
        amount: STREAK_DATES_BONUS,
        source: "streak_fechas",
        balanceAfter: newBalance,
      });
      return { success: true, reward: STREAK_DATES_BONUS };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("claimDatesStreakSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al otorgar el bono.");
  }
});

// ── Reclamar monedas de un referido completado ────────────────────────────────
const REFERRAL_REWARD = 10; // server-authoritative; se ignora earnedCoins del cliente (H-05)

exports.claimReferralSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const referralId = data && data.referralId;
  if (!referralId) {
    throw new functions.https.HttpsError("invalid-argument", "Falta referralId.");
  }

  // El doc de referrals es escribible por el cliente, así que NO se confía en sus
  // campos (status/earnedCoins). La legitimidad se valida contra el ERP: debe existir
  // una compra (orderId) real y finalizada. FALLA CERRADO sin credencial del ERP.
  const erpDb = getErpDb();
  if (!erpDb) {
    console.error("claimReferralSecure: ERP_SERVICE_ACCOUNT no configurado; rechazado (fail-closed).");
    throw new functions.https.HttpsError("failed-precondition", "Validación de referidos no disponible temporalmente.");
  }

  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const refRef = db.collection("referrals").doc(String(referralId));

  const refSnap0 = await refRef.get();
  if (!refSnap0.exists) throw new functions.https.HttpsError("not-found", "Referido no encontrado.");
  const orderId = refSnap0.data().orderId;
  if (!orderId) {
    throw new functions.https.HttpsError("failed-precondition", "El referido no tiene una compra asociada.");
  }

  // El pedido referido debe existir y estar finalizado en el ERP.
  let orderData = null;
  for (const coll of ["pedidos_web", "pedidos"]) {
    const snap = await erpDb.collection(coll).doc(String(orderId)).get();
    if (snap.exists) { orderData = snap.data(); break; }
  }
  if (!orderData) throw new functions.https.HttpsError("not-found", "La compra del referido no existe.");
  const estado = (orderData.estadoGeneral || orderData.estado || "")
    .toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!["finalizado", "entregado", "completado"].includes(estado)) {
    throw new functions.https.HttpsError("failed-precondition", "La compra del referido aún no está finalizada.");
  }

  // Lock GLOBAL por pedido: doc keyed por orderId en referralOrderClaims.
  const claimRef = db.collection("referralOrderClaims").doc(String(orderId));
  try {
    return await db.runTransaction(async (t) => {
      const [userSnap, refSnap, claimSnap] = await Promise.all([t.get(userRef), t.get(refRef), t.get(claimRef)]);
      if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      if (!refSnap.exists) throw new functions.https.HttpsError("not-found", "Referido no encontrado.");
      const u = userSnap.data();
      const r = refSnap.data();

      if (!u.referralCode || r.referrerCode !== u.referralCode) {
        throw new functions.https.HttpsError("permission-denied", "Este referido no le pertenece.");
      }
      // No puede referirse a sí mismo (la compra no puede ser del propio referrer).
      const ownOrder = (orderData.userId && orderData.userId === uid) ||
        (orderData.dni && u.dni && String(orderData.dni) === String(u.dni));
      if (ownOrder) {
        throw new functions.https.HttpsError("permission-denied", "No puede referirse a sí mismo.");
      }
      if (r.status === "claimed") {
        throw new functions.https.HttpsError("already-exists", "Este referido ya fue reclamado.");
      }
      // Dedup GLOBAL por pedido: cada compra otorga UN solo premio de referido (a quien
      // reclame primero), no uno por usuario. Evita que varios cosechen el mismo pedido ajeno.
      if (claimSnap.exists) {
        throw new functions.https.HttpsError("already-exists", "Esta compra ya otorgó un premio de referido.");
      }

      const newBalance = (u.monedas || 0) + REFERRAL_REWARD;
      t.set(claimRef, { uid, referralId: String(referralId), at: FieldValue.serverTimestamp() });
      t.update(refRef, { status: "claimed", claimedAt: FieldValue.serverTimestamp() });
      t.update(userRef, {
        monedas: newBalance,
        referralOrdersClaimed: FieldValue.arrayUnion(String(orderId)),
      });
      writeLedger(t, uid, {
        type: "earn",
        amount: REFERRAL_REWARD,
        source: "referido_" + String(orderId),
        balanceAfter: newBalance,
      });
      return { success: true, earned: REFERRAL_REWARD };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("claimReferralSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al reclamar el referido.");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FIDELIZACIÓN DIARIA (Fase 2): check-in, misiones diarias y ledger de lealtad.
// Contrato compartido Fase 2:
//   - 'monedas' = puntos canjeables; 'xp' = experiencia acumulativa (solo sube).
//   - 'loyaltyLedger' (id auto): { uid, type:'earn'|'spend', amount, source,
//     balanceAfter, createdAt }. Escritura solo servidor.
//   - 'missions' (config admin): { title, description, type:'daily', actionKey,
//     rewardPoints, active, order }.
//   - 'userMissions' id '<uid>_<YYYY-MM-DD>': { userId, date, items:[{ missionId,
//     completed, claimedAt }] }.
//   - 'dailyStreak' = { count, lastDate, freezeTokens }; 'lastCheckInDate'; 'xp'
//     escritos SOLO por el servidor (reglas los bloquean al cliente).
// ════════════════════════════════════════════════════════════════════════════

// ── Helper: escribe una entrada en loyaltyLedger dentro de una transacción ─────
// transaction.set sobre un doc con id auto-generado. createdAt = serverTimestamp.
function writeLedger(transaction, uid, { type, amount, source, balanceAfter }) {
  transaction.set(db.collection("loyaltyLedger").doc(), {
    uid,
    type,
    amount,
    source,
    balanceAfter,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// XP otorgada por cada acción de fidelización (acumulativa, solo sube).
const XP_CHECKIN = 10;
const XP_MISSION = 5;
// Hitos de racha que otorgan bono de monedas en el check-in diario.
const CHECKIN_MILESTONES = { 3: 5, 7: 15, 30: 50 };

// ── Check-in diario seguro (idempotente por día Lima) ──────────────────────────
// Incrementa la racha si el último check-in fue ayer; la reinicia a 1 si hubo un
// hueco. En hitos (D3=5, D7=15, D30=50) otorga bono de monedas + ledger. Suma XP.
exports.dailyCheckInSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const today = limaTodayStr();
  // "Ayer" en zona Lima: hoy menos 24h, formateado igual que limaTodayStr.
  const yesterday = limaTodayStr(Date.now() - 24 * 60 * 60 * 1000);
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();

      // Idempotencia por día: si ya hizo check-in hoy, no se altera nada.
      if (u.lastCheckInDate === today) {
        const cur = u.dailyStreak || { count: 0, lastDate: null, freezeTokens: 0 };
        return { streak: cur.count || 0, reward: 0, alreadyCheckedIn: true };
      }

      const prev = u.dailyStreak || { count: 0, lastDate: null, freezeTokens: 0 };
      const continues = prev.lastDate === yesterday;
      const newCount = continues ? (prev.count || 0) + 1 : 1;

      const newStreak = {
        count: newCount,
        lastDate: today,
        freezeTokens: prev.freezeTokens || 0,
      };

      const reward = CHECKIN_MILESTONES[newCount] || 0;
      const currentMonedas = u.monedas || 0;
      const newBalance = currentMonedas + reward;

      const updates = {
        dailyStreak: newStreak,
        lastCheckInDate: today,
        xp: (u.xp || 0) + XP_CHECKIN,
      };
      if (reward > 0) updates.monedas = newBalance;
      t.update(userRef, updates);

      if (reward > 0) {
        writeLedger(t, uid, {
          type: "earn",
          amount: reward,
          source: "checkin_d" + newCount,
          balanceAfter: newBalance,
        });
      }

      return { streak: newCount, reward };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("dailyCheckInSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al registrar el check-in.");
  }
});

// ── Asegura/devuelve las misiones diarias de hoy ───────────────────────────────
// Si el doc userMissions de hoy no existe, lo crea con las misiones activas
// (type 'daily'). Devuelve { date, items:[{ missionId, title, description,
// rewardPoints, completed }] }.
exports.getDailyMissionsSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const today = limaTodayStr();
  const docId = uid + "_" + today;
  const umRef = db.collection("userMissions").doc(docId);

  try {
    // Misiones activas diarias, ordenadas por `order`.
    const missionsSnap = await db
      .collection("missions")
      .where("type", "==", "daily")
      .where("active", "==", true)
      .get();
    const missions = missionsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Crea el doc de hoy si no existe (idempotente por id determinista).
    const completedMap = await db.runTransaction(async (t) => {
      const umSnap = await t.get(umRef);
      if (!umSnap.exists) {
        const items = missions.map((m) => ({
          missionId: m.id,
          completed: false,
          claimedAt: null,
        }));
        t.set(umRef, { userId: uid, date: today, items });
        return {};
      }
      const items = umSnap.data().items || [];
      const map = {};
      for (const it of items) map[it.missionId] = !!it.completed;
      return map;
    });

    const items = missions.map((m) => ({
      missionId: m.id,
      title: m.title || "",
      description: m.description || "",
      rewardPoints: Number(m.rewardPoints) || 0,
      completed: !!completedMap[m.id],
    }));

    return { date: today, items };
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("getDailyMissionsSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al obtener las misiones diarias.");
  }
});

// ── Completar una misión diaria (idempotente) ──────────────────────────────────
// Valida que la misión esté activa y no completada hoy; marca completed en el doc
// userMissions de hoy; otorga rewardPoints a 'monedas' + XP; escribe ledger.
exports.completeMissionSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const missionId = data && data.missionId;
  if (!missionId) {
    throw new functions.https.HttpsError("invalid-argument", "Falta missionId.");
  }
  const today = limaTodayStr();
  const docId = uid + "_" + today;
  const umRef = db.collection("userMissions").doc(docId);
  const missionRef = db.collection("missions").doc(String(missionId));
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);

  try {
    return await db.runTransaction(async (t) => {
      const [missionSnap, umSnap, userSnap] = await Promise.all([
        t.get(missionRef),
        t.get(umRef),
        t.get(userRef),
      ]);

      if (!missionSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Misión no encontrada.");
      }
      const mission = missionSnap.data();
      if (mission.active !== true) {
        throw new functions.https.HttpsError("failed-precondition", "La misión no está activa.");
      }
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      }
      const u = userSnap.data();

      // Asegura el doc userMissions de hoy si aún no existe.
      let items;
      if (!umSnap.exists) {
        items = [{ missionId: String(missionId), completed: false, claimedAt: null }];
      } else {
        items = (umSnap.data().items || []).map((it) => ({ ...it }));
      }

      let idx = items.findIndex((it) => it.missionId === String(missionId));
      if (idx < 0) {
        items.push({ missionId: String(missionId), completed: false, claimedAt: null });
        idx = items.length - 1;
      }

      // Idempotencia: si ya está completada hoy, no se vuelve a otorgar.
      if (items[idx].completed) {
        return { success: true, alreadyCompleted: true, reward: 0 };
      }

      const reward = Number(mission.rewardPoints) || 0;
      const newBalance = (u.monedas || 0) + reward;

      items[idx].completed = true;
      items[idx].claimedAt = new Date().toISOString();

      if (umSnap.exists) {
        t.update(umRef, { items });
      } else {
        t.set(umRef, { userId: uid, date: today, items });
      }

      t.update(userRef, {
        monedas: newBalance,
        xp: (u.xp || 0) + XP_MISSION,
      });

      if (reward > 0) {
        writeLedger(t, uid, {
          type: "earn",
          amount: reward,
          source: "mision_" + String(missionId),
          balanceAfter: newBalance,
        });
      }

      return { success: true, reward };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("completeMissionSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al completar la misión.");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CANJE DE RECOMPENSAS (Fase 2b): catálogo público + cupones server-authoritative.
// Contrato Fase 2b:
//   - 'rewardsCatalog' (lectura pública, escritura admin): { title, description,
//     cost (number, en puntos), value (texto ref), active (bool), order (number) }.
//   - 'userCoupons' (lectura dueño, escritura solo servidor): { uid, rewardId,
//     title, code, status:'active', createdAt }.
// ════════════════════════════════════════════════════════════════════════════

// ── Helper: genera un code aleatorio de cupón tipo 'WALA-XXXXXX' ────────────────
// 6 caracteres alfanuméricos en mayúsculas (sin O/0/I/1 para evitar confusiones),
// obtenidos de bytes criptográficamente seguros (crypto ya importado arriba).
function generateCouponCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos, sin O/0/I/1
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return "WALA-" + suffix;
}

// ── Canjear una recompensa del catálogo (transaccional, server-authoritative) ──
// Lee rewardsCatalog/{rewardId}; valida active y que el usuario tenga monedas
// suficientes (>= cost); descuenta con applyDebit; escribe ledger type 'spend';
// crea un cupón en userCoupons con un code aleatorio 'WALA-XXXXXX'.
exports.redeemRewardSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const rewardId = data && data.rewardId;
  if (!rewardId) {
    throw new functions.https.HttpsError("invalid-argument", "Falta rewardId.");
  }

  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const rewardRef = db.collection("rewardsCatalog").doc(String(rewardId));

  try {
    return await db.runTransaction(async (t) => {
      const [rewardSnap, userSnap] = await Promise.all([t.get(rewardRef), t.get(userRef)]);

      if (!rewardSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Recompensa no encontrada.");
      }
      const reward = rewardSnap.data();
      if (reward.active !== true) {
        throw new functions.https.HttpsError("failed-precondition", "La recompensa no está disponible.");
      }
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      }
      const u = userSnap.data();

      // Costo SERVER-AUTHORITATIVE: se toma del catálogo, no del cliente.
      const cost = Number(reward.cost);
      if (!Number.isFinite(cost) || cost <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "Costo de recompensa inválido.");
      }

      const currentMonedas = u.monedas || 0;
      if (currentMonedas < cost) {
        throw new functions.https.HttpsError("failed-precondition", "Monedas insuficientes.");
      }

      // Descuento FIFO + saldo global (applyDebit de economyLogic).
      const debit = applyDebit(u, cost);
      t.update(userRef, debit);
      const balanceAfter = currentMonedas - cost;

      writeLedger(t, uid, {
        type: "spend",
        amount: cost,
        source: "reward_" + String(rewardId),
        balanceAfter,
      });

      // Crea el cupón (id auto) con un code aleatorio.
      const code = generateCouponCode();
      const couponRef = db.collection("userCoupons").doc();
      t.set(couponRef, {
        uid,
        rewardId: String(rewardId),
        title: reward.title || "",
        code,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      });

      return { success: true, coupon: { rewardId: String(rewardId), code } };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("redeemRewardSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al canjear la recompensa.");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// CHECKOUT MULTI-VENDEDOR (Fase 3): order + subOrders server-authoritative.
// Recalcula precios leyendo productos_wala/{productId} (NUNCA confía en el cliente),
// agrupa por vendorId, calcula comisión/payout por vendedor y crea la orden con sus
// subórdenes en una sola transacción. NO procesa pago real (eso es Fase 3 externa).
// Colecciones: orders (con reglas), subOrders, shippingZones, payouts.
// ════════════════════════════════════════════════════════════════════════════

// ── Helpers internos: validación de items y recálculo server-authoritative ─────
// Factorizados para ser reutilizados por createOrderWithSubordersSecure y
// createCheckoutPreferenceSecure (mismo recálculo: lee productos_wala, agrupa por
// vendorId, comisión por vendors/{id}.commissionPct, envío por shippingZones/{id}.cost).

// Normaliza data.items -> Map(productId -> qty) y devuelve { qtyByProduct, shippingZoneId }.
function normalizeOrderInput(data) {
  const rawItems = data && Array.isArray(data.items) ? data.items : null;
  if (!rawItems || rawItems.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere al menos un ítem.");
  }
  const qtyByProduct = new Map();
  for (const it of rawItems) {
    const productId = it && it.productId != null ? String(it.productId) : null;
    const qty = Number(it && it.qty);
    if (!productId) {
      throw new functions.https.HttpsError("invalid-argument", "Cada ítem requiere productId.");
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "Cantidad inválida para " + productId + ".");
    }
    qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + qty);
  }
  const shippingZoneId = data && data.shippingZoneId != null ? String(data.shippingZoneId) : null;
  return { qtyByProduct, shippingZoneId };
}

// Dentro de una transacción t: lee productos/vendors/shippingZone (TODAS las lecturas
// antes que cualquier escritura), recalcula precios, agrupa por vendorId y construye
// las subórdenes + totales para una orden con id orderId / comprador buyerUid.
// Devuelve { totals, subOrderRefs, subOrderDocs, subOrderSummaries } SIN escribir nada;
// el llamador decide qué escribir y con qué status.
async function buildOrderInTransaction(t, { qtyByProduct, shippingZoneId, orderId, buyerUid }) {
  const productIds = Array.from(qtyByProduct.keys());

  // 1) Lee TODOS los productos primero (regla de Firestore: lecturas antes que escrituras).
  const productRefs = productIds.map((id) => db.collection("productos_wala").doc(id));
  const shippingRef = shippingZoneId
    ? db.collection("shippingZones").doc(shippingZoneId)
    : null;

  const productSnaps = await Promise.all(productRefs.map((ref) => t.get(ref)));
  const shippingSnap = shippingRef ? await t.get(shippingRef) : null;

  // 2) Recalcula precios server-side y agrupa por vendorId.
  const groups = new Map(); // vendorId -> { vendorId, nicheId, items[], vendorSubtotal }
  const vendorIds = new Set();

  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i];
    const snap = productSnaps[i];
    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Producto no encontrado: " + productId + ".");
    }
    const p = snap.data();
    const vendorId = p.vendorId;
    if (!vendorId) {
      throw new functions.https.HttpsError("failed-precondition", "El producto " + productId + " no tiene vendedor.");
    }

    // Precio server-authoritative: salePrice si < price, si no price.
    const price = Number(p.price);
    const salePrice = Number(p.salePrice);
    let unitPrice = price;
    if (Number.isFinite(salePrice) && salePrice < price) {
      unitPrice = salePrice;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new functions.https.HttpsError("failed-precondition", "Precio inválido para " + productId + ".");
    }

    const qty = qtyByProduct.get(productId);
    const lineTotal = unitPrice * qty;

    vendorIds.add(vendorId);
    let g = groups.get(vendorId);
    if (!g) {
      g = { vendorId, nicheId: p.nicheId || null, items: [], vendorSubtotal: 0 };
      groups.set(vendorId, g);
    }
    g.items.push({
      productId,
      name: p.name || "",
      qty,
      unitPrice: +unitPrice.toFixed(2),
    });
    g.vendorSubtotal += lineTotal;
  }

  // 3) Lee los vendors (para commissionPct) dentro de la transacción.
  const vendorIdList = Array.from(vendorIds);
  const vendorSnaps = await Promise.all(
    vendorIdList.map((vid) => t.get(db.collection("vendors").doc(String(vid))))
  );
  const commissionPctByVendor = new Map();
  for (let i = 0; i < vendorIdList.length; i++) {
    const vSnap = vendorSnaps[i];
    const pct = vSnap.exists ? Number(vSnap.data().commissionPct) : 0;
    commissionPctByVendor.set(vendorIdList[i], Number.isFinite(pct) ? pct : 0);
  }

  // 4) Envío server-authoritative desde shippingZones.
  const shipping = shippingSnap && shippingSnap.exists
    ? Number(shippingSnap.data().cost) || 0
    : 0;

  // 5) Construye subórdenes + totales (sin escribir).
  let subtotal = 0;
  let commissionTotal = 0;
  const subOrderRefs = [];
  const subOrderDocs = [];
  const subOrderSummaries = [];

  for (const g of groups.values()) {
    const vendorSubtotal = +g.vendorSubtotal.toFixed(2);
    const commissionPct = commissionPctByVendor.get(g.vendorId) || 0;
    const commissionAmount = +(vendorSubtotal * commissionPct / 100).toFixed(2);
    const vendorPayoutAmount = +(vendorSubtotal - commissionAmount).toFixed(2);

    subtotal += vendorSubtotal;
    commissionTotal += commissionAmount;

    const subRef = db.collection("subOrders").doc();
    const subDoc = {
      orderId,
      buyerUid,
      vendorId: g.vendorId,
      nicheId: g.nicheId || null,
      items: g.items,
      vendorSubtotal,
      commissionPct,
      commissionAmount,
      vendorPayoutAmount,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    };
    subOrderRefs.push(subRef);
    subOrderDocs.push(subDoc);
    subOrderSummaries.push({
      id: subRef.id,
      vendorId: g.vendorId,
      vendorSubtotal,
      commissionPct,
      commissionAmount,
      vendorPayoutAmount,
    });
  }

  subtotal = +subtotal.toFixed(2);
  commissionTotal = +commissionTotal.toFixed(2);
  const total = +(subtotal + shipping).toFixed(2);

  const totals = { subtotal, shipping, commissionTotal, total };

  return { totals, subOrderRefs, subOrderDocs, subOrderSummaries };
}

// ── Crear orden con subórdenes (transaccional, server-authoritative) ───────────
// items = [{ productId, qty }]. Por cada producto lee productos_wala/{productId}
// (precio = salePrice si < price, si no price; toma vendorId, nicheId, name).
// Agrupa por vendorId; por vendedor: vendorSubtotal = Σ(precio*qty),
// commissionPct = vendors/{vendorId}.commissionPct||0,
// commissionAmount = +(vendorSubtotal*commissionPct/100).toFixed(2),
// vendorPayoutAmount = +(vendorSubtotal - commissionAmount).toFixed(2).
// shipping = shippingZones/{shippingZoneId}.cost||0 (si se pasó).
exports.createOrderWithSubordersSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const { qtyByProduct, shippingZoneId } = normalizeOrderInput(data);

  try {
    return await db.runTransaction(async (t) => {
      const orderRef = db.collection("orders").doc();
      const orderId = orderRef.id;

      // Recálculo server-authoritative (lecturas antes que escrituras dentro de t).
      const { totals, subOrderRefs, subOrderDocs, subOrderSummaries } =
        await buildOrderInTransaction(t, {
          qtyByProduct,
          shippingZoneId,
          orderId,
          buyerUid: uid,
        });

      // Escribe order + subOrders (todas las escrituras al final).
      t.set(orderRef, {
        buyerUid: uid,
        status: "pending",
        totals,
        subOrderIds: subOrderRefs.map((r) => r.id),
        createdAt: FieldValue.serverTimestamp(),
      });
      for (let i = 0; i < subOrderRefs.length; i++) {
        t.set(subOrderRefs[i], subOrderDocs[i]);
      }

      return { orderId, totals, subOrders: subOrderSummaries };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("createOrderWithSubordersSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al crear la orden.");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SPLIT DE PAGO — Mercado Pago marketplace (Perú). Fase 3.
// ────────────────────────────────────────────────────────────────────────────
// createCheckoutPreferenceSecure: recalcula el carrito server-side (misma lógica que
// createOrderWithSubordersSecure), crea orders/{orderId} con status 'pending_payment'
// + subOrders, y devuelve un init_point de Mercado Pago (o uno simulado en local).
// confirmPaymentSecure: marca la orden como 'paid' y genera los payouts (idempotente).
// mercadoPagoWebhook: en producción, dispara confirmPayment desde la notificación de MP.
// ════════════════════════════════════════════════════════════════════════════

// Lógica compartida: marca orders/{orderId}='paid' (solo si era 'pending_payment') y
// crea un doc en 'payouts' por cada subOrder. Idempotente: si ya está 'paid', no
// duplica. Lecturas (order + subOrders) ANTES que escrituras, todo en una transacción.
async function confirmPaymentForOrder(orderId) {
  const oid = orderId != null ? String(orderId) : null;
  if (!oid) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere orderId.");
  }

  return await db.runTransaction(async (t) => {
    // 1) LECTURAS primero.
    const orderRef = db.collection("orders").doc(oid);
    const orderSnap = await t.get(orderRef);
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Orden no encontrada: " + oid + ".");
    }
    const order = orderSnap.data();

    // Idempotencia: si ya está pagada, no duplica payouts.
    if (order.status === "paid") {
      return { orderId: oid, status: "paid", payoutsCreated: 0, alreadyPaid: true };
    }
    // Solo se confirma desde 'pending_payment' (o 'pending' por compatibilidad).
    if (order.status !== "pending_payment" && order.status !== "pending") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La orden no está pendiente de pago (status actual: " + order.status + ")."
      );
    }

    // Lee las subOrders de esta orden (dentro de la transacción, antes de escribir).
    const subSnap = await t.get(
      db.collection("subOrders").where("orderId", "==", oid)
    );

    // 2) ESCRITURAS.
    const payoutRefs = [];
    subSnap.forEach((doc) => {
      const sub = doc.data();
      const payoutRef = db.collection("payouts").doc();
      payoutRefs.push({ ref: payoutRef, data: {
        vendorId: sub.vendorId,
        orderId: oid,
        subOrderId: doc.id,
        amount: sub.vendorPayoutAmount,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      }});
    });

    t.update(orderRef, {
      status: "paid",
      paidAt: FieldValue.serverTimestamp(),
    });
    for (const p of payoutRefs) {
      t.set(p.ref, p.data);
    }

    return { orderId: oid, status: "paid", payoutsCreated: payoutRefs.length, alreadyPaid: false };
  });
}

// ── createCheckoutPreferenceSecure({ items, shippingZoneId }) ──────────────────
exports.createCheckoutPreferenceSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const { qtyByProduct, shippingZoneId } = normalizeOrderInput(data);

  let orderId;
  let totals;
  try {
    const res = await db.runTransaction(async (t) => {
      const orderRef = db.collection("orders").doc();
      const oid = orderRef.id;

      // Mismo recálculo server-authoritative (lecturas antes que escrituras).
      const { totals: tot, subOrderRefs, subOrderDocs } =
        await buildOrderInTransaction(t, {
          qtyByProduct,
          shippingZoneId,
          orderId: oid,
          buyerUid: uid,
        });

      // Orden con status 'pending_payment' (a la espera del pago en Mercado Pago).
      t.set(orderRef, {
        buyerUid: uid,
        status: "pending_payment",
        totals: tot,
        subOrderIds: subOrderRefs.map((r) => r.id),
        createdAt: FieldValue.serverTimestamp(),
      });
      for (let i = 0; i < subOrderRefs.length; i++) {
        t.set(subOrderRefs[i], subOrderDocs[i]);
      }

      return { orderId: oid, totals: tot };
    });
    orderId = res.orderId;
    totals = res.totals;
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("createCheckoutPreferenceSecure (order) error:", e);
    throw new functions.https.HttpsError("internal", "Error al crear la preferencia de pago.");
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  // Sin token (emulador/local): NO se llama a Mercado Pago; init_point simulado.
  if (!accessToken) {
    return { orderId, init_point: "/pago-demo/" + orderId, simulated: true };
  }

  // Con token: crea la preferencia real en Mercado Pago con split (marketplace_fee).
  try {
    const backBase = process.env.MP_BACK_URL_BASE || "";
    const body = {
      items: [
        {
          title: "Pedido Wala",
          quantity: 1,
          unit_price: totals.total,
          currency_id: "PEN",
        },
      ],
      marketplace_fee: totals.commissionTotal,
      external_reference: orderId,
      back_urls: {
        success: backBase + "/pago-exito/" + orderId,
        failure: backBase + "/pago-error/" + orderId,
        pending: backBase + "/pago-pendiente/" + orderId,
      },
      notification_url: process.env.MP_WEBHOOK_URL || undefined,
    };

    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Mercado Pago preferences error:", resp.status, errText);
      throw new functions.https.HttpsError("internal", "Mercado Pago rechazó la preferencia.");
    }

    const pref = await resp.json();
    return { orderId, init_point: pref.init_point, simulated: false };
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("createCheckoutPreferenceSecure (MP) error:", e);
    throw new functions.https.HttpsError("internal", "Error al contactar a Mercado Pago.");
  }
});

// ── confirmPaymentSecure({ orderId }) ──────────────────────────────────────────
// Marca la orden como 'paid' y genera los payouts pendientes. Idempotente.
// En PRODUCCIÓN lo dispararía el webhook de Mercado Pago; en local simula el pago OK.
exports.confirmPaymentSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const orderId = data && data.orderId != null ? String(data.orderId) : null;

  // ── S-3: Verificación de propiedad detrás de flag (SEGURO POR DEFECTO) ──────
  // Con process.env.ENFORCE_PAYMENT_OWNERSHIP !== 'true' (default) el comportamiento
  // es EXACTAMENTE el de hoy: cualquier usuario autenticado puede confirmar. Cuando
  // el dueño active el flag, se exige que el uid autenticado sea el `buyerUid` de la
  // orden (o un admin). Así un usuario no puede confirmar el pago de una orden ajena
  // y disparar payouts indebidos.
  if (process.env.ENFORCE_PAYMENT_OWNERSHIP === "true") {
    try {
      const orderSnap = await db.collection("orders").doc(String(orderId)).get();
      if (!orderSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Orden no encontrada.");
      }
      const order = orderSnap.data() || {};
      const isOwner = order.buyerUid && order.buyerUid === uid;
      const isAdmin = await callerIsAdmin(context);
      if (!isOwner && !isAdmin) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Solo el dueño de la orden (o un administrador) puede confirmar este pago."
        );
      }
    } catch (e) {
      if (e instanceof functions.https.HttpsError) throw e;
      // Fallo al leer la orden con el flag activo: se FALLA CERRADO (no se confirma).
      console.error("confirmPaymentSecure S-3: fallo al verificar propiedad:", e);
      throw new functions.https.HttpsError("internal", "No se pudo verificar la propiedad de la orden.");
    }
  }

  try {
    return await confirmPaymentForOrder(orderId);
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("confirmPaymentSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al confirmar el pago.");
  }
});

// ── mercadoPagoWebhook (onRequest, opcional) ───────────────────────────────────
// Recibe notificaciones de Mercado Pago. Ante un 'payment' aprobado, resuelve la
// orden por external_reference y reutiliza confirmPaymentForOrder. Verificación básica.
exports.mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const body = req.body || {};
    const type = body.type || body.topic || (req.query && req.query.type);

    // Solo nos interesan notificaciones de pago.
    if (type !== "payment") {
      return res.status(200).send("ignored");
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const paymentId =
      (body.data && body.data.id) ||
      body["data.id"] ||
      (req.query && (req.query["data.id"] || req.query.id));

    if (!paymentId) {
      return res.status(200).send("no payment id");
    }

    // Sin token no podemos verificar el pago contra Mercado Pago.
    if (!accessToken) {
      console.warn("mercadoPagoWebhook: sin MERCADOPAGO_ACCESS_TOKEN, no se puede verificar.");
      return res.status(200).send("no token");
    }

    // Verificación básica: consulta el pago real a Mercado Pago.
    const payResp = await fetch("https://api.mercadopago.com/v1/payments/" + paymentId, {
      headers: { "Authorization": "Bearer " + accessToken },
    });
    if (!payResp.ok) {
      console.error("mercadoPagoWebhook: error consultando pago", payResp.status);
      return res.status(200).send("payment lookup failed");
    }
    const payment = await payResp.json();

    if (payment.status !== "approved") {
      return res.status(200).send("not approved");
    }

    const orderId = payment.external_reference;
    if (!orderId) {
      return res.status(200).send("no external_reference");
    }

    await confirmPaymentForOrder(orderId);
    return res.status(200).send("ok");
  } catch (e) {
    console.error("mercadoPagoWebhook error:", e);
    // 200 para evitar reintentos infinitos de MP ante errores no recuperables.
    return res.status(200).send("error handled");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FIDELIZACIÓN AVANZADA (Fase 5): cofre diario + segmentación RFM + ofertas flash.
// Contrato Fase 5:
//   - openDailyChestSecure (callable, requireAuth): cofre diario idempotente por
//     día Lima (campo lastChestDate). Recompensa 5..20 monedas DETERMINISTA
//     (derivada de uid+fecha, NUNCA Math.random porque rompe la repetibilidad y la
//     trazabilidad del ledger). writeLedger 'earn' source 'cofre_diario'.
//   - computeSegmentsSecure (callable, SOLO admin): segmentación RFM sobre 'orders'
//     con status 'paid'. Escribe portal_clientes_users/{uid}.segment.
//   - 'flashOffers' (lectura pública, escritura admin): { title, productId?,
//     discountPct (number), startsAt, endsAt, active (bool), order (number) }.
// ════════════════════════════════════════════════════════════════════════════

// Rango de la recompensa del cofre diario (ambos inclusive).
const CHEST_MIN_REWARD = 5;
const CHEST_MAX_REWARD = 20;

// ── Recompensa determinista del cofre (uid + fecha Lima) ───────────────────────
// Se deriva de un hash SHA-256 de `uid|fecha`, NO de Math.random (que rompería la
// idempotencia y haría irreproducible el valor ante reintentos del cliente o del
// emulador). Mapea el hash a [CHEST_MIN_REWARD, CHEST_MAX_REWARD].
function chestRewardFor(uid, dateStr) {
  const span = CHEST_MAX_REWARD - CHEST_MIN_REWARD + 1; // 5..20 -> 16 valores
  const digest = crypto.createHash("sha256").update(uid + "|" + dateStr).digest();
  // Toma 4 bytes como entero sin signo y reduce al rango.
  const n = digest.readUInt32BE(0);
  return CHEST_MIN_REWARD + (n % span);
}

// ── Cofre diario seguro (idempotente por día Lima) ─────────────────────────────
// Si lastChestDate == hoy(Lima) -> { alreadyOpened:true }. Si no, acredita una
// recompensa determinista 5..20, fija lastChestDate=hoy, escribe ledger y devuelve
// { reward, monedas:balanceAfter }. Transaccional (lee el user antes de escribir).
exports.openDailyChestSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const today = limaTodayStr();
  try {
    return await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      const u = snap.data();

      // Idempotencia por día: si ya abrió el cofre hoy, no se altera nada.
      if (u.lastChestDate === today) {
        return { alreadyOpened: true, monedas: u.monedas || 0 };
      }

      const reward = chestRewardFor(uid, today);
      const newBalance = (u.monedas || 0) + reward;

      t.update(userRef, {
        monedas: newBalance,
        lastChestDate: today,
      });

      writeLedger(t, uid, {
        type: "earn",
        amount: reward,
        source: "cofre_diario",
        balanceAfter: newBalance,
      });

      return { reward, monedas: newBalance };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("openDailyChestSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al abrir el cofre diario.");
  }
});

// ── Segmentación RFM (SOLO admin) ──────────────────────────────────────────────
// Lee 'orders' con status 'paid', agrupa por buyerUid y calcula:
//   frequency = #pedidos pagados, monetary = Σ totals.total,
//   recency = días desde el createdAt más reciente.
// Asigna segment a portal_clientes_users/{uid}:
//   'vip'       -> monetary alto (>= VIP_MONETARY) o frequency >= 3
//   'activo'    -> frequency >= 1 y recency <= RISK_DAYS
//   'en_riesgo' -> tiene pedidos pero recency > RISK_DAYS
//   'nuevo'     -> usuario registrado sin pedidos pagados
// Devuelve { processed, counts:{ vip, activo, en_riesgo, nuevo } }.
const RFM_VIP_MONETARY = 500;  // umbral de gasto acumulado para VIP
const RFM_RISK_DAYS = 60;      // días sin comprar para considerar "en riesgo"

exports.computeSegmentsSecure = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  if (!(await callerIsAdmin(context))) {
    throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede segmentar clientes.");
  }

  try {
    // 1) Agregar pedidos pagados por comprador.
    const ordersSnap = await db.collection("orders").where("status", "==", "paid").get();
    const byBuyer = new Map(); // buyerUid -> { frequency, monetary, lastMs }

    ordersSnap.forEach((doc) => {
      const o = doc.data();
      const buyerUid = o.buyerUid;
      if (!buyerUid) return;

      const total = Number(o.totals && o.totals.total) || 0;

      // createdAt puede ser Timestamp (Firestore), Date o ISO string.
      let createdMs = 0;
      const c = o.createdAt;
      if (c) {
        if (typeof c.toMillis === "function") createdMs = c.toMillis();
        else if (c instanceof Date) createdMs = c.getTime();
        else if (typeof c === "string") createdMs = Date.parse(c) || 0;
        else if (typeof c.seconds === "number") createdMs = c.seconds * 1000;
      }

      const agg = byBuyer.get(buyerUid) || { frequency: 0, monetary: 0, lastMs: 0 };
      agg.frequency += 1;
      agg.monetary += total;
      if (createdMs > agg.lastMs) agg.lastMs = createdMs;
      byBuyer.set(buyerUid, agg);
    });

    // 2) Recorrer TODOS los usuarios del portal (los sin pedidos = 'nuevo').
    const usersSnap = await db.collection(PORTAL_USERS_COLLECTION).get();
    const counts = { vip: 0, activo: 0, en_riesgo: 0, nuevo: 0 };
    const now = Date.now();
    let processed = 0;

    // Batch para escribir el segment de cada usuario.
    let batch = db.batch();
    let pending = 0;
    const commitIfNeeded = async (force) => {
      if (pending >= 400 || (force && pending > 0)) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    };

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const agg = byBuyer.get(uid);

      let segment;
      if (!agg || agg.frequency === 0) {
        segment = "nuevo";
      } else {
        const recencyDays = agg.lastMs > 0
          ? Math.floor((now - agg.lastMs) / (24 * 60 * 60 * 1000))
          : Infinity;
        if (agg.monetary >= RFM_VIP_MONETARY || agg.frequency >= 3) {
          segment = "vip";
        } else if (recencyDays > RFM_RISK_DAYS) {
          segment = "en_riesgo";
        } else {
          segment = "activo";
        }
      }

      counts[segment] = (counts[segment] || 0) + 1;
      processed += 1;

      batch.set(userDoc.ref, {
        segment,
        segmentUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      pending += 1;
      await commitIfNeeded(false);
    }

    await commitIfNeeded(true);

    return { processed, counts };
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("computeSegmentsSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al segmentar clientes.");
  }
});

exports.notificationEngine = require('./notificationsEngine').notificationEngine;
exports.sendManualPromoNotification = require('./notificationsEngine').sendManualPromoNotification;

// ── Pre-agregación analítica diaria (Fase 2, PARTE 1) ─────────────────────────
// Cron gen2 (00:20 hora Lima) que agrega el día anterior de analytics_events +
// analytics_sessions en analytics_daily/{YYYY-MM-DD}, más un callable de backfill
// solo-admin. La lógica vive en ./analyticsDaily (+ ./analyticsAggregations puras).
exports.aggregateAnalyticsDaily = require('./analyticsDaily').aggregateAnalyticsDaily;
exports.aggregateAnalyticsDailyBackfill = require('./analyticsDaily').aggregateAnalyticsDailyBackfill;

// ════════════════════════════════════════════════════════════════════════════
// PAGOS USD / TIPO DE CAMBIO Y WEBHOOK DE CULQI (Fase 0 — economía)
// Aditivo: no altera el flujo de éxito existente de Culqi/PayPal. Solo añade
//   (1) culqiWebhook: confirma pagos server-side de forma IDEMPOTENTE.
//   (2) updateFxRate: cron diario que escribe config/fx leído por el frontend.
// Reglas de dinero: el total en PEN NO se toca; el USD se deriva del total PEN.
// ════════════════════════════════════════════════════════════════════════════

// ── culqiWebhook (onRequest) ──────────────────────────────────────────────────
// Recibe la notificación (evento) que Culqi envía a la URL configurada en su panel.
// Ante un cargo exitoso ('charge.creation.succeeded' / 'charge.succeeded'), marca el
// pedido correspondiente en pedidos_web como PAGADO de forma IDEMPOTENTE (por el id
// del charge): si el charge ya fue procesado, no vuelve a escribir ni duplica nada.
//
// La relación charge -> pedido se obtiene de charge.metadata.pedidoId, que el frontend
// (CulqiCustomCheckout) envía al crear el cargo y Culqi reenvía en el evento.
//
// IDEMPOTENCIA: se usa una colección de marcas `culqiWebhookEvents/{chargeId}` creada
// con transacción + create() (falla si ya existe). Si ya existía, el webhook responde
// 200 sin reprocesar (evita doble cobro / doble marca ante reintentos de Culqi).
//
// FIRMA: el panel de Culqi entrega un "secret" para validar la autenticidad del evento
// (cabecera de firma). Aquí se deja la validación CLARAMENTE comentada y lista: cuando
// CULQI_WEBHOOK_SECRET esté configurado, descomentar el bloque de verificación HMAC.
exports.culqiWebhook = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    // ── S-2: Validación de firma (Culqi) detrás de flag ──────────────────────
    // SEGURO POR DEFECTO: la verificación SOLO se ejecuta si
    // process.env.CULQI_VERIFY_SIGNATURE === 'true'. Con el flag APAGADO (default)
    // el comportamiento es EXACTAMENTE el de hoy (se acepta el evento), así que el
    // despliegue NO cambia nada hasta que el dueño active el flag a conciencia.
    //
    // SIEMPRE se loguea la(s) cabecera(s) de firma recibida(s) para que el dueño
    // confirme el NOMBRE EXACTO de la cabecera con su cuenta de Culqi ANTES de
    // activar el flag (el nombre puede variar entre cuentas/versiones de la API).
    const verifySignature = process.env.CULQI_VERIFY_SIGNATURE === "true";
    const webhookSecret = process.env.CULQI_WEBHOOK_SECRET;

    // Posibles nombres de cabecera de firma (se loguean todos los presentes).
    const sigHeaderCandidates = [
      "x-culqi-signature",
      "culqi-signature",
      "x-signature",
      "signature",
    ];
    const receivedSigHeaders = {};
    for (const h of sigHeaderCandidates) {
      const v = req.get(h);
      if (v) receivedSigHeaders[h] = v;
    }
    console.log(
      "culqiWebhook: cabeceras de firma recibidas (para confirmar el nombre exacto antes de activar CULQI_VERIFY_SIGNATURE):",
      JSON.stringify(receivedSigHeaders)
    );

    if (verifySignature) {
      // Flag ACTIVADO: se exige firma válida.
      if (!webhookSecret) {
        console.error(
          "culqiWebhook: CULQI_VERIFY_SIGNATURE='true' pero falta CULQI_WEBHOOK_SECRET. " +
          "No se puede verificar la firma; se rechaza el evento (401)."
        );
        return res.status(401).send("signature verification not configured");
      }
      // rawBody es necesario: el HMAC se calcula sobre el cuerpo EXACTO recibido,
      // no sobre el JSON re-serializado (que puede diferir en orden/espacios).
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      // Se toma la primera cabecera candidata presente como firma provista.
      const providedSig =
        receivedSigHeaders["x-culqi-signature"] ||
        receivedSigHeaders["culqi-signature"] ||
        receivedSigHeaders["x-signature"] ||
        receivedSigHeaders["signature"] ||
        "";
      const valid = verifyWebhookSignature(rawBody, providedSig, webhookSecret);
      if (!valid) {
        console.warn("culqiWebhook: firma inválida o ausente; se rechaza (401).");
        return res.status(401).send("invalid signature");
      }
      // Firma válida: continúa el procesamiento normal.
    } else {
      // Flag APAGADO (default): mismo comportamiento de hoy. Solo se advierte.
      console.warn(
        "culqiWebhook: CULQI_VERIFY_SIGNATURE no está en 'true'; webhook SIN verificar firma " +
        "(comportamiento actual). Configure CULQI_WEBHOOK_SECRET, confirme el nombre de la " +
        "cabecera con los logs y active CULQI_VERIFY_SIGNATURE='true' para cerrar el agujero."
      );
    }

    const body = (typeof req.body === "object" && req.body) ? req.body : {};

    // Culqi envía el tipo de evento y el objeto del cargo. Se contemplan variantes de
    // nombre por compatibilidad entre versiones de la API.
    const eventType = body.type || body.event || "";
    const charge = body.data || body.object || body;

    // Solo interesan cargos exitosos.
    const isCharge = String(eventType).includes("charge") || (charge && charge.object === "charge");
    const okOutcome =
      (charge && charge.outcome && (charge.outcome.type === "venta_exitosa" || charge.outcome.code === "AUT0000")) ||
      String(eventType).includes("succeeded") ||
      String(eventType).includes("creation");
    if (!isCharge || !charge || !okOutcome) {
      // 200 para que Culqi no reintente eventos que no nos competen.
      return res.status(200).send("ignored");
    }

    const chargeId = charge.id || (charge.data && charge.data.id);
    if (!chargeId) {
      return res.status(200).send("no charge id");
    }

    const meta = charge.metadata || (charge.data && charge.data.metadata) || {};
    const pedidoId = meta.pedidoId || meta.orderId || null;

    // ── Idempotencia: marca única por chargeId ───────────────────────────────
    const eventRef = db.collection("culqiWebhookEvents").doc(String(chargeId));
    let alreadyProcessed = false;
    await db.runTransaction(async (t) => {
      const existing = await t.get(eventRef);
      if (existing.exists) {
        alreadyProcessed = true;
        return;
      }
      t.create(eventRef, {
        chargeId: String(chargeId),
        pedidoId: pedidoId ? String(pedidoId) : null,
        amount: charge.amount ?? null, // céntimos, tal como lo reporta Culqi
        currency: charge.currency_code || charge.currency || null,
        receivedAt: FieldValue.serverTimestamp(),
      });
    });

    if (alreadyProcessed) {
      // Ya se procesó este charge: no se vuelve a marcar el pedido (sin doble cobro/marca).
      return res.status(200).send("already processed");
    }

    // ── Marcar el pedido como pagado en pedidos_web (ERP), de forma idempotente ─
    if (pedidoId) {
      try {
        const erpDb = getErpDb();
        if (erpDb) {
          const pedidoRef = erpDb.collection("pedidos_web").doc(String(pedidoId));
          await erpDb.runTransaction(async (t) => {
            const snap = await t.get(pedidoRef);
            if (!snap.exists) {
              console.warn(`culqiWebhook: pedido ${pedidoId} no existe en pedidos_web.`);
              return;
            }
            const d = snap.data() || {};
            // Idempotente: si ya está pagado por este charge, no se reescribe.
            if (d.pagado === true && d.culqiChargeId === String(chargeId)) {
              return;
            }
            t.set(pedidoRef, {
              pagado: true,
              estadoPago: "pagado",
              culqiChargeId: String(chargeId),
              montoPagado: charge.amount ?? d.montoTotal ?? null, // céntimos según Culqi
              montoPendiente: 0, // saldado
              pagadoAt: FieldValue.serverTimestamp(),
              metodoPago: "culqi",
            }, { merge: true });
          });
        } else {
          console.warn("culqiWebhook: ERP no disponible (getErpDb null); no se pudo marcar el pedido.");
        }

        // ── ADITIVO: marca el espejo wala_pedidos como pagado (fuente de verdad WALA) ─
        // Best-effort e idempotente; no afecta la marca de pedidos_web de arriba ni la
        // idempotencia por chargeId del webhook.
        await marcarWalaPedidoPagado({
          pedidoId,
          metodoPago: "culqi",
          montoPagado: charge.amount ?? null, // céntimos según Culqi (informativo)
        });
      } catch (e) {
        // No se hace fallar el webhook: el evento ya quedó registrado (idempotente) y
        // Culqi no debe reintentar indefinidamente. Se registra para revisión manual.
        console.error("culqiWebhook: error al marcar pedido pagado:", e);
      }
    } else {
      // Cobro sin pedido asociado (metadata.pedidoId ausente): se registra como ANOMALÍA
      // para reconciliación manual del admin (evita el "cobro fantasma" sin rastro).
      console.warn(`culqiWebhook: charge ${chargeId} sin pedidoId en metadata; solo se registró el evento.`);
      try {
        await db.collection("culqiWebhookAnomalies").doc(String(chargeId)).set({
          chargeId: String(chargeId),
          amount: charge.amount ?? null,
          currency: charge.currency_code || charge.currency || null,
          motivo: "sin_pedidoId",
          receivedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.error("culqiWebhook: no se pudo registrar anomalía:", e);
      }
    }

    return res.status(200).send("ok");
  } catch (e) {
    console.error("culqiWebhook error:", e);
    // 200 para evitar reintentos infinitos de Culqi ante errores no recuperables.
    return res.status(200).send("error handled");
  }
});

// ── updateFxRate (cron diario) ────────────────────────────────────────────────
// Lee una API FX gratuita SIN key y escribe config/fx, que el frontend LEE para
// convertir el total PEN a USD (PayPal/Culqi-USD) y para el display de moneda local.
//
// Schema escrito en config/fx:
//   {
//     penPerUsd: number,            // soles por 1 USD (rates.PEN)
//     margin: number,              // margen de cobro (se CONSERVA el actual; 0.04 por defecto)
//     localPerUsd: { [code]: num },// todas las tasas vs USD (incluye COP, ARS, etc. para display)
//     updatedAt: serverTimestamp,
//     source, base, fetchedRateDate// metadatos de trazabilidad
//   }
// Fórmula de cobro USD (en el frontend): (penTotal / penPerUsd) * (1 + margin).
//
// Tolerancia a fallos: si el fetch falla, NO se sobrescribe config/fx (se conserva el
// último valor bueno) y se registra el error; el frontend usa su fallback.
exports.updateFxRate = onSchedule(
  {
    schedule: "0 6 * * *",       // diario 06:00
    timeZone: "America/Lima",     // hora de Lima
    retryCount: 2,
  },
  async (event) => {
    const FX_DEFAULT_MARGIN = 0.04; // 4% por defecto si aún no existe config/fx
    const fxRef = db.collection("config").doc("fx");

    try {
      // API FX gratuita sin key. Base USD.
      const resp = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!resp.ok) {
        console.error("updateFxRate: fetch FX falló con status", resp.status);
        return; // se conserva el valor previo de config/fx
      }
      const json = await resp.json();
      const rates = json && json.rates;
      const penPerUsd = rates && Number(rates.PEN);

      if (!rates || !Number.isFinite(penPerUsd) || penPerUsd <= 0) {
        console.error("updateFxRate: respuesta FX sin PEN válido; no se sobrescribe config/fx.");
        return;
      }

      // Conservar el margin actual si ya existe; si no, usar el por defecto.
      let margin = FX_DEFAULT_MARGIN;
      try {
        const prev = await fxRef.get();
        if (prev.exists && Number.isFinite(Number(prev.data().margin))) {
          margin = Number(prev.data().margin);
        }
      } catch (e) {
        console.warn("updateFxRate: no se pudo leer margin previo, se usa el por defecto:", e.message);
      }

      await fxRef.set(
        {
          penPerUsd,                 // soles por 1 USD
          margin,                    // margen de cobro (configurable; se conserva)
          localPerUsd: rates,        // todas las tasas vs USD (display de moneda local)
          source: "open.er-api.com",
          base: json.base_code || "USD",
          fetchedRateDate: json.time_last_update_utc || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true } // merge: no pisa otros campos que el admin pudiera añadir
      );

      console.log(`updateFxRate: config/fx actualizado. penPerUsd=${penPerUsd}, margin=${margin}`);
    } catch (e) {
      // Nunca se borra la última tasa buena: solo se registra el fallo.
      console.error("updateFxRate error (se conserva la tasa previa):", e);
    }
  }
);

// ════════════════════════════════════════════════════════════════════════════
// FEATURE B — "MIS FECHAS ESPECIALES" (registro de regalos por fecha)
// ────────────────────────────────────────────────────────────────────────────
// La página pública /regalar/:referralCode debe mostrar, SIN login, las fechas
// especiales del dueño + su wishlist, para que un tercero elija una fecha de
// entrega y compre un regalo. Enfoque SEGURO (decisión del usuario): el cliente
// NO lee Firestore directo; llama a esta Cloud Function, que devuelve SOLO datos
// mínimos y públicos. Así las reglas de portal_clientes_users quedan cerradas y
// nunca se expone email/teléfono/dni/perfil completo ni datos de terceros
// (otros recipients/familiares) más allá de su nombre como contexto del evento.
//
// onCall accesible SIN autenticación: cualquiera con el referralCode (KS-XXXXXX)
// puede consultarlo, igual que hoy se comparte la wishlist pública.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Callable (público, sin login): getPublicGiftRegistry
 *
 * Entrada:  { referralCode: "KS-XXXXXX" }
 * Salida (éxito):
 *   {
 *     ok: true,
 *     ownerName: "Juan",                     // displayName/name del dueño (público)
 *     dates: [                               // giftRecipients[].events[] aplanado
 *       {
 *         type: "Cumpleaños"|"Aniversario"|"Fecha Especial",
 *         date: "YYYY-MM-DD",                // fecha de entrega seleccionable
 *         label: "Cumpleaños de mamá",       // customName || type (texto humano)
 *         recipientName: "Mamá",             // nombre del recipient (contexto)
 *         relation: "Padre/Madre"            // roleDisplay del recipient (contexto)
 *       }, ...
 *     ],
 *     wishlistItems: [                       // items de la wishlist del dueño
 *       { productId, productName, productImage, price, isGifted }, ...
 *     ]
 *   }
 * Salida (no encontrado / error tolerado): { ok: false }
 *
 * NO devuelve: email, teléfono, dni, ni el perfil completo del dueño ni de terceros.
 * Tolerante a errores: ante cualquier fallo o dato faltante responde { ok: false }
 * (o listas vacías) en vez de lanzar, para no romper la página pública.
 */
exports.getPublicGiftRegistry = functions.https.onCall(async (data, context) => {
  try {
    // ── Validar y normalizar el código ──────────────────────────────────────
    const referralCodeRaw = data && data.referralCode;
    const referralCode =
      typeof referralCodeRaw === "string" && referralCodeRaw.trim()
        ? referralCodeRaw.trim().toUpperCase()
        : null;
    if (!referralCode) {
      // No se lanza HttpsError: la página pública solo necesita { ok:false }.
      return { ok: false };
    }

    // ── Resolver el userId del dueño a partir del referralCode ──────────────
    // Estrategia 1 (preferida): la wishlist guarda userCode = referralCode y su
    // doc.id = userId; así obtenemos userId + items en una sola lectura.
    // Estrategia 2 (respaldo): query portal_clientes_users where referralCode==code,
    // por si el dueño aún no tiene wishlist creada pero sí fechas en su perfil.
    let userId = null;
    let wishlistItems = [];

    try {
      const wlSnap = await db
        .collection("wishlists")
        .where("userCode", "==", referralCode)
        .limit(1)
        .get();
      if (!wlSnap.empty) {
        const wlDoc = wlSnap.docs[0];
        const wlData = wlDoc.data() || {};
        userId = wlData.userId || wlDoc.id; // doc.id = uid del dueño
        const items = Array.isArray(wlData.items) ? wlData.items : [];
        // Campos públicos del item + isGifted (solo DISPONIBILIDAD; NO es PII) para que la
        // página marque "ya regalado" y evite que dos personas regalen lo mismo. NO se expone
        // giftedBy/addedAt ni ningún dato personal.
        wishlistItems = items.map((it) => ({
          productId: it.productId || null,
          productName: it.productName || "",
          productImage: it.productImage || "",
          // Precio snapshot guardado al agregar a la wishlist (items antiguos sin
          // el campo → null; el cliente ya lee item.price || 0). NO es PII.
          price: it.price ?? null,
          isGifted: !!it.isGifted,
        }));
      }
    } catch (e) {
      console.warn("getPublicGiftRegistry: fallo al leer wishlist por código:", e.message);
    }

    // Respaldo: si la wishlist no resolvió el userId, buscar en el perfil.
    if (!userId) {
      try {
        const userQ = await db
          .collection(PORTAL_USERS_COLLECTION)
          .where("referralCode", "==", referralCode)
          .limit(1)
          .get();
        if (!userQ.empty) {
          userId = userQ.docs[0].id;
        }
      } catch (e) {
        console.warn("getPublicGiftRegistry: fallo al resolver userId por referralCode:", e.message);
      }
    }

    // Sin dueño identificable → no existe el registro.
    if (!userId) {
      return { ok: false };
    }

    // ── Respaldo CONFIABLE de la wishlist: leer por doc.id = userId ──────────
    // Si la estrategia 1 (query por userCode) no trajo items (userCode con casing
    // distinto / ausente / lista creada de otra forma) pero SÍ resolvimos el userId,
    // leemos la wishlist directo por su id (= userId). Así los productos cargan
    // aunque el userCode no coincida. (Bug: cargaban las fechas pero no los items.)
    if (wishlistItems.length === 0 && userId) {
      try {
        const wlByIdSnap = await db.collection("wishlists").doc(String(userId)).get();
        if (wlByIdSnap.exists) {
          const items = Array.isArray(wlByIdSnap.data().items) ? wlByIdSnap.data().items : [];
          wishlistItems = items.map((it) => ({
            productId: it.productId || null,
            productName: it.productName || "",
            productImage: it.productImage || "",
            // Precio snapshot (mismo criterio que la estrategia 1; antiguos → null).
            price: it.price ?? null,
            isGifted: !!it.isGifted,
          }));
        }
      } catch (e) {
        console.warn("getPublicGiftRegistry: fallo al leer wishlist por userId:", e.message);
      }
    }

    // ── Leer el doc del dueño y extraer SOLO lo público ─────────────────────
    let ownerName = "Alguien";
    let dates = [];
    try {
      const ownerSnap = await db.collection(PORTAL_USERS_COLLECTION).doc(userId).get();
      if (ownerSnap.exists) {
        const owner = ownerSnap.data() || {};
        // Nombre público del dueño (mismo criterio que WishlistPublic).
        ownerName = owner.displayName || owner.name || "Alguien";

        // Aplanar giftRecipients[].events[] → dates[] (mínimo y público).
        const recipients = Array.isArray(owner.giftRecipients) ? owner.giftRecipients : [];
        recipients.forEach((recipient) => {
          if (!recipient || !Array.isArray(recipient.events)) return;
          const recipientName = recipient.name || "";
          // Relación con el dueño ("Padre/Madre", "Hijo/a"...); dato público,
          // mismo criterio que recipientName, para mostrar "(<relación>)".
          const recipientRelation = recipient.roleDisplay || "";
          // NUEVO — datos para replicar la tarjeta "bonita" de Fechas Importantes
          // en /regalar: foto de la persona + claves para derivar las ocasiones
          // globales (Día de la Mujer, San Valentín, ...) con getGlobalDates en el
          // cliente. No es PII sensible (mismo criterio que recipientName/relation).
          const recipientPhoto = recipient.photoUrl || null; // foto circular (o null)
          const recipientRoleKey = recipient.roleKey || ""; // pareja/hijos/padres/...
          const recipientGender = recipient.gender || ""; // Masculino/Femenino/Otro
          recipient.events.forEach((event) => {
            if (!event || !event.date) return; // sin fecha no es seleccionable
            dates.push({
              type: event.type || "Fecha Especial",
              date: event.date, // 'YYYY-MM-DD'
              // label = texto humano para la card; customName si lo definió.
              label: event.customName || event.type || "Fecha Especial",
              recipientName, // contexto ("Cumpleaños de Mamá"); no es PII sensible
              relation: recipientRelation, // contexto ("(Padre/Madre)"); no es PII sensible
              recipientPhoto, // NUEVO — foto de la persona para la tarjeta de /regalar
              roleKey: recipientRoleKey, // NUEVO — para derivar ocasiones globales en cliente
              gender: recipientGender, // NUEVO — para derivar ocasiones globales en cliente
            });
          });
        });

        // ── Cumpleaños PROPIO del dueño (owner.birthDate) ──────────────────
        // /regalar es para que REGALEN al dueño, así que su propio cumpleaños
        // debe aparecer como fecha regalable (de PRIMERO), junto a los de
        // terceros, para que también le puedan auto-regalar en su día.
        if (typeof owner.birthDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(owner.birthDate)) {
          dates.unshift({
            type: "Cumpleaños",
            date: owner.birthDate,
            label: "Cumpleaños",
            recipientName: ownerName, // el propio dueño (el festejado)
            relation: "", // sin relación: queda "Cumpleaños de <dueño>"
            // Foto de perfil del dueño: el avatar real vive en
            // avatarConfig.avatarUrl (lo guarda PerfilPage/AvatarStudio); se dejan
            // photoURL/avatarUrl como respaldo por si algún perfil los usa. null si no hay.
            recipientPhoto:
              (owner.avatarConfig && owner.avatarConfig.avatarUrl) ||
              owner.photoURL ||
              owner.avatarUrl ||
              null,
            roleKey: "", // el dueño no tiene rol de tercero
            gender: owner.gender || "", // por si deriva "Día de la Mujer/Hombre"
          });
        }
      } else {
        // El código resolvió a un userId que ya no tiene perfil → no existe.
        return { ok: false };
      }
    } catch (e) {
      console.warn("getPublicGiftRegistry: fallo al leer el perfil del dueño:", e.message);
      // El dueño existe (hay wishlist) pero no se pudieron leer las fechas;
      // se devuelve lo que se tenga (wishlist) con dates vacío, sin romper la página.
    }

    return {
      ok: true,
      ownerName,
      dates,
      wishlistItems,
    };
  } catch (err) {
    // Tolerante a errores: nunca lanza hacia la página pública.
    console.error("getPublicGiftRegistry error:", err);
    return { ok: false };
  }
});

// ════════════════════════════════════════════════════════════════════════════
// S-1 — PAGOS PAYPAL SERVER-SIDE (CABLEADO AL CLIENTE TRAS EL FLAG, OFF POR DEFECTO)
// ────────────────────────────────────────────────────────────────────────────
// Estas dos Cloud Functions mueven el cobro de PayPal al servidor para cerrar el
// agujero S-1 (con el flujo viejo el cliente captura el pago en el navegador y
// escribe directo a pedidos_web). PaypalCheckout.jsx YA las invoca
// (createPaypalOrderSecure / capturePaypalOrderSecure) cuando el build flag
// VITE_PAYPAL_SERVER_SIDE === 'true'. Por defecto el flag está APAGADO, así que el
// cliente sigue usando el flujo viejo y la sola existencia de estas CFs NO rompe
// nada.
//
// Pasos para ACTIVAR el flujo server-side (los hace el DUEÑO):
//   1) configurar PAYPAL_CLIENT_ID y PAYPAL_SECRET en las Cloud Functions,
//   2) para producción, poner PAYPAL_ENV='live' (sin esto se usa sandbox),
//   3) probar primero en sandbox,
//   4) recién entonces poner VITE_PAYPAL_SERVER_SIDE=true en Vercel y redeployar
//      el frontend.
//
// Flujo previsto (igual de robusto que processCulqiPayment/H-11):
//   1) createPaypalOrderSecure({ pedidoId }):
//        - autentica al usuario,
//        - RECALCULA el monto USD server-side desde el pedido real (PEN -> USD con
//          config/fx), NUNCA confía en un monto del cliente,
//        - crea la orden en PayPal (intent CAPTURE) con OAuth,
//        - devuelve { orderID } para que el cliente abra el aprobador de PayPal.
//   2) capturePaypalOrderSecure({ orderID, pedidoId }):
//        - autentica,
//        - captura la orden en PayPal,
//        - verifica status === 'COMPLETED' y que el monto capturado coincide con el
//          recalculado server-side,
//        - SOLO entonces marca el pedido como pagado en pedidos_web vía Admin SDK,
//          de forma idempotente por captureId.
//
// Si faltan envs (PAYPAL_CLIENT_ID/PAYPAL_SECRET), ambas responden un error CLARO
// (failed-precondition). Con VITE_PAYPAL_SERVER_SIDE apagado (por defecto) ningún
// cliente las llama, así que esto no afecta a producción hasta que el dueño active
// el flag.

// Base de la API REST de PayPal según el modo (sandbox por defecto = seguro para probar).
// Para producción, el dueño debe poner PAYPAL_ENV='live'.
function paypalApiBase() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// Obtiene un access token OAuth2 (client_credentials) de PayPal. Lanza HttpsError
// con mensaje claro si faltan credenciales o si PayPal rechaza.
async function getPaypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "PayPal no está configurado en el servidor (faltan PAYPAL_CLIENT_ID y/o PAYPAL_SECRET)."
    );
  }
  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const resp = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.access_token) {
    console.error("getPaypalAccessToken: PayPal OAuth falló:", resp.status, json);
    throw new functions.https.HttpsError("internal", "No se pudo autenticar con PayPal.");
  }
  return json.access_token;
}

// Recalcula el monto USD AUTORITATIVO del pedido server-side: lee el total en PEN
// del pedido real (pedidos_web/pedidos en el ERP) y lo convierte a USD con config/fx
// usando la misma fórmula del frontend: (penTotal / penPerUsd) * (1 + margin).
// Devuelve { usd: "12.34", penTotal, penPerUsd, margin } o lanza HttpsError claro.
async function computePaypalUsdForOrder(pedidoId) {
  const oid = pedidoId != null ? String(pedidoId) : null;
  if (!oid) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere pedidoId.");
  }

  // 1) Total en PEN desde el pedido real (no se confía en el cliente).
  const erpDb = getErpDb();
  if (!erpDb) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No se puede validar el pedido (ERP no disponible)."
    );
  }
  let orderData = null;
  for (const coll of ["pedidos_web", "pedidos"]) {
    const snap = await erpDb.collection(coll).doc(oid).get();
    if (snap.exists) { orderData = snap.data(); break; }
  }
  if (!orderData) {
    throw new functions.https.HttpsError("not-found", "Pedido no encontrado.");
  }
  // Se prioriza el saldo pendiente / deuda (con descuento por monedas ya aplicado).
  const penTotal = Number(
    orderData.montoPendiente ?? orderData.montoDeuda ?? orderData.montoTotal
  );
  if (!Number.isFinite(penTotal) || penTotal <= 0) {
    throw new functions.https.HttpsError("failed-precondition", "El pedido no tiene un monto válido por cobrar.");
  }

  // 2) Tasa FX desde config/fx (la misma que usa el frontend).
  const fxSnap = await db.collection("config").doc("fx").get();
  if (!fxSnap.exists) {
    throw new functions.https.HttpsError("failed-precondition", "Tipo de cambio no disponible (config/fx).");
  }
  const fx = fxSnap.data() || {};
  const penPerUsd = Number(fx.penPerUsd);
  const margin = Number.isFinite(Number(fx.margin)) ? Number(fx.margin) : 0;
  if (!Number.isFinite(penPerUsd) || penPerUsd <= 0) {
    throw new functions.https.HttpsError("failed-precondition", "Tipo de cambio inválido (penPerUsd).");
  }

  // 3) USD final con margen, redondeado a 2 decimales (formato PayPal).
  const usdNum = (penTotal / penPerUsd) * (1 + margin);
  const usd = usdNum.toFixed(2);
  if (!(Number(usd) > 0)) {
    throw new functions.https.HttpsError("failed-precondition", "Monto USD calculado inválido.");
  }
  return { usd, penTotal, penPerUsd, margin };
}

// ── createPaypalOrderSecure({ pedidoId }) ──────────────────────────────────────
// Crea la orden PayPal (intent CAPTURE) con el monto USD recalculado server-side.
// Devuelve { orderID, amountUsd, pedidoId } para que el cliente abra el aprobador.
exports.createPaypalOrderSecure = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  const pedidoId = data && (data.pedidoId || data.orderId);

  // Monto USD autoritativo (recalculado del pedido real; nunca del cliente).
  const { usd } = await computePaypalUsdForOrder(pedidoId);

  const accessToken = await getPaypalAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          // reference_id liga la orden de PayPal con el pedido para validar al capturar.
          reference_id: String(pedidoId),
          description: `Pago del pedido #${pedidoId}`,
          custom_id: String(pedidoId),
          amount: {
            currency_code: "USD",
            value: usd,
          },
        },
      ],
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.id) {
    console.error("createPaypalOrderSecure: PayPal rechazó la creación:", resp.status, json);
    throw new functions.https.HttpsError("internal", "PayPal no pudo crear la orden.");
  }

  return { orderID: json.id, amountUsd: usd, pedidoId: String(pedidoId) };
});

// ── capturePaypalOrderSecure({ orderID, pedidoId }) ────────────────────────────
// Captura la orden en PayPal, verifica COMPLETED + monto recalculado, y SOLO
// entonces marca el pedido como pagado en pedidos_web vía Admin SDK (idempotente
// por captureId). Espejo de la lógica de processCulqiPayment/culqiWebhook.
exports.capturePaypalOrderSecure = functions.https.onCall(async (data, context) => {
  requireAuth(context);
  const orderID = data && data.orderID;
  const pedidoId = data && (data.pedidoId || data.orderId);
  if (!orderID) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere orderID de PayPal.");
  }

  // Monto USD esperado (recalculado server-side) para comparar contra lo capturado.
  const { usd: expectedUsd } = await computePaypalUsdForOrder(pedidoId);

  const accessToken = await getPaypalAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    // Cuerpo vacío: la orden ya trae el purchase_unit creado en createPaypalOrderSecure.
    body: JSON.stringify({}),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("capturePaypalOrderSecure: PayPal rechazó la captura:", resp.status, json);
    throw new functions.https.HttpsError("internal", "PayPal no pudo capturar la orden.");
  }

  // 1) status COMPLETED a nivel de orden.
  if (json.status !== "COMPLETED") {
    console.warn("capturePaypalOrderSecure: status no COMPLETED:", json.status);
    throw new functions.https.HttpsError("failed-precondition", `El pago no se completó (status: ${json.status}).`);
  }

  // 2) Extraer la captura y validar monto + moneda + reference_id contra lo esperado.
  const pu = (json.purchase_units && json.purchase_units[0]) || {};
  const capture = (pu.payments && pu.payments.captures && pu.payments.captures[0]) || {};
  const captureStatus = capture.status;
  const capturedValue = capture.amount && capture.amount.value;
  const capturedCurrency = capture.amount && capture.amount.currency_code;
  const captureId = capture.id || null;
  const refId = pu.reference_id || pu.custom_id || null;

  if (captureStatus !== "COMPLETED") {
    throw new functions.https.HttpsError("failed-precondition", `La captura no se completó (status: ${captureStatus}).`);
  }
  if (capturedCurrency !== "USD") {
    throw new functions.https.HttpsError("failed-precondition", `Moneda inesperada en la captura: ${capturedCurrency}.`);
  }
  // El monto capturado debe coincidir con el recalculado server-side (tolerancia 1 céntimo
  // por redondeos de PayPal). Si difiere, NO se marca el pedido pagado.
  if (Math.abs(Number(capturedValue) - Number(expectedUsd)) > 0.01) {
    console.error(
      `capturePaypalOrderSecure: monto capturado (${capturedValue}) != esperado (${expectedUsd}) ` +
      `para pedido ${pedidoId}.`
    );
    throw new functions.https.HttpsError("failed-precondition", "El monto capturado no coincide con el del pedido.");
  }
  if (refId && String(refId) !== String(pedidoId)) {
    console.error(`capturePaypalOrderSecure: reference_id (${refId}) != pedidoId (${pedidoId}).`);
    throw new functions.https.HttpsError("failed-precondition", "La orden de PayPal no corresponde a este pedido.");
  }

  // 3) Marcar el pedido como pagado en pedidos_web (ERP), idempotente por captureId.
  try {
    const erpDb = getErpDb();
    if (erpDb && pedidoId) {
      const pedidoRef = erpDb.collection("pedidos_web").doc(String(pedidoId));
      await erpDb.runTransaction(async (t) => {
        const snap = await t.get(pedidoRef);
        if (!snap.exists) {
          console.warn(`capturePaypalOrderSecure: pedido ${pedidoId} no existe en pedidos_web.`);
          return;
        }
        const d = snap.data() || {};
        // Idempotente: si ya está pagado por esta captura, no se reescribe.
        if (d.pagado === true && d.paypalCaptureId === String(captureId)) {
          return;
        }
        t.set(pedidoRef, {
          pagado: true,
          estadoPago: "pagado",
          conDeuda: false,
          montoDeuda: 0,
          montoPendiente: 0,
          paypalOrderId: String(orderID),
          paypalCaptureId: captureId ? String(captureId) : null,
          montoPagadoUsd: capturedValue,
          pagadoAt: FieldValue.serverTimestamp(),
          metodoPago: "paypal",
        }, { merge: true });
      });
    } else {
      console.warn("capturePaypalOrderSecure: ERP no disponible; no se pudo marcar el pedido (el cobro YA se capturó).");
    }
  } catch (e) {
    // El cobro ya está capturado en PayPal: no se hace fallar al cliente por un
    // fallo al escribir el pedido. Se registra para reconciliación manual.
    console.error("capturePaypalOrderSecure: el cobro se capturó pero falló la actualización del pedido:", e);
  }

  // ── ADITIVO: marca el espejo wala_pedidos como pagado (fuente de verdad WALA) ───
  // Best-effort e idempotente; no afecta el cálculo del monto USD ni la marca de
  // pedidos_web de arriba. montoPagado se deja como el monto USD capturado (informativo).
  await marcarWalaPedidoPagado({ pedidoId, metodoPago: "paypal", montoPagado: capturedValue });

  return {
    success: true,
    status: "COMPLETED",
    captureId,
    amountUsd: capturedValue,
    pedidoId: String(pedidoId),
  };
});

// ════════════════════════════════════════════════════════════════════════════
// MÓDULO SORTEOS (server-authoritative, idempotente, contador con shards)
// El cliente NO escribe en /sorteos ni sus subcolecciones (las reglas lo bloquean):
// toda participación pasa por esta callable, que valida server-side el perfil, el
// estado del sorteo y el requisito de app. La página lee el doc del sorteo + los
// shards del contador (NO escanea /participantes) para minimizar lecturas en lives.
// ════════════════════════════════════════════════════════════════════════════

// Número de shards del contador de participantes (subcolección /contador/{0..N-1}).
// Debe coincidir con la constante que use el cliente al sumar los shards.
const SORTEO_CONTADOR_SHARDS = 10;

// ── Participar en un sorteo GRATIS (onCall) ──────────────────────────────────
// params: { sorteoId:string, origenApp:bool }
// Server-authoritative: usa el uid del token y el perfil leído server-side; del
// cliente solo se confía origenApp (si entró desde el app nativo). Idempotente:
// el doc participante tiene id=uid, reentrar es no-op (no duplica ni recuenta).
exports.participarSorteoGratis = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const sorteoId = data && data.sorteoId;
  if (!sorteoId || typeof sorteoId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Falta sorteoId.");
  }
  // Único dato de confianza que aporta el cliente: si la sesión corre en el app.
  const origenApp = data && data.origenApp === true;

  const sorteoRef = db.collection("sorteos").doc(sorteoId);
  const participanteRef = sorteoRef.collection("participantes").doc(uid);
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);

  // 1) El sorteo debe existir, estar activo y ser gratis.
  const sorteoSnap = await sorteoRef.get();
  if (!sorteoSnap.exists) {
    throw new functions.https.HttpsError("not-found", "El sorteo no existe.");
  }
  const sorteo = sorteoSnap.data();
  if (sorteo.estado !== "activo") {
    throw new functions.https.HttpsError("failed-precondition", "El sorteo no está activo.");
  }
  if (sorteo.tipo === "pagado") {
    throw new functions.https.HttpsError("failed-precondition", "este sorteo requiere comprar ticket");
  }
  if (sorteo.tipo !== "gratis") {
    throw new functions.https.HttpsError("failed-precondition", "Tipo de sorteo no válido.");
  }

  // 2) El perfil del uid debe estar COMPLETO (equivalente a !profileIncomplete):
  //    displayName, phone, email y dni presentes. Se lee server-side; nunca se
  //    confía en datos de perfil enviados por el cliente.
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("failed-precondition", "completa tu perfil");
  }
  const u = userSnap.data();
  const telefono = u.phone;
  const correo = u.email;
  const dni = u.dni;
  // nombre: si no hay displayName, cae al correo (siempre presente tras login).
  const nombre = (u.displayName && String(u.displayName).trim()) || correo || "Participante";
  // "Perfil completo" = MISMO criterio que el cliente (AuthContext.profileIncomplete):
  // teléfono + documento. El correo siempre existe tras el login; el nombre tiene
  // fallback. Así el gate del cliente y la validación del servidor no discrepan.
  const perfilCompleto =
    !!(telefono && String(telefono).trim()) &&
    !!(dni && String(dni).trim());
  if (!perfilCompleto) {
    throw new functions.https.HttpsError("failed-precondition", "completa tu perfil");
  }

  // 3) Requisito de app.
  //    - "obligatorio": debe entrar desde el app.
  //    - "chanceExtra": +1 chance si entra desde el app.
  //    - "opcional": sin efecto.
  const requisitoApp = sorteo.requisitoApp;
  if (requisitoApp === "obligatorio" && !origenApp) {
    throw new functions.https.HttpsError("failed-precondition", "debes entrar desde el app");
  }
  const chanceExtraApp = requisitoApp === "chanceExtra" && origenApp ? 1 : 0;

  // 4) Transacción idempotente: si ya participa, no-op; si no, crea el doc
  //    participante (id=uid) e incrementa un shard aleatorio del contador.
  const shardIndex = Math.floor(Math.random() * SORTEO_CONTADOR_SHARDS);
  const shardRef = sorteoRef.collection("contador").doc(String(shardIndex));

  try {
    return await db.runTransaction(async (t) => {
      const pSnap = await t.get(participanteRef);
      if (pSnap.exists) {
        // Idempotencia: reentrar NO duplica ni recuenta.
        return { ok: true, yaParticipa: true, participacion: pSnap.data() };
      }

      const chancesBase = 1;
      const chancesExtra = chanceExtraApp;
      const chancesTotal = chancesBase + chancesExtra;

      const participacion = {
        uid,
        nombre,
        telefono,
        correo,
        dni,
        tickets: 0,          // gratis: sin tickets
        ticketsPagados: 0,
        chancesBase,
        chancesExtra,
        chancesTotal,
        origenApp,
        estado: "elegible",
        createdAt: FieldValue.serverTimestamp(),
      };

      t.set(participanteRef, participacion);
      // Contador con shards: +1 en un shard aleatorio (evita hot-doc en lives).
      // merge:true crea el shard si aún no existe (count arranca en 1).
      t.set(shardRef, { count: FieldValue.increment(1) }, { merge: true });
      // Denormalizado aproximado en el doc del sorteo (solo referencia rápida).
      t.set(sorteoRef, { contadorParticipantes: FieldValue.increment(1) }, { merge: true });

      return { ok: true, yaParticipa: false, participacion };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("participarSorteoGratis error:", e);
    throw new functions.https.HttpsError("internal", "No se pudo registrar la participación.");
  }
});
