const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
let handler;

exports.kapiAssistant = functions.region('us-central1')
  .runWith({ secrets: ['KAPI_OPENAI_API_KEY'], minInstances: 0, maxInstances: 2, memory: '512MB', timeoutSeconds: 90 })
  .https.onRequest(async (req, res) => {
    if (!handler) handler = import('./kapi/http.mjs').then(({ createPublicHandler, createBudgetStore }) => {
      let cache;
      const ref = admin.firestore().collection('kapi_server').doc('search-cache');
      return createPublicHandler({ getKey: () => process.env.KAPI_OPENAI_API_KEY,
        budgetFor: key => createBudgetStore(admin.firestore(), key),
        loadCache: async () => {
          if (cache) return cache;
          const snapshot = await ref.get(); const meta = snapshot.data();
          if (!meta || !Number.isInteger(meta.parts) || meta.parts > 40) return null;
          const parts = await ref.collection('parts').get();
          cache = { ...meta, entries: parts.docs.flatMap(doc => doc.data().entries || []) };
          return cache;
        },
        saveCache: async value => {
          const { entries, ...meta } = value; const batch = admin.firestore().batch();
          const count = Math.ceil(entries.length / 24);
          const previous = await ref.collection('parts').get();
          for (const doc of previous.docs) if (Number(doc.id) >= count) batch.delete(doc.ref);
          for (let i = 0; i < count; i++) batch.set(ref.collection('parts').doc(String(i)), { entries: entries.slice(i * 24, (i + 1) * 24) });
          batch.set(ref, { ...meta, parts: count }); await batch.commit(); cache = value;
        },
      });
    }).catch(error => { handler = null; throw error; });
    try { return await (await handler)(req, res); }
    catch { res.status(503).json({ error: 'Kapi está descansando un momento. Inténtalo otra vez.' }); }
  });
