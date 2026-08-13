픽견적 브랜드관 V1 - 2026-08-07

배포 대상
- 노출용 Cloudflare Worker 프로젝트: ga-pick-public
- 관리자용 프로젝트가 아닙니다.

라우트
- 고객 브랜드관: https://ga-pick.com/brand
- 판매자 패키지 관리: https://ga-pick.com/brand/manage

구현
1. 승인 판매자만 기존 판매자 아이디/비밀번호로 브랜드관 관리 로그인
2. 지점별 다품목 패키지 등록/수정/삭제/숨김
3. 브랜드, 제목, 최대 12개 제품, 정상가, 패키지 금액, 혜택, 대표 이미지 등록
4. 대표 이미지는 기존 R2(ga-pick-files)에 저장
5. 공개 패키지는 고객 브랜드관에 즉시 표시
6. 브랜드/지역/채널 필터
7. 고객 상담 신청: 이름, 연락처, 설치지역, 상담희망시간, 문의내용, 개인정보 동의
8. 상담 정보는 동일 D1에 저장되고 해당 패키지 담당 매니저에게 LMS 문자 전달
9. 문자 전달 실패 시에도 D1에는 저장되어 /brand/manage 상담 신청 고객에서 확인 가능
10. 다른 판매자의 고객 상담 정보는 조회 불가

신규 D1 테이블
- brand_packages
- brand_consultations
API 최초 호출 시 CREATE TABLE IF NOT EXISTS로 자동 생성됩니다.
schema.sql에도 동일 스키마를 추가했습니다.

API
- GET /api/brand-packages : 공개 패키지 목록
- POST /api/brand-seller-packages : 승인 판매자 패키지 관리/상담목록 조회
- POST /api/brand-consultations : 고객 상담 신청

기존 설정 사용
- D1: ga-pick-db
- R2: ga-pick-files
- 상담 매니저 문자: 노출용 Worker의 기존 SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_FROM 사용

기타
- 기존 /, /quote, /my-quote, /seller, /seller/register SPA 파일은 같은 최신 index.html로 통일
- 메인 PC 헤더에 브랜드관 메뉴 추가
- 모바일 하단 카카오문의 자리를 브랜드관으로 변경 (카카오 문의 플로팅 버튼은 유지)
- 판매자 페이지에 브랜드관 패키지 관리 진입 링크 추가


[2026-08-08 V2 - 서버 요청 로딩 모달]
- /brand 및 /brand/manage의 모든 API 요청에 공통 로딩 모달 적용
- 문구: 로딩 중입니다. / 서버와 통신하고 있습니다. 잠시만 기다려주세요.
- 패키지 조회, 판매자 로그인, 패키지 저장/수정/삭제, 상담 신청, 상담내역 조회에 적용
- Promise.all 병렬 요청은 ref-count로 모든 요청이 종료될 때까지 모달 유지
- 연속 API 요청 사이의 깜빡임 방지를 위해 140ms 지연 닫기 적용
