# -*- coding: utf-8 -*-
"""下载 / 处理全部原神角色素材 -> img/icons, img/art, img/wide"""
import io, json, os, sys
import requests
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 项目根
BUILD = os.path.join(BASE, '_build')
CDN = 'https://enka.network/ui/'

for d in ('icons', 'art', 'wide'):
    os.makedirs(os.path.join(BASE, 'img', d), exist_ok=True)

chars = json.load(open(os.path.join(BUILD, 'master.json'), encoding='utf-8'))

TRAVELER = {'aether': 'PlayerBoy', 'lumine': 'PlayerGirl'}

sess = requests.Session()
sess.headers['User-Agent'] = 'Mozilla/5.0'

fail = []


def fetch(name):
    try:
        r = sess.get(CDN + name + '.png', timeout=60)
        if r.status_code != 200 or len(r.content) < 300:
            return None
        im = Image.open(io.BytesIO(r.content))
        if im.size[0] < 64:          # 占位图
            return None
        return im.convert('RGBA')
    except Exception:
        return None


def square(im, size=160):
    """居中裁剪成正方形后缩放"""
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    return im.resize((size, size), Image.LANCZOS)


def flatten(im, size, bg=(10, 16, 20)):
    """等比缩放后贴到指定画布（保持完整构图）"""
    out = Image.new('RGB', size, bg)
    r = min(size[0] / im.size[0], size[1] / im.size[1])
    nw, nh = max(1, int(im.size[0] * r)), max(1, int(im.size[1] * r))
    im2 = im.resize((nw, nh), Image.LANCZOS)
    out.paste(im2, ((size[0] - nw) // 2, (size[1] - nh) // 2), im2)
    return out


def portrait(im, size=(560, 640)):
    """从 2048x1024 立绘中裁出居中的竖版构图"""
    w, h = im.size
    target = size[0] / size[1]
    cw = int(h * target)
    if cw < w:
        x = (w - cw) // 2
        im = im.crop((x, 0, x + cw, h))
    return flatten(im, size)


def save(im, path, quality):
    im.convert('RGB').save(path, 'WEBP', quality=quality, method=6)


for i, c in enumerate(chars, 1):
    key = c['key']
    icon_src = c.get('icon')
    gacha_src = c.get('gacha')
    if key in TRAVELER:
        gacha_src = 'UI_Gacha_AvatarImg_' + TRAVELER[key]

    # ---------- 头像 ----------
    p = os.path.join(BASE, 'img', 'icons', key + '.webp')
    if not os.path.exists(p):
        im = fetch(icon_src) if icon_src else None
        if im is None:
            fail.append(('icon', key, icon_src))
        else:
            save(square(im), p, 88)

    # ---------- 竖版立绘 ----------
    p = os.path.join(BASE, 'img', 'art', key + '.webp')
    if not os.path.exists(p):
        im = fetch(gacha_src) if gacha_src else None
        if im is None:
            fail.append(('art', key, gacha_src))
        else:
            save(portrait(im), p, 82)

    # ---------- 横版立绘 ----------
    p = os.path.join(BASE, 'img', 'wide', key + '.webp')
    if not os.path.exists(p):
        im = fetch(gacha_src) if gacha_src else None
        if im is None:
            fail.append(('wide', key, gacha_src))
        else:
            save(flatten(im, (1000, 500)), p, 80)

    print('[%3d/%d] %s (%s)' % (i, len(chars), c['name'], key), flush=True)

print('FAILED:', json.dumps(fail, ensure_ascii=False))
