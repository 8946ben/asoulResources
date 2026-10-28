/* ===========================================================
   导入后台：拖拽解析 / 批量编辑 / IndexedDB 持久化 / 导出
   =========================================================== */
(function () {
  'use strict';
  const S = window.ASOUL;
  const $ = id => document.getElementById(id);

  /** 待保存队列 */
  let staged = [];
  let seq = 0;

  const GUESS = [
    [/贝拉|bella|拉姐|贝极星/i, 'bella'],
    [/嘉然|diana|然比|然然|嘉心糖/i, 'diana'],
    [/乃琳|eileen|乃琳queen|奶淇琳|乃0/i, 'eileen'],
    [/心宜|fiona|心球仪|小海豹/i, 'fiona'],
    [/思诺|gladys|sinuo|小海诺|枝江邓紫棋/i, 'sinuo'],
    [/阿草|acao|a-soul|asoul|团体|枝江/i, 'group']
  ];

  const STICKER_HINT = /(表情|emoji|sticker|装扮|舰长|大航海|meme|阿草|草)/i;

  (async function init() {
    await S.boot('import.html');

    // 成员下拉选项
    const opts = S.baseMembers.map(m => '<option value="' + m.id + '">' + m.name + '</option>').join('');
    $('bMember').innerHTML = '<option value="">设置成员为…</option>' + opts;

    if (location.protocol === 'file:') {
      $('dbWarn').innerHTML = '<div class="note warn mt-20"><b>检测到你是双击打开的页面（file:// 协议）。</b>' +
        '浏览器在这种模式下通常会禁用 IndexedDB，导致「保存到本地素材库」不可用。' +
        '请改用随站点附带的启动脚本（<span class="mono">start.sh</span> / <span class="mono">start.bat</span>）以本地服务方式打开，功能即可完整使用。</div>';
    }

    bindDrop();
    bindBatch();
    bindExport();
    bindHidden();
    await renderMine();
    renderHidden();
  })();

  /* ---------- 隐藏 / 移动分类的覆盖 ---------- */
  /** 按本地覆盖处理一份素材列表：剔除已删除的，替换分类 */
  function overridden(list) {
    const o = S.overrides();
    return list
      .filter(a => o.hidden.indexOf(a.id) < 0)
      .map(a => {
        const c = Object.assign({}, a);
        if (o.sets[a.id]) c.set = o.sets[a.id];
        return c;
      });
  }

  function bindHidden() {
    $('hiddenList').addEventListener('click', async e => {
      const btn = e.target.closest('[data-restore]');
      if (!btn) return;
      const id = btn.getAttribute('data-restore');
      const o = S.overrides();
      o.hidden = o.hidden.filter(x => x !== id);
      S.saveOverrides(o);
      await S.loadAssets();
      renderHidden();
      S.toast('已恢复该素材');
    });

    $('clearHidden').addEventListener('click', async () => {
      const o = S.overrides();
      if (!o.hidden.length) return S.toast('当前没有删除过内置素材');
      if (!confirm('恢复全部 ' + o.hidden.length + ' 个已删除的内置素材？')) return;
      o.hidden = [];
      S.saveOverrides(o);
      await S.loadAssets();
      renderHidden();
      S.toast('已全部恢复');
    });

    $('expHidden').addEventListener('click', () => {
      const o = S.overrides();
      if (!o.hidden.length) return S.toast('当前没有删除过内置素材');
      S.download('hidden-assets.json', JSON.stringify({ hidden: o.hidden, sets: o.sets }, null, 1));
      S.toast('已导出隐藏清单');
    });
  }

  function renderHidden() {
    const o = S.overrides();
    const host = $('hiddenList');
    if (!o.hidden.length) {
      host.innerHTML = '<div class="text-dim">当前没有删除任何内置素材。</div>';
      return;
    }
    host.innerHTML = o.hidden.map(id => {
      const a = S.assetById(id);
      const name = a ? (a.name || a.id) : id;
      return '<span class="fchip" style="cursor:default;margin:0 6px 6px 0">' + S.esc(name) +
        '<button class="hid-restore" data-restore="' + S.esc(id) + '" title="恢复该素材">↩ 恢复</button></span>';
    }).join('') +
    '<div class="text-dim mt-8" style="font-size:12px">这些素材只是在本浏览器中被隐藏；点「导出 data.js」并覆盖站点文件后才会彻底删除。</div>';
  }

  /* ---------- 拖拽 / 选择 ---------- */
  function bindDrop() {
    const drop = $('drop');
    const input = $('fileInput');

    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      handleFiles([...e.dataTransfer.files]);
    });
    input.addEventListener('change', e => {
      handleFiles([...e.target.files]);
      e.target.value = '';
    });

    // 粘贴图片
    document.addEventListener('paste', e => {
      const items = [...(e.clipboardData ? e.clipboardData.items : [])];
      const files = items.filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
      if (files.length) { e.preventDefault(); handleFiles(files); }
    });
  }

  async function handleFiles(files) {
    if (!files.length) return;
    const ok = files.filter(f => /^image\//.test(f.type) || /^audio\//.test(f.type) || /\.(png|jpe?g|gif|webp|mp3|wav|flac|m4a|ogg)$/i.test(f.name));
    const skipped = files.length - ok.length;

    const newOnes = [];
    for (const f of ok) {
      const rec = await analyze(f);
      newOnes.push(rec);
    }
    staged = staged.concat(newOnes);
    renderStaged();
    $('stage').classList.remove('hidden');
    S.toast('已加入 ' + newOnes.length + ' 个文件' + (skipped ? '，忽略 ' + skipped + ' 个不支持的文件' : ''));
  }

  async function analyze(file) {
    const isImg = /^image\//.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
    const base = file.name.replace(/\.[^.]+$/, '');
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    let member = 'group';
    for (const [re, id] of GUESS) if (re.test(base)) { member = id; break; }

    let type = isImg ? (STICKER_HINT.test(base) ? 'sticker' : 'image') : 'audio';

    let w = 0, h = 0, duration = 0;
    if (isImg) {
      const d = await imgSize(file).catch(() => ({ w: 0, h: 0 }));
      w = d.w; h = d.h;
    } else {
      duration = await probeDuration(file).catch(() => 0);
    }

    return {
      _key: 'stage-' + (++seq),
      _file: file,
      _url: URL.createObjectURL(file),
      id: 'my-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      type, member, user: true,
      set: isImg ? '我的图片素材' : '我的音频库',
      name: base,
      nameRaw: file.name,
      ext, bytes: file.size, w, h, duration: Math.round(duration || 0),
      tags: [type === 'sticker' ? '表情包' : type === 'image' ? '图片' : '音频', '我的导入'],
      source: '本地导入',
      note: ''
    };
  }

  function imgSize(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve({ w: im.naturalWidth, h: im.naturalHeight }); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(); };
      im.src = url;
    });
  }

  function probeDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const au = document.createElement('audio');
      au.preload = 'metadata';
      au.onloadedmetadata = () => { const d = au.duration || 0; URL.revokeObjectURL(url); resolve(d); };
      au.onerror = () => { URL.revokeObjectURL(url); reject(); };
      au.src = url;
    });
  }

  /* ---------- 表格渲染 ---------- */
  function renderStaged() {
    const host = $('rows');
    const memOpts = S.baseMembers
      .map(m => '<option value="' + m.id + '">' + m.name + '</option>').join('');
    const typeOpts = [['sticker', '表情包'], ['image', '图片'], ['audio', '音频']]
      .map(t => '<option value="' + t[0] + '">' + t[1] + '</option>').join('');

    host.innerHTML = staged.map(r => {
      const thumb = r.type === 'audio'
        ? '<div class="imp-thumb" style="display:grid;place-items:center">' + S.ICON_AUDIO + '</div>'
        : '<img class="imp-thumb" src="' + r._url + '" alt="">';
      return '<tr data-key="' + r._key + '">' +
        '<td><input type="checkbox" class="rowchk"></td>' +
        '<td>' + thumb + '</td>' +
        '<td><input type="text" data-f="name" value="' + S.esc(r.name) + '"></td>' +
        '<td><select data-f="member">' + memOpts + '</select></td>' +
        '<td><select data-f="type">' + typeOpts + '</select></td>' +
        '<td><input type="text" data-f="tags" value="' + S.esc((r.tags || []).join(', ')) + '"></td>' +
        '<td class="mono text-dim">' + S.bytes(r.bytes) + '</td>' +
      '</tr>';
    }).join('');

    staged.forEach((r, i) => {
      const tr = host.children[i];
      tr.querySelector('[data-f="member"]').value = r.member;
      tr.querySelector('[data-f="type"]').value = r.type;
      tr.querySelectorAll('[data-f]').forEach(el => {
        el.addEventListener('input', () => {
          const f = el.getAttribute('data-f');
          if (f === 'tags') r.tags = el.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
          else r[f] = el.value;
        });
      });
    });

    $('pendingNote').textContent = '待保存 ' + staged.length + ' 项';
  }

  /* ---------- 批量 ---------- */
  function selectedKeys() {
    return [...document.querySelectorAll('#rows tr')]
      .filter(tr => tr.querySelector('.rowchk').checked)
      .map(tr => tr.getAttribute('data-key'));
  }

  function bindBatch() {
    $('chkAll').addEventListener('change', e => {
      document.querySelectorAll('.rowchk').forEach(c => { c.checked = e.target.checked; });
    });
    $('selAll').addEventListener('click', () => document.querySelectorAll('.rowchk').forEach(c => { c.checked = true; }));
    $('selNone').addEventListener('click', () => document.querySelectorAll('.rowchk').forEach(c => { c.checked = false; }));

    $('bMember').addEventListener('change', e => {
      const v = e.target.value; if (!v) return;
      const keys = selectedKeys();
      const target = keys.length ? staged.filter(r => keys.includes(r._key)) : staged;
      target.forEach(r => { r.member = v; });
      renderStaged(); e.target.value = '';
      S.toast('已更新 ' + target.length + ' 项成员');
    });

    $('bType').addEventListener('change', e => {
      const v = e.target.value; if (!v) return;
      const keys = selectedKeys();
      const target = keys.length ? staged.filter(r => keys.includes(r._key)) : staged;
      target.forEach(r => { r.type = v; });
      renderStaged(); e.target.value = '';
      S.toast('已更新 ' + target.length + ' 项类型');
    });

    $('bApplyTag').addEventListener('click', () => {
      const t = $('bTag').value.trim();
      if (!t) return S.toast('请输入标签');
      const keys = selectedKeys();
      const target = keys.length ? staged.filter(r => keys.includes(r._key)) : staged;
      target.forEach(r => { r.tags = [...new Set((r.tags || []).concat(t.split(/[,，]/).map(s => s.trim()).filter(Boolean)))]; });
      renderStaged(); $('bTag').value = '';
      S.toast('已为 ' + target.length + ' 项添加标签');
    });

    $('bDel').addEventListener('click', () => {
      const keys = selectedKeys();
      if (!keys.length) return S.toast('先勾选要删除的行');
      staged = staged.filter(r => !keys.includes(r._key));
      renderStaged();
      if (!staged.length) $('stage').classList.add('hidden');
    });

    $('clearStaged').addEventListener('click', () => {
      staged = []; renderStaged(); $('stage').classList.add('hidden');
    });

    $('saveAll').addEventListener('click', async () => {
      if (!staged.length) return;
      if (!S.dbAvailable && location.protocol === 'file:') {
        return S.toast('file:// 模式下无法保存，请用本地服务打开');
      }
      let n = 0;
      for (const r of staged) {
        const rec = Object.assign({}, r);
        delete rec._file; delete rec._url; delete rec._key;
        try {
          await S.putUserAsset(rec, r._file);
          n++;
        } catch (err) {
          console.error(err);
        }
      }
      staged = [];
      renderStaged();
      $('stage').classList.add('hidden');
      await S.loadAssets();
      await renderMine();
      S.toast('已保存 ' + n + ' 项到本地素材库');
    });
  }

  /* ---------- 我的素材 ---------- */
  async function renderMine() {
    const list = await S.userAssets();
    const st = {};
    list.forEach(a => { st[a.type] = (st[a.type] || 0) + 1; });
    $('myStats').innerHTML = [
      ['总数', list.length], ['表情包', st.sticker || 0],
      ['图片', st.image || 0], ['音频', st.audio || 0]
    ].map(k => '<div class="kpi"><div class="n">' + k[1] + '</div><div class="l">' + k[0] + '</div></div>').join('');

    if (!list.length) {
      $('myGrid').innerHTML = '';
      $('myEmpty').style.display = '';
      return;
    }
    $('myEmpty').style.display = 'none';

    const grid = $('myGrid');
    grid.innerHTML = '';
    const sorted = list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'));

    for (const a of sorted) {
      const m = S.member(a.member);
      const el = document.createElement('div');
      el.className = 'card';
      el.style.setProperty('--mc', m.color);
      el.setAttribute('data-id', a.id);
      let thumb;
      if (a.type === 'audio') {
        thumb = '<div class="card-thumb" style="display:grid;place-items:center;color:var(--fg-mute)">' + S.ICON_AUDIO + '</div>';
      } else {
        const url = await S.resolveURL(a);
        thumb = '<div class="card-thumb"><img src="' + url + '" alt="' + S.esc(a.name) + '"></div>';
      }
      el.innerHTML =
        '<span class="card-tag">' + S.esc(m.name) + '</span>' +
        '<span class="card-user">我的</span>' +
        thumb +
        '<div class="card-info">' +
          '<div class="card-name">' + S.esc(a.name) + '</div>' +
          '<div class="card-sub">' + (S.TYPE_NAME[a.type] || '') + ' · ' + S.bytes(a.bytes) + '</div>' +
        '</div>';
      el.addEventListener('click', e => {
        if (e.target.closest('.card-user')) return;
      });
      const del = document.createElement('button');
      del.className = 'fav-btn on';
      del.textContent = '✕';
      del.title = '删除';
      del.onclick = async ev => {
        ev.stopPropagation();
        if (!confirm('从本地素材库删除「' + a.name + '」？')) return;
        await S.deleteUserAsset(a.id);
        await S.loadAssets();
        await renderMine();
        S.toast('已删除');
      };
      el.appendChild(del);
      grid.appendChild(el);

      if (a.type !== 'audio') {
        el.addEventListener('click', async ev => {
          if (ev.target.closest('.fav-btn')) return;
          const url = await S.resolveURL(a);
          const box = document.createElement('div');
          box.className = 'lightbox open';
          box.innerHTML = '<div class="lb-stage"><img src="' + url + '">' +
            '<button class="lb-close">✕</button></div>';
          box.querySelector('.lb-close').onclick = () => box.remove();
          box.onclick = e => { if (e.target === box) box.remove(); };
          document.body.appendChild(box);
        });
      }
    }
  }

  /* ---------- 导出 / 导入 ---------- */
  function bindExport() {
    $('expMine').addEventListener('click', async () => {
      const list = await S.userAssets();
      if (!list.length) return S.toast('还没有自定义素材');
      const clean = list.map(a => {
        const c = Object.assign({}, a);
        delete c.user;
        return c;
      });
      S.download('assets-mine.json', JSON.stringify(clean, null, 1));
      S.toast('已导出 ' + clean.length + ' 项');
    });

    $('expMerged').addEventListener('click', async () => {
      const list = await S.userAssets();
      const merged = overridden(S.baseAssets).concat(list.map(a => Object.assign({}, a, { user: undefined })));
      S.download('assets.json', JSON.stringify(merged, null, 1));
      S.toast('已导出 ' + merged.length + ' 项');
    });

    $('expJs').addEventListener('click', async () => {
      const list = await S.userAssets();
      const merged = overridden(S.baseAssets).concat(list.map(a => Object.assign({}, a, { user: undefined })));
      const payload = JSON.stringify({
        members: S.baseMembers, assets: merged, music: S.baseMusic
      }, null, 0);
      S.download('data.js',
        '/* 由导入后台导出 · ' + new Date().toLocaleString('zh-CN') + ' */\nwindow.ASOUL_DATA = ' + payload + ';\n');
      S.toast('已导出 data.js（已剔除删除的素材）');
    });

    $('expMembers').addEventListener('click', () => {
      S.download('members.json', JSON.stringify(S.baseMembers, null, 2));
      S.toast('已导出 members.json');
    });

    $('impJsonBtn').addEventListener('click', () => $('impJson').click());
    $('impJson').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      e.target.value = '';
      try {
        const arr = JSON.parse(await f.text());
        if (!Array.isArray(arr)) throw new Error('格式不正确');
        let n = 0;
        for (const a of arr) {
          if (!a.id) continue;
          const rec = Object.assign({}, a, { user: true });
          await S.putUserAsset(rec, null);
          n++;
        }
        await S.loadAssets();
        await renderMine();
        S.toast('已从索引恢复 ' + n + ' 条记录（素材文件需另行放入对应目录）');
      } catch (err) {
        S.toast('解析失败：' + err.message);
      }
    });

    $('wipe').addEventListener('click', async () => {
      if (!confirm('这会清空浏览器中保存的全部自定义素材（含音频文件），确定继续？')) return;
      const list = await S.userAssets();
      for (const a of list) await S.deleteUserAsset(a.id);
      await S.loadAssets();
      await renderMine();
      S.toast('已清空本地素材库');
    });
  }
})();
