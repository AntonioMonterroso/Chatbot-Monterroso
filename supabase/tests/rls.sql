-- Pruebas de aislamiento por negocio (RLS). Se corren contra una base ya migrada:
--   supabase db reset && psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Todo ocurre dentro de una transacción que se deshace al final.
begin;

create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALLÓ: %', msg; end if;
end;
$$;
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.try(sql text) returns boolean language plpgsql as $$
begin
  execute sql;
  return true;
exception when others then
  return false;
end;
$$;

-- Dos dueños, A y B, y un empleado S de A
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 's@test.local');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select set_config('test.biz_a', public.create_business('Negocio A')::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select set_config('test.biz_b', public.create_business('Negocio B', 'US', 'USD', 'America/Chicago')::text, true);

-- Como superusuario, S entra como empleado de A
reset role;
insert into public.business_members (business_id, user_id, role)
values (current_setting('test.biz_a')::uuid, '00000000-0000-0000-0000-00000000000c', 'staff');

-- A registra datos en su negocio
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.suppliers (business_id, name) values (current_setting('test.biz_a')::uuid, 'Carnicería Don Pepe');
insert into public.sales (business_id, sale_date, cash_cents, card_cents, tips_cents)
values (current_setting('test.biz_a')::uuid, current_date, 320000, 165000, 30000);
select pg_temp.check((select total_cents from public.sales) = 485000, 'total = efectivo + tarjeta, sin propinas');
select pg_temp.check((select count(*) from public.businesses) = 1, 'A ve solo su negocio');

-- B no ve ni toca nada de A
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.sales) = 0, 'B no ve ventas de A');
select pg_temp.check((select count(*) from public.suppliers) = 0, 'B no ve proveedores de A');
select pg_temp.check((select count(*) from public.businesses) = 1, 'B ve solo su negocio');
select pg_temp.check(
  not pg_temp.try(format('insert into public.sales (business_id, sale_date, cash_cents) values (%L, current_date, 100)', current_setting('test.biz_a'))),
  'B no puede insertar ventas en el negocio de A');

-- Un proveedor de A no se puede usar desde un gasto de B ni siquiera conociendo el id (FK compuesta)
reset role;
select pg_temp.check(
  not pg_temp.try(format('insert into public.expenses (business_id, supplier_id, expense_date, amount_cents) values (%L, %L, current_date, 100)',
    current_setting('test.biz_b'), (select id from public.suppliers limit 1))),
  'la FK compuesta impide cruzar proveedor entre negocios');

-- El empleado lee y registra, pero no corrige ni borra
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.sales) = 1, 'el empleado ve las ventas de su negocio');
select pg_temp.check(
  pg_temp.try(format('insert into public.sales (business_id, sale_date, other_cents) values (%L, current_date, 5000)', current_setting('test.biz_a'))),
  'el empleado puede registrar ventas');
update public.sales set cash_cents = 1;
select pg_temp.check((select count(*) from public.sales where cash_cents = 1) = 0,
  'el empleado no puede modificar ventas (RLS filtra el update)');
delete from public.sales;
select pg_temp.check((select count(*) from public.sales) = 2, 'el empleado no puede borrar ventas');

-- Conversaciones: privadas de cada persona
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.conversations (business_id, user_id) values (current_setting('test.biz_a')::uuid, '00000000-0000-0000-0000-00000000000a');
insert into public.messages (conversation_id, business_id, direction, body)
select id, business_id, 'in', 'Hoy vendimos 4,850' from public.conversations;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.conversations) = 0, 'el empleado no ve la conversación del dueño');
select pg_temp.check((select count(*) from public.messages) = 0, 'el empleado no ve los mensajes del dueño');

-- anon no tiene acceso a nada
reset role;
set local role anon;
select pg_temp.check(not pg_temp.try('select count(*) from public.sales'), 'anon no puede leer ventas');
select pg_temp.check(not pg_temp.try('select public.is_member(gen_random_uuid())'), 'anon no puede ejecutar helpers');

rollback;
select 'RLS OK' as resultado;
