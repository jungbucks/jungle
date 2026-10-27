// ============================================================
//  정적 셸(index.html) ↔ 렌더러 출력 동기화 — CLAUDE.md 규칙 9(첫 페인트 = 최종 레이아웃)
//  실행:  node tools/shell.mjs          (index.html의 상단 메뉴·홈 바로가기를 렌더러 출력으로 다시 씀)
//         node tools/shell.mjs --check  (어긋나면 종료코드 1 — invariants의 static-shell-matches-render와 같은 검사)
//  메뉴 순서·이름의 원천은 assets/state.js NAV. 손으로 index.html을 고치지 말고 이 도구를 돌린다.
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(root, 'index.html');

// 비교용: 태그 사이 공백·연속 공백을 무시한다
export const normalize = s => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

// index.html에서 두 조각의 [시작, 끝) 위치를 찾는다
export function locate(html) {
  const tOpen = html.match(/<div class="tabs" id="tabs"[^>]*>/);
  if (!tOpen) throw Error('index.html에 #tabs가 없다');
  const tStart = tOpen.index + tOpen[0].length;
  const tEnd = html.indexOf('</div>', tStart); // 정적 탭은 버튼만 담는다(중첩 div 없음)
  const main = html.indexOf('<div class="main" id="main"');
  const hStart = html.indexOf('<div class="home-nav">', main);
  if (main < 0 || hStart < 0) throw Error('index.html에 정적 .home-nav가 없다');
  let depth = 0, i = hStart, hEnd = -1;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = hStart;
  for (let m; (m = re.exec(html));) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) { hEnd = m.index + m[0].length; break; }
  }
  if (hEnd < 0) throw Error('.home-nav 닫는 태그를 찾지 못했다');
  return { tabs: [tStart, tEnd], home: [hStart, hEnd] };
}

// 렌더러 출력(홈 모드). 브라우저 스텁·data.js 전역은 render.mjs가 깐다.
export async function rendered() {
  const assets = join(root, 'assets');
  const { renderHome } = await import(pathToFileURL(join(assets, 'home.js')).href);
  const { __navTest } = await import(pathToFileURL(join(assets, 'app.js')).href);
  return { tabs: __navTest.desktopTabsHtml(), home: renderHome().trim() };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  globalThis.setTimeout = () => 0; // 앱 모듈의 타자 애니메이션 타이머가 프로세스를 붙잡지 않게
  const { ensureGlobals } = await import(pathToFileURL(join(root, 'tools', 'render.mjs')).href);
  ensureGlobals();
  const r = await rendered();
  let html = readFileSync(INDEX, 'utf8');
  const loc = locate(html);
  const cur = { tabs: html.slice(...loc.tabs), home: html.slice(...loc.home) };
  const same = normalize(cur.tabs) === normalize(r.tabs) && normalize(cur.home) === normalize(r.home);
  if (process.argv.includes('--check')) {
    console.log(same ? '정적 셸 = 렌더러 출력' : '정적 셸이 렌더러 출력과 다르다 — node tools/shell.mjs 로 다시 생성');
    process.exit(same ? 0 : 1);
  }
  if (same) { console.log('이미 같음 — 바꿀 것 없음'); process.exit(0); }
  // 뒤쪽 조각부터 바꿔야 앞쪽 위치가 유지된다
  html = html.slice(0, loc.home[0]) + r.home + html.slice(loc.home[1]);
  html = html.slice(0, loc.tabs[0]) + r.tabs.replace(/\s*\n\s*/g, ' ') + html.slice(loc.tabs[1]);
  writeFileSync(INDEX, html);
  console.log('index.html 정적 셸을 렌더러 출력으로 다시 썼다');
  process.exit(0);
}
