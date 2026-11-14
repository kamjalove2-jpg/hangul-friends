// 색 채우기(플러드 필): 누른 곳에서 같은 색으로 이어진 영역을 선에 닿을 때까지 칠한다.
// 경계 = 밑그림 선(useBg일 때) + 아이가 그린 선/색. 모든 좌표는 캔버스 실제 픽셀 단위.

const TOL = 60; // 같은 색으로 볼 차이 (R+G+B 차이 합)

// 반환: 바뀐 영역의 되돌리기 정보 { x, y, w, h, data } 또는 null(칠할 곳 없음)
export function floodFill(dctx, bctx, px, py, rgb, useBg) {
  const W = dctx.canvas.width, H = dctx.canvas.height;
  px = Math.floor(px); py = Math.floor(py);
  if (px < 0 || py < 0 || px >= W || py >= H) return null;
  const D = dctx.getImageData(0, 0, W, H), d = D.data;
  const b = useBg ? bctx.getImageData(0, 0, W, H).data : null;

  // 픽셀의 "보이는 색"(그림 위 → 흰 바탕). 밑그림 선이면 -1(벽)
  const key = new Int32Array(W * H);
  for (let i = 0, j = 0; i < W * H; i++, j += 4) {
    if (b && b[j + 3] > 60 && d[j + 3] < 128) { key[i] = -1; continue; }
    const a = d[j + 3] / 255;
    const r = Math.round(d[j] * a + 255 * (1 - a)), g = Math.round(d[j + 1] * a + 255 * (1 - a)), bl = Math.round(d[j + 2] * a + 255 * (1 - a));
    key[i] = (r << 16) | (g << 8) | bl;
  }
  const s0 = key[py * W + px];
  if (s0 < 0) return null; // 선 위를 누름
  const sr = s0 >> 16, sg = (s0 >> 8) & 255, sb = s0 & 255;
  const same = (i) => {
    const k = key[i];
    if (k < 0) return false;
    return Math.abs((k >> 16) - sr) + Math.abs(((k >> 8) & 255) - sg) + Math.abs((k & 255) - sb) <= TOL;
  };

  // 줄 단위(스캔라인) 채우기
  const mask = new Uint8Array(W * H);
  const stack = [px, py];
  let x0 = W, y0 = H, x1 = -1, y1 = -1, count = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    let l = x;
    const row = y * W;
    if (mask[row + l] || !same(row + l)) continue;
    while (l > 0 && !mask[row + l - 1] && same(row + l - 1)) l--;
    let r = x;
    while (r < W - 1 && !mask[row + r + 1] && same(row + r + 1)) r++;
    for (let i = l; i <= r; i++) mask[row + i] = 1;
    count += r - l + 1;
    if (l < x0) x0 = l; if (r > x1) x1 = r; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= H) continue;
      const nrow = ny * W;
      let inRun = false;
      for (let i = l; i <= r; i++) {
        const ok = !mask[nrow + i] && same(nrow + i);
        if (ok && !inRun) { stack.push(i, ny); inRun = true; } else if (!ok) inRun = false;
      }
    }
  }
  if (!count) return null;

  // 선 가장자리까지 2px 더 칠해서 흰 틈 없애기 (밑그림 선 아래로 살짝 들어감)
  const G = 2;
  x0 = Math.max(0, x0 - G); y0 = Math.max(0, y0 - G); x1 = Math.min(W - 1, x1 + G); y1 = Math.min(H - 1, y1 + G);
  const grow = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (mask[i]) { grow[i] = 1; continue; }
      let hit = false;
      for (let dy = -G; dy <= G && !hit; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= H) continue;
        for (let dx = -G; dx <= G; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= W) continue;
          if (mask[yy * W + xx]) { hit = true; break; }
        }
      }
      if (hit && (key[i] < 0 || d[i * 4 + 3] < 255)) grow[i] = 1; // 선·흐린 가장자리만
    }
  }

  // 되돌리기용으로 바뀌는 사각형 저장
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const undo = { x: x0, y: y0, w, h, data: dctx.getImageData(x0, y0, w, h) };
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!grow[i]) continue;
      const j = i * 4;
      d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = 255;
    }
  }
  dctx.putImageData(D, 0, 0, x0, y0, w, h);
  return undo;
}

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
