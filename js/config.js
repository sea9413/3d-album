/**
 * js/config.js —— 全站常量的唯一来源
 *
 * 【铁律】
 * 1. 开工令 4.4「内置常量表」里的每一项都必须落在本文件，禁止在别处散落魔法数字。
 * 2. 禁止占位值：所有数值均取自开工令 4.4 或其正文，出处写在每行注释里。
 * 3. 本文件为纯常量模块，不 import 任何东西、不碰 DOM，保证 index.html 的
 *    兜底脚本可以在任何情况下把它单独 import 进来（见 js/app.js 的启动标志）。
 */

// ===== 版本 =====
/** 版本号：必须与开工令文件名版本号、页面底部显示的版本号三者一致（验收 J1） */
export const VER = 'v0.1.0';

// ===== 4.4 内置常量表（主公 2026-09-23 拍板 U4：全部采用 77 的建议值）=====
/** 压缩后「原图」长边像素上限 */
export const MAX_EDGE_FULL = 1600;
/** 压缩后「缩略图」长边像素上限 */
export const MAX_EDGE_THUMB = 320;
/** 压缩质量（0–1） */
export const JPEG_QUALITY = 0.82;
/** 名称 / 描述单字段最大字数 */
export const MAX_TEXT_LEN = 60;
/** 称谓最大字数 */
export const MAX_RELATION_LEN = 10;
/** 单个果实照片数超过此值则提示（仅提示，不阻断） */
export const WARN_PHOTO_COUNT = 200;
/** 距上次导出备份多少天开始提醒 */
export const BACKUP_REMIND_DAYS = 30;
/** 立方体每面旋转角度（度），固定几何值 */
export const ROTATE_STEP = 90;
/** 当前张前后各保留几张真实面，固定实现参数 */
export const RENDER_WINDOW = 2;
/** 惯性每帧衰减系数，固定手感参数 */
export const INERTIA_DECAY = 0.95;
/** 触发吸附的角度阈值（× 90°），固定手感参数 */
export const SNAP_THRESHOLD = 0.15;
/** 判定「滑动」而非「点击」的最小位移比（× 屏宽），固定手势参数 */
export const MIN_SWIPE_SPEED = 0.05;
/** 树相邻辈分层之间的垂直落差（px） */
export const TREE_LAYER_GAP = 180;
/** 同层果实圆环的最小半径（px） */
export const TREE_MIN_RADIUS = 160;
/** 同层每多一个果实，圆环半径增加量（px） */
export const TREE_RADIUS_PER_MEMBER = 70;
/** 分享页签名 URL 有效期（秒） */
export const SIGNED_URL_TTL = 3600;
/** 每人独享本上限（D5） */
export const MAX_SOLO_ALBUM = 1;
/** 每人可建的家族树上限（D15） */
export const MAX_FAMILY_ALBUM = 3;

// ===== 开工令正文派生常量（出处见注释）=====
/** Storage 私有桶名（4.3 路径约定 / 13.1 第 3 步：不勾选 Public） */
export const STORAGE_BUCKET = 'photos';
/** localStorage 键前缀，防与其他项目串门（信息卡） */
export const LS_PREFIX = 'album3d.';
/** Supabase Auth 最低密码长度（4.2 / 13.1 第 4 步「最低密码长度 8 位」） */
export const MIN_PASSWORD_LEN = 8;
/** 排序步长，插入两张之间取中间值（R7） */
export const ORDER_STEP = 10;
/** 整树缩放范围（7.5：范围限制在 0.5 ~ 2） */
export const TREE_ZOOM_MIN = 0.5;
export const TREE_ZOOM_MAX = 2;
/** 果实数 > 此值时关闭高光滤镜、只渲染缩略图（7.5 性能降级 / P11） */
export const TREE_DEGRADE_COUNT = 20;
/** 建树者第一个果实的默认称谓（二 · S-B1「标为建树者」） */
export const DEFAULT_FOUNDER_RELATION = '建树者';
/** 独享本默认标题（4.1 albums.title 默认「我的相册」） */
export const DEFAULT_SOLO_TITLE = '我的相册';
/** 家族树默认标题（二 · S-B1「默认『我们家』」） */
export const DEFAULT_FAMILY_TITLE = '我们家';
/** 线上站点根地址，用于拼分享 / 邀请链接（信息卡） */
export const SITE_BASE_URL = 'https://sea9413.github.io/3d-album/';
/** 分享页路由前缀（7.2 路由表） */
export const SHARE_PATH_PREFIX = '#/s/';
/** 邀请页路由前缀（7.2 路由表） */
export const INVITE_PATH_PREFIX = '#/invite/';
/** 启动兜底检测时限（ms）：7.7「3 秒后检测初始化标志」 */
export const BOOT_TIMEOUT_MS = 12000;
/** toast 停留时长（ms），UI 表现参数 */
export const TOAST_DURATION_MS = 2400;
