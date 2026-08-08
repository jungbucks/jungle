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

// 평가계획 표: 라벨 칸은 배경색으로 구분된다(labelStyle에 background:var(--g50)).
// 나머지가 데이터 칸이며, 한 행의 데이터 칸은 정렬이 서로 같아야 한다.
const 행별정렬 = html => {
  const out = [];
  for (const row of html.match(/<tr>[\s\S]*?<\/tr>/g) || []) {
    const tds = [...row.matchAll(/<td\s+style="([^"]*)"/g)].map(m => m[1]);
    const 데이터칸 = tds.filter(st => !st.includes('background:var(--g50)'));
    if (데이터칸.length < 2) continue;
    out.push(데이터칸.map(st => (st.match(/text-align:\s*([a-z]+)/) || [, '(없음)'])[1]));
  }
  return out;
};

export const RULES = [
  {
    id: 'achv-title-no-internal-key',
    왜: '모달 제목은 사용자가 읽는 이름이다. ACHIEVEMENTS 조회 키(_고/_cs)가 새면 단원명과 어긋난다.',
    대상: 'achvModal',
    검사: s => {
      const t = 제목(s);
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
    검사: s => {
      for (const aligns of 행별정렬(s.html)) {
        const uniq = [...new Set(aligns)];
        if (uniq.length > 1) return `한 행의 데이터 칸 정렬이 섞였다: ${aligns.join(' / ')}`;
      }
      return null;
    },
    가짜: { html: '<tr><td style="background:var(--g50)">영역 만점</td>' +
                  '<td style="padding:10px">선택형 70점</td>' +
                  '<td style="padding:10px;text-align:center">30%</td></tr>', meta: {} },
  },
];

export function runInvariants(screens) {
  const violations = [];
  const selfFails = [];

  // 1) 카탈로그가 비지 않았는가
  checkCounts(screens).forEach(p => violations.push(`[카탈로그] ${p}`));

  // 2) 규칙마다: 가짜를 잡는지 먼저 확인한 뒤 진짜 화면에 적용
  for (const r of RULES) {
    if (r.보류) continue;
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
  return { checked: screens.length, rules: RULES.filter(r => !r.보류).length, violations, selfFails };
}

// 자체 실행
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const screens = await renderAll();
  const r = runInvariants(screens);
  console.log(`화면 ${r.checked}장 × 규칙 ${r.rules}개`);
  r.selfFails.forEach(m => console.log('  ✗ [자체] ' + m));
  r.violations.forEach(m => console.log('  ✗ ' + m));
  if (!r.selfFails.length && !r.violations.length) console.log('  ✓ 위반 없음');
  process.exit(r.selfFails.length + r.violations.length ? 1 : 0);
}
