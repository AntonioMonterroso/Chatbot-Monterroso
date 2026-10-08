import { createHmac, timingSafeEqual } from "node:crypto";

export function firmaValida(cuerpoCrudo, cabecera, secreto) {
  if (!secreto) return true; // sin secreto configurado (solo desarrollo)
  if (!cabecera?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex");
  const recibida = cabecera.slice(7);
  return recibida.length === esperada.length && timingSafeEqual(Buffer.from(recibida), Buffer.from(esperada));
}

// Extrae los mensajes de texto del payload de la Cloud API.
export function extraerMensajes(payload) {
  const out = [];
  for (const entry of payload?.entry ?? [])
    for (const change of entry.changes ?? [])
      for (const msg of change.value?.messages ?? [])
        if (msg.type === "text") out.push({ usuario: msg.from, texto: msg.text.body });
  return out;
}

export async function enviarTexto(para, texto, env = process.env) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[sin credenciales] -> ${para}: ${texto}`);
    return;
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  });
  if (!res.ok) console.error("Error enviando a WhatsApp:", res.status, await res.text());
}
