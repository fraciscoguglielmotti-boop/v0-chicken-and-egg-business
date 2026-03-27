-- Core business tables used throughout the application

-- ventas
create table if not exists ventas (
  id               uuid        primary key default gen_random_uuid(),
  fecha            date        not null,
  cliente_nombre   text        not null,
  producto_nombre  text,
  cantidad         numeric     not null default 0,
  precio_unitario  numeric     not null default 0,
  vendedor         text,
  observaciones    text,
  created_at       timestamptz default now()
);

alter table ventas enable row level security;
drop policy if exists "Allow all" on ventas;
create policy "Allow all" on ventas for all using (true) with check (true);

-- cobros
create table if not exists cobros (
  id                    uuid        primary key default gen_random_uuid(),
  fecha                 date        not null,
  cliente_nombre        text        not null,
  monto                 numeric     not null,
  metodo_pago           text,
  cuenta_destino        text,
  verificado_agroaves   boolean     default false,
  observaciones         text,
  created_at            timestamptz default now()
);

alter table cobros enable row level security;
drop policy if exists "Allow all" on cobros;
create policy "Allow all" on cobros for all using (true) with check (true);

-- compras
create table if not exists compras (
  id               uuid        primary key default gen_random_uuid(),
  fecha            date        not null,
  proveedor_nombre text        not null,
  producto         text,
  cantidad         numeric     default 0,
  precio_unitario  numeric     default 0,
  total            numeric     default 0,
  estado           text        default 'pendiente',
  verificado       boolean     default false,
  created_at       timestamptz default now()
);

alter table compras enable row level security;
drop policy if exists "Allow all" on compras;
create policy "Allow all" on compras for all using (true) with check (true);

-- pagos
create table if not exists pagos (
  id               uuid        primary key default gen_random_uuid(),
  fecha            date        not null,
  proveedor_nombre text        not null,
  monto            numeric     not null,
  metodo_pago      text,
  observaciones    text,
  created_at       timestamptz default now()
);

alter table pagos enable row level security;
drop policy if exists "Allow all" on pagos;
create policy "Allow all" on pagos for all using (true) with check (true);

-- gastos
create table if not exists gastos (
  id            uuid        primary key default gen_random_uuid(),
  fecha         date        not null,
  tipo          text        default 'Egreso',
  categoria     text,
  descripcion   text,
  monto         numeric     not null,
  medio_pago    text        default 'Efectivo',
  tarjeta       text,
  banco         text,
  cuota_actual  int         default 1,
  cuotas_total  int         default 1,
  created_at    timestamptz default now()
);

alter table gastos enable row level security;
drop policy if exists "Allow all" on gastos;
create policy "Allow all" on gastos for all using (true) with check (true);

-- categorias_gastos
create table if not exists categorias_gastos (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text        not null unique,
  created_at timestamptz default now()
);

alter table categorias_gastos enable row level security;
drop policy if exists "Allow all" on categorias_gastos;
create policy "Allow all" on categorias_gastos for all using (true) with check (true);

-- proveedores
create table if not exists proveedores (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text        not null,
  created_at timestamptz default now()
);

alter table proveedores enable row level security;
drop policy if exists "Allow all" on proveedores;
create policy "Allow all" on proveedores for all using (true) with check (true);

-- vendedores
create table if not exists vendedores (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text        not null,
  comision   numeric     default 0,
  fecha_alta date        default current_date,
  created_at timestamptz default now()
);

alter table vendedores enable row level security;
drop policy if exists "Allow all" on vendedores;
create policy "Allow all" on vendedores for all using (true) with check (true);

-- presupuestos
create table if not exists presupuestos (
  id         uuid        primary key default gen_random_uuid(),
  categoria  text        not null,
  monto      numeric     not null,
  mes        int         not null,
  anio       int         not null,
  created_at timestamptz default now()
);

alter table presupuestos enable row level security;
drop policy if exists "Allow all" on presupuestos;
create policy "Allow all" on presupuestos for all using (true) with check (true);

-- productos
create table if not exists productos (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text        not null,
  activo     boolean     default true,
  created_at timestamptz default now()
);

alter table productos enable row level security;
drop policy if exists "Allow all" on productos;
create policy "Allow all" on productos for all using (true) with check (true);

-- vehiculos
create table if not exists vehiculos (
  id         uuid        primary key default gen_random_uuid(),
  patente    text        not null,
  marca      text,
  modelo     text,
  anio       int,
  created_at timestamptz default now()
);

alter table vehiculos enable row level security;
drop policy if exists "Allow all" on vehiculos;
create policy "Allow all" on vehiculos for all using (true) with check (true);

-- mantenimientos
create table if not exists mantenimientos (
  id           uuid        primary key default gen_random_uuid(),
  vehiculo_id  uuid        references vehiculos(id) on delete cascade,
  fecha        date        not null,
  tipo         text,
  descripcion  text,
  costo        numeric     default 0,
  created_at   timestamptz default now()
);

alter table mantenimientos enable row level security;
drop policy if exists "Allow all" on mantenimientos;
create policy "Allow all" on mantenimientos for all using (true) with check (true);

-- Fix: add saldo_verificado to clientes (used in cuentas-content.tsx)
alter table clientes add column if not exists saldo_verificado boolean default false;
