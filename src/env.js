import { readFileSync, existsSync } from "node:fs";

// Lee un archivo .env (CLAVE=valor, # comentarios, comillas opcionales). No pisa variables que ya
// existan en el entorno, e ignora las vacías ("ANTHROPIC_API_KEY=" significa "no configurada").
export function cargarEnv(ruta = ".env", env = process.env) {
  if (!existsSync(ruta)) return false;
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    if (linea.trim().startsWith("#")) continue;
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let valor = m[2];
    if (/^(["']).*\1$/.test(valor)) valor = valor.slice(1, -1);
    else valor = valor.replace(/\s+#.*$/, "");
    if (valor !== "" && env[m[1]] === undefined) env[m[1]] = valor;
  }
  return true;
}
