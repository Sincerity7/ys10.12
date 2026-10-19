/* ==========================================================================
   assistant-llm.js · 「自定义外接模型」接入层
   --------------------------------------------------------------------------
   四种接口：
     · 腾讯智能体开发平台（ADP / LKE）  SSE
     · 扣子 Coze（Bot）                 SSE
     · 火山方舟（模型接入点）            OpenAI 兼容
     · 通用 OpenAI 兼容                  OpenAI 兼容
   面板只保留必要项：接口类型 / 密钥 / 接口地址 / 模型。
   扣子的两个 Bot 分别绑定两个智能体：壹号档案、贰号配队。
   配置只写进 localStorage，不写页面源码、不上传服务器。
   未配置完整时页面继续走 assistant.js 的本地知识引擎。
   ========================================================================== */
(function () {
  "use strict";

  var CFG_KEY = "genshin_llm_cfg_v1";
  var VISITOR_KEY = "genshin_llm_visitor_v1";

  var PROVIDERS = {
    local: {
      name: "本地知识引擎（离线，无需配置）",
      short: "本地引擎",
      fields: []
    },
    adp: {
      name: "腾讯智能体开发平台（ADP / LKE）",
      short: "ADP",
      fields: ["key", "base"],
      base: "https://wss.lke.cloud.tencent.com/adp/v2/chat",
      keyLabel: "AppKey",
      keyPh: "应用管理 → 调用 → 应用信息里的 AppKey",
      keyHint: "应用须先发布，AppKey 才会生成",
      baseHint: "粘贴平台给的地址即可，wss:// 会自动转成 https://"
    },
    coze: {
      name: "扣子 Coze（Bot）",
      short: "Coze",
      fields: ["key", "base", "model"],
      base: "https://api.coze.cn",
      keyLabel: "访问令牌",
      keyPh: "扣子 → 个人访问令牌（pat_…）",
      keyHint: "令牌需开启 bot 相关权限",
      baseHint: "国际版填 https://api.coze.com",
      modelLabel: "Bot ID",
      modelPh: "7xxxxxxxxxxxxxxxxx"
    },
    ark: {
      name: "火山方舟（模型接入点）",
      short: "方舟",
      fields: ["key", "base", "model"],
      base: "https://ark.cn-beijing.volces.com/api/v3",
      keyLabel: "API Key",
      keyPh: "方舟控制台 → API Key 管理",
      keyHint: "",
      baseHint: "",
      modelLabel: "接入点 ID",
      modelPh: "ep-2024xxxxxxxx"
    },
    openai: {
      name: "通用 · OpenAI 兼容",
      short: "OpenAI 兼容",
      fields: ["key", "base", "model"],
      base: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      keyLabel: "API Key",
      keyPh: "sk-… 或中转站令牌",
      keyHint: "",
      baseHint: "填到 /v1 即可",
      modelLabel: "模型名",
      modelPh: "gpt-4o-mini / deepseek-chat"
    }
  };

  /* 出厂默认：扣子，两个 Bot 已对应好两个智能体（可在面板里改或清除） */
  var DEFAULT_CFG = {
    provider: "coze",
    key: "pat_h9SZiq2wVwlXWJMFTFvJtMtcppazx6fKSeWL2hL2wmKJ8sUbFRHiuaEP2kVLUh9E",
    base: "https://api.coze.cn",
    model: "",
    models: { archive: "7698303099848835113", team: "7698305675894079507" }
  };

  var AGENT_LABEL = { archive: "壹号 · 档案查询", team: "贰号 · 配队推演" };

  var SYS = {
    archive:
      "你是「原神角色档案查询智能体」，来自原神角色图鉴馆网页。\n" +
      "只回答《原神》角色相关问题：角色背景、定位、突破材料、天赋升级材料、1~90 级摩拉与经验书、90 级基础面板、武器与圣遗物推荐。\n" +
      "输出规则：\n" +
      "1. 第一行给角色概览：元素 / 武器 / 星级 / 定位。\n" +
      "2. 按「突破材料」「天赋材料」「1-90 消耗」「90 级面板」分段，每条一行，用「·」开头。\n" +
      "3. 数值必须准确；若用户消息里提供了【站内档案】，材料与面板一律以站内数字为准，不得改写。\n" +
      "4. 不要寒暄、不要解释规则、不要多余总结，直接给可复制的结果。\n" +
      "5. 用户说「交给下一个智能体」时，只输出精简资料卡（元素/定位/材料/面板），便于直接粘贴。",
    team:
      "你是「原神配队推演智能体」，原神角色图鉴馆配套二号助手，可以接收一号智能体输出的角色资料。\n" +
      "输出固定四个模块：\n" +
      "① 推荐队伍：列出 2~3 套，每套写清四名角色与各自分工（主C / 副C / 增益 / 生存）及核心思路。\n" +
      "② 输出循环手法：用「E → Q → 切人 → …」的时序描述一轮循环，标出爆发窗口。\n" +
      "③ 圣遗物细节：套装、主词条（沙/杯/冠）、副词条优先级。\n" +
      "④ 抽取建议：包含命座建议与平民替代（四星武器、四星队友）。\n" +
      "若用户消息里带有角色资料，先用一行复述角色定位再开始推演；数值以资料中的为准。不要寒暄。"
  };

  var cfg = loadCfg();
  var ui = {};
  var testing = false;
  var curAgent = "archive";

  /* ------------------------------ 存储 ------------------------------ */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function loadCfg() {
    var base = clone(DEFAULT_CFG);
    try {
      var raw = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
      if (raw && typeof raw === "object") {
        // 兼容旧版字段（appKey / apiKey / temp / system）
        if (raw.provider) base.provider = raw.provider;
        base.key = typeof raw.key === "string" ? raw.key : (raw.apiKey || raw.appKey || "");
        base.base = raw.base || "";
        base.model = raw.model || "";
        if (raw.models && typeof raw.models === "object") {
          base.models = { archive: raw.models.archive || "", team: raw.models.team || "" };
        }
      }
    } catch (e) {}
    if (!PROVIDERS[base.provider]) base.provider = DEFAULT_CFG.provider;
    return base;
  }

  function saveCfg(c) {
    cfg = c;
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
  }

  function botOf(agent) {
    var m = cfg.models || {};
    return (m[agent] || "").trim();
  }

  function visitorId() {
    var v = "";
    try { v = localStorage.getItem(VISITOR_KEY) || ""; } catch (e) {}
    if (!v) {
      v = "tw-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(VISITOR_KEY, v); } catch (e) {}
    }
    return v;
  }

  function sessionId(agent) {
    if (!sessionId.map) sessionId.map = {};
    if (!sessionId.map[agent]) {
      sessionId.map[agent] = "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    }
    return sessionId.map[agent];
  }

  /* ------------------------------ 工具 ------------------------------ */
  function normalizeUrl(u) {
    return String(u || "").trim()
      .replace(/^wss:\/\//i, "https://")
      .replace(/^ws:\/\//i, "http://")
      .replace(/\/+$/, "");
  }

  function endpoint(c) {
    var base = normalizeUrl(c.base);
    if (!base) return "";
    if (c.provider === "adp") return base;
    if (c.provider === "coze") return /\/v3\/chat$/.test(base) ? base : base + "/v3/chat";
    if (/\/chat\/completions$/.test(base)) return base;
    if (/\/v\d+$/.test(base)) return base + "/chat/completions";
    return base + "/v1/chat/completions";
  }

  function headers(c) {
    var h = { "Content-Type": "application/json" };
    if (c.key) h["Authorization"] = "Bearer " + c.key.trim();
    return h;
  }

  function messages(agent, question, history, context) {
    var out = [{ role: "system", content: SYS[agent] || SYS.archive }];
    var ctx = (context || "").trim();
    if (ctx) out.push({ role: "system", content: "【站内档案 · 材料与面板以此为准】\n" + ctx });
    (history || []).slice(-8).forEach(function (m) {
      if (m.role === "user" && m.text) out.push({ role: "user", content: m.text });
      else if (m.role === "bot") {
        var t = m.text || (m.payload && m.payload.text) || "";
        if (t) out.push({ role: "assistant", content: String(t).slice(0, 2200) });
      }
    });
    out.push({ role: "user", content: question });
    return out;
  }

  /* ADP / 扣子 只吃一条 user 文本，把站内档案拼进消息里，保证数字准确 */
  function withContext(question, context) {
    var q = String(question || "").trim();
    var ctx = String(context || "").trim();
    if (!ctx) return q;
    if (/角色资料卡|【站内档案】/.test(q)) return q;
    return "【站内档案 · 以下数值为准】\n" + ctx + "\n\n用户问题：" + q;
  }

  function body(c, agent, question, history, context, stream) {
    if (c.provider === "adp") {
      return {
        app_key: c.key.trim(),
        visitor_biz_id: visitorId(),
        session_id: sessionId(agent),
        question: withContext(question, context),
        stream: !!stream
      };
    }
    if (c.provider === "coze") {
      return {
        bot_id: botOf(agent),
        user_id: visitorId(),
        stream: !!stream,
        auto_save_history: true,
        additional_messages: [{
          role: "user",
          content: withContext(question, context),
          content_type: "text"
        }]
      };
    }
    return {
      model: (c.model || "").trim(),
      messages: messages(agent, question, history, context),
      temperature: 0.7,
      stream: !!stream
    };
  }

  /* --------------------------- SSE 解析 --------------------------- */
  function readSSE(res, onBlock, signal) {
    var reader = res.body.getReader();
    var dec = new TextDecoder("utf-8");
    var buf = "";

    function flush(text) {
      var blocks = text.replace(/\r\n/g, "\n").split("\n\n");
      var rest = blocks.pop();
      blocks.forEach(onBlock);
      return rest;
    }

    function pump() {
      return reader.read().then(function (r) {
        if (signal && signal.aborted) { try { reader.cancel(); } catch (e) {} return; }
        if (r.done) { if (buf.trim()) onBlock(buf); return; }
        buf += dec.decode(r.value, { stream: true });
        buf = flush(buf);
        return pump();
      });
    }
    return pump();
  }

  function parseBlock(block) {
    var ev = "", data = [];
    block.split("\n").forEach(function (line) {
      if (!line || line.charAt(0) === ":") return;
      if (line.indexOf("event:") === 0) ev = line.slice(6).trim();
      else if (line.indexOf("data:") === 0) data.push(line.slice(5).replace(/^ /, ""));
    });
    return { event: ev, data: data.join("\n") };
  }

  /* --------------------------- 请求主流程 --------------------------- */
  function run(c, opts, cb) {
    cb = cb || {};
    var url = endpoint(c);
    var ac = new AbortController();
    var done = false;
    var acc = "";
    var timeout = setTimeout(function () { ac.abort(); }, opts.timeout || 120000);

    function push(chunk) {
      if (!chunk) return;
      if (acc && chunk.indexOf(acc) === 0 && chunk.length >= acc.length) acc = chunk;
      else if (acc && acc.indexOf(chunk) === 0) { /* 整段重复，忽略 */ }
      else acc += chunk;
      if (cb.onDelta) cb.onDelta(acc);
    }

    function finish(err) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      if (err) { if (cb.onError) cb.onError(err); }
      else { if (cb.onDone) cb.onDone(acc.trim()); }
    }

    fetch(url, {
      method: "POST",
      headers: headers(c),
      body: JSON.stringify(body(c, opts.agent, opts.question, opts.history, opts.context, true)),
      signal: ac.signal
    }).then(function (res) {
      var ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!res.ok) {
        return res.text().then(function (t) {
          var msg = t;
          try {
            var j = JSON.parse(t);
            msg = (j.error && (j.error.message || j.error.code)) || j.message || j.msg || t;
          } catch (e) {}
          throw new Error("HTTP " + res.status + "：" + String(msg).slice(0, 160));
        });
      }

      if (ct.indexOf("application/json") >= 0) {
        return res.json().then(function (j) {
          var txt = pickJsonText(c, j);
          if (!txt) throw new Error("接口返回成功，但没有解析到文本内容");
          acc = txt;
          if (cb.onDelta) cb.onDelta(txt);
          finish(null);
        });
      }
      if (!res.body || !res.body.getReader) {
        return res.text().then(function (t) {
          var txt = pickLooseText(t);
          if (!txt) throw new Error("当前浏览器不支持流式读取，且响应无法解析");
          push(txt);
          finish(null);
        });
      }

      var got = false;
      return readSSE(res, function (block) {
        var p = parseBlock(block);
        if (!p.data) return;
        if (p.data === "[DONE]") { finish(null); return; }
        var j = null;
        try { j = JSON.parse(p.data); } catch (e) { return; }
        var piece = pickEventText(c, p.event, j);
        if (piece) { got = true; push(piece); }
        var err = pickEventError(j);
        if (err) throw new Error(err);
      }, ac.signal).then(function () {
        if (!got && !acc) throw new Error("连接成功但没有收到内容，请检查接口地址与模型是否匹配");
        finish(null);
      });
    }).catch(function (err) {
      if (done) return;
      var m = err && err.message ? err.message : String(err);
      if (err && err.name === "AbortError") m = "请求超时或被中止";
      else if (err instanceof TypeError) m = "网络请求失败：可能是跨域（CORS）被拦截，或地址不可达";
      finish(m);
    });

    return { abort: function () { clearTimeout(timeout); try { ac.abort(); } catch (e) {} } };
  }

  function pickJsonText(c, j) {
    if (!j) return "";
    if (c.provider === "coze") {
      var d = j.data || j;
      if (d && d.messages && d.messages.length) {
        return d.messages.filter(function (m) { return m.type === "answer" || m.role === "assistant"; })
          .map(function (m) { return m.content || ""; }).join("");
      }
    }
    if (c.provider === "adp") {
      if (j.type === "reply" && j.payload) return j.payload.content || "";
      if (j.payload && j.payload.content) return j.payload.content || "";
    }
    var ch = j.choices && j.choices[0];
    if (ch) {
      if (ch.message && ch.message.content) return ch.message.content;
      if (ch.delta && ch.delta.content) return ch.delta.content;
    }
    return j.content || (j.data && j.data.content) || "";
  }

  function pickEventText(c, ev, j) {
    if (c.provider === "coze") {
      // conversation.message.delta / completed，只取 answer，不要 verbose / reasoning
      if (j.type && j.type !== "answer") return "";
      if (ev.indexOf("delta") >= 0 || ev.indexOf("completed") >= 0) return j.content || "";
      return "";
    }
    if (c.provider === "adp") {
      if (j.type === "reply" && j.payload) return j.payload.content || j.payload.message || "";
      if (j.payload && j.payload.content && j.type !== "thought") return j.payload.content;
      return "";
    }
    var ch = j.choices && j.choices[0];
    if (ch) {
      if (ch.delta && typeof ch.delta.content === "string") return ch.delta.content;
      if (ch.message && typeof ch.message.content === "string") return ch.message.content;
      if (typeof ch.text === "string") return ch.text;
    }
    return "";
  }

  function pickEventError(j) {
    if (!j) return "";
    if (j.type === "error" || j.type === "failed") {
      return (j.payload && (j.payload.message || j.payload.msg)) || j.message || "接口返回错误";
    }
    if (j.code && j.code !== 0 && j.code !== 200 && j.msg) return j.msg;
    if (j.last_error && j.last_error.code && j.last_error.msg) return j.last_error.msg;
    if (j.error) return j.error.message || String(j.error);
    return "";
  }

  function pickLooseText(t) {
    var out = "";
    String(t).split(/\r?\n/).forEach(function (line) {
      if (line.indexOf("data:") !== 0) return;
      var d = line.slice(5).trim();
      if (!d || d === "[DONE]") return;
      try { out += pickEventText({ provider: "openai" }, "", JSON.parse(d)); } catch (e) {}
    });
    return out;
  }

  /* ---------------------------- 对外 API ---------------------------- */
  function ready(agent) {
    if (cfg.provider === "local") return false;
    if (!cfg.key || !cfg.base) return false;
    if (cfg.provider === "adp") return true;
    if (cfg.provider === "coze") return !!botOf(agent || curAgent);
    return !!cfg.model;
  }

  function activeName(agent) {
    var a = agent || curAgent;
    if (!ready(a)) return "";
    var p = PROVIDERS[cfg.provider] || PROVIDERS.local;
    if (cfg.provider === "coze") return "Coze · " + (a === "team" ? "配队 Bot" : "档案 Bot");
    return p.short + (cfg.model ? " · " + cfg.model : "");
  }

  window.TwinLLM = {
    ready: ready,
    name: activeName,
    config: function () { return cfg; },
    bot: botOf,
    chat: function (opts, cb) { return run(cfg, opts || {}, cb); },
    test: function (c, cb, agent) {
      var a = agent || curAgent;
      return run(c, {
        agent: a,
        question: "只回复四个字：连接成功",
        history: [],
        context: "",
        timeout: 60000
      }, cb);
    }
  };

  /* ---------------------------- 配置面板 ---------------------------- */
  function $(id) { return document.getElementById(id); }

  function modelLabelText(provider) {
    var p = PROVIDERS[provider] || PROVIDERS.local;
    if (provider !== "coze") return p.modelLabel || "模型";
    return (p.modelLabel || "Bot ID") + " · " + (curAgent === "team" ? "贰号配队" : "壹号档案");
  }

  function fill(c) {
    ui.provider.value = c.provider || DEFAULT_CFG.provider;
    ui.key.value = c.key || "";
    ui.base.value = c.base || "";
    ui.model.value = "";
    applyProvider(c.provider, true);
    ui.model.value = c.provider === "coze" ? botOf(curAgent) : (c.model || "");
    updateBadge();
  }

  /* 切换智能体前把当前输入收进内存，避免二号的值被冲掉 */
  function stashModel() {
    if (!ui.model || !ui.provider) return;
    var v = ui.model.value.trim();
    if (ui.provider.value === "coze") {
      cfg.models = cfg.models || { archive: "", team: "" };
      cfg.models[curAgent] = v;
    } else {
      cfg.model = v;
    }
  }

  function setAgent(agent) {
    if (!agent || agent === curAgent) return;
    stashModel();
    curAgent = agent;
    if (!ui.model) return;
    if (ui.provider.value === "coze") ui.model.value = botOf(agent);
    $("lblModel").textContent = modelLabelText(ui.provider.value);
    updateBadge();
  }

  function collect() {
    var v = ui.model.value.trim();
    var provider = ui.provider.value;
    var c = {
      provider: provider,
      key: ui.key.value.trim(),
      base: normalizeUrl(ui.base.value),
      model: "",
      models: { archive: botOf("archive"), team: botOf("team") }
    };
    if (provider === "coze") c.models[curAgent] = v;
    else c.model = v;
    return c;
  }

  function validate(c) {
    if (c.provider === "local") return "";
    var p = PROVIDERS[c.provider];
    if (!c.key) return "请填写" + (p.keyLabel || "密钥");
    if (!c.base) return "请填写接口地址";
    if (c.provider === "coze") {
      if (!c.models.archive || !c.models.team) return "壹号与贰号的 Bot ID 都要填（切换上方智能体分别填写）";
      return "";
    }
    if (!c.model) return "请填写" + (p.modelLabel || "模型");
    return "";
  }

  function applyProvider(id, keepValue) {
    var p = PROVIDERS[id] || PROVIDERS.local;
    var f = p.fields || [];

    document.querySelectorAll("[data-f]").forEach(function (n) {
      n.style.display = f.indexOf(n.dataset.f) >= 0 ? "" : "none";
    });

    if (!keepValue) {
      ui.base.value = p.base || "";
      ui.model.value = id === "coze" ? botOf(curAgent) : (p.model || "");
    } else {
      if (!ui.base.value) ui.base.value = p.base || "";
      if (id === "coze") {
        if (!ui.model.value) ui.model.value = botOf(curAgent);
      } else if (!ui.model.value && p.model) {
        ui.model.value = p.model;
      }
    }

    $("lblKey").textContent = p.keyLabel || "密钥";
    ui.key.placeholder = p.keyPh || "";
    $("hintKey").textContent = p.keyHint || "";
    $("hintBase").textContent = p.baseHint || "";
    $("lblModel").textContent = modelLabelText(id);
    ui.model.placeholder = p.modelPh || "";
    if ($("hintModel")) {
      $("hintModel").textContent = id === "coze"
        ? "壹号 / 贰号 Bot 各自独立，切换上方智能体会自动切换"
        : "";
    }

    var lock = id === "local";
    [ui.key, ui.base, ui.model].forEach(function (n) { n.disabled = lock; });
    $("cfgTest").disabled = lock;
    $("hintProv").textContent = lock
      ? "离线可用，回答由站内 124 位角色的官方数值生成。"
      : "保存后对话改由该模型回答；请求失败会自动回退本地知识引擎。";
    ui.panel.classList.toggle("is-local", lock);
  }

  function msg(text, type) {
    if (!ui.msg) return;
    ui.msg.textContent = text || "";
    ui.msg.className = "cfg-msg" + (type ? " " + type : "");
    ui.msg.style.display = text ? "block" : "none";
  }

  function updateBadge() {
    var ok = ready();
    var p = PROVIDERS[cfg.provider] || PROVIDERS.local;
    if (ui.state) {
      ui.state.textContent = ok
        ? (cfg.provider === "coze"
            ? "已接入 · Coze 双 Bot"
            : "已接入 · " + p.short + (cfg.model ? " / " + cfg.model : ""))
        : (cfg.provider === "local" ? "本地引擎 · 离线可用" : "未配置 · 暂用本地引擎");
      ui.state.classList.toggle("on", ok);
    }
    if (ui.live) {
      ui.live.innerHTML = "<i></i>" + (ok ? "外接模型已接入" : "本地知识引擎");
      ui.live.classList.toggle("ext", ok);
    }
  }

  function note(text) {
    if (window.TwinAgentNotice) window.TwinAgentNotice(text);
  }

  function bind() {
    ui.provider.addEventListener("change", function () {
      applyProvider(ui.provider.value, false);
      msg("", "");
      updateBadge();
    });

    $("cfgEye").addEventListener("click", function () {
      var show = ui.key.type === "password";
      ui.key.type = show ? "text" : "password";
      this.textContent = show ? "隐藏" : "显示";
    });

    $("cfgSave").addEventListener("click", function () {
      var c = collect();
      var err = validate(c);
      if (err) { msg(err, "warn"); return; }
      saveCfg(c);
      fill(c);
      msg(c.provider === "local"
        ? "已切回本地知识引擎"
        : "已保存：" + PROVIDERS[c.provider].short + (c.provider === "coze" ? " · 壹/贰 双 Bot" : (c.model ? " · " + c.model : "")), "ok");
      note(c.provider === "local"
        ? "已切回本地知识引擎，后续回答由站内数据生成。"
        : "外接模型已接入：" + activeName() + "，回答会自动附带站内角色数据。");
    });

    $("cfgTest").addEventListener("click", function () {
      if (testing) { msg("测试进行中，请稍候…", "warn"); return; }
      var c = collect();
      var err = validate(c);
      if (err) { msg(err, "warn"); return; }
      testing = true;
      $("cfgTest").disabled = true;
      msg("正在连接 " + AGENT_LABEL[curAgent] + "…", "");
      var t0 = Date.now(), got = "";
      window.TwinLLM.test(c, {
        onDelta: function (t) { got = t; },
        onDone: function (t) {
          testing = false;
          $("cfgTest").disabled = false;
          msg("连接成功（" + Math.round((Date.now() - t0) / 1000) + "s）· 模型回复：" + String(t || got).slice(0, 30), "ok");
        },
        onError: function (e) {
          testing = false;
          $("cfgTest").disabled = false;
          msg("连接失败：" + e, "warn");
        }
      }, curAgent);
    });

    $("cfgClear").addEventListener("click", function () {
      if (!window.confirm("将清除本机保存的接口配置与两个智能体的对话记录，确定继续？")) return;
      var empty = {
        provider: DEFAULT_CFG.provider,
        key: "",
        base: PROVIDERS[DEFAULT_CFG.provider].base,
        model: "",
        models: { archive: "", team: "" }
      };
      try {
        localStorage.removeItem(VISITOR_KEY);
        localStorage.setItem(CFG_KEY, JSON.stringify(empty));
      } catch (e) {}
      cfg = empty;
      fill(cfg);
      msg("已清除本地配置与对话记录（接口密钥已删空）", "ok");
      if (window.TwinAgentReset) window.TwinAgentReset();
      note("本地配置与对话记录已清除，当前使用本地知识引擎。");
    });
  }

  function init() {
    curAgent = document.body.getAttribute("data-agent") === "team" ? "team" : "archive";
    ui.panel = $("cfgPanel");
    if (!ui.panel) return;
    ui.provider = $("cfgProvider");
    ui.key = $("cfgKey");
    ui.base = $("cfgBase");
    ui.model = $("cfgModel");
    ui.msg = $("cfgMsg");
    ui.state = $("cfgState");
    ui.live = $("liveState");
    if (ui.live) {
      ui.live.style.cursor = "pointer";
      ui.live.title = "点击配置外接模型";
      ui.live.addEventListener("click", function () {
        ui.panel.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    bind();
    fill(cfg);
  }

  window.TwinLLMSetAgent = setAgent;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
