-- Permisos explícitos: nada para anon; authenticated solo lo que las políticas RLS luego filtran.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

grant select, update on public.profiles to authenticated;
grant select, update on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, insert, update, delete on public.suppliers, public.sales, public.expenses,
  public.supplier_payments to authenticated;
grant select on public.supplier_balances to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

-- Las funciones nacen ejecutables por PUBLIC; se cierra y se abre solo a authenticated.
revoke execute on function public.create_business(text, char, text, text) from public, anon;
revoke execute on function public.is_member(uuid), public.is_owner(uuid) from public, anon;
grant execute on function public.create_business(text, char, text, text) to authenticated;
grant execute on function public.is_member(uuid), public.is_owner(uuid) to authenticated;
-- Los triggers no se llaman por API: handle_new_user no se expone a nadie.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
