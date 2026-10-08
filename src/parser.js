// Interpreta mensajes en español, tolerando faltas de ortografía y escritura informal:
//   "bendi 3 pollos a 45", "gaste en pollo 100", "compre tomates a Don Pepe 80",
//   "vendí doscientos cincuenta", "rresumen de la semana", "me equivoque"
import { sinAcentos, buscar, valorPalabraNumero, numeroDePalabras } from "./texto.js";

const tabla = (...palabras) => new Map(palabras.map((p) => [p, true]));
const conValor = (valor, ...palabras) => palabras.map((p) => [p, valor]);

const VERBOS = new Map([
  ...conValor("venta", "vendi", "vendimos", "vendio", "vendieron", "vendo", "venta", "ingreso", "cobre", "cobramos", "cobro", "pagaron", "facture"),
  ...conValor("gasto", "gaste", "gasto", "gastamos", "compre", "compra", "compro", "compramos", "pague", "pago", "pagamos", "saque"),
]);
const SUSTANTIVOS = tabla("ventas", "gastos", "compras");
const COMANDOS = new Map([
  ...conValor("resumen", "resumen", "cierre", "reporte", "informe", "balance", "cuanto", "cuantos"),
  ...conValor("proveedores", "proveedores", "proveedor"),
  ...conValor("deshacer", "deshacer", "borrar", "borra", "anular", "anula", "cancelar", "cancela", "elimina", "eliminar", "equivoque"),
  ...conValor("corregir", "corrige", "corregir", "correccion", "cambia", "cambiar", "modifica", "modificar", "era"),
  ...conValor("ultimos", "ultimos", "ultimas", "movimientos", "historial", "lista"),
]);
const AYUDA = tabla("ayuda", "ayudame", "menu", "help", "hola", "buenas", "buenos", "comandos", "instrucciones");
const PERIODOS = new Map([...conValor("ayer", "ayer"), ...conValor("semana", "semana", "semanal"), ...conValor("mes", "mes", "mensual"), ...conValor("hoy", "hoy")]);
const METODOS = new Map([
  ...conValor("efectivo", "efectivo", "cash"),
  ...conValor("tarjeta", "tarjeta", "pos"),
  ...conValor("transferencia", "transferencia", "deposito"),
]);
const RELLENO = tabla("ya", "me", "se", "acabo", "acabamos", "oye", "hey", "pues", "porfa", "favor", "por", "apunta", "anota", "registra", "anotame", "apuntame", "registrame", "quiero", "necesito", "de", "un", "una", "el", "la", "los", "las", "mi", "mis", "hice", "fue", "fueron", "y");
const PERIODO_EXACTO = tabla("hoy", "ayer");
const MONEDA = tabla("q", "qtz", "quetzal", "quetzales");
const PREPOSICIONES_INICIO = /^(en|de|por|para|con|a|la|el|los|las|un|una|mi|mis)$/;

const redondear = (n) => Math.round(n * 100) / 100;
const esNumero = (t) => t.valor !== undefined;

function normalizarToken(o) {
  return sinAcentos(o.toLowerCase())
    .replace(/[^a-z0-9.,/$]/g, "")
    .replace(/^[.,/]+|[.,/]+$/g, "")
    .replace(/([a-z])\1{2,}/g, "$1"); // "vendiii" -> "vendi" (los dígitos no)
}

// Texto -> tokens {o: original, n: normalizado, valor?: número}
function tokenizar(texto) {
  // "1,500" -> "1500"
  const limpio = texto.trim().replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
  const tokens = limpio
    .split(/\s+/)
    .map((o) => ({ o, n: normalizarToken(o) }))
    .filter((t) => t.n);

  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // "250", "q250", "250q", "$250", "80.50", "2k"
    const m = t.n.match(/^[q$]?\.?(\d+(?:[.,]\d{1,2})?)(k|q)?$/);
    if (m) {
      let valor = Number(m[1].replace(",", "."));
      if (m[2] === "k") valor *= 1000;
      if (tokens[i + 1]?.n === "mil") {
        valor *= 1000;
        i++;
      }
      out.push({ ...t, valor });
      continue;
    }
    // "dos mil quinientos", "treinta y cinco"
    if (valorPalabraNumero(t.n)) {
      const palabras = [t.n];
      let j = i + 1;
      while (j < tokens.length) {
        const sig = tokens[j].n;
        if (valorPalabraNumero(sig)) palabras.push(sig);
        else if (!(sig === "y" && tokens[j + 1] && valorPalabraNumero(tokens[j + 1].n))) break; // "treinta y cinco": la "y" no suma
        j++;
      }
      out.push({ o: tokens.slice(i, j).map((x) => x.o).join(" "), n: t.n, valor: numeroDePalabras(palabras), palabra: true });
      i = j - 1;
      continue;
    }
    out.push(t);
  }
  return out;
}

