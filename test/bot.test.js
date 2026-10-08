import { test } from "node:test";
import assert from "node:assert/strict";
import { crearStore } from "../src/store.js";
import { responder, procesar } from "../src/bot.js";
import { diaLocal, rango } from "../src/tiempo.js";
import { debeEnviar, enviarResumenes } from "../src/scheduler.js";

const U = "502";

test("el día usa hora de Guatemala, no UTC", () => {
  // 8 pm en Guatemala = 02:00 UTC del día siguiente
  assert.equal(diaLocal(new Date("2026-10-09T02:00:00Z")), "2026-10-08");
  assert.deepEqual(rango("semana", new Date("2026-10-09T02:00:00Z")).desde, "2026-10-02");
});

test("una venta de las 8 pm cuenta en el resumen de hoy", () => {
  const store = crearStore(null);
  const noche = new Date("2026-10-09T02:00:00Z");
  responder({ usuario: U, texto: "vendí 300" }, store, noche);
  responder({ usuario: U, texto: "gasto 100 pollo a Don Pepe" }, store, noche);
  const r = responder({ usuario: U, texto: "resumen" }, store, noche);
  assert.match(r, /Ventas: Q300.00/);
  assert.match(r, /Ganancia: Q200.00/);
  assert.match(r, /Don Pepe: Q100.00/);
});

test("ayer y semana", () => {
  const store = crearStore(null);
  responder({ usuario: U, texto: "vendí 100" }, store, new Date("2026-10-07T18:00:00Z"));
  const hoy = new Date("2026-10-08T18:00:00Z");
  assert.match(responder({ usuario: U, texto: "ayer" }, store, hoy), /Ventas: Q100.00/);
  assert.match(responder({ usuario: U, texto: "resumen" }, store, hoy), /Sin movimientos/);
  assert.match(responder({ usuario: U, texto: "semana" }, store, hoy), /Ventas: Q100.00/);
});

test("deshacer borra solo lo último del mismo usuario", () => {
  const store = crearStore(null);
  responder({ usuario: U, texto: "vendí 100" }, store);
  responder({ usuario: "otro", texto: "vendí 999" }, store);
  assert.match(responder({ usuario: U, texto: "deshacer" }, store), /Borré: Venta de Q100.00/);
  assert.match(responder({ usuario: U, texto: "deshacer" }, store), /nada que borrar/);
  assert.match(responder({ usuario: "otro", texto: "resumen" }, store), /Q999.00/);
});

test("proveedores del mes", () => {
  const store = crearStore(null);
  responder({ usuario: U, texto: "compré 80 tomates a Don Pepe" }, store);
  responder({ usuario: U, texto: "pagué 20 a Don Pepe" }, store);
  assert.match(responder({ usuario: U, texto: "proveedores" }, store), /Don Pepe: Q100.00/);
});

test("voz: transcribe y registra", async () => {
  const store = crearStore(null);
  const deps = { descargarMedia: async () => ({}), transcribirAudio: async () => "vendí 75" };
  const r = await procesar({ usuario: U, tipo: "audio", mediaId: "m1" }, store, deps);
  assert.match(r, /Entendí: "vendí 75"/);
  assert.match(r, /Venta de Q75.00/);
});

test("foto: lee la factura y registra el gasto", async () => {
  const store = crearStore(null);
  const deps = {
    descargarMedia: async () => ({}),
    leerRecibo: async () => ({ monto: 230.5, proveedor: "Pollo Campero", detalle: "pollo" }),
  };
  const r = await procesar({ usuario: U, tipo: "image", mediaId: "m2" }, store, deps);
  assert.match(r, /Gasto de Q230.50/);
  assert.match(responder({ usuario: U, texto: "proveedores" }, store), /Pollo Campero/);
});

test("voz y foto sin configurar avisan en vez de fallar", async () => {
  const store = crearStore(null);
  assert.match(await procesar({ usuario: U, tipo: "audio" }, store), /no puedo escuchar/);
  assert.match(await procesar({ usuario: U, tipo: "image" }, store), /no puedo leer fotos/);
});

test("resumen nocturno: una vez al día y solo a quien tuvo movimientos", async () => {
  assert.equal(debeEnviar(new Date("2026-10-09T02:30:00Z"), undefined, 20), true); // 8:30 pm GT
  assert.equal(debeEnviar(new Date("2026-10-09T02:30:00Z"), "2026-10-08", 20), false); // ya enviado
  assert.equal(debeEnviar(new Date("2026-10-08T20:00:00Z"), undefined, 20), false); // 2 pm GT

  const store = crearStore(null);
  const noche = new Date("2026-10-09T02:30:00Z");
  responder({ usuario: U, texto: "vendí 50" }, store, new Date("2026-10-08T18:00:00Z"));
  responder({ usuario: "sinhoy", texto: "vendí 10" }, store, new Date("2026-10-01T18:00:00Z"));
  const enviados = [];
  await enviarResumenes(store, async (...a) => enviados.push(a), noche);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0][0], U);
  assert.equal(store.meta.get("ultimoResumen"), "2026-10-08");
});
