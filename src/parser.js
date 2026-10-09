// Interpreta mensajes en español, tolerando faltas de ortografía y escritura informal:
//   "bendi 3 pollos a 45", "gaste en pollo 100", "compre tomates a Don Pepe 80",
//   "vendí doscientos cincuenta", "rresumen de la semana", "me equivoque"
import { sinAcentos, buscar, valorPalabraNumero, numeroDePalabras } from "./texto.js";
import { aLocal } from "./tiempo.js";

const tabla = (...palabras) => new Map(palabras.map((p) => [p, true]));
const conValor = (valor, ...palabras) => palabras.map((p) => [p, valor]);

const VERBOS = new Map([
  ...conValor("venta", "vendi", "vendimos", "vendio", "vendieron", "vendo", "venta", "ingreso", "cobre", "cobramos", "cobro", "pagaron", "facture"),
  ...conValor("fiado", "fie", "fio", "fiamos", "fiado", "fiada", "fiar"),
  ...conValor("gasto", "gaste", "gasto", "gastamos", "compre", "compra", "compro", "compramos", "pague", "pago", "pagamos", "saque"),
]);
const ABONOS = tabla("abono", "abona", "abonaron", "abonar", "abonamos");
const PAGOS_CLIENTE = tabla("pago", "paga", "pagan", "pagaron");
const DEUDAS = tabla("fiado", "fiada", "debe", "deben", "debo", "debemos", "deuda", "deudas", "fiados", "pendientes", "cuentas");
const CREDITO = tabla("fiado", "fiada", "credito", "fiar");
const META = tabla("meta", "objetivo");
const NEGACION = /^(no|sin|quita|quitar|elimina|borra|olvida)$/;
const SUSTANTIVOS = tabla("ventas", "gastos", "compras");
const COMANDOS = new Map([
  ...conValor("resumen", "resumen", "cierre", "reporte", "informe", "balance", "cuanto", "cuantos"),
  ...conValor("proveedores", "proveedores", "proveedor"),
  ...conValor("deshacer", "deshacer", "borrar", "borra", "anular", "anula", "cancelar", "cancela", "elimina", "eliminar", "equivoque"),
  ...conValor("corregir", "corrige", "corregir", "correccion", "cambia", "cambiar", "modifica", "modificar", "era"),
  ...conValor("equipo", "equipo", "empleados", "empleado", "ayudantes", "personal"),
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
const PERIODO_EXACTO = tabla("hoy", "ayer", "anteayer", "antier");
const DIAS_SEMANA = new Map([["domingo", 0], ["lunes", 1], ["martes", 2], ["miercoles", 3], ["jueves", 4], ["viernes", 5], ["sabado", 6]]);
const CAJA = tabla("caja", "cuadre", "arqueo");
const FONDO = tabla("fondo", "inicial", "base", "apertura", "abri", "abrimos", "arranque");
const EXPORTAR = tabla("excel", "csv", "exportar", "exporta", "exportame", "descargar", "descarga", "planilla");

// "ayer", "anteayer", "el lunes": cuántos días atrás y qué palabras lo dicen.
// Un día de la semana es el más reciente que ya pasó; si es el mismo día de hoy, se toma como hoy.
function diasAtras(tokens, ahora) {
  const hoy = aLocal(ahora).getUTCDay();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (esNumero(t)) continue;
    let hace;
    if (t.n === "ayer") hace = 1;
    else if (t.n === "anteayer" || t.n === "antier") hace = 2;
    else {
      const d = buscar(t.n, DIAS_SEMANA);
      if (d !== undefined) hace = (hoy - d + 7) % 7;
    }
    if (hace === undefined) continue;
    const idx = [i];
    if (/^(el|del|este|pasado)$/.test(tokens[i - 1]?.n ?? "")) idx.push(i - 1);
    return { hace, idx, ayer: t.n === "ayer" };
  }
  return null;
}

// Período de un resumen: ayer / semana / mes / hoy, o un día puntual ("el lunes").
function periodoDe(tokens, dia) {
  if (dia && !dia.ayer) return { periodo: "dia", hace: dia.hace };
  return { periodo: tokens.map((t) => buscar(t.n, PERIODOS)).find(Boolean) ?? "hoy" };
}
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

// ¿Hay un verbo de venta/gasto/fiado entre las primeras palabras?
function hayVerbo(tokens) {
  return tokens
    .slice(0, 5)
    .some((t) => !esNumero(t) && !buscar(t.n, SUSTANTIVOS, false) && !!buscar(t.n, VERBOS));
}

// "agrega a 5025555 1234", "quita el empleado 55551234"
function parsearEquipo(texto) {
  const n = sinAcentos(texto.toLowerCase());
  const tel = n.match(/(?:\+?\d[\s-]?){8,13}/);
  if (!tel) return null;
  let digitos = tel[0].replace(/\D/g, "");
  if (digitos.length < 8) return null;
  if (digitos.length === 8) digitos = `502${digitos}`; // número local de Guatemala
  if (/(agreg|anad|inclu|suma|da(le)? acceso|autoriza)/.test(n)) return { tipo: "agregarEmpleado", telefono: digitos };
  if (/(quit|elimin|saca|borra|remuev|desactiva)/.test(n)) return { tipo: "quitarEmpleado", telefono: digitos };
  return null;
}

// "resumen a las 8", "mándame el cierre a las 9 pm", "no quiero resumen"
function parsearHora(texto) {
  const n = sinAcentos(texto.toLowerCase());
  if (!/\d/.test(n) && /\b(no|sin|apaga\w*|desactiva\w*|quita\w*|cancela\w*)\b.*\bresumen/.test(n)) return { tipo: "hora", hora: null };
  if (!/(resumen|avis|mand|envi|cierre|reporte)/.test(n)) return null;
  const m = n.match(/\blas?\s+(\d{1,2})(?::\d{2})?\s*(am|pm|de la (?:manana|tarde|noche))?/);
  if (!m || Number(m[1]) > 23) return null;
  let h = Number(m[1]);
  const suf = m[2];
  const manana = suf === "am" || suf === "de la manana";
  if (suf && !manana && h < 12) h += 12;
  else if (!suf && h >= 1 && h <= 11) h += 12; // sin am/pm se asume noche: es un resumen de cierre
  else if (manana && h === 12) h = 0;
  return { tipo: "hora", hora: h };
}

// "Marta me pagó 50", "abono 50 Marta", "me abonó Marta 50"
function detectarAbono(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (esNumero(t)) continue;
    const esAbono = !!buscar(t.n, ABONOS);
    const mePago = t.n === "me" && tokens[i + 1] && !esNumero(tokens[i + 1]) && !!buscar(tokens[i + 1].n, PAGOS_CLIENTE, false);
    if (!esAbono && !mePago) continue;

    const verbo = mePago ? [i, i + 1] : [i];
    const numeros = tokens.filter(esNumero);
    if (!numeros.length || !(numeros[0].valor > 0)) return { tipo: "sinmonto", venta: "abono" };
    const ignorar = new Set(["a", "de", "del", "la", "el", "su", "cuenta", "fiado", "fiada", "hoy", "ayer", "me", "ya", "un", "una", "y", "por", "en"]);
    const persona = tokens
      .filter((x, j) => !esNumero(x) && !verbo.includes(j) && !ignorar.has(x.n) && !buscar(x.n, MONEDA))
      .map((x) => x.o)
      .join(" ");
    if (!persona) return { tipo: "sinpersona", accion: "abono" };
    return { tipo: "abono", direccion: "cobrar", persona, monto: redondear(numeros[0].valor) };
  }
  return null;
}

