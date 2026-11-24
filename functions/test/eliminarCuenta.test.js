// El manejador REAL de eliminarCuentaSecure (functions/eliminarCuenta.js) con
// una base, un Storage y un Auth en memoria. Sin Admin SDK, red ni Culqi.
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearEliminarCuenta } = require("../eliminarCuenta");
const L = require("../eliminarCuentaLogic");

class HttpsError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}

// ── FieldValue de mentira ─────────────────────────────────────────────────────
const FV = {
  delete: () => ({ __op: "delete" }),
  serverTimestamp: () => ({ __op: "ts" }),
  increment: (n) => ({ __op: "inc", n }),
  arrayRemove: (...v) => ({ __op: "arrRemove", v }),
  arrayUnion: (...v) => ({ __op: "arrUnion", v }),
};
const esOp = (v) => v && typeof v === "object" && typeof v.__op === "string";
const plano = (v) => v && typeof v === "object" && !Array.isArray(v) && !esOp(v);
function aplicar(antes, cambios, profundo) {
  const out = { ...(antes || {}) };
  for (const [k, v] of Object.entries(cambios)) {
    if (esOp(v)) {
      if (v.__op === "delete") delete out[k];
      else if (v.__op === "ts") out[k] = 1;
      else if (v.__op === "inc") out[k] = (Number(out[k]) || 0) + v.n;
      else if (v.__op === "arrRemove") out[k] = (out[k] || []).filter((x) => !v.v.includes(x));
      else if (v.__op === "arrUnion") out[k] = [...new Set([...(out[k] || []), ...v.v])];
    } else if (profundo && plano(v) && plano(out[k])) out[k] = aplicar(out[k], v, true);
    else if (profundo && plano(v)) out[k] = aplicar({}, v, true);
    else out[k] = v;
  }
  return out;
}
const campo = (data, ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), data);

// ── Firestore en memoria ──────────────────────────────────────────────────────
function baseEnMemoria(inicial = {}) {
  const docs = new Map(Object.entries(inicial));
  let auto = 0;
  const snapDoc = (ref) => ({ id: ref.id, ref, exists: docs.has(ref.path), data: () => (docs.has(ref.path) ? { ...docs.get(ref.path) } : undefined) });
  function docRef(path) {
    const partes = path.split("/");
    const ref = {
      id: partes[partes.length - 1], path,
      collection: (n) => colRef(`${path}/${n}`),
      get: async () => snapDoc(ref),
      set: async (data, op) => { docs.set(path, aplicar(op && op.merge ? docs.get(path) : {}, data, true)); },
      update: async (data) => { if (!docs.has(path)) throw new Error(`no existe ${path}`); docs.set(path, aplicar(docs.get(path), data, false)); },
      delete: async () => { docs.delete(path); },
    };
    return ref;
  }
  function consulta(path, filtros = [], limite = null) {
    const q = {
      where: (f, op, v) => consulta(path, [...filtros, [f, op, v]], limite),
      limit: (n) => consulta(path, filtros, n),
      select: () => q, orderBy: () => q,
      get: async () => {
        let lista = [...docs.keys()].filter((p) => p.slice(0, p.lastIndexOf("/")) === path).map((p) => docRef(p));
        lista = lista.filter((r) => filtros.every(([f, op, v]) => {
          const x = campo(docs.get(r.path), f);
          if (op === "==") return x === v;
          if (op === "array-contains") return Array.isArray(x) && x.includes(v);
          if (op === "in") return v.includes(x);
          throw new Error(`op ${op}`);
        }));
        if (limite != null) lista = lista.slice(0, limite);
        const ds = lista.map(snapDoc);
        return { docs: ds, empty: !ds.length, size: ds.length, forEach: (fn) => ds.forEach(fn) };
      },
    };
    return q;
  }
  function colRef(path) {
    return { ...consulta(path), path, doc: (id) => docRef(`${path}/${id || `auto${++auto}`}`) };
  }
  const db = {
    docs,
    collection: colRef,
    doc: docRef,
    getAll: async (...refs) => refs.map(snapDoc),
    batch: () => {
      const ops = [];
      return { delete: (r) => ops.push(() => r.delete()), commit: async () => { for (const o of ops) await o(); } };
    },
    recursiveDelete: async (ref) => {
      for (const p of [...docs.keys()]) if (p === ref.path || p.startsWith(`${ref.path}/`)) docs.delete(p);
    },
  };
  return db;
}

