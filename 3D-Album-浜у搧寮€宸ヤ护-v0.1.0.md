# 【3D旋转图册】 · 产品开工令 v0.1.0

> **文档定位**：本文件是本产品的「唯一权威说明」。任何人 / AI 接手都能凭此继续开发、修复、迭代。代码改了，本文件必须同步改；有新需求，先在本文件加章节再动代码。
> **交付状态**：**已可独立交付**。2026-09-23 补入「接手须知」节（铁律 / 实现顺序 / 可复制的交接提示词），并补实 GitHub 用户名 `sea9413`。接手方请先读「接手须知」。
> **整理日期**：2026-09-23
> **当前线上版本**：v0.1.0 —— **架构定稿，代码尚未落地、尚未部署**。`js/config.js` 中 `const VER` 预定为 `'v0.1.0'`，实现后须与本文件名版本号、页面底部显示的版本号三者一致。
> **本版性质**：相比 v0.0.1（轻量本地档、单产品）属**架构级重写**——升为标准档（Supabase 云端），产品拆为「独享本 + 家族树」两个入口。v0.0.1 的立方体引擎、图片压缩、EXIF 纠正等规则全部继承。

---

## 快速信息卡（接手前必读）

| 项 | 值 |
|---|---|
| 线上地址 | `https://sea9413.github.io/3d-album/`（用户名 2026-09-23 已补实） |
| GitHub 仓库 | `https://github.com/sea9413/3d-album` |
| **档位** | **标准（Supabase）** |
| 数据库 | Supabase PostgreSQL（**项目尚待主公创建**，见 6.3 A3；建好后回填 Project URL 与此处） |
| 表 | `public.profiles`、`public.albums`、`public.members`、`public.photos`、`public.share_links` |
| 存储 | Supabase Storage，私有 bucket `photos` |
| 边缘函数 | `share-open`（唯一一个；只读分享用，见第七节） |
| 登录鉴权 | **Supabase Auth（邮箱 + 密码）**，前端只存 session（`supabase.auth.getSession()`）；**密码绝不写进代码 / JS** |
| 只读分享 | `#/s/<token>`，链接即看、不登录、不要口令（主公拍板） |
| 开发者 | 主公 + 77 |
| 部署命令 | `git push origin main`（源码与网站同分支，push 即上线） |
| 部署分支 | `main`（GitHub Pages 发布源设为 `main` / `/ (root)`） |
| 与别的项目关系 | **完全独立**。独立 Supabase 项目，不与任何其他工具共用；localStorage 键一律以 `album3d.` 前缀，防串门 |
| 兼容性下限 | iOS Safari 14+ / Chrome 90+ |
| ⚠️ 免费版两个硬限制 | ① **7 天不活跃自动暂停**项目（数据不丢，须手动 Resume）；② **不支持自定义域名**，只能用 `*.supabase.co`。详见 P19 / P20 |

---

## 接手须知（交付 AI / 开发者 —— 先读这一节）

> 本节写给**接手的 AI 或开发者**。人类读者可跳过。有了本节，本文档可**独立交付**，无需任何口头补充背景。

### 甲、你拿到的是什么

- 本文档是「3D旋转图册」的**唯一权威说明**。代码与本文件冲突时**以本文件为准**，并立即"修代码"或"改本文件"（二选一，不许两边都不动）。
- 本文档**自足**：建表 SQL、文件结构、函数签名、业务规则、常量表、验收清单全在文内，**不需要额外资料即可实现**。
- 本文档**不含任何密钥**（`anon key` 可放前端代码、`service_role key` 只放边缘函数环境变量），可安全随仓库一起提交。

### 乙、当前交付状态（2026-09-23）

| 项 | 状态 |
|---|---|
| 文档 | **架构定稿 v0.1.0**，可据此实现 |
| 代码 | **尚未落地，全部从零开始**（`js/`、`vendor/`、`supabase/functions/` 均为空） |
| 主公侧前置 | `A1` `A2` ✅ 已完成；**`A3`–`A7` 待办**（见 6.3），其中 **`A4` 连通性实测是全局前提** |
| 可开工性 | ✅ **不受前置条件阻塞**——`config.js`、`image.js`、`cube.js` 等纯前端部分可直接写完，只有"连真库联调"需等 A3 |

### 丙、八条铁律（违反即返工，不得自行变通）

1. 五张表全开 RLS，**每条策略必带 `auth.uid()` 过滤**；跨表判定**一律走 `SECURITY DEFINER` 函数** —— 否则 `infinite recursion detected in policy`，整站 500（详见 7.4）。
2. `service_role` key **绝不**进前端代码 / GitHub 仓库 / 本文档，只放 Edge Function 环境变量。
3. 分享 token 必须 **32 字节随机**（`crypto.getRandomValues` + base64url）；**禁止** UUID / 时间戳 / 自增。
4. `cube.js` **必须与数据源解耦**，只吃 `{thumbUrl, fullUrl, name, caption}` —— 独享本 / 果实 / 分享页 / 全家福全靠复用同一份。
5. 立方体**只渲染缩略图**；EXIF 方向**先纠正再缩放**；`createObjectURL` 与 `revokeObjectURL` **必须成对**。
6. Storage 路径格式**一经确定不可改**（桶策略靠路径第一段判定归属，改了全站图片 404）。
7. 所有用户输入一律 `textContent` 渲染；必须拼 HTML 处先 `escapeHtml`。
8. 第三方库**锁确切版本号**并内联 `vendor/`，不裸引 CDN；**无构建步骤**（原生 ES Modules）。

### 丁、实现顺序与对应验收

| 序 | 交付 | 做完先跑 |
|---|---|---|
| 1 | `index.html` + `config.js`（4.4 常量表唯一来源）+ `ui.js` 骨架 | J1、J2 |
| 2 | 建表 SQL 整段执行 + 逐条核对策略 | G1（**逐条看 `qual`/`with_check`，不是数条数**） |
| 3 | `supabase.js` + `auth.js`：注册 / 登录 / 登出 / 找回密码 | A 组全部 |
| 4 | `image.js`：两份压缩 + EXIF 纠正 + HEIC 跳过提示 | B4、B5 |
| 5 | `cube.js`：虚拟立方体 + 手势 + 惯性吸附 | C 组全部 |
| 6 | `storage.js` + `db.js` + 独享本闭环（上传 → 立方体 → 分享） | B 组、E 组 |
| 7 | `tree.js` + `members`：辈分树 + 果实 + 邀请入伙 | D 组、E 组 |
| 8 | `share.js` + Edge Function `share-open`：只读分享 | F 组、G 组 |
| 9 | `backup.js`：zip 导出 / 导入 | H5 |
| 10 | 全量回归 + 上线 | H6（关 WiFi 用流量实测）、J 组 |

### 戊、不确定时怎么办

- 文档没写的事，**不要自己发明**，更**不许用占位值凑数**（常量必须取自 4.4，缺真值就向主公要）。
- 想加文档没有的功能 → **先在本文档加章节并 bump 版本**，不许"顺手加一下"（见第九节）。
- 发现文档有错或有更好做法 → 改本文档 + 在第十节版本历史记一行，然后告知主公。

### 己、可直接复制给接手方的提示词

```
请接手实现「3D旋转图册 v0.1.0」。工作区根目录的
《【3D旋转图册】 · 产品开工令 v0.1.0.md》是本项目的唯一权威说明，
请先完整读完，尤其是「接手须知」与第七节。

硬性要求：
1. 严格按第七节「文件结构」与「接手须知 · 丁」的实现顺序推进；
   原生 ES Modules、无构建步骤、不引框架、不装 npm 依赖。
2. 遵守「接手须知 · 丙」的八条铁律，特别是 RLS 的 SECURITY DEFINER
   函数、service_role 保密、分享 token 必须 32 字节随机。
3. 4.4「内置常量表」是常量唯一来源，全部落进 js/config.js，
   禁止在别处散落魔法数字，禁止用占位值凑数。
4. 每完成一个里程碑，先跑第八节对应验收条目并把结果告我，再进入下一步。
5. 需要我在控制台操作的（建 Supabase 项目、执行 SQL、建私有桶、开 Email
   认证、填 Redirect URLs、部署边缘函数、建仓库开 Pages），请整理成编号
   步骤，我照做；你不要代我做任何账号类操作。
6. 遇到文档没写的事，停下来问我；不要自行发明，也不要"顺手加一下"。
7. 本地调试不要双击 index.html（file:// 下 ES Modules 会被拦），
   用 python -m http.server 8000。
8. 每次发版按第十节规则：bump config.js 的 VER → 改本文档文件名版本号
   → 版本历史加一行 → git commit -F commit-msg.txt → push。
```

---

## 〇、产品一句话 + 可量化成功指标

**一句话**：一个手机网页上的「3D 旋转图册」，有两种用法——**独享本**（自己传给自己看的私人相册，可生成一条"仅查看"链接发给别人）和**家族树**（一家人各自手机往同一棵树上传照片，树上一个果实就是一个家人，点开果实就是他的 3D 旋转相册）。

**两条产品线，共享同一套内核**（主公拍板「一个站点两个入口」），差异只在两处：

| | 独享本 Solo | 家族树 Family |
|---|---|---|
| 谁能看 | 只有自己（+ 持分享链接的外人，只读） | 树内所有已加入的家人 |
| 谁能传 | 只有自己 | 每个成员只能传到**自己的果实** |
| 外层外壳 | 直接进立方体 | 先进「参天大树」，点果实再进立方体 |
| 数据结构 | 一个 album，照片 `member_id` 为空 | 一个 album + N 个 member，照片挂在 member 上 |

**可量化成功指标**（v0.1.0 验收即以此为准，没数字 = 没交付）：

| # | 指标 | 目标值 |
|---|---|---|
| M1 | 批量上传 | 4G 网络下一次选 **20 张**手机原图，到全部可正常翻看 **< 90 秒**（含压缩与上传） |
| M2 | 手势跟手 | 手指左右拖动，立方体跟手转动无延迟；松手后停在最近一个正面，**倾斜角为 0（不歪）** |
| M3 | 大相册流畅 | 单个相册 **≥ 100 张**图，iPhone 上连续翻看 **20 次**，不卡顿、不白屏、不出内存告警 |
| M4 | 树的第一眼 | 手机打开家族树，**5 秒内**看完整棵树全貌（含所有果实头像），拖拽旋转跟手 |
| M5 | 建树到入伙 | 建树者创建家族树 → 发出邀请 → 家人在自己手机上完成注册并上传第一张照片，**全流程 ≤ 5 分钟且无需向任何人求助** |
| M6 | 权限隔离 | 用 A 账号登录，**看不到也改不了** B 账号的任何私人相册；A 只能往自己的果实传照片（用两账号实测） |
| M7 | 分享只读 | 在未登录的浏览器（无痕窗口）打开分享链接，**能看到照片**；该窗口下**看不到**任何上传 / 删除 / 编辑入口 |
| M8 | 撤销分享 | 点「撤销分享」后，同一个链接再打开**立即失效** |
| M9 | 首次上手 | 从零开始的人（不含说明）能在 **90 秒内**完成第一次上传并看到立方体转动 |

