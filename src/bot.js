import { parsearMensaje } from "./parser.js";
import { armarResumen, armarProveedores, q } from "./summary.js";
import { rango } from "./tiempo.js";

export const AYUDA = `Soy tu asistente de ventas y gastos. Escríbeme, mándame una nota de voz o una foto de una factura:

Ventas:  vendí 250 · vendí 3 pollos a 45 · vendí 500 con tarjeta
Gastos:  gasté 100 en pollo · compré 80 tomates a Don Pepe
Reportes: resumen · ayer · semana · mes · proveedores
Errores: deshacer (borra el último que anoté)

Cada noche te mando el resumen del día.`;

function describir(m) {
  const extra = [m.detalle, m.proveedor && `a ${m.proveedor}`, m.metodo].filter(Boolean).join(", ");
  return `${m.tipo === "venta" ? "Venta" : "Gasto"} de ${q(m.monto)}${extra ? ` (${extra})` : ""}`;
}

// Responde a un mensaje de texto. `ahora` se inyecta para poder probar fechas.
export function responder({ usuario, texto }, store, ahora = new Date()) {
  const p = parsearMensaje(texto);
  switch (p.tipo) {
    case "venta":
    case "gasto": {
      const { tipo, ...resto } = p;
      const mov = store.agregar({ usuario, tipo, ...resto, fecha: ahora.toISOString() });
      return `Anotado ✅ ${describir(mov)}.\nSi te equivocaste, escribe "deshacer".`;
    }
    case "deshacer": {
      const quitado = store.deshacerUltimo(usuario);
      return quitado ? `Borré: ${describir(quitado)}.` : "No tengo nada que borrar.";
    }
    case "resumen": {
      const r = rango(p.periodo, ahora);
      return armarResumen(store.entre(usuario, r.desde, r.hasta), r.titulo);
    }
    case "proveedores": {
      const r = rango("mes", ahora);
      return armarProveedores(store.entre(usuario, r.desde, r.hasta));
    }
    case "ayuda":
      return AYUDA;
    case "sinmonto":
      return `¿De cuánto fue ${p.venta === "venta" ? "la venta" : "el gasto"}? Ejemplo: ${p.venta === "venta" ? "vendí 250" : "gasté 100 en pollo"}`;
    default:
      return `No te entendí. Escribe "ayuda" para ver lo que puedo hacer.`;
  }
}

// Punto de entrada para cualquier tipo de mensaje de WhatsApp.
// deps: { descargarMedia, transcribirAudio, leerRecibo } (opcionales)
export async function procesar(msg, store, deps = {}, ahora = new Date()) {
  if (msg.tipo === "text") return responder(msg, store, ahora);

  if (msg.tipo === "audio") {
    if (!deps.descargarMedia || !deps.transcribirAudio) {
      return "Todavía no puedo escuchar notas de voz. Escríbeme el mensaje, por favor.";
    }
    const media = await deps.descargarMedia(msg.mediaId);
    const texto = (await deps.transcribirAudio(media)).trim();
    if (!texto) return "No alcancé a entender el audio. ¿Me lo repites o me lo escribes?";
    return `🎤 Entendí: "${texto}"\n\n${responder({ usuario: msg.usuario, texto }, store, ahora)}`;
  }

  if (msg.tipo === "image") {
    if (!deps.descargarMedia || !deps.leerRecibo) {
      return "Todavía no puedo leer fotos. Escríbeme el gasto, por ejemplo: compré 80 tomates a Don Pepe";
    }
    const media = await deps.descargarMedia(msg.mediaId);
    const r = await deps.leerRecibo(media);
    if (!r?.monto) return "No pude leer el total de la foto. Escríbeme el gasto, por ejemplo: gasté 100 en pollo";
    const mov = store.agregar({
      usuario: msg.usuario,
      tipo: "gasto",
      monto: r.monto,
      detalle: r.detalle ?? "",
      proveedor: r.proveedor ?? null,
      metodo: null,
      fecha: ahora.toISOString(),
    });
    return `📷 Leí la factura. Anotado ✅ ${describir(mov)}.\nSi no es correcto, escribe "deshacer".`;
  }

  return "Por ahora solo entiendo texto, notas de voz y fotos de facturas.";
}
