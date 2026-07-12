// ============================================================
//  정글 배포 전 검증 스크립트
//  실행:  node tools/verify.mjs      (jungle 폴더에서)
//  종료코드: 0 = 통과(배포 안전) / 1 = 실패(배포 중단)
//
//  검사:
//   [1] import/export 정합성 — 누락된 export(모듈 그래프 사망 원인) 탐지
//   [2] 파일별 문법 — 깨진 파일을 정확히 지목
//   [3] 전체 그래프 로드 + init 실행 — node --check가 못 잡는 런타임 초기화 오류
//   [4] 서비스워커 프리캐시 목록의 파일 실제 존재 여부
//   [5] 계산 로직 단위 테스트 — gradecalc·chasi·evalplan 회귀 (tools/test.mjs)
// ============================================================
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');   // jungle/
const assetsDir = join(root, 'assets');

let failures = 0;
const fail = (m) => { console.log('   \x1b[31m✗\x1b[0m ' + m); failures++; };
const ok   = (m) => console.log('   \x1b[32m✓\x1b[0m ' + m);
const head = (m) => console.log('\n\x1b[1m' + m + '\x1b[0m');

// ── 브라우저 환경 스텁 (data.js 전역 + DOM) ──────────────────
function node() {
  return {
    innerHTML:'', textContent:'', value:'', placeholder:'', selectionEnd:0,
    style:{ setProperty(){}, removeProperty(){} }, dataset:{}, children:[], offsetWidth:0,
    classList:{ add(){}, remove(){}, toggle(){return false;}, contains(){return false;} },
    setAttribute(){}, getAttribute(){return null;}, removeAttribute(){},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    focus(){}, scrollIntoView(){}, setSelectionRange(){}, click(){},
    querySelector(){return null;}, querySelectorAll(){return [];}, closest(){return null;},
  };
}
globalThis.document = {
  getElementById(){ return node(); }, querySelector(){ return null; },
  querySelectorAll(){ return []; }, createElement(){ return node(); },
  addEventListener(){}, body: node(),
  documentElement:{ setAttribute(){}, style:{ setProperty(){}, removeProperty(){} } },
};
globalThis.window = globalThis;
globalThis.location = { hash:'', origin:'http://localhost' };
globalThis.history = { replaceState(){}, pushState(){} };
globalThis.requestAnimationFrame = (cb) => { try { cb(); } catch(e){} return 1; };
globalThis.setTimeout = () => 0;   // 타이핑 애니메이션 무한루프 방지
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
globalThis.CSS = { escape:(s)=>s };
globalThis.addEventListener = () => {};
globalThis.scrollTo = () => {};
try { Object.defineProperty(globalThis,'navigator',{ value:{ clipboard:{ writeText(){return Promise.resolve();} } }, configurable:true }); } catch(e){}

// data.js 전역을 실제 파일에서 로드 (classic script → eval)
try {
  const dataSrc = readFileSync(join(assetsDir,'data.js'),'utf8');
  const g = ['SUBJECTS','ACHIEVEMENTS','HS_SEMS','HS_SUBJECTS','HS_TYPE_COLOR','APPSTORE_APPS','RECOMMENDED_SITES','SW_DATA','LP_METHODS','LP_EVAL_METHODS'];
  eval(dataSrc + '\n' + g.map(n=>`try{globalThis.${n}=${n};}catch(e){}`).join(''));
} catch(e) {
  console.log('data.js 로드 실패:', e.message);
}

const files = readdirSync(assetsDir).filter(f => f.endsWith('.js'));

