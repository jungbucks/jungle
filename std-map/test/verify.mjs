/* verify.mjs — 그래프 데이터 정합 검산. `node test/verify.mjs` — 전부 PASS 아니면 배포 금지. */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const src = readFileSync(new URL('../data/graph-data.js', import.meta.url), 'utf8');
const G = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL ' + name + (extra ? ' — ' + extra : '')); }
};

const stds = G.nodes.filter(n => n.type === 'std');
const tags = G.nodes.filter(n => n.type === 'tag');
const ids = new Set(G.nodes.map(n => n.id));

t('과목 8종(초등 포함)', G.subjects.length === 8);
t('성취기준 130+개', stds.length >= 130, String(stds.length));
t('코드 중복 없음', new Set(stds.map(n => n.id)).size === stds.length);
t('전 성취기준 태그 ≥1 (커버리지 100%)', stds.every(n => n.tags.length > 0));
t('전 성취기준 텍스트·과목·영역 보유', stds.every(n => n.text && n.subject && n.domain));
t('과목 색 전부 hex', G.subjects.every(s => /^#[0-9A-Fa-f]{6}$/.test(s.color)));
t('링크 양끝 노드 존재', G.links.every(l => ids.has(l.source) && ids.has(l.target)));
t('고아 개념 없음(deg ≥1)', tags.every(n => n.deg >= 1));
t('개념 수 = 링크의 고유 타깃 수', tags.length === new Set(G.links.map(l => l.target)).size);
const subjIds = new Set(G.subjects.map(s => s.id));
t('성취기준 과목 참조 유효', stds.every(n => subjIds.has(n.subject)));

console.log('─'.repeat(40));
if (fail) { console.log(`❌ ${fail}건 실패 / ${pass}건 통과`); process.exit(1); }
console.log(`✅ ${pass}건 전부 통과 — 성취기준 ${stds.length} · 개념 ${tags.length} · 연결 ${G.links.length}`);
