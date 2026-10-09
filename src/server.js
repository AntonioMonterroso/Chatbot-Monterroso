import { createServer } from "node:http";
import { crearStore } from "./store.js";
import { procesar } from "./bot.js";
import { extraerMensajes, firmaValida, enviarTexto, enviarDocumento, descargarMedia } from "./whatsapp.js";
import { crearLimitador } from "./limitador.js";
import { transcribirAudio, leerRecibo, interpretarMensaje } from "./ia.js";
import { iniciarResumenNocturno } from "./scheduler.js";

// Voz, foto y el respaldo de IA solo se activan si hay llave configurada.
function depsDesdeEnv(env) {
  const deps = {};
  if (env.WHATSAPP_ACCESS_TOKEN) deps.descargarMedia = (id) => descargarMedia(id, env);
  if (env.OPENAI_API_KEY) deps.transcribirAudio = (m) => transcribirAudio(m, env);
  if (env.ANTHROPIC_API_KEY) {
    deps.leerRecibo = (m) => leerRecibo(m, env);
    deps.interpretar = (t) => interpretarMensaje(t, env);
  }
  return deps;
}

export function crearServidor({ store, env = process.env, enviar = enviarTexto, enviarDoc = enviarDocumento, deps, limitador } = {}) {
  store ??= crearStore();
  deps ??= depsDesdeEnv(env);
  limitador ??= crearLimitador();
  // Si se define NUMEROS_PERMITIDOS, solo esos números (y sus empleados) pueden usar el bot
  const permitidos = new Set((env.NUMEROS_PERMITIDOS ?? "").split(",").map((n) => n.trim()).filter(Boolean));
  const autorizado = (u) => !permitidos.size || permitidos.has(u) || store.negocioDe(u) !== u;
  const vistos = new Set(); // Meta reintenta entregas: evita anotar dos veces

  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/webhook") {
      res.writeHead(url.pathname === "/health" ? 200 : 404).end();
      return;
    }

    // Verificación del webhook por parte de Meta
    if (req.method === "GET") {
      const ok =
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === env.WHATSAPP_VERIFY_TOKEN;
      res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get("hub.challenge") : "");
      return;
    }

    if (req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const crudo = Buffer.concat(chunks);
      if (!firmaValida(crudo, req.headers["x-hub-signature-256"], env.WHATSAPP_APP_SECRET)) {
        res.writeHead(401).end();
        return;
      }
      res.writeHead(200).end(); // responder rápido a Meta
      let mensajes = [];
      try {
        mensajes = extraerMensajes(JSON.parse(crudo.toString()));
      } catch (e) {
        console.error("Payload inválido:", e);
      }
      for (const msg of mensajes) {
        if (msg.id && vistos.has(msg.id)) continue;
        if (msg.id) {
          vistos.add(msg.id);
          if (vistos.size > 1000) vistos.delete(vistos.values().next().value);
        }
        if (!autorizado(msg.usuario)) {
          console.warn(`Mensaje ignorado de un número no autorizado: …${msg.usuario.slice(-4)}`);
          continue;
        }
        if (!limitador.permitir(msg.usuario)) {
          console.warn(`Demasiados mensajes de …${msg.usuario.slice(-4)}; se ignora`);
          continue;
        }
        try {
          const r = await procesar(msg, store, deps);
          if (typeof r === "string") await enviar(msg.usuario, r);
          else await enviarDoc(msg.usuario, r.documento, r.texto);
        } catch (e) {
          console.error("Error procesando mensaje:", e);
          await enviar(msg.usuario, "Tuve un problema procesando eso. Intenta de nuevo, por favor.").catch(() => {});
        }
      }
      return;
    }
    res.writeHead(405).end();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ?? 3000;
  const store = crearStore();
  const servidor = crearServidor({ store });
  servidor.listen(port, () => console.log(`Monterroso Chat escuchando en :${port}`));
  iniciarResumenNocturno({ store, enviar: enviarTexto, hora: Number(process.env.RESUMEN_HORA ?? 21) });
  for (const senal of ["SIGINT", "SIGTERM"]) {
    process.on(senal, () => {
      servidor.close();
      store.cerrar();
      process.exit(0);
    });
  }
}
