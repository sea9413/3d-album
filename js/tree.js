/**
 * js/tree.js —— 3D 家族树（CSS 3D 环形分层，7.5 / R3）
 *
 * 铁律：布局算法是「纯函数」，不碰 DOM、不碰 Supabase：
 *   - recalcGenerations(members)  由 parent 推导 generation，全树重算（R3）
 *   - detectCycle(members,id,newParent)  防环（R3）
 *   - layoutTree(members)  算每层半径、每果实角度、垂直落差
 * 渲染只消费纯函数产物。
 */

import {
  TREE_LAYER_GAP, TREE_MIN_RADIUS, TREE_RADIUS_PER_MEMBER,
  TREE_ZOOM_MIN, TREE_ZOOM_MAX, TREE_DEGRADE_COUNT,
} from './config.js';

/**
 * 全树重算辈分。generation(自己) = generation(父) + 1；无父者为 0。
 * 父亲不存在（悬空）时按 0 处理，避免崩溃。
 * @returns {Map<id, number>}
 */
export function recalcGenerations(members) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const gen = new Map();
  const visit = (id, depth) => {
    if (depth > members.length + 2) return; // 防御：极端环（应由 detectCycle 在写入前挡住）
    const m = byId.get(id);
    if (!m) { gen.set(id, 0); return; }
    if (gen.has(id)) return;
    if (!m.parent_member_id || !byId.has(m.parent_member_id)) {
      gen.set(id, 0);
      return;
    }
    visit(m.parent_member_id, depth + 1);
    gen.set(id, (gen.get(m.parent_member_id) || 0) + 1);
  };
  for (const m of members) visit(m.id, 0);
  return gen;
}

/**
 * 防环：把 id 的 parent 设为 newParentId 是否会成环。
 * 即从 newParentId 沿 parent_member_id 向上走，若走到 id 本身 → 成环。
 * @returns {boolean} true = 会形成环
 */
export function detectCycle(members, id, newParentId) {
  if (!newParentId) return false;
  const byId = new Map(members.map((m) => [m.id, m]));
  let cur = byId.get(newParentId);
  const seen = new Set();
  while (cur) {
    if (cur.id === id) return true;
    if (seen.has(cur.id)) return false; // 已有环，不再追
    seen.add(cur.id);
    cur = cur.parent_member_id ? byId.get(cur.parent_member_id) : null;
  }
  return false;
}

/**
 * 布局：返回每个成员的可视属性。
 * 每一辈分 = 一层；第 g 层垂直 translateY(g * GAP)；同层果实环形均布。
 * @returns {Array<{id, generation, angle, radius, y}>}
 */
export function layoutTree(members) {
  const genMap = recalcGenerations(members);
  const layers = new Map(); // generation -> [members]
  for (const m of members) {
    const g = genMap.get(m.id) || 0;
    if (!layers.has(g)) layers.set(g, []);
    layers.get(g).push(m);
  }
  const out = [];
  for (const [g, list] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    const count = list.length;
    const radius = Math.max(TREE_MIN_RADIUS, count * TREE_RADIUS_PER_MEMBER);
    // 同层按 order_index，缺省按 created_at，保证稳定不跳变
    const sorted = [...list].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    sorted.forEach((m, i) => {
      const angle = count === 1 ? 0 : (360 / count) * i;
      out.push({ id: m.id, generation: g, angle, radius, y: g * TREE_LAYER_GAP });
    });
  }
  return out;
}

// ===================== 渲染 =====================

/**
 * 渲染 3D 树。
 * @param {HTMLElement} container
 * @param {Array} members  原始成员（含 parent_member_id / user_id / display_name / relation / order_index）
 * @param {{onMemberTap?:(m:object)=>void, avatarOf?:(id:string)=>string|null}} opts
 */
