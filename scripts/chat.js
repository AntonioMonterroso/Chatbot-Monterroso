// Chat por terminal para probar el bot sin WhatsApp: npm run chat
import { createInterface } from "node:readline";
import { crearStore } from "../src/store.js";
import { responder } from "../src/bot.js";

const store = crearStore(process.env.CHAT_DB ?? null); // en memoria por defecto
const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "tú > " });
console.log('Monterroso Chat (Ctrl+C para salir). Prueba: "vendí 250", "gasto 100 pollo", "resumen"');
rl.prompt();

for await (const linea of rl) {
  const texto = linea.trim();
  if (texto) console.log(`bot > ${responder({ usuario: "terminal", texto }, store)}\n`);
  rl.prompt();
}
