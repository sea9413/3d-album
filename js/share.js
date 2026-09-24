/**
 * js/share.js —— 只读分享（S-A1 / S-A2 / 里程碑 8）
 *
 * 铁律 3：分享 token 必须 32 字节随机（crypto.getRandomValues），绝不用自增 id / 时间戳。
 * 铁律：生成分享链接走 RLS 自己的 insert（created_by = 当前用户）；读取走边缘函数 share-open，
 *       边缘函数内部只调 SECURITY DEFINER 的 share_get，全程不碰 service_role 密钥。
 */

import { sb, supabaseClient } from './supabase.js';
import { auth } from './auth.js';
import { SITE_BASE_URL, SHARE_PATH_PREFIX } from './config.js';

/** 32 字节随机十六进制 token（铁律 3）。 */
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
}

function shareUrl(token) {
  return SITE_BASE_URL + SHARE_PATH_PREFIX + token;
}

/** 生成独享本只读分享链接（member_id = null → 整本）。 */
export async function createSoloShare(albumId) {
  const token = randomToken();
  const me = await auth.getUser();
  const { data, error } = await sb.from('share_links').insert({
    album_id: albumId, token, created_by: me.id, member_id: null,
  }).select('token').single();
  if (error) throw error;
  return shareUrl(data.token);
}

/** 生成家族树只读分享链接。memberId 为空 = 整棵树，否则只分享某个果实。 */
export async function createTreeShare(albumId, memberId = null) {
  const token = randomToken();
  const me = await auth.getUser();
  const { data, error } = await sb.from('share_links').insert({
    album_id: albumId, token, created_by: me.id, member_id: memberId,
  }).select('token').single();
  if (error) throw error;
  return shareUrl(data.token);
}

/**
 * 通过边缘函数读取分享数据（匿名即可，函数内部走 SECURITY DEFINER）。
 * @returns {Promise<{album:object, members:Array, photos:Array}>}
 */
export async function fetchShare(token) {
  const { data, error } = await supabaseClient.functions.invoke('share-open', {
    method: 'POST',
    body: { token },
  });
  if (error) throw error;
  if (!data || data.ok === false) {
    const e = new Error((data && data.error) || 'LINK_INVALID');
    e.code = (data && data.error) || 'LINK_INVALID';
    throw e;
  }
  return data;
}
