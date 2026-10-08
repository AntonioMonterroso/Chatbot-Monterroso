import { parsearVarios, validarInterpretacion } from "./parser.js";
import { armarResumen, armarProveedores, armarUltimos, describir, q } from "./summary.js";
import { rango, rangoAnterior } from "./tiempo.js";

export const AYUDA = `Soy tu asistente de ventas y gastos. Escríbeme, mándame una nota de voz o una foto de una factura:

Ventas:  vendí 250 · vendí 3 pollos a 45 · vendí 500 con tarjeta
Gastos:  gasté 100 en pollo · compré 80 tomates a Don Pepe
Varias a la vez: vendí 100 y gasté 40 en hielo
Reportes: resumen · ayer · semana · mes · proveedores · últimos
Errores: deshacer (borra el último) · corrige 120 (cambia su monto)

No importa si escribes con faltas. Cada noche te mando el resumen del día.`;

// Responde a un mensaje de texto. `ahora` se inyecta para poder probar fechas.
export function responder({ usuario, texto }, store, ahora = new Date()) {
  return ejecutarVarios(parsearVarios(texto), usuario, store, ahora);
}

// Un mensaje puede traer varios movimientos: se anotan todos y se responde con una lista.
function ejecutarVarios(lista, usuario, store, ahora) {
  if (lista.length === 1) return ejecutar(lista[0], usuario, store, ahora);
  const anotados = [];
  const dudas = [];
  for (const p of lista) {
    if (p.tipo === "venta" || p.tipo === "gasto") anotados.push(registrar(p, usuario, store, ahora));
    else dudas.push(p);
  }
  if (!anotados.length) return ejecutar(lista[0], usuario, store, ahora);
  const lineas = [`Anotado ✅ ${anotados.length} movimientos:`, ...anotados.map((m) => `- ${describir(m)}`)];
  if (dudas.length) lineas.push("", "Una parte no la entendí; escríbela aparte, por favor.");
  lineas.push('Si te equivocaste, escribe "deshacer" (borra el último).');
  return lineas.join("\n");
}

function registrar(p, usuario, store, ahora) {
  const { tipo, ayer, ...resto } = p;
  // "ayer vendí 500" se anota con la fecha de ayer
  const fecha = new Date(ahora.getTime() - (ayer ? 86_400_000 : 0));
  return store.agregar({ usuario, tipo, ...resto, fecha: fecha.toISOString() });
}

const ETIQUETA_PREVIA = { hoy: "ayer", ayer: "anteayer", semana: "la semana anterior", mes: "el período anterior" };

function ejecutar(p, usuario, store, ahora) {
  switch (p.tipo) {
    case "venta":
    case "gasto": {
      const mov = registrar(p, usuario, store, ahora);
      return `Anotado ✅ ${describir(mov)}.\nSi te equivocaste, escribe "deshacer".`;
    }
    case "deshacer": {
      const quitado = store.deshacerUltimo(usuario);
      return quitado ? `Borré: ${describir(quitado)}.` : "No tengo nada que borrar.";
    }
    case "resumen": {
      const r = rango(p.periodo, ahora);
      const previo = rangoAnterior(r);
      return armarResumen(store.entre(usuario, r.desde, r.hasta), r.titulo, {
        previos: store.entre(usuario, previo.desde, previo.hasta),
        etiquetaPrevio: ETIQUETA_PREVIA[p.periodo],
        multidia: p.periodo === "semana" || p.periodo === "mes",
      });
    }
    case "ultimos":
      return armarUltimos(store.ultimos(usuario, 5), ahora);
    case "corregir": {
      const c = store.corregirUltimo(usuario, p.monto);
      return c ? `Corregido ✅ ${describir(c.mov)} (antes ${q(c.antes)}).` : "No tengo nada que corregir.";
    }
    case "proveedores": {
      const r = rango("mes", ahora);
      return armarProveedores(store.entre(usuario, r.desde, r.hasta));
    }
    case "ayuda":
      return AYUDA;
    case "sinmonto":
      if (p.venta === "corregir") return "¿Cuál es el monto correcto? Ejemplo: corrige 120";
      return `¿De cuánto fue ${p.venta === "venta" ? "la venta" : "el gasto"}? Ejemplo: ${p.venta === "venta" ? "vendí 250" : "gasté 100 en pollo"}`;
    default:
      return `No te entendí. Escribe "ayuda" para ver lo que puedo hacer.`;
  }
}

// Si el parser local no entiende, le pregunta a la IA (si está configurada).
async function responderConRespaldo({ usuario, texto }, store, deps, ahora) {
  const lista = parsearVarios(texto);
  if (lista.length === 1 && lista[0].tipo === "desconocido" && deps.interpretar) {
    try {
      lista[0] = validarInterpretacion(await deps.interpretar(texto)) ?? lista[0];
    } catch (e) {
      console.error("Respaldo de IA falló:", e.message);
    }
  }
  return ejecutarVarios(lista, usuario, store, ahora);
}

// Punto de entrada para cualquier tipo de mensaje de WhatsApp.
// deps: { descargarMedia, transcribirAudio, leerRecibo, interpretar } (opcionales)
export async function procesar(msg, store, deps = {}, ahora = new Date()) {
  if (msg.tipo === "text") return responderConRespaldo(msg, store, deps, ahora);

  if (msg.tipo === "audio") {
    if (!deps.descargarMedia || !deps.transcribirAudio) {
      return "Todavía no puedo escuchar notas de voz. Escríbeme el mensaje, por favor.";
    }
    const media = await deps.descargarMedia(msg.mediaId);
    const texto = (await deps.transcribirAudio(media)).trim();
    if (!texto) return "No alcancé a entender el audio. ¿Me lo repites o me lo escribes?";
    return `🎤 Entendí: "${texto}"\n\n${await responderConRespaldo({ usuario: msg.usuario, texto }, store, deps, ahora)}`;
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
