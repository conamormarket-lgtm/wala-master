"use strict";

/**
 * "Borrar mi cuenta" (eliminarCuentaSecure): la usan la app móvil y la web
 * (Mi cuenta › Ajustes › Borrar mi cuenta). Qué se borra, qué se conserva y
 * por qué: ./eliminarCuentaLogic.js (BORRAR, CONDICIONALES, CONSERVAR).
 *
 * Contrato:
 *   - sin sesión o anónima → unauthenticated 'Inicia sesión con tu cuenta.'
 *   - { revisar: true }   → { pendientes: [{ tipo, texto }] } (no borra nada)
 *   - { confirmar: true } → entró hace más de 5 min: failed-precondition
 *       { motivo: 'reautenticar' } · hay pendientes: failed-precondition
 *       { motivo: 'pendientes', pendientes } · si no, borra y { eliminada: true }
 *   - otra cosa → invalid-argument
 *
 * Reintentable: el registro cuentasEliminadas/{hash} queda 'en_curso' al
 * empezar; si la llamada se corta, la siguiente sigue donde quedó (todo lo que
 * hace es "borrar lo que quede") y no vuelve a revisar los pendientes (el
 * perfil, con el DNI y los pedidos vinculados, puede ya no estar). El usuario
 * de Auth se borra al final.
 *
 * Sin firebase-functions ni firebase-admin aquí: todo entra por `deps` (el
 * manejador se prueba con una base en memoria: functions/test/eliminarCuenta.test.js).
 */

const L = require("./eliminarCuentaLogic");

const LOTE = 400; // por debajo del máximo de 500 escrituras por lote
const EN_PARALELO = 8;
const PRESUPUESTO_MS = 470 * 1000; // la función tiene 540 s

/**
 * @param {object} deps
 *   db, auth, bucket, FieldValue, HttpsError, logger
 *   buscarPedidos(uid, token) → { visibles, todos } (los de misPedidosSecure;
 *     debe fallar si alguna consulta falla: sin eso se podría borrar con un pedido en curso)
 *   sal: la sal del hash del registro · ahora: () => ms
 */
