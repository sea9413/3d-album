/**
 * js/app.js —— 入口：hash 路由 + 全局错误捕获 + 启动检查 + 登录态
 *
 * 【里程碑 3】在骨架基础上接入：顶部登录态栏、#/login 页（登录/注册/找回密码）、
 * 受保护路由的登录守卫。supabase.js 初始化失败（sb 为 null）时，全局降级提示，
 * 不再进入依赖云端的功能。
 */

import { VER, ORDER_STEP, BACKUP_REMIND_DAYS } from './config.js';
import * as ui from './ui.js';
import * as auth from './auth.js';
import { sb as supabaseClient, sbError as supabaseError } from './supabase.js';
import * as db from './db.js';
import * as storage from './storage.js';
import * as image from './image.js';
import { initCube } from './cube.js';
import { renderTree } from './tree.js';
import * as share from './share.js';
import * as backup from './backup.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(viewBox, paths) {
  const node = document.createElementNS(SVG_NS, 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('width', '30');
  node.setAttribute('height', '30');
  node.setAttribute('fill', 'none');
  node.setAttribute('stroke', 'currentColor');
  node.setAttribute('stroke-width', '1.6');
  node.setAttribute('stroke-linecap', 'round');
  node.setAttribute('stroke-linejoin', 'round');
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    node.appendChild(p);
  }
  return node;
}

const iconCube = () => svg('0 0 24 24', [
  'M12 2.8 21 7.4v9.2L12 21.2 3 16.6V7.4z',
  'M3 7.4 12 12l9-4.6',
  'M12 12v9.2',
]);
const iconTree = () => svg('0 0 24 24', [
  'M12 21.5v-6',
  'M12 15.5 6.5 11',
  'M12 15.5 17.5 11',
  'M12 3.2 5.8 9.6h12.4z',
  'M8.6 9.6 5.4 13.4h6.2z',
  'M15.4 9.6l3.2 3.8H12.4z',
]);

// ===================== 会话状态 =====================

const state = { session: null, user: null, profile: null, redirectTo: '#/' };

function displayName() {
  if (state.profile && state.profile.display_name) return state.profile.display_name;
  if (state.user) return '我';
  return '';
}

async function refreshSession() {
  try {
    state.session = await auth.getSession();
    state.user = state.session ? await auth.getUser() : null;
    state.profile = state.user ? await auth.getProfile() : null;
  } catch (e) {
    console.error('[session]', e);
    state.session = null;
    state.user = null;
    state.profile = null;
  }
}

// ===================== 顶部登录态栏 =====================

function renderChrome(root) {
  const left = ui.el('div', { class: 'topbar__left', text: '3D 旋转图册' });
  if (state.user) {
    const av = (state.profile && state.profile.avatar_url) || '';
    const avatar = ui.el('div', { class: 'topbar__av' });
    const paint = () => {
      ui.clear(avatar);
      if (av) {
        const im = ui.el('img', { src: av, alt: '' });
        im.onerror = () => { ui.clear(avatar); avatar.appendChild(ui.el('span', { text: displayName().slice(0, 1) || '我' })); };
        avatar.appendChild(im);
      } else {
        avatar.appendChild(ui.el('span', { text: displayName().slice(0, 1) || '我' }));
      }
    };
    paint();
    const chip = ui.el('div', { class: 'userchip', text: displayName() });
    const edit = ui.el('button', {
      class: 'btn btn--ghost', type: 'button', text: '编辑',
      onclick: async () => { await openProfileModal(); render(); },
    });
    root.appendChild(ui.el('div', { class: 'topbar' }, [left, ui.el('div', { class: 'topbar__user' }, [avatar, chip, edit])]));
  } else {
    root.appendChild(ui.el('div', { class: 'topbar' }, [left]));
  }
}

// ===================== 登录守卫 =====================

const PROTECTED = new Set(['solo', 'trees', 'tree', 'member']);