---

## 一、产品定位

**① 解决什么问题**
两个不同的问题，被同一个内核同时解决：

1. **独享本**：自己攒的一批照片，想有一个专注、好看、愿意翻的载体，而不是埋在手机相册的几千张里；同时希望能**发给别人看**，但不想让他们乱传乱改。
2. **家族树**：一家人的照片散在各自手机里，互相看不到。把"传照片"这件事从群里刷屏，变成"往树上挂一颗果实"——每个人一片自己的领地，合起来是一棵家族大树。

**② 目标用户**

| 维度 | 描述 |
|---|---|
| 谁 | 主公本人 + 家人（家庭私域）。独享本也可能给朋友看（只读链接） |
| 技术水平 | **零技术基础**。不会配置任何东西，只会「打开链接、点按钮、选照片」 |
| 设备 | iPhone 为主（Safari），兼顾 Windows 电脑浏览器（Chrome / Edge） |
| 数量预期 | 单人果实 20–200 张；家族树成员 3–20 人；单树总照片 100–2000 张 |
| 网络 | 常态化联网使用（本版为云端档，不再承诺离线） |

**③ 产品形态**

| 维度 | 选型 | 理由 |
|---|---|---|
| 形态 | **手机网页**（响应式，电脑上为居中卡片） | 不用装 App，链接一开就是 |
| 前端 | 原生 HTML + CSS + 原生 JS **ES Modules**（多文件，无构建步骤） | 逻辑必然超 400 行，按纪律拆模块；GitHub Pages 直接托管，push 即上线 |
| 后端 | **Supabase**（PostgreSQL + Auth + Storage + Edge Functions） | 自带 REST、鉴权、对象存储，免费额度足够家庭使用 |
| 部署 | GitHub Pages，发布源 = `main` / 根目录 | `git push` 即上线，无需切分支 |
| 图片存储 | Supabase Storage 私有 bucket `photos` | 私有桶 + 策略控制，绝不使用 public 桶 |

---

## 二、核心使用场景

### A. 独享本

**S-A1｜第一次用自己的私人相册**
打开链接 → 首页看到两个大卡片：「我的独享本」和「家族树」 → 点「我的独享本」 → 未登录则进登录/注册页 → 用邮箱密码登录 → 进入空状态页「还没有照片，点下面开始」 → 点「+ 添加照片」 → 选图 → 看到上传进度 → 立方体带着第一张照片出现。

**S-A2｜日常翻看**
打开链接 → 点「我的独享本」 → **已登录则直接进**立方体，停在**上次看的那一张** → 手指左右拖 → 立方体翻滚 → 松手吸附 → 底部显示「第 7 / 60 张」。

**S-A3｜生成只读分享链接**
在相册页点右上角「分享」 → 弹出面板写明「拿到链接的人无需登录即可查看，但不能修改」 → 点「生成链接」 → 得到 `https://sea9413.github.io/3d-album/#/s/xK9…` → 点「复制」 → 已生成时面板显示「查看次数 3 次」和「撤销分享」按钮。

**S-A4｜撤销分享**
同一个面板 → 点「撤销分享」 → 二次确认「撤销后该链接立即失效，已收到链接的人将无法再打开」 → 确认 → 链接作废，分享状态回到未分享。

### B. 家族树

**S-B1｜建一棵家族树**
首页点「家族树」 → 已登录 → 点「种一棵新树」 → 取名（默认「我们家」） → 自动在树上生成**第一个果实 = 你自己**，并标为「建树者」 → 进入树视图，看到一个果实挂在树中央。

**S-B2｜把家人拉进树**
在树视图点「添加家人」 → 填称谓（如「爷爷」「妈妈」）、显示名 → 选择「挂在哪一位下面」（决定辈分，默认挂在建树者之下或作为建树者的长辈） → 保存 → 树上多出一个**空心果实**（灰色，表示人还没入伙） → 点该果实 → 弹出「邀请他/她」 → 生成邀请链接并复制 → 发给家人。

**S-B3｜家人入伙（家人视角）**
家人收到链接 → 打开 → 看到「XX 邀请你加入『我们家』的家族树，你会成为树上的『妈妈』」 → 点「加入」 → 注册/登录 → 完成后**自动绑定到那个果实上**，果实由灰变亮，显示自己的头像 → 家人看到「点下面的按钮，把你的照片挂到树上」。

**S-B4｜家人上传**
家人点自己的果实 → 进入自己的 3D 立方体空相册 → 点「+ 添加照片」 → 选图 → 上传 → 立方体转动起来。**只有自己能往这个果实传，别人传不了。**

**S-B5｜在树上看全家**
打开家族树 → 看到参天大树，所有果实分布在对应辈分的层级上，每个果实是自己的圆形头像 → 手指左右拖动，**整棵树旋转**，能绕到背面看到另一侧的家人 → 双指捏合可缩放 → **点某个果实** → 该果实放大，进入该家人的 3D 旋转相册 → 返回后仍在树上原来的位置。

**S-B6｜长辈还没入伙时**
家族树里存在灰色空心果实（已建好位置、还没绑定账号） → 点开它 → 提示「TA 还没加入，你的家族树正在等 TA」+ 「再次复制邀请链接」。**不允许**其他人替这个果实上传照片（主公拍板「只传自己的」）。

### C. 只读访客（未登录、无账号）

**S-C1｜打开别人分享的链接**
在微信里收到链接 → 点开 → 页面直接显示对方的 3D 立方体相册（不要求登录）→ 可左右拖动翻看、可点开放大、可看说明文字 → 页面上**没有任何上传 / 删除 / 编辑按钮** → 底部有一行小字「本相册为只读分享」。

**S-C2｜链接失效**
点开已被撤销或错误的链接 → 显示明确页面「这个分享链接已失效或不存在」，**不是白屏、不是空白立方体**。

---

## 三、功能清单

### 3.1 内核（两条产品线共用）

| 功能 | 说明 |
|---|---|
| 虚拟立方体翻页 | 视觉上无限延伸的立方体，DOM 恒定只挂 5–6 个面（详见第五节 R1） |
| 拖拽旋转 + 惯性吸附 | Pointer Events 统一鼠标/触摸；松手后吸附到最近 90°（详见 R2） |
| 点击与滑动区分 | 位移超阈值判为滑动，否则判为点击进全屏；**两者不能同时触发** |
| 图片压缩 | 上传前 canvas 压缩为「原图（长边 ≤1600）+ 缩略图（长边 ≤320）」两份 |
| EXIF 方向纠正 | iPhone 竖拍照片必须摆正（详见 R6） |
| 全屏看图 | 点击正面图进入；左右滑切换；Esc / 返回手势退出 |
| 看图说明 | 每张可有名称 + 一句话描述 |
| 大图/缩略图分离 | 立方体**只渲染缩略图**，全屏才加载原图 |
| 键盘操作 | 电脑端 ← / → 翻页，空格进全屏 |

### 3.2 独享本模块

| 功能 | 说明 |
|---|---|
| 单个私人相册 | v0.1.0 每个用户**只有一个**独享本（简化；多本列入"不做"） |
| 相册改名 | 可改标题 |
| 上传 / 删除照片 | 删除需二次确认，不可撤销 |
| 拖动排序 | 在「列表视图」中拖动调整（立方体视图内不排序，防与旋转手势冲突） |
| 本地导出备份 | zip 导出（元数据 + 图片），作为云端之外的第二道防线 |

### 3.3 家族树模块

| 功能 | 说明 |
|---|---|
| 种树 | 创建家族树，取名；建树者自动成为第一个果实 |
| 添加果实（成员节点） | 填称谓 + 显示名 + 辈分归属（挂在谁下面） |
| 辈分自动推导 | 由"挂在谁下面"推导辈分层级，无需手填数字（详见 R3） |
| 3D 参天大树 | 环形分层 + 层间落差的 CSS 3D 树；整树可拖拽旋转、可捏合缩放（详见第七节 7.5） |
| 果实状态 | **亮果实**=已入伙（有头像）；**灰果实**=已建位、待入伙 |
| 点果实进相册 | 点击果实 → 进入该家人的 3D 旋转立方体相册 |
| 邀请链接 | 为某个果实生成可复用邀请链接，复制即用 |
| 成员管理 | 建树者可改称谓、调整挂靠位置、移除果实（需二次确认，并说明其照片会被一并移除） |

### 3.4 分享模块（只读）

| 功能 | 说明 |
|---|---|
| 生成分享链接 | 可为「整个独享本」或「树上的某个果实」生成 |
| 链接即看 | 无需登录、无需口令（主公拍板） |
| 查看次数统计 | 面板显示该链接被打开过几次 |
| 撤销分享 | 一键作废，立即生效 |
| 分享页只读 | 分享页**不渲染**任何写操作入口；数据由服务端白名单字段返回（详见 R5） |
| 失效提示 | token 无效 / 已撤销 → 明确提示页，不白屏 |

### 3.5 账号与权限

| 功能 | 说明 |
|---|---|
| 邮箱注册 / 登录 | Supabase Auth；密码强度下限由 Supabase 配置（不少于 8 位） |
| 找回密码 | 走 Supabase 邮件重置 |
| 会话保持 | 前端只存 session，**绝不存密码** |
| 登出 | 清除本地 session 与所有缓存的对象 URL |
| 权限隔离 | 陌生人之间完全隔离；同树成员之间"能看不能改"（详见 R4） |

### 3.6 引导与降级

| 功能 | 说明 |
|---|---|
| 首页双入口 | 两张卡片：「我的独享本」/「家族树」 |
| 空状态引导 | 无照片 / 无家人时，给出下一步动作按钮，不留空白页 |
| Supabase 加载失败降级 | 客户端库或网络异常 → 明确提示「网络异常，云端功能暂不可用，请检查网络后刷新」，**绝不白屏**（清单第 15 条） |
| 脚本加载失败降级 | 模块 404 / 语法错误 → 3 秒后兜底提示「加载失败，请刷新重试」 |
| 上传失败可见化 | 逐张报告「成功 N 张 / 失败 M 张」，失败原因可见 |
| 全局错误可见化 | `window.onerror` + `unhandledrejection` → 页面底部红条「出错了：<简述>」（内容经转义） |

