-- Run the ENTIRE file in the Supabase SQL Editor as postgres.
-- Requires two existing Auth accounts. No passwords or tokens are needed.
-- All fixtures and changes are rolled back. Do not replace ROLLBACK with COMMIT.
-- Tests installed RLS under authenticated; does not test browser login or JWT validation.
begin;

do $$
declare
  test_user_ids uuid[];
  actor uuid;
  other_org uuid;
  own_project uuid;
  other_project uuid;
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  project_a uuid := gen_random_uuid();
  project_b uuid := gen_random_uuid();
  affected integer;
  visible integer;
  denied boolean;
  table_name text;
  i integer;
begin
  select array_agg(id) into test_user_ids
  from (select id from auth.users order by created_at, id limit 2) accounts;
  if coalesce(array_length(test_user_ids, 1), 0) < 2 then
    raise exception 'Two Auth accounts are required. Create a second test account, then rerun.';
  end if;

  -- Audit triggers require an authenticated actor even during fixture setup.
  perform set_config('request.jwt.claim.sub', test_user_ids[1]::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', test_user_ids[1], 'role', 'authenticated',
    'email', (select email from auth.users where id = test_user_ids[1]))::text, true);

  insert into public.organizations(id, name)
  values (org_a, 'Temporary isolation test A'), (org_b, 'Temporary isolation test B');
  insert into public.memberships(organization_id, user_id, role)
  values (org_a, test_user_ids[1], 'admin'), (org_b, test_user_ids[2], 'admin');
  insert into public.projects(id, organization_id, name)
  values (project_a, org_a, 'Temporary project A'), (project_b, org_b, 'Temporary project B');
  insert into public.notes(project_id, block_key, text)
  values (project_a, 'why', 'Temporary A'), (project_b, 'why', 'Temporary B');
  insert into public.comments(project_id, text)
  values (project_a, 'Temporary A'), (project_b, 'Temporary B');

  for i in 1..2 loop
    actor := test_user_ids[i];
    other_org := case when i = 1 then org_b else org_a end;
    own_project := case when i = 1 then project_a else project_b end;
    other_project := case when i = 1 then project_b else project_a end;
    perform set_config('request.jwt.claim.sub', actor::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object(
      'sub', actor, 'role', 'authenticated',
      'email', (select email from auth.users where id = actor))::text, true);
    execute 'set local role authenticated';
    if current_user <> 'authenticated' or auth.uid() <> actor then
      raise exception 'User simulation failed';
    end if;

    select count(*) into visible from public.organizations where id in (org_a, org_b);
    if visible <> 1 then raise exception 'Organization visibility failed for account %', i; end if;
    select count(*) into visible from public.projects where id in (project_a, project_b);
    if visible <> 1 then raise exception 'Project visibility failed for account %', i; end if;
    foreach table_name in array array['notes', 'comments', 'audit_events'] loop
      execute format('select count(*) from public.%I where project_id = $1', table_name)
        into visible using other_project;
      if visible <> 0 then raise exception 'Cross-organization read allowed: %', table_name; end if;
    end loop;
    select count(*) into visible from public.notes where project_id = own_project;
    if visible <> 1 then raise exception 'Own notes unreadable'; end if;
    select count(*) into visible from public.comments where project_id = own_project;
    if visible <> 1 then raise exception 'Own comments unreadable'; end if;

    update public.projects set name = 'Authorized update' where id = own_project;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Own project update failed'; end if;
    update public.projects set name = 'Forbidden update' where id = other_project;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Cross-organization project update allowed'; end if;
    delete from public.projects where id = other_project;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Cross-organization project deletion allowed'; end if;
    update public.notes set text = 'Forbidden update' where project_id = other_project;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Cross-organization note update allowed'; end if;
    delete from public.notes where project_id = other_project;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Cross-organization note deletion allowed'; end if;

    denied := false;
    begin
      insert into public.projects(organization_id, name) values(other_org, 'Forbidden insert');
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Cross-organization project insertion allowed'; end if;
    denied := false;
    begin
      insert into public.notes(project_id, block_key, text) values(other_project, 'why', 'Forbidden insert');
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Cross-organization note insertion allowed'; end if;
    denied := false;
    begin
      update public.projects set organization_id = other_org where id = own_project;
    exception when insufficient_privilege then denied := true;
    end;
    if not denied then raise exception 'Project transfer to unauthorized organization allowed'; end if;
    execute 'reset role';
  end loop;
end;
$$;

rollback;
select 'PASS: installed RLS isolates two organizations; cross-organization reads and project/note writes denied; own project updates allowed; temporary data rolled back.' as result;