function requireAuth() {
  if (state.session) return true;
  ui.renderEmptyState(ui.$('#app'), {
    title: '还没连上',
    desc: '登录失败，请刷新页面或检查网络后重试。',
    actionText: '刷新',
    onAction: () => location.reload(),
  });
  return false;
}

// ===================== 页面：首页 =====================

function renderHome(root) {
  const card = (title, desc, badgeClass, icon, hash) => ui.el('button', {
    class: 'card', type: 'button',
    onclick: () => { location.hash = hash; },
  }, [
    ui.el('span', { class: `card__badge ${badgeClass}` }, [icon]),
    ui.el('span', {}, [
      ui.el('span', { class: 'card__title', text: title }),
      ui.el('span', { class: 'card__desc', text: desc }),
    ]),
  ]);
  root.appendChild(ui.el('div', { class: 'brand' }, [
    ui.el('h1', { class: 'brand__title', text: '3D 旋转图册' }),
    ui.el('p', { class: 'brand__sub', text: '把照片翻成一本会转的册子' }),
  ]));
  root.appendChild(ui.el('div', { class: 'cards' }, [
    card('我的独享本', '只给自己看的私人相册，也能生成一条只读链接发给别人', '', iconCube(), '#/solo'),
    card('家族树', '一家人各自往同一棵树上挂照片，一个果实就是一位家人', 'card__badge--tree', iconTree(), '#/tree'),
  ]));

  // H5：超过 BACKUP_REMIND_DAYS 天未备份，本会话提示一次
  if (backup.shouldRemindBackup() && !window.__BACKUP_WARNED__) {
    window.__BACKUP_WARNED__ = true;
    ui.showToast(`已超过 ${BACKUP_REMIND_DAYS} 天未备份，建议导出一个备份以防丢图`, 'info');
  }
}

// ===================== 资料卡（昵称 + 微信头像）=====================

/** 把上传的头像压成 160×160 正方形 JPEG data URL（小、永远能显示、不依赖网络） */
async function avatarDataUrl(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('图片读取失败'));
      i.src = url;
    });
    const S = 160;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
    return cv.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 资料卡弹窗：填微信名 + 选头像（粘贴微信头像链接或上传一张）。
 * 首次进入强制填写；之后可随时「编辑」。返回 Promise<boolean>（是否保存）。
 */
