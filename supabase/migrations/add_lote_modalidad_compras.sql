-- Agregar número de lote auto-generado y modalidad de entrega a compras

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS numero_lote TEXT,
  ADD COLUMN IF NOT EXISTS modalidad TEXT DEFAULT 'planta' CHECK (modalidad IN ('planta', 'envio'));

-- Índice para búsqueda rápida por lote
CREATE INDEX IF NOT EXISTS idx_compras_numero_lote ON compras (numero_lote);
