# -*- coding: utf-8 -*-
"""抓取角色材料 / 属性数据（来源：gi.yatta.moe 公开 API），产出 agent-data.json"""
import json, os, urllib.request, concurrent.futures

BASE = "https://gi.yatta.moe/api/v2/chs/avatar"
OUT = os.path.join(os.path.dirname(__file__), "agent_raw.json")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == tries - 1:
                print("FAIL", url, e)
                return None


lst = get(BASE)
items_meta = lst["data"]["items"]
ids = list(items_meta.keys())
print("avatars", len(ids))


def fetch(aid):
    return aid, get(BASE + "/" + aid)


raw = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
    for aid, d in ex.map(fetch, ids):
        if d:
            raw[aid] = d["data"]
        print(".", end="", flush=True)
print("\nok", len(raw))

# 只保留精简字段，避免文件过大
slim = {}
for aid, d in raw.items():
    slim[aid] = {
        "name": d["name"],
        "rank": d["rank"],
        "element": d["element"],
        "weapon": d["weaponType"],
        "region": d["region"],
        "special": d.get("specialProp"),
        "items": d.get("items", {}),
        "promote": d["upgrade"]["promote"],
        "base": d["upgrade"]["prop"],
        "talent": {k: {"name": v["name"], "type": v["type"], "promote": v.get("promote")}
                   for k, v in d["talent"].items()
                   if isinstance(v, dict) and v.get("promote") and str(k).isdigit() and int(k) < 3},
        "constellation": [c["name"] for c in (d.get("constellation") or {}).values() if isinstance(c, dict)] if isinstance(d.get("constellation"), dict) else [c.get("name") for c in (d.get("constellation") or []) if isinstance(c, dict)],
    }

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(slim, f, ensure_ascii=False)
print("written", OUT, os.path.getsize(OUT) // 1024, "KB")
