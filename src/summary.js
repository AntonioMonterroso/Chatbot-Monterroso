const q = (n) => `Q${n.toFixed(2)}`;

export function armarResumen(movs) {
  const ventas = movs.filter((m) => m.tipo === "venta").reduce((a, m) => a + m.monto, 0);
  const gastos = movs.filter((m) => m.tipo === "gasto").reduce((a, m) => a + m.monto, 0);
  return [
    "Resumen del día",
    `Ventas: ${q(ventas)}`,
    `Gastos: ${q(gastos)}`,
    `Ganancia: ${q(ventas - gastos)}`,
  ].join("\n");
}