### 3.7 安全与隐私（强制）

| 功能 | 说明 |
|---|---|
| 全部表启用 RLS | 五张表**全部** `ENABLE ROW LEVEL SECURITY`，且**每条策略都带 `auth.uid()` 过滤**（清单第 2 条） |
| 私有 Storage 桶 | bucket `photos` **不设 public**；只读分享通过服务端签发的短期签名 URL |
| 跨表权限判定用 SECURITY DEFINER 函数 | 避免 RLS 策略自我递归（详见 7.4，这是本版最容易炸的点） |
| 分享令牌高熵 | token 用 `crypto.getRandomValues` 生成 **32 字节**并 base64url 编码；**禁止**用 UUID / 时间戳 / 自增（可枚举） |
| 用户输入转义 | 所有名称 / 说明 / 称谓一律 `textContent` 渲染；必须拼 HTML 处先 `escapeHtml` |
| 报错信息转义 | 错误提示里若含用户数据，同样转义 |
| 最小化收集 | 只收邮箱 + 显示名 + 照片；**不收手机号、不收位置、不收通讯录** |

---

## 四、数据字段与数据库

> 本项目为**标准档**。以下建表 SQL **全部幂等**（`IF NOT EXISTS` / `DROP POLICY IF EXISTS`），**可整段重跑**（清单第 1 条）。

### 4.1 表结构

#### `profiles` —— 用户资料

| 字段 | 中文 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | 用户 ID | uuid | 是 | 主键，外键指向 `auth.users(id)` |
| `display_name` | 显示名 | text | 否 | 默认取邮箱前缀 |
| `avatar_url` | 头像地址 | text | 否 | v0.1.0 仅存不用（头像直接用其果实内第一张照片） |
| `created_at` | 创建时间 | timestamptz | 是 | 默认 `now()` |

> **注意**：`profiles` **只允许本人读写**。家族树里显示的是 `members.display_name`，不依赖跨用户读 profiles——这样既省事又不多开一个口子。

#### `albums` —— 相册（两种形态统一）

| 字段 | 中文 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | 相册 ID | uuid | 是 | 主键 |
| `owner_id` | 创建者 | uuid | 是 | 外键 → `auth.users(id)`；家族树即"建树者" |
| `kind` | 类型 | text | 是 | `'solo'`（独享本）/ `'family'`（家族树） |
| `title` | 标题 | text | 是 | 默认「我的相册」/「我们家」 |
| `cover_photo_id` | 封面照片 | uuid | 否 | v0.1.0 仅存不用，为后续预留 |
| `created_at` / `updated_at` | 时间 | timestamptz | 是 | |

> 每个用户最多 1 个 `solo` + 最多 3 个 `family`（v0.1.0 由前端限制，不做数据库约束）。

#### `members` —— 树上的果实（家族树成员节点）

| 字段 | 中文 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | 果实 ID | uuid | 是 | 主键 |
| `album_id` | 所属树 | uuid | 是 | 外键 → `albums(id)`，`on delete cascade` |
| `user_id` | 绑定账号 | uuid | **否** | 外键 → `auth.users(id)`，`on delete set null`。**为空 = 灰果实（还没入伙）** |
| `display_name` | 显示名 | text | 是 | 由建树者填写，入伙后成员可自行修改 |
| `relation` | 称谓 | text | 否 | 如「爷爷」「妈妈」，最长 10 字 |
| `generation` | 辈分 | int | 是 | 默认 0；**由 `parent_member_id` 自动推导，不由用户手填**（见 R3） |
| `parent_member_id` | 挂在谁下面 | uuid | 否 | 自引用 → `members(id)`，`on delete set null` |
| `order_index` | 同层排序 | int | 是 | 默认 0，同层内决定果实绕树顺序 |
| `joined_at` | 入伙时间 | timestamptz | 否 | 灰果实为空；入伙时写入 |
| `created_at` | 创建时间 | timestamptz | 是 | |

#### `photos` —— 照片

| 字段 | 中文 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | 照片 ID | uuid | 是 | 主键 |
| `album_id` | 所属相册 | uuid | 是 | 外键 → `albums(id)`，`on delete cascade` |
| `member_id` | 所属果实 | uuid | **否** | 外键 → `members(id)`，`on delete cascade`。**独享本为 NULL**；家族树必填 |
| `owner_id` | 上传者 | uuid | 是 | 外键 → `auth.users(id)`；**权限判定的核心依据** |
| `storage_path` | 原图路径 | text | 是 | 形如 `<album_id>/<member_id\|solo>/<photo_id>_full.webp` |
| `thumb_path` | 缩略图路径 | text | 是 | 同上，后缀 `_thumb.webp` |
| `name` | 名称 | text | 否 | 默认空串，最长 `MAX_TEXT_LEN` |
| `caption` | 说明 | text | 否 | 默认空串，最长 `MAX_TEXT_LEN` |
| `width` / `height` | 尺寸 | int | 否 | 压缩后尺寸，用于面比例计算 |
| `size_bytes` | 字节数 | bigint | 否 | 用于用量统计 |
| `order_index` | 排序 | double precision | 是 | 默认 0；间隔 10 递增（见 R7） |
| `taken_at` | 拍摄时间 | timestamptz | 否 | 从 EXIF 读；读不到则留空 |
| `created_at` | 上传时间 | timestamptz | 是 | |

#### `share_links` —— 只读分享链接

| 字段 | 中文 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | ID | uuid | 是 | 主键 |
| `album_id` | 分享的相册 | uuid | 是 | 外键 → `albums(id)`，`on delete cascade` |
| `member_id` | 分享的果实 | uuid | 否 | 外键 → `members(id)`，`on delete cascade`。**为空 = 分享整本；有值 = 只分享该果实** |
| `token` | 令牌 | text | 是 | **32 字节随机 + base64url**，唯一索引；**禁止可枚举格式** |
| `created_by` | 创建者 | uuid | 是 | 外键 → `auth.users(id)` |
| `revoked_at` | 撤销时间 | timestamptz | 否 | 非空即失效 |
| `view_count` | 查看次数 | int | 是 | 默认 0，由 `share_get` 自增 |
| `created_at` | 创建时间 | timestamptz | 是 | |

### 4.2 建表 SQL（幂等，可整段重跑）

```sql
-- ============ 0. 先跑辅助函数（策略里要用，必须先于策略创建）============

-- 判定「我是否属于这个相册」：相册主人，或该树里已入伙的成员
-- 【关键】必须 security definer，否则 members 表的策略里再查 members 会触发
-- 「infinite recursion detected in policy」——这是本版最容易炸的点（见 7.4）
create or replace function public.is_album_member(p_album_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.albums a
    where a.id = p_album_id and a.owner_id = auth.uid()
  ) or exists (
    select 1 from public.members m
    where m.album_id = p_album_id and m.user_id = auth.uid()
  );
$$;

-- 判定「这个果实是不是我的」
create or replace function public.is_my_member(p_member_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.members m
    where m.id = p_member_id and m.user_id = auth.uid()
  );
$$;

-- 只读分享：按 token 取白名单数据（供匿名只读使用）
-- 【关键】只返回白名单字段，绝不返回 owner_id / user_id / created_by 等身份信息
create or replace function public.share_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link   public.share_links;
  v_result jsonb;
begin
  select * into v_link
    from public.share_links
   where token = p_token and revoked_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'LINK_INVALID');
  end if;

  select jsonb_build_object(
    'ok', true,
    'album', jsonb_build_object('title', a.title, 'kind', a.kind),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'display_name', m.display_name,
        'relation', m.relation,
        'generation', m.generation,
        'parent_member_id', m.parent_member_id,
        'order_index', m.order_index,
        'joined', (m.user_id is not null)
      ) order by m.order_index)
      from public.members m
      where m.album_id = a.id
        and (v_link.member_id is null or m.id = v_link.member_id)
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'member_id', p.member_id,
        'storage_path', p.storage_path,
        'thumb_path', p.thumb_path,
        'name', p.name,
        'caption', p.caption,
        'width', p.width,
        'height', p.height,
        'order_index', p.order_index
      ) order by p.order_index)
      from public.photos p
      where p.album_id = a.id
        and (v_link.member_id is null or p.member_id = v_link.member_id)
    ), '[]'::jsonb)
  ) into v_result
  from public.albums a
  where a.id = v_link.album_id;

  update public.share_links
     set view_count = view_count + 1
   where id = v_link.id;

  return v_result;
end;
$$;

-- 只允许登录用户调用两个权限判定函数；share_get 允许匿名调用（分享页必须能用）
revoke all on function public.is_album_member(uuid) from public;
revoke all on function public.is_my_member(uuid)    from public;
revoke all on function public.share_get(text)       from public;
grant execute on function public.is_album_member(uuid) to authenticated;
grant execute on function public.is_my_member(uuid)    to authenticated;
grant execute on function public.share_get(text)       to anon, authenticated;


-- ============ 1. profiles ============
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles 本人可读" on public.profiles;
create policy "profiles 本人可读" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles 本人可插" on public.profiles;
create policy "profiles 本人可插" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles 本人可改" on public.profiles;
create policy "profiles 本人可改" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);


-- ============ 2. albums ============
create table if not exists public.albums (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  kind           text not null check (kind in ('solo','family')),
  title          text not null default '我的相册',
  cover_photo_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists albums_owner_idx on public.albums(owner_id);
alter table public.albums enable row level security;

-- 本人可读，或「我是这棵树里已入伙的成员」时可读（家人要能看到树）
drop policy if exists "albums 本人或树成员可读" on public.albums;
create policy "albums 本人或树成员可读" on public.albums
  for select using (
    auth.uid() = owner_id
    or public.is_album_member(albums.id)
  );

drop policy if exists "albums 本人可建" on public.albums;
create policy "albums 本人可建" on public.albums
  for insert with check (auth.uid() = owner_id);

drop policy if exists "albums 本人可改" on public.albums;
create policy "albums 本人可改" on public.albums
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "albums 本人可删" on public.albums;
create policy "albums 本人可删" on public.albums
  for delete using (auth.uid() = owner_id);


-- ============ 3. members ============
create table if not exists public.members (
  id               uuid primary key default gen_random_uuid(),
  album_id         uuid not null references public.albums(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  display_name     text not null,
  relation         text,
  generation       int not null default 0,
  parent_member_id uuid references public.members(id) on delete set null,
  order_index      int not null default 0,
  joined_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists members_album_idx  on public.members(album_id);
create index if not exists members_user_idx   on public.members(user_id);
create index if not exists members_parent_idx on public.members(parent_member_id);
alter table public.members enable row level security;

-- 用 SECURITY DEFINER 函数判定，避免策略自我递归
drop policy if exists "members 树内可读" on public.members;
create policy "members 树内可读" on public.members
  for select using (public.is_album_member(album_id));

-- 只有建树者能添加果实
drop policy if exists "members 建树者可插" on public.members;
create policy "members 建树者可插" on public.members
  for insert with check (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
  );

-- 建树者可改；成员本人也可改（应用层限制为只改自己的 display_name）
drop policy if exists "members 建树者或本人可改" on public.members;
create policy "members 建树者或本人可改" on public.members
  for update using (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
    or auth.uid() = members.user_id
  ) with check (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
    or auth.uid() = members.user_id
  );

drop policy if exists "members 建树者可删" on public.members;
create policy "members 建树者可删" on public.members
  for delete using (
    exists (select 1 from public.albums a
            where a.id = members.album_id and a.owner_id = auth.uid())
  );


-- ============ 4. photos ============
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums(id) on delete cascade,
  member_id    uuid references public.members(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  thumb_path   text not null,
  name         text default '',
  caption      text default '',
  width        int,
  height       int,
  size_bytes   bigint,
  order_index  double precision not null default 0,
  taken_at     timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists photos_album_idx  on public.photos(album_id);
create index if not exists photos_member_idx on public.photos(member_id);
create index if not exists photos_owner_idx  on public.photos(owner_id);
alter table public.photos enable row level security;

-- 看：树内 / 本人可看
drop policy if exists "photos 树内可读" on public.photos;
create policy "photos 树内可读" on public.photos
  for select using (public.is_album_member(album_id));

-- 传：只能传进自己有权的相册，且（家族树里）只能传进自己的果实
drop policy if exists "photos 只能传到自己的果实" on public.photos;
create policy "photos 只能传到自己的果实" on public.photos
  for insert with check (
    auth.uid() = owner_id
    and public.is_album_member(album_id)
    and (
      member_id is null                                  -- 独享本
      or public.is_my_member(member_id)                  -- 家族树只能传自己的果实
    )
  );

-- 改 / 删：只能动自己上传的
drop policy if exists "photos 只能改自己的" on public.photos;
create policy "photos 只能改自己的" on public.photos
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "photos 只能删自己的" on public.photos;
create policy "photos 只能删自己的" on public.photos
  for delete using (auth.uid() = owner_id);


-- ============ 5. share_links ============
create table if not exists public.share_links (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.albums(id) on delete cascade,
  member_id  uuid references public.members(id) on delete cascade,
  token      text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists share_links_album_idx on public.share_links(album_id);
create index if not exists share_links_token_idx on public.share_links(token);
alter table public.share_links enable row level security;

-- 【重要】share_links 绝不对 anon 开放任何策略。
-- 匿名访问一律走上面的 share_get() SECURITY DEFINER 函数。
drop policy if exists "share_links 本人可读" on public.share_links;
create policy "share_links 本人可读" on public.share_links
  for select using (auth.uid() = created_by);

drop policy if exists "share_links 本人可建" on public.share_links;
create policy "share_links 本人可建" on public.share_links
  for insert with check (
    auth.uid() = created_by
    and exists (select 1 from public.albums a
                where a.id = share_links.album_id and a.owner_id = auth.uid())
  );

-- 撤销 = update revoked_at
drop policy if exists "share_links 本人可改" on public.share_links;
create policy "share_links 本人可改" on public.share_links
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "share_links 本人可删" on public.share_links;
create policy "share_links 本人可删" on public.share_links
  for delete using (auth.uid() = created_by);


-- ============ 6. Storage 策略（bucket 需先在控制台建：photos，Private）============
drop policy if exists "photos 桶 会员可读" on storage.objects;
create policy "photos 桶 会员可读" on storage.objects
  for select using (
    bucket_id = 'photos'
    and public.is_album_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "photos 桶 会员可传" on storage.objects;
create policy "photos 桶 会员可传" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and public.is_album_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "photos 桶 本人可删" on storage.objects;
create policy "photos 桶 本人可删" on storage.objects
  for delete using (
    bucket_id = 'photos'
    and public.is_album_member(((storage.foldername(name))[1])::uuid)
  );
```

