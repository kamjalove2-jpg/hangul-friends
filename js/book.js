import { LETTERS, BY } from './data.js';
import { store, save, today, resetAll } from './store.js';
import { sfx, sayLetter, speak, hasRec, startRec, saveRec, delRec, applyVolume, koVoices, pickVoice } from './audio.js';
import { h, topbar, gate, toast, modal } from './ui.js';
import { LEVEL_NAMES } from './trace.js';
import { allChars, chars, charEl, addChar, delChar, setHidden, fileToCanvas, removeBg, canvasBlob, exportChars, importChars } from './chars.js';

// ============ 스티커북 ============
export function bookScreen(go) {
  let tab = 'col';
  const body = h('div', { class: 'bookbody' });
  const t1 = h('button', { class: 'tab', onclick: () => { tab = 'col'; render(); } }, '📖');
  const t2 = h('button', { class: 'tab', onclick: () => { tab = 'deco'; render(); } }, '🎨');
  const el = h('div', { class: 'screen' }, topbar(go, { title: '', right: h('div', { class: 'row' }, t1, t2) }), body);

  const items = () => {
    const a = LETTERS.filter((l) => store.stickers[l.id]).map((l) => ({ id: l.id, emoji: l.emoji, l }));
    if (store.stickers.name) a.push({ id: 'name', emoji: '🏅', l: null });
    chars().forEach((c) => a.push({ id: 'char:' + c.id, c, l: null }));
    return a;
  };

  function render() {
    t1.classList.toggle('on', tab === 'col'); t2.classList.toggle('on', tab === 'deco');
    body.innerHTML = '';
    body.append(tab === 'col' ? collection() : deco());
  }

  function collection() {
    const grid = h('div', { class: 'sgrid scroll' });
    LETTERS.forEach((l) => {
      const s = store.stickers[l.id];
      grid.append(h('button', {
        class: 'scard' + (s ? ' got' : '') + (s && s.gold ? ' gold' : ''),
        onclick: () => { if (s) { sfx('star'); sayLetter(l); } else sfx('tap'); },
      }, h('div', { class: 'semo' }, l.emoji), h('div', { class: 'sch' }, l.ch), s && s.count > 1 ? h('div', { class: 'cnt' }, '×' + s.count) : null));
    });
    if (store.stickers.name) {
      grid.append(h('button', { class: 'scard got', onclick: () => { sfx('star'); speak(store.name + '!'); } },
        h('div', { class: 'semo' }, '🏅'), h('div', { class: 'sch small' }, store.name)));
    }
    return grid;
  }

  function deco() {
    const wrap = h('div', { class: 'decowrap' });
    const stage = h('div', { class: 'board bg-' + store.bg });
    const bgs = [['meadow', '🌳'], ['road', '🛣️'], ['space', '🌌']];
    const bar = h('div', { class: 'bar' }, bgs.map(([k, e]) => h('button', {
      class: 'btn sq' + (store.bg === k ? ' on' : ''),
      onclick: () => { store.bg = k; save(); render(); },
    }, e)));
    const list = items();
    list.forEach((it, i) => {
      const p = store.board[it.id] || { x: 8 + (i % 6) * 15, y: 8 + Math.floor(i / 6) * 22 };
      const s = h('div', { class: 'stk', style: `left:${p.x}%;top:${p.y}%` }, it.c ? charEl(it.c, 'stkimg') : it.emoji);
      let drag = null;
      s.addEventListener('pointerdown', (e) => {
        e.preventDefault(); s.setPointerCapture(e.pointerId);
        const r = s.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId };
        s.classList.add('drag'); s.parentNode.append(s); sfx('tap');
        if (it.l) sayLetter(it.l, false);
      });
      s.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const b = stage.getBoundingClientRect();
        const x = ((e.clientX - drag.dx - b.left) / b.width) * 100, y = ((e.clientY - drag.dy - b.top) / b.height) * 100;
        s.style.left = Math.max(0, Math.min(90, x)) + '%'; s.style.top = Math.max(0, Math.min(88, y)) + '%';
      });
      const end = () => {
        if (!drag) return; drag = null; s.classList.remove('drag');
        store.board[it.id] = { x: parseFloat(s.style.left), y: parseFloat(s.style.top) }; save();
      };
      s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end);
      stage.append(s);
    });
    if (!list.length) stage.append(h('div', { class: 'empty' }, '✏️ → ⭐'));
    wrap.append(stage, bar);
    return wrap;
  }

  render();
  return { el, cleanup: () => {} };
}

