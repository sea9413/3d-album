/**
 * js/supabase.js —— Supabase 客户端初始化（含加载失败降级提示）
 *
 * 依赖：vendor/supabase-js.min.js（v2.117.1，UMD，经 <script> 先于本文件加载，
 *       注入全局 supabase.createClient —— UMD 不能 import，勿改）。
 *
 * 【填 key 说明】
 *   - SUPABASE_URL 已由 77 填实（2026-09-24，主公 A3 建的项目）。
 *   - SUPABASE_ANON_KEY 留了空位：把 Supabase 控制台（Settings → API →
 *     Project API keys → anon public，点复制按钮）复制的完整 key 粘贴到
 *     下面第 22 行引号内，替换「这里粘贴…」字样，保存即可。
 *   - anon key 属公开值（受 RLS 保护）可放前端；service_role 严禁入库。
 *   - 填好后由 77 直接读文件核验，无需在聊天里传 key。
 */

// ===== 连接配置 =====
/** Supabase 项目地址（主公 2026-09-24 A3 创建，区域 Singapore） */
export const SUPABASE_URL = 'https://qzwapliyuaeyclqahbnu.supabase.co';

/** Supabase anon public key（⚠️ 待主公粘贴替换此占位文字） */
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6d2FwbGl5dWFleWNscWFoYm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTczMDYsImV4cCI6MjEwNTc3MzMwNn0.e6FpG-QRisOu8KpxpBw6vzKHu538t4c1l6j7HFrDUog';

// ===== 客户端初始化 =====
/** 全局唯一 client 实例；null 表示初始化失败（降级提示用） */
export let sb = null;
/** 初始化失败原因（供降级提示展示） */
export let sbError = '';

try {
  if (typeof window === 'undefined' || !window.supabase || !window.supabase.createClient) {
    throw new Error('vendor/supabase-js.min.js 未加载（检查 <script> 顺序与文件存在）');
  }
  if (!SUPABASE_URL || !/^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL)) {
    throw new Error('SUPABASE_URL 格式不对：应为 https://xxxx.supabase.co');
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith('eyJ') === false) {
    throw new Error('SUPABASE_ANON_KEY 未填或不对：应为 eyJ 开头的完整长串（控制台点复制按钮取得）');
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  sb = null;
  sbError = e && e.message ? e.message : String(e);
  // 控制台留痕，方便 77 / CodeBuddy 排查
  console.error('[supabase.js] 初始化失败：', sbError);
}
