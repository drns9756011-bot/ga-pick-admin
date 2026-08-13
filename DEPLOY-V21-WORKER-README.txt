픽견적 정식 배포용 전체 Cloudflare Worker 패키지

이번 변경
- 견적올리기 선택 카드 제목과 설명 글자 크기 축소
- 과도하게 굵은 모바일 글꼴 정리
- 선택 카드와 다음 버튼의 높이 및 간격 통일
- 중복되어 있던 대형 모바일 글꼴 규칙 제거

배포 방법
1. 이 압축파일의 내용을 GitHub 저장소 루트에 그대로 반영합니다.
2. Cloudflare의 ga-pick-public Worker에서 새 배포를 진행합니다.
3. Wrangler를 사용하는 경우 저장소 루트에서 npx wrangler deploy 를 실행합니다.

주의
- public 폴더만 올리는 정적 사이트 패키지가 아닙니다.
- src/index.js, functions, public, wrangler.toml, package.json을 함께 배포해야 합니다.
- 원격 파일을 먼저 수동 삭제할 필요는 없습니다. 새 배포가 현재 버전을 교체합니다.

확인 값
- X-GA-Pick-Route-Version: 20260811-main-redesign-v21-worker
- meta pickquote-build: 20260811-main-redesign-v21-worker
