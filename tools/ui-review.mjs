import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, dirname, extname, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '.ui-review');
const mode = process.argv[2] || 'serve';
if (!['serve', 'before', 'after'].includes(mode)) throw Error('사용법: node tools/ui-review.mjs [serve|before|after]');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ico':'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // 개발용 서버에서도 저장소 메타데이터나 비공개 파일은 노출하지 않는다.
    if (name.split('/').some(p => p.startsWith('.') && p !== '.ui-review')) { res.writeHead(403).end(); return; }
    const path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(mode === 'serve' ? 4173 : 0, '127.0.0.1', ok); });
const base = `http://127.0.0.1:${server.address().port}`;
if (mode === 'serve') {
  console.log(`미리보기: ${base}\n전후 비교: ${base}/.ui-review/index.html\n종료: Ctrl+C`);
} else {
  let browser;
  try {
    const require = createRequire(import.meta.url);
    let pw;
    for (const candidate of [process.env.JUNGLE_PLAYWRIGHT, 'playwright', join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
      try { pw = require(candidate); break; } catch {}
    }
    if (!pw) throw Error('Playwright를 찾지 못했습니다. JUNGLE_PLAYWRIGHT에 설치 경로를 지정하세요. 자세한 내용: tools/README.md');
    browser = await pw.chromium.launch({ channel: process.env.JUNGLE_BROWSER || 'msedge', headless:true });
    await mkdir(join(output, mode), { recursive:true });
    const results = [];
    for (const [device, width, height] of [['desktop',1280,900], ['mobile',360,800]]) {
      const context = await browser.newContext({ viewport:{width,height}, serviceWorkers:'block', reducedMotion:'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base, { waitUntil:'domcontentloaded' });
      // 정적 셸이 아닌 초기화 완료된 실제 메뉴를 사용한다.
      const textbookMenu = page.locator('#tabs [data-onclick="app:subject"]').filter({hasText:'교과서'});
      await textbookMenu.waitFor({state:'attached'});
      // 모바일에서는 같은 내비게이션의 데스크톱 버튼이 숨겨져 있다.
      await textbookMenu.evaluate(el => el.click());
      await page.locator('#tbkSearch').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({path:join(output,mode,`${device}.png`),fullPage:true,animations:'disabled'});
      await page.locator('#tbkSearch').fill('길벗');
      if (await page.locator('.tbk-section:visible .tbk-row:visible').count() !== 1) throw Error(`${device}: 출판사 검색 실패`);
      await page.locator('[data-section="tbk-ai"]').click();
      if (await page.locator('#tbk-ai .tbk-row:visible').count() !== 1) throw Error(`${device}: 과목 전환 실패`);
      await page.locator('#tbkSearch').fill('없는출판사');
      if (!await page.locator('#tbk-ai .tbk-empty').isVisible()) throw Error(`${device}: 빈 결과 안내 누락`);
      await page.locator('#tbkSearch').fill('');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`${device}: 가로 넘침`);
      if (errors.length) throw Error(errors.join('\n'));
      results.push(`${device}: 검색·과목 전환·빈 결과·가로 넘침 검사 통과`);
      await context.close();
    }
    await writeFile(join(output,mode,'result.json'), JSON.stringify({at:new Date().toISOString(),results},null,2));
    let html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>정글 화면 검토</title><style>body{font:16px system-ui;margin:24px;background:#f5f5f5}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{max-width:100%;border:1px solid #ccc}article{min-width:0} @media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>교과서 화면 전후 비교</h1><p>자동 검사는 동작 오류를 확인합니다. 글자 잘림, 정보 위계와 여백은 화면을 보고 판단하세요.</p>';
    for (const device of ['desktop','mobile']) {
      html += `<h2>${device}</h2><section>`;
      for (const stage of ['before','after']) {
        let exists = true; try { await access(join(output,stage,`${device}.png`)); } catch { exists = false; }
        html += `<article><h3>${stage === 'before' ? '수정 전' : '수정 후'}</h3>${exists ? `<img src="${stage}/${device}.png" alt="${device} ${stage}">` : '<p>아직 캡처하지 않았습니다.</p>'}</article>`;
      }
      html += '</section>';
    }
    await writeFile(join(output,'index.html'), html + '</html>');
    console.log(results.join('\n') + `\n화면 저장: ${join(output,mode)}\n비교: node tools/ui-review.mjs serve → http://127.0.0.1:4173/.ui-review/index.html`);
  } finally { if (browser) await browser.close(); server.close(); }
}
