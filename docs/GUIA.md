# Guía: conectar Monterroso Chat a WhatsApp

Tiempo estimado: 1 a 2 horas la primera vez. Los menús de Meta cambian de nombre de vez en cuando; si algo no está donde dice la guía, busca la palabra clave en el buscador de Meta for Developers.

## 0. Antes de empezar
- Una cuenta de Facebook y acceso a [developers.facebook.com](https://developers.facebook.com).
- Node.js 20 o más nuevo en tu computadora (`node -v`).
- El proyecto bajado: `git clone ... && cd Chatbot-Monterroso`.
- Prueba primero sin WhatsApp: `npm run chat`. Si te gusta cómo responde, sigue.

## 1. Crear la app en Meta
1. En Meta for Developers: **Mis apps → Crear app** → tipo **Empresa** (Business).
2. Dentro de la app, agrega el producto **WhatsApp**.
3. En **WhatsApp → Configuración de la API** (API Setup) verás:
   - Un **número de prueba** gratis de Meta.
   - Un **token de acceso temporal** (dura 24 horas; para producción hace falta uno permanente, paso 5).
   - El **ID del número de teléfono** (Phone number ID).
4. En ese mismo lugar, en "Para", **agrega tu número de WhatsApp** como destinatario de prueba y confirma el código que te llega. (Con el número de prueba puedes escribirle a hasta 5 números.)
5. En **Configuración de la app → Básica** copia el **Secreto de la app** (App secret).

## 2. Llenar el `.env`
```
cp .env.example .env
```
Edita `.env`:
```
WHATSAPP_VERIFY_TOKEN=una-palabra-secreta-que-inventes
WHATSAPP_APP_SECRET=<secreto de la app>
WHATSAPP_ACCESS_TOKEN=<token de acceso>
WHATSAPP_PHONE_NUMBER_ID=<ID del número>
NUMEROS_PERMITIDOS=502XXXXXXXX        # tu número, con 502 y sin + ni espacios
```
Opcionales: `OPENAI_API_KEY` (notas de voz) y `ANTHROPIC_API_KEY` (fotos de facturas y mensajes raros).

Revisa que todo esté bien:
```
npm run verificar -- --meta
```
Todo debe salir con ✅ (los ⚠️ son opcionales). `--meta` además comprueba contra Meta que el token y el número sean válidos.

## 3. Probar desde tu computadora
WhatsApp necesita una dirección pública con HTTPS para entregarte los mensajes. Para probar, usa un túnel:
```
npm start                       # en una terminal
npx ngrok http 3000             # en otra (o: cloudflared tunnel --url http://localhost:3000)
```
Te dará una dirección como `https://abcd1234.ngrok.app`.

En Meta: **WhatsApp → Configuración** (Configuration) → **Webhook** → Editar:
- **URL de devolución de llamada**: `https://abcd1234.ngrok.app/webhook`
- **Token de verificación**: el mismo `WHATSAPP_VERIFY_TOKEN` de tu `.env`
- Guarda. Meta llama a tu bot para verificar; si falla, revisa que el token coincida y que `npm start` siga corriendo.
- En **Campos del webhook**, suscríbete a **messages**.

Ahora escríbele "hola" al número de prueba desde tu WhatsApp. Deberías recibir la bienvenida.

## 4. Publicarlo para que no dependa de tu computadora
Necesitas un lugar donde el programa corra siempre, con HTTPS y **un disco que no se borre** (ahí vive `data/`; sin disco persistente pierdes todo al reiniciar).

Con Docker (sirve en casi cualquier servicio: Fly.io, Railway, Render, un VPS):
```
docker build -t monterroso-chat .
docker run -d --restart unless-stopped -p 3000:3000 \
  -v monterroso-data:/app/data --env-file .env monterroso-chat
```
En un servicio administrado, monta un volumen en `/app/data`, define las variables del `.env` en su panel y usa `/health` como comprobación de salud. Luego cambia la URL del webhook en Meta por la definitiva (`https://tu-dominio/webhook`).

Haz copia de seguridad de `data/diario.jsonl` de vez en cuando (es un archivo de texto; basta copiarlo).

## 5. Pasar a producción (token permanente y número propio)
- **Token permanente**: Meta Business Settings → **Usuarios del sistema** → crea uno → asígnale tu app → genera un token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Ese token va en `WHATSAPP_ACCESS_TOKEN` (el temporal caduca a las 24 h).
- **Número propio**: en WhatsApp → Configuración de la API agrega tu número de negocio (no puede estar ya registrado en la app normal de WhatsApp).
- **Verificación de empresa**: Meta la pide para quitar los límites de mensajes.

## 6. Cosas que debes saber
- **Ventana de 24 horas**: WhatsApp solo deja que el negocio escriba primero dentro de las 24 h siguientes al último mensaje del usuario. Si alguien no escribió hoy, el **resumen nocturno** puede ser rechazado (aparece en la consola con el error de Meta, por ejemplo código 131047). La solución es una **plantilla de mensaje** aprobada por Meta; todavía no está implementada en el bot.
- **Costos**: Meta cobra por conversaciones iniciadas por el negocio (según país); las respuestas dentro de la ventana de 24 h normalmente no. Whisper (voz) y Claude (fotos/mensajes raros) cobran por uso aparte: por eso conviene `NUMEROS_PERMITIDOS`.
- **Privacidad**: el archivo `data/` contiene números de teléfono y ventas de tus clientes. Protege el servidor y avísales qué guardas.
- **Un solo proceso**: no corras dos copias del bot a la vez apuntando a la misma carpeta `data/`.

## Si algo falla
| Síntoma | Qué revisar |
|---|---|
| Meta dice "no se pudo validar la URL" | El token de verificación no coincide, o el túnel/servidor no está encendido. Prueba abrir `https://tu-url/health` en el navegador: debe mostrar `{"ok":true,...}`. |
| Escribo y no responde | ¿Estás suscrito al campo **messages**? ¿Tu número está en "Para" (destinatarios de prueba) y en `NUMEROS_PERMITIDOS`? Mira la consola de `npm start`. |
| Responde "error de firma" / 401 en la consola | `WHATSAPP_APP_SECRET` equivocado. |
| Dejó de responder al día siguiente | El token temporal caducó (24 h). Usa el permanente (paso 5). |
| Perdí los datos al reiniciar | No hay disco persistente montado en `data/`. |
