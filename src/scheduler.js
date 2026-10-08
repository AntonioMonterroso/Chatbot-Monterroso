import { aLocal, diaLocal, rango } from "./tiempo.js";
import { armarResumenDe } from "./bot.js";

export function debeEnviar(ahora, ultimoDia, hora = 21) {
  return aLocal(ahora).getUTCHours() >= hora && diaLocal(ahora) !== ultimoDia;
}

// Manda el resumen del día a cada usuario a la hora que eligió (o la predeterminada), una vez al día.
// Los usuarios con hora -1 pidieron no recibirlo.
export async function enviarResumenes(store, enviar, ahora = new Date(), horaDefault = 21) {
  const hoy = diaLocal(ahora);
  for (const u of store.usuarios()) {
    const hora = store.config.get(u, "hora") ?? horaDefault;
    const clave = `ultimoResumen:${u}`;
    if (hora < 0 || !debeEnviar(ahora, store.meta.get(clave), hora)) continue;
    try {
      const r = rango("hoy", ahora);
      if (store.entre(u, r.desde, r.hasta).length) {
        await enviar(u, armarResumenDe(store, u, "hoy", ahora, `Cierre del día ${hoy}`));
      }
      store.meta.set(clave, hoy); // si el envío falla, se reintenta en el siguiente minuto
    } catch (e) {
      console.error(`Error enviando resumen a ${u}:`, e.message);
    }
  }
}

export function iniciarResumenNocturno({ store, enviar, hora = 21, cada = 60_000 }) {
  let enCurso = false;
  const timer = setInterval(async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      await enviarResumenes(store, enviar, new Date(), hora);
    } finally {
      enCurso = false;
    }
  }, cada);
  timer.unref();
  return () => clearInterval(timer);
}
