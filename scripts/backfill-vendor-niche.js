/**
 * Backfill multi-vendor / multi-nicho (Fase 1).
 * Asigna vendorId / nicheId / fulfillmentType por defecto a los productos que NO los
 * tengan. NO destructivo: solo escribe campos faltantes (nunca sobrescribe).
 *
 * Requisitos: GOOGLE_APPLICATION_CREDENTIALS apuntando al service account de pruebas-cd728.
 * Uso (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\serviceAccount.json"
 *   node scripts/backfill-vendor-niche.js --dry     # simula (no escribe)
 *   node scripts/backfill-vendor-niche.js           # aplica
 */
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON del service account).');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const DEFAULT_VENDOR_ID = 'casa';
const DEFAULT_NICHE_ID = 'regala-con-amor';
const dry = process.argv.includes('--dry');

(async () => {
  const snap = await db.collection('productos_wala').get();
  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const updates = {};
    if (!d.vendorId) updates.vendorId = DEFAULT_VENDOR_ID;
    if (!d.nicheId) updates.nicheId = DEFAULT_NICHE_ID;
    if (!d.fulfillmentType) {
      const isCustom = Boolean(d.customizable) ||
        (Array.isArray(d.customizationViews) && d.customizationViews.length > 0);
      updates.fulfillmentType = isCustom ? 'print_on_demand' : 'stock';
    }
    if (Object.keys(updates).length === 0) { skipped++; continue; }
    if (!dry) await doc.ref.update(updates);
    updated++;
  }

  console.log(`${dry ? '[DRY] ' : ''}Productos actualizados: ${updated}, sin cambios: ${skipped}, total: ${snap.size}`);
  process.exit(0);
})();
