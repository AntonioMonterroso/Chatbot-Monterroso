import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearMensaje as p } from "../src/parser.js";

test("ventas", () => {
  assert.deepEqual(p("vendí 250"), { tipo: "venta", monto: 250, detalle: "", proveedor: null, metodo: null });
  assert.deepEqual(p("Vendí Q1,500 con tarjeta"), { tipo: "venta", monto: 1500, detalle: "", proveedor: null, metodo: "tarjeta" });
  const v = p("vendí 3 pollos a 45");
  assert.equal(v.monto, 135);
  assert.equal(v.detalle, "3 pollos");
});

test("gastos con detalle y proveedor", () => {
  assert.deepEqual(p("gasté 100 en pollo"), { tipo: "gasto", monto: 100, detalle: "pollo", proveedor: null, metodo: null });
  const g = p("compré Q80.50 tomates a Don Pepe");
  assert.equal(g.monto, 80.5);
  assert.equal(g.detalle, "tomates");
  assert.equal(g.proveedor, "Don Pepe");
  const pago = p("pagué 500 a Don Pepe en efectivo");
  assert.equal(pago.proveedor, "Don Pepe");
  assert.equal(pago.metodo, "efectivo");
  assert.equal(p("compré 10 libras de tomate a 8").monto, 80);
});

test("comandos", () => {
  assert.equal(p("hola").tipo, "ayuda");
  assert.equal(p("Deshacer").tipo, "deshacer");
  assert.equal(p("proveedores").tipo, "proveedores");
  assert.deepEqual(p("resumen de la semana"), { tipo: "resumen", periodo: "semana" });
  assert.deepEqual(p("ayer"), { tipo: "resumen", periodo: "ayer" });
  assert.deepEqual(p("resumen"), { tipo: "resumen", periodo: "hoy" });
});

test("casos incompletos o desconocidos", () => {
  assert.equal(p("vendí").tipo, "sinmonto");
  assert.equal(p("qué tal el clima").tipo, "desconocido");
});

test("tolera faltas de ortografía y escritura informal", () => {
  const casos = [
    ["bendi 250", { tipo: "venta", monto: 250 }],
    ["vendiii 250", { tipo: "venta", monto: 250 }],
    ["Vendí 500 con targeta", { tipo: "venta", monto: 500, metodo: "tarjeta" }],
    ["gaste en pollo 100", { tipo: "gasto", monto: 100, detalle: "pollo" }],
    ["compre tomates a Don Pepe 80", { tipo: "gasto", monto: 80, detalle: "tomates", proveedor: "Don Pepe" }],
    ["pageé 500 a Don Pepe en efectibo", { tipo: "gasto", monto: 500, proveedor: "Don Pepe", metodo: "efectivo" }],
    ["hoy vendi 300", { tipo: "venta", monto: 300, detalle: "" }],
    ["ya vendi 2k", { tipo: "venta", monto: 2000 }],
    ["vendí 2 mil", { tipo: "venta", monto: 2000 }],
    ["Q 75 vendi", { tipo: "venta", monto: 75 }],
    ["vendi 3 pollos x 45", { tipo: "venta", monto: 135 }],
    ["rresumen", { tipo: "resumen", periodo: "hoy" }],
    ["resumen de la semna", { tipo: "resumen", periodo: "semana" }],
    ["cuanto vendi hoy", { tipo: "resumen", periodo: "hoy" }],
    ["ventas de hoy", { tipo: "resumen", periodo: "hoy" }],
    ["ayer", { tipo: "resumen", periodo: "ayer" }],
    ["deshaser", { tipo: "deshacer" }],
    ["me equivoque", { tipo: "deshacer" }],
    ["proveedoress", { tipo: "proveedores" }],
    ["ola", { tipo: "ayuda" }],
  ];
  for (const [texto, esperado] of casos) {
    const r = p(texto);
    for (const [k, v] of Object.entries(esperado)) assert.equal(r[k], v, `"${texto}" -> ${k}: ${JSON.stringify(r)}`);
  }
});