function openProfileModal() {
  return new Promise((resolve) => {
    const modal = ui.$('#modal');
    if (!modal) { resolve(false); return; }
    const profile = state.profile || {};
    let pending = profile.avatar_url || '';   // 当前/待保存头像（链接或 data URL）

    const nameInput = ui.el('input', {
      class: 'input', type: 'text', placeholder: '你的微信名', maxlength: '60', value: profile.display_name || '',
    });
    const linkInput = ui.el('input', {
      class: 'input', type: 'text', placeholder: '微信头像链接（选填，可粘贴）', maxlength: '2000',
    });
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';

    const preview = ui.el('div', { class: 'avatar-prev' });
    const paintPreview = (src) => {
      ui.clear(preview);
      if (src) {
        const im = ui.el('img', { src, alt: '' });
        im.onerror = () => { ui.clear(preview); preview.appendChild(ui.el('div', { class: 'avatar-prev__init', text: (nameInput.value || '我').slice(0, 1) })); };
        preview.appendChild(im);
      } else {
        preview.appendChild(ui.el('div', { class: 'avatar-prev__init', text: (nameInput.value || '我').slice(0, 1) }));
      }
    };
    paintPreview(pending);

    fileInput.onchange = async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        pending = await avatarDataUrl(f);
        linkInput.value = '';
        paintPreview(pending);
      } catch (e) { ui.showToast('头像处理失败', 'error'); }
    };
    linkInput.addEventListener('input', () => {
      if (linkInput.value.trim()) { pending = linkInput.value.trim(); paintPreview(pending); }
    });

    const msg = ui.el('p', { class: 'empty__desc', text: '' });
    const saveBtn = ui.el('button', { class: 'btn btn--primary', type: 'button', text: '保存并进入' });
    let done = false;
    const finish = async () => {
      if (done) return;
      const name = nameInput.value.trim();
      if (!name) { msg.textContent = '请填一下你的微信名'; return; }
      saveBtn.disabled = true; msg.textContent = '保存中…';
      try {
        await auth.saveProfile({ displayName: name, avatarUrl: pending || null });
        state.profile = { ...(state.profile || {}), display_name: name, avatar_url: pending || null };
        done = true;
        modal.hidden = true; ui.clear(modal);
        resolve(true);
      } catch (e) {
        msg.textContent = ui.errText(e);
        saveBtn.disabled = false;
      }
    };
    saveBtn.onclick = finish;

    const canSkip = !!(profile.display_name);
    const mask = ui.el('div', { class: 'modal__mask', onclick: () => {
      if (canSkip) { modal.hidden = true; ui.clear(modal); resolve(false); }
    } });

    ui.clear(modal);
    modal.appendChild(mask);
    modal.appendChild(ui.el('div', { class: 'modal__box', role: 'dialog', 'aria-modal': 'true' }, [
      ui.el('h3', { class: 'modal__title', text: profile.display_name ? '编辑资料' : '先填一下资料' }),
      ui.el('p', { class: 'modal__msg', text: profile.display_name ? '' : '填个微信名就能用；头像可选，粘贴微信头像链接或上传一张都行。' }),
      preview,
      ui.el('div', { class: 'field' }, [ui.el('label', { text: '微信名' }), nameInput]),
      ui.el('div', { class: 'field' }, [ui.el('label', { text: '头像（链接或上传）' }), linkInput]),
      ui.el('button', { class: 'btn btn--ghost', type: 'button', text: '上传一张照片', onclick: () => fileInput.click() }),
      fileInput,
      msg,
      ui.el('div', { class: 'modal__actions' }, [saveBtn]),
    ]));
    modal.hidden = false;
    nameInput.focus();
  });
}

// ===================== 页面：独享本闭环（里程碑 6）=====================

async function renderSolo(root) {
  destroyActiveCube();
  const container = ui.el('div', { class: 'solo' });
  root.appendChild(container);
  container.appendChild(ui.el('div', { class: 'empty__desc', text: '正在打开你的独享本…' }));

  let albumId;
  try {
    albumId = await db.getOrCreateSoloAlbum();
  } catch (e) {
    ui.renderError(root, e, { actionText: '返回首页', onAction: () => { location.hash = '#/'; } });
    return;
  }
  await loadAndRenderSolo(container, albumId);
  addSoloFab(root, albumId);
}

async function loadAndRenderSolo(container, albumId) {
  ui.clear(container);
  let rows;
  try {
    rows = await db.listPhotos({ albumId });
  } catch (e) {
    ui.renderError(container, e);
    return;
  }

  if (!rows.length) {
    ui.renderEmptyState(container, {
      title: '还没有照片',
      desc: '点右下角的 + 开始添加，你的第一张照片会出现在这个转动的立方体上。',
      actionText: '+ 添加照片',
      onAction: () => openFilePicker(albumId, null),
    });
    return;
  }

  const photos = await Promise.all(rows.map(async (r) => ({
    id: r.id, name: r.name, caption: r.caption,
    thumbUrl: await storage.signedThumbUrl(r.thumb_path),
    fullPath: r.storage_path, thumbPath: r.thumb_path,
  })));

  const cubeBox = ui.el('div', { class: 'cube' });
  container.appendChild(cubeBox);
  activeCube = initCube(cubeBox, photos, { onTap: (i, p) => openViewer(p, container, albumId) });

  container.appendChild(ui.el('div', { class: 'tabs' }, [
    ui.el('button', {
      class: 'tab', type: 'button', text: '复制只读分享链接',
      onclick: async () => {
        try {
          const link = await share.createSoloShare(albumId);
          if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
          ui.showToast(`已复制分享链接：${link}`, 'ok');
        } catch (e) { ui.showToast(e.message || '生成分享失败', 'error'); }
      },
    }),
  ]));

  addBackupBar(container, albumId);
}

