# Monterroso Chat

Asistente de WhatsApp para restaurantes pequeños (Guatemala primero). El dueño le habla por texto, voz o foto y el asistente lleva ventas, gastos y proveedores, y manda un resumen cada noche.

Estado: en construcción (versión mínima).

## Qué hace

- **Texto** (tolera faltas de ortografía, mayúsculas y jerga: `bendi 250`, `gaste cien en cebolla`, `vendi 2k`, `ayer vendi 500`): `vendí 250` · `vendí 3 pollos a 45` · `vendí 500 con tarjeta` · `gasté 100 en pollo` · `compré 80 tomates a Don Pepe` · `pagué 500 a Don Pepe`
- **Varias cosas a la vez**: `vendí 100 y gasté 40 en hielo`, `vendí 3 pollos a 45 y 2 cervezas a 20`, o una por línea
- **Reportes**: `resumen` · `ayer` · `semana` · `mes` · `proveedores` · `últimos`. Comparan con el período anterior (▲/▼), la semana y el mes muestran mejor día y promedio, y avisan si se gastó más de lo vendido
- **Fiado**: `le fié 100 a Marta`, `Marta me pagó 50`, `quién me debe`. El fiado cuenta como venta y el cobro no se cuenta dos veces
- **Crédito con proveedores**: `compré 500 a Don Pepe al crédito`; luego `pagué 200 a Don Pepe` descuenta la deuda en vez de duplicar el gasto. `debo` muestra lo que debes
- **Hora del resumen**: cada quien la elige con `resumen a las 8` (o `no quiero resumen`)
- **Meta del día**: `meta 1000` y el resumen muestra el avance (o 🎉 al cumplirla); `sin meta` la quita
- **Más información en el resumen**: gastos por categoría (carnes, verduras, gas...) y lo más vendido
- **Equipo**: `agrega a 5555 1234` deja que un empleado anote ventas y gastos en tu negocio. El empleado no ve reportes ni deudas, y `deshacer` solo borra lo suyo. `equipo` lista, `quita a 5555 1234` elimina
- **Corregir**: `corrige 120` cambia el monto del último movimiento
- **Errores**: `deshacer` borra lo último que anotó ese usuario
- **Respaldo de IA**: si el bot no entiende un mensaje, se lo pregunta a Claude (necesita `ANTHROPIC_API_KEY`); la respuesta se valida antes de anotar nada
- **Nota de voz**: se transcribe con Whisper y se trata como texto (necesita `OPENAI_API_KEY`)
- **Foto de factura**: Claude lee total, comercio y detalle y anota el gasto (necesita `ANTHROPIC_API_KEY`)
- **Resumen nocturno**: cada día a la hora que cada usuario elige (por defecto `RESUMEN_HORA`, hora de Guatemala), a quien tuvo movimientos

Sin las llaves de voz/foto, el bot avisa al usuario que escriba el mensaje.

## Uso

```
cp .env.example .env   # llena los valores de WhatsApp Cloud API
npm start              # webhook en :3000/webhook
npm run chat           # probar por terminal, sin WhatsApp
npm test
```

## Pendiente

- Probar voz, fotos y envío real contra WhatsApp (hoy cubiertos solo con pruebas simuladas)
- Mensajes de plantilla: WhatsApp solo deja escribir primero al usuario dentro de 24 h de su último mensaje; para el resumen nocturno fuera de esa ventana hace falta una plantilla aprobada por Meta
- Base de datos real (hoy un JSON en `data/`)
- Varios restaurantes / varios empleados por restaurante
