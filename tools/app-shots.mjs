// app-shots.mjs — '선생님이 만든 웹앱' 썸네일을 실제 앱 화면으로 다시 찍는다 (로컬 전용 도구)
//
// 앱 목록은 assets/data.js의 APPSTORE_APPS 하나만 읽는다(단일 출처).
// 각 앱 url을 헤드리스 Edge로 열고, 화면이 가라앉으면 찍어서 thumb 경로(1120×630 PNG)에 덮어쓴다.
// 사이트에 Playwright를 넣는 게 아니다 — 이 PC에서 썸네일 파일만 만든다. 서비스워커 프리캐시 대상 아님.
//
// 사용법:
//   node tools/app-shots.mjs --list                 앱 id·대상 파일·앱별 설정 보기
//   node tools/app-shots.mjs --out .app-shots       미리보기(사이트 이미지 안 건드림) + 모아보기 _sheet.png
//   node tools/app-shots.mjs                        전부 다시 찍어 images/apps/ 에 덮어쓰기
//   node tools/app-shots.mjs --only sort-lab,cipher 일부만
//   node tools/app-shots.mjs --dry-run              무엇을 할지만 출력(브라우저 안 띄움)
//
// 모듈: 정글은 npm이 없으므로 Playwright·sharp를 다른 폴더에서 빌려 온다.
//   JUNGLE_PLAYWRIGHT=<playwright 폴더>  JUNGLE_SHARP=<sharp 폴더>  JUNGLE_BROWSER=msedge(기본)
// 메모리가 작은 PC 기준: 브라우저 1개·페이지 1개씩, 끝나면 모두 닫는다.

import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// ── 결과 규격 (기존 썸네일과 동일: 16:9, 카드 2배 밀도) ──
const OUT_W = 1120, OUT_H = 630;
// 기본 뷰포트: 1120보다 좁게 잡아 확대 → 카드(약 360px 폭)에서도 글자가 읽힌다.
const DEFAULT_VIEWPORT = { width: 960, height: 540 };

// ── 앱별 설정 (키 = thumb 파일 이름에서 확장자를 뺀 것) ──
// viewport: {width,height}  wait: 가라앉은 뒤 추가 대기 ms  hide: 숨길 CSS 선택자 배열
// storage: 첫 방문 안내를 건너뛰는 localStorage 값  css: 추가 CSS
// steps: [{click:'선택자'}|{press:'키'}|{scroll:픽셀}|{wait:ms}|{eval:'JS 식'}]  skip: '사유'(찍지 않음)
const SHOTS = {
  'markdown':     {},
  'py_visual':    {},
  'data-science': {},
  'sort-lab':     { steps: [{ scroll: 150 }] },        // 카드 줄이 잘리지 않게 탭부터
  'sw-life':      {},
  'cipher':       { storage: { cipher_intro_seen: '1' }, steps: [{ scroll: 250 }] },  // 첫 화면에 휠·조작부가 다 보임(2026-11-02 개편), 첫 방문 안내는 건너뜀
  'teacher-pay':  {},
};

// ── 인자 ──
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const outDir = opt('--out') ? resolve(root, opt('--out')) : null;
const dryRun = flag('--dry-run');

// ── 앱 목록: data.js에서 직접 ──
function loadApps() {
  const src = readFileSync(join(root, 'assets', 'data.js'), 'utf8');
  const apps = (0, eval)(src + '\n;APPSTORE_APPS');
  return apps.map(a => {
    const id = basename(a.thumb || a.url.replace(/\/+$/, ''), extname(a.thumb || ''));
    const thumbIsPng = (a.thumb || '').toLowerCase().endsWith('.png');
    const rel = thumbIsPng ? a.thumb : `images/apps/${id}.png`;
    return { id, name: a.name, url: a.url, thumb: a.thumb, rel, thumbIsPng, cfg: SHOTS[id] || {} };
  });
}

function kb(p) { try { return Math.round(statSync(p).size / 1024) + 'KB'; } catch { return '-'; } }

function loadModule(envName, candidates, label) {
  for (const c of [process.env[envName], ...candidates].filter(Boolean)) {
    try { return require(c); } catch {}
  }
  throw Error(`${label}을(를) 찾지 못했습니다. ${envName}에 설치 폴더를 지정하세요.`);
}

let apps = loadApps();
const unknown = only?.filter(id => !apps.some(a => a.id === id));
if (unknown?.length) { console.error('없는 id:', unknown.join(', '), '\n가능한 id:', apps.map(a => a.id).join(', ')); process.exit(1); }
if (only) apps = apps.filter(a => only.includes(a.id));

if (flag('--list') || dryRun) {
  for (const a of apps) {
    const target = outDir ? join(outDir, a.id + '.png') : join(root, a.rel);
    console.log(`${a.id.padEnd(14)} ${a.cfg.skip ? '[건너뜀: ' + a.cfg.skip + ']' : '→ ' + target}`);
    console.log(`${''.padEnd(14)} ${a.url}`);
    if (Object.keys(a.cfg).length) console.log(`${''.padEnd(14)} 설정 ${JSON.stringify(a.cfg)}`);
    if (!a.thumbIsPng) console.log(`${''.padEnd(14)} ⚠ data.js thumb(${a.thumb})가 PNG가 아님 → ${a.rel}로 저장, data.js·sw.js 경로를 바꿔야 함`);
  }
  if (dryRun) console.log('\n(--dry-run: 브라우저를 띄우지 않았습니다)');
  process.exit(0);
}

