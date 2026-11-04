/**
 * vaciarPapeleraVieja: cada madrugada (03:30 hora Lima) borra de verdad los
 * productos que llevan DIAS_PAPELERA días en la papelera, y le pone la fecha
 * a los que llegaron sin ella (ver ./papeleraLogic). Solo el documento: las
 * fotos quedan en Storage porque los pedidos guardan su dirección.
 */
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { planPapelera } = require("./papeleraLogic");

exports.vaciarPapeleraVieja = onSchedule(
  {
    schedule: "30 3 * * *",
    timeZone: "America/Lima",
    retryCount: 1, // idempotente: lo que ya se borró no vuelve a salir
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const snap = await db.collection("productos_wala").get();
    const productos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ahora = Date.now();
    const { marcar, borrar, enUso } = planPapelera(productos, ahora);
    const cambios = [
      ...marcar.map((id) => (b) => b.update(db.collection("productos_wala").doc(id), { papeleraDesde: ahora })),
      ...borrar.map((id) => (b) => b.delete(db.collection("productos_wala").doc(id))),
    ];
    for (let i = 0; i < cambios.length; i += 400) {
      const batch = db.batch();
      cambios.slice(i, i + 400).forEach((c) => c(batch));
      await batch.commit();
    }
    console.log(`vaciarPapeleraVieja: ${borrar.length} borrados, ${marcar.length} con fecha nueva, ${enUso.length} en uso (se quedan).`);
  }
);
