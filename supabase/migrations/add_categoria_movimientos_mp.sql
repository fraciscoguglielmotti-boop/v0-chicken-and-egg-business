-- Agrega la columna `categoria` a movimientos_mp (usada por /api/mp/importar-pdf
-- para auto-clasificar egresos según reglas guardadas en reglas_categorias).

alter table movimientos_mp
  add column if not exists categoria text;

create index if not exists idx_movimientos_mp_categoria
  on movimientos_mp(categoria)
  where categoria is not null;

-- tipo_operacion y metodo_pago también son insertados por el importador
alter table movimientos_mp
  add column if not exists tipo_operacion text;
alter table movimientos_mp
  add column if not exists metodo_pago text;
