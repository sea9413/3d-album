/**
 * js/db.js —— Postgres 数据访问（五张表）
 *
 * 全部走 RLS：每张查询都依赖当前登录态。无 session 时 Supabase 会直接拒绝。
 * 排序（R7）：order_index 以 ORDER_STEP 递增；插入两之间取中间值。这里只负责「取」与「写」，
 * 排序计算在上传/插入处完成。
 */

import { sb } from './supabase.js';
import {
  DEFAULT_SOLO_TITLE, DEFAULT_FAMILY_TITLE, DEFAULT_FOUNDER_RELATION,
  MAX_SOLO_ALBUM, MAX_FAMILY_ALBUM, ORDER_STEP,
} from './config.js';

async function me() {
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error('未登录');
  return data.user;
}

// ===================== albums =====================

/** 取或建独享本（每人最多 MAX_SOLO_ALBUM 本）。 */
export async function getOrCreateSoloAlbum() {
  const u = await me();
  const { data: existing } = await sb
    .from('albums').select('id').eq('owner_id', u.id).eq('kind', 'solo').limit(1);
  if (existing && existing.length) return existing[0].id;

  const { count } = await sb
    .from('albums').select('*', { count: 'exact', head: true })
    .eq('owner_id', u.id).eq('kind', 'solo');
  if (count >= MAX_SOLO_ALBUM) throw new Error(`独享本最多 ${MAX_SOLO_ALBUM} 本`);

  const { data, error } = await sb
    .from('albums').insert({ owner_id: u.id, kind: 'solo', title: DEFAULT_SOLO_TITLE })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

/** 种一棵家族树（每人最多 MAX_FAMILY_ALBUM 棵），并自动把建树者作为第一个果实。 */
export async function createFamilyAlbum(title, displayName) {
  const u = await me();
  const { count } = await sb
    .from('albums').select('*', { count: 'exact', head: true })
    .eq('owner_id', u.id).eq('kind', 'family');
  if (count >= MAX_FAMILY_ALBUM) throw new Error(`家族树最多 ${MAX_FAMILY_ALBUM} 棵`);

  const { data, error } = await sb
    .from('albums').insert({ owner_id: u.id, kind: 'family', title: title || DEFAULT_FAMILY_TITLE })
    .select('id').single();
  if (error) throw error;
  const albumId = data.id;

  // 建树者的微信名 / 头像取自 profiles，回退「我」
  const { data: prof } = await sb.from('profiles').select('display_name,avatar_url').eq('id', u.id).maybeSingle();
  const name = (displayName && displayName.trim()) || (prof && prof.display_name) || '我';
  const avatar = (prof && prof.avatar_url) || null;

  const { data: mem, error: e2 } = await sb
    .from('members').insert({
      album_id: albumId, user_id: u.id, display_name: name,
      relation: DEFAULT_FOUNDER_RELATION, generation: 0, order_index: 0,
      avatar_url: avatar,
    })
    .select('id').single();
  if (e2) throw e2;
  return { albumId, memberId: mem.id };
}

/** 列出我创建的家族树。 */
export async function listMyTrees() {
  const u = await me();
  const { data, error } = await sb
    .from('albums').select('id,title,kind,created_at')
    .eq('owner_id', u.id).eq('kind', 'family').order('created_at');
  if (error) throw error;
  return data;
}

/** 取整棵树（成员节点），按 order_index 排序。 */
export async function getTree(albumId) {
  const { data, error } = await sb
    .from('members').select('*').eq('album_id', albumId).order('order_index');
  if (error) throw error;
  return data;
}

/** 取树的基本信息。 */
export async function getAlbum(albumId) {
  const { data, error } = await sb.from('albums').select('*').eq('id', albumId).single();
  if (error) throw error;
  return data;
}

// ===================== members =====================

export async function addMember({ albumId, displayName, relation, parentMemberId }) {
  // order_index：同层最大 + ORDER_STEP
  const { data, error } = await sb
    .from('members').insert({
      album_id: albumId, display_name: displayName, relation: relation || null,
      parent_member_id: parentMemberId || null, order_index: 0,
    })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateMember(id, fields) {
  const { error } = await sb.from('members').update(fields).eq('id', id);
  if (error) throw error;
}

export async function removeMember(id) {
  const { error } = await sb.from('members').delete().eq('id', id);
  if (error) throw error;
}

// ===================== photos =====================

/** 列出相册照片；memberId 给定则只列该果实（独享本传 null）。 */
export async function listPhotos({ albumId, memberId }) {
  let q = sb.from('photos').select('*').eq('album_id', albumId);
  if (memberId) q = q.eq('member_id', memberId);
  const { data, error } = await q.order('order_index');
  if (error) throw error;
  return data;
}

/** 全家福：整棵树所有照片按 order_index 混排。 */
export async function listAllPhotos(albumId) {
  const { data, error } = await sb.from('photos').select('*').eq('album_id', albumId).order('order_index');
  if (error) throw error;
  return data;
}

/** 插入一张照片行（R8 第 3 步，前两步是压缩 + 上传）。 */
export async function insertPhotoRow(row) {
  const { data, error } = await sb.from('photos').insert({
    album_id: row.albumId,
    member_id: row.memberId || null,
    owner_id: row.ownerId,
    storage_path: row.storagePath,
    thumb_path: row.thumbPath,
    name: row.name || '',
    caption: row.caption || '',
    width: row.width,
    height: row.height,
    size_bytes: row.sizeBytes,
    order_index: row.orderIndex,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updatePhoto(id, fields) {
  const { error } = await sb.from('photos').update(fields).eq('id', id);
  if (error) throw error;
}

/** 删照片行（R8：先删 DB 行，再删 Storage 文件）。 */
export async function deletePhotoRow(id) {
  const { error } = await sb.from('photos').delete().eq('id', id);
  if (error) throw error;
}

// ===================== 邀请入伙 =====================

/**
 * 接受邀请：把当前登录用户绑到「尚未入伙（user_id 为 null）」的果实。
 * 依赖 schema.sql 里的 SECURITY DEFINER 函数 accept_invite(p_member_id)。
 * （该函数尚未重跑进库前，此调用会失败 —— 需主公确认后把函数落库。）
 */
export async function acceptInvite(memberId) {
  const { error } = await sb.rpc('accept_invite', { p_member_id: memberId });
  if (error) throw error;
}

/** 把当前用户自己的微信头像写进「我认领的那个果实」（满足「果实头像=微信头像」）。 */
export async function setMemberAvatar(memberId, avatarUrl) {
  const u = await me();
  const { error } = await sb.from('members')
    .update({ avatar_url: avatarUrl || null })
    .eq('id', memberId).eq('user_id', u.id);
  if (error) throw error;
}
