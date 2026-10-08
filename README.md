# Monterroso Chat

Asistente de WhatsApp para restaurantes pequeños (Guatemala primero). El dueño le habla por texto, voz o foto y el asistente lleva ventas, gastos y proveedores, y manda un resumen cada noche.

Estado: en construcción (versión mínima).

## Uso

```
cp .env.example .env   # llena los valores de WhatsApp Cloud API
npm start              # webhook en :3000/webhook
npm test
```

Mensajes de texto que entiende por ahora: `vendí 250`, `gasto 100 pollo`, `compré 80 tomates a Don Pepe`, `resumen`.

## Pendiente

- Voz (transcripción) y fotos (facturas/recibos)
- Proveedores como entidad propia
- Resumen automático cada noche (hoy solo con `resumen`)
- Base de datos real (hoy un JSON en `data/`)