export function parsearMensaje(texto) {
  const tokens = tokenizar(texto);
  if (!tokens.length) return { tipo: "desconocido" };

  const primero = tokens.findIndex((t) => !esNumero(t) && !RELLENO.has(t.n));
  const cmd = primero >= 0 ? buscar(tokens[primero].n, COMANDOS) : undefined;
  const periodo = tokens.map((t) => buscar(t.n, PERIODOS)).find(Boolean) ?? "hoy";

  // 1. Comandos claros: resumen, proveedores, deshacer
  if (cmd === "resumen") return { tipo: "resumen", periodo };
  if (cmd === "proveedores") return { tipo: "proveedores" };
  if (cmd === "deshacer") return { tipo: "deshacer" };
  if (cmd === "ultimos") return { tipo: "ultimos" };
  if (cmd === "corregir") {
    const numeros = tokens.filter(esNumero);
    return numeros.length && numeros.at(-1).valor > 0
      ? { tipo: "corregir", monto: redondear(numeros.at(-1).valor) }
      : { tipo: "sinmonto", venta: "corregir" };
  }
  if (tokens.some((t) => /^equivoque$/.test(t.n))) return { tipo: "deshacer" };

  // 2. Venta o gasto: el verbo puede estar en las primeras palabras
  const hayNumero = tokens.some(esNumero);
  let tipo;
  let iVerbo = -1;
  for (let i = 0; i < Math.min(tokens.length, 5); i++) {
    if (esNumero(tokens[i])) continue;
    // "ventas"/"gastos" sin ningún número es un sustantivo ("ventas de hoy"), no un verbo
    if (!hayNumero && buscar(tokens[i].n, SUSTANTIVOS, false)) continue;
    const v = buscar(tokens[i].n, VERBOS);
    if (v) {
      tipo = v;
      iVerbo = i;
      break;
    }
  }

  // "ventas de hoy", "gastos de la semana": sin monto, es un pedido de resumen
  if (!tipo || iVerbo < 0) {
    if (tokens.length <= 4 && tokens.some((t) => buscar(t.n, SUSTANTIVOS))) return { tipo: "resumen", periodo };
    const p = primero >= 0 ? buscar(tokens[primero].n, PERIODOS) : undefined;
    if (p) return { tipo: "resumen", periodo: p };
    if (primero >= 0 && buscar(tokens[primero].n, AYUDA)) return { tipo: "ayuda" };
    return { tipo: "desconocido" };
  }

  const usados = new Set([iVerbo]);
  // Lo que va antes del verbo es preámbulo ("anota", "ya", "hoy"): no es parte del detalle
  tokens.forEach((t, i) => {
    if (i < iVerbo && !esNumero(t)) usados.add(i);
  });
  const ayer = tokens.some((t) => !esNumero(t) && t.n === "ayer");
  const resto = () => tokens.map((t, i) => ({ ...t, i })).filter((t) => !usados.has(t.i));

  // "hoy"/"ayer" dentro de una venta o gasto no son parte del detalle
  for (const t of resto()) if (!esNumero(t) && PERIODO_EXACTO.has(t.n)) usados.add(t.i);

  // Método de pago
  let metodo = null;
  for (const t of resto()) {
    const m = !esNumero(t) && buscar(t.n, METODOS);
    if (m) {
      metodo = m;
      usados.add(t.i);
      const ant = tokens[t.i - 1]?.n;
      if (ant && /^(con|en|por|de)$/.test(ant)) usados.add(t.i - 1);
    }
  }
  // Moneda ("Q", "quetzales")
  for (const t of resto()) if (!esNumero(t) && buscar(t.n, MONEDA)) usados.add(t.i);

  // Monto: "3 pollos a 45" (cantidad × precio) o un solo número
  let monto;
  let detalleQP;
  const libres = resto();
  for (let a = 0; a < libres.length && monto === undefined; a++) {
    if (!esNumero(libres[a])) continue;
    for (let b = a + 1; b < libres.length && b <= a + 6; b++) {
      if (esNumero(libres[b])) break;
      const sig = libres[b + 1];
      if (/^(a|x)$/.test(libres[b].n) && sig && esNumero(sig) && b > a + 1) {
        monto = redondear(libres[a].valor * sig.valor);
        detalleQP = libres.slice(a, b).map((t) => (esNumero(t) ? String(t.valor) : t.o)).join(" ");
        for (const t of libres.slice(a, b + 2)) usados.add(t.i);
        break;
      }
    }
  }
  if (monto === undefined) {
    // Prefiere números en dígitos; un número en letras chico ("dos pollos") se toma como cantidad, no como monto.
    const candidatos = resto().filter(esNumero);
    const elegido =
      candidatos.find((t) => !t.palabra) ?? candidatos.find((t) => t.palabra && t.valor >= 20);
    if (elegido) {
      monto = elegido.valor;
      usados.add(elegido.i);
    }
  }
  if (!(monto > 0)) return { tipo: "sinmonto", venta: tipo };

  // Proveedor ("... a Don Pepe") solo en gastos
  let proveedor = null;
  let restantes = resto();
  if (tipo === "gasto") {
    const ia = restantes.map((t) => t.n).lastIndexOf("a");
    if (ia >= 0 && restantes[ia + 1] && !esNumero(restantes[ia + 1])) {
      proveedor = restantes.slice(ia + 1).map((t) => t.o).join(" ");
      restantes = restantes.slice(0, ia);
    }
  }

  let detalle = detalleQP;
  if (detalle === undefined) {
    const palabras = restantes.filter((t) => !/^(c\/u|cu|cada|unidad)$/.test(t.n)).map((t) => t.o);
    while (palabras.length && PREPOSICIONES_INICIO.test(normalizarToken(palabras[0]))) palabras.shift();
    detalle = palabras.join(" ");
  }
  detalle = detalle.replace(/[.,;:!¡?¿]+$/g, "").trim();

  return { tipo, monto, detalle, proveedor, metodo, ...(ayer && { ayer: true }) };
}

