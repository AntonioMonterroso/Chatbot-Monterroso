import { existsSync, copyFileSync } from "node:fs";
import { diaLocal } from "./tiempo.js";
import { clavePersona } from "./texto.js";
import { aplicar, cargar, compactar, abrirParaAgregar, estadoVacio } from "./diario.js";

// Almacén de datos. Con ruta, persiste en un diario (ver diario.js); con ruta = null vive solo en
// memoria (tests y chat de terminal). Todo cambio pasa por `commit`: primero al disco, luego a memoria.
export function crearStore(ruta = "data/diario.jsonl") {
  let datos = estadoVacio();
  let diario = null;

  if (ruta) {
    // Instalaciones anteriores guardaban todo en data/db.json: se migra solo al primer arranque
    const anterior = ruta.replace(/diario\.jsonl$/, "db.json");
    if (!existsSync(ruta) && anterior !== ruta && existsSync(anterior)) copyFileSync(anterior, ruta);
    const leido = cargar(ruta);
    datos = leido.datos;
    leido.avisos.forEach((a) => console.warn(`[datos] ${a}`));
    // los movimientos del formato anterior no tenían id
    let max = datos.movimientos.reduce((m, x) => Math.max(m, x.id ?? 0), 0);
    for (const m of datos.movimientos) m.id ??= ++max;
    const demasiadoLargo = leido.lineas > 1000 && leido.lineas > 3 * (datos.movimientos.length + 1);
    if (leido.sucio || demasiadoLargo) compactar(ruta, datos);
    diario = abrirParaAgregar(ruta);
  }

  let sigId = datos.movimientos.reduce((max, m) => Math.max(max, m.id ?? 0), 0);

  function commit(op) {
    diario?.escribir(op); // si el disco falla, la excepción sale y la memoria no cambia
    aplicar(datos, op);
  }

  return {
    agregar(mov) {
      const registro = { id: sigId + 1, ...mov, fecha: mov.fecha ?? new Date().toISOString() };
      commit({ op: "mov+", m: registro });
      sigId = registro.id;
      return registro;
    },
    // `por`: quién lo anotó (un empleado solo deshace/corrige lo suyo)
    deshacerUltimo(usuario, por = usuario) {
      for (let i = datos.movimientos.length - 1; i >= 0; i--) {
        if (datos.movimientos[i].usuario === usuario && (datos.movimientos[i].registro ?? usuario) === por) {
          const quitado = datos.movimientos[i];
          commit({ op: "mov-", id: quitado.id });
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
          commit({ op: "mov~", id: m.id, campos: { monto } });
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
      const mover = (mapa, nombre, monto, fecha) => {
        const k = clavePersona(nombre);
        const actual = mapa.get(k) ?? { nombre, monto: 0 };
        if (monto > 0 && actual.monto < 0.005) actual.desde = fecha; // empieza una deuda nueva
        actual.monto = Math.round((actual.monto + monto) * 100) / 100;
        mapa.set(k, actual);
      };
      for (const m of datos.movimientos) {
        if (m.usuario !== usuario) continue;
        if (m.tipo === "venta" && m.metodo === "fiado" && m.persona) mover(cobrar, m.persona, m.monto, m.fecha);
        else if (m.tipo === "gasto" && m.credito && m.proveedor) mover(pagar, m.proveedor, m.monto, m.fecha);
        else if (m.tipo === "abono" && m.direccion === "cobrar") mover(cobrar, m.persona, -m.monto, m.fecha);
        else if (m.tipo === "abono" && m.direccion === "pagar") mover(pagar, m.persona, -m.monto, m.fecha);
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
      commit({ op: "eq+", tel: telefono, dueno });
      return "ok";
    },
    quitarEmpleado(dueno, telefono) {
      if (datos.equipo[telefono] !== dueno) return false;
      commit({ op: "eq-", tel: telefono });
      return true;
    },
    config: {
      get: (usuario, k) => datos.config[usuario]?.[k],
      set: (usuario, k, v) => commit({ op: "cfg", u: usuario, k, v }),
    },
    // Preguntas que el bot dejó abiertas ("¿de cuánto fue?"); solo en memoria, no se guardan
    pendientes: new Map(),
    // Cierra el archivo (para apagar con calma y en pruebas)
    cerrar: () => diario?.cerrar(),
    usuarios() {
      return [...new Set(datos.movimientos.map((m) => m.usuario))];
    },
    meta: {
      get: (k) => datos.meta[k],
      set: (k, v) => commit({ op: "meta", k, v }),
    },
  };
}