### 4.3 Storage 路径约定

```
photos/<album_id>/<member_id|solo>/<photo_id>_full.webp
photos/<album_id>/<member_id|solo>/<photo_id>_thumb.webp
```

- 第一段固定为 `<album_id>`，因为 Storage 策略靠 `(storage.foldername(name))[1]` 取它判定权限。
- **路径里不放用户名、邮箱、真实姓名**，避免路径本身泄露隐私。
- 分享页的图片由边缘函数签发**短期签名 URL**（有效期 1 小时），不开放桶的 public。

### 4.4 内置常量表（清单第 21 条：禁用 AI 占位值）

> **主公已拍板（U4）：本节全部数值采用 77 的建议值。** 后续若要调整，改 `js/config.js` 并 bump 版本。

| 常量名 | 取值 | 含义 | 来源 |
|---|---|---|---|
| `MAX_EDGE_FULL` | `1600` | 压缩后原图长边像素上限 | 主公 2026-09-23 采纳 77 建议 |
| `MAX_EDGE_THUMB` | `320` | 缩略图长边像素上限 | 同上 |
| `JPEG_QUALITY` | `0.82` | 压缩质量（0–1） | 同上 |
| `MAX_TEXT_LEN` | `60` | 名称 / 描述单字段最大字数 | 同上 |
| `MAX_RELATION_LEN` | `10` | 称谓最大字数 | 同上 |
| `WARN_PHOTO_COUNT` | `200` | 单个果实超过则提示（仅提示） | 同上 |
| `BACKUP_REMIND_DAYS` | `30` | 距上次导出备份多少天开始提醒 | 同上 |
| `ROTATE_STEP` | `90` | 立方体每面旋转角度（度） | 固定几何值 |
| `RENDER_WINDOW` | `2` | 当前张前后各保留几张真实面 | 固定实现参数 |
| `INERTIA_DECAY` | `0.95` | 惯性每帧衰减系数 | 固定手感参数 |
| `SNAP_THRESHOLD` | `0.15` | 触发吸附的角度阈值（× 90°） | 固定手感参数 |
| `MIN_SWIPE_SPEED` | `0.05` | 判定「滑动」而非「点击」的最小位移比 | 固定手势参数 |
| `TREE_LAYER_GAP` | `180` | 树相邻辈分层之间的垂直落差（px） | 固定表现参数 |
| `TREE_MIN_RADIUS` | `160` | 同层果实圆环的最小半径（px） | 固定表现参数 |
| `TREE_RADIUS_PER_MEMBER` | `70` | 同层每多一个果实，圆环半径增加量（px） | 固定表现参数 |
| `SIGNED_URL_TTL` | `3600` | 分享页签名 URL 有效期（秒） | 77 建议，安全与体验折中 |
| `MAX_SOLO_ALBUM` | `1` | 每人独享本上限 | 77 建议（简化 v0.1.0） |
| `MAX_FAMILY_ALBUM` | `3` | 每人可建的家族树上限 | 77 建议 |

---

## 五、关键业务规则

> **R1–R2 是产品心脏**；**R3–R5 是家族树与分享的正确性根**；**R6–R9 是"改了会丢数据 / 会崩"的坑**。

**R1｜虚拟立方体（核心，从 v0.0.1 继承）**
真实立方体**只有 6 个面**，而一个果实可能有 200 张。
- DOM 中真实存在的面 **最多 5 个**：当前张、左 1、左 2、右 1、右 2。
- 每完成一次翻页（吸附结束），把「离当前最远的那一面」的节点回收，内容替换为新的待显示张，重新定位到背面（不可见位置）。
- 视觉上是**无限延伸的立方体**，实际 DOM 节点数与内存占用恒定。
- 首张 / 末张按环形取模（`mod`）计算邻居，保证头尾衔接不出现空洞。
- **引擎必须与数据源解耦**：`cube.js` 只接受 `{ thumbUrl, fullUrl, name, caption }` 数组，不认识 Supabase。这样独享本 / 果实 / 分享页 / 全家福全都复用同一个引擎。

**R2｜手势与吸附（从 v0.0.1 继承）**
- 位移判定：横向位移 > 屏宽 × `MIN_SWIPE_SPEED` 视为「滑动」，否则视为「点击」。**必须先判定再执行，不能同时触发**。
- 拖动中：`angle = startAngle + (dx / 屏宽) * 180`。
- 松手：按最后几帧速度给惯性，每帧 `velocity *= INERTIA_DECAY`，低于阈值后吸附 `angle = Math.round(angle / 90) * 90`。
- **拖动过程中必须关掉 transition**（设 `transition: none`），否则手感发飘——这是最容易踩的手感坑。

**R3｜树的辈分规则（新）**
- 用户**不手填辈分数字**，只选「挂在哪一位下面」。
- 建树者 = 第一个果实。建树者可把自己挂到某个新果实下面（表示"这是我爸，那我辈分比他低"），系统据此重算全树 `generation`。
- 推导：`generation(自己) = generation(父节点) + 1`；无父节点者为 `0`。
- **必须全树重算**，实现为纯函数 `recalcGenerations(members)`，输入输出都是纯数据（便于测试）。不允许增量更新——一次调整会牵动所有后代。
- 同层果实按 `order_index` 决定绕树顺序；相同时按 `created_at` 兜底，**保证顺序稳定**（不允许每次刷新果实位置乱跳）。
- **防环**：设置 `parent_member_id` 前必须检测目标不是自己的后代，否则形成环、树渲染死循环。检测失败则拒绝并提示。

**R4｜权限规则（新，核心）**
- **独享本**：只有 `owner_id` 本人能读写；外人连存在都不知道。
- **家族树**：树内已入伙成员之间「**能看不能改**」——
  - 能看：整棵树结构、所有果实的显示名与称谓、**所有果实的照片**。
  - 不能改：不能改别人的相册标题、不能改/删别人的照片、不能改别人果实的显示名。
- **上传**：只能传进**自己的果实**（`photos` 的 insert 策略已强制）。**连建树者也不能替别人传**（主公 2026-09-23 拍板 U8）。
- **管理**：只有建树者能增删果实、调整挂靠位置、移除果实。
- ⚠️ 副作用须知：上一条意味着**不会用手机的长辈必须有账号才能有照片**。这是主公明确选择的取舍，缓解手段见 R9。

