// Supabase 边缘函数：share-open
// 只读分享入口。匿名可调用，内部只执行 SECURITY DEFINER 的 share_get（白名单字段），
// 全程不碰 service_role 密钥（SUPABASE_ANON_KEY 已满足 RPC 授权）。
// 部署：Supabase 控制台 → Edge Functions → New function → 名称 share-open → 粘贴本文件 → Deploy。
// 或用 CLI：supabase functions deploy share-open --project-ref qzwapliyuaeyclqahbnu

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const { token } = await req.json();
    if (!token) return json({ ok: false, error: 'MISSING_TOKEN' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const { data, error } = await supabase.rpc('share_get', { p_token: token });
    if (error) return json({ ok: false, error: 'RPC_ERROR' }, 500);

    // share_get 自身已校验有效性：无效链接返回 {ok:false, error:'LINK_INVALID'}
    if (!data || data.ok === false) {
      return json({ ok: false, error: (data && data.error) || 'LINK_INVALID' }, 404);
    }
    return json(data, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