function bucketEnMemoria(archivos) {
  const files = new Set(archivos);
  return {
    files,
    getFiles: async ({ prefix }) => [[...files].filter((f) => f.startsWith(prefix)).map((name) => ({ name }))],
    file: (name) => ({ delete: async () => { if (!files.delete(name)) { const e = new Error("404"); e.code = 404; throw e; } } }),
  };
}

const url = (ruta) => `https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/${encodeURIComponent(ruta)}?alt=media&token=t`;
const AHORA = 1_800_000_000_000;
const UID = "uid-ana";

/** Una cuenta con un poco de todo (lo que se borra y lo que se conserva). */
function escenario({ pedidos = [], extra = {}, usuarios } = {}) {
  const inicial = {
    [`portal_clientes_users/${UID}`]: { displayName: "Ana", dni: "12345678", referralCode: "ANA1", fcmTokens: ["tok"] },
    [`portal_clientes_users/${UID}/notifications/n1`]: { titulo: "Hola" },
    [`users/${UID}`]: { email: "ana@wala.test" },
    [`users/${UID}/notifications/n2`]: { titulo: "Hola" },
    [`wala_direcciones/${UID}`]: { lista: [{ direccion: "Calle 1" }] },
    [`wishlists/${UID}`]: { items: [1] },
    [`bolitasProgreso/${UID}`]: { nivel: 3 },
    [`wordle/${UID}_stats`]: { userId: UID, wins: 2 },
    [`wordle/${UID}_2026-11-01`]: { userId: UID },
    "designs/d1": { userId: UID, previewUrl: url(`designs/${UID}/crear/previas/d1.png`) },
    "designs/d2": { userId: "otra" },
    "product_reviews/r1": { userId: UID, imageUrls: [url("product_reviews/p1/1_a.jpg")], helpfulVotes: [] },
    "product_reviews/r2": { userId: "otra", helpfulVotes: [UID, "x"] },
    "comunidad_disenos/c1": { autorUid: UID, estado: "publicada" },
    "comunidad_disenos/c1/usos/z": { en: 1 },
    "comunidad_disenos/c2": { autorUid: "otra" },
    [`comunidad_disenos/c2/usos/${UID}`]: { en: 1 },
    "userCoupons/k1": { uid: UID },
    "loyaltyLedger/l1": { uid: UID },
    "userMissions/m1": { userId: UID },
    "analytics_events/e1": { uid: UID }, "analytics_events/e2": { uid: UID }, "analytics_events/e3": { uid: "otra" },
    "analytics_sessions/s1": { uid: UID, email: "ana@wala.test" },
    "heatmap_events/h1": { uid: UID },
    "checkout_payment_intents/i1": { uid: UID, status: "prepared" },
    "checkout_payment_intents/i2": { uid: UID, status: "paid_order_created" },
    "referrals/f1": { referrerCode: "ANA1", status: "clicked", visitanteUid: "luis", visitanteNombre: "Luis" },
    "referrals/f2": { referrerCode: "ANA1", invitadoUid: "luis", status: "registered" },
    "referrals/f3": { referrerCode: "LUIS", visitanteUid: UID, visitanteNombre: "Ana", orderId: "WEB-1" },
    "referralOrderClaims/WEB-5": { uid: UID },
    [`culqiCharges/tarjetas_${UID}`]: { uid: UID, culqiCustomerId: "cus_test_1", email: "ana@wala.test" },
    [`culqiCharges/tarjetas_${UID}/guardadas/crd_test_1`]: { culqiCardId: "crd_test_1", culqiCustomerId: "cus_test_1" },
    "culqiCharges/chr_lock_1": { uid: UID, status: "succeeded" },
    "sorteos/s1": { estado: "activo" },
    [`sorteos/s1/participantes/${UID}`]: { nombre: "Ana", telefono: "999" },
    "sorteos/s1/tickets/t1": { participanteUid: UID, pagoConfirmado: true },
    "sorteos/s1/tickets/t2": { participanteUid: UID, pagoConfirmado: false },
    "sorteos_suscripcion/camp1": { titulo: "Sorteo" },
    [`sorteos_suscripcion/camp1/suscriptores/${UID}`]: { estado: "cancelado", culqiCustomerId: "cus_test_1", culqiCardId: "crd_sub_1" },
    [`sorteos_suscripcion/camp1/suscriptores/${UID}/recibos/r1`]: { monto: 1000 },
    "pedidos/erp1": { buyerUid: UID, numeroPedido: "1234", estadoGeneral: "Finalizado", montoTotal: 50, montoAdelanto: 50,
      archivo: url(`designs/${UID}/crear/archivos/protegido.png`) },
    "libro_reclamaciones/lr1": { correo: "ana@wala.test" },
    "suscripcionCharges/x": { uid: UID },
    ...extra,
  };
  const db = baseEnMemoria(inicial);
  const bucket = bucketEnMemoria([
    `users/${UID}/avatars/1.jpg`, `gift_recipients/${UID}/1.jpg`, `designs/${UID}/crear/previas/d1.png`,
    `designs/${UID}/crear/archivos/protegido.png`, "product_reviews/p1/1_a.jpg", "comunidad/c1/originales/a.png",
    "comunidad/c2/originales/b.png", "pedidos/1234/archivos/a.png", "users/otra/avatars/1.jpg",
  ]);
  const borradosAuth = [];
  const auth = {
    users: usuarios || new Map([[UID, { customClaims: {} }]]),
    getUser: async (uid) => { const u = auth.users.get(uid); if (!u) { const e = new Error("no"); e.code = "auth/user-not-found"; throw e; } return u; },
    deleteUser: async (uid) => { if (auth.falla) { auth.falla = false; throw new Error("se cortó"); } auth.users.delete(uid); borradosAuth.push(uid); },
  };
  const logs = [];
  const pedidosDe = pedidos.length ? pedidos : [{ _coleccion: "pedidos", id: "erp1", ...inicial["pedidos/erp1"] }];
  const manejador = crearEliminarCuenta({
    db, auth, bucket, FieldValue: FV, HttpsError, sal: "sal-de-prueba", ahora: () => AHORA,
    logger: { info: (...a) => logs.push(a) },
    buscarPedidos: async () => ({ visibles: pedidosDe, todos: pedidosDe }),
  });
  const ctx = (token = {}, headers = {}) => ({
    auth: { uid: UID, token: { auth_time: Math.floor(AHORA / 1000) - 30, email: "ana@wala.test", firebase: { sign_in_provider: "password" }, ...token } },
    rawRequest: { headers },
  });
  return { db, bucket, auth, logs, borradosAuth, manejador, ctx };
}

