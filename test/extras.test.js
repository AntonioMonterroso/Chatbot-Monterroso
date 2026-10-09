import { test } from "node:test";
import assert from "node:assert/strict";
import { crearStore } from "../src/store.js";
import { responder, procesar, BIENVENIDA } from "../src/bot.js";
import { parsearMensaje as p } from "../src/parser.js";
import { armarCsv } from "../src/exportar.js";
import { crearLimitador } from "../src/limitador.js";
import { crearServidor } from "../src/server.js";
import { enviarDocumento } from "../src/whatsapp.js";

const U = "50255550001";
const JUEVES = new Date("2026-10-08T18:00:00Z"); // jueves 8 de octubre de 2026, mediodía en Guatemala
const di = (store, texto, ahora = JUEVES) => responder({ usuario: U, texto }, store, ahora);

test("fechas pasadas: ayer, anteayer y días de la semana", () => {
  assert.equal(p("el lunes vendi 500", JUEVES).hace, 3);
  assert.equal(p("vendi 300 anteayer", JUEVES).hace, 2);
  assert.equal(p("antes de ayer gaste 80 en gas", JUEVES).hace, 2);
  assert.equal(p("vendi 100 el jueves", JUEVES).hace, 0); // mismo día de la semana = hoy
  assert.equal(p("vendi 100 el viernes", JUEVES).hace, 6); // el viernes pasado
  assert.equal(p("el lunes vendi 500", JUEVES).detalle, ""); // "el lunes" no queda en el detalle
});

test("un movimiento con fecha pasada se anota ese día y lo avisa", () => {
  const store = crearStore(null);
  assert.match(di(store, "el lunes vendi 500"), /Lo anoté con fecha de lunes 5/);
  assert.match(di(store, "resumen del lunes"), /Resumen del lunes 5[\s\S]*Ventas: Q500.00/);
  assert.match(di(store, "como me fue el martes"), /Sin movimientos/);
  assert.match(di(store, "resumen"), /Sin movimientos/); // hoy no tiene nada
  assert.match(di(store, "ayer gaste 80 en gas"), /con fecha de ayer/);
});

test("exportar genera un CSV para Excel", () => {
  const store = crearStore(null);
  di(store, "vendi 3 pollos a 45 con tarjeta");
  di(store, "gaste 80 en gas a Don Pepe");
  di(store, "le fie 50 a Marta");
  const r = di(store, "mandame el reporte en excel");
  assert.equal(typeof r, "object");
  assert.match(r.texto, /3 movimientos/);
  assert.match(r.documento.nombre, /^movimientos-2026-10-01-a-2026-10-08\.csv$/);
  const csv = r.documento.buffer.toString("utf8");
  assert.ok(csv.startsWith("﻿Fecha,Hora,Tipo,Monto"));
  assert.match(csv, /2026-10-08,12:00,Venta,135.00,3 pollos,,tarjeta,,50255550001/);
  assert.match(csv, /Gasto,80.00,gas,Don Pepe,,gas y energía/);
  assert.match(csv, /Venta,50.00,,Marta,fiado/);
  assert.match(di(crearStore(null), "exportar"), /No hay movimientos/);
});

test("el CSV neutraliza fórmulas y escapa comas y comillas", () => {
  const csv = armarCsv([
    { usuario: U, tipo: "gasto", monto: 10, detalle: '=HYPERLINK("http://malo")', proveedor: 'Pepe, "el" jefe', fecha: JUEVES.toISOString() },
    { usuario: U, tipo: "gasto", monto: 5, detalle: "+cmd|' /C calc'!A0", fecha: JUEVES.toISOString() },
  ]);
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/malo""\)"/);
  assert.match(csv, /"Pepe, ""el"" jefe"/);
  assert.match(csv, /,'\+cmd/);
  assert.doesNotMatch(csv, /,=HYPERLINK/);
});

test("bienvenida: solo la primera vez, y mensajes demasiado largos se rechazan", async () => {
  const store = crearStore(null);
  const m = (texto) => ({ usuario: U, tipo: "text", texto });
  const primera = await procesar(m("vendi 50"), store, {}, JUEVES);
  assert.ok(primera.startsWith(BIENVENIDA));
  assert.match(primera, /Venta de Q50.00/);
  assert.doesNotMatch(await procesar(m("vendi 60"), store, {}, JUEVES), /Soy tu asistente/);
  assert.match(await procesar(m("x".repeat(1500)), store, {}, JUEVES), /muy largo/);
});

test("limitador: bloquea el exceso y se recupera con el tiempo", () => {
  const l = crearLimitador({ max: 3, ventanaMs: 1000 });
  assert.deepEqual([1, 2, 3, 4].map(() => l.permitir("a", 0)), [true, true, true, false]);
  assert.equal(l.permitir("b", 0), true); // cada número tiene su propio cupo
  assert.equal(l.permitir("a", 1500), true);
});

test("servidor: lista de números permitidos y límite de mensajes", async () => {
  const enviados = [];
  const store = crearStore(null);
  const env = { WHATSAPP_VERIFY_TOKEN: "t", NUMEROS_PERMITIDOS: "50211110000" };
  const srv = crearServidor({
    store, env, deps: {}, limitador: crearLimitador({ max: 2 }),
    enviar: async (...a) => enviados.push(a),
  });
  await new Promise((r) => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}/webhook`;
  let n = 0;
  const enviar = (from) =>
    fetch(url, {
      method: "POST",
      body: JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: `w${++n}`, from, type: "text", text: { body: "vendi 10" } }] } }] }] }),
    });

  await enviar("50299999999"); // no está en la lista
  await enviar("50211110000");
  await enviar("50211110000");
  await enviar("50211110000"); // pasa el límite de 2
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(enviados.map((e) => e[0]), ["50211110000", "50211110000"]);

  // un empleado agregado por un dueño permitido sí puede escribir
  store.agregarEmpleado("50211110000", "50233334444");
  await enviar("50233334444");
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(enviados.at(-1)[0], "50233334444");
  srv.close();
});

test("enviarDocumento sube el archivo y luego lo manda", async () => {
  const llamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    llamadas.push([String(url), opts]);
    return new Response(JSON.stringify({ id: "MEDIA123" }), { status: 200 });
  };
  try {
    const env = { WHATSAPP_ACCESS_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "999" };
    await enviarDocumento("502", { nombre: "a.csv", mime: "text/csv", buffer: Buffer.from("x") }, "listo", env);
  } finally {
    globalThis.fetch = original;
  }
  assert.match(llamadas[0][0], /\/999\/media$/);
  assert.match(llamadas[1][0], /\/999\/messages$/);
  const cuerpo = JSON.parse(llamadas[1][1].body);
  assert.equal(cuerpo.type, "document");
  assert.deepEqual(cuerpo.document, { id: "MEDIA123", filename: "a.csv", caption: "listo" });
});
