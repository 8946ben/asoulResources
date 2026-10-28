/* ===========================================================
   音乐页：曲目索引 + 本地音频库
   =========================================================== */
(function () {
  'use strict';
  const S = window.ASOUL;
  const $ = id => document.getElementById(id);

  const CATS = ['全部', '团曲', '个人曲', '专辑曲', '联动曲'];
  let cat = '全部';
  let q = '';

  (async function init() {
    await S.boot('audio.html');
    buildCats();
    renderSongs();
    await renderMyAudio();
    bind();
  })();

  /* ---------- 曲目索引 ---------- */
  function buildCats() {
    const cnt = {};
    S.baseMusic.forEach(m => { cnt[m.cat] = (cnt[m.cat] || 0) + 1; });
    $('cats').innerHTML = CATS.map(c => {
      const n = c === '全部' ? S.baseMusic.length : (cnt[c] || 0);
      return '<button class="fchip' + (c === cat ? ' on' : '') + '" data-cat="' + c + '" style="--mc:#C93773">' +
        c + '<span class="cnt">' + n + '</span></button>';
    }).join('');
  }

  function renderSongs() {
    let list = S.baseMusic.filter(m => cat === '全部' || m.cat === cat);
    if (q) {
      const k = q.toLowerCase();
      list = list.filter(m => (m.name + ' ' + m.note + ' ' + m.members.map(i => S.member(i).name).join(' ')).toLowerCase().indexOf(k) >= 0);
    }

    if (!list.length) {
      $('songList').innerHTML = '';
      $('songEmpty').innerHTML = '<div class="empty">' +
        '<div class="ico"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/></svg></div>' +
        '<h3>没有匹配的曲目</h3><p>换个关键词试试。</p></div>';
      return;
    }
    $('songEmpty').innerHTML = '';

    $('songList').innerHTML = list.map((m, i) => {
      const main = S.member(m.members[0]);
      const dots = m.members.map(id =>
        '<i style="background:' + S.member(id).color + '" title="' + S.member(id).name + '"></i>').join('');
      const names = m.members.map(id => S.member(id).name).join(' × ');
      return '<div class="song" style="--mc:' + main.color + '">' +
        '<span class="song-cat" style="background:' + main.color + '"></span>' +
        '<div class="song-idx">' + (i + 1) + '</div>' +
        '<div>' +
          '<div class="song-name">' + S.esc(m.name) + '</div>' +
          '<div class="song-meta">' +
            '<span class="chip">' + m.cat + '</span>' +
            '<span class="song-dots">' + dots + '</span>' +
            '<span>' + S.esc(names) + '</span>' +
            '<span>·</span><span>' + S.esc(m.date) + '</span>' +
            '<span>·</span><span>' + S.esc(m.note) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="song-actions">' +
          '<a class="btn sm" href="' + m.biliSearch + '" target="_blank" rel="noopener">B站 ↗</a>' +
          '<a class="btn sm ghost" href="' + m.music163 + '" target="_blank" rel="noopener">网易云 ↗</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------- 我的音频库 ---------- */
  async function myAudioList() {
    const all = await S.userAssets();
    return all.filter(a => a.type === 'audio');
  }

  async function renderMyAudio() {
    const list = await myAudioList();
    const host = $('myAudio');
    if (!list.length) {
      host.innerHTML = '';
      $('myAudioEmpty').style.display = '';
      return;
    }
    $('myAudioEmpty').style.display = 'none';

    let html = '';
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const m = S.member(a.member);
      const url = await S.resolveURL(a);
      html += '<div class="song" style="--mc:' + m.color + '" data-audio="' + a.id + '">' +
        '<span class="song-cat" style="background:' + m.color + '"></span>' +
        '<div class="song-idx">' + (i + 1) + '</div>' +
        '<div>' +
          '<div class="song-name">' + S.esc(a.name) + '</div>' +
          '<div class="song-meta">' +
            '<span class="chip">' + S.esc(m.name) + '</span>' +
            '<span>' + S.bytes(a.bytes) + '</span>' +
            (a.duration ? '<span>·</span><span>' + fmtDur(a.duration) + '</span>' : '') +
            (a.note ? '<span>·</span><span>' + S.esc(a.note) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="song-actions">' +
          '<button class="btn sm" data-play="' + a.id + '">▶ 播放</button>' +
          '<a class="btn sm ghost" href="' + url + '" download="' + S.esc(a.nameRaw || a.name) + '">↓ 导出</a>' +
          '<button class="btn sm ghost" data-del="' + a.id + '">删除</button>' +
        '</div>' +
      '</div>';
    }
    host.innerHTML = html;
  }

  function fmtDur(s) {
    s = Math.round(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* ---------- 播放 ---------- */
  let curURL = null;
  async function play(id) {
    const a = await S.userAsset(id);
    if (!a) return S.toast('找不到该音频');
    const url = await S.resolveURL(a);
    if (!url) return S.toast('音频数据读取失败');
    if (curURL) URL.revokeObjectURL(curURL);
    curURL = url;
    $('playerBar').classList.add('on');
    $('playerName').textContent = a.name + ' · ' + S.member(a.member).name;
    const p = $('player');
    p.src = url;
    p.play().catch(() => S.toast('浏览器阻止了自动播放，请手动点击播放键'));
    document.body.style.paddingBottom = '84px';
  }

  /* ---------- 导入 ---------- */
  function pickFiles() { $('audioInput').click(); }

  $('audioInput').addEventListener('change', async e => {
    const files = [...e.target.files];
    if (!files.length) return;
    e.target.value = '';
    let n = 0;
    for (const f of files) {
      const dur = await probeDuration(f).catch(() => 0);
      const id = 'my-audio-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      const base = f.name.replace(/\.[^.]+$/, '');
      const member = guessMember(base);
      await S.putUserAsset({
        id, type: 'audio', user: true, member,
        set: '我的音频库',
        name: base,
        nameRaw: f.name,
        file: '',
        ext: (f.name.split('.').pop() || '').toLowerCase(),
        bytes: f.size,
        w: 0, h: 0, duration: dur,
        tags: ['音频', '我的导入'],
        source: '本地导入',
        note: '由用户在浏览器内导入'
      }, f);
      n++;
    }
    await S.loadAssets();
    await renderMyAudio();
    S.toast('已导入 ' + n + ' 个音频文件');
  });

  function probeDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const au = document.createElement('audio');
      au.preload = 'metadata';
      au.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(au.duration || 0); };
      au.onerror = () => { URL.revokeObjectURL(url); reject(); };
      au.src = url;
    });
  }

  function guessMember(name) {
    const rules = [
      [/贝拉|bella|拉姐/i, 'bella'],
      [/嘉然|diana|然比|然然/i, 'diana'],
      [/乃琳|eileen|小林|乃宝/i, 'eileen'],
      [/心宜|fiona/i, 'fiona'],
      [/思诺|gladys|snow/i, 'sinuo']
    ];
    for (const [re, id] of rules) if (re.test(name)) return id;
    return 'group';
  }

  /* ---------- 事件 ---------- */
  function bind() {
    $('cats').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      cat = b.getAttribute('data-cat');
      $('cats').querySelectorAll('.fchip').forEach(x => x.classList.toggle('on', x === b));
      renderSongs();
    });

    $('mq').addEventListener('input', S.debounce(e => { q = e.target.value.trim(); renderSongs(); }, 180));

    $('audioPick').addEventListener('click', pickFiles);

    $('myAudio').addEventListener('click', async e => {
      const playBtn = e.target.closest('[data-play]');
      if (playBtn) return play(playBtn.getAttribute('data-play'));

      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        const id = delBtn.getAttribute('data-del');
        if (!confirm('确定要从本地音频库中删除这个文件吗？')) return;
        await S.deleteUserAsset(id);
        await S.loadAssets();
        await renderMyAudio();
        S.toast('已删除');
        return;
      }
      const row = e.target.closest('[data-audio]');
      if (row) play(row.getAttribute('data-audio'));
    });

    $('playerClose').addEventListener('click', () => {
      $('player').pause();
      $('playerBar').classList.remove('on');
      document.body.style.paddingBottom = '';
    });
  }
})();
