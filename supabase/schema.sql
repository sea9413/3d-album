-- ============================================================================
-- 【3D旋转图册】v0.1.0 建表 SQL —— 幂等，可整段重跑（清单第 1 条）
-- 来源：开工令第四·4.2 节。请勿改动结构；改了必须整段重跑并重新跑 G1 验收。
-- 执行顺序不可调：辅助函数（SECURITY DEFINER）必须在策略之前创建。
-- ============================================================================

-- ============ 0. 先跑辅助函数（策略里要用，必须先于策略创建）============

-- 判定「我是否属于这个相册」：相册主人，或该树里已入伙的成员
-- 【关键】必须 security definer，否则 members 表的策略里再查 members 会触发
-- 「infinite recursion detected in policy」——这是本版最容易炸的点（见 7.4）
create or replace function public.is_album_member(p_album_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.albums a
    where a.id = p_album_id and a.owner_id = auth.uid()
  ) or exists (
    select 1 from public.members m
    where m.album_id = p_album_id and m.user_id = auth.uid()
  );
$$;

-- 判定「这个果实是不是我的」
create or replace function public.is_my_member(p_member_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.members m
    where m.id = p_member_id and m.user_id = auth.uid()
  );
$$;

-- 只读分享：按 token 取白名单数据（供匿名只读使用）
-- 【关键】只返回白名单字段，绝不返回 owner_id / user_id / created_by 等身份信息
create or replace function public.share_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link   public.share_links;
  v_result jsonb;
begin
  select * into v_link
    from public.share_links
   where token = p_token and revoked_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'LINK_INVALID');
  end if;

  select jsonb_build_object(
    'ok', true,
    'album', jsonb_build_object('title', a.title, 'kind', a.kind),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'display_name', m.display_name,
        'relation', m.relation,
        'generation', m.generation,
        'parent_member_id', m.parent_member_id,
        'order_index', m.order_index,
        'joined', (m.user_id is not null)
      ) order by m.order_index)
      from public.members m
      where m.album_id = a.id
        and (v_link.member_id is null or m.id = v_link.member_id)
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'member_id', p.member_id,
        'storage_path', p.storage_path,
        'thumb_path', p.thumb_path,
        'name', p.name,
        'caption', p.caption,
        'width', p.width,
        'height', p.height,
        'order_index', p.order_index
      ) order by p.order_index)
      from public.photos p
      where p.album_id = a.id
        and (v_link.member_id is null or p.member_id = v_link.member_id)
    ), '[]'::jsonb)
  ) into v_result
  from public.albums a
  where a.id = v_link.album_id;

  update public.share_links
     set view_count = view_count + 1
   where id = v_link.id;

  return v_result;
end;
$$;

-- 只允许登录用户调用两个权限判定函数；share_get 允许匿名调用（分享页必须能用）
revoke all on function public.is_album_member(uuid) from public;
revoke all on function public.is_my_member(uuid)    from public;
revoke all on function public.share_get(text)       from public;
grant execute on function public.is_album_member(uuid) to authenticated;
grant execute on function public.is_my_member(uuid)    to authenticated;
grant execute on function public.share_get(text)       to anon, authenticated;

-- 接受邀请：把当前登录用户绑到「尚未入伙（user_id 为 null）」的果实（家庭邀请入伙）
-- 【关键】必须 security definer：灰色果实 user_id 仍为 null，普通 UPDATE 会被 RLS 拒绝。
-- 只绑 user_id 为 null 的，避免把已入伙的果实抢走。
create or replace function public.accept_invite(p_member_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.members
     set user_id = auth.uid(), joined_at = now()
   where id = p_member_id and user_id is null;
$$;
revoke all on function public.accept_invite(uuid) from public;
grant execute on function public.accept_invite(uuid) to authenticated;


-- ============ 1. profiles ============
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles 本人可读" on public.profiles;
create policy "profiles 本人可读" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles 本人可插" on public.profiles;
create policy "profiles 本人可插" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles 本人可改" on public.profiles;
create policy "profiles 本人可改" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);


