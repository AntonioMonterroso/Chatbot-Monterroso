import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crearStore } from "../src/store.js";
import { responder } from "../src/bot.js";

const U = "50255550001";
const AHORA = new Date("2026-10-08T18:00:00Z");

function carpeta() {
  const dir = mkdtempSync(join(tmpdir(), "monterroso-"));
  return { dir, ruta: join(dir, "diario.jsonl"), limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}
const di = (store, texto) => responder({ usuario: U, texto }, store, AHORA);

test("todo sobrevive a un reinicio: movimientos, deshacer, correcciones, equipo, metas y config", () => {
  const { ruta, limpiar } = carpeta();
  try {
    const a = crearStore(ruta);
    di(a, "vendi 100");
    di(a, "vendi 250");
    di(a, "gaste 40 en gas");
    di(a, "deshacer");
    di(a, "corrige 300");
    di(a, "le fie 80 a Marta");
    di(a, "meta 1000");
    di(a, "resumen a las 8");
    di(a, "agrega a 5555 0002");
    const antes = di(a, "resumen");
    a.cerrar();

    const b = crearStore(ruta); // "reinicio"
    assert.equal(di(b, "resumen"), antes);
    assert.match(di(b, "quien me debe"), /Marta: Q80.00/);
    assert.match(di(b, "equipo"), /50255550002/);
    assert.equal(b.config.get(U, "hora"), 20);
    // los ids siguen donde iban: no se repiten
    di(b, "vendi 1");
    assert.deepEqual(b.ultimos(U, 10).map((m) => m.id), [...new Set(b.ultimos(U, 10).map((m) => m.id))]);
    b.cerrar();
  } finally {
    limpiar();
  }
});

test("cada movimiento agrega una línea; no reescribe el archivo", () => {
  const { ruta, limpiar } = carpeta();
  try {
    const s = crearStore(ruta);
    di(s, "vendi 10");
    const tras1 = readFileSync(ruta, "utf8");
    di(s, "vendi 20");
    const tras2 = readFileSync(ruta, "utf8");
    assert.ok(tras2.startsWith(tras1)); // lo anterior queda intacto
    assert.equal(tras2.trim().split("\n").length - tras1.trim().split("\n").length, 1); // una línea por movimiento
    s.cerrar();
  } finally {
    limpiar();
  }
});

test("un corte a media escritura solo pierde la línea incompleta", () => {
  const { ruta, limpiar } = carpeta();
  const avisos = [];
  const original = console.warn;
  console.warn = (m) => avisos.push(m);
  try {
    const a = crearStore(ruta);
    di(a, "vendi 100");
    di(a, "vendi 200");
    a.cerrar();
    appendFileSync(ruta, '{"op":"mov+","m":{"id":99,"usuario":"5025555000'); // línea cortada, sin salto final

    const b = crearStore(ruta);
    assert.match(di(b, "resumen"), /Ventas: Q300.00 \(2\)/);
    assert.ok(avisos.some((m) => /dañada/.test(m)));
    assert.ok(existsSync(`${ruta}.bak`)); // queda copia del archivo dañado
    di(b, "vendi 50"); // y se puede seguir escribiendo normalmente
    b.cerrar();

    const c = crearStore(ruta);
    assert.match(di(c, "resumen"), /Ventas: Q350.00 \(3\)/);
    c.cerrar();
  } finally {
    console.warn = original;
    limpiar();
  }
});

test("migra solo el archivo anterior (data/db.json)", () => {
  const { dir, ruta, limpiar } = carpeta();
  const avisos = [];
  const original = console.warn;
  console.warn = (m) => avisos.push(m);
  try {
    const viejo = {
      movimientos: [
        { usuario: U, tipo: "venta", monto: 500, detalle: "", proveedor: null, metodo: null, fecha: AHORA.toISOString() },
        { id: 7, usuario: U, tipo: "gasto", monto: 120, detalle: "gas", proveedor: null, metodo: null, fecha: AHORA.toISOString() },
      ],
      meta: { ultimoResumen: "2026-10-07" },
    };
    writeFileSync(join(dir, "db.json"), JSON.stringify(viejo, null, 2));

    const s = crearStore(ruta); // la ruta nueva no existe: lo toma del db.json
    assert.match(di(s, "resumen"), /Ventas: Q500.00 \(1\)[\s\S]*Gastos: Q120.00 \(1\)/);
    assert.ok(s.ultimos(U, 5).every((m) => Number.isInteger(m.id))); // se les asignó id
    s.cerrar();
    assert.ok(existsSync(join(dir, "db.json"))); // el original no se toca
    assert.equal(readFileSync(ruta, "utf8").trim().split("\n").length, 1); // ya quedó en formato diario
    assert.ok(avisos.some((m) => /Migrando/.test(m)));

    const t = crearStore(ruta);
    assert.match(di(t, "resumen"), /Ventas: Q500.00/);
    t.cerrar();
  } finally {
    console.warn = original;
    limpiar();
  }
});

test("si el diario crece mucho, se compacta al arrancar sin perder nada", () => {
  const { ruta, limpiar } = carpeta();
  try {
    const a = crearStore(ruta);
    for (let i = 0; i < 700; i++) {
      di(a, "vendi 10");
      di(a, "deshacer"); // cada par deja 2 líneas y 0 movimientos
    }
    di(a, "vendi 77");
    a.cerrar();
    assert.ok(readFileSync(ruta, "utf8").trim().split("\n").length > 1000);

    const b = crearStore(ruta);
    assert.equal(readFileSync(ruta, "utf8").trim().split("\n").length, 1); // compactado
    assert.match(di(b, "resumen"), /Ventas: Q77.00 \(1\)/);
    b.cerrar();
  } finally {
    limpiar();
  }
});

test("si el disco falla, el cambio no queda a medias en memoria", () => {
  const { ruta, limpiar } = carpeta();
  try {
    const s = crearStore(ruta);
    di(s, "vendi 100");
    s.cerrar(); // cerrar el archivo hace que el siguiente guardado falle, como un disco roto
    assert.throws(() => di(s, "vendi 999"));
    assert.equal(s.ultimos(U, 10).length, 1);
    assert.equal(s.ultimos(U, 10)[0].monto, 100);
  } finally {
    limpiar();
  }
});
