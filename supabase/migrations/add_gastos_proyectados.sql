-- Gastos proyectados / gastos fijos recurrentes para flujo de fondos
CREATE TABLE IF NOT EXISTS gastos_proyectados (
  id          UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT           NOT NULL,
  categoria   TEXT,
  monto       NUMERIC(12,2)  NOT NULL,
  periodicidad TEXT          NOT NULL DEFAULT 'mensual'
                             CHECK (periodicidad IN ('mensual', 'unico')),
  mes         TEXT,          -- YYYY-MM, solo para periodicidad='unico'
  activo      BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ    DEFAULT NOW()
);

-- Índice para filtros frecuentes
CREATE INDEX IF NOT EXISTS idx_gastos_proyectados_activo ON gastos_proyectados (activo);
CREATE INDEX IF NOT EXISTS idx_gastos_proyectados_mes    ON gastos_proyectados (mes);
