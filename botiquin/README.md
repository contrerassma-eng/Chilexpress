# Botiquín de casa

Inventario del botiquín familiar: escaneas la caja, en **modo Compra** suma stock y en
**modo Consumo** lo descuenta. Nada más. Se instala como app en Android y iPhone.

Reutiliza el motor de lectura de códigos del piloto de Chile Express que vive en la raíz
de este repo (formatos acotados + doble lectura antes de aceptar, para no leer basura),
pero acá el estado compartido vive en **Cloudflare D1** en vez de quedarse en el teléfono.

## Qué hace

- **Escanear**: EAN-13, EAN-8, UPC-A/E, Code-128 y **DataMatrix GS1**. Si la caja trae
  DataMatrix, la fecha de vencimiento se rellena sola (lee el AI 17 del código).
- **Compra**: pide nombre, cantidad y vencimiento. Si el código ya se escaneó antes, el
  nombre viene puesto y solo confirmas.
- **Consumo**: descuenta empezando por el lote que vence primero (FEFO). Si sacas 3 y en
  el lote más viejo hay 2, saca 2 de ese y 1 del siguiente.
- **Inventario**: buscador y filtros por *por vencer* (60 días), *vencidos* y *agotados*.
  Los agotados quedan guardados para que reconozca el código la próxima compra.
- **Historial**: quién agregó o sacó qué y cuándo.
- **Sin señal**: la app abre igual, los movimientos quedan en cola y suben solos cuando
  vuelve internet. Cada movimiento lleva un id único, así que reintentar nunca duplica stock.

Lo que **no** hace, a propósito: recetas, dosis, recordatorios, usuarios, fotos.

## Cómo se arma

| Pieza | Qué es |
|---|---|
| `src/` | La app (React + Vite, PWA instalable) |
| `worker/index.js` | La API sobre Cloudflare Workers |
| `migrations/0001_init.sql` | Tablas de D1 |
| `wrangler.toml` | Un solo Worker sirve la app y `/api/*` |

Tres tablas: `products` (código → nombre), `lots` (un lote por fecha de vencimiento) y
`movements` (bitácora + control de duplicados). El stock de un remedio es la suma de sus lotes.

## Puesta en marcha

La base D1 `botiquin` ya está creada y con las tablas aplicadas; su id ya está en
`wrangler.toml`. Falta el PIN y el despliegue:

```bash
cd botiquin
npm install
npx wrangler login

# PIN del hogar: el que van a escribir en el teléfono. Usa 6 dígitos o más.
npx wrangler secret put HOUSEHOLD_PIN

npm run deploy
```

Queda publicada en `https://botiquin.<tu-subdominio>.workers.dev`.

Sin el secreto `HOUSEHOLD_PIN` la API responde 503 a todo: nunca queda abierta por olvido.

### Para cambiar el PIN

`npx wrangler secret put HOUSEHOLD_PIN` de nuevo. Cada teléfono lo vuelve a pedir la
próxima vez que sincronice.

### Si alguna vez hay que recrear la base

```bash
npx wrangler d1 create botiquin          # copia el database_id a wrangler.toml
npm run db:init                          # aplica las tablas
```

## Instalarla en el teléfono

Abre la URL en el navegador y:

- **Android (Chrome)**: menú ⋮ → *Agregar a la pantalla principal*. También aparece el
  botón *Instalar en el teléfono* dentro del menú ⋮ de la app.
- **iPhone (Safari)**: botón Compartir → *Agregar a inicio*. Tiene que ser Safari; desde
  Chrome en iOS no se puede instalar.

Queda con ícono propio y a pantalla completa. La cámara necesita HTTPS: el dominio
`workers.dev` ya lo es.

## Desarrollo local

```bash
npm run dev:api   # Worker + D1 en el puerto 8787
npm run dev       # la app en 5173, con /api apuntando al Worker
```

`wrangler dev` usa una copia local de la base. Para trabajar contra la base real:
`npx wrangler dev --remote`.

La cámara no abre en `http://` salvo en `localhost`. Para probar desde el teléfono en la
red de la casa conviene desplegar directamente: es cosa de segundos.

## Pruebas

```bash
npm test          # logica pura: GS1, FEFO, cola offline, fechas (32 casos)

npm run dev:api   # en otra consola
npm run test:api  # la API real contra D1 local (23 casos)
```

## Costo

Todo cabe holgadamente en el plan gratis de Cloudflare (100 mil peticiones y 5 millones
de lecturas de D1 al día). Un botiquín de casa hace unas decenas de operaciones al mes.