export function parsearMensaje(texto, ahora = new Date()) {
  const tokens = tokenizar(texto.replace(/antes\s+de\s+ayer/gi, "anteayer"));
  if (!tokens.length) return { tipo: "desconocido" };

  const equipo = parsearEquipo(texto);
  if (equipo) return equipo;
  const hora = parsearHora(texto);
  if (hora) return hora;

  const hayNumero = tokens.some(esNumero);
  // "quién me debe", "fiados", "deudas"
  if (!hayNumero && tokens.some((t) => buscar(t.n, DEUDAS, false))) return { tipo: "deudas" };
  // "meta 1000", "sin meta", "cuánto falta para la meta"
  if (tokens.some((t) => !esNumero(t) && buscar(t.n, META, false))) {
    const nums = tokens.filter(esNumero);
    if (nums.length && nums[0].valor > 0) return { tipo: "meta", monto: redondear(nums[0].valor) };
    if (tokens.some((t) => NEGACION.test(t.n))) return { tipo: "meta", monto: null };
    return { tipo: "resumen", periodo: "hoy" };
  }
  if (!hayNumero && tokens.some((t) => !esNumero(t) && buscar(t.n, EXPORTAR, false))) {
    const exp = tokens.map((t) => buscar(t.n, PERIODOS)).find(Boolean);
    return { tipo: "exportar", periodo: exp === "hoy" || exp === "ayer" || exp === "semana" ? exp : "mes" };
  }
  const abono = detectarAbono(tokens);
  if (abono) return abono;

  // "caja 850", "tengo 850 en caja", "cierre de caja", "caja inicial 200".
  // Si hay un verbo ("compré una caja de refresco") es un movimiento, no la caja.
  if (tokens.some((t) => !esNumero(t) && (buscar(t.n, CAJA, false) || t.n === "fondo")) && !hayVerbo(tokens)) {
    const monto = tokens.find(esNumero)?.valor;
    if (tokens.some((t) => !esNumero(t) && buscar(t.n, FONDO, false))) {
      return monto > 0 ? { tipo: "fondo", monto: redondear(monto) } : { tipo: "sinmonto", venta: "fondo" };
    }
    return { tipo: "caja", monto: monto >= 0 ? redondear(monto) : null };
  }

  const primero = tokens.findIndex((t) => !esNumero(t) && !RELLENO.has(t.n));
  const cmd = primero >= 0 ? buscar(tokens[primero].n, COMANDOS) : undefined;
  const dia = diasAtras(tokens, ahora);
  const per = periodoDe(tokens, dia);

  // 1. Comandos claros: resumen, proveedores, deshacer
  if (cmd === "resumen") return { tipo: "resumen", ...per };
  if (cmd === "proveedores") return { tipo: "proveedores" };
  if (cmd === "deshacer") return { tipo: "deshacer" };
  if (cmd === "ultimos") return { tipo: "ultimos" };
  if (cmd === "equipo") return { tipo: "equipo" };
  if (cmd === "corregir") {
    const numeros = tokens.filter(esNumero);
    return numeros.length && numeros.at(-1).valor > 0
      ? { tipo: "corregir", monto: redondear(numeros.at(-1).valor) }
      : { tipo: "sinmonto", venta: "corregir" };
  }
  if (tokens.some((t) => /^equivoque$/.test(t.n))) return { tipo: "deshacer" };

  // 2. Venta o gasto: el verbo puede estar en las primeras palabras
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
    if (tokens.length <= 4 && tokens.some((t) => buscar(t.n, SUSTANTIVOS))) return { tipo: "resumen", ...per };
    const p = primero >= 0 ? buscar(tokens[primero].n, PERIODOS) : undefined;
    if (p || (dia && !hayNumero)) return { tipo: "resumen", ...per };
    if (primero >= 0 && buscar(tokens[primero].n, AYUDA)) return { tipo: "ayuda" };
    return { tipo: "desconocido" };
  }

  const usados = new Set([iVerbo]);
  // Lo que va antes del verbo es preámbulo ("anota", "ya", "hoy"): no es parte del detalle
  tokens.forEach((t, i) => {
    if (i < iVerbo && !esNumero(t)) usados.add(i);
  });
  const resto = () => tokens.map((t, i) => ({ ...t, i })).filter((t) => !usados.has(t.i));

  // Crédito / fiado: "vendí 100 fiado a Marta", "compré 500 a Don Pepe al crédito"
  let credito = tipo === "fiado";
  for (const t of resto()) {
    if (esNumero(t) || !buscar(t.n, CREDITO, false)) continue;
    credito = true;
    usados.add(t.i);
    const ant = tokens[t.i - 1]?.n;
    if (ant && /^(al|a|en|de)$/.test(ant)) usados.add(t.i - 1);
  }
  const fiado = credito && (tipo === "fiado" || tipo === "venta");
  if (tipo === "fiado") tipo = "venta";

  // "hoy"/"ayer"/"el lunes" dentro de una venta o gasto dicen la fecha; no son parte del detalle
  for (const t of resto()) if (!esNumero(t) && PERIODO_EXACTO.has(t.n)) usados.add(t.i);
  if (dia) for (const i of dia.idx) usados.add(i);

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
  if (!(monto > 0)) return { tipo: "sinmonto", venta: tipo, ...(fiado && { fiado: true }) };

  // Proveedor ("... a Don Pepe") en gastos, o cliente en un fiado
  let proveedor = null;
  let persona = null;
  let restantes = resto();
  if (tipo === "gasto" || fiado) {
    const ia = restantes.map((t) => t.n).lastIndexOf("a");
    if (ia >= 0 && restantes[ia + 1] && !esNumero(restantes[ia + 1])) {
      const nombre = restantes.slice(ia + 1).map((t) => t.o).join(" ");
      if (fiado) persona = nombre;
      else proveedor = nombre;
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

  if (fiado) {
    // "fiado 100 Marta": sin "a", el nombre queda en el detalle
    if (!persona && detalle && !/\d/.test(detalle) && detalle.split(" ").length <= 3) {
      persona = detalle;
      detalle = "";
    }
    if (!persona) return { tipo: "sinpersona", accion: "fiar" };
    return { tipo: "venta", monto, detalle, proveedor: null, metodo: "fiado", persona, ...(dia && { hace: dia.hace }) };
  }
  return { tipo, monto, detalle, proveedor, metodo, ...(credito && tipo === "gasto" && { credito: true }), ...(dia && { hace: dia.hace }) };
}

// "vendí 100 y gasté 50", "vendí 3 pollos a 45 y 2 cervezas a 20", varias líneas...
// Devuelve una lista con un resultado por cada movimiento que encuentre.
export function parsearVarios(texto, ahora = new Date()) {
  const esVerbo = (n) => !buscar(n, SUSTANTIVOS, false) && !/^fiad[oa]$/.test(n) && !!buscar(n, VERBOS);
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
      const t = seg.join(" ").replace(/(\s+(y|e|le|les|me|se|ya))+$/i, "").trim();
      if (t) resultados.push(parsearMensaje(t, ahora));
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
