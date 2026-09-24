/**
 * js/backup.js —— 本地备份（7.6 / H5）
 *
 * 铁律：备份是「整本照片 + 元数据」的离线 zip；导出用 JSZip 在客户端完成，照片原文件一并打进包，
 * 不依赖任何外部服务。导入时新建一本（不覆盖原数据），并重建成员映射与照片。
 * 防丢提醒：每次导出记录时间到 localStorage（LS_PREFIX 前缀），超过 BACKUP_REMIND_DAYS 天提示。
 */

import { sb } from './supabase.js';
import * as db from './db.js';
import * as storage from './storage.js';
import { STORAGE_BUCKET, LS_PREFIX, BACKUP_REMIND_DAYS } from './config.js';

const JSZip = window.JSZip;

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safeName(s) { return (s || 'album').replace(/[^\w一-龥-]+/g, '_'); }

/** 导出整本为 zip 并触发下载。 */
export async function exportBackup(albumId) {
  if (!JSZip) throw new Error('备份组件未加载');
  const album = await db.getAlbum(albumId);
  const members = await db.getTree(albumId);
  const photos = await db.listPhotos({ albumId });

  const zip = new JSZip();
  const photoMeta = [];
  for (const p of photos) {
    const { data, error } = await sb.storage.from(STORAGE_BUCKET).download(p.storage_path);
    if (error || !data) continue;
    const fname = `photos/${p.id}.bin`;
    zip.file(fname, data);
    photoMeta.push({
      id: p.id, member_id: p.member_id, name: p.name, caption: p.caption,
      width: p.width, height: p.height, order_index: p.order_index, file: fname,
    });
  }

  const manifest = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    album: { kind: album.kind, title: album.title },
    members, photos: photoMeta,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerDownload(blob, `${safeName(album.title)}_${Date.now()}.zip`);
  localStorage.setItem(LS_PREFIX + 'lastBackup', String(Date.now()));
}

export function daysSinceBackup() {
  const t = localStorage.getItem(LS_PREFIX + 'lastBackup');
  if (!t) return Infinity;
  return Math.floor((Date.now() - Number(t)) / 86400000);
}

export function shouldRemindBackup() {
  return daysSinceBackup() >= BACKUP_REMIND_DAYS;
}

/** 从 zip 文件导入为「新建」的一本（不覆盖原数据）。返回新 albumId。 */
export async function importBackup(file) {
  if (!JSZip) throw new Error('备份组件未加载');
  const zip = await JSZip.loadAsync(file);
  const manRaw = await zip.file('manifest.json').async('string');
  const man = JSON.parse(manRaw);
  const me = (await sb.auth.getUser()).data.user;
  if (!me) throw new Error('请先登录');

  const { data: album } = await sb.from('albums').insert({
    owner_id: me.id, kind: man.album.kind, title: (man.album.title || '相册') + '（导入）',
  }).select('id').single();
  const albumId = album.id;

  const idMap = {};
  for (const m of man.members || []) {
    const { data: nm } = await sb.from('members').insert({
      album_id: albumId,
      display_name: m.display_name,
      relation: m.relation,
      generation: m.generation,
      parent_member_id: m.parent_member_id ? (idMap[m.parent_member_id] || null) : null,
      order_index: m.order_index,
    }).select('id').single();
    idMap[m.id] = nm.id;
  }

  for (const p of man.photos || []) {
    const blob = await zip.file(p.file).async('blob');
    const photoId = crypto.randomUUID();
    const memberId = p.member_id ? idMap[p.member_id] : null;
    // 备份里只有一份原图，缩略图用同一份兜底（清晰度足够回看）
    const paths = await storage.uploadPair(albumId, memberId, photoId, blob, blob);
    await db.insertPhotoRow({
      albumId, memberId, ownerId: me.id,
      storagePath: paths.full, thumbPath: paths.thumb,
      name: p.name || '', caption: p.caption || '',
      width: p.width, height: p.height, sizeBytes: blob.size, orderIndex: p.order_index,
    });
  }
  return albumId;
}
