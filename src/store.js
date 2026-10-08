import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { diaLocal } from "./tiempo.js";
import { clavePersona } from "./texto.js";

// Almacén mínimo en un archivo JSON. Se reemplazará por una base de datos real.
// Con ruta = null vive solo en memoria (tests y chat de terminal).
export function crearStore(ruta = "data/db.json") {
  let datos = { movimientos: [], meta: {}, config: {}, equipo: {} };
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
    // `por`: quién lo anotó (un empleado solo deshace/corrige lo suyo)
    deshacerUltimo(usuario, por = usuario) {
      for (let i = datos.movimientos.length - 1; i >= 0; i--) {
        if (datos.movimientos[i].usuario === usuario && (datos.movimientos[i].registro ?? usuario) === por) {
          const [quitado] = datos.movimientos.splice(i, 1);
          guardar();
          return quitado;
        }
      }
      return null;
    },
    // por = undefined: todo el negocio; con `por`, solo lo que anotó esa persona
    ultimos(usuario, n = 5, por) {
      return datos.movimientos
        .filter((m) => m.usuario === usuario && (!por || (m.registro ?? usuario) === por))
        .slice(-n)
        .reverse();
    },
    corregirUltimo(usuario, monto, por = usuario) {
      for (let i = datos.movimientos.length - 1; i >= 0; i--) {
        const m = datos.movimientos[i];
        if (m.usuario === usuario && (m.registro ?? usuario) === por) {
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
    // Cuentas pendientes: lo que le deben al negocio (fiado) y lo que el negocio debe (crédito de proveedores)
    saldos(usuario) {
      const cobrar = new Map();
      const pagar = new Map();
      const mover = (mapa, nombre, monto) => {
        const k = clavePersona(nombre);
        const actual = mapa.get(k) ?? { nombre, monto: 0 };
        actual.monto = Math.round((actual.monto + monto) * 100) / 100;
        mapa.set(k, actual);
      };
      for (const m of datos.movimientos) {
        if (m.usuario !== usuario) continue;
        if (m.tipo === "venta" && m.metodo === "fiado" && m.persona) mover(cobrar, m.persona, m.monto);
        else if (m.tipo === "gasto" && m.credito && m.proveedor) mover(pagar, m.proveedor, m.monto);
        else if (m.tipo === "abono" && m.direccion === "cobrar") mover(cobrar, m.persona, -m.monto);
        else if (m.tipo === "abono" && m.direccion === "pagar") mover(pagar, m.persona, -m.monto);
      }
      for (const mapa of [cobrar, pagar]) for (const [k, v] of mapa) if (v.monto < 0.005) mapa.delete(k);
      return { cobrar, pagar };
    },
    // Equipo: un empleado anota en el negocio de su dueño
    negocioDe: (telefono) => datos.equipo[telefono] ?? telefono,
    empleados: (dueno) => Object.keys(datos.equipo).filter((t) => datos.equipo[t] === dueno),
    agregarEmpleado(dueno, telefono) {
      if (telefono === dueno) return "tu";
      if (datos.equipo[telefono]) return datos.equipo[telefono] === dueno ? "ya" : "otro";
      if (datos.equipo[dueno]) return "empleado"; // un empleado no agrega gente
      if (datos.movimientos.some((m) => m.usuario === telefono)) return "propio"; // ya lleva su propio negocio
      datos.equipo[telefono] = dueno;
      guardar();
      return "ok";
    },
    quitarEmpleado(dueno, telefono) {
      if (datos.equipo[telefono] !== dueno) return false;
      delete datos.equipo[telefono];
      guardar();
      return true;
    },
    config: {
      get: (usuario, k) => datos.config[usuario]?.[k],
      set(usuario, k, v) {
        (datos.config[usuario] ??= {})[k] = v;
        guardar();
      },
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
