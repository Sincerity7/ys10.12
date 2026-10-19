# -*- coding: utf-8 -*-
"""本地 mock：模拟三种接口的流式返回，验证外接模型链路（仅测试用）。"""
import json, time
from http.server import BaseHTTPRequestHandler, HTTPServer

NL = "\n"
REPLY = (
    "【雷电将军 · 梦想一心】雷元素 / 长柄武器 / 5★" + NL + NL +
    "## 角色定位" + NL +
    "· 雷系充能核心，兼顾爆发主 C 与全队回能" + NL + NL +
    "## 突破材料" + NL +
    "· 最胜紫晶：碎屑×1 / 断片×9 / 块×9 / 宝石×6" + NL +
    "· 雷霆数珠×46、天云草实×168" + NL +
    "· 摩拉 420,000" + NL + NL +
    "## 天赋材料" + NL +
    "· 天光：教导×9 / 指引×63 / 哲学×114" + NL +
    "· 万劫之真意×18、智识之冕×3" + NL
)


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def _sse_headers(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n)
        try:
            body = json.loads(raw or b"{}")
        except Exception:
            body = {}
        print("REQ", self.path, "model=", body.get("model"), "bot=", body.get("bot_id"),
              "app_key=", body.get("app_key"), "auth=", self.headers.get("Authorization", "")[:14])

        if "/error" in self.path:
            self.send_response(401)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": {"message": "invalid api key"}}).encode())
            return

        if "/adp/v2/chat" in self.path:
            self._sse_headers()
            for i in range(0, len(REPLY), 9):
                ev = {"type": "reply", "payload": {"content": REPLY[i:i + 9]}}
                self.wfile.write(("event: message" + NL + "data: " +
                                  json.dumps(ev, ensure_ascii=False) + NL + NL).encode("utf-8"))
                self.wfile.flush()
                time.sleep(0.01)
            self.wfile.write(("event: close" + NL + "data: {}" + NL + NL).encode())
            return

        if "/v3/chat" in self.path:
            self._sse_headers()
            for i in range(0, len(REPLY), 11):
                ev = {"content": REPLY[i:i + 11], "role": "assistant", "type": "answer"}
                self.wfile.write(("event: conversation.message.delta" + NL + "data: " +
                                  json.dumps(ev, ensure_ascii=False) + NL + NL).encode("utf-8"))
                self.wfile.flush()
                time.sleep(0.01)
            self.wfile.write(("event: done" + NL + "data: {}" + NL + NL).encode())
            return

        self._sse_headers()
        for i in range(0, len(REPLY), 7):
            chunk = {"choices": [{"delta": {"content": REPLY[i:i + 7]}}]}
            self.wfile.write(("data: " + json.dumps(chunk, ensure_ascii=False) + NL + NL).encode("utf-8"))
            self.wfile.flush()
            time.sleep(0.01)
        self.wfile.write(("data: [DONE]" + NL + NL).encode())

    def log_message(self, *a):
        pass


HTTPServer(("127.0.0.1", 8899), H).serve_forever()
