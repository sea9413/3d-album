/**
 * js/storage.js —— Supabase Storage（私有桶 photos）
 *
 * 铁律 6：路径格式一经确定不可改，桶策略靠第一段（album_id）判定归属。
 *   固定为：photos/<albumId>/<memberId|solo>/<photoId>_full.webp
 *          photos/<albumId>/<memberId|solo>/<photoId>_thumb.webp
 * 铁律：桶必须 Private（M2-C 已建）；读取一律走短期签名 URL，绝不开 public。
 */

import { sb } from './supabase.js';
import { STORAGE_BUCKET, SIGNED_URL_TTL } from './config.js';

/** 计算原图 / 缩略图路径。memberId 为空（独享本）用字面量 'solo'。 */
export function photoPaths(albumId, memberId, photoId) {
  const seg = memberId || 'solo';
  return {
    full: `${albumId}/${seg}/${photoId}_full.webp`,
    thumb: `${albumId}/${seg}/${photoId}_thumb.webp`,
  };
}

/** 上传原图 + 缩略图一对（R8 第 2 步）。返回路径。 */
export async function uploadPair(albumId, memberId, photoId, fullBlob, thumbBlob) {
  const { full, thumb } = photoPaths(albumId, memberId, photoId);
  await uploadOne(full, fullBlob);
  await uploadOne(thumb, thumbBlob);
  return { full, thumb };
}

async function uploadOne(path, blob) {
  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: true, cacheControl: '3600' });
  if (error) throw error;
}

/** R8 回滚：删除一对文件（DB 插入失败时调用）。 */
export async function removePair(paths) {
  if (!paths) return;
  const list = [paths.full, paths.thumb].filter(Boolean);
  if (!list.length) return;
  const { error } = await sb.storage.from(STORAGE_BUCKET).remove(list);
  if (error) throw error;
}

/** 签发缩略图短期签名 URL。 */
export async function signedThumbUrl(path, ttl = SIGNED_URL_TTL) {
  return signedUrl(path, ttl);
}

/** 签发原图短期签名 URL（全屏看图用）。 */
export async function signedFullUrl(path, ttl = SIGNED_URL_TTL) {
  return signedUrl(path, ttl);
}

async function signedUrl(path, ttl) {
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(path, ttl);
  if (error) throw error;
  return data.signedUrl;
}