function crearEliminarCuenta(deps) {
  const { db, auth, bucket, FieldValue, HttpsError, buscarPedidos } = deps;
  const logger = deps.logger || console;
  const ahora = deps.ahora || Date.now;
  const presupuestoMs = deps.presupuestoMs || PRESUPUESTO_MS;

  const fallar = (codigo, mensaje, detalles) => { throw new HttpsError(codigo, mensaje, detalles); };

  async function enParalelo(items, fn) {
    const lista = [...items];
    let total = 0;
    const trabajadores = Array.from({ length: Math.min(EN_PARALELO, lista.length) }, async () => {
      while (lista.length) {
        // Primero esperar y después sumar: `total += await …` leería el total de antes.
        const n = await fn(lista.shift());
        total += Number(n) || 0;
      }
    });
    await Promise.all(trabajadores);
    return total;
  }

  // ── Lo pendiente ──────────────────────────────────────────────────────────

  async function esDelEquipo(uid, token) {
    let claimAdmin = token.admin === true;
    if (!claimAdmin) {
      try {
        const u = await auth.getUser(uid);
        claimAdmin = Boolean(u && u.customClaims && u.customClaims.admin === true);
      } catch (e) {
        if (!e || e.code !== "auth/user-not-found") throw e;
      }
    }
    const email = String(token.email || "").trim().toLowerCase();
    const [adminUser, rol] = await Promise.all([
      db.collection("adminUsers").doc(uid).get(),
      email ? db.collection("adminRoles").doc(email).get() : null,
    ]);
    const permisosPanel = rol && rol.exists ? ((rol.data() || {}).permissions || []) : [];
    return L.pendienteDeAdmin({ claimAdmin, adminUser: adminUser.exists, permisosPanel });
  }

  async function suscripcionesDe(uid) {
    const campanas = await db.collection("sorteos_suscripcion").select().get();
    if (campanas.empty) return [];
    const refs = campanas.docs.map((c) => c.ref.collection("suscriptores").doc(uid));
    const snaps = await db.getAll(...refs);
    return snaps.filter((s) => s.exists).map((s) => ({ ref: s.ref, ...s.data() }));
  }

  async function pagosDe(uid) {
    const [intenciones, cobros] = await Promise.all([
      db.collection("checkout_payment_intents").where("uid", "==", uid).get(),
      db.collection("cobros_en_curso").where("uid", "==", uid).get(),
    ]);
    return { intenciones: intenciones.docs.map((d) => d.data()), cobros: cobros.docs.map((d) => d.data()) };
  }

  async function revisar(uid, token) {
    const [admin, pedidos, suscripciones, pagos] = await Promise.all([
      esDelEquipo(uid, token),
      buscarPedidos(uid, token),
      suscripcionesDe(uid),
      pagosDe(uid),
    ]);
    const pendientes = [
      ...admin,
      ...L.pendientesDePedidos(pedidos.visibles),
      ...L.pendientesDePagos(pagos, ahora()),
      ...L.pendientesDeSuscripciones(suscripciones),
    ];
    return { pendientes, pedidos: pedidos.todos || pedidos.visibles || [] };
  }

  // ── Borrar ────────────────────────────────────────────────────────────────

  function vigilarTiempo(inicio) {
    if (ahora() - inicio > presupuestoMs) {
      fallar("deadline-exceeded", "Estamos terminando de borrar tu cuenta. Vuelve a intentarlo en un momento.");
    }
  }

  async function borrarRefs(refs) {
    let n = 0;
    for (let i = 0; i < refs.length; i += LOTE) {
      const lote = db.batch();
      refs.slice(i, i + LOTE).forEach((r) => lote.delete(r));
      await lote.commit();
      n += Math.min(LOTE, refs.length - i);
    }
    return n;
  }

  /** Borra los docs de una consulta. Sin filtro, por tandas hasta que no quede ninguno. */
  async function borrarConsulta(consulta, { filtro, recursivo, inicio } = {}) {
    if (filtro || recursivo) {
      const snap = await consulta.get();
      const docs = filtro ? snap.docs.filter((d) => filtro(d.data())) : snap.docs;
      if (recursivo) {
        await enParalelo(docs, (d) => db.recursiveDelete(d.ref));
        return docs.length;
      }
      return borrarRefs(docs.map((d) => d.ref));
    }
    let total = 0;
    for (;;) {
      vigilarTiempo(inicio);
      const snap = await consulta.limit(LOTE).get();
      if (snap.empty) return total;
      total += await borrarRefs(snap.docs.map((d) => d.ref));
      if (snap.size < LOTE) return total;
    }
  }

  async function existe(ref) {
    return (await ref.get()).exists;
  }

  /** Borra una lista de rutas de Storage (las que ya no estén, no cuentan). */
  async function borrarArchivos(rutas) {
    return enParalelo([...rutas], async (ruta) => {
      try {
        await bucket.file(ruta).delete();
        return 1;
      } catch (e) {
        if (e && (e.code === 404 || e.code === "404")) return 0;
        throw e;
      }
    });
  }

  async function archivosConPrefijo(prefijo) {
    const [archivos] = await bucket.getFiles({ prefix: prefijo });
    return archivos.map((f) => f.name);
  }

  /** Paso 1: los archivos (antes que los docs que los nombran). */
  async function pasoArchivos(uid, pedidos) {
    const protegidas = L.rutasProtegidas(pedidos, uid);
    const rutas = new Set();
    for (const carpeta of L.carpetasDeCuenta(uid)) {
      (await archivosConPrefijo(carpeta)).forEach((r) => { if (!protegidas.has(r)) rutas.add(r); });
    }
    const [opiniones, publicaciones] = await Promise.all([
      db.collection("product_reviews").where("userId", "==", uid).get(),
      db.collection("comunidad_disenos").where("autorUid", "==", uid).get(),
    ]);
    opiniones.docs.forEach((d) => L.archivosDeOpinion(d.data()).forEach((r) => rutas.add(r)));
    for (const pub of publicaciones.docs) {
      (await archivosConPrefijo(`comunidad/${pub.id}/`)).forEach((r) => rutas.add(r));
    }
    return { archivos: await borrarArchivos(rutas), protegidos: protegidas.size };
  }

  /**
   * Paso 2: tarjetas guardadas. NO se llama a Culqi (pendiente): el cliente de
   * Culqi y sus tarjetas quedan en culqiPorBorrar (solo ids de Culqi, sin uid
   * ni correo) para quitarlos de Culqi después. La referencia local se borra.
   */
  async function pasoTarjetas(uid, suscripciones) {
    const ref = db.collection("culqiCharges").doc(`tarjetas_${uid}`);
    const [snap, guardadas] = await Promise.all([ref.get(), ref.collection("guardadas").get()]);
    const clientes = new Set();
    const tarjetas = [];
    if (snap.exists && snap.data().culqiCustomerId) clientes.add(String(snap.data().culqiCustomerId));
    guardadas.docs.forEach((d) => {
      const t = d.data() || {};
      tarjetas.push(String(t.culqiCardId || d.id));
      if (t.culqiCustomerId) clientes.add(String(t.culqiCustomerId));
    });
    suscripciones.forEach((s) => {
      if (s.culqiCustomerId) clientes.add(String(s.culqiCustomerId));
      if (s.culqiCardId) tarjetas.push(String(s.culqiCardId));
    });
    for (const cliente of clientes) {
      // id fijo por cliente de Culqi: reintentar no lo duplica.
      await db.collection("culqiPorBorrar").doc(cliente.replace(/[^A-Za-z0-9_-]/g, "_")).set({
        culqiCustomerId: cliente,
        ...(tarjetas.length ? { tarjetas: FieldValue.arrayUnion(...tarjetas) } : {}),
        motivo: "cuenta_eliminada",
        estado: "pendiente",
        creadoAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const borrados = snap.exists || guardadas.size ? guardadas.size + (snap.exists ? 1 : 0) : 0;
    if (borrados) await db.recursiveDelete(ref);
    return { borrados, culqiPendiente: clientes.size > 0 };
  }

  /** Paso 3: sorteos y suscripciones (lo que no es registro de pago). */
  async function pasoSorteos(uid, suscripciones) {
    const cuenta = { participantes: 0, tickets: 0, suscriptores: 0 };
    const sorteos = await db.collection("sorteos").select().get();
    await enParalelo(sorteos.docs, async (s) => {
      const part = s.ref.collection("participantes").doc(uid);
      const claim = s.ref.collection("referralClaims").doc(uid);
      const [p, c, tickets] = await Promise.all([part.get(), claim.get(),
        s.ref.collection("tickets").where("participanteUid", "==", uid).get()]);
      const refs = [];
      if (p.exists) { refs.push(part); cuenta.participantes += 1; }
      if (c.exists) refs.push(claim);
      tickets.docs.filter((t) => L.ticketBorrable(t.data())).forEach((t) => { refs.push(t.ref); cuenta.tickets += 1; });
      return borrarRefs(refs);
    });
    // Solo el doc del suscriptor: sus recibos (subcolección) se conservan.
    for (const s of suscripciones) {
      await s.ref.delete();
      cuenta.suscriptores += 1;
    }
    return cuenta;
  }

  /** Paso 4: marcas de uso de diseños de la comunidad (comunidad_disenos/*\/usos/{uid}). */
  async function pasoUsosComunidad(uid) {
    const pubs = await db.collection("comunidad_disenos").select().get();
    if (pubs.empty) return 0;
    const refs = pubs.docs.map((p) => p.ref.collection("usos").doc(uid));
    const snaps = await db.getAll(...refs);
    return borrarRefs(snaps.filter((s) => s.exists).map((s) => s.ref));
  }

  const cambiosFirestore = (cambios) => {
    const out = {};
    for (const [k, v] of Object.entries(cambios)) out[k] = v === L.BORRAR_CAMPO ? FieldValue.delete() : v;
    return out;
  };

  /** Paso 5: referidos (ver accionReferido) y votos 'útil' en opiniones ajenas. */
  async function pasoReferidos(uid, miCodigo) {
    const consultas = [
      db.collection("referrals").where("visitanteUid", "==", uid).get(),
      db.collection("referrals").where("invitadoUid", "==", uid).get(),
      db.collection("referrals").where("invitacionRechazada.uid", "==", uid).get(),
    ];
    if (miCodigo) consultas.push(db.collection("referrals").where("referrerCode", "==", miCodigo).get());
    const docs = new Map();
    (await Promise.all(consultas)).forEach((snap) => snap.docs.forEach((d) => docs.set(d.id, d)));
    let borrados = 0;
    let limpiados = 0;
    for (const d of docs.values()) {
      const accion = L.accionReferido(d.data(), uid, miCodigo);
      if (!accion) continue;
      if (accion.tipo === "borrar") { await d.ref.delete(); borrados += 1; } else {
        await d.ref.update(cambiosFirestore(accion.cambios));
        limpiados += 1;
      }
    }
    const votos = await db.collection("product_reviews").where("helpfulVotes", "array-contains", uid).get();
    for (const d of votos.docs) await d.ref.update({ helpfulVotes: FieldValue.arrayRemove(uid) });
    return { borrados, limpiados, votos: votos.size };
  }

  /** Paso 6: el inventario general (BORRAR). */
  async function pasoInventario(uid, inicio, sumar) {
    for (const item of L.BORRAR) {
      vigilarTiempo(inicio);
      let n = 0;
      if (item.doc) {
        const ref = db.collection(item.coleccion).doc(item.doc(uid));
        if (await existe(ref)) { await ref.delete(); n = 1; }
      } else {
        n = await borrarConsulta(db.collection(item.coleccion).where(item.campo, "==", uid),
          { filtro: item.filtro, recursivo: item.recursivo, inicio });
      }
      if (n) await sumar({ [item.coleccion]: n });
    }
  }

  /** Paso 7: el perfil (al final de Firestore: hasta aquí guarda el DNI y el código de referido). */
  async function pasoPerfil(uid) {
    let n = 0;
    for (const col of ["users", "portal_clientes_users"]) {
      const ref = db.collection(col).doc(uid);
      const [snap, avisos] = await Promise.all([ref.get(), ref.collection("notifications").select().get()]);
      if (snap.exists || !avisos.empty) {
        await db.recursiveDelete(ref);
        n += (snap.exists ? 1 : 0) + avisos.size;
      }
    }
    return n;
  }

  async function borrarTodo(uid, pedidos, registroRef) {
    const inicio = ahora();
    const sumar = (borrados) => registroRef.set({ borrados: Object.fromEntries(
      Object.entries(borrados).filter(([, n]) => n > 0).map(([k, n]) => [k, FieldValue.increment(n)])) }, { merge: true });

    const perfil = await db.collection("portal_clientes_users").doc(uid).get();
    const miCodigo = perfil.exists ? String(perfil.data().referralCode || "").trim() : "";
    const suscripciones = await suscripcionesDe(uid);

    const { archivos } = await pasoArchivos(uid, pedidos);
    if (archivos) await registroRef.set({ archivos: FieldValue.increment(archivos) }, { merge: true });

    const tarjetas = await pasoTarjetas(uid, suscripciones);
    if (tarjetas.culqiPendiente) await registroRef.set({ culqiPendiente: true }, { merge: true });
    await sumar({ "culqiCharges(tarjetas)": tarjetas.borrados });

    const sorteos = await pasoSorteos(uid, suscripciones);
    await sumar({ "sorteos/participantes": sorteos.participantes, "sorteos/tickets": sorteos.tickets,
      "sorteos_suscripcion/suscriptores": sorteos.suscriptores });

    await sumar({ "comunidad_disenos/usos": await pasoUsosComunidad(uid) });

    const ref = await pasoReferidos(uid, miCodigo);
    await sumar({ referrals: ref.borrados, "referrals(limpiados)": ref.limpiados, "product_reviews(votos)": ref.votos });

    await pasoInventario(uid, inicio, sumar);

    await sumar({ perfil: await pasoPerfil(uid) });

    try {
      await auth.deleteUser(uid);
    } catch (e) {
      if (!e || e.code !== "auth/user-not-found") throw e;
    }
  }

  // ── La callable ───────────────────────────────────────────────────────────

  return async function eliminarCuentaSecure(data, context) {
    const token = context && context.auth && context.auth.token;
    if (!context || !context.auth || !context.auth.uid || L.esSesionAnonima(token)) {
      fallar("unauthenticated", L.MENSAJES.sinSesion);
    }
    const uid = context.auth.uid;
    const tipo = L.tipoDeSolicitud(data);
    if (!tipo) fallar("invalid-argument", L.MENSAJES.solicitud);

    const hash = L.hashDeCuenta(uid, deps.sal);
    const registroRef = db.collection("cuentasEliminadas").doc(hash);
    const registro = await registroRef.get();
    const estado = registro.exists ? registro.data().estado : null;

    if (tipo === "revisar") {
      if (estado === "completada") return { pendientes: [] };
      const { pendientes } = await revisar(uid, token || {});
      return { pendientes };
    }

    if (estado === "completada") return { eliminada: true };
    if (!L.sesionReciente(token, ahora())) {
      fallar("failed-precondition", L.MENSAJES.reautenticar, { motivo: "reautenticar" });
    }

    let pedidos = [];
    if (estado !== "en_curso") {
      const r = await revisar(uid, token);
      if (r.pendientes.length) {
        fallar("failed-precondition", L.MENSAJES.pendientes, { motivo: "pendientes", pendientes: r.pendientes });
      }
      pedidos = r.pedidos;
      const origen = L.origenDeLlamada(context.rawRequest && context.rawRequest.headers);
      await registroRef.set({
        estado: "en_curso",
        origen,
        iniciadaAt: FieldValue.serverTimestamp(),
        borrados: {},
        archivos: 0,
        intentos: 1,
      });
    } else {
      // Reintento: los pedidos se vuelven a buscar solo para proteger sus archivos.
      pedidos = (await buscarPedidos(uid, token)).todos || [];
      await registroRef.set({ intentos: FieldValue.increment(1) }, { merge: true });
    }

    await borrarTodo(uid, pedidos, registroRef);

    await registroRef.set({ estado: "completada", terminadaAt: FieldValue.serverTimestamp() }, { merge: true });
    const final = (await registroRef.get()).data() || {};
    // Sin PII: el hash (recortado), el origen y los números.
    logger.info("eliminarCuentaSecure: cuenta eliminada", {
      cuenta: hash.slice(0, 16),
      ...L.resumenAuditoria(final),
      intentos: final.intentos || 1,
    });
    return { eliminada: true };
  };
}

module.exports = { crearEliminarCuenta };
