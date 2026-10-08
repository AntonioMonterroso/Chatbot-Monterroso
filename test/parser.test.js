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
