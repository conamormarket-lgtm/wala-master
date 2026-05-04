/**
 * Cloud Function HTTP: el ERP debe llamar a esta URL cuando cree un pedido.
 * Crea la cuenta en el Portal (Auth + Firestore users) si el correo no tiene cuenta.
 * Una sola cuenta por email; contraseña inicial = DNI (mín. 6 caracteres).
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();
const PORTAL_USERS_COLLECTION = "portal_clientes_users";

const MIN_PASSWORD_LENGTH = 6;

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
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido. Use POST." });
    return;
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

  const { pedidoId, amount = 10 } = data;
  if (!pedidoId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Se requiere el ID del pedido."
    );
  }

  const uid = context.auth.uid;
  const userRef = db.collection(PORTAL_USERS_COLLECTION).doc(uid);
  const orderRef = db.collection("orders").doc(pedidoId);

  try {
    return await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Usuario no encontrado.");
      }

      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Pedido no encontrado.");
      }

      const orderData = orderDoc.data();
      const userData = userDoc.data();

      // Check if order belongs to user (using userId or DNI)
      if (orderData.userId !== uid && orderData.dni !== userData.dni) {
        throw new functions.https.HttpsError("permission-denied", "Este pedido no le pertenece.");
      }

      // Check if order is completed
      const estado = (orderData.estadoGeneral || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!["finalizado", "entregado", "completado"].includes(estado)) {
         throw new functions.https.HttpsError("failed-precondition", "El pedido no está finalizado.");
      }

      // Check if already claimed
      const reclamadas = userData.monedasReclamadas || [];
      if (reclamadas.includes(pedidoId)) {
        throw new functions.https.HttpsError("already-exists", "Las monedas de este pedido ya fueron reclamadas.");
      }

      // Update user document safely
      const currentMonedas = userData.monedas || 0;
      transaction.update(userRef, {
        monedas: currentMonedas + amount,
        monedasReclamadas: admin.firestore.FieldValue.arrayUnion(pedidoId)
      });

      return { success: true, nuevasMonedas: currentMonedas + amount };
    });
  } catch (error) {
    console.error("secureClaimMonedas error:", error);
    throw new functions.https.HttpsError("internal", error.message || "Error al procesar el reclamo.");
  }
});
