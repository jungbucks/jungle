// --- Constants (ES Module) ---
// SUBJECTS, ACHIEVEMENTS are globals from data.js (classic script)

export const STANDARDS_IDS = ['middle','high','ai','ds','sw','cs','prog'];
export const HS_SUBTAB_ORDER = STANDARDS_IDS.map(id => SUBJECTS.findIndex(s => s.id === id));
export const HS_SUBTAB_LABELS = ['중학교 정보', '고등학교 정보 (일반선택)', '인공지능 기초 (진로선택)', '데이터 과학 (진로선택)', '소프트웨어와 생활 (융합선택)', '정보과학 (과학계열 진로선택)', '프로그래밍 (전문교과)'];

export const NON_SUBJECT_TYPES = ['overview','simulator','evalplan','fav','textbook','swrec','chasi','appstore','aitools'];

// 메뉴 구조의 단일 원천 (2026-10): 상단 메뉴·모바일 드로어·홈 섹션이 모두 이 순서와 묶음을 쓴다.
// 화면 이름은 SUBJECTS(data.js)의 name이 원천 — 여기엔 순서·묶음과 묶음 이름만 둔다.
//   kind 'subject' = 메뉴 1개(=SUBJECTS id), 'standards' = 성취기준 7과목 묶음, 'library' = 자료실(메뉴에선 낱개로 펼침)
export const NAV = [
  { kind: 'subject', id: 'overview' },
  { kind: 'standards', label: '성취기준' },
  { kind: 'subject', id: 'evalplan' },
  { kind: 'subject', id: 'aitools' },
  { kind: 'library', label: '자료실', ids: ['textbook', 'fav', 'swrec', 'appstore'] },
];
export const LP_SEM_DEFAULTS = { 1:{startMW:'3/1',endMW:'7/2'}, 2:{startMW:'8/2',endMW:'1/2'} };

// 홈 카드 한 줄 설명(단일 원천). 성취기준 과목은 학교급·선택 유형, 자료실은 용도.
export const HOME_CARD_META = {
  overview:  { label:'교육과정', desc:'교육과정 체계·중고 비교·선택과목 가이드·시뮬레이터' },
  middle:    { label:'중학', desc:'중학교 · 공통 과목' },
  high:      { label:'고등', desc:'고등학교 · 일반선택' },
  ai:        { label:'AI',  desc:'고등학교 · 진로선택' },
  ds:        { label:'DS',  desc:'고등학교 · 진로선택' },
  sw:        { label:'SW',  desc:'고등학교 · 융합선택' },
  cs:        { label:'CS',  desc:'고등학교 · 과학계열 진로선택' },
  prog:      { label:'전문', desc:'고등학교 · 전문교과' },
  evalplan:  { label:'계획', desc:'차시부터 성적까지 한 흐름으로', tags:['차시계산기','수업계획','평가계획','루브릭','정기시험 출제','성적 산출'] },
  aitools:   { label:'AI', desc:'Gemini로 코드 변형·수업 아이디어', tags:['코드 변형 생성기','AI 수업 아이디어'] },
  simulator: { label:'시뮬', desc:'고등학교 과목 배치 시뮬레이션' },
  textbook:  { label:'교과서', desc:'인정교과서 목록·e북 바로가기' },
  fav:       { label:'사이트', desc:'수업에 바로 쓰는 사이트 모음' },
  swrec:     { label:'SW',  desc:'업무·수업용 추천 소프트웨어' },
  appstore:  { label:'앱',  desc:'정보 선생님이 만든 웹앱·프로그램' },
};

export const ALL_ITEMS = {};
Object.values(ACHIEVEMENTS).forEach(arr => arr.forEach(item => { ALL_ITEMS[item.code] = item; }));

export const CORE_ELEMENTS = [
  { domain:'컴퓨팅 시스템',
    mid: ['컴퓨팅 시스템의 동작 원리','운영 체제의 기능','피지컬 컴퓨팅의 개념'],
    high:['네트워크의 구성','사물인터넷 시스템의 구성 및 동작 원리'] },
  { domain:'데이터',
    mid: ['디지털 데이터 표현 방법','데이터 수집과 관리','데이터 구조화 및 해석'],
    high:['디지털 데이터 압축과 암호화','빅데이터 개념과 분석'] },
  { domain:'알고리즘과 프로그래밍',
    mid: ['문제 추상화','알고리즘 표현 방법','순차적인 데이터 저장','논리 연산','중첩 제어 구조','함수와 디버깅'],
    high:['문제 분해와 모델링','정렬·탐색 알고리즘','자료형','표준입출력과 파일입출력','다차원 데이터 활용','제어 구조의 응용','클래스와 인스턴스'] },
  { domain:'인공지능',
    mid: ['인공지능의 개념과 특성','인공지능 시스템'],
    high:['지능 에이전트의 역할','기계학습의 개념과 유형'] },
  { domain:'디지털 문화',
    mid: ['디지털 사회와 직업','디지털 윤리','개인 정보와 저작권'],
    high:['디지털 사회와 진로','정보 보호와 보안'] },
];
