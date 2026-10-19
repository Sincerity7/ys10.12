// 真实联调：默认配置 + 两个 Bot 切换 + 扣子流式回答
const { spawn } = require("child_process");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9337;
const BASE = process.argv[2] || "http://127.0.0.1:8781/assistant.html";
const ASK = process.argv[3] || "";
const AGENT = process.argv[4] || "team";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=C:/Users/Admin/AppData/Local/Temp/prof_cdp_llm",
    "--window-size=1360,1200", "about:blank"
  ], { stdio: "ignore" });

  let ver = null;
  for (let i = 0; i < 40; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch (e) { await sleep(250); }
  }
  if (!ver) { console.log("CHROME_NOT_READY"); chrome.kill(); process.exit(1); }

  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: "PUT" })).json();
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send("Runtime.enable");
  await sleep(3500);

  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return "EXC:" + JSON.stringify(r.exceptionDetails).slice(0, 300);
    return r.result ? r.result.value : undefined;
  };

  const before = await ev(`(function(){
    return {provider: document.getElementById('cfgProvider').value,
      keyLen: document.getElementById('cfgKey').value.length,
      keyHead: document.getElementById('cfgKey').value.slice(0,8),
      base: document.getElementById('cfgBase').value,
      model: document.getElementById('cfgModel').value,
      lbl: document.getElementById('lblModel').textContent,
      badge: document.getElementById('cfgState').textContent,
      live: document.getElementById('liveState').textContent};
  })()`);
  console.log("DEFAULT:", JSON.stringify(before));

  const after = await ev(`(function(){
    var tb=document.querySelector('.agent-tab[data-agent="${AGENT}"]'); if(tb) tb.click();
    return new Promise(function(r){ setTimeout(function(){ r({
      model: document.getElementById('cfgModel').value,
      lbl: document.getElementById('lblModel').textContent,
      badge: document.getElementById('cfgState').textContent,
      agent: document.body.getAttribute('data-agent')
    }); }, 400); });
  })()`);
  console.log("SWITCH_TEAM:", JSON.stringify(after));

  if (ASK) {
    await ev(`(function(){
      var i=document.getElementById('input'); i.value=${JSON.stringify(ASK)};
      document.getElementById('composer').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      return true;
    })()`);

    let done = false, last = "";
    for (let i = 0; i < 90; i++) {
      await sleep(2000);
      const st = await ev(`(function(){
        var card=document.querySelectorAll('.llm-card');
        var c=card[card.length-1];
        return c ? {tag:(c.querySelector('.llm-tag')||{}).textContent,
                    len:(c.querySelector('.llm-body')||{}).innerText.length,
                    txt:(c.querySelector('.llm-body')||{}).innerText.slice(0,300),
                    fin: !!c.querySelector('.rc-acts .mini-btn')} : null;
      })()`);
      if (!st) continue;
      last = JSON.stringify(st).slice(0, 700);
      if (st.fin) { done = true; console.log("ANSWER:", last); break; }
      if (i % 5 === 4) console.log("...", last.slice(0, 200));
    }
    if (!done) console.log("TIMEOUT_LAST:", last);

    const sys = await ev(`document.getElementById('msgs').innerText.slice(-160).replace(/\\n/g,' / ')`);
    console.log("TAIL:", sys);
  }

  ws.close();
  chrome.kill();
  process.exit(0);
})();
