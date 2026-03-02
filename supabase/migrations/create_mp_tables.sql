-- Movimientos sincronizados desde MercadoPago
create table if not exists movimientos_mp (
  id          text        primary key,  -- ID del pago en MP
  fecha       timestamptz not null,
  tipo        text        not null,     -- 'ingreso' | 'egreso'
  monto       numeric     not null,
  descripcion text,
  referencia  text,                     -- ID de operación MP
  pagador_nombre text,
  pagador_email  text,
  estado      text        not null default 'sin_verificar', -- 'sin_verificar' | 'verificado' | 'sospechoso'
  created_at  timestamptz default now()
);

alter table movimientos_mp enable row level security;
create policy "Allow all" on movimientos_mp for all using (true) with check (true);

-- Comprobantes subidos para verificación
create table if not exists comprobantes_mp (
  id                    uuid        primary key default gen_random_uuid(),
  movimiento_id         text        references movimientos_mp(id),
  monto_comprobante     numeric,
  fecha_comprobante     date,
  referencia_comprobante text,
  remitente             text,
  estado                text        not null,  -- 'verificado' | 'sospechoso' | 'sin_match'
  notas                 text,
  created_at            timestamptz default now()
);

alter table comprobantes_mp enable row level security;
create policy "Allow all" on comprobantes_mp for all using (true) with check (true);
