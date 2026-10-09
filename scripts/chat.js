// Chat por terminal para probar el bot sin WhatsApp: npm run chat
import { createInterface } from "node:readline";
import { mkdirSync, writeFileSync } from "node:fs";
import { crearStore } from "../src/store.js";
import { procesar } from "../src/bot.js";
import { interpretarMensaje } from "../src/ia.js";

const store = crearStore(process.env.CHAT_DB ?? null); // en memoria por defecto
// Con ANTHROPIC_API_KEY también prueba el respaldo de IA para mensajes raros.
const deps = process.env.ANTHROPIC_API_KEY ? { interpretar: (t) => interpretarMensaje(t) } : {};
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "tú > " });
console.log('Monterroso Chat (Ctrl+C para salir). Prueba: "vendí 250", "gasto 100 pollo", "resumen"');
rl.prompt();

for await (const linea of rl) {
  const texto = linea.trim();
  if (texto) {
    const r = await procesar({ usuario: "terminal", tipo: "text", texto }, store, deps);
    if (typeof r === "string") console.log(`bot > ${r}\n`);
    else {
      mkdirSync("exportes", { recursive: true });
      writeFileSync(`exportes/${r.documento.nombre}`, r.documento.buffer);
      console.log(`bot > ${r.texto}\n      📎 Archivo guardado en exportes/${r.documento.nombre}\n`);
    }
  }
  rl.prompt();
}