test("números escritos con letras", () => {
  assert.equal(p("vendi doscientos cincuenta").monto, 250);
  assert.equal(p("vendí dos mil quinientos").monto, 2500);
  assert.equal(p("gaste treinta y cinco en hielo").monto, 35);
  assert.equal(p("vendi sincuenta").monto, 50);
  // una cantidad chica en letras no es el monto
  assert.equal(p("vendi dos pollos").tipo, "sinmonto");
  assert.equal(p("vendi dos pollos a 45").monto, 90);
});

test("no confunde palabras comunes con comandos", () => {
  for (const t of ["todo bien", "qué buen día", "gracias", "el tren llegó"]) {
    assert.equal(p(t).tipo, "desconocido", t);
  }
});

test("preámbulo y fecha", () => {
  const g = p("anota gasto de 60 en cebolla");
  assert.equal(g.detalle, "cebolla");
  assert.equal(p("ayer vendi 500").ayer, true);
  assert.equal(p("vendi 500").ayer, undefined);
});

import { parsearVarios } from "../src/parser.js";

test("varios movimientos en un mensaje", () => {
  const r = parsearVarios("vendi 100 y gaste 40 en hielo");
  assert.deepEqual(r.map((x) => [x.tipo, x.monto]), [["venta", 100], ["gasto", 40]]);

  const items = parsearVarios("vendi 3 pollos a 45 y 2 cervezas a 20");
  assert.deepEqual(items.map((x) => x.monto), [135, 40]);
  assert.equal(items[1].tipo, "venta"); // hereda el verbo

  assert.deepEqual(parsearVarios("vendi 100, 200 y 300").map((x) => x.monto), [100, 200, 300]);
  assert.deepEqual(parsearVarios("vendi 100\ngaste 50 a Don Pepe").map((x) => x.tipo), ["venta", "gasto"]);
  assert.equal(parsearVarios("vendi dos mil y quinientos").length, 1);
  assert.equal(parsearVarios("vendi dos mil y quinientos")[0].monto, 2500);
  assert.equal(parsearVarios("Q 75 vendi").length, 1); // monto antes del verbo
  assert.equal(parsearVarios("compre 80 tomates a Don Pepe")[0].proveedor, "Don Pepe");
});

test("corregir y últimos", () => {
  assert.deepEqual(p("corrige 120"), { tipo: "corregir", monto: 120 });
  assert.deepEqual(p("era 150"), { tipo: "corregir", monto: 150 });
  assert.equal(p("corrige").tipo, "sinmonto");
  assert.equal(p("ultimos").tipo, "ultimos");
  assert.equal(p("mis movimientos").tipo, "ultimos");
});

test("fiado, abonos, deudas y hora del resumen", () => {
  assert.deepEqual(p("le fie 100 a Marta"), { tipo: "venta", monto: 100, detalle: "", proveedor: null, metodo: "fiado", persona: "Marta" });
  assert.equal(p("fiado 100 Marta").persona, "Marta");
  assert.equal(p("vendi 100 a Marta fiado").persona, "Marta");
  assert.equal(p("le fie 100").tipo, "sinpersona");
  assert.deepEqual(p("Marta me pago 50"), { tipo: "abono", direccion: "cobrar", persona: "Marta", monto: 50 });
  assert.equal(p("abono 50 Marta").persona, "Marta");
  assert.equal(p("Marta me pago").tipo, "sinmonto");
  assert.equal(p("compre 500 a Don Pepe al credito").credito, true);
  assert.equal(p("compre 500 a Don Pepe al credito").proveedor, "Don Pepe");
  for (const t of ["quien me debe", "fiados", "deudas", "cuanto me deben"]) assert.equal(p(t).tipo, "deudas", t);
  assert.equal(p("resumen a las 8").hora, 20);
  assert.equal(p("mandame el cierre a las 9 pm").hora, 21);
  assert.equal(p("avisame a las 7 de la mañana").hora, 7);
  assert.equal(p("no quiero resumen").hora, null);
  assert.equal(parsearVarios("le fie 100 a Marta y le fie 50 a Pepe").length, 2);
});
