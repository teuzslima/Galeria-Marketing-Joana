-- =============================================================================
-- Joana Mirelly Fotografia — Schema completo (Banco, RLS e Storage)
-- Execute este script inteiro no SQL Editor do Supabase.
-- O script é idempotente: pode ser executado novamente sem quebrar nada.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ADMINISTRADORES
-- Apenas usuários listados aqui têm controle total. Isso impede que qualquer
-- outro usuário autenticado (ex.: alguém que se cadastre) tenha acesso ao CRUD.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users: usuário lê o próprio registro" on public.admin_users;
create policy "admin_users: usuário lê o próprio registro"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

-- Função auxiliar usada pelas políticas (security definer evita recursão de RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. TRIGGER GENÉRICO DE updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. TABELA galleries
-- -----------------------------------------------------------------------------
create table if not exists public.galleries (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 160),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 100),
  client_name     text,
  event_date      date,
  welcome_message text,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  allow_download  boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists galleries_status_idx     on public.galleries (status);
create index if not exists galleries_event_date_idx on public.galleries (event_date desc);

drop trigger if exists galleries_set_updated_at on public.galleries;
create trigger galleries_set_updated_at
  before update on public.galleries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. TABELA media_items
-- -----------------------------------------------------------------------------
create table if not exists public.media_items (
  id                     uuid primary key default gen_random_uuid(),
  gallery_id             uuid not null references public.galleries (id) on delete cascade,
  media_type             text not null default 'photo' check (media_type in ('photo', 'video')),
  filename               text not null,
  original_storage_path  text not null unique,
  thumbnail_storage_path text,
  width                  integer check (width is null or width > 0),
  height                 integer check (height is null or height > 0),
  display_order          integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists media_items_gallery_order_idx
  on public.media_items (gallery_id, display_order, created_at);

drop trigger if exists media_items_set_updated_at on public.media_items;
create trigger media_items_set_updated_at
  before update on public.media_items
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY — galleries
-- -----------------------------------------------------------------------------
alter table public.galleries enable row level security;

drop policy if exists "galleries: público lê publicadas" on public.galleries;
create policy "galleries: público lê publicadas"
  on public.galleries
  for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "galleries: admin controle total" on public.galleries;
create policy "galleries: admin controle total"
  on public.galleries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY — media_items
-- -----------------------------------------------------------------------------
alter table public.media_items enable row level security;

drop policy if exists "media_items: público lê mídias de galerias publicadas" on public.media_items;
create policy "media_items: público lê mídias de galerias publicadas"
  on public.media_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.galleries g
      where g.id = media_items.gallery_id
        and g.status = 'published'
    )
  );

drop policy if exists "media_items: admin controle total" on public.media_items;
create policy "media_items: admin controle total"
  on public.media_items
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Privilégios de tabela (RLS continua filtrando as linhas)
grant select on public.galleries, public.media_items to anon;
grant select, insert, update, delete on public.galleries, public.media_items to authenticated;
grant select on public.admin_users to authenticated;

-- -----------------------------------------------------------------------------
-- 7. STORAGE — BUCKETS
-- -----------------------------------------------------------------------------
-- Miniaturas: bucket PÚBLICO (leitura direta via URL pública, sem listagem).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-thumbnails',
  'gallery-thumbnails',
  true,
  10485760, -- 10 MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Originais: bucket PRIVADO (leitura apenas via Signed URL gerada no backend).
-- Ajuste file_size_limit conforme o plano do Supabase (Free: máx. 50 MB por arquivo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery-originals',
  'gallery-originals',
  false,
  524288000, -- 500 MB
  array['image/*', 'video/*', 'application/octet-stream']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 8. STORAGE — POLÍTICAS (storage.objects)
-- Observações:
--  * Arquivos de bucket público são servidos pela URL pública sem precisar de
--    policy de SELECT; por isso NÃO criamos SELECT público (evita listagem).
--  * O bucket de originais não tem nenhuma policy para anon: o acesso público
--    acontece somente por Signed URL criada com a service_role no backend.
-- -----------------------------------------------------------------------------
drop policy if exists "thumbnails: admin lê"      on storage.objects;
drop policy if exists "thumbnails: admin envia"   on storage.objects;
drop policy if exists "thumbnails: admin atualiza" on storage.objects;
drop policy if exists "thumbnails: admin exclui"  on storage.objects;
drop policy if exists "originals: admin lê"       on storage.objects;
drop policy if exists "originals: admin envia"    on storage.objects;
drop policy if exists "originals: admin atualiza" on storage.objects;
drop policy if exists "originals: admin exclui"   on storage.objects;

create policy "thumbnails: admin lê"
  on storage.objects for select to authenticated
  using (bucket_id = 'gallery-thumbnails' and public.is_admin());

create policy "thumbnails: admin envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery-thumbnails' and public.is_admin());

create policy "thumbnails: admin atualiza"
  on storage.objects for update to authenticated
  using (bucket_id = 'gallery-thumbnails' and public.is_admin())
  with check (bucket_id = 'gallery-thumbnails' and public.is_admin());

create policy "thumbnails: admin exclui"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery-thumbnails' and public.is_admin());

create policy "originals: admin lê"
  on storage.objects for select to authenticated
  using (bucket_id = 'gallery-originals' and public.is_admin());

create policy "originals: admin envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery-originals' and public.is_admin());

create policy "originals: admin atualiza"
  on storage.objects for update to authenticated
  using (bucket_id = 'gallery-originals' and public.is_admin())
  with check (bucket_id = 'gallery-originals' and public.is_admin());

create policy "originals: admin exclui"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery-originals' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 9. CADASTRAR A JOANA COMO ADMINISTRADORA
-- 1) Em Authentication > Users, crie o usuário da Joana (e-mail + senha).
-- 2) Em Authentication > Providers > Email, DESATIVE "Allow new users to sign up".
-- 3) Rode o comando abaixo trocando o e-mail:
--
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'joana@exemplo.com'
-- on conflict (user_id) do nothing;
-- -----------------------------------------------------------------------------

