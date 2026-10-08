// Utilidades para entender español escrito rápido y con faltas de ortografía.

export const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Clave fonética: palabras que suenan igual quedan iguales (vendí/bendi, haste/aste, gaste/gazte...).
export function clave(palabra) {
  return sinAcentos(palabra.toLowerCase())
    .replace(/qu/g, "k")
    .replace(/c(?=[ei])/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/gu?(?=[ei])/g, "j") // pague/page, guiso/giso: se confunden al escribir
    .replace(/z/g, "s")
    .replace(/v/g, "b")
    .replace(/h/g, "")
    .replace(/ll/g, "y")
    .replace(/(.)\1+/g, "$1");
}

export function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = temp;
    }
  }
  return fila[b.length];
}

// Cuántos errores toleramos según el largo: las palabras cortas deben ser exactas.
const tolerancia = (largo) => (largo <= 4 ? 0 : largo <= 6 ? 1 : 2);

// Busca `palabra` en una tabla {palabra: valor}; tolera errores si fuzzy = true.
export function buscar(palabra, tabla, fuzzy = true) {
  const k = clave(palabra);
  let mejor;
  let mejorDist = Infinity;
  for (const [p, valor] of tabla) {
    const kp = clave(p);
    const d = k === kp ? 0 : fuzzy ? distancia(k, kp) : Infinity;
    if (d < mejorDist && d <= (d === 0 ? 0 : tolerancia(Math.max(k.length, kp.length)))) {
      mejor = valor;
      mejorDist = d;
    }
  }
  return mejor;
}

// ---- Números escritos con letras ----
const UNIDADES = {
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};
const PALABRAS_NUM = new Map([...Object.entries(UNIDADES), ["mil", 1000]]);

export function valorPalabraNumero(palabra) {
  // Las palabras cortas (dos, tres, mil...) solo cuentan si están bien escritas (en sonido).
  return buscar(palabra, PALABRAS_NUM, palabra.length >= 7);
}

// Convierte una lista de palabras numéricas ("dos mil quinientos") en un número.
export function numeroDePalabras(palabras) {
  let total = 0;
  let actual = 0;
  for (const p of palabras) {
    const v = valorPalabraNumero(p);
    if (v === 1000) {
      total += (actual || 1) * 1000;
      actual = 0;
    } else if (v) actual += v;
  }
  return total + actual;
}

// ---- Nombres de personas ("Doña Marta López" y "marta" son la misma cuenta) ----
const TITULOS = new Set(["don", "dona", "sr", "sra", "senor", "senora", "doctor", "dr", "dra", "licenciado", "lic"]);

export function clavePersona(nombre) {
  const partes = sinAcentos(nombre.toLowerCase())
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !TITULOS.has(p));
  return clave(partes[0] ?? nombre);
}