/** 备份工具栏（导出 / 导入） */
function addBackupBar(root, albumId) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = '.zip'; fileInput.style.display = 'none';
  fileInput.onchange = async () => {
    if (!fileInput.files || !fileInput.files.length) return;
    ui.showToast('正在导入备份…');
    try {
      const newId = await backup.importBackup(fileInput.files[0]);
      ui.showToast('导入完成！', 'ok');
      location.hash = albumId === newId ? `#/solo` : `#/solo`;
    } catch (e) { ui.showToast(e.message || '导入失败', 'error'); }
  };
  root.appendChild(fileInput);
  root.appendChild(ui.el('div', { class: 'tabs' }, [
    ui.el('button', { class: 'tab', type: 'button', text: '导出备份', onclick: async () => {
      try { await backup.exportBackup(albumId); ui.showToast('已导出备份 zip', 'ok'); }
      catch (e) { ui.showToast(e.message || '导出失败', 'error'); }
    } }),
    ui.el('button', { class: 'tab', type: 'button', text: '导入备份', onclick: () => fileInput.click() }),
  ]));
}

function addSoloFab(root, albumId) {
  const fab = ui.el('button', {
    class: 'fab', type: 'button', text: '+', title: '添加照片',
    onclick: () => openFilePicker(albumId, null),
  });
  root.appendChild(fab);
}

function openFilePicker(albumId, memberId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async () => {
    if (!input.files || !input.files.length) return;
    await uploadFiles(albumId, memberId, input.files);
  };
  input.click();
}

async function uploadFiles(albumId, memberId, files) {
  const u = await auth.getUser();
  if (!u) { ui.showToast('请先登录', 'error'); return; }
  const ownerId = u.id;

  ui.showToast('正在压缩与上传…');
  const { results, skipped } = await image.handleFiles(files);

  // R7：本次追加的 order_index 接在当前最大之后，间隔 ORDER_STEP
  let maxOrder = 0;
  try {
    const cur = await db.listPhotos({ albumId, memberId });
    maxOrder = cur.reduce((m, p) => Math.max(m, p.order_index || 0), 0);
  } catch (_) { /* 忽略，回退 0 */ }

  let ok = 0, fail = 0, order = maxOrder;
  for (const r of results) {
    order += ORDER_STEP;
    const photoId = crypto.randomUUID();
    let paths;
    try {
      paths = await storage.uploadPair(albumId, memberId, photoId, r.fullBlob, r.thumbBlob);
    } catch (e) {
      fail += 1; console.error('[upload] 上传失败', e); continue;
    }
    try {
      await db.insertPhotoRow({
        albumId, memberId, ownerId,
        storagePath: paths.full, thumbPath: paths.thumb,
        name: '', caption: '', width: r.width, height: r.height,
        sizeBytes: r.sizeBytes, orderIndex: order,
      });
      ok += 1;
    } catch (e) {
      // R8 回滚：删掉已上传的两个文件
      fail += 1;
      console.error('[upload] 入库失败，回滚文件', e);
      await storage.removePair(paths).catch(() => {});
    }
  }

  const parts = [`已上传 ${ok} 张`];
  if (skipped) parts.push(`${skipped} 张无法处理已跳过`);
  if (fail) parts.push(`${fail} 张未完成，请重试`);
  ui.showToast(parts.join('，'), fail ? 'error' : 'ok');

  await loadAndRenderSolo(document.getElementById('app').querySelector('.solo') || ui.$('#app'), albumId);
}

