import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cargarEnv } from "../src/env.js";
import { evaluar } from "../scripts/verificar.js";
import { crearStore } from "../src/store.js";
import { crearServidor } from "../src/server.js";

test(".env: comentarios, comillas, vacías ignoradas y sin pisar lo que ya existe", () => {
  const dir = mkdtempSync(join(tmpdir(), "env-"));
  try {
    const ruta = join(dir, ".env");
    writeFileSync(
      ruta,
      ["# comentario", "PORT=4000", 'TOKEN="con espacios"', "OPCIONAL=", "export HORA=21 # nocturno", "YA_EXISTE=nuevo", "  ESPACIOS = valor  ", "basura sin igual"].join("\n"),
    );
    const env = { YA_EXISTE: "original" };
    assert.equal(cargarEnv(ruta, env), true);
    assert.deepEqual(env, { YA_EXISTE: "original", PORT: "4000", TOKEN: "con espacios", HORA: "21", ESPACIOS: "valor" });
    assert.equal(cargarEnv(join(dir, "no-existe"), {}), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verificar: detecta lo que falta y distingue errores de avisos", () => {
  const vacio = evaluar({}, "22.1.0");
  assert.equal(vacio.filter((x) => x.nivel === "error").length, 4);
  assert.ok(vacio.some((x) => x.nivel === "aviso" && /NUMEROS_PERMITIDOS/.test(x.texto)));

  const completo = evaluar(
    {
      WHATSAPP_VERIFY_TOKEN: "secreto", WHATSAPP_APP_SECRET: "s", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1",
      NUMEROS_PERMITIDOS: "502", OPENAI_API_KEY: "k", ANTHROPIC_API_KEY: "k", RESUMEN_HORA: "21",
    },
    "22.1.0",
  );
  assert.deepEqual(completo.filter((x) => x.nivel !== "ok"), []);

  assert.ok(evaluar({ WHATSAPP_VERIFY_TOKEN: "cambia-esto" }, "22.1.0").some((x) => x.nivel === "error" && /VERIFY_TOKEN/.test(x.texto)));
  assert.ok(evaluar({ RESUMEN_HORA: "25" }, "22.1.0").some((x) => /RESUMEN_HORA/.test(x.texto)));
  assert.ok(evaluar({}, "18.19.0").some((x) => x.nivel === "error" && /Node 18/.test(x.texto)));
});

test("/health responde sin revelar datos", async () => {
  const srv = crearServidor({ store: crearStore(null), env: {}, deps: {} });
  await new Promise((r) => srv.listen(0, r));
  const res = await fetch(`http://localhost:${srv.address().port}/health`);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.ok, true);
  assert.match(j.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(Object.keys(j).sort(), ["ok", "uptime", "version"]);
  assert.equal((await fetch(`http://localhost:${srv.address().port}/otra-cosa`)).status, 404);
  srv.close();
});
