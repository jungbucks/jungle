import { esc, safeUrl, registerActions } from './utils.js';

// textbook.js — 교과서 목록 데이터 및 렌더링

const TEXTBOOK_BOOKS = {
  mid: [
    { publisher: '교문사',      author: '정영식 외 4명', year: 2024, ebook: 'https://buk.io/@79879207' },
    { publisher: '교학사',      author: '이영준 외 4명', year: 2024, ebook: 'https://www.kyohak.co.kr/book-detail/6998' },
    { publisher: '금성출판사',   author: '김영일 외 3명', year: 2024, ebook: 'https://text.kumsung.co.kr/middle/book/bookView.do?pageNo=1&bookGrouplId=1&bookGroupmId=2&bookSeriesId=&bookGradeProcess=&bookGroupItemlId=14&bookId=1485' },
    { publisher: '능률교과서',   author: '최종길 외 4명', year: 2025, ebook: 'https://www.nybook.net/product2/item.php?it_id=1506501730' },
    { publisher: '도서출판길벗', author: '김재현 외 3명', year: 2024, ebook: 'https://textbook.gilbut.co.kr/storage/gcs/preview/middle/2022-info/index.html' },
    { publisher: '동아출판',     author: '최현종 외 4명', year: 2024, ebook: 'https://ebook.dongapublishing.com/ebook/ecatalog5.asp?Dir=2638' },
    { publisher: '미래엔',      author: '한선관 외 9명', year: 2024, ebook: 'https://viewer-cms.mirae-n.com/pdf/viewers/pdf/pdf.html?content_name=%EC%A4%91%ED%95%99%EA%B5%90%20%EC%A0%95%EB%B3%B4%20%EA%B5%90%EA%B3%BC%EC%84%9C%20PDF&file=https://privw-cms.mirae-n.com/document/463986/3/%EC%A4%91%EB%93%B1%EC%A0%95%EB%B3%B4%EB%B3%B8%EB%AC%B8%28001-251%29%ED%8E%BC%EC%B9%A8.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3ByaXZ3LWNtcy5taXJhZS1uLmNvbWRvY3VtZW50JTJGNDYzOTg2IiwiZXhwIjoxNzgyOTk0OTYzMzQzLCJpYXQiOjE3ODI5OTEzNjMzNDMsInBhdGgiOiJkb2N1bWVudC80NjM5ODYifQ.4BaD30p2QVPsOC6-Sks4B9OpJNlifmd2QkaOgSZ1P2U' },
    { publisher: '비상교육',     author: '임희석 외 5명', year: 2024, ebook: 'https://ibook.vivasam.com/CBS_iBook/4871/contents/index.html?skin=basic01' },
    { publisher: '삼양미디어',   author: '정웅열 외 7명', year: 2025, ebook: 'https://samyangm.com/teacher/shop/item.php?it_id=1773050526' },
    { publisher: '씨마스',      author: '서태원 외 7명', year: 2024, ebook: 'https://viewer.cmass.kr/html/ebook/25exh/mid/info/M22_Info/M22_Info_text/M22_Info_text.html#p=1' },
    { publisher: '와이비엠',     author: '신승기 외 7명', year: 2025, ebook: 'https://www.ybmcloud.com/prcenter_viewer?contentId=C20250807032903Ep5DT' },
    { publisher: '원교재사',     author: '김태영 외 5명', year: 2025, ebook: 'https://www.wonn.co.kr/product/product_view.jsp?id=9725#a' },
    { publisher: '이오북스',     author: '김영식 외 7명', year: 2024, ebook: 'https://eobooks.com/%ec%a0%95%eb%b3%b4-6/' },
    { publisher: '천재교과서',   author: '김현철 외 6명', year: 2024, ebook: 'https://text.tsherpa.co.kr/modal/preview_file.html?filePath=/00_%EA%B5%90%EA%B3%BC%EC%84%9C%ED%99%8D%EB%B3%B4%EA%B4%80_%EC%A4%91%ED%95%99/%EA%B5%90%EA%B3%BC%EC%84%9CPDF/06_%EA%B8%B0%EC%88%A0_%EA%B0%80%EC%A0%95_%EC%A0%95%EB%B3%B4/%EC%B2%9C%EC%9E%AC_%EC%A4%91%ED%95%99_%EC%A0%95%EB%B3%B4(%EA%B9%80%ED%98%84%EC%B2%A0)_%EA%B5%90%EA%B3%BC%EC%84%9C.pdf' },
  ],
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

function tbkJump(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 고시외 과목: 교육청별 그룹핑 (과목 수 많은 순)
function gosiwaGroups(list) {
  const map = new Map();
  list.forEach(g => { if (!map.has(g.org)) map.set(g.org, []); map.get(g.org).push(g); });
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

// 고시외 검색 필터: 과목명·교육청·관련교과 즉시 좁히기
function gosiwaFilterInput(q) {
  q = q.trim().toLowerCase();
  document.querySelectorAll('.gsw-group').forEach(g => {
    let vis = 0;
    g.querySelectorAll('.gsw-item').forEach(it => {
      const hit = !q || (it.dataset.q || '').includes(q);
      it.style.display = hit ? '' : 'none';
      if (hit) vis++;
    });
    g.style.display = vis ? '' : 'none';
    if (q && vis) g.open = true;
    const c = g.querySelector('.gsw-cnt'); if (c) c.textContent = vis + '개';
  });
  document.querySelectorAll('.gsw-section').forEach(sec => {
    const any = [...sec.querySelectorAll('.gsw-group')].some(g => g.style.display !== 'none');
    const empty = sec.querySelector('.gsw-noresult');
    if (empty) empty.style.display = any ? 'none' : '';
  });
}

function renderTextbook() {
  const sid = id => SUBJECTS.find(s => s.id === id);
  const mid = sid('middle'), high = sid('high'), ai = sid('ai'), ds = sid('ds'), sw = sid('sw');

  function bookCards(s, list) {
    if (!list || !list.length) return '<div class="msub-empty">목록 준비 중입니다.</div>';
    return `<div class="tbk-grid">${list.map(b => `
      <div class="tbk-card" style="--tbk:${s.accent};--tbk-soft:${s.aLight};--tbk-dark:${s.aDark}">
        <div class="tbk-head"><span class="tbk-pub">${esc(b.publisher)}</span>${b.author ? `<span class="tbk-author">${esc(b.author)}</span>` : ''}</div>
        <div class="tbk-yearline"><span class="tbk-year">${b.year}</span></div>
        ${b.ebook
          ? `<a class="tbk-btn" href="${safeUrl(b.ebook)}" target="_blank" rel="noopener noreferrer">교과서 보기</a>`
          : '<span class="tbk-btn off">준비 중</span>'}
      </div>`).join('')}</div>`;
  }

  const SECTIONS = [
    { id: 'tbk-mid',  s: mid,  label: '중학교 정보',        note: '중학교',              list: TEXTBOOK_BOOKS.mid },
    { id: 'tbk-high', s: high, label: '정보',              note: '고등학교 일반선택',    list: TEXTBOOK_BOOKS.high },
    { id: 'tbk-ai',   s: ai,   label: '인공지능 기초',      note: '고등학교 진로선택',    list: TEXTBOOK_BOOKS.ai },
    { id: 'tbk-ds',   s: ds,   label: '데이터 과학',        note: '고등학교 진로선택',    list: TEXTBOOK_BOOKS.ds },
    { id: 'tbk-sw',   s: sw,   label: '소프트웨어와 생활',   note: '고등학교 융합선택',    list: TEXTBOOK_BOOKS.sw },
  ];

  const chips = SECTIONS.map(sec =>
    `<button class="tbk-chip" style="--tbk:${sec.s.accent};--tbk-soft:${sec.s.aLight};--tbk-dark:${sec.s.aDark}" data-onclick="tb:jump" data-args="${esc(JSON.stringify([sec.id]))}">${esc(sec.label)} <b>${sec.list.length}</b></button>`
  ).join('');

  const sections = SECTIONS.map(sec => `
    <div class="tbk-section" id="${sec.id}">
      <div class="msub-subheading" style="color:${sec.s.aDark};background:${sec.s.aLight};border-left-color:${sec.s.accent}">
        ${esc(sec.label)} <span class="tbk-sec-note">${esc(sec.note)} · ${sec.list.length}종 · 가나다순</span>
      </div>
      ${bookCards(sec.s, sec.list)}
    </div>`).join('');

  function gosiwaSection(title, color, soft, list, openFirst) {
    const groups = gosiwaGroups(list);
    return `
    <div class="gsw-section">
      <div class="msub-heading" style="color:${color}">${title} <span class="msub-cnt" style="background:${soft};color:${color}">${list.length}종</span></div>
      ${groups.map(([org, items], gi) => `
      <details class="gsw-group"${openFirst && gi === 0 ? ' open' : ''}>
        <summary class="gsw-hd"><span class="msub-collapse-arrow">▶</span>${esc(org)}<span class="gsw-cnt">${items.length}개</span></summary>
        <div class="gsw-items">
          ${items.map(it => `<div class="gsw-item" data-q="${esc((it.name + ' ' + it.org + ' ' + it.subject).toLowerCase())}">
            <div class="gsw-name">${esc(it.name)}</div>
            <div class="gsw-subj">${esc(it.subject)}</div>
          </div>`).join('')}
        </div>
      </details>`).join('')}
      <div class="gsw-noresult" style="display:none">검색 결과가 없습니다.</div>
    </div>`;
  }

  return `<div style="max-width:1200px;margin:0 auto">
  <div class="msub-wrap">
  <div class="ov-head">
    <span class="ov-eyebrow" style="color:var(--book);background:var(--book-soft)">교과서 자료실</span>
    <h2 class="ov-h2">정보교과서</h2>
    <p class="ov-sub">2022 개정 교육과정 인정 교과서와 시도교육청 고시외 과목 목록 — E-BOOK으로 바로 열람하세요.</p>
  </div>
  <div class="msub-tabbar">
    <button class="msub-tab active" data-onclick="tb:switch" data-args="[1]">중·고 인정 교과서</button>
    <button class="msub-tab" data-onclick="tb:switch" data-args="[2]">고시외 과목</button>
  </div>
  <div id="tbPanel1">
    <div class="tbk-chips">${chips}</div>
    ${sections}
  </div>
  <div id="tbPanel2" style="display:none">
    <input class="gsw-filter" type="search" placeholder="과목명·교육청·관련교과 검색" aria-label="고시외 과목 검색" data-oninput="tb:filter">
    <div class="msub-desc">2022 개정 교육과정 기준, 지역 교육청별 승인 완료 과목입니다. 교과서 개발·채택 시 참고하세요.</div>
    ${gosiwaSection('중학교 고시외 과목', 'var(--warn)', 'var(--warn-soft)', GOSIWA_BOOKS.mid, false)}
    <hr class="msub-sep">
    ${gosiwaSection('고등학교 고시외 과목', 'var(--ovr-dark)', 'var(--ovr-soft)', GOSIWA_BOOKS.high, false)}
  </div></div></div>`;
}

export { renderTextbook };

// ── 이벤트 위임 등록 (인라인 핸들러 대체) ──
registerActions('click', {
  'tb:switch': function(el, e, n) { tbSwitch(n); },
  'tb:jump':   function(el, e, id) { tbkJump(id); },
});
registerActions('input', {
  'tb:filter': function(el) { gosiwaFilterInput(el.value); },
});
