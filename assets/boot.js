// boot.js — index.html 인라인 스크립트 외부화 (CSP 'unsafe-inline' 제거 준비 1단계)
// classic script: data.js 다음, app.js(module) 이전에 로드되어야 함

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

/* ES 모듈에서 classic script const 변수에 접근하려면 window에 명시적으로 등록 */
window.SUBJECTS = SUBJECTS;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.HS_SEMS = HS_SEMS;
window.HS_SUBJECTS = HS_SUBJECTS;
window.HS_TYPE_COLOR = HS_TYPE_COLOR;
window.APPSTORE_APPS = APPSTORE_APPS;
window.RECOMMENDED_SITES = RECOMMENDED_SITES;
window.SW_DATA = SW_DATA;
window.LP_METHODS = LP_METHODS;
window.LP_EVAL_METHODS = LP_EVAL_METHODS;
window.AFFECTIVE = AFFECTIVE;
window.AFFECTIVE_VERIFIED = AFFECTIVE_VERIFIED;
