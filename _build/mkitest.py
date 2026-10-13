import re, os

BASE = os.path.dirname(os.path.abspath(__file__)) + os.sep + '..'

VOTE_JS = r"""
window.__R__=[];
function q(s){return document.querySelector(s);}
window.addEventListener('load',function(){
  setTimeout(function(){
    // 1. 选中"钟离"
    var target=null;
    Array.prototype.forEach.call(document.querySelectorAll('.vote-item'),function(el){
      if(el.dataset.id==='zhongli') target=el;
    });
    __R__.push('find_zhongli='+(!!target));
    var before=parseInt(document.getElementById('count-zhongli').textContent,10);
    var radio=target.querySelector('input');
    radio.checked=true;
    radio.dispatchEvent(new Event('change',{bubbles:true}));
    __R__.push('selected_class='+target.classList.contains('selected'));
    __R__.push('myPick='+document.getElementById('myPick').textContent);
    // 2. 提交投票
    document.getElementById('submitBtn').click();
    setTimeout(function(){
      var after=parseInt(document.getElementById('count-zhongli').textContent,10);
      __R__.push('votes '+before+'->'+after);
      __R__.push('modal_show='+document.getElementById('modalMask').classList.contains('show'));
      __R__.push('modal_title='+document.getElementById('mTitle').textContent);
      // 3. 筛选：只留岩元素
      var sel=document.getElementById('fElement');
      sel.value='岩'; sel.dispatchEvent(new Event('change',{bubbles:true}));
      setTimeout(function(){
        __R__.push('after_filter_items='+document.querySelectorAll('.vote-item').length);
        __R__.push('rank_rows='+document.querySelectorAll('.rank-row').length);
        __R__.push('rank1='+document.querySelector('.rank-row .rr-name').textContent);
        // 4. 重置
        document.getElementById('modalMask').classList.remove('show');
        document.getElementById('resetBtn').click();
        setTimeout(function(){
          var btns=document.getElementById('mBtns').querySelectorAll('button');
          __R__.push('reset_btns='+btns.length);
          btns[0].click();  // 确认重置
          setTimeout(function(){
            __R__.push('after_reset_zhongli_votes='+document.querySelectorAll('.vote-item').length);
            __R__.push('total='+document.getElementById('totalVotes').textContent);
            finish();
          },300);
        },300);
      },200);
    },300);
  },1200);
});
function finish(){
  var d=document.createElement('div');d.id='RB';
  d.textContent='RESU'+'LT__'+window.__R__.join(' || ');
  document.body.appendChild(d);
}
"""

DETAIL_JS = r"""
window.__R__=[];
window.addEventListener('load',function(){
  setTimeout(function(){
    __R__.push('cards='+document.querySelectorAll('.card').length);
    // 筛选：岩元素
    var chips=document.querySelectorAll('#fElement .chip');
    Array.prototype.forEach.call(chips,function(c){ if(c.dataset.v==='岩') c.click(); });
    __R__.push('rock_cards='+document.querySelectorAll('.card').length);
    __R__.push('count='+document.getElementById('hCount').textContent);
    // 搜索
    var q=document.getElementById('q');
    q.value='钟离'; q.dispatchEvent(new Event('input',{bubbles:true}));
    __R__.push('search_zhongli='+document.querySelectorAll('.card').length);
    // 打开第一位
    document.querySelector('.card').click();
    setTimeout(function(){
      __R__.push('drawer_open='+document.getElementById('drawer').classList.contains('show'));
      __R__.push('dname='+document.getElementById('dName').textContent);
      __R__.push('story_len='+document.getElementById('dStory').textContent.length);
      __R__.push('hl='+document.getElementById('dHighlights').children.length);
      __R__.push('badges='+document.getElementById('dBadges').children.length);
      __R__.push('copybtn='+!!document.getElementById('copyBtn'));
      document.getElementById('nextBtn').click();
      setTimeout(function(){
        __R__.push('next_name='+document.getElementById('dName').textContent);
        document.getElementById('favBtn').click();
        setTimeout(function(){
          __R__.push('fav_txt='+document.getElementById('favBtn').textContent.trim());
          __R__.push('favchip='+document.getElementById('favOnly').textContent);
          finish();
        },250);
      },250);
    },400);
  },1000);
});
function finish(){
  var d=document.createElement('div');d.id='RB';
  d.textContent='RESU'+'LT__'+window.__R__.join(' || ');
  document.body.appendChild(d);
}
"""

for f, js in (('vote', VOTE_JS), ('detail', DETAIL_JS)):
    h = open(os.path.join(BASE, f + '.html'), encoding='utf-8').read()
    assert len(re.findall(r'</body>', h, re.I)) == 1
    h = h.replace('</head>', '<style>*{transition:none!important;animation:none!important}</style></head>', 1)
    h = h.replace('</body>', '<script>' + js.replace('</', '<\\/') + '</script>\n</body>')
    open(os.path.join(BASE, '_it_' + f + '.html'), 'w', encoding='utf-8').write(h)
    print('written', f)
