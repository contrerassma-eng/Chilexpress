# Inventario de casa

Escaneas la caja, en **modo Compra** suma stock y en **modo Consumo** lo descuenta.
Nada más. Se instala como app en Android y iPhone.

Reutiliza el motor de lectura de códigos del piloto de Chile Express que vive en la raíz
de este repo (formatos acotados + doble lectura antes de aceptar, para no leer basura),
pero acá el estado compartido vive en **Cloudflare D1** en vez de quedarse en el teléfono.

> La carpeta se sigue llamando `botiquin/` y el Worker también, porque así nació y
> cambiarlo movería la dirección que ya está instalada en los teléfonos.

## Las cuatro zonas

No son cuatro listas iguales: cada una avisa con la anticipación que tiene sentido ahí y
pide la fecha como viene impresa en ese tipo de producto.

| Zona | Avisa | La fecha se pide como |
|---|---|---|
| 💊 Botiquín | 60 días antes | mes / año (*VENC 05/2027*) |
| 🥫 Despensa | 30 días antes | mes / año |
| 🧊 Refrigerador | 5 días antes | día exacto |
| 🧽 Aseo | 30 días antes | sin fecha |

La zona vive en el producto, no en el lote: un remedio o un tarro de café está en un solo
lugar. Se puede mover después desde su ficha. Todo lo que existía antes de las zonas
quedó en el botiquín.

## Qué hace

- **Escanear**: EAN-13, EAN-8, UPC-A/E, Code-128 y **DataMatrix GS1**. Si la caja trae
  DataMatrix, la fecha de vencimiento se rellena sola (lee el AI 17 del código).
- **Compra**: pide nombre, zona, cantidad y vencimiento. Si el código ya se escaneó antes,
  nombre y zona vienen puestos y solo confirmas.
- **Consumo**: descuenta empezando por el lote que vence primero (FEFO). Si sacas 3 y en
  el lote más viejo hay 2, saca 2 de ese y 1 del siguiente.
- **Inventario**: por zona o todo junto, con buscador y filtros de *por vencer*,
  *vencidos* y *por comprar*. Lo agotado queda guardado, así reconoce el código en la
  próxima compra y de paso sirve de lista de compras.
- **Inventario físico**: cuenta lo que hay de verdad. Lo contado reemplaza lo registrado
  (si un producto no aparece en el conteo, queda en cero) y al terminar muestra el
  descuadre: qué sobra, qué falta y qué no apareció. Se puede contar una zona o la casa
  entera, en varias sentadas, y queda guardado con su fecha y todas las diferencias.
- **Historial**: quién agregó o sacó qué, cuándo y de qué zona, más los inventarios
  hechos con su descuadre.
- **Exportar CSV**: el inventario actual, los movimientos y cualquier inventario físico.
- **Sin señal**: la app abre igual, los movimientos quedan en cola y suben solos cuando
  vuelve internet. Cada movimiento lleva un id único, así que reintentar nunca duplica stock.
- **Sin trámite de entrada**: se abre y ya está. Si se le pone PIN (ver más abajo), lo
  pide una sola vez por teléfono.

Lo que **no** hace, a propósito: recetas, dosis, recordatorios, usuarios, fotos.

## Cómo se arma

| Pieza | Qué es |
|---|---|
| `src/` | La app (React + Vite, PWA instalable) |
| `worker/index.js` | La API sobre Cloudflare Workers |
| `migrations/` | Esquema de D1, ya aplicado en la base |
| `wrangler.toml` | Un solo Worker sirve la app y `/api/*` |

Tablas: `products` (código → nombre y zona), `lots` (un lote por fecha de vencimiento),
`movements` (bitácora + control de duplicados) y `stocktakes` / `stocktake_lines` (las
actas de los inventarios físicos con todas sus diferencias). El stock de un producto es
la suma de sus lotes.

Para recrear la base desde cero hay que aplicar las migraciones en orden:

```bash
npx wrangler d1 execute botiquin --remote --file=./migrations/0001_init.sql
npx wrangler d1 execute botiquin --remote --file=./migrations/0002_zonas.sql
npx wrangler d1 execute botiquin --remote --file=./migrations/0003_inventarios.sql
```

## Puesta en marcha

Ya está desplegada en **https://botiquin.contreras-sma.workers.dev** y la base D1
`botiquin` está creada con sus tablas (el id está en `wrangler.toml`).

Cada push a `botiquin/**` la vuelve a desplegar solo, con el workflow
`.github/workflows/deploy-botiquin.yml`, que reutiliza el secreto
`CLOUDFLARE_API_TOKEN` del repo. A mano sería:

```bash
cd botiquin && npm install
npx wrangler login
npm run deploy
```

## Acceso

Hoy el botiquín está **abierto**: cualquiera con la dirección puede ver y modificar el
inventario. Es lo más cómodo para la casa, y la dirección no está publicada en ninguna
parte, pero tampoco es secreta: los dominios `workers.dev` se pueden rastrear.

Para ponerle un PIN, en cualquier momento y sin tocar código:

```bash
npx wrangler secret put HOUSEHOLD_PIN     # 6 dígitos o más
```

Desde ese momento la API exige el PIN, la app lo pide una vez por teléfono y lo guarda.
Para cambiarlo, el mismo comando otra vez. Para volver a abrirlo:

```bash
npx wrangler secret delete HOUSEHOLD_PIN
```

También se puede hacer desde el panel de Cloudflare (Workers → `botiquin` → Settings →
Variables) o dejando el secreto `HOUSEHOLD_PIN` en el repo de GitHub, que el workflow lo
sube en cada despliegue.

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
npm test          # logica pura: GS1, verificador, FEFO, zonas, conteo, CSV (59 casos)

npm run dev:api   # en otra consola
npm run test:api  # la API real contra D1 local
```

`test:api` detecta si el botiquín está abierto o con PIN y comprueba lo que corresponde
a ese modo. También sirve contra el despliegue de verdad:

```bash
BASE=https://botiquin.contreras-sma.workers.dev npm run test:api
```

## Costo

Todo cabe holgadamente en el plan gratis de Cloudflare (100 mil peticiones y 5 millones
de lecturas de D1 al día). Un botiquín de casa hace unas decenas de operaciones al mes.
