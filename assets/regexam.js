import { esc, trapFocus, releaseFocus, loadState } from './utils.js';
import { evalSubjects } from './evalplan.js';

// --- RegExam State ---
let regExamState = (() => {
  const s = loadState('jungle_regexam', null);
  if (s) {
    s.rows = s.rows.map((r, i) => ({
      num: r.num || i+1,
      topic: r.topic || '',
      stds: r.stds || (r.std ? [r.std] : []),
      level: r.level || '중',
      score: r.score || 0
    }));
    if (!('scoreH' in s)) { s.scoreH = 4; s.scoreM = 3; s.scoreL = 2; }
    return s;
  }
  return { rows: Array.from({length:20}, (_,i) => ({num:i+1, topic:'', stds:[], level:'중', score:0})), scoreH:4, scoreM:3, scoreL:2 };
})();
function regExamSave() { localStorage.setItem('jungle_regexam', JSON.stringify(regExamState)); }
let regExamModalRowIdx = null;
let regExamModalTempSelected = new Set();
let regExamModalSubjectIdx = 1;

function regExamSetCount(n) {
  const cnt = Math.min(30, Math.max(15, parseInt(n) || 20));
  const cur = regExamState.rows;
  if (cnt > cur.length) {
    for (let i = cur.length; i < cnt; i++) cur.push({num:i+1, topic:'', stds:[], level:'중', score:0});
  } else {
    regExamState.rows = cur.slice(0, cnt);
  }
  regExamSave(); regExamRerender();
}
function regExamSet(idx, field, val) {
  regExamState.rows[idx][field] = field === 'score' ? (parseFloat(val) || 0) : val;
  regExamSave();
  if (field === 'score') regExamUpdateTotal();
}
function regExamOpenModal(rowIdx) {
  regExamModalRowIdx = rowIdx;
  regExamModalTempSelected = new Set(regExamState.rows[rowIdx].stds.filter(Boolean));
  regExamModalSubjectIdx = regExamState.rows[rowIdx].modalSubjIdx || 1;
  regExamRenderModalBody();
  const m = document.getElementById('regExamModal');
  m.style.display = 'flex';
  trapFocus(m);
}
function regExamCloseModal() {
  const m = document.getElementById('regExamModal');
  releaseFocus(m);
  m.style.display = 'none';
}
function regExamConfirmModal() {
  const row = regExamState.rows[regExamModalRowIdx];
  row.stds = [...regExamModalTempSelected].sort((a, b) => {
    const na = parseInt(a) || 0, nb = parseInt(b) || 0;
    return na !== nb ? na - nb : a.localeCompare(b, 'ko');
  });
  row.modalSubjIdx = regExamModalSubjectIdx;
  regExamSave(); regExamCloseModal(); regExamRerender();
}
function regExamModalChangeSubject(idx) {
  regExamModalSubjectIdx = +idx;
  regExamRenderModalBody();
}
function regExamToggleStd(code, checked) {
  checked ? regExamModalTempSelected.add(code) : regExamModalTempSelected.delete(code);
  const el = document.getElementById('regExamModalSelCount');
  if (el) el.textContent = regExamModalTempSelected.size + '개 선택됨';
}
function regExamRenderModalBody() {
  const subj = SUBJECTS[regExamModalSubjectIdx];
  const subjs = evalSubjects();
  const selEl = document.getElementById('regExamModalSubjSel');
  if (selEl) selEl.innerHTML = subjs.map(s => {
    const idx = SUBJECTS.indexOf(s);
    return '<option value="' + idx + '"' + (regExamModalSubjectIdx === idx ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  }).join('');
  let html = '';
  if (subj && subj.domains) {
    subj.domains.forEach(function(d) {
      html += '<div><div class="eval-domain-label">' + esc(d.name) + '</div>';
      d.items.forEach(function(it) {
        const chk = regExamModalTempSelected.has(it.code);
        html += '<div class="eval-std-item">'
          + '<input type="checkbox" class="eval-std-chk" ' + (chk ? 'checked' : '') + ' onchange="regExamToggleStd(\'' + it.code.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',this.checked)">'
          + '<span class="eval-std-code" style="background:' + subj.aLight + ';color:' + subj.accent + '">' + esc(it.code) + '</span>'
          + '<span class="eval-std-text">' + esc(it.text) + '</span>'
          + '</div>';
      });
      html += '</div>';
    });
  }
  const bodyEl = document.getElementById('regExamModalBody');
  if (bodyEl) bodyEl.innerHTML = html;
  const cntEl = document.getElementById('regExamModalSelCount');
  if (cntEl) cntEl.textContent = regExamModalTempSelected.size + '개 선택됨';
}
function regExamAddStd(idx) {
  regExamState.rows[idx].stds.push('');
  regExamSave(); regExamRerender();
}
function regExamSetStd(idx, si, val) {
  regExamState.rows[idx].stds[si] = val;
  regExamSave();
}
function regExamRemoveStd(idx, si) {
  regExamState.rows[idx].stds.splice(si, 1);
  regExamSave(); regExamRerender();
}
function regExamUpdateTotal() {
  const total = Math.round(regExamState.rows.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) * 10) / 10;
  const el = document.getElementById('regExamTotal');
  if (!el) return;
  el.textContent = total + '점';
  el.className = 'regexam-total-val' + (Math.abs(total - 100) < 0.001 ? ' ok' : total > 100 ? ' over' : ' under');
}
function regExamAutoScore() {
  const base = { '상': parseFloat(regExamState.scoreH) || 4, '중': parseFloat(regExamState.scoreM) || 3, '하': parseFloat(regExamState.scoreL) || 2 };
  regExamState.rows.forEach(r => { r.score = base[r.level] ?? base['중']; });
  regExamSave(); regExamRerender();
}
function regExamReset() {
  if (!confirm('입력 내용을 모두 초기화할까요?')) return;
  regExamState.rows = Array.from({length:20}, (_,i) => ({num:i+1, topic:'', stds:[], level:'중', score:0}));
  regExamSave(); regExamRerender();
}
function regExamRerender() {
  if (!document.getElementById('main').querySelector('.regexam-wrap')) return;
  document.getElementById('main').innerHTML = renderRegExam();
}
function renderRegExam() {
  const rows = regExamState.rows;
  const cnt  = rows.length;
  const total = Math.round(rows.reduce((s, r) => s + (parseFloat(r.score) || 0), 0) * 10) / 10;
  const totalCls = 'regexam-total-val' + (Math.abs(total - 100) < 0.001 ? ' ok' : total > 100 ? ' over' : ' under');

  const lvStats = { '상': {cnt:0, score:0}, '중': {cnt:0, score:0}, '하': {cnt:0, score:0} };
  rows.forEach(r => {
    const lv = r.level || '중';
    if (lvStats[lv]) { lvStats[lv].cnt++; lvStats[lv].score = Math.round((lvStats[lv].score + (parseFloat(r.score)||0)) * 10) / 10; }
  });
  const lvColors = { '상': '#dc2626', '중': '#2563eb', '하': '#16a34a' };
  const summaryHtml = ['상','중','하'].map(lv => {
    const st = lvStats[lv];
    return `<div class="regexam-sum-item">
      <span class="regexam-sum-badge" style="background:${lvColors[lv]}">${lv}</span>
      <span class="regexam-sum-cnt">${st.cnt}문항</span>
      <span class="regexam-sum-score">${st.score}점</span>
    </div>`;
  }).join('<div class="regexam-sum-sep"></div>');

  const rowsHtml = rows.map((r, i) => {
    const stds = r.stds || [];
    const badgesHtml = stds.map((s, si) =>
      `<span class="regexam-std-badge">${esc(s)}<button class="regexam-std-del" onclick="regExamRemoveStd(${i},${si})" aria-label="${esc(s)} 제거">×</button></span>`
    ).join('');
    return `<tr>
      <td class="regexam-num">${r.num}</td>
      <td><input class="regexam-topic-input" type="text" value="${esc(r.topic||'')}"
          placeholder="출제 주제"
          onchange="regExamSet(${i},'topic',this.value)"></td>
      <td class="regexam-stds-cell">
        ${badgesHtml}
        <button class="regexam-std-add" onclick="regExamOpenModal(${i})">+ 성취기준 선택</button>
      </td>
      <td>
        <select class="regexam-level-sel" onchange="regExamSet(${i},'level',this.value)">
          ${['상','중','하'].map(lv=>`<option${r.level===lv?' selected':''}>${lv}</option>`).join('')}
        </select>
      </td>
      <td><input class="regexam-score-input" type="number" min="0" max="100" step="0.5" value="${r.score||''}"
          placeholder="0"
          oninput="regExamSet(${i},'score',this.value)"></td>
    </tr>`;
  }).join('');

  return `<div class="regexam-wrap">
    <div class="regexam-toolbar">
      <div class="regexam-toolbar-left">
        <label class="regexam-cnt-label">문항 수
          <select class="eval-select" onchange="regExamSetCount(this.value)">
            ${Array.from({length:16},(_,i)=>i+15).map(n=>`<option${n===cnt?' selected':''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="regexam-toolbar-right">
        <span class="regexam-score-preset-label">기준 배점</span>
        <label class="regexam-preset-item">상<input class="regexam-preset-input" type="number" min="0" step="0.5" value="${regExamState.scoreH}" oninput="regExamState.scoreH=parseFloat(this.value)||0;regExamSave()"></label>
        <label class="regexam-preset-item">중<input class="regexam-preset-input" type="number" min="0" step="0.5" value="${regExamState.scoreM}" oninput="regExamState.scoreM=parseFloat(this.value)||0;regExamSave()"></label>
        <label class="regexam-preset-item">하<input class="regexam-preset-input" type="number" min="0" step="0.5" value="${regExamState.scoreL}" oninput="regExamState.scoreL=parseFloat(this.value)||0;regExamSave()"></label>
        <span class="regexam-total-label">총점</span>
        <span id="regExamTotal" class="${totalCls}">${total}점</span>
        <button class="pbtn pri" onclick="regExamAutoScore()">배점 자동계산</button>
        <button class="pbtn sec" onclick="regExamReset()">초기화</button>
      </div>
    </div>
    <div class="regexam-table-wrap">
      <table class="regexam-table">
        <colgroup><col style="width:48px"><col style="width:22%"><col><col style="width:64px"><col style="width:72px"></colgroup>
        <thead><tr>
          <th>번호</th><th>출제 주제</th><th>성취기준</th><th>난이도</th><th>배점(점)</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="4" style="text-align:right;font-weight:700;padding:8px 12px">합계</td>
          <td id="regExamTotalFoot" style="font-weight:700;padding:8px 12px;text-align:center;color:${total===100?'#16a34a':total>100?'#dc2626':'#d97706'}">${total}점</td>
        </tr></tfoot>
      </table>
    </div>
    <p class="regexam-hint">${Math.abs(total-100)<0.001?'✓ 총점이 100점입니다.':total>100?'⚠ 총점이 100점을 초과했습니다 ('+Math.round((total-100)*10)/10+'점 초과)':'⚠ 총점이 100점에 '+Math.round((100-total)*10)/10+'점 부족합니다.'}</p>
    <div class="regexam-summary">
      <span class="regexam-sum-title">난이도별 집계</span>
      ${summaryHtml}
    </div>
  </div>`;
}

export { renderRegExam };
window.regExamSetCount = regExamSetCount;
window.regExamSet = regExamSet;
window.regExamOpenModal = regExamOpenModal;
window.regExamCloseModal = regExamCloseModal;
window.regExamConfirmModal = regExamConfirmModal;
window.regExamModalChangeSubject = regExamModalChangeSubject;
window.regExamToggleStd = regExamToggleStd;
window.regExamAddStd = regExamAddStd;
window.regExamSetStd = regExamSetStd;
window.regExamRemoveStd = regExamRemoveStd;
window.regExamAutoScore = regExamAutoScore;
window.regExamReset = regExamReset;
window.regExamSave = regExamSave;
