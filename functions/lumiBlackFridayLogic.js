"use strict";
const { precioDeCatalogo } = require("./catalogPricing");

const CAMPAIGN_ID = "lumi-black-friday-2026";
const BRAND_ID = "pMujqcyIIDUF2EdSSX5V";
const START_MS = Date.parse("2026-11-27T00:00:00-05:00");
const DAY_MS = 24 * 60 * 60 * 1000;

function planLumiBlackFriday(products) {
  const changes = [], excluded = [];
  for (const product of products) {
    if (product.brandId !== BRAND_ID || product.visible === false || product.deleted === true || product.active === false) continue;
    const current = precioDeCatalogo(product);
    if (!Number.isFinite(current) || current <= 0) throw Error(`Invalid catalog price: ${product.id}`);
    const cents = Math.round(current * 100);
    if (cents <= 3000) { excluded.push({ id: product.id, name: product.name || "", price: current }); continue; }
    changes.push({ id: product.id, name: product.name || "", price: product.price,
      previousSalePrice: product.salePrice ?? null, before: cents / 100, after: (cents - 800) / 100 });
  }
  return { changes, excluded };
}

/** A single transaction changes prices and records completion. Scheduler retries
 * and concurrent invocations cannot subtract S/8 twice. Before/after prices are
 * saved in an admin-only audit; the public status contains no product backup.
 */
async function applyLumiBlackFriday({ db, now = Date.now, serverTimestamp }) {
  const timestamp = now();
  if (timestamp < START_MS || timestamp >= START_MS + DAY_MS) return { status: "outside-window" };
  const statusRef = db.collection("storeConfig").doc(CAMPAIGN_ID);
  return db.runTransaction(async transaction => {
    const status = await transaction.get(statusRef);
    if (status.exists && status.data().status === "complete") return { status: "already-applied" };
    const snapshot = await transaction.get(db.collection("productos_wala").where("brandId", "==", BRAND_ID));
    const products = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    if (!products.length) throw Error("Lumi catalog is empty; campaign was not applied");
    const plan = planLumiBlackFriday(products);
    if (plan.changes.length > 450) throw Error("Campaign exceeds the atomic write limit");
    for (const change of plan.changes) {
      transaction.update(db.collection("productos_wala").doc(change.id), {
        salePrice: change.after, updatedAt: serverTimestamp(), priceCampaignId: CAMPAIGN_ID,
      });
    }
    transaction.set(db.collection("storeConfigLogs").doc(CAMPAIGN_ID), {
      campaignId: CAMPAIGN_ID, createdAt: serverTimestamp(), appliedAtMs: timestamp,
      startsAtMs: START_MS, discountSoles: 8, minimumPriceExclusive: 30, ...plan,
    });
    const result = { status: "complete", campaignId: CAMPAIGN_ID, startsAtMs: START_MS,
      appliedAtMs: timestamp, discountSoles: 8, minimumPriceExclusive: 30,
      changedCount: plan.changes.length, excludedCount: plan.excluded.length };
    transaction.set(statusRef, { ...result, updatedAt: serverTimestamp() });
    return result;
  });
}

module.exports = { CAMPAIGN_ID, BRAND_ID, START_MS, DAY_MS, planLumiBlackFriday, applyLumiBlackFriday };
