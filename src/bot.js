import { parsearMensaje } from "./parser.js";
import { armarResumen } from "./summary.js";

// Recibe el texto de un usuario y devuelve la respuesta a enviarle.
export function responder({ usuario, texto }, store) {
  const p = parsearMensaje(texto);
  switch (p.tipo) {
    case "venta":
    case "gasto":
      store.agregar({ usuario, ...p });
      return `Anotado: ${p.tipo} de Q${p.monto}${p.detalle ? ` (${p.detalle})` : ""}.`;
    case "resumen":
      return armarResumen(store.delDia(usuario));
    default:
      return 'No entendí. Prueba: "vendí 250", "gasto 100 pollo" o "resumen".';
  }
}
