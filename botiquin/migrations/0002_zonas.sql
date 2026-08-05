-- Amplia el inventario a varias zonas de la casa: botiquin, despensa,
-- refrigerador y aseo.
--
-- La zona va en el producto, no en el lote: un remedio o un tarro de cafe
-- vive en un solo lugar. Lo que ya estaba guardado queda en el botiquin.

ALTER TABLE products ADD COLUMN zona TEXT NOT NULL DEFAULT 'botiquin';

-- La bitacora tambien la guarda, para poder leer el historial por zona.
ALTER TABLE movements ADD COLUMN zona TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_products_zona ON products (zona);