**R5｜分享规则（新，安全要害）**
- token 生成：`crypto.getRandomValues(new Uint8Array(32))` → base64url。**禁止** UUID、时间戳、自增 ID、用户名拼接（可枚举 = 等于公开全站）。
- 生成分享链接不产生数据副本，只是**授权**；撤销即 `revoked_at = now()`，**立即失效**。
- 匿名访客的数据**只能**从 `share_get(token)` 拿，且函数只返回白名单字段（无 `owner_id` / `user_id` / `created_by` / 邮箱）。
- 匿名访客的图片**只能**通过边缘函数签发的**短期签名 URL** 获取（`SIGNED_URL_TTL` 秒）。
- 分享页前端**不渲染**任何写操作入口（不是"藏起来"，是根本不生成 DOM）。
- 分享页拿到数据后**不再调用任何其他接口**（避免越权面扩大）。
- ⚠️ 已知取舍（主公已拍板"链接即看"）：**链接转发出去就收不回。** 页面必须明写「任何拿到此链接的人都能查看」，并在分享面板提供显眼的「撤销分享」。

**R6｜图片压缩与方向（从 v0.0.1 继承）**
- 顺序**不可颠倒**：解码 → **纠正 EXIF 方向** → 缩放 → 编码。先缩放会把方向信息丢掉，iPhone 竖拍照片全部躺倒。
- 优先 `createImageBitmap(file, { imageOrientation: 'from-image' })`；不支持时回退 `new Image()` + canvas（现代浏览器 `<img>` 默认 `image-orientation: from-image`，方向已应用）。
- 输出优先 WebP（体积更小），不支持则 JPEG。
- **解码失败（HEIC、损坏文件）必须提示「有 N 张无法处理已跳过」**，绝不允许静默丢图。

**R7｜排序规则（从 v0.0.1 继承）**
`order_index` 以 10 为步长递增；插入两张之间取中间值（如 15）。间隙耗尽时整体归一化为 10、20、30…。相同值按 `created_at` 兜底，保证稳定。

**R8｜上传事务性（新，防孤儿文件）**
上传一张照片 = **两次网络操作**（Storage 上传 + DB 插入），必然存在"传了图但没入库"的中间态。规则：
1. 先压缩 → 2. 上传 `_thumb.webp` 与 `_full.webp` → 3. 插入 `photos` 行。
2. **若第 3 步失败，必须回滚删除第 2 步已上传的两个文件**；回滚也失败时记录 `console.error` 并在 UI 提示「有 N 张未完成，请重试」。
3. 批量上传**逐张独立处理**，单张失败不中止整批；结束后统一报告「成功 N / 失败 M」。
4. 删除照片时**先删 DB 行，再删 Storage 文件**（顺序反了会出现"库里有记录但图没了"的破图）。

**R9｜长辈账号门槛（新，已知取舍）**
- 事实：主公选择"只传自己的"，因此**每个要传照片的家人都需要自己的账号**。
- 缓解（v0.1.0 必做）：
  - 邀请链接 → 注册流程**一键走完**，不让家人填多余东西（只要邮箱 + 密码 + 显示名）。
  - 灰果实的提示文案写成「TA 还没加入，你的家族树正在等 TA」，而不是冰冷的"未绑定"。
  - 建树者可**先把果实的显示名和称谓填好**，家人入伙后只需点"加入"，不用自己配置任何东西。
- **若实测长辈确实用不了，立即回退为「管理员可代传」**（见决策记录 D14，属可回退项）。

---

## 六、用户决策记录

### 6.1 主公 2026-09-23 拍板

| # | 决策项 | 主公选择 | 备注 |
|---|---|---|---|
| U1 | 产品用途 | 个人 / 家庭相册 | v0.0.1 时定 |
| U2 | 3D 形态 | 3D 立方体翻页 | v0.0.1 时定 |
| U3 | **是否多人共享** | **要**——家人各自手机传进同一本相册 | 此项直接推翻 v0.0.1 的轻量本地档 |
| U4 | 内置常量 | **采用 77 的全部建议值** | 见 4.4 |
| U5 | GitHub 仓库名 | **采用 77 建议 `3d-album`** | 用户名已补实：`sea9413` |
| U6 | 产品摆放 | **一个站点两个入口**，共用内核 | 见第七节 |
| U7 | 树的结构 | **辈分树**（有辈分层级） | 见 R3 |
| U8 | 上传权限 | **只传自己的** | 建树者也不能代传，见 R4 |
| U9 | 分享门槛 | **链接即看**（不登录、不要口令） | 取舍见 R5 |

### 6.2 77 替主公拍板的（请复核，不同意就说）

| # | 决策 | 77 的判断 | 可否推翻 |
|---|---|---|---|
| D1 | 立方体必须「虚拟化」（只渲染 5 个面） | 真立方体只有 6 面，100 张必须虚拟化，否则做不出来 | 无替代方案 |
| D2 | 每张图存两份（≤1600 原图 + 320 缩略图） | 立方体直接用原图会卡死中低端手机 | 可调小缩略图 |
| D3 | **独享本也上云**（而非本地） | 主公要"分享给他人仅查看"，本地文件无法生成链接 | 可改回纯本地，但分享功能就得砍掉 |
| D4 | 登录方式 = **邮箱 + 密码** | Supabase 原生支持、零额外成本；手机号验证码需接第三方且要付费，微信登录需企业资质（个人做不了） | 可换，但都要额外成本或资质 |
| D5 | 每个用户只给 **1 个**独享本 | v0.1.0 简化，避免"相册列表"这层多余导航 | 可扩为多本 |
| D6 | 家族树**不做精确父子连线** | 精确连线需迁 Three.js（+600KB），v0.1.0 不值；改用「同层圆环 + 层间落差」表达辈分，视觉上仍是参天大树 | 可后续升级 |
| D7 | 分享页图片走**边缘函数签发短期签名 URL** | 私有桶不能被 `<img>` 直接读；`<img>` 又无法带自定义 header。签名 URL 可直接加载、可缓存，是唯一干净的路 | 无更好替代 |
| D8 | 跨表权限判定一律用 **SECURITY DEFINER 函数** | 否则 `members` 策略里再查 `members` 必然触发 `infinite recursion detected in policy` | 无替代方案 |
| D9 | 独享本仍保留**本地 zip 导出** | 云端不是绝对可靠（免费版长期不活跃可能被暂停）；多一道本地防线成本极低 | 可去掉 |
| D10 | 不做 `sw.js` 离线缓存 | 后端是 Supabase，离线本就读不到数据，做缓存只增加版本同步坑（清单第 20 条） | 后续可加 |
| D11 | 相册内排序用「列表视图」，不在立方体里排序 | 立方体里的拖动与旋转手势无法区分 | 无 |
| D12 | 分享链接**不做有效期** | 主公选的是"链接即看"；有效期会让家人分享给自己人时莫名失效 | 可加 |
| D13 | 家族树上提供「全家福」入口（全树照片按时间混排成一个立方体） | 同一套引擎，只换一个查询条件，成本极低而价值高 | 可去掉 |
| D14 | v0.1.0 **不做**「管理员代传」 | 主公拍板"只传自己的"；但此项目前是**可回退项**，若长辈用不了可立即切换 | 强烈建议保留在案 |
| D15 | 每个用户 `family` 树上限 3 棵 | 家庭场景 3 棵足够（自家 / 父辈 / 母辈），防滥用 | 可调 |

### 6.3 ⚠️ 开工前置条件（必须主公亲办，77 替代不了）

> **状态（2026-09-23）**：`A1` `A2` ✅ 已完成；**`A3`–`A7` 待办**，其中 **`A4` 连通性实测是全局前提**。

> 这些事涉及**主公本人的账号、邮箱与手机**，或**只有设备持有者才能做的判断**，77 无法代劳。除此之外的一切（全部代码、建表 SQL、边缘函数、部署命令）由 77 完成。

**A 类 · 现在就能做，且不阻塞 77 写代码**（77 可与之并行开始实现）

| # | 主公要做的事 | 具体怎么做 | 为什么必须主公 |
|---|---|---|---|
| ~~A1~~ | ~~**给 77 GitHub 用户名**~~ | ✅ **已完成：`sea9413`**，已全文填入（线上地址 / 部署命令 / 分享示例） | — |
| ~~A2~~ | ~~**注册 GitHub 账号**~~ | ✅ **视为已完成**（用户名已给出，说明账号已存在） | — |
| A3 | **注册 Supabase 并建 1 个项目** | supabase.com → New project → 区域选 **Southeast Asia (Singapore)**（离清远最近）；记下 Project URL 与 anon key | 涉及主公邮箱；**anon key 属敏感值** |
| A4 | 🔴 **用手机 4G 打开 Supabase 项目 URL 实测连通性** | 关掉 WiFi，用流量访问 `https://<项目>.supabase.co`，看是否秒开、是否需反复重试 | 这是**全局可用性前提**（见 P20）。免费版**不支持自定义域名**，通不过就没有便宜的绕法，越早发现越好 |
| A5 | **准备两个能收信的邮箱地址** | 用于 G2–G4「两账号实测数据隔离」，可用「主邮箱 + 别名」凑两个 | 一个账号无法自证隔离，安全验收的硬需求 |
| A6 | **准备 3–5 张测试照片** | 至少含 1 张 **HEIC**（iPhone 直出）、1 张**竖拍**（验 EXIF 纠正，见 B4） | 77 手里没有主公的真实素材 |
| A7 | **明确认可隐私边界** | 回一句「认可照片上传到云端」即可 | 见第十一节：**照片从此离开本机**，托管在境外服务器上。这是与 v0.0.1 最本质的区别；此条不确认，不应开工 |

**B 类 · 等代码落地后，77 带着主公在控制台逐个点**（无需提前研究）

建表 SQL 粘贴执行、建私有桶 `photos`、开启 Email 认证与最低密码 8 位、填 Redirect URLs、部署边缘函数并设环境变量、建仓库开 Pages —— 全部步骤已写在 **13.1**。届时 77 逐步念、主公照点即可，**不需要预习**。

**C 类 · 请主公顺手复核（不同意就说）**

6.2 节的 **D1–D15** 是 77 替主公拍板的 15 项。最值得看的三条：**D3**（独享本也上云，否则"分享给他人仅查看"不存在）、**D8**（RLS 必须走 `SECURITY DEFINER`，否则全站 500）、**D14**（不做管理员代传，长辈须自己注册——属可直接回退项）。不回复视为默认通过。

---

## 七、技术架构

