import { nombreDia, diaLocal, horaLocal } from "./tiempo.js";

export const q = (n) =>
  `${n < 0 ? "-" : ""}Q${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const suma = (xs) => xs.reduce((a, m) => a + m.monto, 0);
const ventasDe = (movs) => movs.filter((m) => m.tipo === "venta");
const gastosDe = (movs) => movs.filter((m) => m.tipo === "gasto");

function agrupar(movs, clave) {
  const mapa = new Map();
  for (const m of movs) mapa.set(clave(m), (mapa.get(clave(m)) ?? 0) + m.monto);
  return [...mapa].sort((a, b) => b[1] - a[1]);
}

export function describir(m) {
  if (m.tipo === "abono") {
    return m.direccion === "pagar" ? `Pago a ${m.persona} de ${q(m.monto)}` : `Abono de ${m.persona} de ${q(m.monto)}`;
  }
  const extra = [
    m.detalle,
    m.proveedor && `a ${m.proveedor}`,
    m.persona && `fiado a ${m.persona}`,
    m.metodo && m.metodo !== "fiado" && m.metodo,
    m.credito && "a crédito",
  ]
    .filter(Boolean)
    .join(", ");
  return `${m.tipo === "venta" ? "Venta" : "Gasto"} de ${q(m.monto)}${extra ? ` (${extra})` : ""}`;
}

function comparar(actual, anterior, etiqueta) {
  if (!(anterior > 0)) return null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  const flecha = pct > 0 ? "▲" : pct < 0 ? "▼" : "=";
  return `Ventas vs ${etiqueta}: ${flecha} ${Math.abs(pct)}% (antes ${q(anterior)})`;
}

// opciones: { previos, etiquetaPrevio, multidia }
export function armarResumen(movs, titulo = "Resumen de hoy", { previos = [], etiquetaPrevio, multidia = false } = {}) {
  if (!movs.length) return `${titulo}\nSin movimientos registrados.`;
  const ventas = ventasDe(movs);
  const gastos = gastosDe(movs);
  const lineas = [
    titulo,
    `Ventas: ${q(suma(ventas))} (${ventas.length})`,
    `Gastos: ${q(suma(gastos))} (${gastos.length})`,
    `Ganancia: ${q(suma(ventas) - suma(gastos))}`,
  ];

  const fiado = suma(ventas.filter((m) => m.metodo === "fiado"));
  const cobrado = suma(movs.filter((m) => m.tipo === "abono" && m.direccion === "cobrar"));
  if (fiado || cobrado) {
    lineas.push([fiado && `Fiado: ${q(fiado)}`, cobrado && `Cobrado de fiados: ${q(cobrado)}`].filter(Boolean).join(" · "));
  }

  const cmp = etiquetaPrevio && comparar(suma(ventas), suma(ventasDe(previos)), etiquetaPrevio);
  if (cmp) lineas.push(cmp);

  if (multidia && ventas.length) {
    const porDia = agrupar(ventas, (m) => diaLocal(new Date(m.fecha)));
    const [mejor, monto] = porDia[0];
    lineas.push(`Mejor día: ${nombreDia(mejor)} (${q(monto)})`);
    lineas.push(`Promedio por día con ventas: ${q(suma(ventas) / porDia.length)}`);
  }

  const topGastos = agrupar(gastos, (m) => m.proveedor || m.detalle || "otros").slice(0, 3);
  if (topGastos.length) lineas.push("", "Mayores gastos:", ...topGastos.map(([k, v]) => `- ${k}: ${q(v)}`));

  const porMetodo = agrupar(ventas.filter((m) => m.metodo && m.metodo !== "fiado"), (m) => m.metodo);
  if (porMetodo.length) lineas.push("", `Ventas por método: ${porMetodo.map(([k, v]) => `${k} ${q(v)}`).join(", ")}`);

  if (suma(gastos) > suma(ventas)) lineas.push("", "⚠️ Se gastó más de lo que se vendió.");
  return lineas.join("\n");
}

export function armarProveedores(movs) {
  const lista = agrupar(gastosDe(movs).filter((m) => m.proveedor), (m) => m.proveedor);
  if (!lista.length) return "Este mes no hay gastos con proveedor. Prueba: compré 80 tomates a Don Pepe";
  return ["Proveedores este mes:", ...lista.map(([k, v]) => `- ${k}: ${q(v)}`)].join("\n");
}

export function armarUltimos(movs, ahora = new Date()) {
  if (!movs.length) return "Todavía no has anotado nada.";
  const hoy = diaLocal(ahora);
  return [
    "Tus últimos movimientos:",
    ...movs.map((m, i) => {
      const f = new Date(m.fecha);
      const dia = diaLocal(f) === hoy ? "hoy" : diaLocal(f);
      return `${i + 1}. ${describir(m)} · ${dia} ${horaLocal(m.fecha)}`;
    }),
    'Para borrar el último escribe "deshacer"; para cambiar su monto, "corrige 120".',
  ].join("\n");
}

export function armarDeudas({ cobrar, pagar }) {
  const lista = (mapa) => [...mapa.values()].sort((a, b) => b.monto - a.monto);
  const total = (mapa) => lista(mapa).reduce((a, x) => a + x.monto, 0);
  if (!cobrar.size && !pagar.size) return "No hay cuentas pendientes. 🎉";
  const lineas = [];
  if (cobrar.size) lineas.push(`Te deben ${q(total(cobrar))}:`, ...lista(cobrar).map((x) => `- ${x.nombre}: ${q(x.monto)}`));
  if (pagar.size) {
    if (lineas.length) lineas.push("");
    lineas.push(`Debes ${q(total(pagar))}:`, ...lista(pagar).map((x) => `- ${x.nombre}: ${q(x.monto)}`));
  }
  return lineas.join("\n");
}