async function openViewer(photo, container, albumId) {
  let url;
  try {
    url = await storage.signedFullUrl(photo.fullPath);
  } catch (e) {
    ui.showToast('原图加载失败', 'error');
    return;
  }
  const overlay = ui.el('div', { class: 'viewer' }, [
    ui.el('div', { class: 'viewer__img' }, [ui.el('img', { src: url, alt: '' })]),
    ui.el('div', { class: 'viewer__bar' }, [
      ui.el('div', { class: 'viewer__cap', text: [photo.name, photo.caption].filter(Boolean).join(' · ') }),
      ui.el('button', {
        class: 'btn btn--danger', type: 'button', text: '删除',
        onclick: async () => {
          const yes = await ui.confirmDialog({
            title: '删除这张照片', message: '删除后无法恢复，确定吗？', confirmText: '删除', danger: true,
          });
          if (!yes) return;
          try { await db.deletePhotoRow(photo.id); } catch (e) { ui.showToast('删除失败', 'error'); return; }
          await storage.removePair({ full: photo.fullPath, thumb: photo.thumbPath }).catch(() => {});
          overlay.remove();
          if (memberId) await renderMemberAlbum(container, albumId, memberId);
          else await loadAndRenderSolo(container, albumId);
        },
      }),
      ui.el('button', { class: 'btn', type: 'button', text: '关闭', onclick: () => overlay.remove() }),
    ]),
  ]);
  document.body.appendChild(overlay);
}

// ===================== 页面：待接入占位 =====================

function renderPending(root, name) {
  return ui.renderEmptyState(root, {
    title: name,
    desc: '这一页还没接入，将在后续里程碑完成。',
    actionText: '返回首页',
    onAction: () => { location.hash = '#/'; },
  });
}

// ===================== 页面：404 =====================

function renderNotFound(root, hash) {
  return ui.renderEmptyState(root, {
    title: '页面不存在',
    desc: `找不到这个地址：${hash || '#/'}`,
    actionText: '返回首页',
    onAction: () => { location.hash = '#/'; },
  });
}

// ===================== 页面：家族树（里程碑 7）=====================

let treeCtrl = null;
let activeCube = null;

function destroyActiveCube() {
  if (activeCube) { try { activeCube.destroy(); } catch (_) {} activeCube = null; }
}

/** 取每个果实的头像：优先微信头像（members.avatar_url），否则用其第一张照片缩略图。 */
async function loadAvatars(members) {
  const map = {};
  await Promise.all(members.map(async (m) => {
    if (m.avatar_url) { map[m.id] = m.avatar_url; return; }
    try {
      const { data } = await supabaseClient
        .from('photos').select('thumb_path').eq('member_id', m.id).order('order_index').limit(1);
      if (data && data.length) map[m.id] = await storage.signedThumbUrl(data[0].thumb_path);
    } catch (_) { /* 头像缺失就回退首字母 */ }
  }));
  return map;
}

function pageTitle(root, text) {
  root.appendChild(ui.el('div', { class: 'brand__sub', text }));
}

async function renderTreesList(root) {
  pageTitle(root, '我的家族树');
  const wrap = ui.el('div', { class: 'list' });
  const input = ui.el('input', { class: 'input', type: 'text', placeholder: '树名（默认「我们家」）', maxlength: '60' });
  const createBtn = ui.el('button', {
    class: 'btn btn--primary', type: 'button', text: '种一棵新树',
    onclick: async () => {
      try { const { albumId } = await db.createFamilyAlbum(input.value.trim(), displayName()); location.hash = `#/tree/${albumId}`; }
      catch (e) { ui.showToast(e.message || '创建失败', 'error'); }
    },
  });
  const form = ui.el('div', { class: 'field' }, [input, createBtn]);
  root.appendChild(form); root.appendChild(wrap);
  try {
    const trees = await db.listMyTrees();
    trees.forEach((t) => wrap.appendChild(ui.el('div', {
      class: 'list__item list__item--btn', onclick: () => { location.hash = `#/tree/${t.id}`; },
    }, [
      ui.el('div', {}, [ui.el('div', { class: 'card__title', text: t.title })]),
      ui.el('div', { class: 'userchip', text: '进入 →' }),
    ])));
    if (!trees.length) root.appendChild(ui.el('p', { class: 'empty__desc', text: '还没有树，先种一棵吧。' }));
  } catch (e) { ui.renderError(root, e); }
}

