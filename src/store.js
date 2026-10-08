import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { diaLocal } from "./tiempo.js";

// Almacén mínimo en un archivo JSON. Se reemplazará por una base de datos real.
// Con ruta = null vive solo en memoria (tests y chat de terminal).
export function crearStore(ruta = "data/db.json") {
  let datos = { movimientos: [], meta: {} };
  if (ruta && existsSync(ruta)) datos = { ...datos, ...JSON.parse(readFileSync(ruta, "utf8")) };

  let sigId = datos.movimientos.reduce((max, m) => Math.max(max, m.id ?? 0), 0);
  for (const m of datos.movimientos) m.id ??= ++sigId;

  function guardar() {
    if (!ruta) return;
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(`${ruta}.tmp`, JSON.stringify(datos, null, 2));
    renameSync(`${ruta}.tmp`, ruta); // escritura atómica
  }

  return {
    agregar(mov) {
      const registro = { id: ++sigId, ...mov, fecha: mov.fecha ?? new Date().toISOString() };
      datos.movimientos.push(registro);
      guardar();
      return registro;
    },
    deshacerUltimo(usuario) {
      for (let i = datos.movimientos.length - 1; i >= 0; i--) {
        if (datos.movimientos[i].usuario === usuario) {
          const [quitado] = datos.movimientos.splice(i, 1);
          guardar();
          return quitado;
        }
      }
      return null;
    },
    ultimos(usuario, n = 5) {
      return datos.movimientos.filter((m) => m.usuario === usuario).slice(-n).reverse();
    },
    corregirUltimo(usuario, monto) {
      for (let i = datos.movimientos.length - 1; i >= 0; i--) {
        const m = datos.movimientos[i];
        if (m.usuario === usuario) {
          const antes = m.monto;
          m.monto = monto;
          guardar();
          return { mov: m, antes };
        }
      }
      return null;
    },
    // desde/hasta: días locales "YYYY-MM-DD", inclusivos
    entre(usuario, desde, hasta) {
      return datos.movimientos.filter((m) => {
        const d = diaLocal(new Date(m.fecha));
        return m.usuario === usuario && d >= desde && d <= hasta;
      });
    },
    usuarios() {
      return [...new Set(datos.movimientos.map((m) => m.usuario))];
    },
    meta: {
      get: (k) => datos.meta[k],
      set(k, v) {
        datos.meta[k] = v;
        guardar();
      },
    },
  };
}
