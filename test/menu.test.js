import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crearStore } from "../src/store.js";
import { responder } from "../src/bot.js";

const DUENO = "50255550001";
const EMP = "50255550002";
const T0 = new Date("2026-10-08T18:00:00Z");
const di = (store, texto, quien = DUENO) => responder({ usuario: quien, texto }, store, T0);

test("con precios guardados, basta decir cuántos se vendieron", () => {
  const s = crearStore(null);
  assert.match(di(s, "precios"), /Todavía no tienes precios/);
  assert.match(di(s, "pollo cuesta 45"), /Listo ✅ pollo: Q45.00/);
  assert.match(di(s, "el almuerzo vale Q30"), /almuerzo: Q30.00/);

  assert.match(di(s, "vendi 3 pollos"), /Venta de Q135.00 \(3 pollos\)/);
  assert.match(di(s, "bendi dos almuerzos"), /Venta de Q60.00 \(2 almuerzos\)/);
  assert.match(di(s, "vendi pollo"), /Venta de Q45.00 \(1 pollo\)/);
  assert.match(di(s, "vendi 2 pollos con tarjeta"), /Venta de Q90.00 \(2 pollos, tarjeta\)/);
  assert.match(di(s, "le fie 2 almuerzos a Marta"), /Venta de Q60.00 \(2 almuerzos, fiado a Marta\)/);

  const varios = di(s, "vendi 2 pollos y 3 almuerzos");
  assert.match(varios, /2 movimientos/);
  assert.match(varios, /Q90.00 \(2 pollos\)/);
  assert.match(varios, /Q90.00 \(3 almuerzos\)/);

  const lista = di(s, "precios");
  assert.match(lista, /pollo: Q45.00/);
  assert.match(lista, /almuerzo: Q30.00/);
});

test("un precio o un total dicho por el usuario siempre manda", () => {
  const s = crearStore(null);
  di(s, "pollo cuesta 45");
  assert.match(di(s, "vendi 3 pollos a 50"), /Venta de Q150.00/); // precio distinto hoy
  assert.match(di(s, "vendi 300 de pollo"), /Venta de Q300.00 \(pollo\)/); // total, no cantidad
  assert.match(di(s, "vendi 100"), /Venta de Q100.00/); // sin plato
  assert.match(di(s, "compre 3 pollos a 20"), /Gasto de Q60.00/); // los gastos no usan precios de venta
  assert.match(di(s, "compre pollo 80"), /Gasto de Q80.00 \(pollo\)/);
});

test("consultar, cambiar y quitar precios; el plural y las faltas no estorban", () => {
  const s = crearStore(null);
  di(s, "pollos cuestan 45");
  assert.match(di(s, "cuanto cuesta el pollo"), /pollos: Q45.00/);
  assert.match(di(s, "pollo cuesta 50"), /pollo: Q50.00/); // reemplaza, no duplica
  assert.equal(s.menu.lista(DUENO).length, 1);
  assert.match(di(s, "bendi 2 poyos"), /Q100.00/);
  assert.match(di(s, "cuanto cuesta la pizza"), /No tengo precio guardado para pizza/);
  assert.match(di(s, "quita el precio del pollo"), /quité el precio de pollo/);
  assert.match(di(s, "quita el precio del pollo"), /No tengo precio guardado/);
  assert.match(di(s, "vendi 3 pollos"), /Venta de Q3.00/); // ya no hay precio: vuelve al comportamiento normal
});

test("falta el precio: el bot lo pregunta", () => {
  const s = crearStore(null);
  assert.match(di(s, "pollo cuesta"), /¿Cuánto cuesta pollo/);
  assert.match(di(s, "45"), /pollo: Q45.00/);
});

test("el empleado usa los precios del dueño pero no puede cambiarlos", () => {
  const s = crearStore(null);
  di(s, "pollo cuesta 45");
  di(s, "agrega a 5555 0002");
  assert.match(di(s, "vendi 2 pollos", EMP), /Venta de Q90.00/);
  assert.match(di(s, "pollo cuesta 1", EMP), /solo lo puede ver o cambiar el dueño/);
  assert.match(di(s, "vendi 1 pollo", EMP), /Q45.00/);
});

test("los precios sobreviven a un reinicio", () => {
  const dir = mkdtempSync(join(tmpdir(), "monterroso-"));
  try {
    const ruta = join(dir, "diario.jsonl");
    const a = crearStore(ruta);
    di(a, "pollo cuesta 45");
    di(a, "almuerzo cuesta 30");
    di(a, "quita el precio del almuerzo");
    a.cerrar();
    const b = crearStore(ruta);
    assert.deepEqual(b.menu.lista(DUENO), [{ nombre: "pollo", precio: 45 }]);
    assert.match(di(b, "vendi 2 pollos"), /Q90.00/);
    b.cerrar();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
