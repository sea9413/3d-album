/**
 * js/image.js —— 图片处理（R6：先纠正 EXIF 方向，再压缩；双份输出）
 *
 * 铁律 5：立方体只渲染缩略图；EXIF 方向先纠正再缩放；
 *         createObjectURL / revokeObjectURL 必须成对（由调用方在上传/渲染后回收）。
 *
 * 输出统一为 Blob：原图长边 ≤ MAX_EDGE_FULL，缩略图长边 ≤ MAX_EDGE_THUMB。
 * 优先 WebP，浏览器不支持则退回 JPEG。
 */

import { MAX_EDGE_FULL, MAX_EDGE_THUMB, JPEG_QUALITY } from './config.js';

// HEIC / HEIF 无法在大多数浏览器解码 —— 直接跳过并计入 skipped
const UNSUPPORTED = new Set(['image/heic', 'image/heif']);
function looksHeic(file) {
  const t = (file.type || '').toLowerCase();
  if (UNSUPPORTED.has(t)) return true;
  const n = (file.name || '').toLowerCase();
  return n.endsWith('.heic') || n.endsWith('.heif');
}

/**
 * 解码并纠正 EXIF 方向。
 * 优先 createImageBitmap(file, { imageOrientation: 'from-image' })；
 * 不支持时回退 <img> + canvas（现代浏览器默认已应用 EXIF 方向）。
 * @returns {Promise<ImageBitmap|HTMLImageElement>}
 */
export async function decodeWithOrientation(file) {
  if (looksHeic(file)) throw new Error('HEIC_UNSUPPORTED');
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) { /* 落到 img 回退 */ }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('DECODE_FAILED')); };
    img.src = url;
  });
}

function dimsOf(src) {
  if (src instanceof ImageBitmap) return { w: src.width, h: src.height };
  return { w: src.naturalWidth, h: src.naturalHeight };
}

/** 把源画到长边 ≤ maxEdge 的 canvas，导出 Blob。 */
function renderScaled(src, maxEdge) {
  const { w, h } = dimsOf(src);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0, tw, th);

  return new Promise((resolve) => {
    const tryType = (type) => canvas.toBlob((b) => resolve({ blob: b, width: tw, height: th, type }), type, JPEG_QUALITY);
    canvas.toBlob((b) => {
      if (b && b.type === 'image/webp') resolve({ blob: b, width: tw, height: th, type: 'image/webp' });
      else tryType('image/jpeg');
    }, 'image/webp', JPEG_QUALITY);
  });
}

/** 原图（长边 ≤ MAX_EDGE_FULL） */
export async function makeFullBlob(src) {
  return renderScaled(src, MAX_EDGE_FULL);
}

/** 缩略图（长边 ≤ MAX_EDGE_THUMB） */
export async function makeThumbBlob(src) {
  return renderScaled(src, MAX_EDGE_THUMB);
}

/**
 * 逐张处理一批文件。
 * @param {FileList|File[]} files
 * @param {(done:number,total:number)=>void} [onProgress]
 * @returns {Promise<{results:Array<{fullBlob: Blob, thumbBlob: Blob, width:number, height:number, sizeBytes:number}>, skipped:number}>}
 */
export async function handleFiles(files, onProgress) {
  const list = Array.from(files || []);
  const results = [];
  let skipped = 0;
  const total = list.length;
  for (let i = 0; i < total; i++) {
    const file = list[i];
    try {
      const src = await decodeWithOrientation(file);
      const full = await makeFullBlob(src);
      const thumb = await makeThumbBlob(src);
      if (src instanceof ImageBitmap) src.close();
      results.push({
        fullBlob: full.blob,
        thumbBlob: thumb.blob,
        width: full.width,
        height: full.height,
        sizeBytes: (full.blob && full.blob.size) || 0,
      });
    } catch (e) {
      // 解码失败（HEIC / 损坏文件）：跳过，不静默丢图，由调用方统一提示
      skipped += 1;
      console.warn('[image] 跳过一张无法处理的文件：', file && file.name, e && e.message);
    }
    if (onProgress) onProgress(i + 1, total);
  }
  return { results, skipped };
}
