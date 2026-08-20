-- ============================================================
-- Project Model Canvas - relational schema (organizations,
-- memberships, projects, notes) replacing the single-blob
-- project_canvases table used by the early prototype.
-- Safe to re-run: uses drop/create and "if not exists" guards.
-- Existing demo data in project_canvases is intentionally
-- discarded (see PLANO-SOLUCAO-SAAS.md).
-- ============================================================

create extension if not exists pgcrypto;

drop table if exists public.project_canvases cascade;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'commenter', 'reader')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  manager_name text not null default '',
  status text not null default 'RASCUNHO',
  version numeric(6, 1) not null default 1.0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  block_key text not null check (block_key in (
    'why', 'objectives', 'benefits', 'product', 'requirements',
    'stakeholders', 'team', 'assumptions', 'deliverables',
    'constraints', 'risks', 'timeline', 'costs'
  )),
  text text not null check (length(trim(text)) > 0),
  author text not null default '',
  color text not null default 'yellow',
  status text check (status in ('done', 'review')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_project_id_idx on public.notes (project_id);
create index if not exists projects_organization_id_idx on public.projects (organization_id);
create index if not exists memberships_user_id_idx on public.memberships (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Membership helper functions (security definer avoids RLS
-- recursion on memberships and cross-table joins).
-- ------------------------------------------------------------

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_editor(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role in ('admin', 'editor')
  );
$$;

create or replace function public.project_organization_id(target_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.projects where id = target_project_id;
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_editor(uuid) from public;
revoke all on function public.project_organization_id(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_editor(uuid) to authenticated;
grant execute on function public.project_organization_id(uuid) to authenticated;

-- ------------------------------------------------------------
-- Organization creation RPC (auto-adds creator as admin).
-- ------------------------------------------------------------

create or replace function public.create_organization_with_owner(org_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org public.organizations;
begin
  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'org_name is required';
  end if;

  insert into public.organizations (name, created_by)
  values (trim(org_name), auth.uid())
  returning * into new_org;

  insert into public.memberships (organization_id, user_id, role)
  values (new_org.id, auth.uid(), 'admin');

  return new_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text) from public;
grant execute on function public.create_organization_with_owner(text) to authenticated;

-- ------------------------------------------------------------
-- Row level security
-- ------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.notes enable row level security;

-- organizations: readable by members only. No client insert/update/
-- delete policy exists — writes only happen inside
-- create_organization_with_owner (runs as table owner, bypasses RLS).
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

-- memberships: readable by fellow org members. No client-side
-- insert/update/delete this round — invites are a manual/future step.
drop policy if exists "memberships_select_member" on public.memberships;
create policy "memberships_select_member"
  on public.memberships for select
  to authenticated
  using (public.is_org_member(organization_id));

-- projects: any member reads; admin/editor create and edit.
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "projects_insert_editor" on public.projects;
create policy "projects_insert_editor"
  on public.projects for insert
  to authenticated
  with check (public.is_org_editor(organization_id) and created_by = auth.uid());

drop policy if exists "projects_update_editor" on public.projects;
create policy "projects_update_editor"
  on public.projects for update
  to authenticated
  using (public.is_org_editor(organization_id))
  with check (public.is_org_editor(organization_id));

-- notes: any member of the owning project's org reads; admin/editor
-- create/edit/delete. commenter/reader stay read-only this round.
drop policy if exists "notes_select_member" on public.notes;
create policy "notes_select_member"
  on public.notes for select
  to authenticated
  using (public.is_org_member(public.project_organization_id(project_id)));

drop policy if exists "notes_insert_editor" on public.notes;
create policy "notes_insert_editor"
  on public.notes for insert
  to authenticated
  with check (public.is_org_editor(public.project_organization_id(project_id)) and created_by = auth.uid());

drop policy if exists "notes_update_editor" on public.notes;
create policy "notes_update_editor"
  on public.notes for update
  to authenticated
  using (public.is_org_editor(public.project_organization_id(project_id)))
  with check (public.is_org_editor(public.project_organization_id(project_id)));

drop policy if exists "notes_delete_editor" on public.notes;
create policy "notes_delete_editor"
  on public.notes for delete
  to authenticated
  using (public.is_org_editor(public.project_organization_id(project_id)));

-- ------------------------------------------------------------
-- Realtime: broadcast row changes for projects and notes.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
