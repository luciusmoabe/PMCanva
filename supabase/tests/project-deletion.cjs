const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
// Run with: node supabase/tests/project-deletion.cjs <path-to-pglite-package>
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite')
;(async () => {
  const db = new PGlite()
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create function auth.email() returns text language sql stable as $$ select email from auth.users where id = auth.uid() $$;
    grant usage on schema auth to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `)
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .split('-- Realtime:')[0]
  await db.exec(schema)
  const patch = fs.readFileSync(path.join(__dirname, '../enable-project-deletion.sql'), 'utf8')
  await db.exec(patch)
  await db.exec(patch) // SQL patch must be safe to re-run.
  const ids = Array.from({length: 7}, (_, i) => `00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`)
  const [admin, editor, reader, outsider, org, project, otherProject] = ids
  await db.exec(`
    insert into auth.users(id,email) values ('${admin}','admin@test.local'),('${editor}','editor@test.local'),('${reader}','reader@test.local'),('${outsider}','outsider@test.local');
    select set_config('test.user_id','${admin}',false);
    insert into public.organizations(id,name) values ('${org}','Test');
    insert into public.memberships(organization_id,user_id,role) values ('${org}','${admin}','admin'),('${org}','${editor}','editor'),('${org}','${reader}','reader');
    insert into public.projects(id,organization_id,name) values ('${project}','${org}','Delete me'),('${otherProject}','${org}','Keep me');
    insert into public.notes(project_id,block_key,text) values ('${project}','requirements','Requirement'),('${project}','deliverables','Deliverable'),('${otherProject}','why','Keep');
    insert into public.comments(project_id,text,note_id) select '${project}','Comment',id from public.notes where project_id='${project}';
    insert into public.requirement_deliverable_links(project_id,requirement_note_id,deliverable_note_id) select '${project}',r.id,d.id from public.notes r,public.notes d where r.project_id='${project}' and r.block_key='requirements' and d.project_id='${project}' and d.block_key='deliverables';
    insert into public.block_approval_requirements(project_id,block_key,user_id) values ('${project}','requirements','${admin}');
    insert into public.block_approvals(project_id,block_key) values ('${project}','requirements');
    update public.projects set status='APROVADO' where id='${project}';
    grant select on all tables in schema public to authenticated;
  `)
  for (const user of [editor, reader, outsider]) {
    await db.exec(`select set_config('test.user_id','${user}',false); set role authenticated;`)
    const result = await db.query(`delete from public.projects where id='${project}' returning id`)
    assert.equal(result.rows.length, 0, 'Unauthorized user must not delete')
    await db.exec('reset role;')
  }
  await db.exec(`select set_config('test.user_id','${admin}',false); set role authenticated;`)
  const result = await db.query(`delete from public.projects where id='${project}' returning id`)
  assert.equal(result.rows.length, 1, 'Admin must delete even an approved project')
  await db.exec('reset role;')
  for (const table of ['notes','comments','audit_events','canvas_versions','block_approvals','block_approval_requirements','requirement_deliverable_links']) {
    const result = await db.query(`select count(*)::int as count from public.${table} where project_id='${project}'`)
    assert.equal(result.rows[0].count, 0, table + ' must cascade')
  }
  assert.equal((await db.query(`select count(*)::int as count from public.projects where id='${otherProject}'`)).rows[0].count, 1)
  // Ordinary note deletion must still emit an audit event.
  await db.exec(`delete from public.notes where project_id='${otherProject}';`)
  assert.equal((await db.query(`select count(*)::int as count from public.audit_events where project_id='${otherProject}' and action='note_deleted'`)).rows[0].count, 1)
  await db.close()
  console.log('PASS: admin deletion, denied editor/reader/outsider, cascades, audit, idempotent SQL.')
})().catch(error => { console.error(error); process.exitCode = 1 })
