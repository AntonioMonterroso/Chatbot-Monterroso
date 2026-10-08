-- Conversaciones y mensajes (simulador hoy, WhatsApp después).
-- Una conversación por persona y canal. Es privada de esa persona: ni otro miembro del negocio la ve.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null default 'simulator' check (channel in ('simulator', 'whatsapp')),
  -- Lo que el asistente entendió y espera confirmar ("¿Correcto?"). null = nada pendiente.
  pending jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, channel),
  unique (id, business_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  business_id uuid not null,
  direction text not null check (direction in ('in', 'out')),
  kind text not null default 'text' check (kind in ('text', 'audio', 'image')),
  body text,
  -- Id del mensaje en WhatsApp: evita procesar dos veces un reintento del webhook.
  external_id text,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, business_id) references public.conversations (id, business_id) on delete cascade,
  unique (conversation_id, external_id)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy conversations_own on public.conversations for all to authenticated
  using (user_id = auth.uid() and public.is_member(business_id))
  with check (user_id = auth.uid() and public.is_member(business_id));

create policy messages_select on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
create policy messages_insert on public.messages for insert to authenticated with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.business_id = messages.business_id and c.user_id = auth.uid()
  )
);