### 7.1 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 页面 | `index.html`（含内联 CSS + 兜底脚本） | 首屏样式内联，避免闪烁；兜底脚本负责"加载失败"提示 |
| 脚本 | **原生 ES Modules**，无构建工具 | GitHub Pages 直接托管，push 即上线 |
| 路由 | **hash 路由**（`#/...`） | 静态托管无需服务端 rewrite，刷新不 404 |
| 后端 | Supabase（PostgreSQL + Auth + Storage + Edge Functions） | 一个项目全包 |
| Supabase 客户端 | `@supabase/supabase-js`，**锁定 v2.117.1**（部署日 2026-09-24 的 npm 最新稳定版；已内联 `vendor/supabase-js.min.js`，首次锁定后不再浮动，升级须显式改号并重测） | 清单第 14 条：第三方库必须锁版本、优先本地内联，不裸引未知 CDN |
| 打包 | JSZip，**锁定 `3.10.1`**，内联 `vendor/` | 独享本本地导出备份用 |
| 手势 | Pointer Events | 一套代码支持鼠标 + 触摸，Safari 13+ |
| 3D | **纯 CSS 3D transform**（立方体与家族树同源） | 见 7.5 |
| 部署 | GitHub Pages，发布源 `main` / 根目录 | 无 `gh-pages` 分支 |

### 7.2 路由表

| 路由 | 页面 | 是否需要登录 |
|---|---|---|
| `#/` | 首页（两张卡片：我的独享本 / 家族树） | 否 |
| `#/login` | 登录 / 注册 | 否 |
| `#/solo` | 我的独享本（立方体） | 是 |
| `#/tree` | 我的家族树列表 | 是 |
| `#/tree/:albumId` | 某个家族树（3D 大树） | 是（且须为树内成员） |
| `#/tree/:albumId/m/:memberId` | 某个果实的 3D 立方体相册 | 是（且须为树内成员） |
| `#/invite/:token` | 接受邀请（入伙） | 否（点了才要求登录/注册） |
| `#/s/:token` | **只读分享页** | **否** |
| 其他 | 404 提示页 | 否 |

### 7.3 文件结构（关键代码位置**以函数名为准，行号会漂移**）

```
/
├─ index.html                     骨架 + 内联 CSS + 加载失败兜底脚本
├─ manifest.webmanifest           PWA：display: standalone
├─ js/
│  ├─ app.js                      入口：hash 路由、全局错误捕获、启动检查
│  ├─ config.js                   ★ 4.4 常量表唯一来源 + const VER（禁用散落魔法数字）
│  ├─ supabase.js                 Supabase 客户端初始化；**加载失败降级提示**
│  ├─ auth.js                     signUp / signIn / signOut / getSession / onAuthChange
│  ├─ db.js                       Postgres 数据访问
│  │   ├─ getOrCreateSoloAlbum()
│  │   ├─ createFamilyAlbum() / listMyTrees() / getTree(albumId)
│  │   ├─ addMember() / updateMember() / removeMember()
│  │   ├─ listPhotos({albumId, memberId}) / listAllPhotos(albumId)   ← 全家福用
│  │   └─ insertPhotoRow() / updatePhoto() / deletePhotoRow()
│  ├─ storage.js                  Supabase Storage
│  │   ├─ uploadPair(albumId, memberId, photoId, full, thumb)
│  │   ├─ removePair(paths)                 ← R8 回滚用
│  │   └─ signedThumbUrl() / signedFullUrl()
│  ├─ image.js                    ★ 图片处理
│  │   ├─ decodeWithOrientation()           ← R6，必须支持 <img> 回退
│  │   ├─ makeFullBlob() / makeThumbBlob()
│  │   └─ handleFiles()                     逐张处理 + 失败逐张提示
│  ├─ cube.js                     ★★ 3D 立方体引擎（与数据源解耦，本产品心脏）
│  │   ├─ initCube(containerEl, photos, opts)
│  │   ├─ buildFaces() / recycleFarthestFace()      ← R1
│  │   ├─ onPointerDown/Move/Up()                    ← R2
│  │   ├─ applyInertia() / snapToNearest()           ← R2
│  │   ├─ destroy()                                  ← 释放全部对象 URL
│  │   └─ revokeFaceURLs()                           ← 内存纪律
│  ├─ tree.js                     ★★ 3D 家族树（CSS 3D 环形分层）
│  │   ├─ layoutTree(members)      纯函数：算每层圆环半径、每个果实角度
│  │   ├─ recalcGenerations(members)  纯函数：由 parent 推导 generation（R3）
│  │   ├─ detectCycle(members, id, newParentId)  防环（R3）
│  │   ├─ renderTree() / rotateBy() / zoomBy()
│  │   └─ onMemberTap()            点果实 → 进该家人的立方体
│  ├─ share.js
│  │   ├─ createShareLink({albumId, memberId})  生成高熵 token（R5）
│  │   ├─ revokeShareLink(id)
│  │   ├─ listMyShareLinks(albumId)
│  │   └─ openSharedView(token)    只读访客入口
│  ├─ backup.js                   exportZip() / importZip()（独享本本地防线）
│  └─ ui.js                       renderEmptyState() / renderError()（转义）/
│                                 confirmDialog() / renderLoadFailed() / showToast()
├─ vendor/
│  ├─ supabase-js.min.js          v2.117.1（UMD，全局 `supabase.createClient`）
│  └─ jszip.min.js                锁定 3.10.1（已内联 vendor/，与文档一致）
├─ supabase/functions/share-open/index.ts   ★ 唯一一个边缘函数，只读分享签发签名 URL
└─ assets/
```

### 7.4 权限与 RLS 要点（标准档必查）

1. **五张表全部启用 RLS**，且**每条策略都带 `auth.uid()` 过滤**——不是"数够 4 条就行"（清单第 2 条）。
2. **跨表判定一律走 `SECURITY DEFINER` 函数**（`is_album_member` / `is_my_member`）。
   - 为什么：若直接在 `members` 的 select 策略里写"查 albums"、在 `albums` 的 select 策略里写"查 members"，两边互查会触发 PostgreSQL 的 **`infinite recursion detected in policy`**，表现是**整站所有查询返回 500**，且报错指向策略而非 SQL，极难定位。
   - `SECURITY DEFINER` 函数必须 `set search_path = public`（防 search_path 注入），并 `revoke ... from public` 后只 `grant` 给需要的角色。
3. **`share_links` 绝不对 `anon` 开放任何策略**。匿名只走 `share_get(token)`。
4. **Storage 桶必须 Private**。桶的 select 策略靠路径第一段判定归属，所以**路径格式不能改**（改了就全站图片 404）。
5. **改了 SQL → 必须整段重跑**（清单第 1 条）。幂等设计已保证重跑安全。
6. **验收 SQL**：跑完后逐条查策略，**核对 `USING` / `WITH CHECK` 里是否含 `auth.uid()` 或 `is_*_member()` 过滤**，而不是只数策略条数：
   ```sql
   select tablename, policyname, cmd, qual, with_check
     from pg_policies
    where schemaname in ('public','storage')
    order by tablename, policyname;
   ```

### 7.5 3D 家族树的实现（77 拍板：纯 CSS 3D）

**为什么不用 Three.js**：Three.js 体积约 600KB，且要引入 3D 模型/光照体系；本产品的树只要"有空间层级感 + 能整树旋转"就够。纯 CSS 3D 与立方体引擎同源（同一套 `perspective` / `preserve-3d` / `rotateY` 知识），零额外依赖，移动端性能可控。

**布局算法**（`layoutTree()`，纯函数）：
```
每一个辈分 = 一层
第 g 层垂直位置：translateY(g * TREE_LAYER_GAP)          // g 越大越靠下
第 g 层圆环半径：radius(g) = max(TREE_MIN_RADIUS, 该层人数 * TREE_RADIUS_PER_MEMBER)
第 g 层第 i 个果实角度：angle = (360 / 该层人数) * i + 层偏移
果实位置：rotateY(angle) translateZ(radius)
```
- 整树容器 `transform: rotateY(treeAngle) rotateX(treeTilt)`，由拖拽驱动 —— **这就是"绕到背面看另一侧家人"的实现**。
- 双指捏合 / 滚轮 → `scale(zoom)`，范围限制在 `0.5 ~ 2`。
- 果实视觉：圆形 + 头像缩略图 + 球体高光（`radial-gradient`）+ 名称标签；灰果实为半透明虚线圆。
- 枝干视觉：用 SVG 画一组静态装饰性枝叶铺在树后（**不追求与果实精确连接**，见 D6），加上层间的垂直渐变树干柱。
- **性能**：果实数 ≤ 20 时全量渲染；> 20 时只渲染头像缩略图并关闭高光滤镜。

**注意事项**
- 果实上的圆形头像同样用 `createObjectURL`，**销毁树视图时必须逐个 `revokeObjectURL`**。
- 树的拖拽与"点击果实"必须区分：同 R2 的位移阈值判定，**不能让旋转误触成进入相册**。

### 7.6 只读分享的数据流

```
访客打开 #/s/<token>
   ↓
前端调用 Edge Function: POST /functions/v1/share-open   { token }
   ↓
Edge Function（持 service_role，仅在服务端）
   1) 用 service_role 调 RPC share_get(token)  → 拿白名单元数据
   2) 若 token 无效 → 返回 { ok:false, error:'LINK_INVALID' }
   3) 为该 album / member 下的文件签发 1 小时签名 URL 列表
   4) 返回 { album, members, photos:[{...,thumbUrl,fullUrl}] }
   ↓
前端用返回的签名 URL 渲染立方体（只读，无任何写入口）

★ 安全铁律：service_role key 只存在于 Edge Function 的环境变量里，
  **绝不**出现在前端代码、GitHub 仓库、或开工令中（本文件亦不记录该值）。
```

### 7.7 加载失败降级

| 失败点 | 表现 | 必须的降级行为 |
|---|---|---|
| Supabase 客户端库或网络异常 | 全部页面无数据 | 提示「网络异常，云端功能暂不可用，请检查网络后刷新」（清单第 15 条），**不留白页** |
| 任一 JS 模块 404 / 语法错误 | 页面无反应 | `index.html` 内联兜底脚本 3 秒后检测初始化标志，未初始化则显示「加载失败，请刷新重试」 |
| Edge Function 调用失败 | 分享页空白 | 显示「分享服务暂时不可用，请稍后重试」，不退化成空白立方体 |
| 单张图片解码失败 | 该面空白 | 该面显示占位符 + 标记「无法显示」，不影响其余 |
| 会话过期 | 操作被拒 | 引导重新登录，不清空已填内容 |

---

## 八、验收清单

> 每条都是**可亲手勾选的动作**，不是技术话。发版前逐条打钩，有一条没过就不发。

### A. 账号与隔离

