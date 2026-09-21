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

-- Added after the initial table existed: references the org member
-- assigned as manager. Nullable because older rows only have the
-- free-text manager_name; manager_name stays as the denormalized
-- display label (same pattern as notes.author), populated from the
-- picked member's name/e-mail when this column is set on the client.
alter table public.projects add column if not exists manager_user_id uuid references auth.users (id) on delete set null;

-- Soft delete: archiving hides a project from the main list without
-- destroying notes/comments/audit/versions — null means active.
alter table public.projects add column if not exists archived_at timestamptz;

-- Formal lifecycle states. Was free text with only 'RASCUNHO'/'APROVADO'
-- ever written by the client; EM_VALIDACAO (intermediate review step,
-- not locked — block-level approval already covers fine-grained
-- freezing) and EM_EXECUCAO (post-approval, still locked, "Nova
-- versão" is still the only way out) are new. Archiving stays a
-- separate axis (archived_at above), not folded into this enum.
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('RASCUNHO', 'EM_VALIDACAO', 'APROVADO', 'EM_EXECUCAO'));

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

-- Optional supporting fields ("campos de apoio"), added after the
-- table already existed: help make an objective/benefit/deliverable
-- note more rigorous (indicator to track, where the evidence comes
-- from, when to revisit it) without forcing every note to fill them.
alter table public.notes add column if not exists indicator text;
alter table public.notes add column if not exists evidence_source text;
alter table public.notes add column if not exists review_date date;

-- Assignee: who is responsible for this note, distinct from `author`
-- (who wrote it). Nullable — most notes never get one, and the UI
-- flags that as "sem responsável" rather than forcing a pick.
-- assignee_label mirrors the manager_name/author denormalization
-- pattern (display label alongside the id) so note cards don't need
-- an extra join to show a name.
alter table public.notes add column if not exists assignee_user_id uuid references auth.users (id) on delete set null;
alter table public.notes add column if not exists assignee_label text;

-- Reordenação, fixação e arquivamento de notas individuais.
-- `position` is a plain per-(project_id, block_key) counter the
-- client assigns at creation time (current note count in that
-- block); moving a note up/down swaps `position` with its neighbour.
-- `pinned` notes float to the top regardless of position. Archiving a
-- note (unlike archiving a project) does NOT get a lock-bypass
-- exemption: it is just another note update, so it obeys the same
-- project/block lock rules as editing or deleting a note already did.
alter table public.notes add column if not exists position integer not null default 0;
alter table public.notes add column if not exists pinned boolean not null default false;
alter table public.notes add column if not exists archived_at timestamptz;

-- Structured risk fields (secao 7 do plano: "um risco deve ter
-- probabilidade, impacto, resposta e responsavel para ser considerado
-- tratado"). Responsavel ja e o assignee_user_id acima — nao duplicado
-- aqui. Nao restrito a block_key = 'risks' no banco (mesma escolha ja
-- feita para indicator/evidence_source/review_date); o client so
-- mostra esses campos ao editar uma nota do bloco Riscos.
alter table public.notes add column if not exists risk_probability text check (risk_probability in ('baixa', 'media', 'alta'));
alter table public.notes add column if not exists risk_impact text check (risk_impact in ('baixo', 'medio', 'alto'));
alter table public.notes add column if not exists risk_response text check (risk_response in ('mitigar', 'transferir', 'aceitar', 'evitar'));

-- ------------------------------------------------------------
-- Invitations: pending organization invite by e-mail. No e-mail
-- is actually sent — the admin communicates the invite out of
-- band; whoever logs in with that e-mail sees it and can accept.
-- ------------------------------------------------------------

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and length(email) > 0),
  role text not null check (role in ('admin', 'editor', 'commenter', 'reader')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Shareable link expiration: the invitation row's own `id` (already an
-- unguessable random uuid) doubles as the link token — see
-- get_invitation_preview below — so no separate token column is needed.
-- A convite sent 7 days ago and never accepted should stop working.
alter table public.invitations add column if not exists expires_at timestamptz not null default (now() + interval '7 days');

-- At most one PENDING invite per org+e-mail, via a partial index
-- (not a plain unique constraint including status, which would
-- collide on a second revoke-then-reinvite cycle for the same
-- e-mail once a prior 'revoked' row already exists).
create unique index if not exists invitations_org_email_pending_idx
  on public.invitations (organization_id, email)
  where status = 'pending';

