# Monterroso Chat

Asistente de WhatsApp para restaurantes pequeños (Guatemala primero, luego EE. UU. hispano). El dueño le habla por texto, voz o foto y el asistente lleva ventas, gastos y proveedores, y manda un resumen cada noche. Sin app que instalar.

**Estado:** versión mínima en construcción. Hoy funciona el flujo **registrar ventas del día** (con confirmación) en un **simulador de chat web**. Todavía no hay integración con WhatsApp.

> No emite facturas ni declara impuestos. Solo lleva control interno. La factura electrónica FEL de la SAT y el IVA se validan con un contador antes de prometer nada.

## Probarlo ya (modo demo, sin servidor ni claves)

```bash
npm install
npm run dev
```

Abre el simulador: es un chat estilo WhatsApp con un restaurante inventado ("Comedor Doña Mari", datos falsos). Pruebe:

- `Hoy vendimos 4,850: 3,200 efectivo y 1,650 tarjeta` → el asistente confirma lo que entendió; con "sí" guarda y aparece en la tabla.
- `Ayer vendimos Q2,300, propinas 150`, `Efectivo 1800, tarjeta 950`.
- Un desglose que no cuadra (`vendimos 1000: 600 efectivo y 500 tarjeta`) hace que pregunte en vez de adivinar.

El modo demo usa un intérprete por reglas (sin IA) que corre en el navegador y guarda en `localStorage`.

## Con Supabase y Claude (modo real)

1. `supabase start` y `supabase db reset` (aplica `supabase/migrations`).
2. Copie `.env.example` a `.env.local` y ponga `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Cree datos de demo: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed:demo` (imprime el correo y una contraseña generada).
4. Secretos de la función (nunca en el repo): en local, `supabase/functions/.env` con `ANTHROPIC_API_KEY=…`; en producción, `supabase secrets set ANTHROPIC_API_KEY=…`.
5. `supabase functions serve assistant --env-file supabase/functions/.env` y `npm run dev`. Con las variables `VITE_*` puestas, el simulador pide iniciar sesión y habla con la función `assistant`.

El modelo por defecto es `claude-opus-5-5`; se cambia con el secreto `ANTHROPIC_MODEL`.

## Cómo está armado

```
src/shared/      Lógica pura (sin dependencias): montos, fechas, validación, flujo de confirmación, textos.
                 Corre igual en el navegador, en Node y en la Edge Function.
src/lib, components/, App.tsx   Simulador de chat y panel (React + Tailwind).
supabase/migrations/            Esquema con RLS estricta por negocio.
supabase/functions/assistant/   Edge Function: Claude lee el mensaje, el código decide.
supabase/tests/rls.sql          Pruebas de aislamiento entre negocios.
docs/                           Checklist de WhatsApp/Meta y decisiones pendientes.
```

Principios:

- **El modelo solo extrae datos; el código valida y decide.** Claude devuelve JSON con un esquema fijo; `buildDraft` revisa que el desglose cuadre con el total, que la fecha sea razonable y que los montos tengan sentido. Nada se guarda sin el "sí" del dueño, y un "sí" viejo (más de 6 horas) no guarda nada.
- **Dinero en centavos enteros** (`bigint`), nunca float.
- **Multi-país desde el inicio:** moneda, impuesto, idioma y zona horaria se guardan por negocio (`businesses`). "Hoy" y "ayer" se calculan en la zona horaria del negocio.
- **Privacidad:** RLS en todas las tablas por membresía; `anon` sin acceso; la función usa el JWT de la persona (la RLS aplica incluso si el código falla); no se registra el contenido de los mensajes en logs; las conversaciones son privadas de cada persona.

## Comandos

| | |
|---|---|
| `npm run dev` | Simulador y panel |
| `npm run lint` | oxlint |
| `npm run build` | `tsc -b` (app, scripts y función) + build de Vite |
| `npm test` | vitest |
| `npm run test:rls` | Migraciones + pruebas de RLS contra un Postgres vacío (`DATABASE_URL`) |

## Pendiente

Ver [docs/decisiones.md](docs/decisiones.md) (decisiones y lo que falta) y [docs/whatsapp-meta.md](docs/whatsapp-meta.md) (lo que hay que iniciar con Meta cuanto antes).
