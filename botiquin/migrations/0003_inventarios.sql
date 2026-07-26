-- Inventarios fisicos (conteos).
--
-- Un inventario es el dato real: lo que se cuenta manda sobre lo registrado.
-- Guardamos la fecha, quien lo hizo y TODAS las diferencias encontradas, para
-- poder revisarlas despues y exportarlas.

CREATE TABLE IF NOT EXISTS stocktakes (
  id         TEXT PRIMARY KEY,          -- lo genera el telefono
  zona       TEXT NOT NULL DEFAULT '',  -- '' = toda la casa
  started_at TEXT NOT NULL,
  closed_at  TEXT NOT NULL,
  who        TEXT NOT NULL DEFAULT '',
  -- Totales del descuadre, para listar sin abrir el detalle.
  contados   INTEGER NOT NULL DEFAULT 0, -- lineas contadas
  sobras     INTEGER NOT NULL DEFAULT 0, -- unidades de mas
  faltantes  INTEGER NOT NULL DEFAULT 0  -- unidades de menos
);

CREATE INDEX IF NOT EXISTS idx_stocktakes_closed ON stocktakes (closed_at DESC);

-- Una linea por producto y fecha de vencimiento con diferencia o conteo.
CREATE TABLE IF NOT EXISTS stocktake_lines (
  stocktake_id TEXT NOT NULL,
  barcode      TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  zona         TEXT NOT NULL DEFAULT '',
  expiry       TEXT NOT NULL DEFAULT '',
  antes        INTEGER NOT NULL DEFAULT 0,  -- lo que decia el sistema
  contado      INTEGER NOT NULL DEFAULT 0,  -- lo que habia de verdad
  PRIMARY KEY (stocktake_id, barcode, expiry)
);

CREATE INDEX IF NOT EXISTS idx_lines_stocktake ON stocktake_lines (stocktake_id);
