-- Ventas, proveedores, gastos y pagos a proveedores.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  -- Permite que gastos y pagos referencien (id, business_id) y así nunca crucen negocios.
  unique (id, business_id)
);
create unique index suppliers_business_name_idx on public.suppliers (business_id, lower(btrim(name)));

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  sale_date date not null,
  cash_cents bigint not null default 0 check (cash_cents >= 0),
  card_cents bigint not null default 0 check (card_cents >= 0),
  -- Transferencias, otros métodos o monto sin desglosar.
  other_cents bigint not null default 0 check (other_cents >= 0),
  -- Propinas: van aparte y NO forman parte de la venta.
  tips_cents bigint not null default 0 check (tips_cents >= 0),
  total_cents bigint generated always as (cash_cents + card_cents + other_cents) stored,
  source text not null default 'panel' check (source in ('simulator', 'whatsapp', 'panel')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (cash_cents + card_cents + other_cents > 0)
);
create index sales_business_date_idx on public.sales (business_id, sale_date desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid,
  expense_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  -- true = compra al crédito (se le queda debiendo al proveedor); false = pagada al momento.
  on_credit boolean not null default false,
  invoice_number text,
  notes text,
  -- Ruta de la foto de la factura en Storage (bucket privado, se agrega con el flujo de gastos).
  invoice_photo_path text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (supplier_id, business_id) references public.suppliers (id, business_id),
  check (not on_credit or supplier_id is not null)
);
create index expenses_business_date_idx on public.expenses (business_id, expense_date desc);
create index expenses_supplier_idx on public.expenses (supplier_id);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid not null,
  paid_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (supplier_id, business_id) references public.suppliers (id, business_id)
);
create index supplier_payments_supplier_idx on public.supplier_payments (supplier_id);

-- Saldo por proveedor = compras al crédito - pagos. security_invoker: respeta la RLS de quien consulta.
create view public.supplier_balances with (security_invoker = true) as
select
  s.business_id,
  s.id as supplier_id,
  s.name,
  coalesce((select sum(e.amount_cents) from public.expenses e where e.supplier_id = s.id and e.on_credit), 0)
    - coalesce((select sum(p.amount_cents) from public.supplier_payments p where p.supplier_id = s.id), 0)
    as balance_cents
from public.suppliers s;

alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.supplier_payments enable row level security;

-- Cualquier miembro lee y registra; solo el dueño corrige o borra.
do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'sales', 'expenses', 'supplier_payments'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(business_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(business_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_owner(business_id))', t || '_delete', t);
  end loop;
end;
$$;