const hay = (db, p) => db.docs.has(p);
const registroDe = (db) => db.docs.get(`cuentasEliminadas/${L.hashDeCuenta(UID, "sal-de-prueba")}`);

test("sin sesión o con sesión anónima: unauthenticated", async () => {
  const { manejador } = escenario();
  await assert.rejects(manejador({ revisar: true }, {}), { code: "unauthenticated", message: "Inicia sesión con tu cuenta." });
  await assert.rejects(manejador({ revisar: true }, { auth: { uid: "a", token: { firebase: { sign_in_provider: "anonymous" } } } }),
    { code: "unauthenticated" });
});

test("cualquier otra forma de data: invalid-argument", async () => {
  const { manejador, ctx } = escenario();
  for (const malo of [{}, null, { revisar: true, confirmar: true }, { borrar: true }, { confirmar: "si" }]) {
    await assert.rejects(manejador(malo, ctx()), { code: "invalid-argument" });
  }
});

test("revisar no borra nada y devuelve los pendientes (pedido, saldo, suscripción, admin)", async () => {
  const pedidos = [
    { _coleccion: "pedidos", id: "a", numeroPedido: "1234", estadoGeneral: "En Diseño", montoTotal: 10, montoAdelanto: 10 },
    { _coleccion: "pedidos", id: "b", numeroPedido: "1300", estadoGeneral: "Finalizado", montoTotal: 100, montoAdelanto: 55 },
  ];
  const s = escenario({ pedidos, extra: { [`sorteos_suscripcion/camp1/suscriptores/${UID}`]: { estado: "activo" }, [`adminUsers/${UID}`]: { role: "admin" } } });
  const antes = s.db.docs.size;
  const r = await s.manejador({ revisar: true }, s.ctx());
  assert.deepEqual(r.pendientes.map((p) => p.tipo), ["admin", "pedido", "saldo", "suscripcion"]);
  assert.equal(r.pendientes[1].texto, "Tu pedido #1234 todavía no se entrega.");
  assert.equal(r.pendientes[2].texto, "El pedido #1300 tiene un saldo de S/ 45.00 por pagar.");
  assert.equal(s.db.docs.size, antes);
  assert.equal(s.auth.users.size, 1);
});

