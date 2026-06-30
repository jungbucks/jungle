import { esc, safeUrl } from './utils.js';

// textbook.js — 교과서 목록 데이터 및 렌더링

const TEXTBOOK_BOOKS = {
  mid: [],
  high: [
    { publisher: '교학사',       author: '이영준 외 5명', year: 2025, ebook: 'https://kyohak.co.kr/book-detail/6998' },
    { publisher: '미래엔',       author: '안성진 외 6명', year: 2024, ebook: 'https://viewer-cms.mirae-n.com/pdf/viewers/pdf/pdf.html?content_name=2022%EA%B0%9C%EC%A0%95_%EA%B3%A0_%EC%A0%95%EB%B3%B4_%EA%B5%90%EA%B3%BC%EC%84%9C_%EA%B5%90%EA%B3%BC%EC%84%9C%20%ED%99%8D%EB%B3%B4%EA%B4%80&file=https://privw-cms.mirae-n.com/document/463934/5/%EA%B3%A0_%EC%A0%95%EB%B3%B4_%ED%8E%BC%EC%B9%A8%EB%A9%B4PDF_20240813.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3ByaXZ3LWNtcy5taXJhZS1uLmNvbWRvY3VtZW50JTJGNDYzOTM0IiwiZXhwIjoxNzgyNDU0MDQ3NTg3LCJpYXQiOjE3ODI0NTA0NDc1ODcsInBhdGgiOiJkb2N1bWVudC80NjM5MzQifQ.kQEyxCfYuc4abgniiBRCmblchTCphN_YVU2gq2zmMdQ&thumbnail_url=https://pubvw-cms.mirae-n.com/document/463934/5/%EA%B3%A0_%EC%A0%95%EB%B3%B4_%ED%8E%BC%EC%B9%A8%EB%A9%B4PDF_20240813-1_thumbnail.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3B1YnZ3LWNtcy5taXJhZS1uLmNvbWRvY3VtZW50JTJGNDYzOTM0IiwiZXhwIjoxNzgyNDU0MDQ3NTkwLCJpYXQiOjE3ODI0NTA0NDc1OTAsInBhdGgiOiJkb2N1bWVudC80NjM5MzQifQ._kGlycJRYvytCHOVpzfJvQtYjQBAYYnRdgWkkzjGsGU&down_url=' },
    { publisher: '도서출판길벗',  author: '김재현 외 4명', year: 2025, ebook: 'https://storage.googleapis.com/gilbut-homepage/preview/high/2022_info_textbook/index.html' },
    { publisher: '금성출판사',    author: '김영일 외 4명', year: 2024, ebook: 'https://file.kumsung.co.kr/text/ebook/2022re/micro2025/high_info/webview/index.html' },
    { publisher: '교문사',       author: '정영식 외 5명', year: 2024, ebook: 'https://buk.io/@78727982' },
    { publisher: '비상교육',     author: '임희석 외 5명', year: 2024, ebook: 'https://ibook.vivasam.com/CBS_iBook/5067/contents/index.html?skin=basic01' },
    { publisher: '와이비엠',     author: '정재화 외 7명', year: 2024, ebook: 'https://www.ybmcloud.com/prcenter_viewer?contentId=C202408190305174opGZ' },
    { publisher: '이오북스',     author: '김영식 외 7명', year: 2024, ebook: 'https://eobooks.com/%EC%A0%95%EB%B3%B4-7/' },
    { publisher: '천재교과서',    author: '김현철 외 5명', year: 2024, ebook: 'https://view.chunjae.co.kr/streamdocs/view/sd;streamdocsId=Frh9Ry251qoUoMjUeeGh2tuZCfF6DZz5Wvrwh4KzSkQ;isExternal=eQ;printUse=;enableDapSide=;pageView=' },
    { publisher: '씨마스',       author: '강신천 외 9명', year: 2024, ebook: 'https://viewer.cmass.kr/html/ebook/25exh/mid/info/M22_Info/M22_Info_text/M22_Info_text.html#p=1' },
    { publisher: '삼양미디어',    author: '정웅열 외 7명', year: 2024, ebook: 'http://samyang-samyangmedia.ktcdn.co.kr/Information_h_school/index.html' },
  ],
  ai: [
    { publisher: '웅보출판사',    author: '민무홍 외 3명', year: 2024, ebook: 'https://www.woongbo.co.kr/main_kor/main.php?mc=1|999|0&ctt=../sub/view_product&Code=0000148&CatNo=68' },
    { publisher: '금성출판사',    author: '김영일 외 3명', year: 2024, ebook: 'https://file.kumsung.co.kr/text/ebook/2022re/micro2025/high_AI_basic/webview/index.html' },
    { publisher: '도서출판길벗',  author: '김재현 외 4명', year: 2024, ebook: 'https://textbook.gilbut.co.kr/storage/gcs/preview/high/2022-ai-basics/index.html' },
    { publisher: '미래엔',       author: '안성진 외 6명', year: 2024, ebook: 'https://viewer-cms.mirae-n.com/pdf/viewers/pdf/pdf.html?content_name=2022%EA%B0%9C%EC%A0%95_%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90%20%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5%EA%B8%B0%EC%B4%88_%EC%88%98%EC%A0%95%EB%B3%B8%20PDF%20%ED%8C%8C%EC%9D%BC&file=https://privw-cms.mirae-n.com/document/463940/5/%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5%EA%B8%B0%EC%B4%88%20%ED%8E%BC%EC%B9%A8.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3ByaXZ3LWNtcy5taXJhZS1uLmNvbWRvY3VtZW50JTJGNDYzOTQwIiwiZXhwIjoxNzgyNDQxMTgxNDY5LCJpYXQiOjE3ODI0Mzc1ODE0NjksInBhdGgiOiJkb2N1bWVudC80NjM5NDAifQ.63RiMkOThT9Hko2bACyZCg8WOp9KUtjucAqvvqEGEIY&thumbnail_url=https://pubvw-cms.mirae-n.com/document/463940/5/%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5%EA%B8%B0%EC%B4%88%20%ED%8E%BC%EC%B9%A8-1_thumbnail.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3B1YnZ3LWNtcy5taXJhZS1uLmNvbWRvY3VtZW50JTJGNDYzOTQwIiwiZXhwIjoxNzgyNDQxMTgxNDczLCJpYXQiOjE3ODI0Mzc1ODE0NzMsInBhdGgiOiJkb2N1bWVudC80NjM5NDAifQ.HHMw_xOKHvt0O219dqqZY5ovv6g2Nye5KlT2ke-enOs&down_url=' },
    { publisher: '미래융합연구원', author: '유두규 외 5명', year: 2024, ebook: 'https://www.aioc.kr/47' },
    { publisher: '비상교육',     author: '임희석 외 5명', year: 2024, ebook: 'https://dn.vivasam.com/VS/EBOOK/%EA%B3%A0%EB%93%B1%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5%EA%B8%B0%EC%B4%88PC/index.html' },
    { publisher: '삼양미디어',    author: '정웅열 외 6명', year: 2024, ebook: 'https://samyangm.com/media/shop/item.php?it_id=1773048627' },
    { publisher: '씨마스',       author: '이지항 외 8명', year: 2024, ebook: 'https://viewer.cmass.kr/html/ebook/25exh/high/info_tech/H22_AI/H22_AI_text/H22_AI_text.html#p=1' },
    { publisher: '와이비엠',     author: '서인순 외 5명', year: 2024, ebook: 'https://www.ybmcloud.com/textbook/T07171157502024jQ1Qp.html?siteType=H' },
    { publisher: '이오북스',     author: '김귀훈 외 7명', year: 2024, ebook: 'https://eobooks.com/%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5%EA%B8%B0%EC%B4%88/' },
    { publisher: '천재교과서',    author: '김현철 외 4명', year: 2024, ebook: 'http://text.tsherpa.co.kr/modal/preview_file.html?filePath=/00_%EA%B5%90%EA%B3%BC%EC%84%9C%ED%99%8D%EB%B3%B4%EA%B4%80_%EA%B3%A0%EB%93%B1/%EA%B5%90%EA%B3%BC%EC%84%9CPDF/06_%EA%B8%B0%EC%88%A0_%EA%B0%80%EC%A0%95_%EC%A0%95%EB%B3%B4/%EC%B2%9C%EC%9E%AC_%EA%B3%A0%EB%93%B1_%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5%EA%B8%B0%EC%B4%88(%EA%B9%80%ED%98%84%EC%B2%A0)_%EA%B5%90%EA%B3%BC%EC%84%9C.pdf' },
    { publisher: '플레이스터디',   author: '최현종 외 4명', year: 2024, ebook: 'http://m.100ssem.co.kr/FileUpload/files/ebook/1/index.html' },
  ],
  ds: [
    { publisher: '씨마스',    author: '강신천 외 8명', year: 2025, ebook: 'https://viewer.cmass.kr/html/ebook/25exh/high/info_tech/H22_DataScience/H22_DataScience_text/H22_DataScience_text.html#p=1' },
    { publisher: '올드앤뉴',  author: '임부현 외 4명', year: 2024, ebook: 'http://xn--vg1bq9b00y2wa.com/2024-e-book/' },
    { publisher: '삼양미디어', author: '정웅열 외 7명', year: 2024, ebook: 'https://samyangm.com/teacher/shop/item.php?it_id=1773046572' },
    { publisher: '와이비엠',  author: '서인순 외 5명', year: 2024, ebook: 'https://www.ybmcloud.com/textbook/T07171158222024FCX6P.html?siteType=H' },
    { publisher: '천재교과서', author: '김현철 외 5명', year: 2024, ebook: 'https://view.chunjae.co.kr/streamdocs/view/sd;streamdocsId=dQfLctupZfZcgK0tGD-y-Wx5-pjPVvls8tV-yscvuNY;isExternal=eQ;printUse=;enableDapSide=;pageView=' },
  ],
  sw: [
    { publisher: '교학사',    author: '이영준 외 4명', year: 2024, ebook: 'https://webview.klassmon.com/viewer/preview/customLayout.jsp?contentId=/pdf/textbook/H_SL_T.pdf&col=column2&cover=true' },
    { publisher: '도서출판길벗', author: '김재현 외 5명', year: 2024, ebook: 'https://textbook.gilbut.co.kr/storage/gcs/preview/high/2022-software-and-life/index.html' },
    { publisher: '삼양미디어', author: '서성원 외 5명', year: 2024, ebook: 'http://samyang-samyangmedia.ktcdn.co.kr/software_&_life/index.html' },
    { publisher: '이오북스',  author: '김귀훈 외 7명', year: 2024, ebook: 'https://eobooks.com/%EC%86%8C%ED%94%84%ED%8A%B8%EC%9B%A8%EC%96%B4%EC%99%80-%EC%83%9D%ED%99%9C/' },
    { publisher: '천재교과서', author: '이준구 외 5명', year: 2024, ebook: 'https://view.chunjae.co.kr/streamdocs/view/sd;streamdocsId=rL-vPRW6Po_jNvU9o9NB4wEN3paUBp_OLweSO_E7xrw;isExternal=eQ;printUse=;enableDapSide=;pageView=' },
    { publisher: '씨마스',    author: '조정원 외 9명', year: 2024, ebook: 'https://viewer.cmass.kr/html/ebook/25exh/high/info_tech/H22_Software/H22_Software_text/H22_Software_text.html' },
  ],
};

