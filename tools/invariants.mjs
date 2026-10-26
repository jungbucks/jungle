// ============================================================
//  정글 렌더 불변식 규칙
//  실행:  node tools/invariants.mjs   (위반 있으면 종료코드 1)
//
//  규칙 하나는 반드시 "가짜"(일부러 깨진 화면)를 함께 갖는다.
//  하네스는 매번 "이 규칙이 그 가짜를 실제로 잡는가"를 확인한다.
//  없으면 영원히 통과만 하는 죽은 규칙이 쌓이고, 그물이 있다는 착각만 남는다.
//
//  ⚠️ 이 파일은 렌더 방법을 모른다. 렌더는 tools/render.mjs에 있다.
// ============================================================
import { pathToFileURL } from 'node:url';
import { renderAll, checkCounts } from './render.mjs';

const 제목 = s => (s.html.match(/id="achvModalTitle"[^>]*>([^<]*)</) || [, ''])[1];

// 행 이름과 열 개수를 확인한 뒤 정렬을 비교한다. 속성 순서·공백·클래스 추가는 무관하다.
const EVAL_ROWS = ['ratio', 'score', 'essay', 'standards', 'elements', 'period'];
function attribute(attrs, name) {
  const match = [...attrs.matchAll(/(?:^|\s)([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .find(m => m[1].toLowerCase() === name);
  return match ? (match[2] ?? match[3] ?? match[4]) : '';
}
function evalTableAlignment(screen) {
  const body = screen.html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!body) return '평가계획 표 본문을 찾지 못했다';
  const rows = [...body[1].matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)];
  if (rows.length !== EVAL_ROWS.length) return '평가계획 본문 행이 누락되거나 중복됐다';
  const columns = screen.meta.dataColumns;
  if (!Number.isInteger(columns) || columns < 2) return '예상 데이터 열 개수가 없다';
  for (const id of EVAL_ROWS) {
    const matched = rows.filter(row => attribute(row[1], 'data-eval-row') === id);
    if (matched.length !== 1) return id + ': 필수 행이 누락되거나 중복됐다';
    const cells = [...matched[0][2].matchAll(/<td\b([^>]*)>[\s\S]*?<\/td>/gi)];
    if (cells.length !== columns + 1) return id + ': 데이터 셀이 누락되거나 중복됐다';
    // 첫 칸은 행 제목. 배경색에 의존해 라벨 여부를 추측하지 않는다.
    const aligns = cells.slice(1).map(cell => {
      const style = attribute(cell[1], 'style');
      const declarations = [...style.matchAll(/(?:^|;)\s*text-align\s*:\s*([^;]+)/gi)];
      return declarations.length ? declarations.at(-1)[1].trim().toLowerCase() : '(없음)';
    });
    if (new Set(aligns).size > 1) return id + ': 한 행의 데이터 칸 정렬이 섞였다: ' + aligns.join(' / ');
  }
  return null;
}

// 시뮬레이터: 배치 카드의 선택된 학점 합 = 요약의 "총 N학점" (분반 짝이 없는 편성 기준)
function simCreditTotal(screen) {
  const selects = [...screen.html.matchAll(/<select class="sim-credit-select"[\s\S]*?<\/select>/g)];
  if (!selects.length) return '배치 카드의 학점 선택이 없다(학점이 고정 표시로 돌아갔을 수 있다)';
  const picked = selects.map(m => (m[0].match(/<option value="(\d)" selected>/) || [])[1]);
  if (picked.some(v => !v)) return '선택된 학점이 없는 카드가 있다';
  const sum = picked.reduce((a, v) => a + +v, 0);
  const total = +((screen.html.match(/총 (\d+)학점/) || [])[1]);
  return total === sum ? null : `카드 학점 합 ${sum} ≠ 요약 총 ${total}학점`;
}

// <button> 안에 또 다른 버튼(진짜 <button> 또는 role="button")이 있으면 위반. 중첩 깊이를 세며 훑는다.
function nestedInteractive(screen) {
  let depth = 0;
  for (const m of screen.html.matchAll(/<(\/?)(button)\b([^>]*)>|<[a-z]+\b[^>]*\brole="button"[^>]*>/gi)) {
    if (m[2]) {
      if (m[1]) { depth = Math.max(0, depth - 1); continue; }
      if (depth > 0) return '버튼 안에 버튼이 있다: ' + m[0].slice(0, 60);
      depth++;
    } else if (depth > 0) return '버튼 안에 role=button 요소가 있다: ' + m[0].slice(0, 60);
  }
  return null;
}

export const RULES = [
  {
    id: 'theme-decided-before-paint',
    왜: '다크 테마는 첫 페인트 전에 정해야 한다. 모듈(app.js)에서 정하면 운영체제 다크 사용자에게 흰 화면이 번쩍인다. 토글 버튼도 헤더에 있어야 한다(2026-10 이전엔 toggleDarkMode를 부르는 곳이 없었다).',
    대상: 'homeShell',
    검사: s => {
      const head = (s.html.match(/<head>[\s\S]*?<\/head>/i) || [''])[0];
      if (!/<script src="assets\/theme-init\.js"><\/script>/.test(head)) return '<head>에 theme-init.js가 없다';
      return /id="themeToggle"/.test(s.html) ? null : '헤더에 테마 토글(#themeToggle)이 없다';
    },
    가짜: { html: '<html><head><link rel="stylesheet" href="assets/style.css"></head><body><div class="header"></div></body></html>', meta: {} },
  },
  {
    id: 'no-button-in-button',
    왜: '버튼 안의 버튼은 HTML 위반이고, 화면 읽기 도구는 바깥 버튼 이름만 읽어 안쪽 해설·성취수준·복사 버튼을 찾지 못한다(2026-10 영역 헤더).',
    대상: 'domainSection',
    검사: nestedInteractive,
    가짜: { html: '<button class="domain-header"><span class="domain-name">데이터</span><span class="achv-btn" role="button">ABCDE</span></button>', meta: {} },
  },
  {
    id: 'stdpicker-checkbox-name',
    왜: '성취기준 선택기의 체크박스는 어떤 성취기준을 고르는지 이름(코드)이 있어야 한다.',
    대상: 'stdPicker',
    검사: s => {
      const inputs = [...s.html.matchAll(/<input\b([^>]*class="eval-std-chk"[^>]*)>/g)];
      if (!inputs.length) return '선택 체크박스를 찾지 못했다';
      for (const m of inputs) {
        let code = '';
        try { code = JSON.parse(attribute(m[1], 'data-args').replace(/&quot;/g, '"'))[0] || ''; } catch (e) {}
        const label = attribute(m[1], 'aria-label');
        if (!code || !label.includes(code)) return `접근성 이름에 코드가 없다: ${code || '(코드 없음)'} → "${label}"`;
      }
      return null;
    },
    가짜: { html: '<div class="eval-std-item"><input type="checkbox" class="eval-std-chk" data-args="[&quot;[9정01-01]&quot;]"></div>', meta: {} },
  },
  {
    id: 'sim-total-matches-cards',
    왜: '학점을 카드마다 바꿀 수 있으므로 요약 합계가 과목 기본값(옛 credit:3 하드코딩)이 아니라 카드에 고른 값을 더해야 한다.',
    대상: 'simulator',
    검사: simCreditTotal,
    가짜: { html: '<select class="sim-credit-select"><option value="4" selected>4학점</option></select><span class="sim-sum-total">총 3학점</span>', meta: {} },
  },
  {
    id: 'home-cover-svg-safe-fallback-size',
    왜: '홈 히어로 그림(2026-10부터 webp <img>, 그 전엔 SVG)은 새 HTML과 이전 CSS가 잠시 섞여도 원본 크기로 커지지 않아야 한다.',
    대상: 'homeShell',
    검사: s => {
      const svg = [...s.html.matchAll(/<(?:svg|img)\b([^>]*)>/gi)]
        .find(m => attribute(m[1], 'class').split(/\s+/).includes('cover-tree'));
      if (!svg) return 'cover-tree 그림(svg/img)을 찾지 못했다';
      const width = Number(attribute(svg[1], 'width'));
      const height = Number(attribute(svg[1], 'height'));
      return width > 0 && width <= 64 && height > 0 && height <= 64
        ? null
        : `CSS 미적용 시 안전한 크기가 없다: ${width || '없음'}×${height || '없음'}`;
    },
    가짜: { html: '<svg class="cover-tree" viewBox="0 0 480 440"></svg>', meta: {} },
  },
  {
    id: 'standard-checkbox-name',
    왜: '담기 체크박스는 화면 읽기 도구에도 어떤 성취기준을 선택하는지 알려야 한다.',
    대상: 'stdCard',
    검사: s => {
      const input = [...s.html.matchAll(/<input\b([^>]*)>/g)].find(m => attribute(m[1], 'class').split(/\s+/).includes('card-chk'));
      if (!input) return '담기 체크박스 누락';
      const label = attribute(input[1], 'aria-label');
      return label.includes(s.meta.code) && label.includes('담기') ? null : '성취기준 코드와 담기 이름 누락';
    },
    가짜: {html:'<input type="checkbox" class="card-chk">', meta:{code:'[12정01-01]'}},
  },
  {
    id: 'achv-title-no-internal-key',
    왜: '모달 제목은 사용자가 읽는 이름이다. ACHIEVEMENTS 조회 키(_고/_cs)가 새면 단원명과 어긋난다.',
    대상: 'achvModal',
    검사: s => {
      const t = 제목(s);
      // 제목을 못 찾으면 "위반 없음"이 아니라 추출기가 마크업 변경을 놓친 것이다.
      // modal-title-matches-unit이 같은 kind를 검사해 우연히 막아주고 있을 뿐이므로 이 규칙도 스스로 가드한다.
      if (!t) return '제목 요소를 찾지 못했다';
      return /_고|_cs/.test(t) ? `제목에 내부 키가 노출됐다: "${t}"` : null;
    },
    가짜: { html: '<span id="achvModalTitle">📊 데이터_고 — ABCDE 성취수준</span>', meta: { 단원: '데이터' } },
  },
  {
    id: 'modal-title-matches-unit',
    왜: '제목이 그 화면의 단원명을 담지 않으면 사용자는 다른 단원을 보고 있다고 오해한다.',
    대상: 'achvModal',
    검사: s => {
      const t = 제목(s);
      if (!t) return '제목 요소를 찾지 못했다';
      return t.includes(s.meta.단원) ? null : `제목 "${t}" 이 단원명 "${s.meta.단원}" 을 담지 않는다`;
    },
    가짜: { html: '<span id="achvModalTitle">📊 알고리즘 — ABCDE 성취수준</span>', meta: { 단원: '데이터' } },
  },
  {
    id: 'table-row-align-consistent',
    왜: '한 행에서 어떤 칸만 정렬이 다르면 표가 어긋나 보인다. 2026-08-07 평가계획 표에서 정기시험 칸만 좌측이었다.',
    대상: 'evalPreview',
    검사: evalTableAlignment,
    가짜: {
      html: '<table><tbody>' + EVAL_ROWS.map(id =>
        '<tr data-eval-row="' + id + '"><td>라벨</td>' +
        '<td style="text-align:' + (id === 'score' ? 'left' : 'center') + '">값</td>' +
        '<td style="text-align:center">합계</td></tr>').join('') + '</tbody></table>',
      meta: { dataColumns: 2 },
    },
  },
];

export function runInvariants(screens) {
  const violations = [];
  const selfFails = [];
  const 보류목록 = [];   // { id, 이유 } — 항상 출력해야 "규칙 N개"가 조용히 줄어든 걸 아무도 모르는 사태를 막는다

  // 1) 카탈로그가 비지 않았는가
  checkCounts(screens).forEach(p => violations.push(`[카탈로그] ${p}`));

  // 2) 규칙마다: 보류 정당성 확인 → 가짜를 잡는지 확인 → 진짜 화면에 적용
  const 활성규칙 = [];
  for (const r of RULES) {
    if ('보류' in r) {
      const 이유 = typeof r.보류 === 'string' ? r.보류.trim() : '';
      if (!이유) {
        // 설계 문서(2026-08-08-update-workflow-design.md "실패 처리"): 이유 없는 비활성화는 금지.
        // 보류:true 처럼 이유가 없으면 규칙을 끄지 않는다 — 조용히 검사가 빠지는 것보다
        // 시끄럽게 계속 검사되는 쪽이 안전하다.
        selfFails.push(`${r.id}: 보류가 이유 문자열이 아니다(${JSON.stringify(r.보류)}) — 이유 없는 비활성화는 금지, 규칙을 계속 활성 취급한다`);
      } else {
        보류목록.push({ id: r.id, 이유 });
        continue;
      }
    }
    활성규칙.push(r);

    if (!r.가짜) { selfFails.push(`${r.id}: 가짜 화면이 없다 — 규칙이 살아 있는지 확인할 수 없다`); continue; }
    const fake = { kind: r.대상, id: `가짜/${r.id}`, ...r.가짜 };
    if (!r.검사(fake)) selfFails.push(`${r.id}: 가짜 화면을 못 잡았다 — 규칙이 죽었다`);

    // 규칙이 실제로 몇 장에 걸렸는지 센다. 0장이면 "위반 없음"이 아니라 "검사를 안 한 것"이다.
    let matched = 0;
    for (const s of screens) {
      if (s.kind !== r.대상) continue;
      matched++;
      const why = r.검사(s);
      if (why) violations.push(`[${r.id}] ${s.id} — ${why}\n      ↳ ${r.왜}`);
    }
    if (matched === 0) selfFails.push(`${r.id}: 대상 '${r.대상}' 에 걸린 화면이 0장 — 대상 철자가 render.mjs의 kind와 다를 수 있다`);
  }

  // 3) 거울상: 카탈로그의 kind 중 활성 규칙 어느 것의 대상도 아닌 것이 있는가.
  //    안 막으면 화면 종류만 늘어도 "화면 N장 × 규칙 M개 — 위반 없음"이 그물이 더 튼튼해 보이게 만든다.
  const 규칙대상목록 = new Set(활성규칙.map(r => r.대상));
  const kind별장수 = {};
  for (const s of screens) kind별장수[s.kind] = (kind별장수[s.kind] || 0) + 1;
  for (const [kind, n] of Object.entries(kind별장수)) {
    if (!규칙대상목록.has(kind)) selfFails.push(`kind '${kind}' (${n}장)를 보는 규칙이 하나도 없다 — 화면만 늘고 검사는 안 된다`);
  }

  return { checked: screens.length, rules: 활성규칙.length, violations, selfFails, 보류목록 };
}

// 자체 실행
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const screens = await renderAll();
  const r = runInvariants(screens);
  console.log(`화면 ${r.checked}장 × 규칙 ${r.rules}개`);
  r.보류목록.forEach(b => console.log(`  ⏸ [보류] ${b.id} — ${b.이유}`));
  r.selfFails.forEach(m => console.log('  ✗ [자체] ' + m));
  r.violations.forEach(m => console.log('  ✗ ' + m));
  if (!r.selfFails.length && !r.violations.length) console.log('  ✓ 위반 없음');
  process.exit(r.selfFails.length + r.violations.length ? 1 : 0);
}
