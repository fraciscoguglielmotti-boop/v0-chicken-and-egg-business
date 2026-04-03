-- Permite registrar pagos futuros / pendientes en la tabla gastos
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS pagado BOOLEAN NOT NULL DEFAULT TRUE;

-- Los gastos existentes ya están pagados
UPDATE gastos SET pagado = TRUE WHERE pagado IS NULL;
