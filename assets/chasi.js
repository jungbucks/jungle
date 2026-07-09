import { esc, loadState, saveState, registerActions, pageHead, uiToast } from './utils.js';

// --- Chasi State ---
let chasiState = (() => {
  const s = loadState('jungle_chasi', null);
  if (s) {
    if (!s.days) {
      const n = s.weeklyHours || (s.dayHours ? s.dayHours.reduce((a,b)=>a+b,0) : 0) || 2;
      s.days = Array.from({length:5}, (_,i) => i < n ? 1 : 0);
    } else if (typeof s.days[0] === 'boolean') {
      s.days = s.days.map(d => d ? 1 : 0);
    }
    if (!('blockTime' in s)) s.blockTime = false;
    delete s.weeklyHours; delete s.dayHours;
    return s;
  }
  const y = new Date().getFullYear();
  return { year:y, semester:1, startDate:`${y}-03-03`, endDate:`${y}-07-11`, days:[1,0,1,0,0], blockTime:false, exceptions:[] };
})();
let chasiExcForm = { label: '', start: '', end: '' };

// --- Chasi Calculator ---
function chasiSave() { saveState('jungle_chasi', chasiState); }
function chasiApplySemesterDefaults() {  
  const y = chasiState.year;  
  if (chasiState.semester === 1) {    
    chasiState.startDate = `${y}-03-03`;    
    chasiState.endDate   = `${y}-07-11`;  
  } else {    
    chasiState.startDate = `${y}-08-18`;    
    chasiState.endDate   = `${y + 1}-01-16`;  
  }
}
function chasiSetYear(y)      { chasiState.year = parseInt(y); chasiApplySemesterDefaults(); chasiSave(); chasiRerender(); }
function chasiSetSemester(n)  { chasiState.semester = n; chasiApplySemesterDefaults(); chasiSave(); chasiRerender(); }
function chasiSetStart(v)     { chasiState.startDate = v; chasiSave(); chasiRerender(); }
function chasiSetEnd(v)       { chasiState.endDate = v; chasiSave(); chasiRerender(); }
function chasiToggleDay(i) {  
  const cur = chasiState.days[i] || 0;  
  chasiState.days[i] = cur > 0 ? 0 : (chasiState.blockTime ? 2 : 1);  
  chasiSave(); chasiRerender();
}
function chasiToggleBlockTime() {  
  chasiState.blockTime = !chasiState.blockTime;  
  // 이미 선택된 요일 시수 일괄 전환  
  chasiState.days = chasiState.days.map(d => d > 0 ? (chasiState.blockTime ? 2 : 1) : 0);  
  chasiSave(); chasiRerender();
}
function chasiExcSetField(f,v){ chasiExcForm[f] = v; }
function chasiAddException() {  
  const { label, start, end } = chasiExcForm;  
  if (!start) return;  
  const effectiveEnd = (end && end >= start) ? end : start;  
  chasiState.exceptions.push({ id: Date.now(), label: label || '수업 없음', start, end: effectiveEnd });  
  chasiExcForm = { label: '', start: '', end: '' };  
  chasiSave(); chasiRerender();
}
async function chasiLoadHolidays() {  
  const { year, semester, startDate, endDate } = chasiState;  
  const btn = document.getElementById('chasiHolidayBtn');  
  if (btn) { btn.textContent = '불러오는 중…'; btn.disabled = true; }  
  try {    
    const years = semester === 2 ? [year, year + 1] : [year];    
    const all = [];    
    for (const y of years) {      
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/KR`);      
      if (!res.ok) throw new Error('응답 오류');      
      all.push(...await res.json());    
    }    
    // 서드파티 응답 검증: 날짜 형식이 어긋난 항목은 저장하지 않음 (localStorage 데이터 무결성)
    const isYmd = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const inRange = all.filter(h => isYmd(h.date) && h.date >= startDate && h.date <= endDate);
    const existing = new Set(chasiState.exceptions.map(e => e.start));
    let added = 0;
    inRange.forEach(h => {
      if (!existing.has(h.date)) {
        chasiState.exceptions.push({ id: Date.now() + added++, label: String(h.localName || '공휴일'), start: h.date, end: h.date });
      }
    });    
    if (added > 0) chasiSave();    
    chasiRerender();    
    // 추가 결과 토스트    
    const msg = added > 0 ? `공휴일 ${added}개가 추가됐습니다.` : '이 기간의 공휴일이 이미 모두 추가되어 있습니다.';    
    chasiToast(msg);  
  } catch(e) {    
    chasiRerender();    
    chasiToast('공휴일을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.', true);  
  }
}
// utils 공용 uiToast로 승격됨 — 호출부 호환용 래퍼
function chasiToast(msg, isErr = false) { uiToast(msg, { isErr }); }
function chasiRemoveException(id) {  
  chasiState.exceptions = chasiState.exceptions.filter(e => e.id !== id);  
  chasiSave(); chasiRerender();
}
function chasiWeeklyAlerts() {  
  const { startDate, endDate, days, exceptions } = chasiState;  
  if (!startDate || !endDate || startDate > endDate) return [];  
  // 제외일 → 어떤 예외 항목인지 매핑  
  const excludedMap = {}; // date → [label, ...]  
  exceptions.forEach(e => {    
    for (let d = new Date(e.start + 'T00:00:00'); d <= new Date(e.end + 'T00:00:00'); d.setDate(d.getDate() + 1)) {      
      const ds = d.toISOString().slice(0, 10);      
      if (!excludedMap[ds]) excludedMap[ds] = [];      
      if (!excludedMap[ds].includes(e.label)) excludedMap[ds].push(e.label);    
    }  
  });  
  // 학기 시작일이 속한 주의 월요일 구하기  
  const semStart = new Date(startDate + 'T00:00:00');  
  const semEnd   = new Date(endDate   + 'T00:00:00');  
  const dow0     = semStart.getDay(); // 0=일  
  const toMonday = dow0 === 0 ? -6 : 1 - dow0;  
  const firstMonday = new Date(semStart);  
  firstMonday.setDate(semStart.getDate() + toMonday);  
  const alerts = [];  
  for (let mon = new Date(firstMonday); mon <= semEnd; mon.setDate(mon.getDate() + 7)) {    
    let expected = 0, actual = 0;    
    const reasons = new Set();    
    for (let i = 0; i < 5; i++) { // 월=0 … 금=4      
      const day = new Date(mon);      
      day.setDate(mon.getDate() + i);      
      const ds = day.toISOString().slice(0, 10);      
      if (ds < startDate || ds > endDate) continue; // 학기 밖      
      const hrs = (days[i] || 0);      
      if (!hrs) continue;      
      expected += hrs;      
      if (excludedMap[ds]) {        
        excludedMap[ds].forEach(l => reasons.add(l));      
      } else {        
        actual += hrs;      
      }    
    }    
    if (expected > 0 && actual < expected) {      
      // 주차 레이블: 월요일 기준 월/주차      
      const month   = mon.getMonth() + 1;      
      const weekNum = Math.ceil(mon.getDate() / 7);      
      const year    = mon.getFullYear();      
      alerts.push({ year, month, weekNum, expected, actual, lost: expected - actual, reasons: [...reasons] });    
    }  
  }  
  return alerts;
}
function chasiCalc() {  
  const { startDate, endDate, days, exceptions } = chasiState;  
  const weeklyHours = (days || []).reduce((a, b) => a + b, 0);  
  if (!startDate || !endDate || startDate > endDate || !weeklyHours) return { total: 0, monthly: [], weeklyHours };  
  const excluded = new Set();  
  exceptions.forEach(({ start, end }) => {    
    for (let d = new Date(start + 'T00:00:00'); d <= new Date(end + 'T00:00:00'); d.setDate(d.getDate() + 1))      
      excluded.add(d.toISOString().slice(0, 10));  
  });  
  const monthMap = {};  
  let total = 0;  
  for (let d = new Date(startDate + 'T00:00:00'); d <= new Date(endDate + 'T00:00:00'); d.setDate(d.getDate() + 1)) {    
    const dow = d.getDay();    
    if (dow === 0 || dow === 6) continue;    
    const hrs = days[dow - 1] || 0;    
    if (!hrs) continue;    
    const ds = d.toISOString().slice(0, 10);    
    if (excluded.has(ds)) continue;    
    total += hrs;    
    const mk = ds.slice(0, 7);    
    monthMap[mk] = (monthMap[mk] || 0) + hrs;  
  }  
  const monthly = Object.entries(monthMap).sort(([a],[b]) => a.localeCompare(b))    
    .map(([month, hours]) => ({ month, hours }));  
  return { total, monthly, weeklyHours };
}
function chasiRerender() {
  if (!document.getElementById('main').querySelector('.chasi-wrap')) return;
  document.getElementById('main').innerHTML = renderChasi();  
  const li = document.getElementById('chasiExcLabelInput');  
  const si = document.getElementById('chasiExcStartInput');  
  const ei = document.getElementById('chasiExcEndInput');  
  if (li) li.value = chasiExcForm.label;  
  if (si) si.value = chasiExcForm.start;  
  if (ei) ei.value = chasiExcForm.end;
}
function renderChasi() {  
  const cs = chasiState;  
  const { total, monthly, weeklyHours } = chasiCalc();  
  const weekAlerts = chasiWeeklyAlerts();  
  // 차시 계산기 가족색 = --teal 토큰 (인라인 style에서 var() 사용)
  const accent = 'var(--teal)', aLight = 'var(--teal-soft)', aDark = 'var(--teal-dark)';
  const ICO = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const icoCal   = ICO('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>');
  const icoCalX  = ICO('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/>');
  const icoChart = ICO('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>');
  const YEARS = [2024,2025,2026,2027];  
  const MN = {'01':'1월','02':'2월','03':'3월','04':'4월','05':'5월','06':'6월',               
              '07':'7월','08':'8월','09':'9월','10':'10월','11':'11월','12':'12월'};  
  const DAYS = ['월','화','수','목','금'];  
  const wh = (cs.days || []).filter(Boolean).length;  
  const excSorted = [...cs.exceptions].sort((a,b) => a.start.localeCompare(b.start));  
  return `<div class="chasi-wrap">
    ${pageHead('수업/평가계획', '차시 계산기', '학사일정과 수업 요일로 학기 총 수업 차시를 계산합니다.')}
    <div class="chasi-cols">
    <div class="chasi-col">
    <div class="chasi-section">
      <div class="chasi-section-title" style="color:${aDark}">${icoCal} 기본 설정</div>
      <div class="chasi-row">        
        <div class="chasi-field">          
          <label class="chasi-label">학년도</label>          
          <select class="chasi-select" data-onchange="ch:year">            
            ${YEARS.map(y => `<option value="${y}"${cs.year===y?' selected':''}>${y}년</option>`).join('')}          
          </select>        
        </div>        
        <div class="chasi-field">          
          <label class="chasi-label">학기</label>          
          <div class="chasi-seg">            
            <button class="chasi-seg-btn${cs.semester===1?' active':''}" data-onclick="ch:semester" data-args="[1]" aria-pressed="${cs.semester===1}"
              style="${cs.semester===1?`background:${accent};color:#fff;border-color:${accent}`:''}">1학기</button>
            <button class="chasi-seg-btn${cs.semester===2?' active':''}" data-onclick="ch:semester" data-args="[2]" aria-pressed="${cs.semester===2}"
              style="${cs.semester===2?`background:${accent};color:#fff;border-color:${accent}`:''}">2학기</button>
          </div>        
        </div>      
      </div>      
      <div class="chasi-row">        
        <div class="chasi-field">          
          <label class="chasi-label">시작일</label>          
          <input class="chasi-input" type="date" value="${cs.startDate}" data-onchange="ch:start">        
        </div>        
        <div class="chasi-field">          
          <label class="chasi-label">종료일</label>          
          <input class="chasi-input" type="date" value="${cs.endDate}" data-onchange="ch:end">        
        </div>      
      </div>      
      <div class="chasi-field">        
        <div class="chasi-label-row">          
          <label class="chasi-label">수업 요일</label>          
          <button class="chasi-block-btn${cs.blockTime?' active':''}" data-onclick="ch:block">            
            블록타임 (2시수)          
          </button>        
        </div>        
        <div class="chasi-days-row">          
          ${DAYS.map((day, i) => {            
            const hrs = (cs.days && cs.days[i]) || 0;            
            const on = hrs > 0;            
            return `<button class="chasi-day-btn${on?' active':''}" data-onclick="ch:day" data-args="[${i}]" aria-pressed="${on}"
              style="${on?`background:${accent};color:#fff;border-color:${accent}`:''}">
              ${day}${hrs===2?`<span class="chasi-day-x2">×2</span>`:''}
            </button>`;          
          }).join('')}          
          <span class="chasi-weekly-badge" style="${wh>0?`color:${aDark}`:'color:var(--g400)'}">            
            ${wh>0?`주당 <strong>${wh}</strong>시수`:'요일을 선택하세요'}          
          </span>        
        </div>      
      </div>    
    </div>    
    <div class="chasi-section">      
      <div class="chasi-section-title" style="color:${aDark}">${icoCalX} 수업 없는 날 / 기간
        <button id="chasiHolidayBtn" class="chasi-holiday-btn" data-onclick="ch:holidays">공휴일 자동 추가</button>
      </div>
      <div class="chasi-exc-form">        
        <input class="chasi-exc-label-input" id="chasiExcLabelInput" type="text"          
          placeholder="사유 (예: 중간고사, 삼일절…)"          
          data-onchange="ch:excLabel">        
        <input class="chasi-exc-date-input" id="chasiExcStartInput" type="date"          
          data-onchange="ch:excStart">        
        <input class="chasi-exc-date-input" id="chasiExcEndInput" type="date"          
          data-onchange="ch:excEnd">        
        <button class="pbtn pri" style="background:${accent};border-color:${accent};white-space:nowrap"          
          data-onclick="ch:addExc">+ 추가</button>      
      </div>      
      <div style="font-size:11px;color:var(--g400);margin:-4px 0 10px">단일 날짜: 시작일만 / 연속 기간: 시작일~종료일 모두 입력</div>      
      ${excSorted.length===0        
        ? `<div style="font-size:13px;color:var(--g400)">공휴일, 시험기간, 학교행사 등을 추가하세요.</div>`        
        : `<div class="chasi-exc-list">            
            ${excSorted.map(e => `              
              <div class="chasi-exc-item">                
                <span class="chasi-exc-dot" style="background:${accent}"></span>                
                <span class="chasi-exc-label">${esc(e.label)}</span>                
                <span class="chasi-exc-date">${e.start===e.end?e.start:`${e.start} ~ ${e.end}`}</span>                
                <button class="chasi-exc-del" data-onclick="ch:rmExc" data-args="[${e.id}]" aria-label="삭제">✕</button>              
              </div>`).join('')}          
          </div>`}    
    </div>
    </div>
    <div class="chasi-col chasi-col-result">
    <div class="chasi-section">
      <div class="chasi-section-title" style="color:${aDark}">${icoChart} 계산 결과</div>
      <div class="chasi-result-total" style="background:${aLight};border-color:${accent}">        
        <span style="color:${aDark};font-size:14px">총 수업 가능 차시</span>        
        <strong style="color:${accent};font-size:32px;line-height:1">${total}</strong>        
        <span style="color:${aDark};font-size:16px;font-weight:600">차시</span>
        ${wh>0?`<span style="margin-left:auto;font-size:12px;color:var(--g400)">주당 ${wh}시수 기준</span>`:''}        
        ${weekAlerts.length>0?`<span style="margin-left:${wh>0?'8':'auto'}px;font-size:12px;color:var(--warn);font-weight:600">${weekAlerts.length}주 변동</span>`:''}
      </div>      
      ${monthly.length>0?`      
      <table class="chasi-monthly-table">        
        <thead><tr>          
          <th style="background:${aDark};text-align:left;border-radius:6px 0 0 0">월</th>          
          <th style="background:${aDark}">차시</th>          
          <th style="background:${aDark};border-radius:0 6px 0 0">분포</th>        
        </tr></thead>        
        <tbody>          
          ${monthly.map(({month,hours}) => {            
            const [y,m] = month.split('-');            
            const pct = total>0?Math.round(hours/total*100):0;            
            return `<tr>              
              <td style="font-weight:600;color:var(--g800)">${y}년 ${MN[m]}</td>              
              <td style="text-align:center;color:${aDark};font-weight:700">${hours}차시</td>              
              <td><div class="chasi-bar-wrap">                
                <div class="chasi-bar" style="width:${pct}%;background:${accent}"></div>                
                <span class="chasi-bar-pct">${pct}%</span>              
              </div></td>            
            </tr>`;          
          }).join('')}          
          <tr class="chasi-total-row">            
            <td>합계</td>            
            <td style="text-align:center;color:${aDark}">${total}차시</td>            
            <td></td>          
          </tr>        
        </tbody>      
      </table>` : ''}      
      ${weekAlerts.length > 0 ? `      
      <div class="chasi-alerts">        
        <div class="chasi-alerts-title">주별 수업 변동</div>
        ${weekAlerts.map(a => {          
          const reasonTxt = a.reasons.length ? ` (${a.reasons.join(', ')})` : '';          
          const isZero = a.actual === 0;          
          return `<div class="chasi-alert-item${isZero ? ' zero' : ''}">            
            <span class="chasi-alert-week">${a.month}월 ${a.weekNum}주차</span>            
            <span class="chasi-alert-msg">              
              ${isZero                
                ? `수업 <strong>${a.expected}차시 전체</strong> 없음`                
                : `수업이 <strong>${a.lost}차시</strong> 빠져요`}            
            </span>            
            ${reasonTxt ? `<span class="chasi-alert-reason">${esc(reasonTxt)}</span>` : ''}          
          </div>`;        }).join('')}      
      </div>` : ''}
    </div>
    </div>
    </div>
  </div>`;
}

export { renderChasi };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'ch:semester': function(el, e, n) { chasiSetSemester(n); },
  'ch:block':    function() { chasiToggleBlockTime(); },
  'ch:day':      function(el, e, i) { chasiToggleDay(i); },
  'ch:holidays': function() { chasiLoadHolidays(); },
  'ch:addExc':   function() { chasiAddException(); },
  'ch:rmExc':    function(el, e, id) { chasiRemoveException(id); },
});
registerActions('change', {
  'ch:year':     function(el) { chasiSetYear(el.value); },
  'ch:start':    function(el) { chasiSetStart(el.value); },
  'ch:end':      function(el) { chasiSetEnd(el.value); },
  'ch:excLabel': function(el) { chasiExcSetField('label', el.value); },
  'ch:excStart': function(el) { chasiExcSetField('start', el.value); },
  'ch:excEnd':   function(el) { chasiExcSetField('end', el.value); },
});
