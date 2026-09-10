import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, extname, sep, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
let pw;
for (const name of [process.env.JUNGLE_PLAYWRIGHT,'playwright',join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {try {pw=require(name);break;} catch {}}
if(!pw) throw Error('Playwright 필요: tools/README.md 참조');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.split('/').some(p=>p.startsWith('.')))throw Error('private');const file=resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+sep))throw Error('path');const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await pw.chromium.launch({channel:process.env.JUNGLE_BROWSER||'msedge',headless:true});
 await mkdir(join(root,'.ui-review'),{recursive:true});
 for(const width of [360,1280]) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port;

  await page.goto(base+'/#fav');await page.locator('#siteSearch').waitFor();
  const total=await page.locator('#siteResults .fav-card').count();assert.ok(total>20);
  await page.locator('#siteSearch').fill('ＰＹＴＨＯＮ');assert.equal(await page.locator('#siteResults .fav-card-name').first().innerText(),'Python Tutor');
  await page.locator('[data-category="0"]').click();assert.equal(await page.locator('#siteResults .fav-card').count(),0);assert.ok(await page.locator('.rs-empty').isVisible());
  await page.locator('[data-category="null"]').click();assert.ok(await page.locator('#siteResults .fav-card').count()>0);
  await page.locator('[data-onclick="rs:reset"]').click();assert.equal(await page.locator('#siteResults .fav-card').count(),total);
  await page.locator('[data-category="3"]').click();assert.equal(await page.locator('#siteResults .fav-category').count(),1);
  await page.locator('#siteSearch').fill('코드 실행');assert.ok(await page.locator('#siteResults .fav-card').count()>0);
  await page.locator('#siteSearch').fill('<script>');assert.equal(await page.locator('#siteResults .fav-card').count(),0);
  await page.locator('[data-onclick="rs:reset"]').click();await page.locator('#siteSearch').fill('퀴즈');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:join(root,'.ui-review','resources-'+width+'.png')});
  await page.goto(base+'/#swrec');await page.reload();await page.locator('.sw-card').first().waitFor();
  const cards=page.locator('.sw-card');assert.equal(await cards.count(),9);
  for(const card of await cards.all())assert.equal(await card.locator('a.sw-btn').count(),1);
  assert.equal(await page.locator('.sw-card-name').filter({hasText:'Goodnotes'}).count(),1);
  assert.equal(await page.locator('.sw-card-name').filter({hasText:'Notability'}).count(),1);
  await page.screenshot({path:join(root,'.ui-review','tools-'+width+'.png')});
  await page.locator('[data-onclick="rs:os"]').filter({hasText:'Windows'}).click();
  assert.equal(await page.locator('.sw-card:visible').count(),3);
  await page.locator('[data-onclick="rs:os"]').filter({hasText:'전체'}).click();
  assert.equal(await page.locator('.sw-card:visible').count(),9);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log(width+'px: 사이트 검색·분류 조합·빈 결과·초기화·도구 링크·넘침 PASS');await context.close();
 }
} finally {await browser?.close();server.close();}
