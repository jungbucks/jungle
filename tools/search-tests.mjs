import assert from 'node:assert/strict';
import './test.mjs';
const { matchesStandard, highlightStandard } = await import('../assets/utils.js');
const item = {code:'[12정01-01]', text:'인공지능을 활용하여 데이터를 분석한다.'};
assert.equal(matchesStandard(item,'인공 지능'),true);
assert.equal(matchesStandard(item,'분석 데이터'),true);
assert.equal(matchesStandard(item,'１２정０１–０１'),true);
assert.equal(matchesStandard(item,'[12정01 − 01]'),true);
assert.equal(matchesStandard(item,'분석 네트워크'),false);
assert.equal(matchesStandard(item,'12정01-02'),false);
assert.equal(matchesStandard(item,'인공지능'),true);
assert.equal(highlightStandard('인공지능','인공 지능'),'<mark>인공지능</mark>');
assert.equal(highlightStandard('인공 지능','인공지능'),'<mark>인공 지능</mark>');
assert.equal(highlightStandard('<데이터> & 분석','분석 데이터'),'&lt;<mark>데이터</mark>&gt; &amp; <mark>분석</mark>');
console.log('검색 회귀 10건 통과');

// 복사 API의 결과가 실제 클립보드 성공 여부와 같아야 한다.
const { clipboardWriteText } = await import('../assets/utils.js');
const savedClipboard = navigator.clipboard, savedCreate = document.createElement, savedExec = document.execCommand;
try {
  document.createElement = () => ({select(){}, remove(){}});
  navigator.clipboard = {writeText: async () => {}};
  assert.equal(await clipboardWriteText('성취기준'), true, '성공 결과 반환');
  navigator.clipboard = {writeText: async () => {throw Error('denied');}};
  document.execCommand = () => false;
  assert.equal(await clipboardWriteText('성취기준'), false, '두 복사 방식 실패');
  document.execCommand = () => true;
  assert.equal(await clipboardWriteText('성취기준'), true, '대체 복사 성공');
  navigator.clipboard = undefined;
  assert.equal(await clipboardWriteText('성취기준'), true, 'clipboard API 없는 환경');
  document.execCommand = () => {throw Error('blocked');};
  assert.equal(await clipboardWriteText('성취기준'), false, '대체 복사 예외');
} finally {navigator.clipboard = savedClipboard; document.createElement = savedCreate; document.execCommand = savedExec;}
console.log('복사 결과 회귀 5건 통과');

const {__rsTest}=await import('../assets/resources.js');
const site={name:'Python Tutor',desc:'코드 실행 흐름 시각화'};
assert.equal(__rsTest.matchesSite(site,'코딩 교육','ＰＹＴＨＯＮ'),true);
assert.equal(__rsTest.matchesSite(site,'코딩 교육','코드 실행'),true);
assert.equal(__rsTest.matchesSite(site,'코딩 교육','코딩'),true);
assert.equal(__rsTest.matchesSite(site,'코딩 교육','없는단어'),false);
assert.equal(__rsTest.filterSites('Python',0).length,0);
assert.ok(__rsTest.filterSites('Python',null).length>0);
console.log('사이트 검색 회귀 6건 통과');
