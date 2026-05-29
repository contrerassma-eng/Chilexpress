# Precios de Supermercado

PWA para **comparar precios de supermercado por ciudad** a partir de las boletas
que suben los usuarios.

> Reutiliza el esqueleto de la antigua app de paquetes "Chile Express"
> (React + Vite + PWA + deploy a GitHub Pages), que queda archivada.

## Qué hace

- **Subir boleta**: el usuario sube la foto de su boleta (opcional, como
  respaldo) y registra los productos con su precio, supermercado y ciudad.
- **Precio vigente**: para cada producto en cada supermercado se conserva el
  precio con la **última fecha de actualización**.
- **Comparación por ciudad**: filtro por ciudad y, dentro de ella, cada producto
  muestra el precio de cada supermercado con el más barato destacado.
- **Ranking de mayores diferencias**: ordena los productos por el mayor ahorro
  potencial (diferencia entre el supermercado más caro y el más barato).

## Backend compartido (Cloudflare)

La comparación real entre usuarios usa un **Cloudflare Worker + base de datos
D1** (SQLite gestionado). Ya están creados:

- **D1** `precios-super` (`database_id` en `wrangler.toml`) con la tabla
  `entries` ya migrada.
- **Worker** `precios-super-api` (código en `workers/api.js`) con las rutas
  `GET/POST/DELETE /entries`.

### Desplegar el Worker (una sola vez)

El MCP no despliega Workers, así que este paso se hace desde tu terminal:

```bash
npx wrangler login        # si no lo has hecho
npx wrangler deploy       # usa wrangler.toml (ya apunta al D1 correcto)
```

Wrangler imprime la URL pública del Worker, p. ej.
`https://precios-super-api.<tu-subdominio>.workers.dev`.

### Conectar el frontend al backend

Define la URL del Worker como variable de entorno de build:

```bash
# local
echo "VITE_API_BASE=https://precios-super-api.<tu-subdominio>.workers.dev" > .env.local

# en GitHub Actions (deploy a Pages): agrégala como variable/secreto del repo
# y pásala en el step de build (env: VITE_API_BASE: ...).
```

Si `VITE_API_BASE` **no** está definida, la app cae automáticamente a
**modo local** (`localStorage`, por dispositivo) — útil para desarrollo y como
fallback offline. La cabecera de la app indica si está en modo compartido o
local.

> Las fotos de boleta se guardan comprimidas dentro de D1 (suficiente para el
> piloto). Para volumen alto conviene mover las imágenes a **R2** (hay que
> habilitarlo una vez desde el dashboard de Cloudflare); la migración solo toca
> `workers/api.js`.

## Lectura de boletas (cámara + OCR, sin IA)

La subida de boleta lee los precios **automáticamente en el dispositivo**, sin
servicios de IA ni API keys:

1. **Cámara** → el usuario saca la foto de la boleta.
2. **OCR** (`src/lib/ocr.js`, Tesseract.js en español) → extrae el texto. El
   motor de OCR se carga de forma diferida (solo al escanear) y el navegador lo
   cachea para las siguientes veces.
3. **Parser** (`src/lib/receiptParser.js`) → heurísticas afinadas a boletas
   chilenas que mapean:
   - **Supermercado** (cadenas conocidas: Unimarc/Rendic, Jumbo, Líder, etc.)
   - **Ciudad/comuna** (línea de dirección)
   - **Fecha** de emisión
   - **Productos**: líneas `código · descripción · valor`, descartando RUT,
     totales, neto/IVA y pagos. Maneja precio por kilo (`0,58 x 1 KG $2990 c/u`
     → unidad `kg`, precio unitario `$2990`) y el formato de pesos chileno
     (`$1.990` → 1990).
4. **Confirmación**: los campos quedan prellenados y **editables**; el usuario
   corrige lo que el OCR no haya leído bien antes de guardar.

El parser es una función pura cubierta por pruebas con el texto de una boleta
Unimarc real (`test/receiptParser.test.js`).

> Si más adelante se quiere mayor precisión, el mismo punto de enganche
> (`onPhoto` en `AddPriceModal`) puede llamar a una ruta del Worker con la
> **API de visión de Claude** en vez del OCR local.

## Estructura

```
src/
  App.jsx                 Pantalla principal: ciudad, vistas y lista
  state/store.jsx         Estado (reducer) + persistencia local
  lib/
    pricing.js            Modelo de datos + comparación y ranking
    backend.js            Capa de datos: remoto (Worker) o local (fallback)
    ocr.js                OCR en el dispositivo (Tesseract.js)
    receiptParser.js      Mapea el texto OCR a supermercado/ciudad/fecha/items
    catalog.js            Ciudades/supermercados sugeridos + normalización
    image.js              Compresión de la foto de boleta a dataURL
    format.js             Formato CLP, fechas y fechas relativas
    storage.js            Caché/persistencia local
    brand.js              Icono embebido
  components/
    AddPriceModal.jsx     Subir boleta + registrar productos
    CityBar.jsx           Filtro de ciudad + sello de última actualización
    ProductCard.jsx       Tarjeta de comparación de un producto
workers/
  api.js                  Cloudflare Worker (API REST sobre D1)
wrangler.toml             Config de despliegue del Worker (binding D1)
test/
  pricing.test.js         Pruebas de la lógica de comparación
  receiptParser.test.js   Pruebas del parser de boletas (boleta real)
```

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm test           # pruebas de la lógica de precios
npm run build      # build de producción (dist/)
```

El deploy a GitHub Pages se hace automáticamente vía
`.github/workflows/pages.yml` (usa `VITE_BASE=/Chilexpress/`).
