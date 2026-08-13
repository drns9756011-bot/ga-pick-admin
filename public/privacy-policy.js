(() => {
  const POLICY_ID = "privacyPolicyModal";
  const EFFECTIVE_DATE = "2026년 8월 11일";

  function policyMarkup() {
    return `
      <div class="privacy-policy-modal" id="${POLICY_ID}" hidden>
        <div class="privacy-policy-backdrop" data-close-privacy-policy></div>
        <section class="privacy-policy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacyPolicyTitle">
          <header class="privacy-policy-head">
            <div>
              <span class="privacy-policy-kicker">PRIVACY POLICY</span>
              <h2 id="privacyPolicyTitle">개인정보 처리방침</h2>
              <p>시행일 ${EFFECTIVE_DATE}</p>
            </div>
            <button type="button" class="privacy-policy-close" data-close-privacy-policy aria-label="개인정보 처리방침 닫기">×</button>
          </header>
          <div class="privacy-policy-body">
            <p class="privacy-policy-lead">
              픽브릿지(이하 “회사”)는 픽견적 서비스를 운영하면서 고객님과 판매 매니저의 개인정보를 필요한 범위에서만 처리하고,
              「개인정보 보호법」 등 관련 법령에 따라 안전하게 관리합니다. 본 방침은 픽견적 웹·모바일 웹 및 연동 앱에 적용됩니다.
            </p>

            <article class="privacy-policy-section">
              <h3>1. 개인정보 처리 항목·목적·법적 근거</h3>
              <div class="privacy-policy-table-wrap">
                <table class="privacy-policy-table">
                  <thead><tr><th>구분</th><th>처리 항목</th><th>이용 목적</th><th>주요 법적 근거</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>고객 견적 등록</td>
                      <td>성함, 휴대전화번호, 설치 지역, 구매 품목, 구매 목적, 희망 브랜드, 예상 금액, 설치 희망일, 요청사항, 견적서 이미지, 동의 기록</td>
                      <td>견적 접수, 본인 견적 조회, 판매자 제안 연결, 상담·알림, 서비스 분쟁 대응</td>
                      <td>개인정보 보호법 제15조 제1항 제1호(동의), 필요한 경우 같은 항 제4호(계약 이행·계약 체결 과정의 요청 조치)</td>
                    </tr>
                    <tr>
                      <td>브랜드관 상담</td>
                      <td>성함, 휴대전화번호, 설치 지역, 상담 희망 시간, 문의 내용, 선택한 패키지, 동의 기록</td>
                      <td>브랜드관 상담 접수, 고객 연락, 계약 연결 및 상담 이력 관리</td>
                      <td>개인정보 보호법 제15조 제1항 제1호</td>
                    </tr>
                    <tr>
                      <td>판매 매니저 등록·이용</td>
                      <td>판매자 아이디, 비밀번호의 일방향 해시값, 판매 채널, 지점, 지점 지역, 매니저 성함·직급·휴대전화번호, 명함 이미지, 메모, 동의 기록, 신규 견적 알림 수신 설정</td>
                      <td>판매자 심사·승인, 계정 로그인, 고객 견적 제안, 고객 선택 후 상담 연결, 알림 발송, 계정·보안 관리</td>
                      <td>개인정보 보호법 제15조 제1항 제1호 및 제4호</td>
                    </tr>
                    <tr>
                      <td>서비스 이용·보안</td>
                      <td>접속 일시, IP의 마스킹·해시값, User-Agent, 기기·브라우저 정보, 앱 푸시 토큰·기기 식별값(푸시 사용 시)</td>
                      <td>부정 이용 방지, 접속 이력 확인, 장애·보안 대응, 푸시 알림 제공</td>
                      <td>개인정보 보호법 제15조 제1항 제6호의 정당한 이익 범위 및 정보주체 동의가 필요한 기능은 별도 동의·권한</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="privacy-policy-note">회사는 주민등록번호, 건강정보 등 서비스 제공에 불필요한 고유식별정보·민감정보의 입력을 요구하지 않습니다. 견적서 이미지에 불필요한 개인정보가 포함된 경우 가린 뒤 업로드하는 것을 권장합니다.</p>
            </article>

            <article class="privacy-policy-section">
              <h3>2. 개인정보 보유 및 이용기간</h3>
              <ul>
                <li><strong>고객 견적 정보:</strong> 견적 등록일로부터 1년. 다만 원본 견적서 이미지는 등록일로부터 7일 후 자동 삭제하며, 서비스 표시용 대표 이미지 및 견적 기록은 최대 1년 보관합니다.</li>
                <li><strong>견적 비교 진행:</strong> 견적 제안 접수는 원칙적으로 등록 후 72시간 운영되며, 비교 종료 후에도 본인 조회·분쟁 대응을 위해 위 1년 보유기간 내에서 보관할 수 있습니다.</li>
                <li><strong>브랜드관 상담 정보:</strong> 상담 접수일로부터 1년 또는 고객님의 삭제 요청 시까지.</li>
                <li><strong>판매자 등록 신청 정보:</strong> 심사 중에는 심사 완료 시까지, 심사 완료 정보는 완료일로부터 1년. 승인된 판매자 계정 정보는 판매자 등록·이용관계 유지 기간 동안 보관하며 탈퇴·승인 취소 시 지체 없이 삭제합니다.</li>
                <li><strong>판매자 접속·보안 기록:</strong> 생성일로부터 1년을 원칙으로 합니다.</li>
                <li><strong>알림톡·SMS 발송 기록:</strong> 발송·접수일로부터 1년을 원칙으로 하며, 메시지 제공업체가 법령 또는 자체 정책에 따라 별도 보관하는 정보는 해당 기준을 따릅니다.</li>
                <li><strong>삭제 처리 확인 기록:</strong> 고객이 견적 삭제를 요청하거나 관리자가 삭제한 경우 삭제 사실 확인 및 분쟁 대응을 위한 최소 기록은 1년 보관 후 삭제합니다.</li>
              </ul>
              <p>관련 법령에 별도의 보존 의무가 있는 경우에는 해당 법령이 정한 기간 동안 필요한 정보만 분리하여 보관합니다.</p>
            </article>

            <article class="privacy-policy-section">
              <h3>3. 판매 매니저에게 제공되는 고객 정보</h3>
              <p>픽견적은 견적 비교 서비스의 특성상 고객님의 견적 내용 일부를 승인된 판매 매니저에게 제공할 수 있습니다. 이는 개인정보 보호법 제17조에 따른 동의 범위에서 처리합니다.</p>
              <ul>
                <li><strong>견적 제안 단계:</strong> 고객 성함, 구매 품목, 희망 브랜드, 설치 지역, 설치 일정, 요청사항, 견적서 이미지 등 제안에 필요한 정보가 제공될 수 있습니다. 고객님의 휴대전화번호는 일반 판매자 화면에서 비공개·마스킹 처리됩니다.</li>
                <li><strong>고객 선택 이후:</strong> 고객님이 선택한 판매자 또는 고객님이 직접 선택한 연락처 공개 범위(예: 선택 판매자 또는 상위 제안 1~3곳)에 한해 상담에 필요한 연락처가 공개됩니다.</li>
                <li><strong>브랜드관 상담:</strong> 상담 접수 단계에서는 픽견적이 직접 관리하며, 실제 판매처 연결이 필요한 경우 제공받는 자·항목·목적을 별도로 안내하고 필요한 동의를 거친 후 전달합니다.</li>
              </ul>
              <p>제공받는 판매자는 제공 목적이 달성된 후 해당 정보를 지체 없이 파기해야 하며, 별도 법령상 보존의무 또는 고객님의 별도 동의가 있는 경우에는 그 기간을 따릅니다.</p>
              <h4>판매 매니저 정보의 고객 공개 범위</h4>
              <ul>
                <li><strong>제안 비교 전·비선택 단계:</strong> 판매 채널을 중심으로 표시하며 지점명, 매니저 성함, 연락처, 명함 등 직접 식별 가능한 정보는 서비스 정책에 따라 비공개 또는 마스킹 처리합니다.</li>
                <li><strong>고객 선택 이후:</strong> 고객님이 선택한 판매자에 대해서는 계약·상담 연결에 필요한 지점, 매니저 성함·직급, 연락처, 명함 등의 정보가 고객님에게 공개될 수 있습니다.</li>
                <li><strong>브랜드관:</strong> 공개 화면에는 판매 채널만 표시하고 실제 지점·담당 매니저·연락처는 픽견적 관리자 내부에서 상담·정산 목적으로 관리합니다.</li>
              </ul>
            </article>

            <article class="privacy-policy-section">
              <h3>4. 개인정보 처리업무의 위탁</h3>
              <p>회사는 서비스 운영에 필요한 범위에서 다음 사업자의 서비스를 이용합니다. 수탁자는 위탁 목적을 벗어나 개인정보를 이용할 수 없습니다.</p>
              <div class="privacy-policy-table-wrap">
                <table class="privacy-policy-table">
                  <thead><tr><th>수탁자</th><th>위탁 업무</th><th>처리되는 정보 예시</th></tr></thead>
                  <tbody>
                    <tr><td>Cloudflare, Inc.</td><td>웹 호스팅·CDN·보안, 서버리스 처리, D1 데이터베이스 및 R2 파일 저장</td><td>서비스 이용정보, 고객·판매자 등록정보, 견적·상담 데이터, 업로드 이미지</td></tr>
                    <tr><td>주식회사 누리고(SOLAPI)</td><td>카카오 알림톡·SMS 등 메시지 발송</td><td>수신 휴대전화번호, 수신자명, 견적번호·상태 등 메시지 발송에 필요한 최소 정보</td></tr>
                  </tbody>
                </table>
              </div>
              <p class="privacy-policy-note">Cloudflare 등 글로벌 인프라 사업자의 실제 데이터 처리 위치는 서비스 설정 및 해당 사업자의 데이터 위치 정책에 따라 달라질 수 있습니다. 국외 이전에 해당하는 처리가 확정되는 경우 회사는 개인정보 보호법상 필요한 고지·동의 또는 적법한 이전 근거를 확인하여 세부사항을 본 방침에 반영합니다.</p>
            </article>

            <article class="privacy-policy-section">
              <h3>5. 자동 수집 정보와 Google AdSense</h3>
              <p>서비스는 보안·접속 통계 등을 위해 접속정보를 처리할 수 있습니다. 또한 픽견적 페이지에는 Google AdSense 관련 스크립트가 포함될 수 있으며, Google 및 광고 파트너가 광고 제공·성과 측정 등을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다.</p>
              <ul>
                <li>이용자는 브라우저 설정에서 쿠키 저장을 차단하거나 삭제할 수 있습니다.</li>
                <li>Google의 맞춤 광고 설정은 <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">Google My Ad Center</a>에서 관리할 수 있습니다.</li>
              </ul>
            </article>

            <article class="privacy-policy-section">
              <h3>6. 개인정보의 파기</h3>
              <p>보유기간이 경과하거나 처리 목적이 달성된 개인정보는 개인정보 보호법 제21조에 따라 지체 없이 파기합니다. 전자적 파일은 복구·재생이 어렵도록 삭제하고, 업로드 파일은 저장소에서 삭제합니다. 법령에 따라 별도 보존이 필요한 정보는 다른 개인정보와 분리하여 보관합니다.</p>
            </article>

            <article class="privacy-policy-section">
              <h3>7. 정보주체의 권리와 행사방법</h3>
              <p>고객님과 판매 매니저는 개인정보 보호법 제35조부터 제37조에 따라 자신의 개인정보에 대해 열람, 정정·삭제, 처리정지 및 동의 철회를 요구할 수 있습니다. 서비스 내 기능 또는 아래 개인정보 문의 창구를 통해 요청할 수 있으며, 회사는 본인 여부를 확인한 후 법령이 정한 범위에서 처리합니다.</p>
              <ul>
                <li>고객님: 본인 견적 조회·삭제 요청, 상담 정보 삭제 요청</li>
                <li>판매 매니저: 계정 정보 수정·탈퇴 요청, 신규 견적 알림 수신거부 설정</li>
              </ul>
            </article>

            <article class="privacy-policy-section">
              <h3>8. 개인정보의 안전성 확보조치</h3>
              <p>회사는 개인정보 보호법 제29조 및 관련 시행령에 따라 접근권한 관리, 관리자 인증, 판매자 비밀번호 일방향 해시 처리, 고객 연락처의 화면 마스킹·선택적 공개, 접속기록 관리, 업로드 원본 이미지의 제한된 보관기간 적용 등 서비스 규모와 처리 위험에 맞는 보호조치를 시행합니다.</p>
            </article>

            <article class="privacy-policy-section">
              <h3>9. 만 14세 미만 아동</h3>
              <p>픽견적은 원칙적으로 만 14세 미만 아동을 대상으로 서비스를 제공하지 않습니다. 만 14세 미만 아동의 개인정보를 처리할 필요가 생기는 경우 관련 법령에 따라 법정대리인 동의 등 필요한 절차를 거칩니다.</p>
            </article>

            <article class="privacy-policy-section">
              <h3>10. 개인정보 보호업무 및 고충처리</h3>
              <div class="privacy-policy-contact">
                <strong>개인정보처리자: 픽브릿지 (서비스: 픽견적)</strong>
                <span>사업자등록번호: 548-61-00920</span>
                <span>개인정보 보호업무 담당: 픽브릿지 운영팀</span>
                <span>문의: 카카오톡 채널 @픽견적</span>
              </div>
              <p>개인정보 침해에 관한 신고·상담 또는 분쟁조정이 필요한 경우 개인정보보호위원회, 개인정보침해 신고기관 등 관계기관의 절차를 이용할 수 있습니다.</p>
            </article>

            <article class="privacy-policy-section">
              <h3>11. 처리방침의 변경</h3>
              <p>법령, 서비스 기능 또는 개인정보 처리방식이 변경되는 경우 본 처리방침을 수정할 수 있습니다. 중요한 변경이 있는 경우 서비스 화면 등을 통해 사전에 알리며, 변경된 방침에는 시행일을 표시합니다.</p>
            </article>
          </div>
          <footer class="privacy-policy-actions">
            <button type="button" class="privacy-policy-confirm" data-close-privacy-policy>확인</button>
          </footer>
        </section>
      </div>`;
  }

  function ensureModal() {
    let modal = document.getElementById(POLICY_ID);
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend", policyMarkup());
    modal = document.getElementById(POLICY_ID);
    modal?.addEventListener("click", (event) => {
      if (event.target?.matches?.("[data-close-privacy-policy], .privacy-policy-backdrop")) closePolicy();
    });
    return modal;
  }

  let previousOverflow = "";
  function openPolicy() {
    const modal = ensureModal();
    if (!modal) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    modal.querySelector(".privacy-policy-close")?.focus({ preventScroll: true });
  }

  function closePolicy() {
    const modal = document.getElementById(POLICY_ID);
    if (!modal || modal.hidden) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
    document.body.style.overflow = previousOverflow;
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-privacy-policy]");
    if (!trigger) return;
    event.preventDefault();
    openPolicy();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePolicy();
  });
})();