export function renderTree(container, members, opts = {}) {
  const layout = layoutTree(members);
  const byId = new Map(members.map((m) => [m.id, m]));
  const many = members.length > TREE_DEGRADE_COUNT;

  let rotY = -20, tiltX = 8, zoom = 1;
  const scene = document.createElement('div');
  scene.className = 'tree__scene';
  scene.style.transformStyle = 'preserve-3d';

  const nodes = new Map();
  for (const item of layout) {
    const m = byId.get(item.id);
    const joined = !!m.user_id;
    const node = document.createElement('div');
    node.className = 'tree__fruit' + (joined ? '' : ' tree__fruit--empty');
    node.style.transform = `translate(-50%,-50%) translateY(${item.y}px) rotateY(${item.angle}deg) translateZ(${item.radius}px)`;
    node.dataset.id = item.id;

    const avatar = document.createElement('div');
    avatar.className = 'tree__avatar';
    const av = opts.avatarOf && opts.avatarOf(item.id);
    if (joined && av) {
      const img = document.createElement('img');
      img.src = av; img.alt = ''; img.draggable = false;
      avatar.appendChild(img);
    } else {
      avatar.textContent = joined ? (m.display_name || '?').slice(0, 1) : '?';
    }
    node.appendChild(avatar);

    const label = document.createElement('div');
    label.className = 'tree__label';
    label.textContent = [m.relation, m.display_name].filter(Boolean).join('·');
    node.appendChild(label);

    if (!many) {
      const glow = document.createElement('div');
      glow.className = 'tree__glow';
      node.appendChild(glow);
    }

    node.addEventListener('click', (e) => {
      e.stopPropagation();
      if (opts.onMemberTap) opts.onMemberTap(m);
    });

    scene.appendChild(node);
    nodes.set(item.id, node);
  }

  applyTransform();
  function applyTransform() {
    scene.style.transform = `translateZ(-260px) rotateX(${tiltX}deg) rotateY(${rotY}deg) scale(${zoom})`;
  }

  container.appendChild(scene);
  container.classList.add('tree');

  // ---------- 拖拽旋转 ----------
  let dragging = false, lastX = 0, lastY = 0, moved = 0;
  function down(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; moved = 0; try { container.setPointerCapture(e.pointerId); } catch (_) {} }
  function move(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    rotY += dx * 0.5;
    tiltX = Math.max(-30, Math.min(60, tiltX - dy * 0.2));
    lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  }
  function up() { dragging = false; }
  container.addEventListener('pointerdown', down);
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerup', up);
  container.addEventListener('pointercancel', up);

  // ---------- 滚轮缩放 ----------
  function wheel(e) {
    e.preventDefault();
    zoom = Math.max(TREE_ZOOM_MIN, Math.min(TREE_ZOOM_MAX, zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    applyTransform();
  }
  container.addEventListener('wheel', wheel, { passive: false });

  // ---------- 双指捏合缩放 ----------
  const pts = new Map();
  let pinchStart = 0, zoomStart = 1;
  container.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, e); });
  container.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinchStart) { pinchStart = d; zoomStart = zoom; }
      else { zoom = Math.max(TREE_ZOOM_MIN, Math.min(TREE_ZOOM_MAX, zoomStart * (d / pinchStart))); applyTransform(); }
    }
  });
  const dropPt = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinchStart = 0; };
  container.addEventListener('pointerup', dropPt);
  container.addEventListener('pointercancel', dropPt);

  return {
    destroy() {
      container.removeEventListener('pointerdown', down);
      container.removeEventListener('pointermove', move);
      container.removeEventListener('pointerup', up);
      container.removeEventListener('pointercancel', up);
      container.removeEventListener('wheel', wheel);
      container.classList.remove('tree');
      scene.remove();
    },
    rotateBy(d) { rotY += d; applyTransform(); },
    zoomBy(f) { zoom = Math.max(TREE_ZOOM_MIN, Math.min(TREE_ZOOM_MAX, zoom * f)); applyTransform(); },
  };
}
