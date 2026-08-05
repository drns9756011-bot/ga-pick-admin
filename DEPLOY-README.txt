GA-PICK 관리자 인증/수동 새로고침 수정본

중요 배포 순서
1. 관리자 Worker 코드 배포
2. Cloudflare > Workers & Pages > ga-pick-admin > Settings > Variables and Secrets
3. ADMIN_API_TOKEN을 반드시 Secret(암호화) 타입으로 추가 또는 갱신
4. Save 후 Deploy
5. 관리자 페이지 > 관리자 인증 > 동일한 토큰 입력
6. 상단 새로고침 버튼 1회 클릭

이 배포본은 keep_vars=true와 required secret 선언을 포함합니다.
메뉴 이동이나 페이지 접속만으로 자동 새로고침하지 않습니다.
인증/조회 실패 시 기존 화면 데이터를 0건으로 덮어쓰지 않습니다.
