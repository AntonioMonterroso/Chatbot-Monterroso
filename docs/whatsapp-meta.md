# WhatsApp Business: qué iniciar en paralelo

La verificación con Meta es lo más lento de todo el proyecto y no depende del código. Conviene arrancarla ya. Los pasos y los tiempos cambian: **validar cada punto con la documentación vigente de Meta** antes de comprometer fechas.

## Para iniciar esta semana

1. **Portafolio de negocio en Meta (Meta Business Suite / Business Manager)** a nombre de la empresa que opera el producto, con datos legales completos.
2. **Verificación del negocio** dentro de ese portafolio (documentos legales de la empresa, dominio y datos de contacto coherentes). Suele ser lo que más tarda; sin ella los límites de mensajería son bajos.
3. **App en Meta for Developers** con el producto *WhatsApp* y una cuenta de WhatsApp Business (WABA) asociada.
4. **Número de teléfono dedicado** para el asistente. No puede estar en uso en la app normal de WhatsApp (o hay que migrarlo). Definir si será un número de Guatemala (+502) y otro de EE. UU. después.
5. **Nombre para mostrar** del número: pasa por aprobación; evitar nombres que parezcan de otra marca.
6. **Método de pago** en la WABA (Meta cobra por conversación/mensaje según categoría y país).

## Lo que el diseño ya supone

- **Mensajes iniciados por el negocio** (el resumen nocturno) caen fuera de la ventana de 24 horas desde el último mensaje del dueño, así que requieren una **plantilla aprobada** (categoría utilidad). Hay que redactarla y mandarla a aprobación desde ahora. Alternativa de respaldo: que el resumen salga como respuesta si el dueño escribió en las últimas 24 horas.
- **Webhook HTTPS** (otra Edge Function) con token de verificación y **validación de la firma** `X-Hub-Signature-256` con el secreto de la app. Sin firma válida, descartar.
- **Idempotencia:** Meta reintenta entregas. `messages.external_id` (único por conversación) ya existe para ignorar duplicados.
- **Identidad:** el número del remitente se busca en `profiles.phone_e164` → membresía → negocio. Un número desconocido recibe un mensaje de "no te tengo registrado" y nada más.
- **Notas de voz:** llegan como un id de medio (audio ogg/opus) que hay que descargar con el token de acceso. **Claude no transcribe audio**: hace falta un servicio de voz a texto (decisión pendiente) y luego el texto entra al mismo flujo que hoy usa el simulador.
- **Fotos de facturas:** también llegan como id de medio; se descargan, se guardan en un bucket privado de Storage y se leen con visión de Claude (flujo de gastos, siguiente etapa).

## Alternativa

Un proveedor de soluciones (BSP) intermedio puede acelerar el alta y la verificación a cambio de costo y dependencia. Es una decisión de negocio; ver `docs/decisiones.md`.
