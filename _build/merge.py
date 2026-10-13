# -*- coding: utf-8 -*-
"""合并基础数据 + 撰写的图文内容 -> 项目根目录 characters.js"""
import json, os, importlib.util, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(BASE, '_build')

master = json.load(open(os.path.join(BUILD, 'master.json'), encoding='utf-8'))

CONTENT = {}
for i in range(1, 6):
    spec = importlib.util.spec_from_file_location('c%d' % i, os.path.join(BUILD, 'c%d.py' % i))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    for row in m.C:
        if len(row) != 5:
            print('!! 字段数不对:', row[0], len(row))
            sys.exit(1)
        k, tags, story, hl, extra = row
        if k in CONTENT:
            print('!! 重复 key:', k)
        CONTENT[k] = dict(tags=tags, story=story, hl=hl, extra=extra)

missing = [c['key'] for c in master if c['key'] not in CONTENT]
extra = [k for k in CONTENT if k not in {c['key'] for c in master}]
print('master %d / content %d' % (len(master), len(CONTENT)))
print('缺内容:', missing)
print('多余内容:', extra)

ELEM_COLOR = {
    '风': '#74c2a8', '岩': '#d3b45f', '雷': '#b088d8', '草': '#7ec26a',
    '水': '#4cc2f1', '火': '#ef7938', '冰': '#9fd6e3', '无': '#cfc6b4',
}

# 初始人气值：高知名度角色给出更自然的历史票数，其余按稳定哈希生成
POP = {
    'zhongli': 96, 'raidenshogun': 95, 'furina': 94, 'hutao': 93, 'ganyu': 90,
    'neuvillette': 90, 'nahida': 89, 'xiao': 88, 'mavuika': 88, 'kamisatoayaka': 87,
    'arlecchino': 87, 'venti': 86, 'yelan': 86, 'kaedeharakazuha': 85, 'yaemiko': 85,
    'tartaglia': 84, 'klee': 83, 'keqing': 83, 'columbina': 83, 'kamisatoayato': 82,
    'xingqiu': 82, 'bennett': 81, 'xiangling': 80, 'shenhe': 80, 'diluc': 80,
    'eula': 79, 'mona': 79, 'wriothesley': 79, 'wanderer': 78, 'clorinde': 78,
    'nilou': 78, 'dehya': 77, 'alhaitham': 77, 'kaeya': 77, 'chongyun': 76,
    'layla': 76, 'qiqi': 76, 'fischl': 75, 'barbara': 75, 'noelle': 75,
    'xilonen': 75, 'citlali': 74, 'mualani': 74, 'kinich': 74, 'navia': 74,
    'sigewinne': 73, 'skirk': 73, 'vesna': 72, 'vodyanitsa': 72, 'sandrone': 72,
    'varka': 72, 'durin': 72, 'nefer': 71, 'linnea': 70, 'nicole': 70,
    'lohen': 70, 'odette': 70, 'lauma': 71, 'collei': 69, 'tighnari': 69,
}


def base_pop(c):
    if c['key'] in POP and POP[c['key']] > 0:
        return POP[c['key']]
    h = 0
    for ch in (c['key'] + c['name']):
        h = (h * 31 + ord(ch)) % 100003
    if c['rarity'] == 5:
        return 40 + h % 39          # 40 - 78
    return 17 + h % 42              # 17 - 58


out = []
for i, c in enumerate(master):
    ct = CONTENT.get(c['key'], {})
    out.append({
        'id': c['key'],
        'name': c['name'],
        'title': c['title'] or '旅人',
        'el': c['element'],
        'color': ELEM_COLOR.get(c['element'], '#d3bc8e'),
        'weapon': c['weapon'],
        'star': c['rarity'],
        'pop': base_pop(c),
        'region': c['region'] or '提瓦特',
        'faction': c['affiliation'] if c['affiliation'] not in ('', '无', '——') else '无归属',
        'con': c['constellation'] if c['constellation'] not in ('', '——') else '未公开',
        'bd': c['birthday'] or '未公开',
        'sub': c['substat'] or '—',
        'quote': c['desc'],
        'tags': ct.get('tags', []),
        'story': ct.get('story', ''),
        'hl': ct.get('hl', []),
        'extra': ct.get('extra', ''),
        'icon': 'img/icons/%s.webp' % c['key'],
        'art': 'img/art/%s.webp' % c['key'],
        'wide': 'img/wide/%s.webp' % c['key'],
    })

regions = []
for c in out:
    if c['region'] not in regions:
        regions.append(c['region'])
order = ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '挪德卡莱', '至冬', '异界', '千星奇域', '深渊', '魔女会']
regions = [r for r in order if r in regions] + [r for r in regions if r not in order]

js = 'window.GENSHIN = ' + json.dumps({
    'count': len(out),
    'elements': [e for e in ['风', '岩', '雷', '草', '水', '火', '冰', '无'] if e in {c['el'] for c in out}],
    'weapons': [w for w in ['单手剑', '双手剑', '长柄武器', '法器', '弓'] if w in {c['weapon'] for c in out}],
    'regions': regions,
    'color': ELEM_COLOR,
    'list': out,
}, ensure_ascii=False, separators=(',', ':')) + ';\n'

path = os.path.join(BASE, 'characters.js')
open(path, 'w', encoding='utf-8').write(js)
print('写出', path, len(js), '字节')
print('国度:', regions)
