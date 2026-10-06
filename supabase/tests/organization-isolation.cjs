const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
// Run with: node supabase/tests/organization-isolation.cjs <path-to-pglite-package>
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite')
;(async () => {
  const db = new PGlite()
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    create function auth.email() returns text language sql stable security definer as $$ select email from auth.users where id = auth.uid() $$;
    grant usage on schema auth to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `)
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8')
    .replace('create extension if not exists pgcrypto;', '')
    .split('-- Realtime:')[0]
  await db.exec(schema)

  const id = (n) => '00000000-0000-0000-0000-' + String(n).padStart(12,'0')
  const [a,b,shared,outsider,oa,ob,pa,pb] = Array.from({length:8},(_,i)=>id(i+1))
  await db.exec(`insert into auth.users(id,email) values ('${a}','a@test.local'),('${b}','b@test.local'),('${shared}','shared@test.local'),('${outsider}','outsider@test.local');
    select set_config('test.user_id','${a}',false);
    insert into public.organizations(id,name) values ('${oa}','A'),('${ob}','B');
    insert into public.memberships(organization_id,user_id,role) values ('${oa}','${a}','admin'),('${ob}','${b}','admin'),('${oa}','${shared}','editor'),('${ob}','${shared}','reader');
    insert into public.projects(id,organization_id,name) values ('${pa}','${oa}','Project A'),('${pb}','${ob}','Project B');
    insert into public.notes(project_id,block_key,text) values ('${pa}','why','A'),('${pb}','why','B');
    insert into public.comments(project_id,text) values ('${pa}','A'),('${pb}','B');
    grant select on all tables in schema public to authenticated;
    grant insert, update, delete on public.projects, public.notes to authenticated;`)
  for (const [user,expected] of [[a,1],[b,1],[shared,2],[outsider,0]]) {
    await db.exec(`select set_config('test.user_id','${user}',false); set role authenticated;`)
    for (const table of ['organizations','projects','notes','comments']) {
      assert.equal((await db.query('select count(*)::int as n from public.'+table)).rows[0].n,expected,table+' visibility')
    }
    if (user===a) {
      for(const table of ['projects','notes']) {
        const predicate=table==='projects'?'id':'project_id'
        assert.equal((await db.query(`update public.${table} set ${table==='projects'?'name':'text'}='Unauthorized' where ${predicate}='${pb}' returning id`)).rows.length,0,'Cross-org update')
        assert.equal((await db.query(`delete from public.${table} where ${predicate}='${pb}' returning id`)).rows.length,0,'Cross-org delete')
      }
      await assert.rejects(db.query(`insert into public.projects(organization_id,name) values ('${ob}','Unauthorized')`),'Cross-org insert')
      await assert.rejects(db.query(`insert into public.notes(project_id,block_key,text) values ('${pb}','why','Unauthorized')`),'Cross-org note insert')
      await assert.rejects(db.query(`update public.projects set organization_id='${ob}' where id='${pa}'`),'Cross-org project reassignment')
    }
    if (user===shared) {
      assert.equal((await db.query(`update public.projects set name='Editor allowed' where id='${pa}' returning id`)).rows.length,1,'Editor allowed in A')
      assert.equal((await db.query(`update public.projects set name='Reader forbidden' where id='${pb}' returning id`)).rows.length,0,'Reader denied in B')
    }
    await db.exec('reset role;')
  }
  await db.close()
  console.log('PASS: two organizations; isolated organizations/projects/notes/comments; cross-org insert/update/delete and reassignment denied; shared user editor in A and reader in B; outsider sees no data.')
})().catch(error=>{console.error(error);process.exitCode=1})
