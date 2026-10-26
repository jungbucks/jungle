// 첫 페인트 전에 테마를 정한다 — CSP(script-src 'self')라 인라인 불가 → <head>에서 동기 로드하는 작은 파일.
// 저장값(jungle_darkmode '1'/'0')이 우선, 없으면 운영체제 설정(prefers-color-scheme)을 따른다.
// 토글·운영체제 설정 변경 반영은 app.js가 맡는다.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('jungle_darkmode'); } catch (e) {}
  var dark = saved === '1' || (saved === null && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
})();