// ── [1] import/export 정합성 ────────────────────────────────
head('[1] import/export 정합성');
const exp = {};
for (const f of files) {
  const c = readFileSync(join(assetsDir,f),'utf8');
  const names = new Set();
  for (const m of c.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g)) names.add(m[1]);
  for (const m of c.matchAll(/export\s*\{([^}]+)\}/g)) for (let n of m[1].split(',')) { n=n.replace(/\s+as\s+.*/,'').trim(); if(n) names.add(n); }
  exp[f] = names;
}
let impProblems = 0;
for (const f of files) {
  const c = readFileSync(join(assetsDir,f),'utf8');
  for (const m of c.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]\.\/([A-Za-z0-9_]+\.js)['"]/g)) {
    const mod = m[2];
    for (let name of m[1].split(',')) {
      name = name.replace(/\s+as\s+.*/,'').trim(); if (!name) continue;
      if (!exp[mod]) { fail(`${f}: 모듈 '${mod}' 없음`); impProblems++; }
      else if (!exp[mod].has(name)) { fail(`${f}: '${name}' 를 ${mod} 가 export 안 함`); impProblems++; }
    }
  }
}
if (!impProblems) ok(`${files.length}개 모듈, 모든 import가 export와 일치`);

// ── [2] 파일별 문법 (개별 import로 SyntaxError 지목) ─────────
head('[2] 파일별 문법');
let syntaxBad = 0;
for (const f of files) {
  try {
    await import(pathToFileURL(join(assetsDir,f)).href);
  } catch (e) {
    if (e instanceof SyntaxError) { fail(`${f}: 문법 오류 — ${e.message.split('\n')[0]}`); syntaxBad++; }
    // ReferenceError/TypeError 등은 [3]에서 종합 판단
  }
}
if (!syntaxBad) ok('모든 파일 문법 정상');

// ── [3] 전체 그래프 로드 + init 실행 ────────────────────────
head('[3] 전체 그래프 로드 + init 실행 (app.js)');
let initOk = false;
try {
  await import(pathToFileURL(join(assetsDir,'app.js')).href);
  initOk = true;
  ok('app.js 및 전 의존 모듈 로드 + 초기화 무사 실행');
} catch (e) {
  fail(`init 중 오류 — ${(e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e)}`);
}

// ── [4] 서비스워커 프리캐시 파일 존재 ───────────────────────
head('[4] 서비스워커 프리캐시 파일 존재');
try {
  const sw = readFileSync(join(root,'sw.js'),'utf8');
  const arr = sw.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/);
  const cacheVer = (sw.match(/const CACHE\s*=\s*'([^']+)'/) || [])[1] || '?';
  if (arr) {
    const paths = [...arr[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).filter(p=>p!=='./');
    let missing = 0;
    for (const p of paths) {
      if (existsSync(join(root, p.replace(/^\.\//,'')))) { /* 존재 */ }
      else { fail(`ASSETS에 있으나 파일 없음: ${p}`); missing++; }
    }
    if (!missing) ok(`캐시 ${cacheVer} — 프리캐시 ${paths.length}개 파일 모두 존재`);
  } else fail('sw.js 에서 ASSETS 배열을 찾지 못함');
} catch(e) { fail('sw.js 읽기 실패: ' + e.message); }

// ── [5] 계산 로직 단위 테스트 ───────────────────────────────
head('[5] 계산 로직 단위 테스트 (gradecalc · chasi · evalplan)');
try {
  const { runAllTests } = await import(pathToFileURL(join(root, 'tools', 'test.mjs')).href);
  const r = runAllTests();
  if (r.fail === 0) ok(`${r.pass}건 전부 통과 (${r.parts.map(([n, p]) => n + ' ' + p.pass).join(' · ')})`);
  else r.fails.forEach(f => fail('단위테스트 — ' + f));
} catch (e) {
  fail('test.mjs 실행 실패 — ' + (e && e.message ? e.message : e));
}

// ── 최종 판정 ───────────────────────────────────────────────
console.log('\n' + '─'.repeat(48));
if (failures === 0) {
  console.log('\x1b[42m\x1b[30m ✅ 모든 검증 통과 — 배포 안전 \x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[41m\x1b[37m ❌ ${failures}개 문제 발견 — 배포 중단 권장 \x1b[0m`);
  process.exit(1);
}