// "vendí 100 y gasté 50", "vendí 3 pollos a 45 y 2 cervezas a 20", varias líneas...
// Devuelve una lista con un resultado por cada movimiento que encuentre.
export function parsearVarios(texto) {
  const esVerbo = (n) => !buscar(n, SUSTANTIVOS, false) && !!buscar(n, VERBOS);
  const empiezaConDigito = (n) => /^[q$]?\.?\d/.test(n);
  const empiezaConNumero = (n) => empiezaConDigito(n) || !!valorPalabraNumero(n);
  const resultados = [];

  for (const linea of texto.split(/[\n;]+/)) {
    const palabras = linea.trim().split(/\s+/).filter(Boolean);
    const segmentos = [[]];
    let verbo = null; // última palabra-verbo del segmento actual
    let conNumero = false;

    for (let i = 0; i < palabras.length; i++) {
      const w = palabras[i];
      const n = normalizarToken(w);
      const actual = segmentos.at(-1);
      // solo un dígito indica un ítem nuevo: "dos mil y quinientos" es un solo monto
      const sigNum = palabras[i + 1] && empiezaConDigito(normalizarToken(palabras[i + 1]));
      const esConector = n === "y" || w.endsWith(",");

      if (esVerbo(n) && verbo) {
        segmentos.push([w]); // segundo verbo: nuevo movimiento
        verbo = w;
        conNumero = false;
        continue;
      }
      if (esVerbo(n)) verbo = w;
      if (empiezaConNumero(n)) conNumero = true;
      // "... y 2 cervezas a 20": el nuevo movimiento hereda el verbo
      if (esConector && verbo && conNumero && (n === "y" ? sigNum : sigNum && w.endsWith(","))) {
        if (n !== "y") actual.push(w.replace(/,$/, ""));
        segmentos.push([verbo]);
        conNumero = false;
        continue;
      }
      actual.push(w);
    }

    for (const seg of segmentos) {
      const t = seg.join(" ").replace(/\s+(y|e)$/i, "").trim();
      if (t) resultados.push(parsearMensaje(t));
    }
  }
  return resultados.length ? resultados : [{ tipo: "desconocido" }];
}

// Valida lo que devuelve la IA antes de usarlo (nunca confiar en el JSON a ciegas).
export function validarInterpretacion(obj) {
  if (!obj || typeof obj !== "object") return null;
  const texto = (v) => (typeof v === "string" ? v.slice(0, 80).trim() : "");
  const tipo = obj.tipo;
  if (tipo === "venta" || tipo === "gasto") {
    const monto = Number(obj.monto);
    if (!(monto > 0 && monto < 10_000_000)) return { tipo: "sinmonto", venta: tipo };
    return {
      tipo,
      monto: redondear(monto),
      detalle: texto(obj.detalle),
      proveedor: tipo === "gasto" ? texto(obj.proveedor) || null : null,
      metodo: ["efectivo", "tarjeta", "transferencia"].includes(obj.metodo) ? obj.metodo : null,
    };
  }
  if (tipo === "resumen") return { tipo, periodo: ["hoy", "ayer", "semana", "mes"].includes(obj.periodo) ? obj.periodo : "hoy" };
  if (["proveedores", "deshacer", "ayuda"].includes(tipo)) return { tipo };
  return null;
}
