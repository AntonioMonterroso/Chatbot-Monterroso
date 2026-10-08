import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearMensaje } from "../src/parser.js";
import { crearStore } from "../src/store.js";
import { responder } from "../src/bot.js";
import { crearServidor } from "../src/server.js";

test("parsea ventas y gastos", () => {
  assert.deepEqual(parsearMensaje("vendí 250"), { tipo: "venta", monto: 250, detalle: "" });
  const g = parsearMensaje("compré Q80.50 tomates a Don Pepe");
  assert.equal(g.tipo, "gasto");
  assert.equal(g.monto, 80.5);
  assert.equal(g.proveedor, "Don Pepe");
  assert.equal(parsearMensaje("hola").tipo, "desconocido");
});

test("resumen del día", () => {
  const store = crearStore(null);
  responder({ usuario: "502", texto: "vendí 300" }, store);
  responder({ usuario: "502", texto: "gasto 100 pollo" }, store);
  const r = responder({ usuario: "502", texto: "resumen" }, store);
  assert.match(r, /Ventas: Q300.00/);
  assert.match(r, /Ganancia: Q200.00/);
});

test("webhook verifica y procesa mensajes", async () => {
  const enviados = [];
  const env = { WHATSAPP_VERIFY_TOKEN: "tok" };
  const srv = crearServidor({ store: crearStore(null), env, enviar: async (...a) => enviados.push(a) });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/webhook`;

  const v = await fetch(`${base}?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=abc`);
  assert.equal(await v.text(), "abc");
  assert.equal((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=abc`)).status, 403);

  const payload = { entry: [{ changes: [{ value: { messages: [{ from: "502", type: "text", text: { body: "vendí 50" } }] } }] }] };
  await fetch(base, { method: "POST", body: JSON.stringify(payload) });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(enviados.length, 1);
  assert.match(enviados[0][1], /Anotado/);
  srv.close();
});