- [ ] A1 用邮箱注册新账号，能成功登录，页面顶部显示自己的显示名
- [ ] A2 登出后再打开 `#/solo`，被引导回登录页
- [ ] A3 **用 B 账号登录，完全看不到 A 账号的独享本与其任何照片**（两账号实测）
- [ ] A4 用错密码登录，出现明确错误提示，不是白屏
- [ ] A5 点「忘记密码」，能收到重置邮件并成功改密
- [ ] A6 在开发者工具里搜索 `password`，**在 JS 与 localStorage 里都找不到明文密码**

### B. 上传与显示

- [ ] B1 点「+ 添加照片」，能唤起系统相册并支持一次选多张
- [ ] B2 4G 下一次选 20 张，90 秒内全部出现并显示「已上传 20 张」
- [ ] B3 包含一张 iPhone 竖拍照片，显示时**是正的，没有躺倒**
- [ ] B4 包含一张 HEIC 格式照片，出现提示「有 1 张无法处理，已跳过」，其余正常
- [ ] B5 上传过程中切到别的 App 再切回来，进度正常或给出可重试的提示，**不留假进度条**
- [ ] B6 关掉页面再打开，照片还在
- [ ] B7 在 Supabase Storage 控制台查看，确认桶 `photos` 的**访问级别是 Private**

### C. 立方体旋转（内核）

- [ ] C1 手指左右拖动，立方体跟手转动，无延迟感
- [ ] C2 松手后自动停住，正面那张摆正（不歪、不卡在半路）
- [ ] C3 快速甩一下松手，会带惯性多转几面后停住
- [ ] C4 底部计数随翻页实时变化（如「第 3 / 60」变「第 4 / 60」）
- [ ] C5 连续翻到第 60 张再翻回第 1 张，不断档、不空缺、无空白面
- [ ] C6 单相册 100 张时连续翻 20 次，不卡顿、不白屏（iPhone 实测）
- [ ] C7 电脑上按 ← / → 能翻页
- [ ] C8 在第 7 张关掉页面再打开，仍停在第 7 张

### D. 家族树

- [ ] D1 点「种一棵新树」，取名后进入树视图，看到自己作为第一个果实挂在树上
- [ ] D2 添加两个家人果实，**果实出现在不同高度**（辈分不同 → 层不同）
- [ ] D3 把家人 A 改挂到家人 B 下面，**整棵树的高度层级立刻重排**，A 及其后代移到更低一层
- [ ] D4 尝试把 B 挂到 B 自己的后代下面，**被拒绝并提示「不能形成环」**，树没有崩
- [ ] D5 手指左右拖，**整棵树旋转**，能绕到背面看到另一侧的果实
- [ ] D6 双指捏合能缩放整棵树，松手后不弹回原位
- [ ] D7 在树上**轻点**一个果实 → 进入该家人的立方体相册
- [ ] D8 在树上**拖动一下再松手** → 树只是转了，**没有**误进相册
- [ ] D9 未入伙的果实显示为灰色，点开提示「TA 还没加入，你的家族树正在等 TA」
- [ ] D10 树里 20 个果实时，打开到看完全貌 ≤ 5 秒，旋转跟手

### E. 邀请与入伙

- [ ] E1 点灰色果实 → 「邀请他/她」→ 生成邀请链接并能复制
- [ ] E2 在**未登录的无痕窗口**打开邀请链接，看到「XX 邀请你加入『我们家』，你会成为树上的『妈妈』」
- [ ] E3 完成注册后**自动绑定到那个果实**，灰果实变亮并显示自己的名字
- [ ] E4 入伙后点自己的果实，能上传照片成功
- [ ] E5 **用 A 账号，无法往 B 的果实上传照片**（在 B 的果实页面里根本找不到上传入口；即使用工具构造请求也被服务端拒绝）
- [ ] E6 建树者能在树上看到所有人的照片，但**看不到删除别人照片的入口**

### F. 只读分享

- [ ] F1 生成分享链接，面板显示「任何拿到此链接的人都能查看」
- [ ] F2 在**未登录的无痕窗口**打开分享链接，能看到照片并正常翻看、放大
- [ ] F3 分享页上**没有任何**上传 / 删除 / 编辑 / 排序按钮
- [ ] F4 分享页查看次数会在面板中增加
- [ ] F5 点「撤销分享」并确认后，**同一个链接立即失效**并显示「这个分享链接已失效或不存在」
- [ ] F6 随便改一位 token 字符后打开，显示失效提示，不报错、不白屏
- [ ] F7 分享某**单个果实**时，分享页只出现该果实的照片，不出现其他人的
- [ ] F8 在分享页的 Network 面板里，**找不到任何** `owner_id` / `user_id` / 邮箱

### G. 权限与安全（须用验收 SQL + 两账号实测）

- [ ] G1 逐条核对 `pg_policies`，确认**每条策略的 `USING` / `WITH CHECK` 里都含 `auth.uid()` 或 `is_*_member()` 过滤**（不是只数条数）
- [ ] G2 用 B 账号的文件路径直接请求 A 的图片，**被拒绝**
- [ ] G3 用 B 账号在浏览器控制台直接调 `from('photos').delete().eq('id', A的照片id)`，**受影响行数为 0**
- [ ] G4 未登录状态在控制台直接 `from('photos').select()`，**返回空或被拒**，不返回任何数据
- [ ] G5 未登录状态直接 `from('share_links').select()`，**返回空或被拒**
- [ ] G6 在照片说明里输入 `<img src=x onerror=alert(1)>` → 页面**原样显示这串文字**，不弹窗
- [ ] G7 分享链接的 token 长度不短于 40 个字符，且刷新页面重新生成时**两次不一样**

### H. 降级与容错

- [ ] H1 断开网络后刷新，显示「网络异常，云端功能暂不可用…」，**不是白页**
- [ ] H2 把 `js/cube.js` 临时改名（模拟加载失败）→ 显示「加载失败，请刷新重试」
- [ ] H3 上传中途断网，给出「成功 N 张 / 失败 M 张」的明确报告
- [ ] H4 上传一张后手动删掉 Storage 里的 `_full` 文件，页面点开该张时有可见的失败提示，不是静默空白
- [ ] H5 独享本导出 zip → 清空后导入 → 照片与说明 100% 还原
- [ ] H6 🔴 **关掉 WiFi、用手机流量**打开线上地址，能正常登录并看到照片（验 P20 可达性，**上线前必做**）

### I. 移动端与体验

- [ ] I1 iPhone 上输入框聚焦时，软键盘不遮住正在输入的内容
- [ ] I2 所有可点按钮触摸区域 ≥ 44px
- [ ] I3 页面在 iPhone 上不会被意外缩放或横向滚动
- [ ] I4 首次访问弹出「添加到主屏幕」引导；点「不再提示」后刷新不再弹

### J. 版本一致性

- [ ] J1 页面底部版本号 = `config.js` 的 `VER` = 本文件名版本号，**三者一致**
- [ ] J2 用 `链接?v=时间戳` 打开，确认看到的是最新版本（绕过缓存）

---

## 九、明确不做（Out of Scope）

> v0.1.0 **一律不做**。想加，须另开开工令（或在本文件加章节后 bump 版本），不允许"顺手加一下"。

| # | 不做的事 | 原因 |
|---|---|---|
| N1 | 视频 | 体积与转码复杂度不可控，Supabase 免费额度也撑不住 |
| N2 | 人脸识别 / 自动分类 / AI 描述 | 需额外模型服务，成本与复杂度都不匹配 |
| N3 | 微信登录 / 手机号验证码登录 | 微信登录需企业资质（个人做不了）；短信需第三方付费服务 |
| N4 | 多本独享本 | v0.1.0 每人 1 本（见 D5） |
| N5 | 树上的精确父子连线 | 需迁 Three.js（见 D6） |
| N6 | 管理员代成员上传 | 主公拍板"只传自己的"（见 D14，属可回退项） |
| N7 | 分享口令 / 有效期 | 主公选"链接即看"（见 D12） |
| N8 | 评论 / 点赞 / 互动 | 家庭相册不需要，且引入更多权限面 |
| N9 | 照片实时同步（别人传了我立刻看到） | v0.1.0 用"下拉刷新"；实时订阅列为后续 |
| N10 | `sw.js` 离线缓存 | 后端在云端，离线本就读不到数据（见 D10） |
| N11 | 导出 PDF / 表格 / 视频 | v0.1.0 只导出 zip 备份 |
| N12 | 国际化 / 多语言 | 仅中文 |
| N13 | 照片原图无损保存 | 一律压缩到长边 1600，不接受更大体积 |
| N14 | 桌面端专属布局 / 大屏专版 | 仅做响应式居中卡片（家族树在电脑上居中显示） |
| N15 | 数据迁移到其他平台的工具 | 只提供 zip 导出 |
| N16 | 建树者转移 / 家人互相授权管理 | v0.1.0 建树者是唯一管理员（风险见 P18） |

---

## 十、版本历史

| 版本 | 日期 | 主要变更 |
|---|---|---|
| **v0.1.0** | 2026-09-23 | **架构定稿（本版）**。相比 v0.0.1 属架构级重写：① 档位由轻量本地**升为标准档**（Supabase 云端），新增 5 张表 + RLS + 私有 Storage + 1 个边缘函数；② 产品由单一形态拆为 **「独享本」+「家族树」** 两个入口、一个站点、共用内核；③ 新增 **3D 家族树**（CSS 3D 环形分层、辈分自动推导、防环）；④ 新增 **只读分享**（链接即看、高熵 token、可撤销、边缘函数签发短期签名 URL）；⑤ 新增**邀请入伙**流程；⑥ 新增登录鉴权（邮箱+密码）。继承 v0.0.1 的：虚拟立方体（R1）、手势吸附（R2）、图片双份压缩（R6）、EXIF 纠正、对象 URL 释放纪律。主公已拍板 U1–U9；D1–D15 为 77 拍板项待复核。代码尚未落地。<br>**同日补充（仍属 v0.1.0，未 bump）**：6.3 由「一件小事」扩为**完整开工前置代办清单**（A/B/C 三类）；新增 P19（免费版 7 天不活跃暂停）、P20（`*.supabase.co` 国内可达性 + 免费版无自定义域名）；13.1 增连通性实测步骤；验收增 H6。<br>**同日续补（仍为 v0.1.0）**：GitHub 用户名补实为 `sea9413` 并全文替换（信息卡 / 部署命令 / 分享示例 / 结尾）；**新增「接手须知」节**（甲身份说明、乙交付状态、丙八条铁律、丁实现顺序与验收对照表、戊不确定时的处理、己可复制的交接提示词），使本文档可**独立交付**给 AI / 开发者接手；6.3 标注 A1/A2 完成。 |
| v0.0.1 | 2026-09-23 | 立项草案。确立个人/家庭相册定位、轻量本地档、3D 立方体翻页形态、虚拟立方体实现方案、图片双份压缩、zip 备份。**已被 v0.1.0 取代**（档位与产品形态均推翻，技术内核继承）。 |

