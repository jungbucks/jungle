/* build-data.mjs — 정글 data.js(SUBJECTS)에서 성취기준을 뽑아 그래프 데이터를 생성.
 * `node tools/build-data.mjs` → data/graph-data.js + 커버리지 리포트(태그 0개 성취기준 목록).
 * 노드 = 성취기준(과목색) + 개념 태그(허브). 엣지 = 성취기준—개념 소속.
 * ⚠️ 개념 태그 사전(TAG_RULES)이 이 프로젝트의 심장 — 규칙 수정 후 반드시 재생성+커버리지 확인.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const JUNGLE_DATA = 'C:/Users/정벅/jungle/assets/data.js';

/* 개념 태그 사전 — [태그명, 정규식]. 서술어(탐색한다 등) 오검출을 피해 명사구 위주로. */
const TAG_RULES = [
  ['네트워크', /네트워크/],
  ['사물인터넷', /사물인터넷/],
  ['피지컬 컴퓨팅', /피지컬 컴퓨팅|웨어러블/],
  ['컴퓨팅 시스템', /컴퓨팅 시스템|운영 체제|운영체제|하드웨어|소프트웨어의 관계/],
  ['디지털 표현', /디지털.{0,6}(표현|변환)|이진수|부호화|아날로그/],
  ['데이터 압축', /압축/],
  ['암호·보안', /암호|보안|정보 ?보호|보호해야 할 정보/],
  ['개인정보', /개인 ?정보/],
  ['저작권', /저작권/],
  ['빅데이터', /빅데이터/],
  ['데이터 수집', /데이터를? *(편향되지 않도록 )?수집|수집한 데이터|필요한 데이터를 선정/],
  ['데이터 분석', /데이터(를| 속| 간의)? *분석|분석 방법|탐색적으로 분석/],
  ['시각화', /시각화/],
  ['데이터베이스', /데이터베이스|데이터셋/],
  ['전처리', /전처리|이상치|결측치|정규화|가공/],
  ['데이터 속성', /속성/],
  ['추상화·모델링', /추상화|모델링|(작은|부분) 문제로 분해|상태를 정의/],
  ['데이터 해석', /데이터 간의 관계|의미를 해석|데이터에 기반|데이터 기반 의사|데이터의 (중요성|가치)|잠재적 가치/],
  ['구조화', /구조화/],
  ['재귀', /재귀/],
  ['테스트·디버깅', /테스트|디버깅|오류/],
  ['프로그래밍 언어', /프로그래밍 언어/],
  ['개발 절차', /개발.{0,8}절차|절차와 단계|기획하는 다양한 방법|수행 계획/],
  ['사례 탐구', /사례를 (조사|중심으로|분석|비교)|적용 사례|해결 사례/],
  ['컴퓨터과학', /컴퓨터과학|컴퓨터 과학/],
  ['창업·가치', /스타트업|가치를 창출/],
  ['문제 해결 태도', /자세를 (갖추|내면화|인식|수용)|실천하려는 자세/],
  ['알고리즘', /알고리즘/],
  ['정렬', /정렬/],
  ['탐색 알고리즘', /탐색하는 다양한 알고리즘|탐색 알고리즘|탐색의 중요성|맹목적 탐색|정보 이용 탐색|지능적 탐색/],
  ['자료구조', /데이터 구조|저장할 수 있는 구조|스택|큐|리스트|트리|그래프/],
  ['변수·연산', /변수|연산|자료형/],
  ['제어 구조', /제어 구조|반복 구조|선택 구조/],
  ['함수', /함수/],
  ['클래스·객체', /클래스|인스턴스|객체/],
  ['입출력', /입출력|입력과 출력/],
  ['프로그램 구현', /프로그램을 (협력적으로 )?(설계|작성|구현)|프로그래밍(으로|을 통해) 해결|소프트웨어를 개발|언어를 사용하여 구현/],
  ['성능 평가', /성능을 (평가|개선)|효율을 비교/],
  ['인공지능', /인공지능|지능 에이전트/],
  ['기계학습', /기계학습|지도학습과 비지도학습/],
  ['딥러닝', /딥러닝|인공신경망|신경망/],
  ['지식·추론', /지식을 표현|추론/],
  ['모델 평가', /훈련 데이터|테스트 데이터|회귀모델|군집/],
  ['윤리', /윤리/],
  ['사회 영향', /사회(에 미치는| 변화|적 (영향|문제))|미래 사회|삶과 직업/],
  ['진로', /진로/],
  ['협력', /협력|협업|공동 개발/],
  ['시뮬레이션', /시뮬레이션/],
  ['융합', /융합/],
  ['프로젝트', /프로젝트/],
  ['디지털 문화', /디지털 (문화|사회|세상|공간|기술이)/],
];

