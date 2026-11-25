// 클로바더빙 등으로 미리 만든 음성 파일(조각). 문장을 조각으로 나눠 이어서 재생한다.
// 예) "기역. 기차!" → [기역] + [기차], "기역 어디 있을까?" → [기역] + [어디 있을까]
import { LETTERS } from './data.js';
import { PICTURES } from './pictures.js';
import { NATIVE_WORDS, SINO_WORDS } from './numbers.js';

const PHRASES = [
  '어디 있을까', '이건', '찾아보자', '우와', '모두 맞췄어요', '최고예요',
  '천천히 한 번 더 써 볼까', '이름을 다 썼어요', '멋져요', '참 잘했어요',
  '오늘은 많이 놀았어요', '이제 쉬는 시간이에요', '안녕',
  '그려 볼까', '완성', '선을 따라 천천히 한 번 더', '멋지게 그렸어요',
  '숫자 놀이 하자', '세어 보자', '몇 개일까', '정답', '다시 세어 볼까',
];

// 그룹별 조각 목록 (같은 글이 여러 곳에 나오면 한 번만)
export const CLIP_GROUPS = (() => {
  const seen = new Set(), out = [];
  const add = (title, list) => {
    const items = list.filter((t) => { const k = norm(t); if (seen.has(k)) return false; seen.add(k); return true; });
    out.push({ title, items });
  };
  add('글자 이름', LETTERS.map((l) => l.say));
  add('글자 단어', LETTERS.map((l) => l.word));
  add('그림 이름', PICTURES.map((p) => p.name));
  add('숫자 (하나·둘)', NATIVE_WORDS);
  add('숫자 (일·이)', SINO_WORDS);
  add('자주 쓰는 말', PHRASES);
  return out;
})();
export const CLIPS = CLIP_GROUPS.flatMap((g) => g.items);

// 비교용: 한글·영문·숫자만 남김 (맥/iPad 파일 이름의 풀어쓴 한글도 합침)
export function norm(s) {
  return (s || '').normalize('NFC').replace(/[^가-힣ㄱ-ㅣa-z0-9]/gi, '');
}
export const clipKey = (text) => 'V:' + norm(text);

const BY_NORM = new Map(CLIPS.map((t) => [norm(t), t]));

// 파일 이름 → 조각 글. "기역.mp3", "01_기역.mp3", "기역 (1).mp3" 모두 인식
export function matchFile(filename) {
  let base = (filename || '').normalize('NFC').replace(/\.[a-z0-9]{2,5}$/i, '');
  base = base.replace(/^\d+[\s._-]+/, '').replace(/\s*\(\d+\)$/, '');
  return BY_NORM.get(norm(base)) || null;
}

// 문장을 가지고 있는 조각들로 나누기 (가장 적은 조각 수). 못 나누면 null
export function splitClips(text, has) {
  const t = norm(text);
  if (!t) return null;
  const n = t.length, best = new Array(n + 1).fill(null);
  best[0] = [];
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - 20); j < i; j++) {
      if (!best[j]) continue;
      const k = 'V:' + t.slice(j, i);
      if (!has(k)) continue;
      if (!best[i] || best[j].length + 1 < best[i].length) best[i] = [...best[j], k];
    }
  }
  return best[n];
}

// 클로바더빙에 붙여 넣을 문장 목록 (텍스트 파일 내용)
export function phraseListText() {
  const lines = [
    '한글 친구들 - 음성 파일 문장 목록',
    '',
    '만드는 법',
    '1. 클로바더빙에서 마음에 드는 목소리 하나를 골라 아래 문장을 한 줄씩 만드세요.',
    '2. 내려받은 파일 이름을 "문장 그대로" 바꿔 저장하세요. 예) 기역.mp3, 어디 있을까.mp3',
    '   (앞에 번호가 붙어도 괜찮아요: 01_기역.mp3)',
    '3. 앱 부모 모드 → 음성 파일 → 📂 음성 파일 넣기에서 파일들을 한꺼번에 고르세요.',
    '   이름이 다르게 저장됐다면 목록에서 그 문장의 📂 버튼으로 하나씩 넣을 수 있어요.',
    '',
  ];
  let i = 1;
  for (const g of CLIP_GROUPS) {
    lines.push(`[${g.title}]`);
    for (const t of g.items) lines.push(`${String(i++).padStart(2, '0')}  ${t}`);
    lines.push('');
  }
  return lines.join('\n');
}
