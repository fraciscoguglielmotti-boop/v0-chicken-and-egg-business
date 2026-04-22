-- Sequences atómicas para evitar race conditions en generación de números
-- (el SELECT MAX previo podía asignar el mismo número a dos pedidos concurrentes)

create sequence if not exists pedidos_minoristas_seq start 1;
create sequence if not exists clientes_minoristas_seq start 1;

-- Inicializar desde el máximo actual
do $$
declare
  max_ped integer;
  max_cli integer;
begin
  select coalesce(max(
    nullif(regexp_replace(numero, '\D', '', 'g'), '')::integer
  ), 0) into max_ped
  from pedidos_minoristas;

  select coalesce(max(
    nullif(regexp_replace(customer_id, '\D', '', 'g'), '')::integer
  ), 0) into max_cli
  from clientes_minoristas;

  if max_ped > 0 then
    perform setval('pedidos_minoristas_seq', max_ped);
  end if;
  if max_cli > 0 then
    perform setval('clientes_minoristas_seq', max_cli);
  end if;
end $$;

-- Función RPC: genera el siguiente número de pedido de forma atómica
create or replace function next_pedido_numero()
returns text
language plpgsql
security definer
as $$
begin
  return 'PED-' || lpad(nextval('pedidos_minoristas_seq')::text, 4, '0');
end;
$$;

-- Función RPC: genera el siguiente customer_id de forma atómica
create or replace function next_customer_id()
returns text
language plpgsql
security definer
as $$
begin
  return 'MIN-' || lpad(nextval('clientes_minoristas_seq')::text, 4, '0');
end;
$$;
