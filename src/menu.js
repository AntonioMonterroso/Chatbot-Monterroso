import { parsearMensaje } from "./parser.js";
import { buscar, sinAcentos, valorPalabraNumero } from "./texto.js";

const primeraPalabra = (nombre) => sinAcentos(nombre.toLowerCase()).split(/\s+/)[0].replace(/(?<=\w{3})s$/, "");
const esDigito = (n) => /^\d+(\.\d+)?$/.test(n);

// Con precios definidos, "vendí 3 pollos" se convierte en "vendí 3 pollos a 45".
// Solo se toca si el número va pegado antes del plato (es una cantidad) y no hay otro número dicho
// (un precio o un total mandan: "vendí 300 de pollo" sigue siendo Q300).
export function aplicarMenu(texto, items, ahora) {
  if (!items.length) return texto;
  const rapido = parsearMensaje(texto, ahora);
  const esVenta = rapido.tipo === "venta" || (rapido.tipo === "sinmonto" && rapido.venta === "venta");
  if (!esVenta) return texto;

  const tabla = new Map(items.map((it) => [primeraPalabra(it.nombre), it]));
  const palabras = texto.trim().split(/\s+/);
  const norm = palabras.map((w) => sinAcentos(w.toLowerCase()).replace(/[^a-z0-9.]/g, ""));

  for (let i = 0; i < palabras.length; i++) {
    if (norm[i].length < 3 || esDigito(norm[i])) continue;
    const item = buscar(norm[i], tabla);
    if (!item) continue;
    const prev = norm[i - 1];
    const conCantidad = !!prev && (esDigito(prev) || !!valorPalabraNumero(prev));
    if (norm.some((n, j) => esDigito(n) && j !== i - 1)) return texto; // ya hay un precio o total
    return [...palabras.slice(0, i), ...(conCantidad ? [] : ["1"]), palabras[i], "a", String(item.precio), ...palabras.slice(i + 1)].join(" ");
  }
  return texto;
}
