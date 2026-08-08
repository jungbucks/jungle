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

    for (const s of screens) {
      if (s.kind !== r.대상) continue;
      const why = r.검사(s);
      if (why) violations.push(`[${r.id}] ${s.id} — ${why}\n      ↳ ${r.왜}`);
    }
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