> 发版规则（清单第 11、13 条）：
> 1. 每次发版先 bump `js/config.js` 里的 `const VER`（`v0.1.0 → v0.1.1`）；
> 2. 本文件名版本号随之同步改名（用 UTF-8 的 `.js` 脚本 `fs.renameSync`，不要用命令行直传中文）；
> 3. 本表顶部加一行；
> 4. 部署后必须用 `?v=VER` 打开确认线上版本号已更新；
> 5. 炸了回滚：`git revert` + `git push origin main`；
> 6. **含密钥/接口的开工令只存本地，不推 GitHub**。本文件**不含任何密钥**（Supabase 的 anon key 可放前端代码，service_role key 只放边缘函数环境变量），故可随仓库一起留存；但凡日后写入任何密钥，立即改为本地存档。

---

## 十一、密码速查（敏感，仅本地）

| 项 | 说明 |
|---|---|
| 用户密码 | 由 Supabase Auth 管理，**前端与本文档均不记录任何用户密码**。生产前确认 Supabase 项目已开启「最低密码长度 ≥ 8 位」 |
| Supabase 项目 URL | 填入 `js/supabase.js`（公开信息，可入库） |
| Supabase **anon key** | 填入 `js/supabase.js`（供前端使用；受 RLS 保护，**但仍是敏感值**——若主公希望更稳，可改为构建时注入） |
| Supabase **service_role key** | ⚠️ **只存在于边缘函数的环境变量中**。**绝不**写入前端代码、**绝不**提交 GitHub、**绝不**记录在本文件里 |
| Edge Function 环境变量 | `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（在 Supabase 控制台设置） |
| 隐私边界提醒 | 本产品**收集**了邮箱与显示名，并**托管**了家人的照片。这是与 v0.0.1（纯本地）最本质的区别：**照片现在离开了本机**。开工前请主公明确认可这一点；分享的 zip 备份落到网盘时同样等于把照片交给第三方 |

---

## 十二、风险与已知问题

| # | 风险 | 等级 | 缓解措施 |
|---|---|---|---|
| P1 | **RLS 策略自我递归** → `infinite recursion detected in policy`，整站查询 500 | **高** | 跨表判定全部走 `SECURITY DEFINER` 函数（已写进 4.2 SQL，见 D8）；改 SQL 后必须整段重跑并跑 G1 验收 |
| P2 | **某条策略漏了 `auth.uid()` 过滤** → 整表对全网公开读写（静默泄露家人照片） | **高** | 全部策略逐条人工核对（G1）；不用"数够 4 条"的方式自检（清单第 2 条） |
| P3 | **Supabase Free 额度过期 / 超限被暂停** → 相册整体不可访问 | **高** | ① 独享本保留本地 zip 导出作为第二防线；② 开工令与 UI 均写明"云端非绝对可靠"；③ 用量接近上限时提前提示 |
| P4 | **Supabase Free 带宽 5GB/月** 被看超 → 图片加载失败 | 中 | 立方体只加载 320px 缩略图（单张 ≈15KB）；原图仅全屏时按需加载；用量页面可见 |
| P5 | **长辈学不会注册**（因为"只传自己的"要求每人有账号） | **高** | 邀请链接一键走完注册（R9）；建树者预填好果实信息；**若实测不行，立即回退为"管理员可代传"（D14）** |
| P6 | 分享链接被转发到不可控范围 | 中 | 已在分享面板明写「任何拿到此链接的人都能查看」；提供显眼「撤销分享」；R5 记录此取舍 |
| P7 | 分享 token 若用可枚举格式 → 等于全站公开 | **高** | 强制 32 字节随机 + base64url（R5）；G7 验收 token 长度与随机性 |
| P8 | **上传了图但 DB 插入失败 → 孤儿文件白占容量** | 中 | R8 强制回滚删除；批量逐张处理、失败可见 |
| P9 | 对象 URL 未释放 → 翻几轮 / 进几次树就崩标签页 | 中 | `cube.destroy()` 与树视图销毁时逐个 `revokeObjectURL`；纳入 code review 检查点 |
| P10 | Storage 路径格式被改 → 图片全站 404 | 中 | 4.3 已固化路径约定并写明"改了就全站 404"；桶策略依赖路径第一段 |
| P11 | 家族树成员过多（> 20）导致渲染卡顿 | 中 | `layoutTree` 纯函数已含降级（关高光滤镜、只留缩略图）；果实数上限提示 |
| P12 | 辈分重算遗漏后代 → 树层级错乱 | 中 | `recalcGenerations` 必须**全树重算**，不允许增量更新；D3 验收覆盖 |
| P13 | 设置 `parent_member_id` 形成环 → 树渲染死循环 | 中 | R3 强制 `detectCycle`；D4 验收覆盖 |
| P14 | HEIC 照片在部分浏览器无法解码 | 中 | R6 明确跳过并提示，绝不静默丢图；B4 验收覆盖 |
| P15 | 本地双击 `index.html` 打开会因 ES Modules 跨域限制失败 | 中 | 文档与 README 写明用 `python -m http.server`；同时做 7.7 兜底提示 |
| P16 | anon key 出现在前端（Supabase 常规做法）被恶意刷请求 | 低 | RLS 兜住数据；在 Supabase 控制台开启速率限制与邮箱注册验证 |
| P17 | 工具将来停用 → 家人照片被困在云端 | 中 | 提供 zip 导出；停用前须给全家人导出指引（清单第 26 条）；建树者离场前应交接或导出 |
| P18 | **建树者删号 → `albums` 级联删除，整棵树的照片一并消失** | **高** | ① 移除/删号前弹强提示并建议先导出；② 后续版本考虑"建树者转移"（v0.1.0 不做，见 N16）；③ 建树者账号**不得使用一次性邮箱** |
| P19 | **Supabase Free 版「7 天不活跃自动暂停」** → 家人一周没打开相册，项目被平台暂停，**整站打不开**（数据不丢，但须手动 Resume） | **高** | ① 开工令与 UI 均写明此机制，别让家人误以为"照片没了"；② 主公会收到平台预警邮件，收到后去 Dashboard 点一下就续命；③ 恢复窗口为暂停后 **1 年**内；④ 无法接受则升 Pro（$25/月）可免除暂停。（2026-09-23 经 Supabase 官方文档核实） |
| P20 | **`*.supabase.co` 在国内的可达性不稳定**（境外域名，部分运营商或时段被污染/限速），而**免费版不支持自定义域名**，无法靠绑域名缓解 | **高** | ① 开工前**必须先做 A4 的 4G 实测**；② 若实测不通，退路依次为：Cloudflare Worker 反代（官方不支持、能缓解不确定）、或改国内云自建后端（等于重写第七节，须另开开工令）；③ **未实测前不投入实现** |

---

## 十三、部署附录

### 13.1 首次上线步骤

**① Supabase 侧**
1. 新建项目（区域选 **Southeast Asia (Singapore)**，离清远最近），记下 Project URL 与 anon key。
   > 🔴 **1b. 立刻做连通性实测**：手机关 WiFi、用流量访问 `https://<项目>.supabase.co`。这是全局前提（P20），**不通就先别往下做**，先确定退路再投入。
2. SQL Editor 里**整段粘贴**第四节 4.2 的 SQL 执行。**一个字都不要删**（含 `SECURITY DEFINER` 函数部分，它们在策略之前，顺序不能调）。
3. Storage → 新建桶：名字 `photos`，**不要勾选 Public**。
4. Authentication → Providers → 启用 Email；确认开启「最低密码长度 8 位」；按需开启邮箱确认。
5. Authentication → URL Configuration → 把 GitHub Pages 地址加入 Redirect URLs。
6. 部署边缘函数 `share-open`（环境变量 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`）。
7. **验证 SQL 跑对了**：跑 7.4 第 6 条的 `pg_policies` 查询，逐条看 `qual` / `with_check` 里有没有 `auth.uid()` 或 `is_*_member`。

**② GitHub 侧**
```bash
git init
git add .
git commit -F commit-msg.txt     # 中文提交信息用 UTF-8 文件 + -F，勿命令行直传（清单第 6 条）
git branch -M main
git remote add origin git@github.com:sea9413/3d-album.git
git push -u origin main
```
仓库 Settings → Pages → Source 选 **`main` / `/ (root)`**，保存。等 1–2 分钟访问 `https://sea9413.github.io/3d-album/`，页面底部应显示 `v0.1.0`。

### 13.2 日常发版

```bash
# 1) 改 js/config.js 里的 const VER
# 2) 用 .js 脚本改本文件名版本号（勿用 git mv 直传中文）
# 3) 本文件「版本历史」顶部加一行
git add .
git commit -F commit-msg.txt
git push origin main
# 4) 用 ?v=时间戳 打开确认版本号已更新
```

### 13.3 GitHub 443 推不动（清单第 12 条）

若 `git push origin main` 报 `Failed to connect to github.com:443` / `Recv failure` / `Could not resolve host`，而其他站点正常，说明是 GitHub 443 端口被干扰，**不是本机断网**：

```bash
git push git@github.com:sea9413/3d-album.git main    # 走 SSH 22 端口
```

`origin` 保持 HTTPS 不动（换一台没配 SSH 的电脑时不至于推不动）。想一劳永逸再 `git remote set-url origin git@github.com:sea9413/3d-album.git`。

### 13.4 本地调试

不要双击 `index.html`——ES Modules 在 `file://` 下会被浏览器拦截：

```bash
python -m http.server 8000     # 然后访问 http://localhost:8000
```
> 本地调试需把 `http://localhost:8000` 也加入 Supabase 的 Redirect URLs，否则登录会跳转失败。

---

> **本开工令的权威性**：代码与本文件冲突时，**以本文件为准**，并立即修代码或改本文件（二选一，不许两边都不动）。
> **v0.1.0 性质**：架构定稿，代码尚未落地。GitHub 用户名已补实（`sea9413`），**本文档现已可独立交付给任意 AI / 开发者接手实现**（见「接手须知」节）。建议实现顺序：`config.js` → 建表 SQL 跑通并验策略 → `supabase.js` + `auth.js` → `image.js` → `cube.js` → 独享本闭环 → `members` / `tree.js` → 分享与边缘函数。
