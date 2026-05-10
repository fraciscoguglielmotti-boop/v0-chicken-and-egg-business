-- Vincula cada mantenimiento con un registro en `gastos` para que su costo
-- impacte en EERR, Flujo de caja, Resumen Ejecutivo y la pantalla de Gastos.

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS gasto_id uuid REFERENCES gastos(id) ON DELETE SET NULL;

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS medio_pago text;

-- Backfill: por cada mantenimiento existente que aún no tenga gasto asociado,
-- crea el gasto correspondiente y lo vincula.
DO $$
DECLARE
  m RECORD;
  v_patente text;
  v_descripcion text;
  new_gasto_id uuid;
BEGIN
  FOR m IN
    SELECT id, vehiculo_id, fecha, tipo, descripcion, costo
      FROM mantenimientos
     WHERE gasto_id IS NULL
       AND COALESCE(costo, 0) > 0
  LOOP
    SELECT patente INTO v_patente FROM vehiculos WHERE id = m.vehiculo_id;

    v_descripcion := 'Mantenimiento'
      || COALESCE(' ' || NULLIF(m.tipo, ''), '')
      || COALESCE(' - ' || v_patente, '')
      || COALESCE(' (' || NULLIF(m.descripcion, '') || ')', '');

    INSERT INTO gastos (fecha, tipo, categoria, descripcion, monto, medio_pago, pagado)
    VALUES (
      m.fecha,
      'Egreso',
      'Mantenimiento Vehículos',
      v_descripcion,
      m.costo,
      'Efectivo',
      TRUE
    )
    RETURNING id INTO new_gasto_id;

    UPDATE mantenimientos SET gasto_id = new_gasto_id WHERE id = m.id;
  END LOOP;
END $$;
