-- =============================================================================
-- Fase 1: fundação do banco
-- Perfis de usuário, organizações (multiusuário desde o início) e chocadeiras.
-- Toda tabela exposta tem RLS: cada usuário só enxerga dados das organizações
-- das quais é membro.
-- =============================================================================

-- Esquema privado para funções auxiliares (não exposto pela API do Supabase)
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'operator', 'viewer');

-- -----------------------------------------------------------------------------
-- Função utilitária: mantém updated_at atualizado
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Organizações e membros
-- Cada usuário recebe uma organização pessoal no cadastro. A estrutura já
-- permite, no futuro, propriedades rurais com vários operadores.
-- -----------------------------------------------------------------------------
create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  is_personal  boolean not null default false,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

create table public.organization_members (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             public.org_role not null default 'owner',
  created_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);

-- -----------------------------------------------------------------------------
-- Funções de autorização (security definer para evitar recursão de RLS)
-- -----------------------------------------------------------------------------
create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_role(org_id uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- Chocadeiras
-- O dispositivo de instrumentação (ESP32) será vinculado na Fase 2 por uma
-- tabela própria, para permitir troca de hardware sem perda de histórico.
-- -----------------------------------------------------------------------------
create table public.incubators (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  code             text not null check (code ~ '^[A-Za-z0-9_-]{1,32}$'),
  description      text check (description is null or char_length(description) <= 1000),
  model            text check (model is null or char_length(model) <= 80),
  egg_capacity     integer check (egg_capacity is null or egg_capacity between 1 and 10000),
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint incubators_org_code_unique unique (organization_id, code)
);

create index incubators_organization_id_idx on public.incubators (organization_id);

create trigger incubators_set_updated_at
  before update on public.incubators
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Cadastro: cria perfil, organização pessoal e vínculo de proprietário
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''), 120);
  v_org_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, v_name);

  insert into public.organizations (name, is_personal, created_by)
  values (coalesce(nullif(v_name, ''), 'Minhas chocadeiras'), true, new.id)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.incubators enable row level security;

-- Perfis: cada usuário lê e altera apenas o próprio perfil
create policy "profiles: leitura do próprio perfil"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: edição do próprio perfil"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Organizações: membros leem; somente proprietários alteram
create policy "organizations: leitura por membros"
  on public.organizations for select to authenticated
  using ((select private.is_org_member(id)));

create policy "organizations: edição por proprietários"
  on public.organizations for update to authenticated
  using ((select private.has_org_role(id, array['owner']::public.org_role[])))
  with check ((select private.has_org_role(id, array['owner']::public.org_role[])));

-- Membros: leitura pelos membros da mesma organização
create policy "organization_members: leitura por membros"
  on public.organization_members for select to authenticated
  using ((select private.is_org_member(organization_id)));

-- Chocadeiras
create policy "incubators: leitura por membros"
  on public.incubators for select to authenticated
  using ((select private.is_org_member(organization_id)));

create policy "incubators: criação por proprietários e operadores"
  on public.incubators for insert to authenticated
  with check ((select private.has_org_role(organization_id, array['owner', 'operator']::public.org_role[])));

create policy "incubators: edição por proprietários e operadores"
  on public.incubators for update to authenticated
  using ((select private.has_org_role(organization_id, array['owner', 'operator']::public.org_role[])))
  with check ((select private.has_org_role(organization_id, array['owner', 'operator']::public.org_role[])));

create policy "incubators: exclusão por proprietários"
  on public.incubators for delete to authenticated
  using ((select private.has_org_role(organization_id, array['owner']::public.org_role[])));

-- -----------------------------------------------------------------------------
-- Permissões
-- Visitantes anônimos não acessam nenhuma tabela; usuários autenticados passam
-- pelas políticas acima.
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.organizations, public.organization_members, public.incubators from anon;

grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.org_role[]) to authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
