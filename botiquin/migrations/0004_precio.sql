-- Precio por lote para valorizar inventario.
--
-- El precio es el costo unitario. La columna es nullable porque lotes viejos
-- no lo tendran hasta que se recompren. Para listar el inventario total se suma
-- qty * precio (ignorando los que tengan precio NULL).

ALTER TABLE lots ADD COLUMN precio REAL DEFAULT NULL;

-- Indice para ordenes por precio (cuando se necesite).
CREATE INDEX IF NOT EXISTS idx_lots_precio ON lots (precio);
