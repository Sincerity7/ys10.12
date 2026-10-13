# 项目长期记忆 · 原神角色图鉴馆

## 项目性质
纯静态站点（单页 → 现在是多页 + 共享资源），无构建工具、无依赖、无网络请求。
用浏览器直接打开 `index.html` 即可运行（`<script src>` + 相对路径图片，file:// 下也正常）。

## 文件约定
| 文件 | 作用 |
| --- | --- |
| `characters.js` | **唯一数据源**，`window.GENSHIN = { count, elements, weapons, regions, color, list }` |
| `style.css` | 全局设计系统（导航、按钮、chip、卡片、抽屉、弹窗、响应式） |
| `index.html` | 首页：精选轮播 / 元素回廊 / 全员角色墙 / 速览弹窗 / 每日推荐 |
| `detail.html` | 图鉴：筛选 + 搜索 + 排序 + 详情抽屉 |
| `vote.html` | 投票：124 位投票 + TOP10 实时榜 |
| `img/icons/` `img/art/` `img/wide/` | 每个角色 3 张图：160² 头像 / 560×640 竖版立绘 / 1000×500 横版立绘 |
| `img/_legacy/` | 早期 6 角色的旧素材，已无引用，可删 |
| `_build/` | 数据与素材流水线（内容文案 + 生成脚本），非站点运行依赖 |

## 数据源（要加角色时用）
- 角色元数据：`genshin-db` 的 `src/min/data.min.json` → `data.ChineseSimplified.characters`
  （中文字段：name / title / elementText / weaponText / rarity / region / affiliation /
  constellation / birthday / substatText / description）。
- 图片：`https://enka.network/ui/UI_AvatarIcon_{icon}.png` 与 `UI_Gacha_AvatarImg_{gacha}.png`。
- 流程：改 `_build/c*.py`（文案）→ `python _build/build_master.py` → `python _build/merge.py`
  → 生成根目录 `characters.js`；素材新增跑 `python _build/fetch_images.py`（已存在文件会跳过）。
  ⚠️ 改了 `characters.js` 的字段后，三页脚本里的 `c.xxx` 引用要同步。

## 设计约定
- 深色「提瓦特星夜」主题：青黑→暗紫渐变 + 金色细描边 + 元素色点缀（**刻意保持深色**，非浅色）。
- 元素色：风 #74c2a8 / 岩 #d3b45f / 雷 #b088d8 / 草 #7ec26a / 水 #4cc2f1 / 火 #ef7938 / 冰 #9fd6e3 / 无 #cfc6b4。
  每个角色通过 `--ec` 自定义属性驱动边框、发光、徽章配色。
- 图片加载失败统一走 `window.imgFail(el)`，用元素色渐变 + 角色名生成占位块。
- localStorage 键：`genshin_favs_v2`（收藏）、`genshin_votes_v3`（票数）。改动基准票数时要升版本号。

## 已知事项
- 角色总数为 **124**（含 7.1），数据快照日期 2026-10。
- 文案为原创撰写 + 官方 `description` 引述，素材版权归 HoYoverse，页脚已声明「仅作学习交流」。
