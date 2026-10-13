import json, os, datetime

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, 'chars_raw.json')
YATTA = os.path.join(BASE, 'yatta_avatar.json')

chars = json.load(open(RAW, encoding='utf-8'))
yatta = json.load(open(YATTA, encoding='utf-8'))['data']['items']

# icon name -> release timestamp
rel = {}
for k, v in yatta.items():
    ic = v.get('icon')
    if ic and v.get('release'):
        rel[ic] = v['release']
# player icons share names; fix travelers to 1.0
for k, v in yatta.items():
    if v.get('name') == '旅行者' and v.get('release'):
        rel['UI_AvatarIcon_PlayerBoy'] = 1601244000
        rel['UI_AvatarIcon_PlayerGirl'] = 1601244000

# ---- region / affiliation fixes for characters missing a nation ----
FIX = {
    'vesna':      ('至冬', '冬契军'),
    'vodyanitsa': ('至冬', '科洛列夫茨基剧团'),
    'odette':     ('至冬', '科洛列夫茨基剧团'),
    'sandrone':   ('至冬', '愚人众'),
    'alyosha':    ('至冬', '职业猎手'),
    'nicole':     ('魔女会', '魔女会'),
    'zibai':      ('璃月', '璃月港'),
    'skirk':      ('深渊', '寰宇劫灭'),
    'aloy':       ('异界', '游侠'),
    'aether':     ('异界', '旅行者'),
    'lumine':     ('异界', '旅行者'),
    'manekin':    ('千星奇域', '人偶'),
    'manekina':   ('千星奇域', '人偶'),
}
# explicit tail release order (version sequence) for characters newer than the yatta snapshot
TAIL = [
    'manekin', 'manekina', 'lauma', 'aino', 'flins', 'nefer', 'durin', 'jahoda',
    'columbina', 'zibai', 'illuga', 'varka', 'linnea', 'nicole', 'prune', 'lohen',
    'sandrone', 'odette', 'alyosha', 'vesna', 'vodyanitsa',
]
T0 = 1757890800  # 2025-09-08

out = []
for c in chars:
    k = c['key']
    reg, aff = c.get('region') or '', c.get('affiliation') or ''
    if k in FIX:
        reg, aff = FIX[k]
    c['region'], c['affiliation'] = reg, aff
    if c['icon'] in rel:
        c['ts'] = rel[c['icon']]
    elif k in TAIL:
        c['ts'] = T0 + TAIL.index(k) * 3630000
    else:
        c['ts'] = T0
    out.append(c)

# travelers share icon names: force their ids apart
for c in out:
    if c['key'] == 'aether':
        c['ts'] = 1601244000
    if c['key'] == 'lumine':
        c['ts'] = 1601244001

out.sort(key=lambda x: (x['ts'], x['id']))

json.dump(out, open(os.path.join(BASE, 'master.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('total', len(out))
for c in out:
    print(c['name'], c['title'], c['element'], c['weapon'], c['rarity'],
          c['region'], c['affiliation'], c['constellation'], c['birthday'],
          c['substat'], c['icon'], c['gacha'], sep=' | ')
