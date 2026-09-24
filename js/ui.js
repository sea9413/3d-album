/**
 * js/ui.js —— 通用 DOM / 提示 / 弹窗
 *
 * 【铁律 7】所有用户输入一律 textContent 渲染；本模块不提供任何 innerHTML 写入口。
 * 若将来确有必须拼 HTML 的场景，先调用 escapeHtml() 再写。
 */

import { TOAST_DURATION_MS } from './config.js';

/** 取单个节点 */
export const $ = (sel) => document.querySelector(sel);

/**
 * 建元素。
 * @param {string} tag
 * @param {object} props  class / text / type / disabled / onclick ...（text 走 textContent）
 * @param {Node|string|Array} children
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** 清空容器 */
export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

/** HTML 转义（仅用于确需拼字符串的场景） */
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** 把任意错误归一成一句人话（内容一律作为文本渲染，不解析） */
export function errText(err) {
  if (!err) return '未知错误';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  return String(err);
}

// ---------- toast ----------

let toastTimer = 0;

/** 底部轻提示 */
export function showToast(msg, type = 'info') {
  const box = $('#toast');
  if (!box) return;
  clear(box);
  box.className = `toast toast--${type}`;
  box.textContent = String(msg == null ? '' : msg);
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, TOAST_DURATION_MS);
}

// ---------- 全局红条 ----------

/** 页面底部红条（3.6 全局错误可见化），内容经转义后以文本渲染 */
export function showErrorBar(msg) {
  const bar = $('#errbar');
  if (!bar) return;
  bar.textContent = `出错了：${errText(msg)}`;
  bar.hidden = false;
  bar.onclick = () => { bar.hidden = true; };
}

// ---------- 空状态 ----------

/**
 * 空状态引导（3.6：不留空白页，必须给下一步动作按钮）
 * @param {Node} container
 * @param {{icon?:Node,title:string,desc?:string,actionText?:string,onAction?:Function}} opt
 */
export function renderEmptyState(container, opt) {
  clear(container);
  const kids = [];
  if (opt.icon) kids.push(el('div', { class: 'empty__icon' }, [opt.icon]));
  kids.push(el('h2', { class: 'empty__title', text: opt.title }));
  if (opt.desc) kids.push(el('p', { class: 'empty__desc', text: opt.desc }));
  if (opt.actionText && opt.onAction) {
    kids.push(el('button', {
      class: 'btn btn--primary', type: 'button', onclick: opt.onAction, text: opt.actionText,
    }));
  }
  container.appendChild(el('div', { class: 'empty' }, kids));
  return container;
}

// ---------- 错误页 ----------

/** 容器内错误提示（转义后渲染） */
export function renderError(container, err, opt = {}) {
  clear(container);
  const kids = [
    el('h2', { class: 'empty__title', text: opt.title || '出了点问题' }),
    el('p', { class: 'empty__desc', text: errText(err) }),
  ];
  if (opt.actionText && opt.onAction) {
    kids.push(el('button', { class: 'btn btn--primary', type: 'button', onclick: opt.onAction, text: opt.actionText }));
  }
  container.appendChild(el('div', { class: 'empty empty--error' }, kids));
  return container;
}

/** 整页级「加载失败，请刷新重试」（7.7 第 2 条） */
export function renderLoadFailed(detail) {
  const box = $('#bootfail');
  if (!box) return;
  clear(box);
  box.appendChild(el('div', { class: 'bootfail__card' }, [
    el('h2', { class: 'bootfail__title', text: '加载失败，请刷新重试' }),
    el('p', { class: 'bootfail__desc', text: detail || '页面脚本未能启动。请检查网络后刷新；若反复出现，请清一下浏览器缓存。' }),
    el('button', { class: 'btn btn--primary', type: 'button', onclick: () => location.reload(), text: '刷新' }),
  ]));
  box.hidden = false;
}

// ---------- 二次确认 ----------

/**
 * 二次确认弹窗（删除 / 撤销分享等危险操作必用）
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmText = '确定', cancelText = '取消', danger = false } = {}) {
  return new Promise((resolve) => {
    const modal = $('#modal');
    if (!modal) { resolve(window.confirm(message || title || '确定吗？')); return; }
    clear(modal);
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      modal.hidden = true;
      clear(modal);
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);

    modal.appendChild(el('div', { class: 'modal__mask', onclick: () => finish(false) }));
    modal.appendChild(el('div', { class: 'modal__box', role: 'dialog', 'aria-modal': 'true' }, [
      el('h3', { class: 'modal__title', text: title || '请确认' }),
      message ? el('p', { class: 'modal__msg', text: message }) : null,
      el('div', { class: 'modal__actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => finish(false), text: cancelText }),
        el('button', {
          class: danger ? 'btn btn--danger' : 'btn btn--primary',
          type: 'button',
          onclick: () => finish(true),
          text: confirmText,
        }),
      ]),
    ]));
    modal.hidden = false;
  });
}
