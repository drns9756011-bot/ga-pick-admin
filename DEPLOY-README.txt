픽견적 관리자용 배포본입니다.

수정 내용
1. 승인 판매자 테이블/컬럼 자동 점검 및 승인 신청 누락 계정 복구
2. status 값이 비어 있는 과거 승인 판매자도 목록에 표시
3. 고객 견적 삭제 시 실제 존재하는 관련 테이블만 찾아 일괄 삭제
4. 서버 삭제 성공 후에만 관리자 화면에서 견적 제거
5. 실패 시 서버 오류 문구를 관리자 화면에 표시

배포 위치
- ga-pick-admin 관리자용 Cloudflare Workers 프로젝트
- 노출용 ga-pick.com 프로젝트에 배포하지 마세요.

Cloudflare 기존 설정 유지
- ADMIN_API_TOKEN Secret
- SOLAPI_API_KEY / SOLAPI_API_SECRET Secret
- DB D1 바인딩
- FILES R2 바인딩
