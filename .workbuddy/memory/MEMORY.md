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
| `assistant.html` | **档案双子星**：两个智能体（档案查询 壹 / 配队推演 贰）的对话页 |
| `assistant.js` | 两个智能体的规则引擎（角色识别、意图分类、材料/面板输出、配队推演、追问、复制、一键转交） |
| `assistant-llm.js` | **自定义外接模型**：左侧「接入配置」面板 + Coze、ADP/LKE、火山方舟、OpenAI 兼容四种协议；**默认扣子双 Bot**（壹号档案 `7698303099848835113` / 贰号配队 `7698305675894079507`，密钥预填在 `DEFAULT_CFG`）；配置存 localStorage `genshin_llm_cfg_v1`（`{provider,key,base,model,models:{archive,team}}`），未配置/失败自动回退本地引擎 |
| `agent-data.js` | 材料与面板数据（由 `_build/build_agent_data.py` 生成，勿手改） |
| `agent-meta.js` | 人工维护的「专家知识层」：定位 / 配队 / 武器 / 圣遗物 / 循环 / 抽取建议 |
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

## 智能体数据流水线（新增角色 / 版本更新时）
- 材料与面板来自 `gi.yatta.moe` 公开 API：`python _build/fetch_agent_data.py` → `_build/agent_raw.json`
  → `python _build/build_agent_data.py` → 根目录 `agent-data.js`。
- 90 级面板换算：各突破阶段 `addProps` 求和 ÷ 曲线系数（五星 1.2530 / 四星 1.1866），已用官方值校验。
- `agent-meta.js` 是手写内容层；没收录的角色会走 `assistant.js` 的规则推演引擎（不会空回答）。
- 1 号「精简资料卡」与 2 号的粘贴识别共用同一套字段；改字段要同时改 `handoffText()` 与 `runTeam()` 的解析。

## 外接模型（扣子双 Bot）
- 账号里的两个扣子 Bot 是老师做的，只吃一条 user 文本；**必须**把 `buildContext()` 的站内档案拼到消息前（`withContext()`，格式「【站内档案…】\n…\n\n用户问题：…」），否则一号会回「暂无该角色档案」、二号会要求先粘贴资料。
- 扣子 v3 流式事件只取 `type === "answer"` 的 `conversation.message.delta / completed`，`verbose`、`reasoning_content` 要丢掉。
- 切换智能体时要同步 Bot（`window.TwinLLMSetAgent`，由 `assistant.js` 的 `switchAgent` 调用）；`models` 分 `archive` / `team` 两个槽。
- 默认密钥写在 `assistant-llm.js` 的 `DEFAULT_CFG`——**上线公网前必须删掉**，否则任何人查看源码都能拿到令牌。

## 设计约定
- 深色「提瓦特星夜」主题：青黑→暗紫渐变 + 金色细描边 + 元素色点缀（**刻意保持深色**，非浅色）。
- 元素色：风 #74c2a8 / 岩 #d3b45f / 雷 #b088d8 / 草 #7ec26a / 水 #4cc2f1 / 火 #ef7938 / 冰 #9fd6e3 / 无 #cfc6b4。
  每个角色通过 `--ec` 自定义属性驱动边框、发光、徽章配色。
- 图片加载失败统一走 `window.imgFail(el)`，用元素色渐变 + 角色名生成占位块。
- localStorage 键：`genshin_favs_v2`（收藏）、`genshin_votes_v3`（票数）。改动基准票数时要升版本号。

## 已知事项
- 角色总数为 **124**（含 7.1），数据快照日期 2026-10。
- 文案为原创撰写 + 官方 `description` 引述，素材版权归 HoYoverse，页脚已声明「仅作学习交流」。
