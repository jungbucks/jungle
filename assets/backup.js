import { uiToast, uiConfirm } from './utils.js';

// --- 데이터 백업/복원 (localStorage 소실 대비) ---
// Gemini API 키는 보안상 제외. 성적 산출기의 번호·점수는 애초에 비영속(개인정보 방침)이라 백업 대상 아님.
// 새 localStorage 키를 만들면 이 화이트리스트에도 추가할 것.
const BACKUP_KEYS = ['collected', 'jungle_rubric', 'jungle_lesson_plan', 'jungle_evalplan', 'jungle_chasi', 'jungle_gradecalc', 'jungle_darkmode'];

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
  uiToast('백업 파일을 내려받았습니다. 다른 PC의 정글에서 복원할 수 있습니다.');
}

export function backupImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const obj = JSON.parse(String(reader.result));
      if (!obj || obj.app !== 'jungle-backup' || typeof obj.data !== 'object') throw new Error('format');
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
