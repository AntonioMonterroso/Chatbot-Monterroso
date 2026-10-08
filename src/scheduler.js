import { aLocal, diaLocal, rango } from "./tiempo.js";
import { armarResumen } from "./summary.js";

export function debeEnviar(ahora, ultimoDia, hora = 21) {
  return aLocal(ahora).getUTCHours() >= hora && diaLocal(ahora) !== ultimoDia;
}

// Manda el resumen del día a cada usuario con movimientos, una vez al día.
export async function enviarResumenes(store, enviar, ahora = new Date()) {
  const r = rango("hoy", ahora);
  for (const u of store.usuarios()) {
    const movs = store.entre(u, r.desde, r.hasta);
    if (movs.length) await enviar(u, armarResumen(movs, `Cierre del día ${r.desde}`));
  }
  store.meta.set("ultimoResumen", r.desde);
}

export function iniciarResumenNocturno({ store, enviar, hora = 21, cada = 60_000 }) {
  const timer = setInterval(() => {
    const ahora = new Date();
    if (debeEnviar(ahora, store.meta.get("ultimoResumen"), hora)) {
      enviarResumenes(store, enviar, ahora).catch((e) => console.error("Error en resumen nocturno:", e));
    }
  }, cada);
  timer.unref();
  return () => clearInterval(timer);
}