// ============ 부모 모드 ============
export function parentScreen(go) {
  const s = store.settings;
  const secToday = store.play[today()] || 0;
  const el = h('div', { class: 'screen' });
  const bar = h('div', { class: 'top' },
    h('button', { class: 'btn sq', onclick: () => { save(); go('home'); } }, '🏠'),
    h('div', { class: 'ttl' }, '부모 모드'));
  const page = h('div', { class: 'ppage scroll' });
  el.append(bar, page);

  const sec = (title, ...kids) => h('section', { class: 'psec' }, h('h3', {}, title), ...kids);
  const seg = (opts, cur, on) => h('div', { class: 'seg' }, opts.map(([val, label]) => h('button', {
    class: 'segb' + (val === cur ? ' on' : ''), onclick: (e) => {
      on(val); [...e.target.parentNode.children].forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); save();
    },
  }, label)));

  page.append(
    sec('오늘', h('p', {}, `오늘 사용 시간: ${Math.floor(secToday / 60)}분 ${secToday % 60}초`),
      h('p', {}, `모은 스티커: ${Object.keys(store.stickers).filter((k) => k !== 'name').length} / ${LETTERS.length}  ·  별 ${store.stars}개`)),
    sec('하루 사용 시간 제한 (WHO 권고: 만 2~5세 하루 1시간 이내)',
      seg([[10, '10분'], [15, '15분'], [20, '20분'], [30, '30분'], [0, '제한 없음']], s.limit, (v) => { s.limit = v; })),
    sec('따라쓰기·따라 그리기 난이도',
      seg(LEVEL_NAMES, s.level, (v) => { s.level = v; }),
      h('p', { class: 'hint' }, '쉬움·보통: 획 순서 자유, 넉넉하게 인정 / 어려움: 획 순서·방향을 지켜야 하고 선 밖으로 많이 나가면 "한 번 더" (점선 안내) / 매우 어려움: 안내선이 처음 2초만 보이고 사라져요. 어려움 이상에서 별 3개면 반짝 스티커!')),
    sec('소리', seg([[true, '켜짐'], [false, '꺼짐']], s.sound, (v) => { s.sound = v; }),
      h('div', { class: 'gap' }),
      h('div', { class: 'row wrap' }, h('b', {}, '소리 크기'),
        seg([['normal', '보통'], ['loud', '크게'], ['max', '아주 크게']], s.vol, (v) => { s.vol = v; applyVolume(); sfx('win'); })),
      h('p', { class: 'hint' }, 'AI 목소리는 iPad 볼륨을 따라가요. 작으면 iPad 옆 볼륨 버튼으로 올려 주세요.')),
    sec('AI 목소리', voiceBox()),
    sec('글자 읽어주기 방식 (녹음이 있는 글자)',
      seg([['both', 'AI 다음 내 녹음'], ['rec', '내 녹음만'], ['ai', 'AI만']], s.play, (v) => { s.play = v; })),
    sec('아이 이름 (이름 쓰기 놀이)', (() => {
      const inp = h('input', { class: 'inp', value: store.name, maxlength: '6', placeholder: '예: 지후' });
      inp.addEventListener('input', () => { store.name = inp.value.trim(); save(); });
      return inp;
    })()),
    sec('글자별 진행도', h('div', { class: 'chips' }, LETTERS.map((l) => {
      const c = store.stickers[l.id];
      return h('span', { class: 'pchip' + (c ? ' got' : '') }, `${l.ch} ${c ? '✓' + c.count : '·'}`);
    }))),
    sec('내 목소리로 글자 녹음하기', h('p', { class: 'hint' }, '⏺를 누르고 말한 뒤 ⏹를 누르면 저장돼요. 예) "기차 칙칙폭폭!", "인욱아 잘했어!" — AI가 먼저 읽고 이어서 내 목소리가 나와요.'), recList()),
    sec('내 캐릭터 (사진은 이 iPad 안에만 저장돼요)', charBox()),
    sec('데이터', h('button', {
      class: 'btn danger', onclick: () => {
        if (confirm('모은 스티커와 기록이 모두 지워집니다. 정말 초기화할까요?')) { resetAll(); toast('초기화했어요'); go('home'); }
      },
    }, '모든 기록 초기화')));

  function recList() {
    const box = h('div', { class: 'rlist' });
    LETTERS.forEach((l) => {
      let rec = null;
      const status = h('span', { class: 'rst' }, hasRec(l.id) ? '녹음됨' : '기본 음성');
      const rbtn = h('button', { class: 'btn small' }, '⏺ 녹음');
      rbtn.onclick = async () => {
        if (rec) {
          const r = rec; rec = null; rbtn.textContent = '⏺ 녹음';
          try { await saveRec(l.id, await r.stop()); status.textContent = '녹음됨'; toast(l.say + ' 저장!'); sayLetter(l); } catch { toast('저장 실패'); }
          return;
        }
        try { rec = await startRec(); rbtn.textContent = '⏹ 멈춤'; } catch { toast('마이크 권한이 필요해요'); }
      };
      box.append(h('div', { class: 'rrow' }, h('b', { class: 'rch' }, l.ch), h('span', { class: 'rnm' }, `${l.say} · ${l.word}`), status,
        h('button', { class: 'btn small', onclick: () => sayLetter(l) }, '▶'), rbtn,
        h('button', { class: 'btn small', onclick: async () => { await delRec(l.id); status.textContent = '기본 음성'; } }, '🗑')));
    });
    return box;
  }

  function voiceBox() {
    const box = h('div', {});
    const render = () => {
      box.innerHTML = '';
      const vs = koVoices();
      const sel = h('select', { class: 'inp' },
        h('option', { value: '' }, '자동 (가장 좋은 목소리)'),
        vs.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voice }, v.name)));
      sel.addEventListener('change', () => { s.voice = sel.value; save(); pickVoice(); speak('안녕! 나는 한글 친구야. 기역, 기차!'); });
      const cur = pickVoice();
      box.append(
        h('div', { class: 'row wrap' }, sel, h('button', { class: 'btn small', onclick: () => speak('안녕! 나는 한글 친구야. 기역, 기차!') }, '▶ 들어보기')),
        h('p', { class: 'hint' }, cur ? `지금 목소리: ${cur.name}` : '한국어 목소리를 찾지 못했어요.'),
        h('p', { class: 'hint' }, '더 자연스러운 목소리: iPad 설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성 → 한국어 → "Yuna (향상됨)" 또는 "프리미엄" 목소리를 내려받은 뒤, 앱을 다시 열고 위에서 고르세요.'));
    };
    render();
    if ('speechSynthesis' in window && !koVoices().length) setTimeout(render, 800);
    return box;
  }

  function charBox() {
    const box = h('div', {});
    const grid = h('div', { class: 'cgrid' });
    const name = h('input', { class: 'inp', maxlength: '10', placeholder: '이름 (예: 로봇 비행기)' });
    const bgChk = h('input', { type: 'checkbox', checked: true });
    const fin = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    const jin = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
    const renderGrid = () => {
      grid.innerHTML = '';
      if (!allChars().length) grid.append(h('p', { class: 'hint' }, '아직 없어요. 사진을 추가하면 보상 화면·스티커북·도장·사진 위에 그리기에 나와요.'));
      allChars().forEach((c) => {
        const hide = h('button', { class: 'btn small', onclick: async () => { await setHidden(c, !c.hidden); renderGrid(); } }, c.hidden ? '🙈 숨김' : '👀 보임');
        grid.append(h('div', { class: 'ccard' + (c.hidden ? ' off' : '') }, charEl(c, 'cimg'), h('div', { class: 'cname' }, c.name || ' '),
          h('div', { class: 'row' }, hide, h('button', { class: 'btn small', onclick: async () => {
            if (!confirm('이 캐릭터를 지울까요?')) return;
            await delChar(c); renderGrid();
          } }, '🗑'))));
      });
    };
    fin.addEventListener('change', async () => {
      const f = fin.files && fin.files[0]; fin.value = '';
      if (!f) return;
      try {
        let cv = await fileToCanvas(f, 256);
        if (bgChk.checked) cv = removeBg(cv);
        await addChar(await canvasBlob(cv), name.value.trim());
        name.value = ''; renderGrid(); toast('캐릭터를 추가했어요!');
      } catch { toast('사진을 열 수 없어요'); }
    });
    jin.addEventListener('change', async () => {
      const f = jin.files && jin.files[0]; jin.value = '';
      if (!f) return;
      try { const n = await importChars(f); renderGrid(); toast(`${n}개를 불러왔어요`); } catch { toast('백업 파일이 아니에요'); }
    });
    const exportBtn = h('button', { class: 'btn small', onclick: async () => {
      if (!allChars().length) { toast('저장할 캐릭터가 없어요'); return; }
      const blob = await exportChars();
      const file = new File([blob], 'hangul-characters.json', { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: '한글 친구들 캐릭터 백업' }); return; } catch { /* 취소 시 다운로드로 */ }
      }
      const a = h('a', { href: URL.createObjectURL(blob), download: 'hangul-characters.json' });
      document.body.append(a); a.click(); a.remove();
    } }, '💾 백업 저장');
    box.append(
      h('div', { class: 'row wrap' }, name, h('label', { class: 'chk' }, bgChk, ' 흰/단색 배경 지우기'),
        h('button', { class: 'btn small primary', onclick: () => fin.click() }, '📷 사진 추가')),
      h('div', { class: 'gap' }), grid, h('div', { class: 'gap' }),
      h('div', { class: 'row wrap' }, exportBtn, h('button', { class: 'btn small', onclick: () => jin.click() }, '📂 백업 불러오기')),
      h('p', { class: 'hint' }, '사진은 웹에서 저장해 사진첩에 넣은 뒤 고르면 돼요. 배경이 투명한 PNG나 흰 배경 그림이 가장 깔끔해요. iPad를 바꾸거나 앱을 지우기 전에는 백업을 저장해 두세요.'),
      fin, jin);
    renderGrid();
    return box;
  }

  return { el, cleanup: save };
}
