-- Módulo Minorista: venta retail con reparto a domicilio

-- clientes_minoristas
create table if not exists clientes_minoristas (
  id            uuid        primary key default gen_random_uuid(),
  customer_id   text        unique not null,   -- MIN-0001
  nombre        text        not null,
  apellido      text        not null,
  telefono      text,
  direccion     text,
  lat           numeric,
  lng           numeric,
  notas         text,
  activo        boolean     default true,
  created_at    timestamptz default now()
);

alter table clientes_minoristas enable row level security;
drop policy if exists "Allow all" on clientes_minoristas;
create policy "Allow all" on clientes_minoristas for all using (true) with check (true);

-- productos_minoristas
create table if not exists productos_minoristas (
  id          uuid        primary key default gen_random_uuid(),
  nombre      text        not null,
  descripcion text,
  unidad      text        not null default 'kg',  -- kg | unidad
  precio      numeric     not null default 0,
  activo      boolean     default true,
  created_at  timestamptz default now()
);

alter table productos_minoristas enable row level security;
drop policy if exists "Allow all" on productos_minoristas;
create policy "Allow all" on productos_minoristas for all using (true) with check (true);

-- promos_minoristas
create table if not exists promos_minoristas (
  id          uuid        primary key default gen_random_uuid(),
  nombre      text        not null,
  descripcion text,
  tipo        text        not null default 'precio_fijo', -- precio_fijo | descuento_pct
  valor       numeric     not null default 0,
  activo      boolean     default true,
  created_at  timestamptz default now()
);

alter table promos_minoristas enable row level security;
drop policy if exists "Allow all" on promos_minoristas;
create policy "Allow all" on promos_minoristas for all using (true) with check (true);

-- pedidos_minoristas
create table if not exists pedidos_minoristas (
  id          uuid        primary key default gen_random_uuid(),
  numero      text        unique not null,  -- PED-0001
  cliente_id  uuid        references clientes_minoristas(id),
  fecha       date        not null,
  estado      text        not null default 'recibido',
  -- recibido | confirmado | en_reparto | entregado | intento_fallido
  total       numeric     not null default 0,
  forma_pago  text        default 'efectivo', -- efectivo | mercadopago
  mp_link     text,
  notas       text,
  promo_id    uuid        references promos_minoristas(id),
  descuento   numeric     default 0,
  created_at  timestamptz default now()
);

alter table pedidos_minoristas enable row level security;
drop policy if exists "Allow all" on pedidos_minoristas;
create policy "Allow all" on pedidos_minoristas for all using (true) with check (true);

-- items_pedido_minorista
create table if not exists items_pedido_minorista (
  id               uuid        primary key default gen_random_uuid(),
  pedido_id        uuid        not null references pedidos_minoristas(id) on delete cascade,
  producto_id      uuid        references productos_minoristas(id),
  nombre_producto  text        not null,
  cantidad         numeric     not null default 1,
  precio_unitario  numeric     not null default 0,
  subtotal         numeric     not null default 0,
  created_at       timestamptz default now()
);

alter table items_pedido_minorista enable row level security;
drop policy if exists "Allow all" on items_pedido_minorista;
create policy "Allow all" on items_pedido_minorista for all using (true) with check (true);

-- repartos_minoristas
create table if not exists repartos_minoristas (
  id              uuid        primary key default gen_random_uuid(),
  fecha           date        not null,
  nombre          text        not null,
  repartidor      text,
  orden_pedidos   jsonb       default '[]',  -- array of pedido ids in drag-drop order
  estado          text        default 'armando',  -- armando | en_curso | finalizado
  created_at      timestamptz default now()
);

alter table repartos_minoristas enable row level security;
drop policy if exists "Allow all" on repartos_minoristas;
create policy "Allow all" on repartos_minoristas for all using (true) with check (true);

-- rendiciones_minoristas
create table if not exists rendiciones_minoristas (
  id               uuid        primary key default gen_random_uuid(),
  reparto_id       uuid        references repartos_minoristas(id),
  fecha            date        not null,
  repartidor       text,
  total_cobrado    numeric     default 0,
  efectivo_cobrado numeric     default 0,
  mp_cobrado       numeric     default 0,
  entregados       integer     default 0,
  no_entregados    integer     default 0,
  notas            text,
  created_at       timestamptz default now()
);

alter table rendiciones_minoristas enable row level security;
drop policy if exists "Allow all" on rendiciones_minoristas;
create policy "Allow all" on rendiciones_minoristas for all using (true) with check (true);

-- Seed productos iniciales
insert into productos_minoristas (nombre, descripcion, unidad, precio) values
  ('Suprema de Pollo', 'Suprema fresca', 'kg', 0),
  ('Pata Muslo', 'Pata muslo fresco', 'kg', 0),
  ('Maple de Huevo', 'Maple x 30 unidades', 'unidad', 0)
on conflict do nothing;