-- ============ 2. albums ============
create table if not exists public.albums (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  kind           text not null check (kind in ('solo','family')),
  title          text not null default '我的相册',
  cover_photo_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists albums_owner_idx on public.albums(owner_id);
alter table public.albums enable row level security;

-- 本人可读，或「我是这棵树里已入伙的成员」时可读（家人要能看到树）
drop policy if exists "albums 本人或树成员可读" on public.albums;
create policy "albums 本人或树成员可读" on public.albums
  for select using (
    auth.uid() = owner_id
    or public.is_album_member(albums.id)
  );

drop policy if exists "albums 本人可建" on public.albums;
create policy "albums 本人可建" on public.albums
  for insert with check (auth.uid() = owner_id);

drop policy if exists "albums 本人可改" on public.albums;
create policy "albums 本人可改" on public.albums
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "albums 本人可删" on public.albums;
create policy "albums 本人可删" on public.albums
  for delete using (auth.uid() = owner_id);


-- ============ 3. members ============
create table if not exists public.members (
  id               uuid primary key default gen_random_uuid(),
  album_id         uuid not null references public.albums(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  display_name     text not null,
  relation         text,
  generation       int not null default 0,
  parent_member_id uuid references public.members(id) on delete set null,
  order_index      int not null default 0,
  joined_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists members_album_idx  on public.members(album_id);
create index if not exists members_user_idx   on public.members(user_id);
create index if not exists members_parent_idx on public.members(parent_member_id);
alter table public.members enable row level security;

-- 用 SECURITY DEFINER 函数判定，避免策略自我递归
drop policy if exists "members 树内可读" on public.members;
create policy "members 树内可读" on public.members
  for select using (public.is_album_member(album_id));

-- 只有建树者能添加果实
drop policy if exists "members 建树者可插" on public.members;
create policy "members 建树者可插" on public.members
  for insert with check (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
  );

-- 建树者可改；成员本人也可改（应用层限制为只改自己的 display_name）
drop policy if exists "members 建树者或本人可改" on public.members;
create policy "members 建树者或本人可改" on public.members
  for update using (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
    or auth.uid() = members.user_id
  ) with check (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
    or auth.uid() = members.user_id
  );

drop policy if exists "members 建树者可删" on public.members;
create policy "members 建树者可删" on public.members
  for delete using (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
  );


-- ============ 4. photos ============
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums(id) on delete cascade,
  member_id    uuid references public.members(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  thumb_path   text not null,
  name         text default '',
  caption      text default '',
  width        int,
  height       int,
  size_bytes   bigint,
  order_index  double precision not null default 0,
  taken_at     timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists photos_album_idx  on public.photos(album_id);
create index if not exists photos_member_idx on public.photos(member_id);
create index if not exists photos_owner_idx  on public.photos(owner_id);
alter table public.photos enable row level security;

-- 看：树内 / 本人可看
drop policy if exists "photos 树内可读" on public.photos;
create policy "photos 树内可读" on public.photos
  for select using (public.is_album_member(album_id));

-- 传：只能传进自己有权的相册，且（家族树里）只能传进自己的果实
drop policy if exists "photos 只能传到自己的果实" on public.photos;
create policy "photos 只能传到自己的果实" on public.photos
  for insert with check (
    auth.uid() = owner_id
    and public.is_album_member(album_id)
    and (
      member_id is null                                  -- 独享本
      or public.is_my_member(member_id)                  -- 家族树只能传自己的果实
    )
  );

-- 改 / 删：只能动自己上传的
drop policy if exists "photos 只能改自己的" on public.photos;
create policy "photos 只能改自己的" on public.photos
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "photos 只能删自己的" on public.photos;
create policy "photos 只能删自己的" on public.photos
  for delete using (auth.uid() = owner_id);


-- ============ 5. share_links ============
create table if not exists public.share_links (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.albums(id) on delete cascade,
  member_id  uuid references public.members(id) on delete cascade,
  token      text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists share_links_album_idx on public.share_links(album_id);
create index if not exists share_links_token_idx on public.share_links(token);
alter table public.share_links enable row level security;

-- 【重要】share_links 绝不对 anon 开放任何策略。
-- 匿名访问一律走上面的 share_get() SECURITY DEFINER 函数。
drop policy if exists "share_links 本人可读" on public.share_links;
create policy "share_links 本人可读" on public.share_links
  for select using (auth.uid() = created_by);

drop policy if exists "share_links 本人可建" on public.share_links;
create policy "share_links 本人可建" on public.share_links
  for insert with check (
    auth.uid() = created_by
    and exists (select 1 from public.albums a
                where a.id = share_links.album_id and a.owner_id = auth.uid())
  );

-- 撤销 = update revoked_at
drop policy if exists "share_links 本人可改" on public.share_links;
create policy "share_links 本人可改" on public.share_links
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "share_links 本人可删" on public.share_links;
create policy "share_links 本人可删" on public.share_links
  for delete using (auth.uid() = created_by);


-- ============ 6. Storage 策略（bucket 需先在控制台建：photos，Private）============
drop policy if exists "photos 桶 会员可读" on storage.objects;
create policy "photos 桶 会员可读" on storage.objects
  for select using (
    bucket_id = 'photos'
    and public.is_album_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "photos 桶 会员可传" on storage.objects;
create policy "photos 桶 会员可传" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and public.is_album_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "photos 桶 本人可删" on storage.objects;
create policy "photos 桶 本人可删" on storage.objects
  for delete using (
    bucket_id = 'photos'
    and public.is_album_member(((storage.foldername(name))[1])::uuid)
  );
