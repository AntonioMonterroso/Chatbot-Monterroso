// Limita cuántos mensajes puede mandar cada número por ventana de tiempo (anti-spam y control de costos).
export function crearLimitador({ max = 20, ventanaMs = 60_000 } = {}) {
  const registros = new Map();
  return {
    permitir(clave, ahora = Date.now()) {
      if (registros.size > 5000) {
        for (const [k, ts] of registros) if (!ts.some((t) => ahora - t < ventanaMs)) registros.delete(k);
      }
      const recientes = (registros.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
      const ok = recientes.length < max;
      if (ok) recientes.push(ahora);
      registros.set(clave, recientes);
      return ok;
    },
  };
}
