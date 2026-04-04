-- Condición de pago por cliente
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS condicion_pago TEXT NOT NULL DEFAULT 'inmediato',
  ADD COLUMN IF NOT EXISTS plazo_dias     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_pago       INTEGER DEFAULT NULL;

-- Vencimiento y estado de cobro por venta
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS fecha_vto_cobro DATE    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cobrado         BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para buscar rápido las ventas pendientes
CREATE INDEX IF NOT EXISTS idx_ventas_cobrado ON ventas (cobrado);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha_vto ON ventas (fecha_vto_cobro);
