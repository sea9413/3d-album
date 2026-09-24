/**
 * js/auth.js —— 账号与鉴权（Supabase 匿名登录 + 昵称/头像资料）
 *
 * 设计（2026-09-24 与产品主共同决定，取代开工令默认的邮箱+密码体系）：
 * - 不发邮箱、不设备用密码。打开即匿名登录（零步骤），满足「老人家操作从简」。
 * - 身份只是「本机匿名账号」，昵称/头像是用户自己填的微信名 / 微信头像链接或上传图。
 *   昵称可被冒充（产品取舍：数据安全只看「照片不外泄」，由私有桶 + RLS 保证，无须真·微信 OAuth）。
 * - 头像存 profiles.avatar_url 文本字段：粘贴的链接，或上传后转成的 data URL。
 *   不进 Storage —— photos 桶 RLS 要求路径首段为 album_id，头像无处可放，且 data URL 零依赖、永远能显示。
 *
 * 铁律：
 * - sb 为 null（初始化失败）时所有函数抛「云端不可用」，由调用方降级提示。
 * - 绝不把任何凭证写进 localStorage（匿名会话由 Supabase 客户端托管，应用层不碰）。
 */

import { sb, sbError } from './supabase.js';

/** 取当前 session（未登录返回 null） */
export async function getSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/** 取当前 user（匿名用户也有 id） */
export async function getUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user;
}

function guard() {
  if (!sb) throw new Error(sbError || '云端尚未就绪，请检查网络后刷新');
}

/**
 * 确保有会话：无则匿名登录（自动建匿名用户，零步骤）。
 * @returns {Promise<object|null>} session
 */
export async function ensureSession() {
  guard();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session;
  const res = await sb.auth.signInAnonymously();
  if (res.error) throw new Error(res.error.message || '匿名登录失败');
  return res.data.session;
}

/** 读本人 profiles 行（可能为空） */
export async function getProfile() {
  guard();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data || null;
}

/** upsert 本人资料。avatarUrl 为链接或 data URL（空串/ null 表示清除） */
export async function saveProfile({ displayName, avatarUrl }) {
  guard();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('未登录');
  const { error } = await sb.from('profiles').upsert(
    { id: user.id, display_name: (displayName || '').trim(), avatar_url: avatarUrl || null },
    { onConflict: 'id' },
  );
  if (error) throw new Error(error.message || '保存资料失败');
}

/** 登出（会丢失本机匿名身份，独享本将需重新认领，慎点） */
export async function signOut() {
  guard();
  const { error } = await sb.auth.signOut();
  if (error) throw new Error(error.message || '退出失败');
}

/** 订阅登录态变化 */
export function onAuthChange(cb) {
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data.subscription.unsubscribe();
}
