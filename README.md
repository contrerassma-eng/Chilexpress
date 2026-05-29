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

## Estado actual y próximos pasos

Según lo acordado, esta primera versión es:

1. **Almacenamiento local** (`localStorage`): cada dispositivo guarda sus
   propios datos. La capa de persistencia está aislada en `src/lib/storage.js`,
   que es el único punto a cambiar cuando se migre a un backend compartido
   (p. ej. Supabase) para tener comparación real entre usuarios.
2. **Carga manual** de los precios. La pantalla de subida ya contempla la foto
   de la boleta; el **procesamiento con IA** (leer la boleta y extraer
   producto + precio automáticamente) se integrará en una segunda etapa.

## Estructura

```
src/
  App.jsx                 Pantalla principal: ciudad, vistas y lista
  state/store.jsx         Estado (reducer) + persistencia local
  lib/
    pricing.js            Modelo de datos + comparación y ranking
    catalog.js            Ciudades/supermercados sugeridos + normalización
    image.js              Compresión de la foto de boleta a dataURL
    format.js             Formato CLP, fechas y fechas relativas
    storage.js            Persistencia local (único punto para el backend)
    brand.js              Icono embebido
  components/
    AddPriceModal.jsx     Subir boleta + registrar productos
    CityBar.jsx           Filtro de ciudad + sello de última actualización
    ProductCard.jsx       Tarjeta de comparación de un producto
test/
  pricing.test.js         Pruebas de la lógica de comparación
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
