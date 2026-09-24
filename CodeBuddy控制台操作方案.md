# 3D旋转图册 · 控制台操作方案（CodeBuddy 接手 / 77 验收）

> 本文档由 77 撰写，主公转交 CodeBuddy 执行。CodeBuddy 打开本目录即可读取。

## 〇、为什么是这份方案（背景）

- 77 已实测：当前 WorkBuddy 运行环境**无法启动图形浏览器**（启动 Edge 后进程立即消失，日志为空），因此 77 不能直接操作 Supabase 网页控制台。
- 既定铁律：**service_role key 不能交予 77**（泄露 = 全家照片裸奔、可绕过 RLS）。
- 结论：涉及主公 Supabase 账号的**控制台侧操作**，改由 **CodeBuddy 在主公本机（有图形环境、能联网）接手执行**；**77 退居验收把关**——CodeBuddy 每步产出结果，主公转交 77，77 凭开工令原文 + 持 anon key 实测核验真假（防「声称跑过实际没跑」）。

## 〇点五、主公前置动作：生成 PAT（个人访问令牌）

> 这一步**只能主公本人做**（涉及账号），CodeBuddy 不能代劳。做完后，把本文件 + 一句「PAT 已存 pat.txt，按方案执行」发给 CodeBuddy 即可。

1. 电脑浏览器打开 https://supabase.com/dashboard （您已登录）
2. 点页面**左下角您的头像 / 邮箱** → 选 **Account Preferences**（账户偏好）
3. 左侧菜单找 **Access Tokens**（访问令牌）
4. 点 **Generate new token**（生成新令牌）
5. **Name** 随便填，如 `3d-album-cb`；**Expiry** 选一个（建议 7 天或 30 天，用完即吊销）
6. 点 **Generate**，页面会出现一长串令牌 —— **⚠️ 只显示这一次，关掉就再也看不到**
7. 立刻点 **复制**（或鼠标全选复制整串）
8. 打开记事本（`Win` 键 → 输入"记事本" → 回车）→ `Ctrl+V` 粘贴
9. **文件 → 保存** → 文件名填 `pat.txt`，保存到 `C:\Users\19101\Projects\3d-album\`
10. 保存好后，Supabase 页面可以关了

⚠️ **严禁生成 service_role key**；也**不要把令牌粘进聊天框**（之前长字符串会被显示层咬断，且没必要传入聊天）。
✅ 等 CodeBuddy 报告全部完成，回 Access Tokens 页面点该令牌的 **Revoke** 吊销即可，更安全。

---

## 一、当前已完成（无需重做，CodeBuddy 接手前请先确认）

| 项 | 状态 | 备注 |
|---|---|---|
| A3 建 Supabase 项目（区域 Singapore） | ✅ | Project URL: `https://qzwapliyuaeyclqahbnu.supabase.co` |
| A4 手机 4G 连通性实测 | ✅ | 手机+电脑双通道可达，P20「国内访问不了」风险解除 |
| vendor 两库 | ✅ | `vendor/supabase-js.min.js` v2.117.1（UMD 全局 `supabase.createClient`）、`vendor/jszip.min.js` v3.10.1（全局 `JSZip`），版本锁死，已内联 |
| `js/supabase.js` | ✅ | URL + anon key 已由 77 注入；哈希校验一致；JWT 解码确认 `ref=qzwapliyuaeyclqahbnu`、`role=anon`、鉴权通过 |
| `supabase/schema.sql` | ✅ | 建表/函数/RLS/Storage 策略全文，已与开工令 4.2 逐字比对一致（仅文件末多一空行） |
| `supabase/verify-policies.sql` | ✅ | G1 验收查询已落盘 |

## 二、主公只需做一件事：给 CodeBuddy 一个 PAT

> PAT = Personal Access Token，主公**账户级**、可随时在网页吊销、**不是** service_role、不绕过 RLS，安全风险可控。

1. 浏览器打开 Supabase 项目 → 左下角**头像 → Settings → Access Tokens**
2. **Generate new token**，名称填 `album-build`（过期可选，用完即吊销也行）
3. 复制生成的那串（仅显示一次）
4. 用记事本新建 `C:\Users\19101\Projects\3d-album\pat.txt`，把令牌粘进去保存
5. 告诉 CodeBuddy：「PAT 在 `pat.txt`，请按《CodeBuddy控制台操作方案》执行」

