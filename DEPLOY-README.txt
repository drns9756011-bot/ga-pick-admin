픽견적 관리자용 통합 수정본

1. 관리자용 Cloudflare Workers 프로젝트에 이 폴더 전체를 배포합니다.
2. 기존 D1(DB)·R2(FILES) 바인딩을 유지합니다.
3. ADMIN_API_TOKEN은 ZIP에 포함하지 않습니다. Cloudflare Production Secret에 설정한 값만 사용합니다.
4. 관리자 페이지는 접속·메뉴 이동 때 서버를 자동 조회하지 않습니다. 상단 새로고침 버튼을 눌렀을 때만 전체 데이터를 불러옵니다.
5. 판매자 삭제는 approved_sellers와 seller_applications에서 실제 삭제하고, 재생성 방지 기록만 deleted_seller_accounts에 남깁니다.
6. 마스터 계정 pickgj는 삭제할 수 없습니다.
