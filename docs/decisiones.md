# Decisiones y pendientes

## Decisiones tomadas en esta etapa

- **Un solo código para simulador y producción:** `src/shared` no tiene dependencias y lo usan el navegador (modo demo, intérprete por reglas) y la Edge Function (intérprete con Claude).
- **Claude solo extrae, el código decide:** salida estructurada con esquema JSON + validación propia + confirmación obligatoria.
- **Modelo:** `claude-opus-5-5` por defecto (lo que recomienda la guía de la API), configurable con `ANTHROPIC_MODEL`. Esfuerzo `low`: es extracción simple.
- **Propinas aparte:** se guardan en `tips_cents` y no suman a `total_cents`.
- **Venta sin desglose:** si solo dicen "vendimos 2,300", queda en `other_cents` (transferencias, otros o sin desglosar).
- **Varias ventas el mismo día se suman** (almuerzo y cena); el asistente avisa si ya había ventas en esa fecha, para evitar duplicados por error.
- **Sin registro abierto** en Auth (`enable_signup = false`): los usuarios se crean a mano o con el seed.
- **Tono:** respetuoso y neutro ("Anoté…", "Mándeme…", "usted").

## Decisiones que necesito de ti

1. **Modelo y costo:** ¿se queda `claude-opus-5-5` o se prueba uno más barato (Sonnet 5.5 o Haiku 5.5) midiendo con mensajes reales? Para extraer 5 números de un mensaje corto, un modelo menor probablemente alcanza; conviene decidirlo con datos, no a ciegas.
2. **Voz a texto:** Claude no transcribe audio. ¿Qué servicio usamos para las notas de voz de WhatsApp (y dónde se procesan, por privacidad)?
3. **Meta directo o con un BSP** (ver `docs/whatsapp-meta.md`), y **quién es la entidad legal** de la cuenta de Meta.
4. **Fallback ante rechazos del modelo:** hoy un rechazo de seguridad se responde con "no pude procesar ese mensaje". La API ofrece un fallback automático a otro modelo; no lo activé porque agrega complejidad y es improbable en este caso de uso.
5. **Tuteo/voseo vs. "usted"** para Guatemala, y si el asistente debe tener nombre propio (hoy "Monterroso Chat" es provisional).
6. **Deshacer:** hoy una venta ya confirmada solo la corrige el dueño del negocio desde la base de datos. ¿Agregamos "deshacer lo último" por chat?
7. **Retención de datos:** ¿cuánto tiempo se guardan los mensajes (`messages`)? Contienen cifras de negocio.

## Falta (en el orden que sugiero)

1. Gastos con foto de factura (visión de Claude, bucket privado) y proveedores con saldo.
2. Preguntas ("¿cuánto vendí esta semana?", "¿cuánto le debo a la carnicería?") con consultas a la base, no con cálculos del modelo.
3. Resumen nocturno programado (pg_cron o Supabase scheduled functions) + plantilla de WhatsApp.
4. Webhook de WhatsApp, identificación por teléfono, idempotencia y límites de uso por negocio (control de costo y abuso).
5. Voz.
6. Historial del chat en el simulador al recargar (hoy el chat visible no se guarda; la confirmación pendiente sí vive en el servidor).
7. Pruebas de la función contra Supabase real (hoy: `deno check` + pruebas con el SDK simulado; no hay prueba de extremo a extremo).
8. Antes de usar con un cliente real: revisión de privacidad/seguridad y términos de uso; para EE. UU., revisar impuestos por estado con un contador.
