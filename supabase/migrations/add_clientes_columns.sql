-- Add optional columns to clientes table if they don't exist
alter table clientes add column if not exists cuit text;
alter table clientes add column if not exists telefono text;
alter table clientes add column if not exists direccion text;
alter table clientes add column if not exists saldo_inicial numeric not null default 0;
alter table clientes add column if not exists fecha_alta date not null default current_date;