const pw = loadModule('JUNGLE_PLAYWRIGHT', ['playwright', 'playwright-core', 'D:/Works/token_economy/node_modules/playwright'], 'Playwright');
const sharp = loadModule('JUNGLE_SHARP', ['sharp', 'D:/Works/sih26/node_modules/sharp'], 'sharp');

if (outDir) mkdirSync(outDir, { recursive: true });

const BASE_CSS = `
  html,body{scrollbar-width:none!important}
  ::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}
  *,*::before,*::after{caret-color:transparent!important}
`;

async function shoot(browser, a) {
  const cfg = a.cfg;
  const vp = cfg.viewport || DEFAULT_VIEWPORT;
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: OUT_W / vp.width,
    locale: 'ko-KR',
    reducedMotion: cfg.motion === 'on' ? 'no-preference' : 'reduce',
    colorScheme: 'light',
  });
  try {
    if (cfg.storage) {
      await ctx.addInitScript(s => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch {} }, cfg.storage);
    }
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    let res;
    try {
      res = await page.goto(a.url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      if (!/Timeout/i.test(e.message)) throw e;
      res = await page.goto(a.url, { waitUntil: 'load', timeout: 30000 }); // 폴링하는 페이지 대비
    }
    if (!res) throw Error('응답 없음');
    if (res.status() >= 400) throw Error(`HTTP ${res.status()}`);
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page.addStyleTag({ content: BASE_CSS + (cfg.css || '') + (cfg.hide || []).map(s => `${s}{display:none!important}`).join('') });
    for (const st of cfg.steps || []) {
      if (st.click) await page.click(st.click);
      else if (st.press) await page.keyboard.press(st.press);
      else if (st.scroll != null) await page.evaluate(y => window.scrollTo(0, y), st.scroll);
      else if (st.eval) await page.evaluate(st.eval);
      if (st.wait) await page.waitForTimeout(st.wait);
    }
    await page.waitForTimeout(cfg.wait ?? 1200);
    const raw = await page.screenshot({ type: 'png' });
    const target = outDir ? join(outDir, a.id + '.png') : join(root, a.rel);
    const before = kb(target);
    const img = sharp(raw).resize(OUT_W, OUT_H, { fit: 'cover', position: 'top' });
    // 거의 한 가지 색이면 빈 화면/로딩으로 의심
    const { channels } = await sharp(raw).stats();
    const spread = Math.max(...channels.slice(0, 3).map(c => c.stdev));
    await img.png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 }).toFile(target);
    return { status: spread < 6 ? '의심(거의 단색)' : '갱신', before, after: kb(target), target };
  } finally {
    await ctx.close().catch(() => {});
  }
}

const rows = [];
let browser;
try {
  browser = await pw.chromium.launch({ channel: process.env.JUNGLE_BROWSER || 'msedge', headless: true });
  for (const a of apps) {
    if (a.cfg.skip) { rows.push({ id: a.id, status: '건너뜀', note: a.cfg.skip }); continue; }
    process.stdout.write(`… ${a.id} `);
    try {
      const r = await shoot(browser, a);
      rows.push({ id: a.id, status: r.status, before: r.before, after: r.after, note: a.thumbIsPng ? '' : `data.js thumb → ${a.rel} 필요` , target: r.target });
      console.log(r.status);
    } catch (e) {
      rows.push({ id: a.id, status: '실패', note: e.message.split('\n')[0].slice(0, 80) });
      console.log('실패');
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
}

// ── 요약표 ──
console.log('\n' + ['id'.padEnd(14), '결과'.padEnd(10), '이전'.padStart(7), '이후'.padStart(7), '  비고'].join(' '));
for (const r of rows) console.log([r.id.padEnd(14), r.status.padEnd(10), (r.before || '').padStart(7), (r.after || '').padStart(7), '  ' + (r.note || '')].join(' '));

// ── 모아보기(contact sheet) ──
const done = rows.filter(r => r.target && existsSync(r.target));
const sheetPath = opt('--sheet') ? resolve(root, opt('--sheet')) : (outDir ? join(outDir, '_sheet.png') : null);
if (sheetPath && done.length) {
  const cw = 560, ch = 315, gap = 16, cols = 3;
  const rowsN = Math.ceil(done.length / cols);
  const tiles = await Promise.all(done.map(async (r, i) => ({
    input: await sharp(r.target).resize(cw, ch).png().toBuffer(),
    left: gap + (i % cols) * (cw + gap), top: gap + Math.floor(i / cols) * (ch + gap),
  })));
  await sharp({ create: { width: gap + cols * (cw + gap), height: gap + rowsN * (ch + gap), channels: 3, background: '#e5e7eb' } })
    .composite(tiles).png().toFile(sheetPath);
  console.log('\n모아보기:', sheetPath, '(순서:', done.map(r => r.id).join(', ') + ')');
}

process.exit(rows.some(r => r.status === '실패') ? 1 : 0);
