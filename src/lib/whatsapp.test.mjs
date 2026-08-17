// node --test src/lib/whatsapp.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsappLink } from "./whatsapp.js";

test("skipped answers do not leave blank lines", () => {
  const url = buildWhatsappLink("917021052482", ["Looking for: Tiles", "", null]);
  assert.equal(url, "https://wa.me/917021052482?text=Looking%20for%3A%20Tiles");
});

test("newlines survive and free text cannot break out of the query string", () => {
  // & and # are the ones that matter: unescaped, they would truncate the message.
  const url = buildWhatsappLink("917021052482", ["a", "R&D #2 = 100%"]);
  assert.equal(url, "https://wa.me/917021052482?text=a%0AR%26D%20%232%20%3D%20100%25");
  assert.equal(new URL(url).searchParams.get("text"), "a\nR&D #2 = 100%");
});
