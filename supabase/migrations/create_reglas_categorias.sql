-- Tabla para el aprendizaje de categorización de gastos de tarjeta
-- Cada regla mapea un texto de descripción a una categoría y proveedor

create table if not exists reglas_categorias (
  id          uuid        primary key default gen_random_uuid(),
  texto_original text     not null,
  categoria   text        not null,
  proveedor   text,
  created_at  timestamptz default now()
);

-- Row Level Security (ajustar según las políticas del proyecto)
alter table reglas_categorias enable row level security;

create policy "Allow all for authenticated users"
  on reglas_categorias
  for all
  using (true)
  with check (true);