/* 개념 병합 맵 — 저차수·유사 개념을 주제 허브로 압축(2026-07-20, 사용자 승인 51→약 27).
   TAG_RULES는 그대로 두고 출력만 정규화(중복은 Set로 제거). null = 노드에서 제외. */
const MERGE = {
  '변수·연산': '프로그래밍 기초', '제어 구조': '프로그래밍 기초', '함수': '프로그래밍 기초',
  '입출력': '프로그래밍 기초', '클래스·객체': '프로그래밍 기초', '프로그래밍 언어': '프로그래밍 기초',
  '암호·보안': '정보보호', '개인정보': '정보보호', '저작권': '정보보호',
  '컴퓨팅 시스템': '컴퓨팅 시스템·네트워크', '네트워크': '컴퓨팅 시스템·네트워크', '사물인터넷': '컴퓨팅 시스템·네트워크',
  '데이터 압축': '디지털 표현',
  '전처리': '데이터 전처리·관리', '데이터 속성': '데이터 전처리·관리', '구조화': '데이터 전처리·관리', '데이터베이스': '데이터 전처리·관리',
  '딥러닝': '기계학습', '모델 평가': '기계학습', '지식·추론': '인공지능',
  '정렬': '알고리즘', '재귀': '알고리즘', '성능 평가': '알고리즘',
  '빅데이터': '데이터 분석', '융합': '프로젝트',
  '진로': '진로·창업', '창업·가치': '진로·창업',
  '문제 해결 태도': null,   // deg1·서술적 태도 → 노드에서 제외(해당 성취기준은 다른 태그로 커버됨)
  // '컴퓨터과학'은 유지 — [12정과04-01]의 유일 개념이라 삭제 시 무태그. 억지 병합보다 단독 노드가 정직.
};
const canon = t => (t in MERGE ? MERGE[t] : t);

const SUBJECT_IDS = ['middle', 'high', 'ai', 'ds', 'sw', 'cs', 'prog'];

/* 정글 data.js 로드 (classic script → VM) */
const ctx = {};
vm.createContext(ctx);
// classic script의 top-level const는 VM 전역에 안 붙는다(어휘 스코프) → 브리지 한 줄을 뒤에 이어 평가
vm.runInContext(readFileSync(JUNGLE_DATA, 'utf8') + '\n;this.__SUBJECTS = SUBJECTS;', ctx, { filename: 'jungle-data.js' });
const SUBJECTS = ctx.__SUBJECTS.filter(s => SUBJECT_IDS.includes(s.id));

const subjects = SUBJECTS.map(s => ({
  id: s.id, name: s.name, level: s.level,
  color: String(s.accent).startsWith('var') ? '#C2410C' : s.accent,   // var(--curr) → 실색
}));

const nodes = [], links = [], tagCount = {}, untagged = [];
for (const s of SUBJECTS) {
  for (const d of s.domains) {
    for (const it of d.items) {
      const raw = TAG_RULES.filter(([, re]) => re.test(it.text)).map(([t]) => t);
      const tags = [...new Set(raw.map(canon).filter(Boolean))];   // 병합·중복 제거·제외(null)
      nodes.push({ id: it.code, type: 'std', subject: s.id, domain: d.name, text: it.text, tags });
      for (const t of tags) {
        links.push({ source: it.code, target: 'tag:' + t });
        tagCount[t] = (tagCount[t] || 0) + 1;
      }
      if (!tags.length) untagged.push(it.code + ' ' + it.text.slice(0, 40));
    }
  }
}
for (const [t, n] of Object.entries(tagCount)) {
  nodes.push({ id: 'tag:' + t, type: 'tag', label: t, deg: n });
}

const out = 'window.STD_GRAPH = ' + JSON.stringify({
  builtAt: new Date().toISOString().slice(0, 10),
  subjects, nodes, links,
}) + ';\n';
writeFileSync(join(ROOT, 'data', 'graph-data.js'), '﻿' + out.replace('﻿', ''), 'utf8');

/* 리포트 */
const stdN = nodes.filter(n => n.type === 'std').length;
console.log(`성취기준 ${stdN}개 · 개념 태그 ${Object.keys(tagCount).length}개 · 연결 ${links.length}개`);
console.log('과목별: ' + subjects.map(s => s.id + ' ' + nodes.filter(n => n.subject === s.id).length).join(' · '));
const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
console.log('상위 태그: ' + sorted.slice(0, 8).map(([t, n]) => `${t}(${n})`).join(' '));
console.log(`태그 0개 성취기준: ${untagged.length}개`);
untagged.forEach(u => console.log('  · ' + u));
