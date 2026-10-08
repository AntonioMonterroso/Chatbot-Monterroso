import { createServer } from "node:http";
import { crearStore } from "./store.js";
import { responder } from "./bot.js";
import { extraerMensajes, firmaValida, enviarTexto } from "./whatsapp.js";

export function crearServidor({ store, env = process.env, enviar = enviarTexto } = {}) {
  store ??= crearStore();

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
      try {
        for (const msg of extraerMensajes(JSON.parse(crudo.toString()))) {
          await enviar(msg.usuario, responder(msg, store));
        }
      } catch (e) {
        console.error("Error procesando mensaje:", e);
      }
      return;
    }
    res.writeHead(405).end();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ?? 3000;
  crearServidor().listen(port, () => console.log(`Monterroso Chat escuchando en :${port}`));
}
