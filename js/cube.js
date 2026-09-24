/**
 * js/cube.js —— 虚拟 3D 立方体引擎（产品心脏，R1 / R2）
 *
 * 【铁律 4】引擎与数据源完全解耦：只吃
 *   photos: Array<{ thumbUrl, fullUrl, name, caption }>
 * 独享本 / 果实 / 分享页 / 全家福 全部复用同一份。
 *
 * 【R1 虚拟化】DOM 中真实面恒为 2*RENDER_WINDOW+1 = 5 个（当前、左右各 2）。
 *   每完成一次吸附，离当前最远的面被回收，内容换成新待显示张，定位到背面。
 *   首尾用环形取模（mod）衔接，不出现空洞。
 * 【R2 手势】Pointer Events 统一鼠标/触摸；拖动中关掉 transition；松手惯性后吸附到最近 90°。
 *   位移 > 屏宽 × MIN_SWIPE_SPEED 判为「滑动」，否则判为「点击」（先判定再执行，不并存）。
 */

import { RENDER_WINDOW, INERTIA_DECAY, MIN_SWIPE_SPEED } from './config.js';

const FACE_COUNT = 2 * RENDER_WINDOW + 1;

function mod(n, m) { return ((n % m) + m) % m; }

export function initCube(container, photos, opts = {}) {
  if (!container) throw new Error('cube: container 缺失');
  if (!Array.isArray(photos) || photos.length === 0) throw new Error('cube: photos 为空');

  const revoke = !!opts.revokeOnDestroy;
  const pool = [];
  let angle = (opts.startIndex || 0) * -90;   // 起始张朝向正面
  let curIdx = 0;
  let raf = 0;
  let dragging = false;
  let startX = 0, startAngle = 0, lastX = 0, totalDx = 0, velocity = 0;

  const stage = document.createElement('div');
  stage.className = 'cube__stage';

  for (let i = 0; i < FACE_COUNT; i++) {
    const img = document.createElement('img');
    img.className = 'cube__img';
    img.draggable = false;
    img.alt = '';
    const face = document.createElement('div');
    face.className = 'cube__face';
    face.appendChild(img);
    const cap = document.createElement('div');
    cap.className = 'cube__cap';
    face.appendChild(cap);
    stage.appendChild(face);
    pool.push({ face, img, cap, idx: null });
  }

  const counter = document.createElement('div');
  counter.className = 'cube__counter';

  container.appendChild(stage);
  container.appendChild(counter);
  container.classList.add('cube');

  const N = () => photos.length;
  const width = () => container.clientWidth || 320;
  const radius = () => (faceWidth() / 2) * 1.05;
  const faceWidth = () => {
    const f = pool[0] && pool[0].face;
    return f ? f.clientWidth : width() * 0.78;
  };

  function layout() {
    const n = N();
    const center = Math.round(angle / 90);
    curIdx = mod(center, n);
    const win = [];
    for (let d = -RENDER_WINDOW; d <= RENDER_WINDOW; d++) win.push(center + d);

    pool.forEach((f, i) => {
      const k = win[i];
      const photo = photos[mod(k, n)];
      f.face.style.transform = `rotateY(${k * 90 - angle}deg) translateZ(${radius()}px)`;
      if (f.idx !== k) {
        f.img.src = photo.thumbUrl;
        f.cap.textContent = [photo.name, photo.caption].filter(Boolean).join(' · ');
        f.idx = k;
      }
    });

    if (opts.onIndexChange) opts.onIndexChange(curIdx, n);
    if (counter) counter.textContent = `第 ${curIdx + 1} / ${n} 张`;
  }

  function animate() {
    if (dragging) { raf = 0; return; }
    if (Math.abs(velocity) > 0.4) {
      angle += velocity;
      velocity *= INERTIA_DECAY;
      layout();
      raf = requestAnimationFrame(animate);
    } else {
      const target = Math.round(angle / 90) * 90;
      const diff = target - angle;
      if (Math.abs(diff) > 0.3) {
        angle += diff * 0.22;
        layout();
        raf = requestAnimationFrame(animate);
      } else {
        angle = target;
        velocity = 0;
        layout();
        raf = 0;
      }
    }
  }

  function kick() { if (!raf) raf = requestAnimationFrame(animate); }

  // ---------- 指针手势（R2）----------
  function onDown(e) {
    dragging = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    velocity = 0;
    startX = e.clientX; startAngle = angle; lastX = e.clientX; totalDx = 0;
    try { container.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    totalDx = Math.abs(dx);
    angle = startAngle + (dx / width()) * 180;   // R2 角度公式
    lastX = e.clientX;
    layout();
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    try { container.releasePointerCapture(e.pointerId); } catch (_) {}
    // 点击 vs 滑动：先判定再执行（R2）
    if (totalDx < MIN_SWIPE_SPEED * width()) {
      if (opts.onTap) opts.onTap(curIdx, photos[curIdx]);
    } else {
      // 用最近一次位移估算松手速度
      velocity = ((e.clientX - lastX) / width()) * 180;
      if (Math.abs(velocity) < 1) velocity = 0;
    }
    kick();
  }

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);

  layout();

  // ---------- 控制器 ----------
  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onUp);
    if (revoke) {
      photos.forEach((p) => {
        if (p.thumbUrl && p.thumbUrl.startsWith('blob:')) URL.revokeObjectURL(p.thumbUrl);
        if (p.fullUrl && p.fullUrl.startsWith('blob:')) URL.revokeObjectURL(p.fullUrl);
      });
    }
    container.classList.remove('cube');
    stage.remove();
    counter.remove();
  }

  return {
    destroy,
    getCurrentIndex: () => curIdx,
    getCount: () => N(),
    next: () => { angle = Math.round(angle / 90) * 90 - 90; kick(); },
    prev: () => { angle = Math.round(angle / 90) * 90 + 90; kick(); },
  };
}