⚠️ **严禁提供 service_role key**（那是管理员钥匙，泄露后果不可控）。
⚠️ `pat.txt` 用完建议在 Settings → Access Tokens 点 **Revoke** 吊销。

## 三、CodeBuddy 接手执行步骤（编号）

> 前置：先完整读《【3D旋转图册】·产品开工令 v0.1.0.md》第三/四/七/八/十三节；PAT 从 `pat.txt` 读取，勿硬编码进代码、勿提交进 git。

### M2-A 建表（里程碑 2 收尾）

1. 读 `supabase/schema.sql` 全文。
2. 调用 Supabase Management API 执行：
   ```
   POST https://api.supabase.com/v1/projects/qzwapliyuaeyclqahbnu/database/query
   Header: Authorization: Bearer <PAT from pat.txt>
   Header: Content-Type: application/json
   Body:   { "query": "<schema.sql 全文>" }
   ```
   - 若返回「多语句不支持 / expected end of statement」，按 `;` 拆成单条语句逐条执行。
   - **注意**：`CREATE OR REPLACE FUNCTION ... $$ ... $$ LANGUAGE plpgsql` 整体算**一条**，函数体内部的 `;` 不能拆断。
3. 成功标志：返回 success / 各 CREATE 语句无报错文本。

### M2-B G1 验收查询

4. 读 `supabase/verify-policies.sql` 全文，同样用 `/database/query` 执行。
5. 收集**三块**结果，整段交主公（主公转 77）。判定线：
   - 第 2 块 `using_不过` / `withcheck_不过` 两列均 = **0**
   - 第 3 块 `is_album_member` / `is_my_member` / `share_get` 三条函数定义者均为 **SECURITY DEFINER**
   → G1 过。

### M2-C 私有 Storage 桶

6. 建桶 **`photos`**，**Visibility = Private**（绝不可 Public）。
7. 确认桶策略与 `schema.sql` 中落盘的 Storage 策略一致（已含：本人上传/本人删除）。

### M2-D 认证与跳转地址

8. Authentication → Providers：确保 **Email** 已开启（开工令要求邮箱+密码登录）。
9. Authentication → URL Configuration：
   - Site URL：`http://localhost:8000`
   - Redirect URLs 增：`http://localhost:8000/**` 与将来 Pages 地址 `https://sea9413.github.io/3d-album/**`

### M2-E 边缘函数（分享签名 URL）

10. 按开工令 13.1 部署 **`share-open`** 边缘函数：入参分享 token，校验后签发 **1 小时**私有桶签名 URL。
11. 部署成功后记录**函数 URL** 交主公转 77。

### 前端联调 / 部署（CodeBuddy 已在做，按开工令「接手须知·丁」继续）

- `auth.js`：注册 / 登录 / 登出 / 找回密码
- 独享本闭环 → 家族树 members/tree.js → 分享页
- 末了 GitHub Pages 部署（分支 `main` / 根目录，见开工令第十、十三节）

## 四、每步交付 77 验收的物

| 步骤 | 交付物（交主公转 77） |
|---|---|
| M2-A / M2-B | 建表 success 文本 + G1 三块结果（整段，不删减） |
| M2-C | 桶名 `photos` / Private 确认截图或文本 |
| M2-D | 认证与 Redirect 设置截图或文本 |
| M2-E | 边缘函数部署成功 + 函数 URL |

## 五、77 验收方式（主公转交即可，无需主公懂技术）

- **建表真假**：77 持 anon key 实测 `GET /rest/v1/photos?limit=1` —— 建表前返回 **404**（表不存在），建表后返回 **200**（空表）。以此硬判定 CodeBuddy 是否真跑通。
- **G1 真假**：77 逐条核对第 2 块两列是否 = 0、第 3 块三条是否 SECURITY DEFINER，对照开工令 4.2 策略清单。
- **桶 / 认证 / 函数**：77 用 PAT 或 anon key 针对性实测。

---

> 本方案与《【3D旋转图册】·产品开工令 v0.1.0.md》冲突时，以开工令为准。