async function renderTreePage(root, albumId) {
  destroyActiveCube();
  if (treeCtrl) { treeCtrl.destroy(); treeCtrl = null; }
  pageTitle(root, '家族树');
  let album;
  try { album = await db.getAlbum(albumId); } catch (e) { ui.renderError(root, e); return; }
  root.appendChild(ui.el('div', { class: 'brand__sub', text: album.title }));

  let members;
  try { members = await db.getTree(albumId); } catch (e) { ui.renderError(root, e); return; }
  const avatars = await loadAvatars(members);

  root.appendChild(ui.el('div', { class: 'tabs' }, [
    ui.el('button', { class: 'tab tab--on', type: 'button', text: '+ 添加家人', onclick: () => showAddMember(root, albumId, members) }),
    ui.el('button', { class: 'tab', type: 'button', text: '分享整树', onclick: async () => {
      try {
        const link = await share.createTreeShare(albumId);
        if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
        ui.showToast(`已复制分享链接：${link}`, 'ok');
      } catch (e) { ui.showToast(e.message || '生成分享失败', 'error'); }
    } }),
  ]));

  const treeBox = ui.el('div', { class: 'tree' });
  root.appendChild(treeBox);
  treeCtrl = renderTree(treeBox, members, {
    avatarOf: (id) => avatars[id] || null,
    onMemberTap: (m) => {
      if (m.user_id) location.hash = `#/tree/${albumId}/m/${m.id}`;
      else copyInvite(albumId, m.id);
    },
  });
  addBackupBar(root, albumId);
}

function showAddMember(root, albumId, members) {
  const name = ui.el('input', { class: 'input', type: 'text', placeholder: '家人称呼，如「爸爸」', maxlength: '60' });
  const rel = ui.el('input', { class: 'input', type: 'text', placeholder: '关系，如「父亲」', maxlength: '10' });
  const parentSel = ui.el('select', { class: 'input' }, [
    ui.el('option', { value: '', text: '（无父级，作为根）' }),
    ...members.map((m) => ui.el('option', { value: m.id, text: m.display_name })),
  ]);
  root.appendChild(ui.el('div', { class: 'form' }, [
    ui.el('div', { class: 'field' }, [ui.el('label', { text: '称呼' }), name]),
    ui.el('div', { class: 'field' }, [ui.el('label', { text: '关系' }), rel]),
    ui.el('div', { class: 'field' }, [ui.el('label', { text: '父辈（可选）' }), parentSel]),
    ui.el('button', {
      class: 'btn btn--primary', type: 'button', text: '添加',
      onclick: async () => {
        // 新果实是叶子节点，无后代，不可能成环，无需 cycle 检测
        try {
          await db.addMember({ albumId, displayName: name.value.trim(), relation: rel.value.trim(), parentMemberId: parentSel.value || null });
          renderTreePage(root, albumId);
        } catch (e) { ui.showToast(e.message || '添加失败', 'error'); }
      },
    }),
  ]));
}

function copyInvite(albumId, memberId) {
  const link = `${location.origin}${location.pathname}#/invite/${memberId}`;
  if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
  ui.showToast(`已复制邀请链接（也可手动发给 TA）：${link}`, 'ok');
}

