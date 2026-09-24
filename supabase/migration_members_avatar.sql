-- 迁移：members 增加 avatar_url，存「果实（家人）的微信头像」。
-- 来源：2026-09-24 产品决定「账号用微信名，果实头像读取微信头像」。
-- 该列只被现有 members 的 SELECT 策略覆盖（树内成员可读全部列），无需新增 RLS。
-- 可重复执行（if not exists）。

alter table public.members add column if not exists avatar_url text;
