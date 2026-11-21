-- ============================================================
-- 潘琰工作台 · GitHub Pages 静态版数据空间
-- 在 Supabase 控制台 → SQL Editor → New query 中整段执行
-- 说明：这是静态版专用表，不会改动原 MVC 应用的 users / usermodules 表
-- ============================================================

create table if not exists public.workbench_pages (
  module     text primary key,
  data       jsonb not null default '[]'::jsonb,
  version    bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.workbench_pages enable row level security;

-- 简单共享模式：拿到 anon key 的人都能读写（只放无隐私的学习数据）
drop policy if exists "workbench_pages_anon_all" on public.workbench_pages;
create policy "workbench_pages_anon_all"
on public.workbench_pages
for all
to anon
using (true)
with check (true);

grant usage on schema public to anon;
grant select, insert, update, delete on public.workbench_pages to anon;

-- 初始化 10 个模块；已有的行不会被覆盖
insert into public.workbench_pages (module, data, version) values
  ('words',    '[]'::jsonb, 1),
  ('tasks',    '[]'::jsonb, 1),
  ('courses',  '[]'::jsonb, 1),
  ('videos',   '[]'::jsonb, 1),
  ('inbox',    '[]'::jsonb, 1),
  ('notes',    '[]'::jsonb, 1),
  ('finance',  '[]'::jsonb, 1),
  ('links',    '[]'::jsonb, 1),
  ('settings', '{}'::jsonb, 1),
  ('stats',    '{}'::jsonb, 1)
on conflict (module) do nothing;