test("revisar sin pendientes: lista vacía; el claim admin también bloquea", async () => {
  const s = escenario();
  assert.deepEqual(await s.manejador({ revisar: true }, s.ctx()), { pendientes: [] });
  const admin = escenario({ usuarios: new Map([[UID, { customClaims: { admin: true } }]]) });
  assert.equal((await admin.manejador({ revisar: true }, admin.ctx())).pendientes[0].tipo, "admin");
});

test("confirmar con una sesión de hace más de 5 minutos pide volver a entrar", async () => {
  const s = escenario();
  await assert.rejects(s.manejador({ confirmar: true }, s.ctx({ auth_time: Math.floor(AHORA / 1000) - 6 * 60 })),
    (e) => e.code === "failed-precondition" && e.details.motivo === "reautenticar"
      && e.message === "Por seguridad, vuelve a entrar con tu cuenta para borrarla.");
  assert.ok(hay(s.db, `portal_clientes_users/${UID}`));
});

test("confirmar con pendientes no borra y los devuelve", async () => {
  const s = escenario({ extra: { "checkout_payment_intents/i3": { uid: UID, status: "cobrando", cobroIniciadoAt: AHORA - 1000 } } });
  await assert.rejects(s.manejador({ confirmar: true }, s.ctx()), (e) => e.code === "failed-precondition"
    && e.details.motivo === "pendientes" && e.details.pendientes[0].tipo === "pedido"
    && e.message === "Antes de borrar tu cuenta resuelve lo pendiente.");
  assert.ok(hay(s.db, `portal_clientes_users/${UID}`));
  assert.equal(registroDe(s.db), undefined);
});

