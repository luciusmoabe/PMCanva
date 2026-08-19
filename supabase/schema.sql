create table if not exists public.project_canvases (
  canvas_key text primary key,
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'EM VALIDAÇÃO',
  version numeric(4, 1) not null default 1.4,
  updated_at timestamptz not null default now()
);

alter table public.project_canvases enable row level security;

-- Demo policy for the unauthenticated prototype. Replace with organization membership
-- policies when Supabase Auth is enabled.
drop policy if exists "demo canvas read" on public.project_canvases;
create policy "demo canvas read"
  on public.project_canvases for select
  to anon, authenticated
  using (canvas_key = 'projectly-demo-canvas');

drop policy if exists "demo canvas write" on public.project_canvases;
create policy "demo canvas write"
  on public.project_canvases for insert
  to anon, authenticated
  with check (canvas_key = 'projectly-demo-canvas');

drop policy if exists "demo canvas update" on public.project_canvases;
create policy "demo canvas update"
  on public.project_canvases for update
  to anon, authenticated
  using (canvas_key = 'projectly-demo-canvas')
  with check (canvas_key = 'projectly-demo-canvas');

insert into public.project_canvases (canvas_key)
values ('projectly-demo-canvas')
on conflict (canvas_key) do nothing;
