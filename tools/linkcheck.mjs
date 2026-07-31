// ============================================================
//  외부 링크 생존 점검 (assets/*.js의 http(s) URL)
//  실행:  node tools/linkcheck.mjs           (standalone, 죽은 링크 있으면 exit 1)
//  또는:  node tools/verify.mjs --links        (verify 6번 스텝으로)
//  ⚠️ 네트워크 의존 → pre-commit 게이트엔 넣지 않음(수동/릴리스 전 실행).
//  ⚠️ 소프트 로트(200이나 특정 책이 내려간 경우)는 상태코드로 감지 불가 — 별도 수동 점검 필요.
// ============================================================
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
// 자동 프로브(HEAD/GET·undici)엔 403/ERR이나 실제로는 생존(curl 200 확인) — 오탐 방지 허용목록.
// 여기 도메인은 코드와 무관하게 '생존'으로 처리. 새로 추가 시 반드시 curl 등으로 실제 확인 후.
const ALLOW = ['claude.ai', 'chatgpt.com', 'canva.com', 'perplexity.ai', 'gemini.google.com'];

export function collectUrls() {
  const set = new Set();
  for (const f of readdirSync(assetsDir).filter(f => f.endsWith('.js'))) {
    const c = readFileSync(join(assetsDir, f), 'utf8');
    // 따옴표/백틱으로 둘러싼 문자열 리터럴만 → 괄호 포함 URL도 온전히 캡처.
    for (const m of c.matchAll(/["'`](https?:\/\/[^"'`\s]+)["'`]/g)) {
      const u = m[1];
      if (u.includes('${')) continue;   // 런타임 템플릿(${y}·${model})은 실제 링크 아님 → 제외
      set.add(u);
    }
  }
  return [...set].sort();
}

// HEAD 우선, 4xx/에러면 GET 폴백(HEAD 적대적 서버 대응). AbortSignal.timeout으로 안전한 타임아웃.
async function probe(url, method = 'HEAD') {
  try {
    const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
    if (method === 'HEAD' && res.status >= 400) return probe(url, 'GET');
    return res.status;
  } catch (e) {
    if (method === 'HEAD') return probe(url, 'GET');
    return e.name === 'TimeoutError' ? 'TIMEOUT' : 'ERR';
  }
}

// 일시적 실패(ERR/TIMEOUT)는 1회 재시도 — 게이트 안정성.
async function probeRetry(url) {
  let code = await probe(url);
  if (code === 'ERR' || code === 'TIMEOUT') { await new Promise(r => setTimeout(r, 600)); code = await probe(url); }
  return code;
}

const isAlive = (code, url) =>
  (typeof code === 'number' && code >= 200 && code < 400) ||
  ALLOW.some(d => url.includes(d));   // 허용목록 = 코드 무관 생존

export async function checkLinks(urls = collectUrls(), concurrency = 8) {
  const dead = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async u => ({ url: u, code: await probeRetry(u) })));
    for (const r of results) if (!isAlive(r.code, r.url)) dead.push(r);
  }
  return { checked: urls.length, dead };
}

// ── standalone 실행 ──
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await checkLinks();
  console.log(`외부 링크 ${r.checked}개 점검`);
  if (!r.dead.length) console.log('\x1b[32m✓ 하드 다운 0 — 전부 생존\x1b[0m (소프트 로트는 수동 점검 필요)');
  else { console.log(`\x1b[31m✗ 죽은 링크 ${r.dead.length}개:\x1b[0m`); r.dead.forEach(d => console.log(`  ${d.code}  ${d.url}`)); }
  process.exit(r.dead.length ? 1 : 0);
}
