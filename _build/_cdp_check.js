// 用 CDP 真实等待，验证外接模型流式输出（避免 --virtual-time-budget 触发 90s 超时）
const { spawn } = require("child_process");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const URL_ = process.argv[2] || "http://127.0.0.1:8781/assistant.html";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=C:/Users/Admin/AppData/Local/Temp/prof_cdp",
    "--window-size=1360,1200", "about:blank"
  ], { stdio: "ignore" });

  let ver = null;
  for (let i = 0; i < 40; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch (e) { await sleep(250); }
  }
  if (!ver) { console.log("CHROME_NOT_READY"); chrome.kill(); process.exit(1); }

  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_)}`, { method: "PUT" })).json();
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
  await sleep(7000);

  const r = await send("Runtime.evaluate", {
    expression: `(function(){
      var o = document.getElementById('OUT');
      return (o ? o.textContent : document.getElementById('msgs').innerText)
        + ' ||| TITLE=' + (document.getElementById('cfgState')||{}).textContent;
    })()`,
    returnByValue: true
  });
  console.log("=== RESULT ===");
  console.log(r.result.value);

  ws.close();
  chrome.kill();
  process.exit(0);
})();
