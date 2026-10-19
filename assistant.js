/* ==========================================================================
   assistant.js · 原神角色图鉴馆「档案双子星」
   1 号：角色档案查询智能体  2 号：配队方案推演智能体
   纯前端规则引擎：材料 / 面板来自 agent-data.js，判断类内容来自 agent-meta.js
   ========================================================================== */
(function () {
  "use strict";

  var D = window.GENSHIN;
  if (!D) return;

  var LIST = D.list;
  var DATA = (window.AGENT_DATA || {}).chars || {};
  var META = window.AGENT_META || {};
  var EXP = (window.AGENT_DATA || {}).exp || { total: 8362650, hero: 419, moraLv: 1673400 };

  /* ------------------------------------------------------------------
     0. 索引 / 别名
     ------------------------------------------------------------------ */
  var NAMES = LIST.map(function (c) { return c.name; }).sort(function (a, b) { return b.length - a.length; });
  var BY = {};
  LIST.forEach(function (c) { BY[c.name] = c; });

  var ALIAS = {
    "雷神": "雷电将军", "影": "雷电将军", "将军": "雷电将军",
    "帝君": "钟离", "岩王帝君": "钟离", "老爷子": "钟离",
    "桃": "胡桃", "胡堂主": "胡桃",
    "绫华": "神里绫华", "神里": "神里绫华", "白鹭": "神里绫华",
    "绫人": "神里绫人",
    "万叶": "枫原万叶", "叶天帝": "枫原万叶",
    "甘雨": "甘雨", "王小美": "甘雨",
    "公子": "达达利亚", "达达": "达达利亚",
    "卢姥爷": "迪卢克", "迪卢": "迪卢克",
    "刻师傅": "刻晴", "刻晴": "刻晴",
    "莫娜": "莫娜", "心海": "珊瑚宫心海",
    "一斗": "荒泷一斗", "神子": "八重神子", "八重": "八重神子",
    "夜天后": "夜兰", "夜兰": "夜兰",
    "草神": "纳西妲", "小草神": "纳西妲", "纳西妲": "纳西妲",
    "散兵": "流浪者", "散": "流浪者",
    "海森": "艾尔海森", "海哥": "艾尔海森",
    "水龙王": "那维莱特", "龙王": "那维莱特",
    "水神": "芙宁娜", "芙芙": "芙宁娜",
    "仆人": "阿蕾奇诺", "队长": "阿蕾奇诺",
    "火神": "玛薇卡",
    "班神": "班尼特", "香菱": "香菱", "行秋": "行秋",
    "九条": "九条裟罗", "裟罗": "九条裟罗",
    "皇女": "菲谢尔", "小艾咪": "菲谢尔",
    "猫猫": "迪奥娜", "迪奥娜": "迪奥娜",
    "云先生": "云堇", "云堇": "云堇",
    "申鹤": "申鹤", "留云": "闲云", "阿姨": "闲云",
    "五郎": "五郎", "珐露珊": "珐露珊", "珐姐": "珐露珊",
    "平藏": "鹿野院平藏", "小鹿": "鹿野院平藏",
    "琴团长": "琴", "团长": "琴",
    "七七": "七七", "胡桃": "胡桃",
    "埃洛伊": "埃洛伊", "空": "空", "荧": "荧", "旅行者": "空",
    "娜维娅": "娜维娅", "仆人": "阿蕾奇诺",
    "火主": "空", "草主": "空", "风主": "空"
  };

  // 单字名（空 / 荧 / 琴）容易被「空之杯」「钢琴」误伤，做一次黑名单校验
  var BAD_WORDS = {
    "空": ["空之杯", "空气", "抽空", "天空", "空间", "星空", "空洞", "真空"],
    "荧": ["荧光", "荧惑"],
    "琴": ["钢琴", "竖琴", "琴声", "琴键"],
    "影": ["影子", "电影", "剪影", "合影", "光影"],
    "桃": ["桃子", "桃树", "核桃", "桃色"],
    "散": ["散件", "散步", "解散", "散开", "零散"]
  };

  function hitWord(text, w) {
    var i = text.indexOf(w);
    if (i < 0) return false;
    if (w.length > 1) return true;
    var total = 0, inBad = 0, bad = BAD_WORDS[w] || [];
    var n = 0;
    while ((i = text.indexOf(w, n)) >= 0) { total++; n = i + 1; }
    bad.forEach(function (b) {
      var m = 0;
      while ((m = text.indexOf(b, m)) >= 0) { inBad++; m += b.length; }
    });
    return total > inBad;
  }

  function findChar(text) {
    if (!text) return null;
    for (var i = 0; i < NAMES.length; i++) {
      if (hitWord(text, NAMES[i])) return BY[NAMES[i]];
    }
    var keys = Object.keys(ALIAS).sort(function (a, b) { return b.length - a.length; });
    for (var j = 0; j < keys.length; j++) {
      if (hitWord(text, keys[j]) && BY[ALIAS[keys[j]]]) return BY[ALIAS[keys[j]]];
    }
    return null;
  }

  /* ------------------------------------------------------------------
     1. 角色判断层
     ------------------------------------------------------------------ */
  function inferTags(c) {
    var t = [c.quote || "", c.story || "", (c.hl || []).join(" "), (c.tags || []).join(" "), c.title || ""].join(" ");
    var tags = [];
    if (/治疗|回血|回复.{0,5}生命|满血|续航|水母|回血|治疗量/.test(t)) tags.push("治疗");
    if (/护盾|玉璋|开盾|冰盾|护盾量|护盾强效/.test(t)) tags.push("护盾");
    if (/增伤|减抗|减防|加成|增幅|提升.{0,8}(攻击|伤害|精通|暴击)|聚怪|回能|充能/.test(t)) tags.push("辅助");
    if (/主C|站场|核心输出|输出天花板|伤害上限/.test(t)) tags.push("主C");
    if (/后台|副C|持续.{0,8}伤害|挂雷|挂火|挂水|挂冰|落雷|协同攻击|脱手|弹反|反击/.test(t)) tags.push("副C");
    if (!tags.length) tags.push(c.star === 5 ? "输出" : "功能位");
    return tags;
  }

  function roleLabel(c) {
    var m = META[c.name];
    if (m && m.role) return m.role;
    return inferTags(c).join(" / ");
  }

  function roleTags(c) {
    var m = META[c.name];
    if (m && m.role) {
      var t = [];
      if (/主C|输出/.test(m.role)) t.push("主C");
      if (/副C|后台/.test(m.role)) t.push("副C");
      if (/治疗/.test(m.role)) t.push("治疗");
      if (/护盾/.test(m.role)) t.push("护盾");
      if (/辅助|增伤|减抗|专辅|增幅/.test(m.role)) t.push("辅助");
      if (t.length) return t;
    }
    return inferTags(c);
  }

  var EL_SET = {
    "火": "炽烈的炎之魔女", "水": "水仙之梦", "冰": "冰风迷途的勇士",
    "雷": "如雷的盛怒", "草": "深林的记忆", "风": "翠绿之影", "岩": "悠古的磐岩", "无": "绝缘之旗印"
  };

  var WEP_POOL = {
    "单手剑": {
      dps: ["雾切之回光", "波乱月白经津", "静水流涌之辉", "匣里龙吟（4★）"],
      sup: ["西风剑（4★）", "祭礼剑（4★）", "天目影打刀（4★）"]
    },
    "双手剑": {
      dps: ["苇海信标", "赤角石溃杵", "狼的末路", "螭骨剑（4★）"],
      sup: ["西风大剑（4★）", "钟剑（4★）", "雨裁（4★）"]
    },
    "长柄武器": {
      dps: ["护摩之杖", "赤沙之杖", "和璞鸢", "决斗之枪（4★）"],
      sup: ["渔获（4★）", "西风长枪（4★）", "黑缨枪（4★）"]
    },
    "法器": {
      dps: ["万世流涌大典", "图莱杜拉的回忆", "神乐之真意", "流浪乐章（4★）"],
      sup: ["试作金珀（4★）", "祭礼残章（4★）", "西风秘典（4★）"]
    },
    "弓": {
      dps: ["若水", "飞雷之弦振", "猎人之径", "弓藏（4★）"],
      sup: ["西风猎弓（4★）", "祭礼弓（4★）", "终末嗟叹之诗"]
    }
  };

  function pickWeapons(c) {
    var m = META[c.name];
    if (m && m.weapons) return m.weapons;
    var pool = WEP_POOL[c.weapon] || WEP_POOL["单手剑"];
    var tags = roleTags(c);
    var sup = tags.indexOf("治疗") >= 0 || tags.indexOf("护盾") >= 0 ||
      (tags.indexOf("辅助") >= 0 && tags.indexOf("主C") < 0);
    if (sup && c.star === 5) return [pool.dps[0]].concat(pool.sup).slice(0, 3);
    return (sup ? pool.sup : pool.dps).slice(0, 3);
  }

  function pickArts(c) {
    var m = META[c.name];
    if (m && m.arts) return { sets: m.arts, mains: m.mains, subs: m.subs };
    var tags = roleTags(c);
    var sets = [], mains = [];
    if (tags.indexOf("治疗") >= 0) {
      sets = ["花海甘露之光 4 件套", "昔时之歌 4 件套"];
      mains = ["生命值% / 攻击力%", "元素伤害加成", "治疗加成"];
    } else if (tags.indexOf("护盾") >= 0) {
      sets = ["千岩牢固 4 件套", "悠古的磐岩 4 件套"];
      mains = ["生命值% / 元素充能效率", "生命值% / " + (c.el === "无" ? "元素" : c.el + "元素") + "伤害加成", "生命值%"];
    } else if (tags.indexOf("辅助") >= 0 && tags.indexOf("主C") < 0) {
      sets = ["昔时之歌 4 件套", "昔日宗室之仪 4 件套"];
      mains = ["元素充能效率 / 攻击力%", "元素伤害加成", "暴击率"];
    } else if (tags.indexOf("副C") >= 0 && tags.indexOf("主C") < 0) {
      sets = ["绝缘之旗印 4 件套", (EL_SET[c.el] || "绝缘之旗印") + " 4 件套"];
      mains = ["攻击力% / 元素充能效率", "元素伤害加成", "暴击率 / 暴击伤害"];
    } else {
      sets = [(EL_SET[c.el] || "绝缘之旗印") + " 4 件套", "逐影猎人 4 件套"];
      mains = ["攻击力% / 生命值%", (c.el === "无" ? "元素伤害加成" : c.el + "元素伤害加成"), "暴击率 / 暴击伤害"];
    }
    return { sets: sets, mains: mains, subs: ["暴击率 : 暴击伤害 ≈ 1 : 2", "元素充能效率 130%+", "元素精通 / 攻击力%"] };
  }

  function genLoop(c) {
    var m = META[c.name];
    if (m && m.loop) return m.loop;
    var t = roleTags(c);
    if (t.indexOf("治疗") >= 0) {
      return ["E 铺治疗领域 / 召唤物（持续回血）", "Q 群回并附带增益", "切主 C 正常输出，靠后台持续回血", "E 冷却好立刻补，保持治疗覆盖"];
    }
    if (t.indexOf("护盾") >= 0) {
      return ["E 开盾（长按盾量更足）", "Q 补控制 / 增益", "切主 C 输出", "护盾剩余 3 秒左右回切补 E"];
    }
    if (t.indexOf("辅助") >= 0 && t.indexOf("主C") < 0) {
      return ["E 起手挂增益 / 减抗 / 聚怪", "Q 开领域或团队增益", "切主 C 输出，覆盖增益窗口", "E 冷却好立刻补，保持减抗不断"];
    }
    if (t.indexOf("副C") >= 0 && t.indexOf("主C") < 0) {
      return ["E 放后台持续伤害 / 召唤物", "Q 打一轮爆发", "切主 C 站场，后台持续输出", "E / Q 冷却好按输出节奏补"];
    }
    return ["E 起手（叠层 / 增伤 / 位移）", "队友依次上增益、减抗", "Q 进入爆发窗口", "普攻 / 重击循环，E 冷却好补一手"];
  }

  function pullAdvice(c) {
    var m = META[c.name];
    if (m && m.pull) return m.pull;
    var t = roleTags(c);
    if (c.star === 5) {
      if (t.indexOf("治疗") >= 0 || t.indexOf("护盾") >= 0) return "五星保命位，缺续航 / 护盾的账号优先，泛用性大于强度。";
      if (t.indexOf("辅助") >= 0 && t.indexOf("主C") < 0) return "五星辅助位，能显著拉高整队上限，建议在缺少增益位时抽取。";
      return "五星输出位，强度取决于队友与元素反应体系，建议先确认配套辅助再抽。";
    }
    if (t.indexOf("治疗") >= 0 || t.indexOf("护盾") >= 0) return "四星保命位，抽到即可练，养成成本低，过渡期很好用。";
    if (t.indexOf("辅助") >= 0) return "四星辅助，低成本高回报，缺增益位时优先培养。";
    return "四星输出位，开荒过渡够用；资源有限时优先培养五星主C。";
  }

  function consAdvice(c) {
    var m = META[c.name];
    if (m && m.cons) return m.cons;
    var data = DATA[c.name];
    var names = (data && data.cons) || [];
    var uniq = [];
    names.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
    var head = (uniq.length > 1) ? ("命座：" + uniq.join(" / ")) : "";
    return (head ? head + "。" : "") + "命座按定位取舍：主C 建议 1 命起步，辅助 / 治疗 0 命即可用。";
  }

  /* ------------------------------------------------------------------
     2. 数字 / 材料格式化
     ------------------------------------------------------------------ */
  function nf(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  var RANK_WORD = { 2: "碎屑", 3: "断片", 4: "块", 5: "宝石" };

  function gemLine(arr) {
    if (!arr || !arr.length) return "";
    var base = arr[0][0].replace(/(碎屑|断片|块)$/, "");
    var parts = arr.map(function (it) {
      var w = RANK_WORD[it[2]] || "";
      var label = it[0] === base ? "宝石" : (it[0].replace(base, "") || w);
      return label + "×" + it[1];
    });
    return base + "：" + parts.join(" / ");
  }
  function dropLine(arr) {
    return (arr || []).map(function (it) { return it[0] + "×" + it[1]; }).join(" / ");
  }
  function bookLine(arr) {
    if (!arr || !arr.length) return "";
    var base = arr[0][0].replace(/(教导|指引|哲学)$/, "");
    var parts = arr.map(function (it) {
      var w = it[0].slice(base.length) || "教导";
      return w + "×" + it[1];
    });
    return base + parts.join(" / ");
  }
  function statExtra(stat) {
    if (!stat || !stat.extra || !stat.extra.length) return "";
    return stat.extra.map(function (e) {
      return e[0] + " +" + (e[2] ? Number(e[1]).toFixed(1) : e[1]) + (e[2] ? "%" : "");
    }).join(" / ");
  }

  /* ------------------------------------------------------------------
     3. 1 号智能体：档案
     ------------------------------------------------------------------ */
  function archiveBlocks(c, intent) {
    var d = DATA[c.name];
    var m = META[c.name];
    var blocks = [];
    var all = intent === "all";

    if (!d) {
      blocks.push({ h: "数据状态", items: ["该角色的材料数据暂未收录，可先查看角色图鉴页的基础档案。"] });
      return blocks;
    }

    if (all || intent === "role") {
      var items = [roleLabel(c)];
      if (m && m.brief) items.push(m.brief);
      else if (c.hl && c.hl[0]) items.push(c.hl[0]);
      blocks.push({ h: "角色定位", items: items });
    }

    if (all) {
      var intro = [];
      if (c.quote) intro.push(c.quote);
      if (c.story) intro.push(c.story);
      intro.push("生日 " + (c.bd || "—") + "｜命座 " + (c.con || "—") + "｜所属 " + (c.faction || c.region || "—"));
      blocks.push({ h: "角色简介", items: intro });
    }

    if (all || intent === "mat") {
      var items2 = [];
      if (d.asc.gem) items2.push(gemLine(d.asc.gem));
      if (d.asc.boss) items2.push(d.asc.boss[0][0] + " ×" + d.asc.boss[0][1] + "（世界 BOSS）");
      var spec = d.asc.spec || d.asc.other;
      if (spec) items2.push(spec[0][0] + " ×" + spec[0][1] + "（采集特产）");
      if (d.asc.drop) items2.push(dropLine(d.asc.drop) + "（怪物掉落）");
      items2.push("摩拉 " + nf(d.ascMora));
      blocks.push({ h: "突破材料（1→90，共 6 次突破）", items: items2 });
    }

    if (all || intent === "tal") {
      var items3 = [];
      if (d.tal.book) items3.push(bookLine(d.tal.book) + "（天赋书）");
      if (d.tal.drop) items3.push(dropLine(d.tal.drop) + "（怪物掉落）");
      if (d.tal.boss) items3.push(d.tal.boss[0][0] + " ×" + d.tal.boss[0][1] + "（周本材料）");
      if (d.tal.crown) items3.push("智识之冕 ×" + d.tal.crown[0][1]);
      items3.push("摩拉 " + nf(d.talMora) + "（3 个天赋 1→10 合计）");
      blocks.push({ h: "天赋材料（普攻 / 战技 / 爆发，各 1→10）", items: items3 });
    }

    if (all || intent === "lv") {
      blocks.push({
        h: "等级消耗（1→90）",
        items: [
          "累计经验 " + nf(EXP.total),
          "大英雄的经验 ×" + EXP.hero + "（约）",
          "升级摩拉 " + nf(EXP.moraLv),
          "合计摩拉 " + nf(EXP.moraLv + d.ascMora) + "（升级 + 突破）"
        ]
      });
    }

    if (all || intent === "stat") {
      var st = d.stat;
      var items5 = [
        "生命值 " + nf(st.hp) + " · 攻击力 " + nf(st.atk) + " · 防御力 " + nf(st.def),
        "突破加成 " + (statExtra(st) || (c.sub ? c.sub : "—"))
      ];
      if (st.l1 && st.l1.length === 3) {
        items5.push("1 级面板 " + nf(st.l1[0]) + " / " + nf(st.l1[1]) + " / " + nf(st.l1[2]));
      }
      blocks.push({ h: "90 级基础面板", items: items5 });
    }

    if (all || intent === "wep") {
      var w = pickWeapons(c), a = pickArts(c);
      blocks.push({
        h: "武器 / 圣遗物速览",
        items: [
          "武器：" + w.join("、"),
          "圣遗物：" + a.sets.join("、"),
          "主词条：" + a.mains.join(" / ")
        ]
      });
    }

    return blocks;
  }

  function archiveText(c, blocks) {
    var d = DATA[c.name] || {};
    var head = "【" + c.name + " · " + (c.title || "角色档案") + "】";
    var line0 = [c.region, c.el + "元素", c.weapon, c.star + "★", "命座：" + (c.con || "—")].filter(Boolean).join("｜");
    var out = [head, line0, "────────────────"];
    blocks.forEach(function (b) {
      out.push("◆ " + b.h);
      b.items.forEach(function (it) { out.push("· " + it); });
      out.push("");
    });
    out.push("（数据：genshin 官方数值 / " + ((window.AGENT_DATA || {}).updated || "") + "）");
    return out.join("\n");
  }

  function handoffText(c) {
    var d = DATA[c.name] || {};
    var spec = d.asc ? (d.asc.spec || d.asc.other) : null;
    var L = [];
    L.push("【角色资料卡｜" + c.name + "】");
    L.push("元素 / 武器 / 星级：" + c.el + " · " + c.weapon + " · " + c.star + "★");
    L.push("定位：" + roleLabel(c));
    if (d.asc) {
      L.push("突破材料：" + [
        d.asc.gem ? gemLine(d.asc.gem) : "",
        d.asc.boss ? d.asc.boss[0][0] + "×" + d.asc.boss[0][1] : "",
        spec ? spec[0][0] + "×" + spec[0][1] : "",
        d.asc.drop ? dropLine(d.asc.drop) : "",
        "摩拉" + d.ascMora
      ].filter(Boolean).join("；"));
      L.push("天赋材料：" + [
        d.tal.book ? bookLine(d.tal.book) : "",
        d.tal.drop ? dropLine(d.tal.drop) : "",
        d.tal.boss ? d.tal.boss[0][0] + "×" + d.tal.boss[0][1] : "",
        d.tal.crown ? "智识之冕×" + d.tal.crown[0][1] : "",
        "摩拉" + d.talMora
      ].filter(Boolean).join("；"));
      L.push("1→90：" + "经验" + EXP.total + "｜大英雄" + EXP.hero + "｜摩拉" + (EXP.moraLv + d.ascMora));
      L.push("90 级面板：HP" + d.stat.hp + " / ATK" + d.stat.atk + " / DEF" + d.stat.def +
        (statExtra(d.stat) ? "｜" + statExtra(d.stat) : ""));
    }
    L.push("—— 以上资料可直接粘贴给【配队推演智能体】");
    return L.join("\n");
  }

  /* ------------------------------------------------------------------
     4. 2 号智能体：配队推演
     ------------------------------------------------------------------ */
  var ARCH = {
    "火": [
      { name: "蒸发", els: ["水"], tip: "水系铺场，火伤吃 2 倍蒸发" },
      { name: "融化", els: ["冰"], tip: "冰附着后火伤触发融化，单体爆发高" },
      { name: "超载", els: ["雷"], tip: "火雷超载，群伤与控制兼备" }
    ],
    "水": [
      { name: "蒸发", els: ["火"], tip: "火附着后水伤蒸发，主C收益最高" },
      { name: "永冻", els: ["冰"], tip: "冰水冻结，站场安全、输出稳定" },
      { name: "绽放", els: ["草"], tip: "草水生成草原核，群伤与持续伤害" }
    ],
    "冰": [
      { name: "永冻", els: ["水"], tip: "冻结打断敌人，配合减抗持续输出" },
      { name: "融化", els: ["火"], tip: "火附着后冰伤融化，单体倍率高" },
      { name: "超导", els: ["雷"], tip: "冰雷超导降防，物理队常用" }
    ],
    "雷": [
      { name: "超激化", els: ["草"], tip: "草雷激化，吃精通与暴击双收益" },
      { name: "超绽放", els: ["草", "水"], tip: "草原核被雷触发，自动追踪伤害" },
      { name: "感电", els: ["水"], tip: "雷水感电，群体持续伤害" }
    ],
    "草": [
      { name: "绽放", els: ["水"], tip: "草水生成草原核，群伤核心" },
      { name: "超绽放", els: ["水", "雷"], tip: "草原核 + 雷触发，爆发极高" },
      { name: "蔓激化", els: ["雷"], tip: "草雷激化，单体输出稳定" }
    ],
    "风": [
      { name: "扩散增伤", els: ["火", "水", "冰", "雷"], tip: "翠绿之影减抗 + 扩散增伤" },
      { name: "永冻", els: ["冰", "水"], tip: "双风辅助冻结队，站场安全" }
    ],
    "岩": [
      { name: "结晶", els: ["火", "水", "冰", "雷"], tip: "结晶产出护盾，兼顾生存与增伤" },
      { name: "纯岩", els: ["岩"], tip: "双岩共鸣，防御与岩伤增益" }
    ],
    "无": [
      { name: "泛用", els: ["火", "水", "雷"], tip: "旅行者按元素切换，适配任意反应队" }
    ]
  };

  function scorePartner(target, cand, need, used) {
    var s = 0;
    if (need.indexOf(cand.el) >= 0) s += 42;
    if (cand.el === target.el) s += 10;
    var t = roleTags(cand);
    if (t.indexOf("治疗") >= 0 && !used.heal) s += 34;
    if (t.indexOf("护盾") >= 0 && !used.shield) s += 26;
    if (t.indexOf("辅助") >= 0) s += 20;
    if (t.indexOf("副C") >= 0) s += 14;
    if (t.indexOf("主C") >= 0) s += 6;
    if (cand.star === 4) s += 5;
    if (used.els && used.els[cand.el] >= 2) s -= 18;
    s += (cand.pop || 50) / 12;
    if (used.names.indexOf(cand.name) >= 0) s -= 999;
    return s;
  }

  function buildTeam(target, arch) {
    var picked = [], used = { heal: false, shield: false, names: [target.name], els: {} };
    used.els[target.el] = 1;
    var tagsT = roleTags(target);
    if (tagsT.indexOf("治疗") >= 0) used.heal = true;
    if (tagsT.indexOf("护盾") >= 0) used.shield = true;

    for (var k = 0; k < 3; k++) {
      var best = null, bs = -1e9;
      for (var i = 0; i < LIST.length; i++) {
        var cand = LIST[i];
        if (cand.name === target.name) continue;
        var sc = scorePartner(target, cand, arch.els, used);
        if (sc > bs) { bs = sc; best = cand; }
      }
      if (!best) break;
      picked.push(best);
      used.names.push(best.name);
      used.els[best.el] = (used.els[best.el] || 0) + 1;
      var bt = roleTags(best);
      if (bt.indexOf("治疗") >= 0) used.heal = true;
      if (bt.indexOf("护盾") >= 0) used.shield = true;
    }
    return [target].concat(picked);
  }

  function teamLine(title, members, note) {
    return "① " + title + "｜" + members.join(" · ") + "｜" + note;
  }

  function teamBlocks(c, fromPaste) {
    var m = META[c.name] || {};
    var blocks = [];
    var tags = roleTags(c);

    var intro = (fromPaste ? "已接收档案：" : "识别角色：") + c.name +
      "（" + c.el + " · " + c.weapon + " · " + c.star + "★）｜定位：" + roleLabel(c);
    blocks.push({ h: fromPaste ? "档案接收" : "角色识别", items: [intro] });

    /* —— 推荐队伍 —— */
    var teams = [];
    if (m.teams) {
      m.teams.forEach(function (t, i) {
        teams.push((i === 0 ? "① " : (i === 1 ? "② " : "③ ")) + t[0] + "｜" + t[1].join(" · ") + "｜" + t[2]);
      });
    } else {
      var arcs = (ARCH[c.el] || ARCH["无"]).slice(0, 2);
      arcs.forEach(function (a, i) {
        var members = buildTeam(c, a);
        var name = c.el + a.name + "队";
        teams.push((i === 0 ? "① " : "② ") + name + "｜" + members.map(function (x) { return x.name; }).join(" · ") + "｜" + a.tip);
      });
      teams.push("③ 保命位替换：把其中一名队友换成钟离 / 迪奥娜 / 莱依拉，容错更高");
    }
    blocks.push({ h: "推荐队伍", items: teams });

    /* —— 循环手法 —— */
    blocks.push({ h: "输出循环手法", items: genLoop(c) });

    /* —— 圣遗物 —— */
    var a = pickArts(c);
    var artItems = ["套装：" + a.sets.join(" 或 ")];
    artItems.push("主词条：" + a.mains.join(" / "));
    if (a.subs) artItems.push("副词条优先级：" + a.subs.join(" > "));
    blocks.push({ h: "圣遗物细节", items: artItems });

    /* —— 抽取建议 —— */
    blocks.push({ h: "抽取建议", items: [pullAdvice(c), consAdvice(c)] });

    /* —— 追问 —— */
    blocks.push({
      h: "可以继续追问",
      items: ["· 换一个更适合新手的队伍", "· 没有五星武器怎么配", "· 这个队伍的输出顺序再细一点", "· 帮我对比两个主C"]
    });

    return blocks;
  }

  function teamText(c, blocks) {
    var out = ["【配队推演 · " + c.name + "】", "────────────────"];
    blocks.forEach(function (b) {
      out.push("◆ " + b.h);
      b.items.forEach(function (it) { out.push("  " + it); });
      out.push("");
    });
    return out.join("\n");
  }

  /* ------------------------------------------------------------------
     5. 意图解析
     ------------------------------------------------------------------ */
  function archiveIntent(text) {
    var t = text;
    var hit = [];
    if (/突破|素材|材料(?!.*天赋)/.test(t)) hit.push("mat");
    if (/天赋|技能升级|技能材料/.test(t)) hit.push("tal");
    if (/摩拉|经验|1-90|1~90|1—90|升级|满级|等级/.test(t)) hit.push("lv");
    if (/属性|面板|血量|生命值|攻击力|防御力/.test(t)) hit.push("stat");
    if (/定位|玩法|怎么样|强吗|值得|厉害|好用/.test(t)) hit.push("role");
    if (/武器|圣遗物|配装|词条/.test(t)) hit.push("wep");
    if (/档案|资料|介绍|背景|全部|清单|完整/.test(t)) return "all";
    if (!hit.length) return "all";
    return hit[0];
  }

  /* ------------------------------------------------------------------
     6. 会话状态 / 渲染
     ------------------------------------------------------------------ */
  var AGENTS = {
    archive: {
      id: "archive",
      name: "档案查询智能体",
      code: "ARCHIVE · 01",
      tag: "角色档案 / 材料清单",
      color: "#d3bc8e",
      intro: "✨欢迎来到原神角色图鉴馆档案助手！\n你可以向我查询：角色背景故事、突破材料、天赋升级材料、1~90级所需摩拉与经验书、角色定位、基础属性、武器圣遗物推荐。\n查询格式示例：雷电将军1-90级材料清单 / 钟离角色档案 / 胡桃天赋升级材料\n我输出的结果结构规整，方便复制粘贴，给到【配队推演智能体】继续做配队分析。",
      chips: ["雷电将军1-90级材料清单", "钟离角色档案", "胡桃天赋升级材料", "那维莱特基础属性", "把结果交给下一个智能体"],
      placeholder: "输入角色名或「雷电将军1-90级材料清单」…"
    },
    team: {
      id: "team",
      name: "配队推演智能体",
      code: "TEAM · 02",
      tag: "配队方案 / 循环手法",
      color: "#b088d8",
      intro: "📜配队推演助手已就绪！\n你可以直接粘贴【角色档案查询智能体】输出的角色资料，我基于该角色生成完整配队方案、输出手法、循环流程、抽取优先级、命座建议。\n你也可以直接输入角色名进行配队分析。",
      chips: ["雷电将军配队", "那维莱特怎么配队", "胡桃队伍优化", "帮我分析玛薇卡阵容", "没有五星武器怎么配"],
      placeholder: "粘贴档案资料，或输入「雷电将军配队」…"
    }
  };

  var state = {
    cur: "archive",
    history: { archive: [], team: [] },
    lastChar: { archive: null, team: null },
    lastHandoff: null,
    busy: false
  };

  var $ = function (id) { return document.getElementById(id); };
  var msgsEl, inputEl, sendBtn, chipsEl;

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function scrollBottom() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function addUser(text) {
    var row = el("div", "msg-row user");
    var b = el("div", "bubble");
    b.textContent = text;
    row.appendChild(b);
    msgsEl.appendChild(row);
    state.history[state.cur].push({ role: "user", text: text });
    scrollBottom();
  }

  function addSys(text) {
    var row = el("div", "msg-sys", esc(text));
    msgsEl.appendChild(row);
    scrollBottom();
  }

  function replyCardHTML(c, blocks) {
    var d = DATA[c.name] || {};
    var head =
      '<div class="rc-head">' +
        '<div class="rc-ava" style="--ec:' + c.color + '">' +
          '<img src="' + c.icon + '" alt="' + esc(c.name) + '" onerror="this.style.display=\'none\'">' +
        '</div>' +
        '<div class="rc-title">' +
          '<div class="rc-name" style="--ec:' + c.color + '">' + esc(c.name) + '<span>' + esc(c.title || "") + '</span></div>' +
          '<div class="rc-meta">' + [c.el + "元素", c.weapon, c.star + "★", c.region, "命座 " + (c.con || "—")].filter(Boolean).join("｜") + '</div>' +
        '</div>' +
      '</div>';
    var body = blocks.map(function (b) {
      return '<div class="rc-blk"><div class="rc-h">' + esc(b.h) + '</div>' +
        '<ul>' + b.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join("") + '</ul></div>';
    }).join("");
    return head + body;
  }

  function buildBotRow(payload) {
    var row = el("div", "msg-row bot");
    var bubble = el("div", "bubble bot-card");
    bubble.style.setProperty("--ec", payload.char ? payload.char.color : AGENTS[state.cur].color);
    if (payload.char) {
      bubble.innerHTML = replyCardHTML(payload.char, payload.blocks);
    } else {
      bubble.innerHTML = '<div class="rc-blk plain"><ul>' +
        payload.blocks[0].items.map(function (it) { return "<li>" + esc(it) + "</li>"; }).join("") + '</ul></div>';
    }

    var acts = el("div", "rc-acts");
    var copy = el("button", "mini-btn", "复制全部");
    copy.addEventListener("click", function () { copyText(payload.text, copy, "已复制"); });
    acts.appendChild(copy);

    if (payload.handoff) {
      var go = el("button", "mini-btn primary", "一键转交配队助手 →");
      go.addEventListener("click", function () {
        switchAgent("team");
        setTimeout(function () {
          addSys("已接收来自「档案查询智能体」的角色资料包");
          runTeam(payload.char, true);
        }, 320);
      });
      acts.appendChild(go);
    }
    if (payload.char) {
      var link = el("a", "mini-btn ghost", "查看图鉴");
      link.href = "detail.html?id=" + payload.char.id;
      acts.appendChild(link);
    }
    bubble.appendChild(acts);
    row.appendChild(bubble);
    return row;
  }

  function addBot(payload) {
    msgsEl.appendChild(buildBotRow(payload));
    state.history[state.cur].push({ role: "bot", payload: payload });
    scrollBottom();
  }

  function copyText(text, btn, okText) {
    var done = function () {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = okText || "已复制";
      btn.classList.add("ok");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("ok"); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }

    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function typing(on) {
    var t = $("typing");
    if (!t) return;
    t.style.display = on ? "flex" : "none";
  }

  function botLater(fn) {
    state.busy = true;
    sendBtn.disabled = true;
    typing(true);
    setTimeout(function () {
      typing(false);
      fn();
      state.busy = false;
      sendBtn.disabled = false;
    }, 520);
  }


  /* ------------------------------------------------------------------
     6.5 外接模型：上下文 / 轻量 Markdown / 流式气泡
     ------------------------------------------------------------------ */
  // 把站内档案压缩成一段事实上下文，交给外接模型，避免它自己编材料数字
  function buildContext(text) {
    var c = findChar(text) || state.lastChar[state.cur];
    if (!c) return "";
    var out = [handoffText(c).replace("—— 以上资料可直接粘贴给【配队推演智能体】", "").trim()];
    var m = META[c.name] || {};
    if (m.role) out.push("站内定位：" + m.role);
    if (m.teams && m.teams.length) {
      out.push("站内推荐队伍：" + m.teams.map(function (t) {
        return (t[0] ? t[0] + "：" : "") + (t[1] || []).join(" / ") + (t[2] ? "（" + t[2] + "）" : "");
      }).join("；"));
    }
    if (m.weapons && m.weapons.length) out.push("站内武器推荐：" + m.weapons.slice(0, 4).join("、"));
    out.push("（若与你的记忆冲突，一律以上面的站内数字为准）");
    return out.join("\n").slice(0, 1900);
  }

  // 极简 Markdown：只处理标题、列表、加粗、行内代码，够模型输出用了
  function md(src) {
    var lines = esc(String(src || "")).split(/\n/);
    var out = "", inUl = false;

    function closeUl() { if (inUl) { out += "</ul>"; inUl = false; } }

    lines.forEach(function (raw) {
      var line = raw.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
                    .replace(/`([^`]+)`/g, "<code>$1</code>")
                    .replace(/^\s*#+\s*/, function (m) { return m; });
      var m;
      if (!line.trim()) { closeUl(); out += '<div style="height:7px"></div>'; return; }
      if ((m = line.match(/^\s*#{1,4}\s*(.+)$/))) {
        closeUl(); out += '<div class="md-h">' + m[1] + "</div>"; return;
      }
      if ((m = line.match(/^\s*[-*•·]\s*(.+)$/))) {
        if (!inUl) { out += '<ul>'; inUl = true; }
        out += "<li>" + m[1] + "</li>"; return;
      }
      if ((m = line.match(/^\s*(\d+)[.、)]\s*(.+)$/))) {
        if (!inUl) { out += '<ul>'; inUl = true; }
        out += "<li>" + m[1] + ". " + m[2] + "</li>"; return;
      }
      closeUl();
      out += "<p>" + line + "</p>";
    });
    closeUl();
    return out;
  }

  function llmBubble(text, name) {
    var row = el("div", "msg-row bot");
    var bubble = el("div", "bubble bot-card llm-card");
    bubble.style.setProperty("--ec", AGENTS[state.cur].color);
    bubble.innerHTML =
      '<div class="llm-tag">外接模型 · ' + esc(name || "自定义接口") + "</div>" +
      '<div class="llm-body">' + md(text) + "</div>" +
      '<div class="rc-acts"></div>';
    var acts = bubble.querySelector(".rc-acts");
    var copy = el("button", "mini-btn", "复制全部");
    copy.addEventListener("click", function () { copyText(text, copy, "已复制"); });
    acts.appendChild(copy);
    row.appendChild(bubble);
    return row;
  }

  function beginLLM(name) {
    var row = el("div", "msg-row bot");
    var bubble = el("div", "bubble bot-card llm-card");
    bubble.style.setProperty("--ec", AGENTS[state.cur].color);
    bubble.innerHTML =
      '<div class="llm-tag">外接模型 · ' + esc(name || "自定义接口") + "，正在生成" + "</div>" +
      '<div class="llm-body"><p style="color:var(--text-mute)">· 正在读取站内档案并组织答案…</p></div>' +
      '<div class="rc-acts"></div>';
    row.appendChild(bubble);
    msgsEl.appendChild(row);
    scrollBottom();

    var bodyEl = bubble.querySelector(".llm-body");
    var acts = bubble.querySelector(".rc-acts");
    var last = "";

    return {
      delta: function (t) { last = t; bodyEl.innerHTML = md(t); scrollBottom(); },
      done: function (t) {
        if (t) last = t;
        bodyEl.innerHTML = md(last);
        var tag = bubble.querySelector(".llm-tag");
        if (tag) tag.textContent = "外接模型 · " + (name || "自定义接口");
        var copy = el("button", "mini-btn", "复制全部");
        copy.addEventListener("click", function () { copyText(last, copy, "已复制"); });
        acts.appendChild(copy);

        var c = state.lastChar[state.cur];
        if (state.cur === "archive" && c) {
          var go = el("button", "mini-btn primary", "一键转交配队助手 →");
          go.addEventListener("click", function () {
            switchAgent("team");
            setTimeout(function () {
              addSys("已接收来自「档案查询智能体」的角色资料包");
              runTeam(c, true);
            }, 320);
          });
          acts.appendChild(go);
        }
        state.history[state.cur].push({ role: "bot", text: last, llm: true });
        scrollBottom();
      },
      fail: function () { if (row.parentNode) row.parentNode.removeChild(row); }
    };
  }

  function runLocal(text) {
    if (state.cur === "archive") {
      botLater(function () { runArchive(text); });
    } else {
      botLater(function () { runTeam(text, /档案|突破材料|天赋材料|角色资料卡/.test(text)); });
    }
  }

  function startLLM(text) {
    var L = window.TwinLLM;
    var view = beginLLM(L.name());
    var snapshot = state.history[state.cur].slice(0, -1);
    var hit = findChar(text);
    if (hit) state.lastChar[state.cur] = hit;

    state.busy = true;
    sendBtn.disabled = true;
    typing(false);

    function release() { state.busy = false; sendBtn.disabled = false; }

    L.chat({
      agent: state.cur,
      text: text,
      question: text,
      history: snapshot,
      context: buildContext(text)
    }, {
      onDelta: function (t) { view.delta(t); },
      onDone: function (t) {
        if (!t) {
          view.fail();
          release();
          addSys("外接模型返回为空，已回退本地知识引擎");
          runLocal(text);
          return;
        }
        view.done(t);
        release();
      },
      onError: function (e) {
        view.fail();
        release();
        addSys("外接模型未响应（" + e + "），已回退本地知识引擎");
        runLocal(text);
      }
    });
  }

  /* ------------------------------------------------------------------
     7. 两个智能体的处理逻辑
     ------------------------------------------------------------------ */
  function runArchive(raw) {
    var text = raw.trim();
    var c = findChar(text);
    if (!c && state.lastChar.archive && /材料|天赋|突破|属性|面板|定位|武器|圣遗物|摩拉|经验|等级/.test(text)) {
      c = state.lastChar.archive;
    }

    if (/交给|转交|下一个智能体|打包|精简版|发送给/.test(text) && !c && state.lastChar.archive) {
      c = state.lastChar.archive;
    }
    if (/交给|转交|下一个智能体|打包|精简版|发送给/.test(text) && c) {
      var blocks = [{ h: "角色资料卡（可复制后粘贴给 2 号）", items: handoffText(c).split("\n") }];
      var payload = {
        char: c, blocks: blocks,
        text: handoffText(c),
        handoff: true
      };
      addBot(payload);
      state.lastHandoff = c;
      return;
    }

    if (!c) {
      addBot({
        blocks: [{ h: "没有识别到角色", items: [
          "请带上完整角色名，例如：雷电将军 / 钟离 / 胡桃 / 那维莱特。",
          "支持的说法：① 角色名 + 1-90 级材料清单 ② 角色名 + 天赋升级材料 ③ 角色名 + 角色档案",
          "也可以直接点下方的推荐问题试试。"
        ] }],
        text: "没有识别到角色，请带上完整角色名再问一次。"
      });
      return;
    }

    var intent = archiveIntent(text);
    state.lastChar.archive = c;
    var bs = archiveBlocks(c, intent);
    var txt = archiveText(c, bs);
    addBot({ char: c, blocks: bs, text: txt, handoff: intent === "all" });
    state.lastHandoff = c;
  }

  function fourStarWeapons(c) {
    var m = META[c.name] || {};
    var list = (m.weapons || []).filter(function (w) { return /4★|祭礼|西风|弓藏|决斗|渔获|匣里|螭骨|流浪乐章|试作|天目|铁蜂刺|绝弦|白缨|讨龙|原木刀/.test(w); });
    if (list.length < 3) {
      var pool0 = (WEP_POOL[c.weapon] || WEP_POOL["单手剑"]);
      list = list.concat(pool0.sup.concat(pool0.dps.filter(function (w) { return /4★/.test(w); })));
    }
    if (!list.length) {
      var pool = (WEP_POOL[c.weapon] || WEP_POOL["单手剑"]).sup;
      list = pool.concat((WEP_POOL[c.weapon] || WEP_POOL["单手剑"]).dps.filter(function (w) { return /4★/.test(w); }));
    }
    return list.slice(0, 3);
  }

  function followUpReply(c, text) {
    var m = META[c.name] || {};
    var a = pickArts(c);
    var blocks = [{ h: "追问对象", items: ["沿用上一位角色：" + c.name + "（" + c.el + " · " + c.weapon + " · " + c.star + "★）"] }];

    if (/武器|没有五星|四星|平民/.test(text)) {
      blocks.push({
        h: "四星 / 平民武器替换",
        items: [
          "可用的 4★：" + fourStarWeapons(c).join("、"),
          "优先级：能提供" + (/治疗|护盾|辅助/.test(roleLabel(c)) ? "元素充能 / 生命值" : "暴击、元素伤害或充能") + "的武器优先，精炼 5 的 4★ 往往优于精炼 1 的 5★",
          "圣遗物主词条不变：" + a.mains.join(" / "),
          "如果充能不足，先把时之沙换成元素充能效率，循环顺了再换输出词条"
        ]
      });
    } else if (/生存|更肉|容易死|站不住|护盾/.test(text)) {
      blocks.push({
        h: "提升容错的调整",
        items: [
          "把队伍里价值最低的副C换成钟离 / 迪奥娜 / 莱依拉，护盾可以覆盖整轮输出",
          "治疗位优先珊瑚宫心海、白术、久岐忍这类「后台持续治疗」",
          "操作上先开盾再站场，主C 的 E 用小位移躲伤害，不要硬吃大招"
        ]
      });
    } else if (/循环|手法|顺序|细节/.test(text)) {
      blocks.push({ h: "循环细节（按时序）", items: genLoop(c) });
      blocks.push({
        h: "节奏提示",
        items: [
          "增益类技能（Q / 减抗）先手，主C 的爆发窗口尽量压在增益剩余时间内",
          "主C 的 E 不要空放：留着补附着或回能，避免下一轮循环断档",
          "全队充能不足时，把辅助的 Q 延后一轮，先保证主C 的爆发"
        ]
      });
    } else if (/命座|几命|抽几命/.test(text)) {
      blocks.push({ h: "命座建议", items: [consAdvice(c)] });
    } else if (/新手|简单|容易上手|便宜|低成本/.test(text)) {
      var easy = (m.teams && m.teams.length > 1) ? m.teams[m.teams.length - 1] : null;
      blocks.push({
        h: "低成本 / 新手向方案",
        items: easy
          ? ["队伍：" + easy[1].join(" · "), "思路：" + easy[2], "四星武器即可成型，圣遗物先凑主词条，副词条慢慢刷"]
          : ["队伍：主C + 一名治疗 + 一名护盾 + 一名后台副C", "四星角色（班尼特 / 香菱 / 行秋 / 迪奥娜）就能撑起循环", "先用主词条正确的散件过渡，再考虑套装"]
      });
    } else if (/优化|换|替代|更好/.test(text)) {
      blocks.push({
        h: "优化思路",
        items: [
          "先补「治疗 + 护盾 + 后台副C」三件套，缺哪补哪",
          "元素共鸣优先：双火 / 双水 / 双冰 带来的面板收益往往高于单个角色",
          "如果主C 是" + c.el + "元素，优先找能稳定挂" + ((ARCH[c.el] && ARCH[c.el][0].els.join("/")) || "反应元素") + "的队友",
          "现有队伍里伤害占比最低的角色，就是第一个该换的人"
        ]
      });
    } else {
      blocks.push({ h: "继续推演", items: ["可以说：换成四星武器 / 更耐打一点 / 循环再细一点 / 只要 0 命怎么配"] });
    }
    blocks.push({ h: "可继续追问", items: ["· 换成四星武器", "· 生存再稳一点", "· 循环再细一点", "· 这个角色值不值得抽"] });
    var txt = teamText(c, blocks);
    addBot({ char: c, blocks: blocks, text: txt });
  }

  function runTeam(cOrText, fromPaste) {
    if (typeof cOrText === "string") {
      var c = findChar(cOrText);
      if (!c && state.lastChar.team && /武器|没有五星|四星|平民|生存|更肉|容易死|站不住|循环|手法|顺序|细节|命座|几命|新手|简单|容易上手|便宜|低成本|优化|换|替代|更好|值得|抽/.test(cOrText)) {
        followUpReply(state.lastChar.team, cOrText);
        return;
      }
      if (!c) {
        addBot({
          blocks: [{ h: "还差一个角色", items: [
            "请告诉我角色名，或直接粘贴 1 号智能体输出的角色资料。",
            "示例：那维莱特配队 / 胡桃队伍怎么优化 / 帮我分析玛薇卡阵容"
          ] }],
          text: "还差一个角色名。"
        });
        return;
      }
      cOrText = c;
    }
    var ch = cOrText;
    state.lastChar.team = ch;
    var bs = teamBlocks(ch, !!fromPaste);
    addBot({ char: ch, blocks: bs, text: teamText(ch, bs) });
    state.lastHandoff = ch;
  }

  /* ------------------------------------------------------------------
     8. 交互
     ------------------------------------------------------------------ */
  function send(text) {
    if (state.busy) return;
    text = (text || "").trim();
    if (!text) return;
    addUser(text);
    inputEl.value = "";
    autoGrow();

    if (window.TwinLLM && window.TwinLLM.ready()) {
      startLLM(text);
      return;
    }
    runLocal(text);
  }

  function switchAgent(id, silent) {
    if (state.cur === id) return;
    state.cur = id;
    var a = AGENTS[id];
    document.body.setAttribute("data-agent", id);
    var root = document.querySelector(".chat-shell");
    if (root) root.style.setProperty("--ag", a.color);

    document.querySelectorAll(".agent-tab").forEach(function (t) {
      t.classList.toggle("on", t.dataset.agent === id);
    });
    document.querySelectorAll(".agent-info").forEach(function (t) {
      t.classList.toggle("on", t.dataset.agent === id);
    });

    $("chatName").textContent = a.name;
    $("chatTag").textContent = a.tag;
    $("chatCode").textContent = a.code;
    $("chatSigil").textContent = id === "archive" ? "壹" : "贰";
    if ($("sideSigil")) $("sideSigil").textContent = id === "archive" ? "壹" : "贰";
    $("sideTitle").textContent = id === "archive" ? "能力清单" : "推演能力";
    $("sideSub").textContent = id === "archive" ? "DATA · 124 位角色已接入" : "TEAM · 接驳 1 号数据";
    inputEl.placeholder = a.placeholder;

    // 侧栏能力区
    document.querySelectorAll(".side-body").forEach(function (b) {
      b.classList.toggle("on", b.dataset.agent === id);
    });

    if (window.TwinLLMSetAgent) window.TwinLLMSetAgent(id);
    renderChips(a);
    renderHistory();
  }

  function renderChips(a) {
    chipsEl.innerHTML = "";
    a.chips.forEach(function (q) {
      var b = el("button", "qchip", esc(q));
      b.addEventListener("click", function () { send(q); });
      chipsEl.appendChild(b);
    });
  }

  function renderHistory() {
    msgsEl.innerHTML = "";
    var list = state.history[state.cur];
    // 开场白固定在最前
    addIntroBubble();
    list.forEach(function (m) {
      if (m.role === "user") {
        var row = el("div", "msg-row user");
        var b = el("div", "bubble");
        b.textContent = m.text;
        row.appendChild(b);
        msgsEl.appendChild(row);
      } else if (m.payload) {
        msgsEl.appendChild(buildBotRow(m.payload));
      } else if (m.llm) {
        msgsEl.appendChild(llmBubble(m.text, window.TwinLLM && window.TwinLLM.name()));
      } else {
        var row2 = el("div", "msg-row bot");
        var b2 = el("div", "bubble bot-card");
        b2.innerHTML = '<div class="rc-blk plain"><ul><li style="white-space:pre-wrap">' + esc(m.text) + "</li></ul></div>";
        row2.appendChild(b2);
        msgsEl.appendChild(row2);
      }
    });
    scrollBottom();
  }

  function addIntroBubble() {
    var a = AGENTS[state.cur];
    var row = el("div", "msg-row bot intro-row");
    var bubble = el("div", "bubble bot-card intro-card");
    bubble.style.setProperty("--ec", a.color);
    bubble.innerHTML =
      '<div class="rc-head">' +
        '<div class="rc-ava sigil" style="--ec:' + a.color + '">' + (state.cur === "archive" ? "壹" : "贰") + '</div>' +
        '<div class="rc-title"><div class="rc-name" style="--ec:' + a.color + '">' + a.name +
          '<span>' + a.code + '</span></div>' +
          '<div class="rc-meta">在线 · 已接入 ' + D.count + ' 位角色数据</div></div>' +
      '</div>' +
      '<div class="intro-text">' + esc(a.intro).replace(/\n/g, "<br>") + '</div>';
    row.appendChild(bubble);
    msgsEl.appendChild(row);
  }

  /* ------------------------------------------------------------------
     9. 初始化
     ------------------------------------------------------------------ */
  function autoGrow() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 132) + "px";
  }

  function boot() {
    msgsEl = $("msgs");
    inputEl = $("input");
    sendBtn = $("send");
    chipsEl = $("chips");

    document.querySelectorAll(".agent-tab").forEach(function (t) {
      t.addEventListener("click", function () { switchAgent(t.dataset.agent); });
    });
    document.querySelectorAll("[data-jump]").forEach(function (b) {
      b.addEventListener("click", function () { switchAgent(b.dataset.jump); });
    });
    $("clear").addEventListener("click", function () {
      state.history[state.cur] = [];
      renderHistory();
    });

    $("composer").addEventListener("submit", function (e) {
      e.preventDefault();
      send(inputEl.value);
    });
    inputEl.addEventListener("input", autoGrow);
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send(inputEl.value);
      }
    });

    var a = AGENTS[state.cur];
    document.querySelector(".chat-shell").style.setProperty("--ag", a.color);
    $("chatName").textContent = a.name;
    $("chatTag").textContent = a.tag;
    $("chatCode").textContent = a.code;
    var _id = state.cur;
    $("chatSigil").textContent = _id === "archive" ? "壹" : "贰";
    $("sideTitle").textContent = _id === "archive" ? "能力清单" : "推演能力";
    $("sideSub").textContent = _id === "archive" ? "DATA · 124 位角色已接入" : "TEAM · 接驳 1 号数据";
    inputEl.placeholder = a.placeholder;
    renderChips(a);
    renderHistory();
    if (window.TwinLLMSetAgent) window.TwinLLMSetAgent(state.cur);
    if ((location.hash || "").replace("#", "") === "team") switchAgent("team");
  }

  /* 供 assistant-llm.js 调用：配置提示 / 清除记录 */
  window.TwinAgentNotice = function (text) { addSys(text); };
  window.TwinAgentReset = function () {
    state.history = { archive: [], team: [] };
    state.lastChar = { archive: null, team: null };
    state.lastHandoff = null;
    renderHistory();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
