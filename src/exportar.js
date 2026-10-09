import { diaLocal, horaLocal } from "./tiempo.js";
import { categoriaDe } from "./categorias.js";

const ENCABEZADO = ["Fecha", "Hora", "Tipo", "Monto", "Detalle", "Proveedor o cliente", "Método", "Categoría", "Anotado por"];

const TIPO = (m) =>
  m.tipo === "abono" ? (m.direccion === "pagar" ? "Pago a proveedor" : "Cobro de fiado") : m.tipo === "venta" ? "Venta" : "Gasto";

// Una celda de CSV. Lo que empieza con = + - @ lo trataría Excel como fórmula: se neutraliza.
function celda(valor) {
  let v = String(valor ?? "");
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// CSV con BOM para que Excel respete las tildes.
export function armarCsv(movs) {
  const filas = movs.map((m) => [
    diaLocal(new Date(m.fecha)),
    horaLocal(m.fecha),
    TIPO(m),
    m.monto.toFixed(2),
    m.detalle ?? "",
    m.persona ?? m.proveedor ?? "",
    m.metodo ?? (m.credito ? "crédito" : ""),
    m.tipo === "gasto" ? categoriaDe(m.detalle) : "",
    m.registro ?? m.usuario,
  ]);
  const ordenadas = filas.sort((a, b) => `${a[0]} ${a[1]}`.localeCompare(`${b[0]} ${b[1]}`));
  return `﻿${[ENCABEZADO, ...ordenadas].map((f) => f.map(celda).join(",")).join("\r\n")}\r\n`;
}
