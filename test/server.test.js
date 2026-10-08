import { test } from "node:test";
import assert from "node:assert/strict";
import { crearStore } from "../src/store.js";
import { crearServidor } from "../src/server.js";

test("webhook verifica, procesa y no duplica reintentos de Meta", async () => {
  const enviados = [];
  const env = { WHATSAPP_VERIFY_TOKEN: "tok" };
  const srv = crearServidor({ store: crearStore(null), env, deps: {}, enviar: async (...a) => enviados.push(a) });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/webhook`;

  const v = await fetch(`${base}?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=abc`);
  assert.equal(await v.text(), "abc");
  assert.equal((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=abc`)).status, 403);

  const payload = (id) => ({
    entry: [{ changes: [{ value: { messages: [{ id, from: "502", type: "text", text: { body: "vendí 50" } }] } }] }],
  });
  for (const id of ["wamid.1", "wamid.1", "wamid.2"]) {
    await fetch(base, { method: "POST", body: JSON.stringify(payload(id)) });
  }
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(enviados.length, 2); // el reintento wamid.1 se ignora
  assert.match(enviados[0][1], /Anotado/);
  srv.close();
});
