-- Run in the Supabase SQL Editor to enable permanent project deletion.
-- Permanent deletion: only organization admins can delete projects.
grant delete on public.projects to authenticated;
drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin"
  on public.projects for delete
  to authenticated
  using (public.is_org_admin(organization_id));

create or replace function public.log_note_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
begin
  -- Cascading project deletion leaves no project to attach audit events to.
  if tg_op = 'DELETE' and not exists (select 1 from public.projects where id = old.project_id) then
    return old;
  end if;
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

create or replace function public.log_block_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
begin
  -- Cascading project deletion leaves no project to attach audit events to.
  if tg_op = 'DELETE' and not exists (select 1 from public.projects where id = old.project_id) then
    return old;
  end if;
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

create or replace function public.log_requirement_link_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_label text := public.current_actor_label();
begin
  -- Cascading project deletion leaves no project to attach audit events to.
  if tg_op = 'DELETE' and not exists (select 1 from public.projects where id = old.project_id) then
    return old;
  end if;
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
