/* ===========================================================
   A-SOUL 素材站 · 核心逻辑（导航 / 数据 / 存储 / 灯箱 / 工具）
   =========================================================== */
(function () {
  'use strict';

  const S = window.ASOUL = window.ASOUL || {};

  /* ---------- 常量 ---------- */
  S.TYPE_NAME  = { sticker: '表情包', image: '图片', audio: '音频' };
  S.FAV_KEY    = 'asoul.favs.v1';
  S.DB_NAME    = 'asoul-materials';
  S.DB_VER     = 1;
  S.STORE      = 'assets';
  S.BLOB_STORE = 'blobs';

  /* ---------- 基础数据 ---------- */
  const D = (window.ASOUL_DATA || { members: [], assets: [], music: [] });
  S.baseMembers = D.members;
  S.baseAssets  = D.assets;
  S.baseMusic   = D.music;

  S.memberMap = {};
  S.baseMembers.forEach(m => { S.memberMap[m.id] = m; });

  S.member = function (id) {
    return S.memberMap[id] || { id: 'group', name: '未归类', color: '#8AA4FF', en: '' };
  };

  /* ---------- 工具 ---------- */
  S.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  };

  /* 内联 SVG 图标（不依赖 emoji 字体） */
  S.ICON_AUDIO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/></svg>';

  S.bytes = function (n) {
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  };

  S.debounce = function (fn, ms) {
    let t; return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), ms || 220);
    };
  };

  S.toast = function (msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 2000);
  };

  S.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  S.safeName = function (s) {
    return String(s).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80);
  };

  /* ---------- 日间 / 夜间模式 ---------- */
  S.THEME_KEY = 'asoul.theme';
  S.getTheme = function () {
    try { return localStorage.getItem(S.THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  };
  S.applyTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(S.THEME_KEY, t); } catch (e) {}
    const b = document.getElementById('themeBtn');
    if (b) {
      b.textContent = t === 'light' ? '🌙' : '☀️';
      b.title = t === 'light' ? '切换到夜间模式' : '切换到日间模式';
    }
  };
  S.toggleTheme = function () { S.applyTheme(S.getTheme() === 'light' ? 'dark' : 'light'); };

  /* ---------- 用户本地覆盖（隐藏素材 / 移动分类） ----------
     内置素材来自静态 data.js，浏览器无法改文件，
     因此「删除内置素材」= 在本浏览器永久隐藏；
     「移动分类」= 记录覆盖，展示时替换系列名。 */
  S.OVR_KEY = 'asoul.overrides.v1';
  S.overrides = function () {
    try {
      const o = JSON.parse(localStorage.getItem(S.OVR_KEY));
      if (o && Array.isArray(o.hidden) && o.sets) return o;
    } catch (e) {}
    return { hidden: [], sets: {} };
  };
  S.saveOverrides = function (o) {
    try { localStorage.setItem(S.OVR_KEY, JSON.stringify(o)); } catch (e) {}
  };

  /** 删除素材：用户导入的真正删除；内置素材在本浏览器隐藏 */
  S.hideAsset = async function (id) {
    const a = S.assetById(id);
    if (!a) return;
    if (a.user) {
      await S.deleteUserAsset(id);
    } else {
      const o = S.overrides();
      if (o.hidden.indexOf(id) < 0) { o.hidden.push(id); S.saveOverrides(o); }
    }
    S.assets = (S.assets || []).filter(x => x.id !== id);
    document.dispatchEvent(new CustomEvent('asoul:assetschange', { detail: { removed: id } }));
  };

  /** 将素材移动到某个分类（系列），分类可以是新名字 */
  S.moveAsset = function (id, set) {
    const a = S.assetById(id);
    if (!a) return;
    a.set = set;
    const o = S.overrides();
    o.sets[id] = set;
    S.saveOverrides(o);
    document.dispatchEvent(new CustomEvent('asoul:assetschange', { detail: { moved: id, set } }));
  };

  /** 当前所有分类名 → 数量（含覆盖后的结果） */
  S.allSets = function () {
    const s = {};
    (S.assets || S.baseAssets).forEach(a => { if (a.set) s[a.set] = (s[a.set] || 0) + 1; });
    return s;
  };

  /* ---------- 移动分类弹窗 ---------- */
  S.openMoveDialog = function (a) {
    const old = document.getElementById('moveDialog');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'moveDialog';
    el.className = 'modal-mask';
    const sets = Object.keys(S.allSets()).sort((x, y) => String(x).localeCompare(String(y), 'zh'));
    el.innerHTML =
      '<div class="modal">' +
        '<h3>移动分类</h3>' +
        '<p class="modal-sub">「' + S.esc(a.name || a.id) + '」当前分类：<b>' + S.esc(a.set || '未分类') + '</b></p>' +
        '<div class="modal-sets">' +
          sets.map(s => '<button class="fchip" data-set="' + S.esc(s) + '">' + S.esc(s) + '</button>').join('') +
        '</div>' +
        '<input class="modal-input" type="text" id="mvNew" placeholder="或输入新分类名称，如：梗图 / 二创素材">' +
        '<div class="modal-btns">' +
          '<button class="btn sm ghost" id="mvCancel">取消</button>' +
          '<button class="btn sm primary" id="mvOk">确定移动</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    let chosen = '';
    el.addEventListener('click', e => {
      const chip = e.target.closest('[data-set]');
      if (chip) {
        chosen = chip.getAttribute('data-set');
        el.querySelectorAll('[data-set]').forEach(c => c.classList.toggle('on', c === chip));
        el.querySelector('#mvNew').value = '';
        return;
      }
      if (e.target.closest('#mvCancel') || e.target === el) { el.remove(); }
    });
    el.querySelector('#mvNew').addEventListener('input', e => {
      if (e.target.value.trim()) {
        chosen = '';
        el.querySelectorAll('[data-set]').forEach(c => c.classList.remove('on'));
      }
    });
    el.querySelector('#mvOk').addEventListener('click', () => {
      const target = chosen || el.querySelector('#mvNew').value.trim();
      if (!target) { S.toast('请选择一个分类，或输入新分类名称'); return; }
      S.moveAsset(a.id, target);
      el.remove();
      S.toast('已移动到「' + target + '」');
      if (lbEls && lbEls.root.classList.contains('open')) S.renderLightbox();
    });
  };

  /* ---------- 收藏 ---------- */
  S.favs = function () {
    try { return JSON.parse(localStorage.getItem(S.FAV_KEY) || '[]'); } catch (e) { return []; }
  };
  S.isFav = function (id) { return S.favs().indexOf(id) >= 0; };
  S.toggleFav = function (id) {
    let f = S.favs();
    const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    try { localStorage.setItem(S.FAV_KEY, JSON.stringify(f)); } catch (e) {}
    return i < 0;
  };

  /* ---------- 用户导入存储（IndexedDB） ---------- */
  let dbPromise = null;
  S.dbAvailable = false;

  S.openDB = function () {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
      const req = indexedDB.open(S.DB_NAME, S.DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(S.STORE)) db.createObjectStore(S.STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(S.BLOB_STORE)) db.createObjectStore(S.BLOB_STORE);
      };
      req.onsuccess = () => { S.dbAvailable = true; resolve(req.result); };
      req.onerror = () => reject(req.error);
    }).catch(err => { S.dbAvailable = false; throw err; });
    return dbPromise;
  };

  function tx(store, mode, fn) {
    return S.openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const st = t.objectStore(store);
      let out;
      try { out = fn(st); } catch (e) { return reject(e); }
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  S.userAssets = function () {
    return tx(S.STORE, 'readonly', st => st.getAll()).catch(() => []);
  };

  S.userAsset = function (id) {
    return tx(S.STORE, 'readonly', st => st.get(id)).catch(() => null);
  };

  S.putUserAsset = async function (rec, blob) {
    await tx(S.STORE, 'readwrite', st => st.put(rec));
    if (blob) await tx(S.BLOB_STORE, 'readwrite', st => st.put(blob, rec.id));
    return rec;
  };

  S.deleteUserAsset = async function (id) {
    await tx(S.STORE, 'readwrite', st => st.delete(id));
    await tx(BLOB_STORE_SAFE(), 'readwrite', st => st.delete(id));
  };
  function BLOB_STORE_SAFE() { return S.BLOB_STORE; }

  S.getBlob = function (id) {
    return tx(S.BLOB_STORE, 'readonly', st => st.get(id)).catch(() => null);
  };

  /**
   * 取得素材可直接用于 <img src> / <audio src> 的地址。
   * 内置素材走相对路径；用户导入素材走 IndexedDB Blob。
   */
  S.resolveURL = async function (a) {
    if (a.user) {
      const b = await S.getBlob(a.id);
      if (!b) return '';
      return URL.createObjectURL(b);
    }
    return a.file;
  };

  /* ---------- 加载全部素材（内置 + 用户导入） ---------- */
  S.loadAssets = async function () {
    let user = [];
    try { user = await S.userAssets(); } catch (e) { user = []; }
    const ovr = S.overrides();
    S.assets = S.baseAssets.concat(user).filter(a => ovr.hidden.indexOf(a.id) < 0);
    S.assets.forEach(a => { if (ovr.sets[a.id]) a.set = ovr.sets[a.id]; });
    return S.assets;
  };

  S.assetById = function (id) {
    const list = S.assets || S.baseAssets;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return S.baseAssets.filter(a => a.id === id)[0] || null;
  };

  /* ---------- 导航 ---------- */
  const NAV = [
    { href: 'index.html',   label: '首页' },
    { href: 'gallery.html', label: '素材库' },
    { href: 'memes.html',   label: '梗百科' },
    { href: 'audio.html',   label: '音乐' },
    { href: 'import.html',  label: '导入后台' },
    { href: 'about.html',   label: '关于' }
  ];

  S.mountNav = function (current) {
    const host = document.querySelector('[data-nav]');
    if (!host) return;
    host.innerHTML =
      '<div class="nav-inner">' +
        '<a class="brand" href="index.html">' +
          '<span class="brand-mark">AS</span>' +
          '<span class="brand-text">A-SOUL 素材站<small>MATERIAL ARCHIVE</small></span>' +
        '</a>' +
        '<nav class="nav-links" id="navLinks">' +
          NAV.map(n => '<a href="' + n.href + '"' + (n.href === current ? ' class="on"' : '') + '>' + n.label + '</a>').join('') +
        '</nav>' +
        '<div class="nav-spacer"></div>' +
        '<div class="nav-stat" id="navStat"></div>' +
        '<button class="theme-btn" id="themeBtn" title="切换日间/夜间模式">☀️</button>' +
        '<button class="nav-burger" id="navBurger" aria-label="菜单">☰</button>' +
      '</div>';
    const b = document.getElementById('navBurger');
    const l = document.getElementById('navLinks');
    if (b) b.onclick = () => l.classList.toggle('open');
    const tb = document.getElementById('themeBtn');
    if (tb) tb.onclick = S.toggleTheme;
    S.applyTheme(S.getTheme());
  };

  /* ---------- 灯箱 ---------- */
  let lbBuilt = false, lbEls = null;

  function buildLightbox() {
    if (lbBuilt) return;
    const el = document.createElement('div');
    el.className = 'lightbox';
    el.innerHTML =
      '<div class="lb-stage">' +
        '<button class="lb-close" title="关闭 (Esc)">✕</button>' +
        '<button class="lb-nav prev" title="上一张 (←)">‹</button>' +
        '<button class="lb-nav next" title="下一张 (→)">›</button>' +
        '<img id="lbImg" alt="">' +
      '</div>' +
      '<aside class="lb-side">' +
        '<div><div class="lb-member" id="lbMember"><i></i><span></span></div></div>' +
        '<div class="lb-title" id="lbTitle"></div>' +
        '<div class="lb-rows" id="lbRows"></div>' +
        '<div class="lb-actions" id="lbActions"></div>' +
      '</aside>';
    document.body.appendChild(el);
    lbEls = {
      root: el,
      img: el.querySelector('#lbImg'),
      member: el.querySelector('#lbMember'),
      title: el.querySelector('#lbTitle'),
      rows: el.querySelector('#lbRows'),
      actions: el.querySelector('#lbActions')
    };
    el.querySelector('.lb-close').onclick = S.closeLightbox;
    el.querySelector('.lb-nav.prev').onclick = () => S.lbStep(-1);
    el.querySelector('.lb-nav.next').onclick = () => S.lbStep(1);
    el.addEventListener('click', e => { if (e.target === el) S.closeLightbox(); });
    lbBuilt = true;
  }

  S.lbList = [];
  S.lbIndex = 0;

  S.openLightbox = function (list, index) {
    buildLightbox();
    S.lbList = list; S.lbIndex = index;
    lbEls.root.classList.add('open');
    document.body.style.overflow = 'hidden';
    S.renderLightbox();
  };

  S.closeLightbox = function () {
    if (!lbEls) return;
    lbEls.root.classList.remove('open');
    document.body.style.overflow = '';
  };

  S.lbStep = function (d) {
    if (!S.lbList.length) return;
    S.lbIndex = (S.lbIndex + d + S.lbList.length) % S.lbList.length;
    S.renderLightbox();
  };

  S.renderLightbox = async function () {
    const a = S.lbList[S.lbIndex];
    if (!a || !lbEls) return;
    const m = S.member(a.member);
    const url = await S.resolveURL(a);

    lbEls.img.src = url;
    lbEls.img.alt = a.name || '';
    lbEls.member.style.setProperty('--member-color', m.color);
    lbEls.member.querySelector('i').style.background = m.color;
    lbEls.member.querySelector('span').textContent = m.name;
    lbEls.title.textContent = a.name || a.nameRaw || '未命名';

    const rows = [
      ['类型', S.TYPE_NAME[a.type] || a.type],
      ['所属系列', a.set || '—'],
      ['文件名', a.nameRaw || (a.file || '').split('/').pop() || '—'],
      ['格式 / 尺寸',
        (a.ext || '').toUpperCase() +
        (a.w && a.h ? ' · ' + a.w + ' × ' + a.h + 'px' : '')],
      ['体积', S.bytes(a.bytes)],
      ['来源', a.sourceUrl
        ? '<a href="' + S.esc(a.sourceUrl) + '" target="_blank" rel="noopener">' + S.esc(a.source || '来源') + ' ↗</a>'
        : S.esc(a.source || '—')]
    ];
    lbEls.rows.innerHTML = rows.map(r =>
      '<div class="lb-row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'
    ).join('');

    const faved = S.isFav(a.id);
    lbEls.actions.innerHTML =
      '<button class="btn sm" id="lbFav">' + (faved ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '<button class="btn sm" id="lbDl">↓ 下载' + (S.TYPE_NAME[a.type] || '') + '</button>' +
      '<button class="btn sm ghost" id="lbMove">▸ 移动分类</button>' +
      '<button class="btn sm ghost danger" id="lbDel">✕ ' + (a.user ? '删除' : '删除素材') + '</button>' +
      '<button class="btn sm ghost" id="lbCopy">复制文件名</button>' +
      '<button class="btn sm ghost" id="lbNext">下一张 →</button>';

    lbEls.actions.querySelector('#lbFav').onclick = () => {
      const now = S.toggleFav(a.id);
      S.toast(now ? '已加入收藏' : '已移出收藏');
      S.renderLightbox();
      document.dispatchEvent(new CustomEvent('asoul:favchange', { detail: { id: a.id, on: now } }));
    };
    lbEls.actions.querySelector('#lbDl').onclick = () => {
      const fn = (a.nameRaw || a.name || a.id).replace(/[\\/:*?"<>|]+/g, '_');
      const withExt = /\.[a-z0-9]+$/i.test(fn) ? fn : fn + '.' + (a.ext || 'png');
      const el = document.createElement('a');
      el.href = url; el.download = a.user ? withExt : withExt;
      document.body.appendChild(el); el.click(); el.remove();
      S.toast('开始下载：' + withExt);
    };
    lbEls.actions.querySelector('#lbCopy').onclick = () => {
      const t = a.nameRaw || (a.file || '').split('/').pop() || a.id;
      navigator.clipboard && navigator.clipboard.writeText(t).then(
        () => S.toast('已复制：' + t), () => S.toast('复制失败')
      );
    };
    lbEls.actions.querySelector('#lbNext').onclick = () => S.lbStep(1);
    lbEls.actions.querySelector('#lbMove').onclick = () => S.openMoveDialog(a);
    lbEls.actions.querySelector('#lbDel').onclick = async () => {
      const msg = a.user
        ? '确定要删除该素材吗？此操作会真正删除它，无法恢复。'
        : '确定要从素材库删除「' + (a.name || a.id) + '」吗？\n内置素材将在本浏览器中永久隐藏。';
      if (!confirm(msg)) return;
      await S.hideAsset(a.id);
      S.closeLightbox();
      S.toast(a.user ? '已删除该素材' : '已从素材库删除（本浏览器隐藏）');
    };
  };

  document.addEventListener('keydown', e => {
    if (!lbEls || !lbEls.root.classList.contains('open')) return;
    if (e.key === 'Escape') S.closeLightbox();
    else if (e.key === 'ArrowLeft') S.lbStep(-1);
    else if (e.key === 'ArrowRight') S.lbStep(1);
  });

  /* ---------- 懒加载图片 ---------- */
  S.lazyObserve = function (root) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const img = en.target;
        const src = img.getAttribute('data-src');
        if (src) { img.src = src; img.removeAttribute('data-src'); }
        obs.unobserve(img);
      });
    }, { rootMargin: '1200px 0px' });
    (root || document).querySelectorAll('img[data-src]').forEach(i => io.observe(i));
    return io;
  };

  /* ---------- 立即加载（用于首屏少量图片，避免懒加载造成空白） ---------- */
  S.eagerLoad = function (container) {
    (container || document).querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    });
  };

  /* ---------- 批量渲染 ---------- */
  S.renderBatched = function (container, items, makeCard, batch) {
    batch = batch || 60;
    container.innerHTML = '';
    let i = 0;
    function more() {
      const end = Math.min(i + batch, items.length);
      const frag = document.createDocumentFragment();
      for (; i < end; i++) frag.appendChild(makeCard(items[i], i));
      container.appendChild(frag);
      return i < items.length;
    }
    more();
    if (S._sentinel) S._sentinel.disconnect();
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        if (!more()) io.disconnect();
      });
    }, { rootMargin: '600px 0px' });
    const sent = document.createElement('div');
    sent.style.height = '1px';
    container.appendChild(sent);
    io.observe(sent);
    S._sentinel = io;
  };

  S.cardHTML = function (a) {
    const m = S.member(a.member);
    const wide = a.type === 'image' && a.h > a.w * 1.15;
    return '<div class="card' + (wide ? ' wide' : '') + '" data-id="' + a.id + '" style="--mc:' + m.color + '">' +
      '<button class="fav-btn' + (S.isFav(a.id) ? ' on' : '') + '" data-fav="' + a.id + '" title="收藏">' +
        (S.isFav(a.id) ? '★' : '☆') + '</button>' +
      '<button class="fav-btn del-btn" data-del="' + a.id + '" title="' + (a.user ? '删除' : '删除素材') + '">✕</button>' +
      '<span class="card-tag">' + S.esc(m.name) + '</span>' +
      (a.user ? '<span class="card-user">我的</span>' : '') +
      '<div class="card-thumb"><img alt="' + S.esc(a.name) + '" data-src="' + S.esc(a.file) + '"></div>' +
      '<div class="card-info">' +
        '<div class="card-name">' + S.esc(a.baseName || a.name) + '</div>' +
        '<div class="card-sub">' + S.esc(stripMember(a.name)) + '</div>' +
      '</div>' +
    '</div>';
  };

  function stripMember(name) {
    if (!name) return '';
    return String(name).replace(/^[^·]*·\s*/, '').replace(/^[^_]*_\s*/, '');
  }
  S.stripMember = stripMember;

  /* 卡片点击 / 收藏的全局委托 */
  S.bindCardEvents = function (getList) {
    if (S._cardBound) return;
    S._cardBound = true;
    document.addEventListener('click', async e => {
      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        e.stopPropagation();
        const id = delBtn.getAttribute('data-del');
        const a = S.assetById(id);
        const isUser = !!(a && a.user);
        const msg = isUser
          ? '确定要删除该素材吗？此操作会真正删除它，无法恢复。'
          : '确定要从素材库删除该素材吗？\n内置素材将在本浏览器中永久隐藏（可在导入后台恢复）。';
        if (confirm(msg)) {
          await S.hideAsset(id);
          S.toast(isUser ? '已删除该素材' : '已从素材库删除');
        }
        return;
      }
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        e.stopPropagation();
        const id = favBtn.getAttribute('data-fav');
        const on = S.toggleFav(id);
        favBtn.classList.toggle('on', on);
        favBtn.textContent = on ? '★' : '☆';
        S.toast(on ? '已加入收藏' : '已移出收藏');
        document.dispatchEvent(new CustomEvent('asoul:favchange', { detail: { id, on } }));
        return;
      }
      const card = e.target.closest('.card');
      if (card) {
        const list = getList();
        const id = card.getAttribute('data-id');
        const idx = list.findIndex(a => a.id === id);
        if (idx >= 0) S.openLightbox(list, idx);
      }
    });
  };

  /* 用户素材的 Blob URL 需要在网格里异步替换 */
  S.hydrateUserCards = async function (container) {
    const cards = container.querySelectorAll('.card[data-id]');
    for (const c of cards) {
      const a = S.assetById(c.getAttribute('data-id'));
      if (!a || !a.user) continue;
      const img = c.querySelector('img');
      if (!img) continue;
      const url = await S.resolveURL(a);
      if (url) { img.removeAttribute('data-src'); img.src = url; }
    }
  };

  /* ---------- 统计 ---------- */
  S.stats = function () {
    const list = S.assets || S.baseAssets;
    const cnt = {};
    list.forEach(a => { cnt[a.member] = (cnt[a.member] || 0) + 1; });
    return {
      total: list.length,
      sticker: list.filter(a => a.type === 'sticker').length,
      image: list.filter(a => a.type === 'image').length,
      audio: list.filter(a => a.type === 'audio').length,
      music: (S.baseMusic || []).length,
      byMember: cnt
    };
  };

  /* ---------- 启动 ---------- */
  S.boot = async function (current) {
    S.mountNav(current);
    await S.loadAssets();
    const st = S.stats();
    const host = document.getElementById('navStat');
    if (host) host.innerHTML = '共 <b>' + st.total + '</b> 项素材';
    document.dispatchEvent(new CustomEvent('asoul:ready', { detail: st }));
    if (window.lucide) lucide.createIcons();
  };
})();
