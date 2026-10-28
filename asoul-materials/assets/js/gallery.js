/* ===========================================================
   素材库：筛选 / 搜索 / 排序 / 视图 / 收藏 / 灯箱
   =========================================================== */
(function () {
  'use strict';
  const S = window.ASOUL;
  const $ = id => document.getElementById(id);

  const state = {
    q: '',
    members: new Set(),
    types: new Set(),
    sets: new Set(),
    sort: 'default',
    view: 'grid',
    onlyFav: false
  };

  let ALL = [];

  /* ---------- 初始化 ---------- */
  (async function init() {
    await S.boot('gallery.html');
    ALL = S.assets;

    readURL();
    buildFilters();
    bindUI();
    apply();

    document.addEventListener('asoul:favchange', () => { if (state.onlyFav) apply(); });

    // 删除 / 移动分类后：重载数据、重建筛选条并刷新网格
    document.addEventListener('asoul:assetschange', async () => {
      await S.loadAssets();
      ALL = S.assets;
      buildFilters();
      apply();
      const st = S.stats();
      const stat = document.getElementById('navStat');
      if (stat) stat.innerHTML = '共 <b>' + st.total + '</b> 项素材';
    });
  })();

  function readURL() {
    const p = new URLSearchParams(location.search);
    if (p.get('member')) state.members.add(p.get('member'));
    if (p.get('type')) state.types.add(p.get('type'));
    if (p.get('set')) state.sets.add(p.get('set'));
    if (p.get('q')) state.q = p.get('q');
    if (p.get('fav') === '1') state.onlyFav = true;
    if (state.q) $('q').value = state.q;
  }

  /* ---------- 筛选条 ---------- */
  function buildFilters() {
    const cntMember = {}, cntType = {}, cntSet = {};
    ALL.forEach(a => {
      cntMember[a.member] = (cntMember[a.member] || 0) + 1;
      cntType[a.type] = (cntType[a.type] || 0) + 1;
      cntSet[a.set] = (cntSet[a.set] || 0) + 1;
    });

    // 成员
    const order = ['bella', 'diana', 'eileen', 'fiona', 'sinuo', 'group'];
    $('memberFilters').innerHTML =
      '<span class="filter-label">成员</span>' +
      order.filter(id => cntMember[id]).map(id => {
        const m = S.member(id);
        return '<button class="fchip" data-k="member" data-v="' + id + '" style="--mc:' + m.color + '">' +
          '<span class="dot"></span>' + m.name +
          '<span class="cnt">' + cntMember[id] + '</span></button>';
      }).join('');

    // 类型
    const tname = { sticker: '表情包', image: '图片', audio: '音频' };
    $('typeFilters').innerHTML =
      '<span class="filter-label">类型</span>' +
      ['sticker', 'image', 'audio'].filter(t => cntType[t]).map(t =>
        '<button class="fchip" data-k="type" data-v="' + t + '" style="--mc:#8AA4FF">' +
        tname[t] + '<span class="cnt">' + cntType[t] + '</span></button>'
      ).join('');

    // 系列（默认只展示前 8 个，其余折叠）
    const sets = Object.keys(cntSet).filter(Boolean).sort((a, b) => cntSet[b] - cntSet[a]);
    const VISIBLE = 8;
    const shown = sets.slice(0, VISIBLE);
    const rest = sets.slice(VISIBLE);
    $('setFilters').innerHTML =
      '<span class="filter-label">系列</span>' +
      shown.map(s => setChip(s, cntSet[s], false)).join('') +
      rest.map(s => setChip(s, cntSet[s], true)).join('') +
      (rest.length
        ? '<button class="fchip more" data-more="1">＋ 展开另外 ' + rest.length + ' 个系列</button>'
        : '');

    document.querySelectorAll('.fchip').forEach(b => {
      const k = b.getAttribute('data-k');
      const v = b.getAttribute('data-v');
      if (!k) return;
      const inSet = k === 'member' ? state.members : k === 'type' ? state.types : state.sets;
      if (inSet.has(v)) b.classList.add('on');
    });

    // 若已选中的系列落在折叠区，自动展开
    if (rest.some(s => state.sets.has(s))) {
      $('filterPanel').classList.add('expanded');
      const m = $('setFilters').querySelector('[data-more]');
      if (m) m.textContent = '－ 收起系列';
    }
  }

  function setChip(s, n, extra) {
    return '<button class="fchip' + (extra ? ' extra' : '') + '" data-k="set" data-v="' + S.esc(s) + '" style="--mc:#7252C0">' +
      S.esc(s) + '<span class="cnt">' + n + '</span></button>';
  }

  function bindUI() {
    $('q').addEventListener('input', S.debounce(e => { state.q = e.target.value.trim(); apply(); }, 200));
    $('sort').addEventListener('change', e => { state.sort = e.target.value; apply(); });
    $('onlyFav').addEventListener('click', () => {
      state.onlyFav = !state.onlyFav;
      apply();
    });
    $('reset').addEventListener('click', () => {
      state.q = ''; state.members.clear(); state.types.clear(); state.sets.clear();
      state.onlyFav = false; state.sort = 'default';
      $('q').value = ''; $('sort').value = 'default';
      document.querySelectorAll('.fchip').forEach(b => b.classList.remove('on'));
      history.replaceState(null, '', location.pathname);
      apply();
    });

    $('viewSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      state.view = b.getAttribute('data-v');
      $('viewSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      apply();
    });

    document.querySelector('.toolbar').addEventListener('click', e => {
      const more = e.target.closest('[data-more]');
      if (more) {
        const panel = $('filterPanel');
        const on = panel.classList.toggle('expanded');
        more.textContent = on ? '－ 收起系列' : '＋ 展开另外 ' + panel.querySelectorAll('.fchip.extra').length + ' 个系列';
        return;
      }
      const chip = e.target.closest('.fchip');
      if (!chip || !chip.getAttribute('data-k')) return;
      const k = chip.getAttribute('data-k');
      const v = chip.getAttribute('data-v');
      const set = k === 'member' ? state.members : k === 'type' ? state.types : state.sets;
      if (set.has(v)) set.delete(v); else set.add(v);
      chip.classList.toggle('on');
      apply();
    });

    const ft = $('filterToggle');
    if (ft) ft.addEventListener('click', () => {
      const on = $('filterPanel').classList.toggle('open');
      ft.textContent = on ? '筛选 ▴' : '筛选 ▾';
    });
  }

  /* ---------- 过滤 + 排序 ---------- */
  function currentList() {
    const q = state.q.toLowerCase();
    let list = ALL.filter(a => {
      if (state.members.size && !state.members.has(a.member)) return false;
      if (state.types.size && !state.types.has(a.type)) return false;
      if (state.sets.size && !state.sets.has(a.set)) return false;
      if (state.onlyFav && !S.isFav(a.id)) return false;
      if (q) {
        const hay = [a.name, a.nameRaw, a.set, a.member, S.member(a.member).name,
                     (a.tags || []).join(' '), a.file].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    if (state.sort === 'name') list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'));
    else if (state.sort === 'member') list.sort((a, b) => a.member.localeCompare(b.member) || String(a.name).localeCompare(String(b.name), 'zh'));
    else if (state.sort === 'size') list.sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
    else if (state.sort === 'pixels') list.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    else list.sort((a, b) => {
      const KEY = { image: 0, sticker: 1, audio: 2 };
      return (KEY[a.type] || 9) - (KEY[b.type] || 9) ||
        a.member.localeCompare(b.member) ||
        String(a.set).localeCompare(String(b.set), 'zh') ||
        String(a.name).localeCompare(String(b.name), 'zh');
    });

    return list;
  }

  let LAST = [];

  function apply() {
    LAST = currentList();
    const grid = $('grid');
    grid.className = 'grid' + (state.view === 'dense' ? ' dense' : state.view === 'big' ? ' big' : '');

    $('cnt').textContent = LAST.length;
    $('onlyFav').classList.toggle('primary', state.onlyFav);
    $('onlyFav').textContent = state.onlyFav ? '★ 正在看收藏' : '☆ 只看收藏';

    const bits = [];
    if (state.members.size) bits.push([...state.members].map(i => S.member(i).name).join(' / '));
    if (state.types.size) bits.push([...state.types].map(t => S.TYPE_NAME[t]).join(' / '));
    if (state.sets.size) bits.push([...state.sets].join(' / '));
    if (state.q) bits.push('“' + state.q + '”');
    $('filterNote').textContent = bits.length ? '· ' + bits.join(' · ') : '';

    if (!LAST.length) {
      $('emptyHost').innerHTML =
        '<div class="empty">' +
        '<div class="ico"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="margin:0 auto"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg></div>' +
        '<h3>没有符合条件的素材</h3>' +
        '<p>试试放宽筛选条件，或换个关键词。也可以到导入后台添加自己的素材。</p></div>';
      grid.innerHTML = '';
      return;
    }
    $('emptyHost').innerHTML = '';

    S.renderBatched(grid, LAST, a => {
      const t = document.createElement('template');
      t.innerHTML = S.cardHTML(a).trim();
      return t.content.firstChild;
    }, 72);
    S.lazyObserve(grid);
    S.bindCardEvents(() => LAST);
    S.hydrateUserCards(grid);
  }
})();
