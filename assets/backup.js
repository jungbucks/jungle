import { uiToast, uiConfirm } from './utils.js';

// --- 데이터 백업/복원 (localStorage 소실 대비) ---
// Gemini API 키는 보안상 제외. 성적 산출기의 번호·점수는 애초에 비영속(개인정보 방침)이라 백업 대상 아님.
// 새 localStorage 키를 만들면 이 화이트리스트에도 추가할 것.
const BACKUP_KEYS = ['jungle_last_backup', 'jungle_backup_nag', 'jungle_plan_ctx', 'jungle_collected', 'jungle_rubric', 'jungle_lesson_plan', 'jungle_evalplan', 'jungle_regexam', 'jungle_chasi', 'jungle_gradecalc', 'jungle_darkmode'];

export function backupExport() {
  const payload = { app: 'jungle-backup', version: 1, exported: new Date().toISOString(), data: {} };
  BACKUP_KEYS.forEach(k => {
    try { const v = localStorage.getItem(k); if (v !== null) payload.data[k] = v; } catch (e) {}
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `정글_백업_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try { localStorage.setItem('jungle_last_backup', new Date().toISOString()); } catch (e) {}
  const nag = document.getElementById('backupNag');
  if (nag) nag.hidden = true;
  uiToast('백업 파일을 내려받았습니다. 다른 PC의 정글에서 복원할 수 있습니다.');
}

// --- 백업 리마인더 (2026-10) ---
// 수업/평가 데이터가 있는데 14일 넘게 백업하지 않았으면 닫을 수 있는 배너로 권한다.
// 한 번도 백업하지 않았다면 데이터를 처음 본 날(jungle_backup_nag.since)부터 센다. 닫으면 14일 뒤 다시.
const NAG_DAYS = 14, DAY = 86400000;
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
export function hasPlanData() {
  return ['jungle_lesson_plan', 'jungle_evalplan', 'jungle_rubric'].some(k => {
    const d = readJSON(k);
    return d && d.slots && Object.values(d.slots).some(s => s && s.generated);
  });
}
export function backupNagState(now = Date.now()) {
  if (!hasPlanData()) return { show: false };
  const nag = readJSON('jungle_backup_nag') || {};
  let last = null;
  try { last = localStorage.getItem('jungle_last_backup'); } catch (e) {}
  const lastMs = last ? Date.parse(last) : NaN;
  if (!last && !nag.since) { nag.since = new Date(now).toISOString(); try { localStorage.setItem('jungle_backup_nag', JSON.stringify(nag)); } catch (e) {} }
  const ref = !isNaN(lastMs) ? lastMs : Date.parse(nag.since);
  const dismissed = nag.dismissedAt ? Date.parse(nag.dismissedAt) : 0;
  const days = Math.floor((now - ref) / DAY);
  return { show: now - ref > NAG_DAYS * DAY && now - dismissed > NAG_DAYS * DAY, days, never: isNaN(lastMs) };
}
export function initBackupNag() {
  const el = document.getElementById('backupNag');
  if (!el) return;
  const st = backupNagState();
  el.hidden = !st.show;
  if (!st.show) return;
  el.innerHTML = '<p><strong>백업해 두세요.</strong> 수업·평가 데이터는 이 브라우저에만 저장됩니다. '
    + (st.never ? '아직 한 번도 백업하지 않았습니다.' : '마지막 백업이 ' + st.days + '일 전입니다.') + '</p>'
    + '<button type="button" class="pbtn pri" id="backupNagNow">지금 백업</button>'
    + '<button type="button" class="backup-nag-close" id="backupNagClose" aria-label="백업 안내 닫기">닫기</button>';
  el.querySelector('#backupNagNow').addEventListener('click', () => backupExport());
  el.querySelector('#backupNagClose').addEventListener('click', () => {
    const nag = readJSON('jungle_backup_nag') || {};
    nag.dismissedAt = new Date().toISOString();
    try { localStorage.setItem('jungle_backup_nag', JSON.stringify(nag)); } catch (e) {}
    el.hidden = true;
  });
}

export function backupImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const obj = JSON.parse(String(reader.result));
      if (!obj || obj.app !== 'jungle-backup' || typeof obj.data !== 'object') throw new Error('format');
      // 2026-10 이전 백업 파일은 담은 성취기준을 'collected' 키로 담고 있다
      if (typeof obj.data.collected === 'string' && typeof obj.data.jungle_collected !== 'string') obj.data.jungle_collected = obj.data.collected;
      const keys = BACKUP_KEYS.filter(k => typeof obj.data[k] === 'string'); // 화이트리스트 밖 키는 무시
      if (!keys.length) throw new Error('empty');
      const when = obj.exported ? obj.exported.slice(0, 10) : '날짜 미상';
      if (!(await uiConfirm(`백업 파일(${when})의 데이터 ${keys.length}종으로 현재 데이터를 덮어씁니다. 계속할까요?`, { okLabel: '덮어쓰기' }))) return;
      keys.forEach(k => { try { localStorage.setItem(k, obj.data[k]); } catch (e) {} });
      location.reload(); // 모듈 상태를 통째로 다시 읽는 가장 확실한 방법
    } catch (e) {
      uiToast('백업 파일을 읽지 못했습니다. 정글에서 내려받은 JSON 파일인지 확인해 주세요.', { isErr: true });
    }
  };
  reader.onerror = () => uiToast('파일을 읽지 못했습니다.', { isErr: true });
  reader.readAsText(file, 'utf-8');
}
