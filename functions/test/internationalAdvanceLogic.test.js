"use strict";

const assert = require("assert");
const logic = require("../internationalAdvanceLogic");

assert.strictEqual(logic.ADVANCE_AMOUNT_USD, "20.00");
assert.strictEqual(logic.normalizeCountry(" us "), "US");
assert.strictEqual(logic.normalizePhone("+1 (202) 555-0123"), "+12025550123");
assert.throws(() => logic.validateCreatePayload({ tenantId: 1, chatId: 2, line: "Live", country: "PE", phone: "+51999999999" }), /no aplica/);
assert.throws(() => logic.validateCreatePayload({ tenantId: 1, chatId: 2, line: "Live", country: "US", phone: "+51999999999" }), /teléfono internacional/);
assert.deepStrictEqual(
  logic.validateCreatePayload({ tenantId: 127, chatId: "abc", line: "Live - Tik Tok", country: "US", phone: "+12025550123" }),
  { tenantId: "127", chatId: "abc", line: "Live - Tik Tok", country: "US", phone: "+12025550123" },
);
assert.strictEqual(logic.paymentLinkId("secret", "same"), logic.paymentLinkId("secret", "same"));
assert.notStrictEqual(logic.paymentLinkId("secret", "same"), logic.paymentLinkId("secret", "other"));
assert(logic.safeEqual("abc", "abc"));
assert(!logic.safeEqual("abc", "abd"));
assert(logic.isExpired({ expiresAt: Date.now() - 1 }));
assert(!logic.isExpired({ expiresAt: Date.now() + 1000 }));

console.log("internationalAdvanceLogic.test.js: OK");
