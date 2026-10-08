// Guatemala no tiene horario de verano: UTC-6 todo el año.
const OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? -360);

export const aLocal = (d = new Date()) => new Date(d.getTime() + OFFSET_MIN * 60000);
export const diaLocal = (d = new Date()) => aLocal(d).toISOString().slice(0, 10);

export function sumarDias(dia, n) {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function rango(periodo, ahora = new Date()) {
  const hoy = diaLocal(ahora);
  switch (periodo) {
    case "ayer": {
      const a = sumarDias(hoy, -1);
      return { desde: a, hasta: a, titulo: "Resumen de ayer" };
    }
    case "semana":
      return { desde: sumarDias(hoy, -6), hasta: hoy, titulo: "Resumen de los últimos 7 días" };
    case "mes":
      return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy, titulo: "Resumen del mes" };
    default:
      return { desde: hoy, hasta: hoy, titulo: "Resumen de hoy" };
  }
}
