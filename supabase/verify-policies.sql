-- ============================================================================
-- G1 验收查询：逐条核对 pg_policies，每条策略的 USING / WITH CHECK
-- 必须含 auth.uid() 或 is_album_member() / is_my_member() 过滤（不是只数条数）。
-- 用法：把本文件内容整段贴进 Supabase SQL Editor 运行，把结果贴回给 77。
-- ============================================================================

-- ---------- 1) 逐条策略核对（using_ok / withcheck_ok 应为 true）----------
select
  schemaname,
  tablename,
  policyname,
  cmd,
  (qual       is null or qual       ~* 'auth\.uid\(\)|is_album_member|is_my_member') as using_ok,
  (with_check is null or with_check ~* 'auth\.uid\(\)|is_album_member|is_my_member') as withcheck_ok
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- ---------- 2) 汇总：任何一条不过，这里会出现非 0 行 ----------
select
  count(*) filter (where schemaname in ('public','storage')) as 策略总数,
  count(*) filter (where not (qual       is null or qual       ~* 'auth\.uid\(\)|is_album_member|is_my_member')) as using_不过,
  count(*) filter (where not (with_check is null or with_check ~* 'auth\.uid\(\)|is_album_member|is_my_member')) as withcheck_不过
from pg_policies
where schemaname in ('public', 'storage');

-- ---------- 3) 三条 SECURITY DEFINER 函数是否就位 ----------
select
  p.proname,
  case when p.prosecdef then 'SECURITY DEFINER' else 'INVOKER（错！）' end as 定义者
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_album_member', 'is_my_member', 'share_get')
order by p.proname;
