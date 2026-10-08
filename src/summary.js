export const q = (n) =>
  `${n < 0 ? "-" : ""}Q${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const suma = (xs) => xs.reduce((a, m) => a + m.monto, 0);

function agrupar(movs, clave) {
  const mapa = new Map();
  for (const m of movs) mapa.set(clave(m), (mapa.get(clave(m)) ?? 0) + m.monto);
  return [...mapa].sort((a, b) => b[1] - a[1]);
}

export function armarResumen(movs, titulo = "Resumen de hoy") {
  if (!movs.length) return `${titulo}\nSin movimientos registrados.`;
  const ventas = movs.filter((m) => m.tipo === "venta");
  const gastos = movs.filter((m) => m.tipo === "gasto");
  const lineas = [
    titulo,
    `Ventas: ${q(suma(ventas))} (${ventas.length})`,
    `Gastos: ${q(suma(gastos))} (${gastos.length})`,
    `Ganancia: ${q(suma(ventas) - suma(gastos))}`,
  ];

  const topGastos = agrupar(gastos, (m) => m.proveedor || m.detalle || "otros").slice(0, 3);
  if (topGastos.length) lineas.push("", "Mayores gastos:", ...topGastos.map(([k, v]) => `- ${k}: ${q(v)}`));

  const porMetodo = agrupar(ventas.filter((m) => m.metodo), (m) => m.metodo);
  if (porMetodo.length) lineas.push("", `Ventas por método: ${porMetodo.map(([k, v]) => `${k} ${q(v)}`).join(", ")}`);

  return lineas.join("\n");
}

export function armarProveedores(movs) {
  const lista = agrupar(movs.filter((m) => m.tipo === "gasto" && m.proveedor), (m) => m.proveedor);
  if (!lista.length) return "Este mes no hay gastos con proveedor. Prueba: compré 80 tomates a Don Pepe";
  return ["Proveedores este mes:", ...lista.map(([k, v]) => `- ${k}: ${q(v)}`)].join("\n");
}
