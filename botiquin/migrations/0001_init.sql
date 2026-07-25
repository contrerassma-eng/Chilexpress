-- Botiquin de hogar: esquema inicial.
--
-- Modelo: un producto (codigo de barras) puede tener varios lotes, uno por
-- fecha de caducidad. El stock real de un remedio es la suma de sus lotes.
-- Al consumir se descuenta del lote que vence primero (FEFO).

CREATE TABLE IF NOT EXISTS products (
  barcode    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lots (
  id         TEXT PRIMARY KEY,
  barcode    TEXT NOT NULL,
  -- 'YYYY-MM-DD'. Cadena vacia = producto sin fecha de caducidad.
  expiry     TEXT NOT NULL DEFAULT '',
  qty        INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (barcode, expiry)
);

CREATE INDEX IF NOT EXISTS idx_lots_barcode ON lots (barcode);
CREATE INDEX IF NOT EXISTS idx_lots_expiry ON lots (expiry);

-- Bitacora. El id lo genera el telefono, asi que reenviar un movimiento
-- pendiente (modo offline) nunca lo aplica dos veces.
CREATE TABLE IF NOT EXISTS movements (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,              -- compra | consumo | descarte | ajuste
  barcode    TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',   -- copia para que el historial se lea solo
  expiry     TEXT NOT NULL DEFAULT '',
  qty        INTEGER NOT NULL,
  at         TEXT NOT NULL,              -- momento en el telefono
  who        TEXT NOT NULL DEFAULT '',
  applied_at TEXT NOT NULL               -- momento en que lo recibio el servidor
);

CREATE INDEX IF NOT EXISTS idx_movements_at ON movements (at DESC);