-- ------------------------------------------------------------
-- Comments: project-scoped by default, optionally attached to one
-- note (note_id) — see PLANO-SOLUCAO-SAAS.md. Still create-only, no
-- edit/delete UI, no mentions/resolution (deliberately out of scope).
-- ------------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  author text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Optional link to a single note, so a comment can be a reply on that
-- note's own mini-thread instead of only the project-wide feed. Null
-- keeps today's behaviour (general project comment). On delete of the
-- note, its comments go with it — same cascade as everything else
-- scoped to a note.
alter table public.comments add column if not exists note_id uuid references public.notes (id) on delete cascade;

create index if not exists notes_project_id_idx on public.notes (project_id);
create index if not exists projects_organization_id_idx on public.projects (organization_id);
create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists invitations_email_idx on public.invitations (email);
create index if not exists invitations_organization_id_idx on public.invitations (organization_id);
create index if not exists comments_project_id_idx on public.comments (project_id);
create index if not exists comments_note_id_idx on public.comments (note_id) where note_id is not null;

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

-- Used to validate that a note-scoped comment's note_id actually
-- belongs to the project_id it is being inserted under (see
-- comments_insert_commenter below) — without this, a client could
-- attach a comment to project A while pointing note_id at a note
-- from an unrelated project B.
create or replace function public.note_project_id(target_note_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select project_id from public.notes where id = target_note_id;
$$;

-- Used by requirement_deliverable_links below to confirm each side of
-- a link actually points at a note in the block it is supposed to
-- (a "requirement" link pointing at a "why" note would be nonsensical).
create or replace function public.note_block_key(target_note_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select block_key from public.notes where id = target_note_id;
$$;

create or replace function public.is_org_admin(target_org_id uuid)
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
      and role = 'admin'
  );
$$;

create or replace function public.is_org_commenter(target_org_id uuid)
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
      and role in ('admin', 'editor', 'commenter')
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_editor(uuid) from public;
revoke all on function public.project_organization_id(uuid) from public;
revoke all on function public.note_project_id(uuid) from public;
revoke all on function public.note_block_key(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.is_org_commenter(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_editor(uuid) to authenticated;
grant execute on function public.project_organization_id(uuid) to authenticated;
grant execute on function public.note_project_id(uuid) to authenticated;
grant execute on function public.note_block_key(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_commenter(uuid) to authenticated;

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
-- Accept invitation RPC: creates the membership and marks the
-- invitation accepted, atomically, validating that the invite
-- belongs to the caller's e-mail.
-- ------------------------------------------------------------

create or replace function public.accept_invitation(invitation_id uuid)
returns public.memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invite public.invitations;
  new_membership public.memberships;
begin
  select * into invite from public.invitations where id = invitation_id for update;

  if invite is null then
    raise exception 'Convite nao encontrado.';
  end if;
  if invite.status <> 'pending' then
    raise exception 'Convite ja foi utilizado ou revogado.';
  end if;
  if invite.expires_at < now() then
    raise exception 'Este convite expirou. Peca para o administrador enviar um novo.';
  end if;
  if invite.email <> lower(auth.email()) then
    raise exception 'Este convite pertence a outro e-mail.';
  end if;

  update public.invitations set status = 'accepted', accepted_at = now() where id = invitation_id;

  insert into public.memberships (organization_id, user_id, role)
  values (invite.organization_id, auth.uid(), invite.role)
  on conflict (organization_id, user_id) do update set role = excluded.role
  returning * into new_membership;

  return new_membership;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ------------------------------------------------------------
-- Invitation link preview RPC: lets the shareable invite link
-- (?invite=<id>) show "you were invited to <org> as <role>" before
-- the visitor has logged in (or while logged into a different org,
-- whose membership RLS would otherwise hide this row). Same trust
-- model as get_public_canvas_version below — the invitation id is
-- itself an unguessable uuid, and this returns only what the landing
-- screen needs, never the full row.
-- ------------------------------------------------------------

create or replace function public.get_invitation_preview(target_invitation_id uuid)
returns table (
  organization_name text,
  role text,
  email text,
  status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.name, i.role, i.email, i.status, i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.id = target_invitation_id;
$$;

revoke all on function public.get_invitation_preview(uuid) from public;
grant execute on function public.get_invitation_preview(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- List org members RPC: joins memberships to auth.users, which
-- client-side RLS cannot reach directly.
-- ------------------------------------------------------------

create or replace function public.list_org_members(target_org_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.user_id, u.email, u.raw_user_meta_data ->> 'full_name', m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.organization_id = target_org_id
    and public.is_org_member(target_org_id)
  order by m.created_at asc;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

-- ------------------------------------------------------------
-- Row level security
-- ------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.notes enable row level security;
alter table public.invitations enable row level security;
alter table public.comments enable row level security;

-- organizations: readable by members, plus by anyone with a pending
-- invitation to it (so the invite-acceptance screen can show the
-- organization name before the user has a membership row). No client
-- insert/update/delete policy exists — writes only happen inside
-- create_organization_with_owner (runs as table owner, bypasses RLS).
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (
    public.is_org_member(id)
    or exists (
      select 1 from public.invitations
      where invitations.organization_id = organizations.id
        and invitations.email = lower(auth.email())
        and invitations.status = 'pending'
    )
  );

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

-- invitations: org admin reads/manages; the invited person (not yet
-- a member) reads only their own pending invite by e-mail.
drop policy if exists "invitations_select_admin_or_invitee" on public.invitations;
create policy "invitations_select_admin_or_invitee"
  on public.invitations for select
  to authenticated
  using (public.is_org_admin(organization_id) or email = lower(auth.email()));

drop policy if exists "invitations_insert_admin" on public.invitations;
create policy "invitations_insert_admin"
  on public.invitations for insert
  to authenticated
  with check (public.is_org_admin(organization_id) and invited_by = auth.uid());

-- Only admins update (revoke) directly from the client. Acceptance
-- runs inside accept_invitation, which is security definer and
-- bypasses RLS — the invitee does not need (and should not have)
-- direct update rights on the row.
drop policy if exists "invitations_update_admin" on public.invitations;
create policy "invitations_update_admin"
  on public.invitations for update
  to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- comments: any org member reads; commenter/editor/admin write;
-- reader stays read-only. No update/delete policy this round —
-- comments are create-only in the UI.
drop policy if exists "comments_select_member" on public.comments;
create policy "comments_select_member"
  on public.comments for select
  to authenticated
  using (public.is_org_member(public.project_organization_id(project_id)));

drop policy if exists "comments_insert_commenter" on public.comments;
create policy "comments_insert_commenter"
  on public.comments for insert
  to authenticated
  with check (
    public.is_org_commenter(public.project_organization_id(project_id))
    and created_by = auth.uid()
    and (note_id is null or public.note_project_id(note_id) = project_id)
  );

-- ------------------------------------------------------------
-- Project lock: once a project's status is 'APROVADO' or
-- 'EM_EXECUCAO', its own fields and its notes are frozen until "Nova
-- versão" resets status back to 'RASCUNHO'. 'EM_VALIDACAO' is NOT
-- locked — it is an intermediate review step, and block-level
-- approval already covers freezing individual blocks during review.
-- Comments are intentionally excluded from the lock at every status.
-- ------------------------------------------------------------

create or replace function public.project_is_locked(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select status in ('APROVADO', 'EM_EXECUCAO') from public.projects where id = target_project_id;
$$;

revoke all on function public.project_is_locked(uuid) from public;
grant execute on function public.project_is_locked(uuid) to authenticated;

-- Trigger, not RLS: an UPDATE that doesn't touch `status` at all
-- (e.g. only manager_name changes) leaves NEW.status equal to
-- OLD.status, so a plain USING/WITH CHECK comparison can't tell
-- "still approved" apart from "never was approved" — only a
-- BEFORE trigger sees OLD and NEW together to make that call.
-- Archiving is a lifecycle action, not a content edit, so it is
-- explicitly exempt from the lock check below: an update that only
-- touches archived_at (name/manager/version all unchanged) is let
-- through even while the project is locked. Anything that also
-- touches those content fields still gets rejected as before. Moving
-- between the two locked statuses (APROVADO -> EM_EXECUCAO, "Iniciar
-- execução") is itself a status-only change, so it passes through
-- unblocked — only content changes while locked are rejected.
create or replace function public.enforce_project_lock()
returns trigger
language plpgsql
as $$
declare
  old_locked boolean := old.status in ('APROVADO', 'EM_EXECUCAO');
  new_locked boolean := new.status in ('APROVADO', 'EM_EXECUCAO');
begin
  if old_locked and new_locked
     and (old.name, old.manager_name, old.manager_user_id, old.version)
         is distinct from (new.name, new.manager_name, new.manager_user_id, new.version)
  then
    raise exception 'Projeto aprovado esta travado. Crie uma nova versao para editar.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_project_lock on public.projects;
create trigger enforce_project_lock
  before update on public.projects
  for each row execute function public.enforce_project_lock();

-- notes: adds the lock check alongside the existing editor check.
-- INSERT/UPDATE get it in WITH CHECK (always raises a real,
-- catchable error on rejection). DELETE only has USING, so a
-- blocked delete is a silent 0-rows no-op — inherent to RLS, not
-- fixable here; the UI already hides the delete action when locked.
drop policy if exists "notes_insert_editor" on public.notes;
create policy "notes_insert_editor"
  on public.notes for insert
  to authenticated
  with check (
    public.is_org_editor(public.project_organization_id(project_id))
    and created_by = auth.uid()
    and not public.project_is_locked(project_id)
  );

drop policy if exists "notes_update_editor" on public.notes;
create policy "notes_update_editor"
  on public.notes for update
  to authenticated
  using (public.is_org_editor(public.project_organization_id(project_id)))
  with check (
    public.is_org_editor(public.project_organization_id(project_id))
    and not public.project_is_locked(project_id)
  );

drop policy if exists "notes_delete_editor" on public.notes;
create policy "notes_delete_editor"
  on public.notes for delete
  to authenticated
  using (
    public.is_org_editor(public.project_organization_id(project_id))
    and not public.project_is_locked(project_id)
  );

-- ------------------------------------------------------------
-- Audit trail: who did what, and where. Populated only by the
-- trigger functions below (security definer, bypass RLS) — no
-- client insert/update/delete policy exists. Summaries are built
-- on the frontend from (action, block_key) + blockMeta, not
-- baked into a sentence here, so wording/localization lives in
-- one place.
-- ------------------------------------------------------------

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor uuid references auth.users (id) on delete set null,
  actor_label text not null default '',
  action text not null check (action in ('note_created', 'note_updated', 'note_deleted', 'project_approved', 'project_new_version')),
  block_key text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_project_id_idx on public.audit_events (project_id);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select_member" on public.audit_events;
create policy "audit_events_select_member"
  on public.audit_events for select
  to authenticated
  using (public.is_org_member(public.project_organization_id(project_id)));

create or replace function public.current_actor_label()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1), 'Alguem')
  from auth.users u
  where u.id = auth.uid();
$$;

revoke all on function public.current_actor_label() from public;
grant execute on function public.current_actor_label() to authenticated;

create or replace function public.log_note_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (project_id, actor, actor_label, action, block_key)
    values (new.project_id, auth.uid(), actor_label, 'note_created', new.block_key);
  elsif tg_op = 'UPDATE' then
    insert into public.audit_events (project_id, actor, actor_label, action, block_key)
    values (new.project_id, auth.uid(), actor_label, 'note_updated', new.block_key);
  elsif tg_op = 'DELETE' then
    insert into public.audit_events (project_id, actor, actor_label, action, block_key)
    values (old.project_id, auth.uid(), actor_label, 'note_deleted', old.block_key);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_note_audit_event on public.notes;
create trigger log_note_audit_event
  after insert or update or delete on public.notes
  for each row execute function public.log_note_audit_event();

create or replace function public.log_project_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
begin
  if new.status = 'EM_VALIDACAO' and old.status not in ('EM_VALIDACAO', 'APROVADO', 'EM_EXECUCAO') then
    insert into public.audit_events (project_id, actor, actor_label, action)
    values (new.id, auth.uid(), actor_label, 'project_submitted');
  elsif new.status = 'APROVADO' and old.status <> 'APROVADO' then
    insert into public.audit_events (project_id, actor, actor_label, action)
    values (new.id, auth.uid(), actor_label, 'project_approved');
  elsif new.status = 'EM_EXECUCAO' and old.status <> 'EM_EXECUCAO' then
    insert into public.audit_events (project_id, actor, actor_label, action)
    values (new.id, auth.uid(), actor_label, 'project_execution_started');
  elsif old.status in ('APROVADO', 'EM_EXECUCAO') and new.status not in ('APROVADO', 'EM_EXECUCAO') then
    insert into public.audit_events (project_id, actor, actor_label, action)
    values (new.id, auth.uid(), actor_label, 'project_new_version');
  elsif new.status = 'RASCUNHO' and old.status = 'EM_VALIDACAO' then
    insert into public.audit_events (project_id, actor, actor_label, action)
    values (new.id, auth.uid(), actor_label, 'project_returned_to_draft');
  elsif new.archived_at is not null and old.archived_at is null then
    insert into public.audit_events (project_id, actor, actor_label, action)
    values (new.id, auth.uid(), actor_label, 'project_archived');
  elsif new.archived_at is null and old.archived_at is not null then
    insert into public.audit_events (project_id, actor, actor_label, action)
    values (new.id, auth.uid(), actor_label, 'project_restored');
  end if;
  return new;
end;
$$;

-- Runs AFTER update, so it only fires once enforce_project_lock (a
-- BEFORE trigger) has let the update through — a rejected/blocked
-- update never reaches here, which is correct: nothing to log.
drop trigger if exists log_project_audit_event on public.projects;
create trigger log_project_audit_event
  after update on public.projects
  for each row execute function public.log_project_audit_event();

-- ------------------------------------------------------------
-- Canvas versions: an immutable snapshot of a project's notes,
-- captured every time it transitions into APROVADO. The lock
-- (enforce_project_lock) stops approved content from being edited,
-- but "Nova versão" resets status back to RASCUNHO and lets editing
-- resume — without a separate copy, whatever was approved would not
-- be preserved anywhere once someone rewrites notes in the next
-- draft cycle.
-- ------------------------------------------------------------

create table if not exists public.canvas_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version numeric(6, 1) not null,
  project_name text not null,
  manager_name text not null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_by_label text not null,
  notes_snapshot jsonb not null,
  approved_at timestamptz not null default now()
);

create index if not exists canvas_versions_project_idx on public.canvas_versions (project_id, approved_at desc);

-- Unguessable per-version token for the public read-only share link
-- (see get_public_canvas_version below). Generated automatically for
-- every version, published or not — nothing is reachable without the
-- exact token, so there is no separate "publish" toggle to manage.
alter table public.canvas_versions add column if not exists share_token uuid not null default gen_random_uuid() unique;

alter table public.canvas_versions enable row level security;

drop policy if exists "canvas_versions_select_member" on public.canvas_versions;
create policy "canvas_versions_select_member"
  on public.canvas_versions for select
  to authenticated
  using (public.is_org_member(public.project_organization_id(project_id)));

-- No insert/update/delete policy for authenticated: rows are only
-- ever written by the security-definer trigger below, same pattern
-- as audit_events.

create or replace function public.snapshot_canvas_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
  snapshot jsonb;
begin
  if new.status = 'APROVADO' and old.status <> 'APROVADO' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'block_key', n.block_key,
      'text', n.text,
      'author', n.author,
      'color', n.color,
      'status', n.status
    ) order by n.created_at), '[]'::jsonb)
    into snapshot
    from public.notes n
    where n.project_id = new.id;

    insert into public.canvas_versions (project_id, version, project_name, manager_name, approved_by, approved_by_label, notes_snapshot)
    values (new.id, new.version, new.name, new.manager_name, auth.uid(), actor_label, snapshot);
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_canvas_version on public.projects;
create trigger snapshot_canvas_version
  after update on public.projects
  for each row execute function public.snapshot_canvas_version();

-- ------------------------------------------------------------
-- Block-level approval: an editor can approve/unapprove a single
-- canvas block independently of the whole-project approval (see
-- "Project lock" above). Approving a block freezes only its own
-- notes; the rest of the canvas stays editable. A row in
-- block_approvals means "this block is approved" — there is no
-- boolean flag, approve = insert, unapprove = delete, same idiom
-- as comments/audit_events (create-only rows, no update policy).
-- Whole-project approval stays independent of this: you can approve
-- the entire project without approving every block first, and vice
-- versa — chaining the two would be extra complexity nobody asked for.
-- ------------------------------------------------------------

-- One row per person who approved a given block (not one row per
-- block): approving is "insert my own row", unapproving is "delete
-- my own row". When a block has no configured required approvers
-- (block_approval_requirements below), a single approval from anyone
-- still locks it — the original behaviour, kept as the default so
-- existing approved blocks and templates keep working unchanged.
create table if not exists public.block_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  block_key text not null check (block_key in (
    'why', 'objectives', 'benefits', 'product', 'requirements',
    'stakeholders', 'team', 'assumptions', 'deliverables',
    'constraints', 'risks', 'timeline', 'costs'
  )),
  approved_by uuid references auth.users (id) on delete set null default auth.uid(),
  approved_by_label text not null default '',
  approved_at timestamptz not null default now()
);

-- Was unique(project_id, block_key) (one approval per block); moved
-- to unique(project_id, block_key, approved_by) so several people can
-- each approve the same block. Drop-then-add on every run so this is
-- safe whether the table is brand new or already has the old shape.
alter table public.block_approvals drop constraint if exists block_approvals_project_id_block_key_key;
alter table public.block_approvals drop constraint if exists block_approvals_project_id_block_key_approved_by_key;
alter table public.block_approvals add constraint block_approvals_project_id_block_key_approved_by_key unique (project_id, block_key, approved_by);

create index if not exists block_approvals_project_id_idx on public.block_approvals (project_id);

alter table public.block_approvals enable row level security;

drop policy if exists "block_approvals_select_member" on public.block_approvals;
create policy "block_approvals_select_member"
  on public.block_approvals for select
  to authenticated
  using (public.is_org_member(public.project_organization_id(project_id)));

drop policy if exists "block_approvals_insert_editor" on public.block_approvals;
create policy "block_approvals_insert_editor"
  on public.block_approvals for insert
  to authenticated
  with check (
    public.is_org_editor(public.project_organization_id(project_id))
    and approved_by = auth.uid()
    and not public.project_is_locked(project_id)
  );

-- Delete: anyone can retract their own approval; an admin can also
-- clear someone else's (e.g. a stakeholder who left the org) so a
-- block never gets stuck waiting on an approval nobody can undo.
-- Named "block_approvals_delete_editor" in an earlier revision; the
-- drop below targets both names so a database that already has the
-- old-named policy (from before this rename) gets it cleared too,
-- while re-runs after this fix drop-and-recreate cleanly either way.
drop policy if exists "block_approvals_delete_editor" on public.block_approvals;
drop policy if exists "block_approvals_delete_own_or_admin" on public.block_approvals;
create policy "block_approvals_delete_own_or_admin"
  on public.block_approvals for delete
  to authenticated
  using (
    public.is_org_editor(public.project_organization_id(project_id))
    and not public.project_is_locked(project_id)
    and (approved_by = auth.uid() or public.is_org_admin(public.project_organization_id(project_id)))
  );

-- ------------------------------------------------------------
-- Multi-stakeholder approval: optionally, a block can require
-- specific people to approve it (instead of "anyone, once"). A row
-- here means "user_id must approve this block for it to lock".
-- No rows for a block = old binary behaviour (see block_is_locked).
-- Requirements are a governance setting, not an approval decision,
-- so "Nova versão" does NOT clear them (clear_block_approvals_on_new_version
-- only clears block_approvals) — the same stakeholders are expected
-- to sign off again on the next version.
-- ------------------------------------------------------------

create table if not exists public.block_approval_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  block_key text not null check (block_key in (
    'why', 'objectives', 'benefits', 'product', 'requirements',
    'stakeholders', 'team', 'assumptions', 'deliverables',
    'constraints', 'risks', 'timeline', 'costs'
  )),
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (project_id, block_key, user_id)
);

create index if not exists block_approval_requirements_project_id_idx on public.block_approval_requirements (project_id);

alter table public.block_approval_requirements enable row level security;

create or replace function public.is_user_org_member(target_org_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = target_org_id and user_id = target_user_id
  );
$$;

revoke all on function public.is_user_org_member(uuid, uuid) from public;
grant execute on function public.is_user_org_member(uuid, uuid) to authenticated;

drop policy if exists "block_approval_requirements_select_member" on public.block_approval_requirements;
create policy "block_approval_requirements_select_member"
  on public.block_approval_requirements for select
  to authenticated
  using (public.is_org_member(public.project_organization_id(project_id)));

drop policy if exists "block_approval_requirements_insert_editor" on public.block_approval_requirements;
create policy "block_approval_requirements_insert_editor"
  on public.block_approval_requirements for insert
  to authenticated
  with check (
    public.is_org_editor(public.project_organization_id(project_id))
    and added_by = auth.uid()
    and not public.project_is_locked(project_id)
    and public.is_user_org_member(public.project_organization_id(project_id), user_id)
  );

drop policy if exists "block_approval_requirements_delete_editor" on public.block_approval_requirements;
create policy "block_approval_requirements_delete_editor"
  on public.block_approval_requirements for delete
  to authenticated
  using (
    public.is_org_editor(public.project_organization_id(project_id))
    and not public.project_is_locked(project_id)
  );

-- A block locks when: it has required approvers and every one of
-- them has an approval row, OR it has no required approvers and at
-- least one approval row exists (the original binary behaviour).
create or replace function public.block_is_locked(target_project_id uuid, target_block_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when exists (
      select 1 from public.block_approval_requirements
      where project_id = target_project_id and block_key = target_block_key
    ) then not exists (
      select 1 from public.block_approval_requirements r
      where r.project_id = target_project_id and r.block_key = target_block_key
        and not exists (
          select 1 from public.block_approvals a
          where a.project_id = r.project_id and a.block_key = r.block_key and a.approved_by = r.user_id
        )
    )
    else exists (
      select 1 from public.block_approvals
      where project_id = target_project_id and block_key = target_block_key
    )
  end;
$$;

revoke all on function public.block_is_locked(uuid, text) from public;
grant execute on function public.block_is_locked(uuid, text) to authenticated;

-- notes: third revision of these three policies (see "Project lock"
-- above for the second) — adds the per-block lock alongside the
-- project-wide one, so an approved block freezes its own notes even
-- while the rest of the project stays editable.
drop policy if exists "notes_insert_editor" on public.notes;
create policy "notes_insert_editor"
  on public.notes for insert
  to authenticated
  with check (
    public.is_org_editor(public.project_organization_id(project_id))
    and created_by = auth.uid()
    and not public.project_is_locked(project_id)
    and not public.block_is_locked(project_id, block_key)
  );

drop policy if exists "notes_update_editor" on public.notes;
create policy "notes_update_editor"
  on public.notes for update
  to authenticated
  using (public.is_org_editor(public.project_organization_id(project_id)))
  with check (
    public.is_org_editor(public.project_organization_id(project_id))
    and not public.project_is_locked(project_id)
    and not public.block_is_locked(project_id, block_key)
  );

drop policy if exists "notes_delete_editor" on public.notes;
create policy "notes_delete_editor"
  on public.notes for delete
  to authenticated
  using (
    public.is_org_editor(public.project_organization_id(project_id))
    and not public.project_is_locked(project_id)
    and not public.block_is_locked(project_id, block_key)
  );

-- audit_events: extend the allowed actions to cover block approval and
-- project archive/restore (the latter logged by log_project_audit_event
-- above, which already inserts these values).
alter table public.audit_events drop constraint if exists audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in ('note_created', 'note_updated', 'note_deleted', 'project_approved', 'project_new_version', 'block_approved', 'block_unapproved', 'project_archived', 'project_restored', 'project_submitted', 'project_execution_started', 'project_returned_to_draft', 'requirement_linked', 'requirement_unlinked'));

create or replace function public.log_block_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (project_id, actor, actor_label, action, block_key)
    values (new.project_id, auth.uid(), actor_label, 'block_approved', new.block_key);
  elsif tg_op = 'DELETE' then
    insert into public.audit_events (project_id, actor, actor_label, action, block_key)
    values (old.project_id, auth.uid(), actor_label, 'block_unapproved', old.block_key);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_block_audit_event on public.block_approvals;
create trigger log_block_audit_event
  after insert or delete on public.block_approvals
  for each row execute function public.log_block_audit_event();

-- Starting a new version (project leaves the locked group entirely —
-- APROVADO/EM_EXECUCAO -> RASCUNHO) also releases every block-level
-- approval — otherwise a block could stay frozen forever across
-- version cycles even after the project itself unlocked. Moving
-- APROVADO -> EM_EXECUCAO ("Iniciar execução") does NOT clear these:
-- the project is still locked, nothing was reopened for editing. The
-- delete below re-fires log_block_audit_event for each released
-- block, so the "who released what" trail is automatic.
create or replace function public.clear_block_approvals_on_new_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('APROVADO', 'EM_EXECUCAO') and new.status not in ('APROVADO', 'EM_EXECUCAO') then
    delete from public.block_approvals where project_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_block_approvals_on_new_version on public.projects;
create trigger clear_block_approvals_on_new_version
  after update on public.projects
  for each row execute function public.clear_block_approvals_on_new_version();

-- ------------------------------------------------------------
-- Requirement <-> deliverable links (secao 7 do plano: "um requisito
-- deve poder ser associado a pelo menos um grupo de entregas"). Many
-- to many: a row means "this requirement note is linked to this
-- deliverable note". "Deve poder" (must be ABLE to) is read as a
-- capability, not a hard constraint — the UI nudges with a badge when
-- a requirement has zero links, it does not block saving one without.
-- ------------------------------------------------------------

create table if not exists public.requirement_deliverable_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  requirement_note_id uuid not null references public.notes (id) on delete cascade,
  deliverable_note_id uuid not null references public.notes (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (requirement_note_id, deliverable_note_id)
);

create index if not exists requirement_deliverable_links_project_id_idx on public.requirement_deliverable_links (project_id);
create index if not exists requirement_deliverable_links_requirement_idx on public.requirement_deliverable_links (requirement_note_id);
create index if not exists requirement_deliverable_links_deliverable_idx on public.requirement_deliverable_links (deliverable_note_id);

alter table public.requirement_deliverable_links enable row level security;

drop policy if exists "requirement_deliverable_links_select_member" on public.requirement_deliverable_links;
create policy "requirement_deliverable_links_select_member"
  on public.requirement_deliverable_links for select
  to authenticated
  using (public.is_org_member(public.project_organization_id(project_id)));

-- Both notes must actually belong to this project and to the block
-- their side of the link implies — without this, a client could link
-- notes from an unrelated project, or link two "why" notes together.
drop policy if exists "requirement_deliverable_links_insert_editor" on public.requirement_deliverable_links;
create policy "requirement_deliverable_links_insert_editor"
  on public.requirement_deliverable_links for insert
  to authenticated
  with check (
    public.is_org_editor(public.project_organization_id(project_id))
    and created_by = auth.uid()
    and not public.project_is_locked(project_id)
    and not public.block_is_locked(project_id, 'requirements')
    and not public.block_is_locked(project_id, 'deliverables')
    and public.note_project_id(requirement_note_id) = project_id
    and public.note_project_id(deliverable_note_id) = project_id
    and public.note_block_key(requirement_note_id) = 'requirements'
    and public.note_block_key(deliverable_note_id) = 'deliverables'
  );

drop policy if exists "requirement_deliverable_links_delete_editor" on public.requirement_deliverable_links;
create policy "requirement_deliverable_links_delete_editor"
  on public.requirement_deliverable_links for delete
  to authenticated
  using (
    public.is_org_editor(public.project_organization_id(project_id))
    and not public.project_is_locked(project_id)
    and not public.block_is_locked(project_id, 'requirements')
    and not public.block_is_locked(project_id, 'deliverables')
  );

create or replace function public.log_requirement_link_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (project_id, actor, actor_label, action, block_key)
    values (new.project_id, auth.uid(), actor_label, 'requirement_linked', 'requirements');
  elsif tg_op = 'DELETE' then
    insert into public.audit_events (project_id, actor, actor_label, action, block_key)
    values (old.project_id, auth.uid(), actor_label, 'requirement_unlinked', 'requirements');
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_requirement_link_audit_event on public.requirement_deliverable_links;
create trigger log_requirement_link_audit_event
  after insert or delete on public.requirement_deliverable_links
  for each row execute function public.log_requirement_link_audit_event();

-- ------------------------------------------------------------
-- Public read-only share link: exposes exactly one approved
-- version's snapshot to anyone with the token, no login required.
-- Deliberately narrow — this function is the ONLY thing granted to
-- the anon role in the whole schema. It does not touch RLS on
-- projects/notes/canvas_versions at all (those stay authenticated-
-- only); it just returns a hand-picked subset of one row matched by
-- an unguessable uuid, the same shape as a normal API response.
-- ------------------------------------------------------------

create or replace function public.get_public_canvas_version(token uuid)
returns table (
  project_name text,
  manager_name text,
  version numeric,
  approved_at timestamptz,
  notes_snapshot jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cv.project_name, cv.manager_name, cv.version, cv.approved_at, cv.notes_snapshot
  from public.canvas_versions cv
  where cv.share_token = token;
$$;

revoke all on function public.get_public_canvas_version(uuid) from public;
grant execute on function public.get_public_canvas_version(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Realtime: broadcast row changes for projects, notes, comments,
-- block approvals, required-approver assignments and requirement
-- <-> deliverable links.
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
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'block_approvals'
  ) then
    alter publication supabase_realtime add table public.block_approvals;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'block_approval_requirements'
  ) then
    alter publication supabase_realtime add table public.block_approval_requirements;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requirement_deliverable_links'
  ) then
    alter publication supabase_realtime add table public.requirement_deliverable_links;
  end if;
end $$;
