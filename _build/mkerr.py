import re, os

BASE = os.path.dirname(os.path.abspath(__file__)) + os.sep + '..'
PROBE = re.compile(r'</body>', re.I)

JS = r"""
window.__E__=[];
window.onerror=function(m,s,l,c){window.__E__.push(m+" @"+l+":"+c);};
window.addEventListener("unhandledrejection",function(e){window.__E__.push("rej:"+e.reason);});
window.addEventListener("load",function(){setTimeout(function(){
  var eb=document.getElementById("EB");
  eb.textContent="RESU"+"LT_ERR="+window.__E__.length+(window.__E__.length?(" :: "+window.__E__.join(" | ")):" ALL_OK");
},2500);});
"""

INJECT = ('<div id="EB" style="position:fixed;left:8px;bottom:8px;z-index:9999;'
          'background:#000;color:#0f0;font:13px monospace;padding:6px 10px">waiting</div>'
          '<script>' + JS.replace('</', '<\\/') + '</script>')

for f in ('index', 'detail', 'vote'):
    h = open(os.path.join(BASE, f + '.html'), encoding='utf-8').read()
    n = len(PROBE.findall(h))
    assert n == 1, (f, n)
    h = h.replace('</head>',
                  '<style>*{transition:none!important;animation:none!important}</style></head>', 1)
    h = h.replace('</body>', INJECT + '\n</body>')
    out = os.path.join(BASE, '_err_' + f + '.html')
    open(out, 'w', encoding='utf-8').write(h)
    print('written', out)
