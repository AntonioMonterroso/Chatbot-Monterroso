import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export function firmaValida(cuerpoCrudo, cabecera, secreto) {
  if (!secreto) return true; // sin secreto configurado (solo desarrollo)
  if (!cabecera?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex");
  const recibida = cabecera.slice(7);
  return recibida.length === esperada.length && timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada));
}

// Extrae los mensajes (texto, audio, imagen) del payload de la Cloud API.
export function extraerMensajes(payload) {
  const out = [];
  for (const entry of payload?.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const msg of change.value?.messages ?? []) {
        const base = { id: msg.id, usuario: msg.from };
        if (msg.type === "text") out.push({ ...base, tipo: "text", texto: msg.text.body });
        else if (msg.type === "audio") out.push({ ...base, tipo: "audio", mediaId: msg.audio.id });
        else if (msg.type === "image") out.push({ ...base, tipo: "image", mediaId: msg.image.id });
        else out.push({ ...base, tipo: msg.type });
      }
  return out;
}

export async function descargarMedia(mediaId, env = process.env) {
  const auth = { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` };
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
  if (!meta.ok) throw new Error(`No pude obtener el archivo: ${meta.status}`);
  const { url, mime_type } = await meta.json();
  const archivo = await fetch(url, { headers: auth });
  if (!archivo.ok) throw new Error(`No pude descargar el archivo: ${archivo.status}`);
  return { buffer: Buffer.from(await archivo.arrayBuffer()), mime: mime_type };
}

export async function enviarTexto(para, texto, env = process.env) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[sin credenciales] -> ${para}: ${texto}`);
    return;
  }
  const res = await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  });
  if (!res.ok) console.error("Error enviando a WhatsApp:", res.status, await res.text());
}
