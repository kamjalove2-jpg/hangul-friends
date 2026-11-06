import { LETTERS, BY } from './data.js';
import { store, save, today, resetAll } from './store.js';
import { sfx, sayLetter, speak, hasRec, startRec, saveRec, delRec } from './audio.js';
import { h, topbar, gate, toast, modal } from './ui.js';

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
        class: 'scard' + (s ? ' got' : ''),
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
      const s = h('div', { class: 'stk', style: `left:${p.x}%;top:${p.y}%` }, it.emoji);
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
    sec('따라쓰기 난이도 (쉬움: 넉넉하게 인정)',
      seg([[true, '쉬움'], [false, '보통']], s.easy, (v) => { s.easy = v; })),
    sec('소리', seg([[true, '켜짐'], [false, '꺼짐']], s.sound, (v) => { s.sound = v; })),
    sec('아이 이름 (이름 쓰기 놀이)', (() => {
      const inp = h('input', { class: 'inp', value: store.name, maxlength: '6', placeholder: '예: 지후' });
      inp.addEventListener('input', () => { store.name = inp.value.trim(); save(); });
      return inp;
    })()),
    sec('글자별 진행도', h('div', { class: 'chips' }, LETTERS.map((l) => {
      const c = store.stickers[l.id];
      return h('span', { class: 'pchip' + (c ? ' got' : '') }, `${l.ch} ${c ? '✓' + c.count : '·'}`);
    }))),
    sec('내 목소리로 글자 녹음하기 (녹음 버튼을 누르고 말한 뒤 다시 누르면 저장)', recList()),
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
          try { await saveRec(l.id, await r.stop()); status.textContent = '녹음됨'; toast(l.say + ' 저장!'); } catch { toast('저장 실패'); }
          return;
        }
        try { rec = await startRec(); rbtn.textContent = '⏹ 멈춤'; speak('', 1); } catch { toast('마이크 권한이 필요해요'); }
      };
      box.append(h('div', { class: 'rrow' }, h('b', { class: 'rch' }, l.ch), h('span', { class: 'rnm' }, `${l.say} · ${l.word}`), status,
        h('button', { class: 'btn small', onclick: () => sayLetter(l) }, '▶'), rbtn,
        h('button', { class: 'btn small', onclick: async () => { await delRec(l.id); status.textContent = '기본 음성'; } }, '🗑')));
    });
    return box;
  }

  return { el, cleanup: save };
}