async function renderMemberAlbum(root, albumId, memberId) {
  destroyActiveCube();
  pageTitle(root, '家人的相册');
  let members;
  try { members = await db.getTree(albumId); } catch (e) { ui.renderError(root, e); return; }
  const mem = members.find((m) => m.id === memberId);
  if (!mem) { ui.renderError(root, new Error('果实不存在')); return; }

  const u = await auth.getUser();
  const isMine = u && mem.user_id === u.id;

  let rows;
  try { rows = await db.listPhotos({ albumId, memberId }); } catch (e) { ui.renderError(root, e); return; }
  if (!rows.length && !isMine) {
    ui.renderEmptyState(root, {
      title: '这个果实还没有照片', desc: '等 TA 上传吧。',
      actionText: '返回树', onAction: () => { location.hash = `#/tree/${albumId}`; },
    });
    return;
  }

  const photos = await Promise.all(rows.map(async (r) => ({
    id: r.id, name: r.name, caption: r.caption,
    thumbUrl: await storage.signedThumbUrl(r.thumb_path),
    fullPath: r.storage_path, thumbPath: r.thumb_path,
  })));

  const cubeBox = ui.el('div', { class: 'cube' });
  root.appendChild(cubeBox);
  activeCube = initCube(cubeBox, photos, { onTap: (i, p) => openViewer(p, root, albumId, memberId) });
  if (isMine) {
    root.appendChild(ui.el('button', {
      class: 'fab', type: 'button', text: '+', title: '添加照片',
      onclick: () => openFilePicker(albumId, memberId),
    }));
  }
}

async function renderShare(root, token) {
  pageTitle(root, '只读分享');
  let data;
  try { data = await share.fetchShare(token); }
  catch (e) {
    const msg = (e && e.code === 'LINK_INVALID') ? '分享链接无效或已撤销' : '加载分享失败';
    ui.renderError(root, new Error(msg), { actionText: '返回首页', onAction: () => { location.hash = '#/'; } });
    return;
  }

  const album = data.album || {};
  if (album.kind === 'family') {
    // 家族树：只读树视图
    const members = data.members || [];
    const avatars = {};
    await Promise.all(members.filter((m) => m.joined).map(async (m) => {
      try {
        const first = (data.photos || []).find((p) => p.member_id === m.id);
        if (first) avatars[m.id] = await storage.signedThumbUrl(first.thumb_path);
      } catch (_) {}
    }));
    const treeBox = ui.el('div', { class: 'tree' });
    root.appendChild(treeBox);
    renderTree(treeBox, members, { avatarOf: (id) => avatars[id] || null });
    root.appendChild(ui.el('p', { class: 'empty__desc', text: `${album.title} · 只读分享` }));
  } else {
    // 独享本 / 单果实：只读立方体
    const photos = await Promise.all((data.photos || []).map(async (r) => ({
      id: r.id, name: r.name, caption: r.caption,
      thumbUrl: await storage.signedThumbUrl(r.thumb_path),
      fullPath: r.storage_path, thumbPath: r.thumb_path,
    })));
    if (!photos.length) {
      ui.renderEmptyState(root, { title: '这个分享还是空的', desc: '等主人上传照片吧。', actionText: '返回首页', onAction: () => { location.hash = '#/'; } });
      return;
    }
    const cubeBox = ui.el('div', { class: 'cube' });
    root.appendChild(cubeBox);
    initCube(cubeBox, photos, {}); // 只读：无 onTap
    root.appendChild(ui.el('p', { class: 'empty__desc', text: `${album.title} · 只读分享` }));
  }
}

async function renderInvite(root, memberId) {
  pageTitle(root, '接受邀请');
  if (!state.session) {
    ui.renderEmptyState(root, {
      title: '还没连上', desc: '登录失败，请刷新页面后重试。',
      actionText: '刷新', onAction: () => location.reload(),
    });
    return;
  }
  ui.renderEmptyState(root, {
    title: '加入家族树', desc: '点下面按钮，把你的微信头像和名字绑到这个果实（仅限该果实尚未有人认领时）。',
    actionText: '接受邀请并加入',
    onAction: async () => {
      try {
        await db.acceptInvite(memberId);
        if (state.profile && state.profile.avatar_url) {
          await db.setMemberAvatar(memberId, state.profile.avatar_url).catch(() => {});
        }
        ui.showToast('已加入！', 'ok');
        location.hash = '#/tree';
      } catch (e) { ui.showToast(e.message || '加入失败', 'error'); }
    },
  });
}

