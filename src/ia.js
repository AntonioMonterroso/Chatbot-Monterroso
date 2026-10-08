// Voz y fotos. Cada función necesita su propia llave; sin ella el bot avisa al usuario.

export async function transcribirAudio({ buffer, mime }, env = process.env) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), "audio.ogg");
  form.append("model", "whisper-1");
  form.append("language", "es");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcripción falló: ${res.status} ${await res.text()}`);
  return (await res.json()).text ?? "";
}

const PROMPT_RECIBO =
  'Esta es la foto de una factura o recibo de compra de un restaurante en Guatemala. ' +
  'Responde SOLO con JSON: {"monto": <total pagado en quetzales como número o null>, ' +
  '"proveedor": <nombre del comercio o null>, "detalle": <qué se compró, máximo 5 palabras, o "">}.';

export async function leerRecibo({ buffer, mime }, env = process.env) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: buffer.toString("base64") } },
            { type: "text", text: PROMPT_RECIBO },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Lectura de foto falló: ${res.status} ${await res.text()}`);
  const texto = (await res.json()).content?.find((c) => c.type === "text")?.text ?? "";
  const json = texto.match(/\{[\s\S]*\}/)?.[0];
  return json ? JSON.parse(json) : null;
}
