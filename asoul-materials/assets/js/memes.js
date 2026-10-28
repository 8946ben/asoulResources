/* ===========================================================
   枝江梗百科：时间线渲染 / 成员筛选 / 搜索
   =========================================================== */
(function () {
  'use strict';
  const S = window.ASOUL;
  const $ = id => document.getElementById(id);

  const DATA = (window.ASOUL_MEMES || []).slice().sort((a, b) =>
    String(a.date).localeCompare(String(b.date)));

  const state = { member: '', q: '' };

  (async function init() {
    await S.boot('memes.html');
    buildFilters();
    bindUI();
    apply();
  })();

  function buildFilters() {
    const cnt = {};
    DATA.forEach(m => { cnt[m.member] = (cnt[m.member] || 0) + 1; });
    const order = ['bella', 'diana', 'eileen', 'fiona', 'sinuo', 'group'];
    $('memberFilters').innerHTML =
      '<span class="filter-label">成员</span>' +
      order.filter(id => cnt[id]).map(id => {
        const m = S.member(id);
        return '<button class="fchip" data-v="' + id + '" style="--mc:' + m.color + '">' +
          '<span class="dot"></span>' + m.name +
          '<span class="cnt">' + cnt[id] + '</span></button>';
      }).join('');
    document.querySelectorAll('#memberFilters .fchip').forEach(b => {
      if (b.getAttribute('data-v') === state.member) b.classList.add('on');
    });
  }

  function bindUI() {
    $('q').addEventListener('input', S.debounce(e => { state.q = e.target.value.trim(); apply(); }, 200));
    $('memberFilters').addEventListener('click', e => {
      const chip = e.target.closest('.fchip');
      if (!chip) return;
      const v = chip.getAttribute('data-v');
      if (state.member === v) { state.member = ''; chip.classList.remove('on'); }
      else {
        state.member = v;
        document.querySelectorAll('#memberFilters .fchip').forEach(c => c.classList.toggle('on', c === chip));
      }
      apply();
    });
  }

  function currentList() {
    const q = state.q.toLowerCase();
    return DATA.filter(m => {
      if (state.member && m.member !== state.member) return false;
      if (q) {
        const hay = [m.title, (m.aliases || []).join(' '), m.origin, m.meaning, m.usage,
                     S.member(m.member).name].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function dateText(d) {
    const m = /^(\d{4})-(\d{2})/.exec(d);
    if (!m) return d;
    return m[1] + ' 年 ' + parseInt(m[2], 10) + ' 月';
  }

  function itemHTML(m) {
    const mem = S.member(m.member);
    return '<div class="tl-item" style="--mc:' + mem.color + '">' +
      '<div class="tl-dot"></div>' +
      '<div class="tl-card">' +
        '<div class="tl-head">' +
          '<span class="tl-date">' + S.esc(dateText(m.date)) + '</span>' +
          '<span class="tl-member" style="color:' + mem.color + '">' + mem.name + '</span>' +
          (!m.verified ? '<span class="tl-unverified" title="出处细节未完全考证，欢迎在导入后台修正">待考证</span>' : '') +
        '</div>' +
        '<h3 class="tl-title">' + S.esc(m.title) + '</h3>' +
        ((m.aliases || []).length ? '<div class="tl-aliases">又叫：' + m.aliases.map(S.esc).join(' / ') + '</div>' : '') +
        '<div class="tl-row"><span class="k">出处</span><p class="v">' + S.esc(m.origin) + '</p></div>' +
        '<div class="tl-row"><span class="k">含义</span><p class="v">' + S.esc(m.meaning) + '</p></div>' +
        '<div class="tl-row"><span class="k">用法</span><p class="v">' + S.esc(m.usage) + '</p></div>' +
      '</div>' +
    '</div>';
  }

  function groupByMonth(list) {
    return list; // 已按 date 排序，直接顺序渲染
  }

  function apply() {
    const list = groupByMonth(currentList());
    $('cnt').textContent = list.length;
    $('timeline').innerHTML = list.map(itemHTML).join('');
    $('emptyHost').innerHTML = list.length
      ? ''
      : '<div class="empty"><h3>没有符合条件的梗</h3><p>换个关键词，或放宽成员筛选试试。</p></div>';
  }
})();
