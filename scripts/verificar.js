// Revisa que todo esté listo para conectar el bot a WhatsApp:  npm run verificar   (o  npm run verificar -- --meta)
import { accessSync, constants, mkdirSync } from "node:fs";
import { cargarEnv } from "../src/env.js";

// Devuelve una lista de { nivel: "ok" | "aviso" | "error", texto }
export function evaluar(env, nodeVersion = process.versions.node) {
  const r = [];
  const ok = (texto) => r.push({ nivel: "ok", texto });
  const aviso = (texto) => r.push({ nivel: "aviso", texto });
  const error = (texto) => r.push({ nivel: "error", texto });

  Number(nodeVersion.split(".")[0]) >= 20 ? ok(`Node ${nodeVersion}`) : error(`Node ${nodeVersion}: se necesita la versión 20 o más nueva (nodejs.org)`);

  const token = env.WHATSAPP_VERIFY_TOKEN;
  if (!token || token === "cambia-esto") error("WHATSAPP_VERIFY_TOKEN: pon una palabra secreta tuya (la misma que escribirás en Meta)");
  else ok("WHATSAPP_VERIFY_TOKEN configurado");

  if (!env.WHATSAPP_APP_SECRET) error("WHATSAPP_APP_SECRET: falta. Sin él, cualquiera podría mandarle mensajes falsos al bot (Meta > Configuración de la app > Básica)");
  else ok("WHATSAPP_APP_SECRET configurado (los mensajes se verifican)");

  if (!env.WHATSAPP_ACCESS_TOKEN) error("WHATSAPP_ACCESS_TOKEN: falta (Meta > WhatsApp > Configuración de la API)");
  else ok("WHATSAPP_ACCESS_TOKEN configurado");

  if (!env.WHATSAPP_PHONE_NUMBER_ID) error("WHATSAPP_PHONE_NUMBER_ID: falta (Meta > WhatsApp > Configuración de la API)");
  else ok("WHATSAPP_PHONE_NUMBER_ID configurado");

  if (env.RESUMEN_HORA !== undefined && !(Number.isInteger(Number(env.RESUMEN_HORA)) && env.RESUMEN_HORA >= 0 && env.RESUMEN_HORA <= 23)) {
    error("RESUMEN_HORA debe ser un número de 0 a 23");
  }

  env.NUMEROS_PERMITIDOS
    ? ok("NUMEROS_PERMITIDOS: solo esos números pueden usar el bot")
    : aviso("NUMEROS_PERMITIDOS vacío: cualquiera que escriba a tu número podrá usar el bot (y gastar tus llaves de IA)");
  env.OPENAI_API_KEY ? ok("Notas de voz activadas") : aviso("Sin OPENAI_API_KEY: el bot pedirá que escriban en vez de mandar notas de voz");
  env.ANTHROPIC_API_KEY
    ? ok("Fotos de facturas y respaldo de IA activados")
    : aviso("Sin ANTHROPIC_API_KEY: no leerá fotos de facturas ni entenderá mensajes muy raros");
  return r;
}

const ICONO = { ok: "✅", aviso: "⚠️ ", error: "❌" };

async function principal() {
  console.log(cargarEnv() ? "Leyendo .env\n" : "No encontré el archivo .env (cópialo de .env.example)\n");
  const resultados = evaluar(process.env);

  try {
    mkdirSync("data", { recursive: true });
    accessSync("data", constants.W_OK);
    resultados.push({ nivel: "ok", texto: "La carpeta data/ se puede escribir (ahí se guardan tus ventas)" });
  } catch {
    resultados.push({ nivel: "error", texto: "No puedo escribir en la carpeta data/" });
  }

  if (process.argv.includes("--meta") && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } });
      const j = await res.json();
      resultados.push(
        res.ok
          ? { nivel: "ok", texto: `Meta acepta tu token: número ${j.display_phone_number} (${j.verified_name})` }
          : { nivel: "error", texto: `Meta rechazó el token o el número: ${j.error?.message ?? res.status}` },
      );
    } catch (e) {
      resultados.push({ nivel: "aviso", texto: `No pude hablar con Meta: ${e.message}` });
    }
  }

  for (const { nivel, texto } of resultados) console.log(`${ICONO[nivel]} ${texto}`);
  const errores = resultados.filter((x) => x.nivel === "error").length;
  console.log(errores ? `\n${errores} cosa(s) por arreglar antes de publicar.` : "\nTodo listo para conectar ✨");
  process.exitCode = errores ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
