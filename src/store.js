import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

// Almacén mínimo en un archivo JSON. Se reemplazará por una base de datos real.
export function crearStore(ruta = "data/db.json") {
  let datos = { movimientos: [] };
  if (existsSync(ruta)) datos = JSON.parse(readFileSync(ruta, "utf8"));

  function guardar() {
    if (!ruta) return;
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, JSON.stringify(datos, null, 2));
  }

  return {
    agregar(mov) {
      const registro = { ...mov, fecha: mov.fecha ?? new Date().toISOString() };
      datos.movimientos.push(registro);
      guardar();
      return registro;
    },
    delDia(usuario, dia = new Date().toISOString().slice(0, 10)) {
      return datos.movimientos.filter((m) => m.usuario === usuario && m.fecha.startsWith(dia));
    },
    usuarios() {
      return [...new Set(datos.movimientos.map((m) => m.usuario))];
    },
  };
}
