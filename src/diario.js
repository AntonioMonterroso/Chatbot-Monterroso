// Persistencia en un diario: un archivo donde cada cambio es una línea JSON que se AGREGA al final.
// - Guardar un movimiento cuesta una línea, no reescribir todo el archivo.
// - Si se va la luz a media escritura, solo se pierde la línea incompleta; lo anterior queda intacto.
// - Al arrancar se repiten las líneas para reconstruir el estado, y si el archivo creció mucho
//   (o venía dañado o en el formato anterior) se compacta en una sola línea con el estado completo.
import {
  openSync, writeSync, fsyncSync, closeSync, readFileSync, writeFileSync, renameSync, copyFileSync, mkdirSync, existsSync,
} from "node:fs";
import { dirname } from "node:path";

export const estadoVacio = () => ({ movimientos: [], meta: {}, config: {}, equipo: {}, menu: {} });

// Aplica un cambio al estado en memoria. Es la ÚNICA forma de modificar el estado.
export function aplicar(datos, op) {
  switch (op.op) {
    case "snapshot":
      Object.assign(datos, estadoVacio(), op.datos);
      break;
    case "mov+":
      datos.movimientos.push(op.m);
      break;
    case "mov-": {
      const i = datos.movimientos.findIndex((m) => m.id === op.id);
      if (i >= 0) datos.movimientos.splice(i, 1);
      break;
    }
    case "mov~":
      Object.assign(datos.movimientos.find((m) => m.id === op.id) ?? {}, op.campos);
      break;
    case "meta":
      datos.meta[op.k] = op.v;
      break;
    case "cfg":
      (datos.config[op.u] ??= {})[op.k] = op.v;
      break;
    case "precio": {
      const menu = (datos.menu[op.u] ??= {});
      if (op.v == null) delete menu[op.k];
      else menu[op.k] = { nombre: op.nombre, precio: op.v };
      break;
    }
    case "eq+":
      datos.equipo[op.tel] = op.dueno;
      break;
    case "eq-":
      delete datos.equipo[op.tel];
      break;
    default:
      throw new Error(`operación desconocida: ${op.op}`);
  }
}

// Lee el archivo. `sucio` = conviene reescribirlo limpio (dañado, formato anterior o sin salto final).
export function cargar(ruta) {
  const datos = estadoVacio();
  if (!existsSync(ruta)) return { datos, lineas: 0, sucio: false, avisos: [] };
  const texto = readFileSync(ruta, "utf8");

  // Formato anterior: un solo JSON { movimientos: [...] }
  try {
    const j = JSON.parse(texto);
    if (j && Array.isArray(j.movimientos) && !j.op) {
      Object.assign(datos, estadoVacio(), j);
      return { datos, lineas: 0, sucio: true, avisos: ["Migrando el archivo anterior al formato de diario"] };
    }
  } catch {
    // no es un solo JSON: es un diario de varias líneas
  }

  const avisos = [];
  let lineas = 0;
  let sucio = texto.length > 0 && !texto.endsWith("\n");
  texto.split("\n").forEach((linea, i) => {
    if (!linea.trim()) return;
    lineas++;
    try {
      aplicar(datos, JSON.parse(linea));
    } catch (e) {
      sucio = true;
      avisos.push(`Línea ${i + 1} dañada, se omite (${e.message})`);
    }
  });
  return { datos, lineas, sucio, avisos };
}

// Reescribe el archivo como una sola línea con el estado completo (guarda copia del anterior en .bak).
export function compactar(ruta, datos) {
  mkdirSync(dirname(ruta), { recursive: true });
  if (existsSync(ruta)) copyFileSync(ruta, `${ruta}.bak`);
  writeFileSync(`${ruta}.tmp`, `${JSON.stringify({ op: "snapshot", datos })}\n`);
  renameSync(`${ruta}.tmp`, ruta); // reemplazo atómico
}

// Abre el diario para agregar líneas. Cada escritura se manda al disco antes de continuar.
export function abrirParaAgregar(ruta) {
  mkdirSync(dirname(ruta), { recursive: true });
  const fd = openSync(ruta, "a");
  return {
    escribir(op) {
      writeSync(fd, `${JSON.stringify(op)}\n`);
      fsyncSync(fd);
    },
    cerrar: () => closeSync(fd),
  };
}