const GOSIWA_BOOKS = {
  mid: [
    { org: '인천광역시교육청',    subject: '과학/기술·가정/정보',  name: '문제 해결과 프로그래밍' },
    { org: '경상남도교육청',      subject: '정보',                name: '피지컬 컴퓨팅' },
    { org: '서울특별시교육청',    subject: '정보',                name: '인공지능과 미래사회(중)' },
    { org: '인천광역시교육청',    subject: '과학/기술·가정/정보',  name: '데이터 분석과 인공지능' },
    { org: '대전광역시교육청',    subject: '정보',                name: '파이썬과 데이터 융합' },
    { org: '경상북도교육청',      subject: '정보',                name: '앱과 코딩' },
    { org: '경상북도교육청',      subject: '정보',                name: '슬기로운 디지털 생활' },
    { org: '전라남도교육청',      subject: '과학/기술·가정/정보',  name: '인공지능과 생활' },
    { org: '서울특별시교육청',    subject: '정보',                name: '프로그래밍과 인공지능 로봇' },
    { org: '울산광역시교육청',    subject: '과학/기술·가정/정보',  name: '스마트한 인공지능 생활 1' },
    { org: '울산광역시교육청',    subject: '과학/기술·가정/정보',  name: '스마트한 인공지능 생활 2' },
    { org: '충청남도교육청',      subject: '정보',                name: '인공지능과 차세대 모빌리티' },
    { org: '경기도교육청',        subject: '정보',                name: '디지털윤리' },
    { org: '경기도교육청',        subject: '과학/기술·가정/정보',  name: '타자(他者)와 평화 Ⅱ' },
    { org: '경기도교육청',        subject: '과학/기술·가정/정보',  name: '인공지능탐구' },
    { org: '경기도교육청',        subject: '과학/기술·가정/정보',  name: '생활 공간 디자인' },
  ],
  high: [
    { org: '광주광역시교육청',     subject: '정보통신',                                         name: '군대윤리' },
    { org: '광주광역시교육청',     subject: '정보',                                             name: '수리와 인공지능' },
    { org: '광주광역시교육청',     subject: '보통 교과(진로선택)/정보',                         name: '정보 과제 연구' },
    { org: '서울특별시교육청',     subject: '보통 교과(정보)-진로선택',                         name: '인공지능과 미래사회' },
    { org: '서울특별시교육청',     subject: '전문 교과(정보-통신)',                             name: '프로그래밍(C++)' },
    { org: '서울특별시교육청',     subject: '정보-통신/전공일반',                               name: '서버 구축 및 운영' },
    { org: '서울특별시교육청',     subject: '정보-통신/전공일반',                               name: '웹 프로그래밍 실무' },
    { org: '대전광역시교육청',     subject: '정보-통신(전공실무)',                              name: '화면 디자인' },
    { org: '서울특별시교육청',     subject: '전문교과(정보-통신)-전공실무',                     name: '웹 애플리케이션 개발' },
    { org: '서울특별시교육청',     subject: '전문교과(정보-통신)-전공실무',                     name: '인공지능 활용 서비스 개발' },
    { org: '서울특별시교육청',     subject: '전문교과(정보-통신)-전공실무',                     name: '웹 응용 SW 프로그래밍 실무' },
    { org: '서울특별시교육청',     subject: '전문교과(정보-통신)-전공실무',                     name: '운영체제와 클라우드 인프라스트럭처 활용' },
    { org: '서울특별시교육청',     subject: '전문교과(정보-통신)-전공실무',                     name: '서버 응용 SW 엔지니어링 실무' },
    { org: '서울특별시교육청',     subject: '전문교과(정보-통신)-전공일반',                     name: '프로그래밍 JAVA 기초' },
    { org: '서울특별시교육청',     subject: '전문교과(정보-통신)-전공일반',                     name: '프로그래밍 JAVA 실무' },
    { org: '전라남도교육청',       subject: '정보통신/전공실무',                                name: '응용SW엔지니어링' },
    { org: '전라남도교육청',       subject: '정보-통신/전공실무',                               name: '인공지능과 사물인터넷' },
    { org: '대구광역시교육청',     subject: '정보',                                             name: '데이터과학머신러닝' },
    { org: '충청남도교육청',       subject: '과학계열(정보)',                                   name: '정보과학융합 탐구' },
    { org: '충청남도교육청',       subject: '과학계열(정보)',                                   name: '정보과학 과제연구' },
    { org: '강원특별자치도교육청',  subject: '정보',                                             name: '프로그래밍기초' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '운영체제1' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '운영체제2' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '인공지능론1' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '인공지능론2' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '서버 프로그래밍' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '인공지능 활용' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '프론트엔드 프로그래밍' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '알고리즘 실무1' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '알고리즘 실무2' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '컴퓨터과학 탐구I' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '컴퓨터과학 탐구II' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '프로젝트 실무I' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '프로젝트 실무II' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '딥러닝 실무' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '빅데이터 실무' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '서버 프로그래밍 실무' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '프론트엔드 프로그래밍 실무' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '웹 개발 입문' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '인공지능 프로그래밍 입문' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '앱 개발 프로그래밍' },
    { org: '대전광역시교육청',     subject: '전문교과/전공일반(정보-통신)',                      name: '객체지향 프로그래밍(JAVA)' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '소프트웨어 엔지니어링 실무' },
    { org: '인천광역시교육청',     subject: '보통 교과(과학 계열)/정보/진로선택',               name: '데이터 시각화 프로그래밍' },
    { org: '대구광역시교육청',     subject: '정보-통신',                                        name: '디지털트윈' },
    { org: '광주광역시교육청',     subject: '전문교과(전공실무)/정보-통신',                     name: '프로젝트 실무' },
    { org: '대구광역시교육청',     subject: '정보-통신',                                        name: '디지털트윈 구축' },
    { org: '대구광역시교육청',     subject: '정보-통신',                                        name: '스마트물류통합관리' },
    { org: '충청남도교육청',       subject: '전공실무-정보-통신',                               name: '클라우드 컴퓨팅 이해' },
    { org: '충청남도교육청',       subject: '전공실무-정보-통신',                               name: '클라우드 시스템 구성' },
    { org: '충청남도교육청',       subject: '전공실무-정보-통신',                               name: '비즈니스 프로그래밍 기초' },
    { org: '충청남도교육청',       subject: '전공실무-정보-통신',                               name: '비즈니스 프로그래밍 중급' },
    { org: '충청남도교육청',       subject: '전공실무-정보-통신',                               name: '기업 프로세스 기초' },
    { org: '충청남도교육청',       subject: '전공실무-정보-통신',                               name: '재무관리시스템' },
    { org: '충청남도교육청',       subject: '전공실무-정보-통신',                               name: '물류관리시스템' },
    { org: '서울특별시교육청',     subject: '전문교과-정보-통신-전공실무',                      name: '디지털 자산의 이해와 보안' },
    { org: '서울특별시교육청',     subject: '전문교과-정보-통신-전공실무',                      name: '인공지능 프라이버시' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '임베디드 리눅스 프로그래밍' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '임베디드 시스템' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '임베디드 실시간 운영체제' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무(정보-통신)',                      name: '임베디드 프로젝트 실무' },
    { org: '대전광역시교육청',     subject: '전문교과/전공실무/정보-통신',                      name: '바이오 건축설비' },
    { org: '경상북도교육청',       subject: '정보',                                             name: 'AP 컴퓨터과학A I' },
    { org: '경상북도교육청',       subject: '정보',                                             name: 'AP 컴퓨터과학A II' },
    { org: '경상북도교육청',       subject: '정보',                                             name: 'AP 컴퓨터과학 원리 I' },
    { org: '경상북도교육청',       subject: '정보',                                             name: 'AP 컴퓨터과학 원리 II' },
    { org: '경기도교육청',         subject: '전문교과/정보-통신 교과(군)/전공실무',              name: '사물인터넷 이해와 활용' },
    { org: '경기도교육청',         subject: '전문교과/정보-통신 교과(군)/전공실무',              name: '사물인터넷 프로젝트' },
    { org: '경기도교육청',         subject: '보통교과/정보교과(군)/진로선택',                   name: '데이터전문탐구I' },
    { org: '경기도교육청',         subject: '보통교과/정보교과(군)/진로선택',                   name: '데이터전문탐구II' },
    { org: '경기도교육청',         subject: '보통교과/기술·가정/정보 정보 교과(군)/진로선택',    name: 'IB 컴퓨터과학 SL I' },
    { org: '경기도교육청',         subject: '보통교과/기술·가정/정보 정보 교과(군)/진로선택',    name: 'IB 컴퓨터과학 SL II' },
    { org: '경기도교육청',         subject: '보통교과/기술·가정/정보 정보 교과(군)/진로선택',    name: 'IB 컴퓨터과학 HL I' },
    { org: '경기도교육청',         subject: '보통교과/기술·가정/정보 정보 교과(군)/진로선택',    name: 'IB 컴퓨터과학 HL II' },
    { org: '서울특별시교육청',     subject: '전문 교과(정보-통신)-전공 일반',                   name: '인공지능 파이썬 실무' },
    { org: '서울특별시교육청',     subject: '전문 교과(정보-통신)-전공 일반',                   name: '인공지능 파이썬 기초' },
    { org: '전라남도교육청',       subject: '전문교과-정보-통신(전공실무)',                      name: '사무자동화기기운용' },
    { org: '경상북도교육청',       subject: '기술·가정/정보',                                   name: '인공지능 융합 프로젝트' },
    { org: '세종특별자치시교육청',  subject: '보통교과/정보/진로선택',                           name: '시뮬레이션과 인공지능' },
    { org: '세종특별자치시교육청',  subject: '보통교과/정보/진로선택',                           name: '인공지능과 소설의 만남' },
    { org: '세종특별자치시교육청',  subject: '보통교과/정보/진로선택',                           name: '생성형 인공지능 프로젝트' },
    { org: '경상북도교육청',       subject: '기술·가정/정보',                                   name: '나와 지구를 위한 지속가능 스타일링' },
  ],
};

function tbSwitch(n) {
  document.getElementById('tbPanel1').style.display = n === 1 ? '' : 'none';
  document.getElementById('tbPanel2').style.display = n === 2 ? '' : 'none';
  document.querySelectorAll('.msub-tab').forEach((t, i) => t.classList.toggle('active', i + 1 === n));
}

function renderTextbook() {
  const sid = id => SUBJECTS.find(s => s.id === id);
  const mid = sid('middle'), high = sid('high'), ai = sid('ai'), ds = sid('ds'), sw = sid('sw');

  function bookRows(list) {
    if (!list || !list.length) return '';
    return list.map((b, i) => `<tr>
      <td class="msub-num">${i + 1}</td>
      <td class="msub-publisher">${b.publisher}</td>
      <td>${b.author}</td>
      <td class="msub-year">${b.year}</td>
      <td class="msub-ebook">${b.ebook && /^https?:\/\//i.test(b.ebook) ? `<a class="msub-ebook-btn" href="${b.ebook}" target="_blank" rel="noopener noreferrer">교과서 보기</a>` : ''}</td>
    </tr>`).join('');
  }

  function bookTable(s, list) {
    const rows = bookRows(list);
    if (!rows) return '<div style="font-size:13px;color:var(--g400);padding:8px 0">목록 준비 중입니다.</div>';
    const bg = s.aDark;
    return `<div class="msub-tbl-scroll" style="--tbl-hover:${s.aLight};--tbl-btn:${s.accent};--tbl-btn-dk:${s.aDark}"><table class="msub-table">
      <thead><tr>
        <th class="msub-num" style="background:${bg}">번호</th>
        <th style="background:${bg}">출판사</th>
        <th style="background:${bg}">저자</th>
        <th class="msub-year" style="background:${bg}">발행연도</th>
        <th class="msub-ebook" style="background:${bg}">E-BOOK</th>
      </tr></thead><tbody>${rows}</tbody>
    </table></div>`;
  }

  function subheading(s, label) {
    return `<div class="msub-subheading" style="color:${s.aDark};background:${s.aLight};border-left-color:${s.accent}">${label}</div>`;
  }

  function gosiwaRows(list) {
    return list.map((g, i) => `<tr>
      <td class="msub-num">${i + 1}</td>
      <td class="msub-curri">2022</td>
      <td class="msub-org">${g.org}</td>
      <td>${g.subject}</td>
      <td class="msub-subj-name">${g.name}</td>
    </tr>`).join('');
  }

  function gosiwaTable(headBg, hoverBg, list) {
    return `<div class="msub-tbl-scroll" style="--tbl-hover:${hoverBg}"><table class="msub-table">
      <thead><tr>
        <th class="msub-num" style="background:${headBg}">번호</th>
        <th style="background:${headBg}">교육과정</th>
        <th style="background:${headBg}">소속기관</th>
        <th style="background:${headBg}">관련교과</th>
        <th style="background:${headBg}">과목명</th>
      </tr></thead><tbody>${gosiwaRows(list)}</tbody>
    </table></div>`;
  }

  const midCnt = GOSIWA_BOOKS.mid.length;
  const hsCnt = GOSIWA_BOOKS.high.length;

  return `<div style="max-width:1200px;margin:0 auto">
  <div class="astore-header">
    <div class="astore-header-inner">
      <div class="astore-logo" style="font-size:24px">📚</div>
      <div>
        <div class="astore-title">정보교과서</div>
        <div class="astore-subtitle">2022 개정 교육과정 인정교과서 목록 및 고시외 과목 안내</div>
      </div>
    </div>
  </div>
  <div class="msub-wrap">
  <div class="msub-tabbar">
    <button class="msub-tab active" onclick="tbSwitch(1)">중·고 인정 교과서</button>
    <button class="msub-tab" onclick="tbSwitch(2)">고시외 과목</button>
  </div>
  <div id="tbPanel1">
    <div class="msub-heading" style="color:${mid.accent}">중학교 정보 교과서 목록</div>
    <div class="msub-desc">2022 개정 교육과정 기준 인정 교과서 목록입니다.</div>
    ${bookTable(mid, TEXTBOOK_BOOKS.mid)}
    <hr class="msub-sep">
    <div class="msub-heading">고등학교 정보교과 교과서 목록</div>
    <div class="msub-desc">과목별로, 가나다순으로 정렬되어 있습니다.</div>
    ${subheading(high, '정보')}${bookTable(high, TEXTBOOK_BOOKS.high)}
    ${subheading(ai, '인공지능기초')}${bookTable(ai, TEXTBOOK_BOOKS.ai)}
    ${subheading(ds, '데이터과학')}${bookTable(ds, TEXTBOOK_BOOKS.ds)}
    ${subheading(sw, '소프트웨어와 생활')}${bookTable(sw, TEXTBOOK_BOOKS.sw)}
  </div>
  <div id="tbPanel2" style="display:none">
    <details class="msub-collapse">
      <summary class="msub-collapse-hd" style="color:#D97706"><span class="msub-collapse-arrow">▶</span>중학교 고시외 과목 목록<span class="msub-cnt" style="background:#FEF3C7;color:#92400E">${midCnt}개</span></summary>
      <div class="msub-desc">2022 개정 교육과정 기준, 지역 교육청별 승인 완료 과목입니다. 교과서 개발·채택 시 참고하세요.</div>
      ${gosiwaTable('#D97706', '#FFFBEB', GOSIWA_BOOKS.mid)}
    </details>
    <hr class="msub-sep">
    <details class="msub-collapse">
      <summary class="msub-collapse-hd" style="color:#4F46E5"><span class="msub-collapse-arrow">▶</span>고등학교 고시외 과목 목록<span class="msub-cnt" style="background:#EEF2FF;color:#3730A3">${hsCnt}개</span></summary>
      <div class="msub-desc">2022 개정 교육과정 기준, 지역 교육청별 승인 완료 과목입니다.</div>
      ${gosiwaTable('#4F46E5', '#EEF2FF', GOSIWA_BOOKS.high)}
    </details>
  </div></div></div>`;
}

export { renderTextbook };
window.tbSwitch = tbSwitch;
