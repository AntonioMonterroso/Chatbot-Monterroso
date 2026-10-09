import { test } from "node:test";
import assert from "node:assert/strict";
import { crearStore } from "../src/store.js";
import { responder } from "../src/bot.js";

const U = "50255550001";
const T0 = new Date("2026-10-08T18:00:00Z");
const di = (store, texto, ahora = T0) => responder({ usuario: U, texto }, store, ahora);

test("el bot recuerda la pregunta que dejó abierta", () => {
  const store = crearStore(null);
  assert.match(di(store, "vendi"), /¿De cuánto fue la venta/);
  assert.match(di(store, "250"), /Anotado ✅ Venta de Q250.00/);

  assert.match(di(store, "gaste en pollo"), /¿De cuánto fue el gasto/);
  assert.match(di(store, "q100"), /Gasto de Q100.00 \(pollo\)/);

  assert.match(di(store, "le fie 80"), /¿A quién se lo fiaste/);
  assert.match(di(store, "Marta"), /Venta de Q80.00 \(fiado a Marta\)/);
  assert.match(di(store, "le fie 20"), /¿A quién/);
  assert.match(di(store, "a Pepe"), /Pepe te debe Q20.00/);

  assert.match(di(store, "me pago 30"), /¿Quién pagó/);
  assert.match(di(store, "Marta"), /Marta te debe Q50.00/);

  assert.match(di(store, "corrige"), /¿Cuál es el monto correcto/);
  assert.match(di(store, "40"), /Corregido ✅.*Q40.00/);
});

test("la pregunta abierta se olvida: con otro comando, pasado el tiempo o si la respuesta no sirve", () => {
  const store = crearStore(null);
  di(store, "vendi");
  assert.match(di(store, "resumen"), /Resumen de hoy/); // un comando nuevo manda
  assert.match(di(store, "250"), /No te entendí/); // ya no hay pregunta pendiente

  di(store, "vendi");
  assert.match(di(store, "250", new Date(T0.getTime() + 6 * 60_000)), /No te entendí/); // pasaron 6 minutos

  di(store, "vendi");
  assert.match(di(store, "no sé cuánto fue la verdad", T0), /No te entendí/);
  assert.match(di(store, "250"), /No te entendí/); // la pendiente se gastó con el intento

  // las preguntas de un usuario no se mezclan con las de otro
  responder({ usuario: "otro", texto: "vendi" }, store, T0);
  assert.match(responder({ usuario: U, texto: "250" }, store, T0), /No te entendí/);
});

test("cuadre de caja", () => {
  const store = crearStore(null);
  assert.match(di(store, "caja inicial 200"), /Fondo de caja: Q200.00/);
  di(store, "vendi 500");
  di(store, "vendi 300 con tarjeta"); // no entra a la caja
  di(store, "gaste 120 en gas");
  di(store, "compre 400 a Don Pepe al credito"); // no sale de la caja
  di(store, "le fie 90 a Marta"); // tampoco entra
  di(store, "Marta me pago 40");
  di(store, "pague 100 a Don Pepe");

  const sinContar = di(store, "cierre de caja");
  assert.match(sinContar, /Fondo inicial: Q200.00/);
  assert.match(sinContar, /\+ Ventas en efectivo: Q500.00/);
  assert.match(sinContar, /\+ Cobros de fiado: Q40.00/);
  assert.match(sinContar, /- Gastos en efectivo: Q120.00/);
  assert.match(sinContar, /- Pagos a proveedores: Q100.00/);
  assert.match(sinContar, /= Debería haber: Q520.00/);
  assert.match(sinContar, /tarjeta o transferencia.*Q300.00/);
  assert.match(sinContar, /escríbeme: caja 850/);

  assert.match(di(store, "tengo 520 en caja"), /La caja cuadra/);
  assert.match(di(store, "caja 500"), /Faltan Q20.00/);
  assert.match(di(store, "caja 530.50"), /Sobran Q10.50/);
  assert.match(di(store, "compre una caja de refresco 90"), /Gasto de Q90.00/); // no confunde "caja" con el cuadre
});

test("el fiado viejo se marca con su antigüedad", () => {
  const store = crearStore(null);
  di(store, "le fie 100 a Marta", new Date("2026-09-20T18:00:00Z"));
  di(store, "le fie 50 a Pepe", new Date("2026-10-05T18:00:00Z"));
  const r = di(store, "quien me debe");
  assert.match(r, /Marta: Q100.00 \(hace 18 días\)/);
  assert.match(r, /Pepe: Q50.00\n?$/); // 3 días: todavía no se marca

  // si paga todo y vuelve a fiar, la cuenta empieza de nuevo
  di(store, "Marta me pago 100", new Date("2026-10-06T18:00:00Z"));
  di(store, "le fie 30 a Marta", new Date("2026-10-07T18:00:00Z"));
  const nueva = di(store, "quien me debe");
  assert.match(nueva, /Marta: Q30.00$/); // sin "hace N días": la deuda vieja ya estaba pagada
});

test("fiar sin monto pregunta el monto y luego el nombre", () => {
  const store = crearStore(null);
  assert.match(di(store, "le fie"), /¿Cuánto le fiaste/);
  assert.match(di(store, "100"), /¿A quién se lo fiaste/);
  assert.match(di(store, "Marta"), /Marta te debe Q100.00/);
  assert.match(di(store, "fiado"), /No hay cuentas pendientes|Te deben/); // "fiado" solo sigue siendo la lista
});
