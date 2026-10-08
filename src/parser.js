// Interpreta mensajes de texto en español, de forma flexible.
// "vendí 250", "vendí 3 pollos a 45 con tarjeta", "gasté Q100 en pollo",
// "compré 80 tomates a Don Pepe", "pagué 500 a Don Pepe", "resumen de la semana"

const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const num = (s) => Number(s.replace(",", "."));
const redondear = (n) => Math.round(n * 100) / 100;

const METODOS = [
  ["efectivo", /\b(en )?efectivo\b/],
  ["tarjeta", /\b(con |en )?tarjeta\b/],
  ["transferencia", /\b(por |con |en )?(transferencia|deposito)\b/],
];

// Quita el tramo que calza `re` de `orig` y `norm` (mismo largo) a la vez.
function quitar([orig, norm], re) {
  const m = norm.match(re);
  if (!m) return [orig, norm];
  const fin = m.index + m[0].length;
  return [orig.slice(0, m.index) + orig.slice(fin), norm.slice(0, m.index) + norm.slice(fin)];
}

const limpiar = (s) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(en|de|por|para|a)\s+/i, "")
    .replace(/\s*(quetzales|en total)\s*$/i, "")
    .trim();

export function parsearMensaje(texto) {
  // "1,500" -> "1500" (misma conversión en ambas versiones del texto)
  const orig = texto.trim().replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
  const n = sinAcentos(orig).toLowerCase();

  if (/^(ayuda|menu|help|hola|buenas|buenos dias)\b/.test(n)) return { tipo: "ayuda" };
  if (/^(deshacer|borra(r)? (el )?ultimo|cancela(r)? (el )?ultimo|me equivoque)/.test(n)) return { tipo: "deshacer" };
  if (/^proveedor(es)?\b/.test(n)) return { tipo: "proveedores" };

  if (/^(resumen|cierre|reporte|hoy|ayer|semana|mes|cuanto)\b/.test(n)) {
    const periodo = /\bayer\b/.test(n) ? "ayer" : /\bsemana\b/.test(n) ? "semana" : /\bmes\b/.test(n) ? "mes" : "hoy";
    return { tipo: "resumen", periodo };
  }

  const verbo = n.match(/^(vendi|venta|ventas|ingreso|cobre|gaste|gasto|compre|compra|pague|pago)\b/);
  if (!verbo) return { tipo: "desconocido" };
  const tipo = /^(vendi|venta|ventas|ingreso|cobre)$/.test(verbo[1]) ? "venta" : "gasto";

  let par = [orig.slice(verbo[0].length), n.slice(verbo[0].length)];

  let metodo = null;
  for (const [nombre, re] of METODOS) {
    if (re.test(par[1])) {
      metodo = nombre;
      par = quitar(par, re);
    }
  }

  let monto;
  let detalle;
  let proveedor = null;

  // "3 pollos a 45" -> cantidad × precio unitario
  const qp = par[1].match(/(\d+)\s+([a-z ]+?)\s+a\s+q?\s*(\d+(?:[.,]\d{1,2})?)\b/);
  if (qp) {
    monto = redondear(Number(qp[1]) * num(qp[3]));
    detalle = `${qp[1]} ${limpiar(par[0].slice(qp.index + qp[1].length, qp.index + qp[1].length + qp[2].length + 1))}`.trim();
    par = quitar(par, /(\d+)\s+([a-z ]+?)\s+a\s+q?\s*(\d+(?:[.,]\d{1,2})?)\b/);
  } else {
    const m = par[1].match(/(?:q\.?\s*)?(\d+(?:[.,]\d{1,2})?)/);
    if (!m) return { tipo: "sinmonto", venta: tipo };
    monto = num(m[1]);
    par = quitar(par, /(?:q\.?\s*)?(\d+(?:[.,]\d{1,2})?)/);
    detalle = par[0].replace(/\s+/g, " ").trim();
    if (tipo === "gasto") {
      const prov = detalle.match(/(?:^|\s)a\s+(.+)$/i);
      if (prov) {
        proveedor = prov[1].trim();
        detalle = detalle.slice(0, prov.index);
      }
    }
    detalle = limpiar(detalle);
  }

  if (!(monto > 0)) return { tipo: "sinmonto", venta: tipo };
  return { tipo, monto, detalle, proveedor, metodo };
}
