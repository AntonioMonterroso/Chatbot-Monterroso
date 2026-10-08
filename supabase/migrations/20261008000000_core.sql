-- Monterroso Chat: negocios, usuarios y membresías.
-- Todo dato de dinero cuelga de un negocio (business_id) y la RLS lo aísla por membresía.
-- Montos siempre en centavos enteros (bigint): nunca float para dinero.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Número de WhatsApp en formato E.164 (+502...). Con él se identifica quién escribe.
  phone_e164 text unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  country_code char(2) not null default 'GT',
  currency text not null default 'GTQ' check (currency in ('GTQ', 'USD')),
  timezone text not null default 'America/Guatemala',
  locale text not null default 'es-GT',
  -- Impuesto por negocio. Solo informativo: la versión mínima NO calcula ni declara impuestos.
  tax_name text,
  tax_rate numeric(6, 4) check (tax_rate is null or tax_rate between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

-- Crea el perfil automáticamente cuando alguien se registra.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de RLS. security definer para no caer en recursión con las políticas de business_members.
create function public.is_member(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m where m.business_id = bid and m.user_id = auth.uid()
  );
$$;
create function public.is_owner(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = bid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Único camino para crear un negocio: lo deja con su dueño en la misma transacción.
create function public.create_business(
  p_name text,
  p_country_code char(2) default 'GT',
  p_currency text default 'GTQ',
  p_timezone text default 'America/Guatemala'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  bid uuid;
begin
  if auth.uid() is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  insert into public.businesses (name, country_code, currency, timezone)
  values (p_name, upper(p_country_code), p_currency, p_timezone)
  returning id into bid;
  insert into public.business_members (business_id, user_id, role) values (bid, auth.uid(), 'owner');
  return bid;
end;
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy businesses_select on public.businesses for select to authenticated using (public.is_member(id));
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

create policy members_select on public.business_members for select to authenticated
  using (public.is_member(business_id));
-- Sin políticas de insert/update/delete: las membresías solo cambian vía create_business
-- (o, más adelante, una función de invitaciones).
