/**
 * Cloud Function HTTP: el ERP debe llamar a esta URL cuando cree un pedido.
 * Crea la cuenta en el Portal (Auth + Firestore users) si el correo no tiene cuenta.
 * Una sola cuenta por email; contraseña inicial = DNI (mín. 6 caracteres).
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { onSchedule } = require("firebase-functions/v2/scheduler");

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
  if (!raw) return null;
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

// Monto fijo de monedas por pedido reclamado (server-authoritative, ignora el
// valor enviado por el cliente). Centralizado para no confiar en el front.
const REWARD_COINS_PER_ORDER = 10;

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

// SEGURIDAD (H-03 — PENDIENTE): la contraseña inicial = DNI es débil (el DNI es
// semipúblico en Perú). Migrar a cuenta SIN password + enlace de definición de
// contraseña (auth.generatePasswordResetLink / email-link). Requiere decisión de
// producto y configuración de correo; hasta entonces se mantiene para no romper el
// login de las cuentas creadas por el ERP.
function buildPassword(dni) {
  if (dni == null || String(dni).trim() === "") return null;
  const n = String(dni).trim().replace(/\s/g, "");
  if (n.length >= MIN_PASSWORD_LENGTH) return n;
  return n.padStart(MIN_PASSWORD_LENGTH, "0");
}

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
    const provided = String(req.get("X-Webhook-Signature") || "");
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
      .digest("hex");
    const valid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
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

  const password = buildPassword(dni);
  if (!password) {
    res.status(400).json({ created: false, error: "NO_DNI" });
    return;
  }

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
      password,
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
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ created: true, userId: uid });
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

  const { pedidoId } = data || {};
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
      transaction.update(userRef, {
        monedas: currentMonedas + amount, // Mantenemos el campo global por compatibilidad, aunque el cliente calculará sobre monedasActivas
        monedasActivas: monedasActivas,
        monedasReclamadas: admin.firestore.FieldValue.arrayUnion(pedidoId)
      });

      return { success: true, nuevasMonedas: currentMonedas + amount, monedasActivas };
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
      timestamp: admin.firestore.FieldValue.serverTimestamp()
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
    submittedAt: admin.firestore.FieldValue.serverTimestamp()
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
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedBy: context.auth.uid
    });

    if (action === "approve") {
      const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(evData.userId);
      const userDoc = await transaction.get(userRef);
      if(userDoc.exists) {
        const userData = userDoc.data();
        let updates = {
           challengeEvidencesApproved: admin.firestore.FieldValue.arrayUnion(evData.challengeId)
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
  // TODO (H-11 / Fase 3): recalcular el monto desde el pedido/carrito real en backend,
  // sin confiar en el valor enviado por el cliente.
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Monto inválido.");
  }

  // La llave privada de Culqi DEBE venir de un secret de Functions. Sin fallback dummy
  // y sin prefijo REACT_APP_ (que se expondría en el bundle del cliente).
  const secretKey = process.env.CULQI_SECRET_KEY;
  if (!secretKey) {
    console.error("processCulqiPayment: CULQI_SECRET_KEY no configurada.");
    throw new functions.https.HttpsError("failed-precondition", "Pago no disponible temporalmente.");
  }

  try {
    const response = await fetch("https://api.culqi.com/v2/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`
      },
      body: JSON.stringify({
        amount: amount, // El frontend ya lo envía en céntimos (integer)
        currency_code: currency || "PEN",
        email: email,
        source_id: tokenId,
        description: description || "Pago en Walá",
        metadata: metadata || {}
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Error de Culqi:", result);
      throw new functions.https.HttpsError("internal", result.user_message || "Error al procesar la tarjeta con Culqi.");
    }

    return {
      success: true,
      charge_id: result.id,
      outcome: result.outcome
    };

  } catch (err) {
    console.error("Excepción en processCulqiPayment:", err);
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
// los bloquean). Fechas en America/Lima (UTC-5) para evitar el bug de rachas.
// ════════════════════════════════════════════════════════════════════════════

const KAPI_MONTHLY_CAP = 31;
const BALLSORT_REWARD = 2;
const STREAK_DATES_BONUS = 25;
const SURVEY_REWARD_MAX = 50;

function limaNow() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000); // UTC-5, Perú no usa DST
}
function limaTodayStr() {
  return limaNow().toISOString().split("T")[0];
}
function limaWeekStartStr() {
  const lima = limaNow();
  const day = lima.getUTCDay();
  const diff = lima.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), diff));
  return monday.toISOString().split("T")[0];
}

// Resta `amount` de monedas y, best-effort, recorta monedasActivas FIFO.
function applyDebit(userData, amount) {
  const monedas = Math.max(0, (userData.monedas || 0) - amount);
  let activas = Array.isArray(userData.monedasActivas) ? userData.monedasActivas.map((b) => ({ ...b })) : [];
  let remaining = amount;
  activas = activas.filter((b) => {
    if (remaining <= 0) return true;
    const take = Math.min(remaining, b.amount || 0);
    b.amount = (b.amount || 0) - take;
    remaining -= take;
    return b.amount > 0;
  });
  return { monedas, monedasActivas: activas };
}

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
      t.update(userRef, {
        monedas: (u.monedas || 0) + BALLSORT_REWARD,
        lastBallSortReward: today,
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
  const rand = Math.random() * 100;
  let acc = 0;
  let selected = prizes[prizes.length - 1];
  for (const p of prizes) {
    acc += Number(p.probability) || 0;
    if (rand <= acc) { selected = p; break; }
  }

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
      if (selected.type === "Monedas") {
        updates.monedas = (u.monedas || 0) + Number(selected.amount || 0);
      }
      t.update(userRef, updates);
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
  const { actionType, count = 1 } = data || {};
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
      if (nowCompleted) {
        if (ch.rewardType === "kapi_double_3d") {
          updates.activeMultiplier = "kapi_double_3d";
          updates.multiplierExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          updates.monedas = (u.monedas || 0) + (Number(ch.rewardCoins) || 0);
        }
      }
      t.update(userRef, updates);
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
      t.update(userRef, {
        monedas: (u.monedas || 0) + reward,
        surveyRewardClaimed: true,
      });
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
      t.update(userRef, {
        monedas: (u.monedas || 0) + STREAK_DATES_BONUS,
        streakBonusReceived: true,
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
exports.claimReferralSecure = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const referralId = data && data.referralId;
  if (!referralId) {
    throw new functions.https.HttpsError("invalid-argument", "Falta referralId.");
  }
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const refRef = db.collection("referrals").doc(String(referralId));
  try {
    return await db.runTransaction(async (t) => {
      const [userSnap, refSnap] = await Promise.all([t.get(userRef), t.get(refRef)]);
      if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      if (!refSnap.exists) throw new functions.https.HttpsError("not-found", "Referido no encontrado.");
      const u = userSnap.data();
      const r = refSnap.data();

      if (!u.referralCode || r.referrerCode !== u.referralCode) {
        throw new functions.https.HttpsError("permission-denied", "Este referido no le pertenece.");
      }
      if (r.status === "claimed") {
        throw new functions.https.HttpsError("already-exists", "Este referido ya fue reclamado.");
      }
      if (r.status !== "completed") {
        throw new functions.https.HttpsError("failed-precondition", "El referido aún no está listo para reclamar.");
      }
      const earned = Number(r.earnedCoins) || 0;
      t.update(refRef, { status: "claimed", claimedAt: admin.firestore.FieldValue.serverTimestamp() });
      t.update(userRef, { monedas: (u.monedas || 0) + earned });
      return { success: true, earned };
    });
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    console.error("claimReferralSecure error:", e);
    throw new functions.https.HttpsError("internal", "Error al reclamar el referido.");
  }
});

exports.notificationEngine = require('./notificationsEngine').notificationEngine;
exports.sendManualPromoNotification = require('./notificationsEngine').sendManualPromoNotification;