// ===================== 路由表（7.2）=====================

const ROUTES = [
  { name: 'home', re: /^\/?$/, keys: [] },
  { name: 'login', re: /^\/login$/, keys: [] },
  { name: 'solo', re: /^\/solo$/, keys: [] },
  { name: 'trees', re: /^\/tree$/, keys: [] },
  { name: 'tree', re: /^\/tree\/([^/]+)$/, keys: ['albumId'] },
  { name: 'member', re: /^\/tree\/([^/]+)\/m\/([^/]+)$/, keys: ['albumId', 'memberId'] },
  { name: 'invite', re: /^\/invite\/([^/]+)$/, keys: ['token'] },
  { name: 'share', re: /^\/s\/([^/]+)$/, keys: ['token'] },
];

const PAGE_NAMES = {
  home: '首页', login: '登录 / 注册', solo: '我的独享本', trees: '我的家族树',
  tree: '家族树', member: '家人的相册', invite: '接受邀请', share: '只读分享',
};

function parseHash() {
  const path = (location.hash || '#/').replace(/^#/, '') || '/';
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { name: r.name, params };
  }
  return { name: 'notFound', params: {}, path };
}

function render() {
  const root = ui.$('#app');
  ui.clear(root);
  destroyActiveCube();
  if (treeCtrl) { treeCtrl.destroy(); treeCtrl = null; }
  renderChrome(root);
  const route = parseHash();
  try {
    if (PROTECTED.has(route.name) && !requireAuth()) return;
    switch (route.name) {
      case 'home': renderHome(root); break;
      case 'login': location.hash = '#/'; return;
      case 'solo': renderSolo(root); break;
      case 'trees': renderTreesList(root); break;
      case 'tree': renderTreePage(root, route.params.albumId); break;
      case 'member': renderMemberAlbum(root, route.params.albumId, route.params.memberId); break;
      case 'invite': renderInvite(root, route.params.token); break;
      case 'share': renderShare(root, route.params.token); break;
      case 'notFound': renderNotFound(root, route.path); break;
      default: renderPending(root, PAGE_NAMES[route.name] || route.name); break;
    }
  } catch (err) {
    console.error('[route]', route.name, err);
    ui.renderError(root, err, { actionText: '返回首页', onAction: () => { location.hash = '#/'; } });
  }
}

// ===================== 启动 =====================

function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => ui.showErrorBar(e.message || '脚本运行出错'));
  window.addEventListener('unhandledrejection', (e) => ui.showErrorBar((e.reason && e.reason.message) || e.reason || '异步任务出错'));
}

async function boot() {
  window.__ALBUM3D_BOOTED__ = true;       // 启动标志：兜底脚本据此判断
  installGlobalErrorHandlers();
  const ver = ui.$('#ver');
  if (ver) ver.textContent = VER;

  // 7.7 降级：云端不可用（supabaseClient 为 null）时，给出明确提示而非白屏
  if (!supabaseClient) {
    ui.showErrorBar('云端尚未就绪：' + (supabaseError || 'Supabase 客户端初始化失败'));
  } else {
    try {
      // 极简匿名：打开即登录（零步骤），首次填一下微信名/头像即可
      await auth.ensureSession();
      await refreshSession();
      if (!state.profile || !state.profile.display_name) {
        await openProfileModal();
        await refreshSession();
      }
    } catch (e) {
      ui.showErrorBar('登录失败：' + ui.errText(e));
    }
  }

  auth.onAuthChange(async () => { await refreshSession(); render(); });

  window.addEventListener('hashchange', render);
  render();
}

try {
  boot();
} catch (err) {
  console.error('[boot]', err);
  ui.renderLoadFailed(ui.errText(err));
}
