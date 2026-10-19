# -*- coding: utf-8 -*-
"""把 agent_raw.json 聚合成站点用的紧凑材料数据 -> agent-data.js"""
import json, os

HERE = os.path.dirname(__file__)
ROOT = os.path.dirname(HERE)
raw = json.load(open(os.path.join(HERE, "agent_raw.json"), encoding="utf-8"))

EXP_TOTAL = 8362650          # 1-90 累计经验
MORA_LV = 1673400            # 1-90 升级摩拉
BOOK_HERO = 419              # 大英雄的经验

# 90 级基础面板 = 各阶段 addProps 之和 / 曲线系数（由官方 90 级面板反推校准）
CURVE = {5: 1.2530, 4: 1.1866}

PROP = {
    "FIGHT_PROP_CRITICAL_HURT": "暴击伤害",
    "FIGHT_PROP_CRITICAL": "暴击率",
    "FIGHT_PROP_CHARGE_EFFICIENCY": "元素充能效率",
    "FIGHT_PROP_ELEMENT_MASTERY": "元素精通",
    "FIGHT_PROP_HEAL_ADD": "治疗加成",
    "FIGHT_PROP_ATTACK_PERCENT": "攻击力",
    "FIGHT_PROP_HP_PERCENT": "生命值",
    "FIGHT_PROP_DEFENSE_PERCENT": "防御力",
    "FIGHT_PROP_PHYSICAL_ADD_HURT": "物理伤害加成",
    "FIGHT_PROP_FIRE_ADD_HURT": "火元素伤害加成",
    "FIGHT_PROP_WATER_ADD_HURT": "水元素伤害加成",
    "FIGHT_PROP_GRASS_ADD_HURT": "草元素伤害加成",
    "FIGHT_PROP_ELEC_ADD_HURT": "雷元素伤害加成",
    "FIGHT_PROP_WIND_ADD_HURT": "风元素伤害加成",
    "FIGHT_PROP_ICE_ADD_HURT": "冰元素伤害加成",
    "FIGHT_PROP_ROCK_ADD_HURT": "岩元素伤害加成",
    "FIGHT_PROP_DENDRO_ADD_HURT": "草元素伤害加成",
}
PCT = {"暴击伤害", "暴击率", "元素充能效率", "治疗加成", "攻击力", "生命值",
       "防御力", "物理伤害加成", "火元素伤害加成", "水元素伤害加成",
       "草元素伤害加成", "雷元素伤害加成", "风元素伤害加成", "冰元素伤害加成", "岩元素伤害加成"}


def cls(iid, rank):
    iid = str(iid)
    if iid == "202":
        return "mora"
    if iid == "104319":
        return "crown"
    if iid.startswith("1041"):
        return "gem"
    if iid.startswith("1043"):
        return "book"
    if iid.startswith("112"):
        return "drop"
    if iid.startswith("113"):
        return "boss"
    if rank == 1:
        return "spec"
    return "other"


def collect(cost_map, items):
    out = {}
    for iid, n in (cost_map or {}).items():
        k = cls(iid, int(items.get(str(iid), {}).get("rank", 0)))
        name = items.get(str(iid), {}).get("name", str(iid))
        out.setdefault(k, []).append([name, n, int(items.get(str(iid), {}).get("rank", 0))])
    for v in out.values():
        v.sort(key=lambda x: x[2])
    return out


chars = {}
for aid, d in raw.items():
    items, promote, star = d["items"], d["promote"], d["rank"]
    name = d["name"]

    # ---- 突破材料 ----
    asc_cost, asc_mora = {}, 0
    for p in promote:
        for iid, n in (p.get("costItems") or {}).items():
            asc_cost[iid] = asc_cost.get(iid, 0) + n
        asc_mora += p.get("coinCost") or 0
    asc = collect(asc_cost, items)

    # ---- 天赋材料：取等级最全的一个技能（2→10）×3 ----
    best, best_len = None, -1
    for k, t in d["talent"].items():
        if len(t["promote"]) > best_len:
            best, best_len = t, len(t["promote"])
    tal_cost, tal_mora = {}, 0
    if best:
        for lv, p in best["promote"].items():
            if int(lv) < 2:
                continue
            for iid, n in (p.get("costItems") or {}).items():
                tal_cost[iid] = tal_cost.get(iid, 0) + n * 3
            tal_mora += (p.get("coinCost") or 0) * 3
    tal = collect(tal_cost, items)

    # ---- 90 级基础面板 ----
    base = {b["propType"]: b["initValue"] for b in d["base"]}
    acc = dict(base)
    for p in promote:
        for k, v in (p.get("addProps") or {}).items():
            acc[k] = acc.get(k, 0) + v
    f = CURVE.get(star, 1.253)
    stat = {
        "hp": round(acc.get("FIGHT_PROP_BASE_HP", 0) / f),
        "atk": round(acc.get("FIGHT_PROP_BASE_ATTACK", 0) / f),
        "def": round(acc.get("FIGHT_PROP_BASE_DEFENSE", 0) / f),
        "l1": [round(base.get("FIGHT_PROP_BASE_HP", 0)), round(base.get("FIGHT_PROP_BASE_ATTACK", 0)),
               round(base.get("FIGHT_PROP_BASE_DEFENSE", 0))],
        "extra": [],
    }
    seen = {}
    for p in promote:
        for k, v in (p.get("addProps") or {}).items():
            if not k.startswith("FIGHT_PROP_BASE"):
                seen[k] = max(seen.get(k, 0), v)
    for k, v in seen.items():
        nm = PROP.get(k, k)
        val = round(v * (100 if nm in PCT else 1), 1)
        stat["extra"].append([nm, val, 1 if nm in PCT else 0])

    chars[name] = {
        "id": aid, "star": star, "el": d["element"], "wp": d["weapon"], "region": d["region"],
        "asc": asc, "ascMora": asc_mora,
        "tal": tal, "talMora": tal_mora,
        "stat": stat, "cons": d["constellation"],
    }

# 旅行者：站点里叫「空 / 荧」，用风主数据占位
for site, yid in (("空", "10000005-anemo"), ("荧", "10000007-anemo")):
    src = chars.get("旅行者")
    if src:
        c = dict(src)
        c["id"] = yid
        chars[site] = c

payload = {
    "updated": "2026-10",
    "exp": {"total": EXP_TOTAL, "hero": BOOK_HERO, "moraLv": MORA_LV},
    "chars": chars,
}
js = "window.AGENT_DATA=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
open(os.path.join(ROOT, "agent-data.js"), "w", encoding="utf-8").write(js)
print("chars", len(chars), "size", len(js) // 1024, "KB")

# 校验
site = json.loads(open(os.path.join(ROOT, "characters.js"), encoding="utf-8").read().split("=", 1)[1].rstrip(";\n"))
names = [x["name"] for x in site["list"]]
miss = [n for n in names if n not in chars]
print("站点角色", len(names), "缺数据", miss)
for nm in ["神里绫华", "雷电将军", "钟离", "香菱", "杜林"]:
    c = chars.get(nm)
    if c:
        print(nm, c["stat"], json.dumps(c["tal"], ensure_ascii=False))
