"use strict";
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { applyLumiBlackFriday } = require("./lumiBlackFridayLogic");

exports.applyLumiBlackFriday2026 = onSchedule({
  schedule: "0 0 27 11 *", timeZone: "America/Lima", region: "us-central1",
  retryCount: 5, minBackoffSeconds: 10, maxBackoffSeconds: 120,
  maxInstances: 1, timeoutSeconds: 180, memory: "256MiB",
}, async () => {
  const result = await applyLumiBlackFriday({ db: admin.firestore(), serverTimestamp: () => FieldValue.serverTimestamp() });
  console.info("Lumi Black Friday", result);
});
