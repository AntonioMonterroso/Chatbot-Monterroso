// Interpreta mensajes de texto simples en español.
// Ejemplos: "vendí 250", "gasto 100 pollo", "compré 80 tomates a Don Pepe"
const MONTO = /(?:q\.?\s*)?(\d+(?:[.,]\d{1,2})?)/i;

function aNumero(s) {
  return Number(s.replace(",", "."));
}

export function parsearMensaje(texto) {
  const t = texto.trim();
  const lower = t.toLowerCase();

  if (/^(resumen|cierre|cuánto|cuanto)/.test(lower)) return { tipo: "resumen" };

  const m = lower.match(MONTO);
  if (!m) return { tipo: "desconocido" };
  const monto = aNumero(m[1]);
  const resto = t.replace(MONTO, "").replace(/\s+/g, " ").trim();

  if (/^(vend[ií]|venta|ingres)/.test(lower)) {
    return { tipo: "venta", monto, detalle: limpiar(resto, /^(vend[ií]|venta|ingres\w*)/i) };
  }
  if (/^(gast[eéo]|gasto|compr[eé]|pagu[eé])/.test(lower)) {
    const prov = resto.match(/\ba\s+(.+)$/i);
    return {
      tipo: "gasto",
      monto,
      detalle: limpiar(resto, /^(gast[eéo]|gasto|compr[eé]|pagu[eé])/i).replace(/\ba\s+.+$/i, "").trim(),
      proveedor: prov ? prov[1].trim() : null,
    };
  }
  return { tipo: "desconocido" };
}

function limpiar(s, re) {
  return s.replace(re, "").trim();
}