test("confirmar borra lo de la cuenta, conserva pedidos y pagos, y deja un registro sin PII", async () => {
  const s = escenario();
  assert.deepEqual(await s.manejador({ confirmar: true }, s.ctx({}, { origin: "https://wala.pe" })), { eliminada: true });
  const { db, bucket } = s;
  // Borrado.
  for (const p of [`portal_clientes_users/${UID}`, `portal_clientes_users/${UID}/notifications/n1`, `users/${UID}`,
    `users/${UID}/notifications/n2`, `wala_direcciones/${UID}`, `wishlists/${UID}`, `bolitasProgreso/${UID}`,
    `wordle/${UID}_stats`, `wordle/${UID}_2026-11-01`, "designs/d1", "product_reviews/r1", "comunidad_disenos/c1",
    "comunidad_disenos/c1/usos/z", `comunidad_disenos/c2/usos/${UID}`, "userCoupons/k1", "loyaltyLedger/l1", "userMissions/m1",
    "analytics_events/e1", "analytics_events/e2", "analytics_sessions/s1", "heatmap_events/h1", "checkout_payment_intents/i1",
    "referrals/f1", "referralOrderClaims/WEB-5", `culqiCharges/tarjetas_${UID}`, `culqiCharges/tarjetas_${UID}/guardadas/crd_test_1`,
    `sorteos/s1/participantes/${UID}`, "sorteos/s1/tickets/t2", `sorteos_suscripcion/camp1/suscriptores/${UID}`]) {
    assert.equal(hay(db, p), false, `debía borrarse ${p}`);
  }
  // Conservado.
  for (const p of ["designs/d2", "product_reviews/r2", "comunidad_disenos/c2", "analytics_events/e3", "checkout_payment_intents/i2",
    "culqiCharges/chr_lock_1", "sorteos/s1/tickets/t1", `sorteos_suscripcion/camp1/suscriptores/${UID}/recibos/r1`,
    "pedidos/erp1", "libro_reclamaciones/lr1", "suscripcionCharges/x", "referrals/f2", "referrals/f3"]) {
    assert.equal(hay(db, p), true, `debía conservarse ${p}`);
  }
  // Referidos: el de otra persona sin mi rastro; mi invitación aceptada, sin mi código.
  assert.deepEqual(db.docs.get("referrals/f3"), { referrerCode: "LUIS", orderId: "WEB-1", visitanteEliminado: true });
  assert.equal(db.docs.get("referrals/f2").referrerCode, undefined);
  assert.equal(db.docs.get("referrals/f2").invitadoUid, "luis");
  assert.deepEqual(db.docs.get("product_reviews/r2").helpfulVotes, ["x"]);
  // Archivos: los propios fuera; el que nombra un pedido, el de otra persona y los de pedidos se quedan.
  assert.deepEqual([...bucket.files].sort(), ["comunidad/c2/originales/b.png", `designs/${UID}/crear/archivos/protegido.png`,
    "pedidos/1234/archivos/a.png", "users/otra/avatars/1.jpg"]);
  // Culqi: no se llama; queda en la cola sin uid ni correo.
  const cola = db.docs.get("culqiPorBorrar/cus_test_1");
  assert.equal(cola.culqiCustomerId, "cus_test_1");
  assert.deepEqual(cola.tarjetas.sort(), ["crd_sub_1", "crd_test_1"]);
  assert.ok(!JSON.stringify(cola).includes(UID) && !JSON.stringify(cola).includes("ana@"));
  // Auth al final.
  assert.deepEqual(s.borradosAuth, [UID]);
  // Registro: id = hash, sin uid ni correo, con conteos y origen.
  const reg = registroDe(db);
  assert.equal(reg.estado, "completada");
  assert.equal(reg.origen, "web");
  assert.equal(reg.borrados.analytics_events, 2);
  assert.equal(reg.borrados.designs, 1);
  assert.equal(reg.borrados.perfil, 4);
  assert.equal(reg.culqiPendiente, true);
  assert.equal(reg.archivos, 5);
  const todo = JSON.stringify([...db.docs.entries()].filter(([p]) => p.startsWith("cuentasEliminadas/")));
  assert.ok(!todo.includes(UID) && !todo.includes("ana@") && !todo.includes("Ana"));
  // El log tampoco lleva el uid.
  assert.equal(s.logs.length, 1);
  assert.ok(!JSON.stringify(s.logs).includes(UID));
});

test("si se corta a mitad, otra llamada termina el trabajo; después responde eliminada", async () => {
  const s = escenario();
  s.auth.falla = true; // falla al borrar el usuario de Auth (el último paso)
  await assert.rejects(s.manejador({ confirmar: true }, s.ctx()));
  assert.equal(registroDe(s.db).estado, "en_curso");
  assert.equal(registroDe(s.db).origen, "app");
  assert.equal(hay(s.db, `portal_clientes_users/${UID}`), false);
  // El reintento no vuelve a revisar pendientes (el perfil ya no está) y termina.
  assert.deepEqual(await s.manejador({ confirmar: true }, s.ctx()), { eliminada: true });
  assert.deepEqual(s.borradosAuth, [UID]);
  assert.equal(registroDe(s.db).estado, "completada");
  assert.equal(registroDe(s.db).intentos, 2);
  assert.equal(registroDe(s.db).borrados.designs, 1, "los conteos no se duplican");
  assert.deepEqual(await s.manejador({ confirmar: true }, s.ctx()), { eliminada: true });
  assert.deepEqual(await s.manejador({ revisar: true }, s.ctx()), { pendientes: [] });
});
