// ================================================================
// /js/app-bootstrap.js — HTML 동적 로드 & 초기화 지원 유틸
// ================================================================
(function () {
  console.log("⚙️ AppBootstrap 모듈 로드됨");

  /**
   * HTML 파일을 비동기 로드하여 target 요소에 삽입
   * @param {string} file - HTML 파일 경로
   * @param {string} [targetId="form-container"] - 삽입 대상 컨테이너 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  async function includeHTML(file, targetId = "form-container") {
    const container = document.getElementById(targetId);

    if (!container) {
      console.warn(`❌ includeHTML: #${targetId} 요소를 찾을 수 없습니다.`);
      return false;
    }

    console.log(`📥 includeHTML 시작 → ${file}`);

    try {
      // 1️⃣ fetch로 파일 로드
      const res = await fetch(file);
      if (!res.ok) throw new Error(`HTTP ${res.status} (${res.statusText})`);

      // 2️⃣ HTML 삽입
      const html = await res.text();
      container.innerHTML = html;

      console.log(`✅ includeHTML 완료 → ${file} (DOM 삽입 성공)`);

      // 3️⃣ 렌더 안정화 (2프레임 대기)
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      // 4️⃣ 페이지별 진입 로그 (Router에서 후처리 담당)
      if (file.includes("navbar.html")) console.log("🧭 Navbar HTML 로드 완료");
      if (file.includes("main.html")) console.log("🏠 Main 화면 HTML 로드 완료");
      if (file.includes("location-list.html")) console.log("📦 시약장 목록 HTML 로드 완료");
      //if (file.includes("cabinet-form.html")) console.log("🧩 시약장 등록 폼 HTML 로드 완료");
      if (file.includes("inventory-list.html")) console.log("🧪 재고 목록 HTML 로드 완료");
      if (file.includes("inventory-form.html")) console.log("🧾 재고 등록 폼 HTML 로드 완료");

      return true;
    } catch (err) {
      // 5️⃣ 에러 처리
      console.error(`❌ includeHTML 실패 (${file}):`, err);
      container.innerHTML = `
        <div style="text-align:center; color:#d33; padding:20px;">
          <p><strong>페이지를 불러오는 중 오류가 발생했습니다.</strong></p>
          <p style="font-size:13px;">(${file})</p>
        </div>`;
      return false;
    }
  }

  // ------------------------------------------------------------
  // 2️⃣ 전역 등록
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.includeHTML = includeHTML;

  console.log("✅ AppBootstrap 초기화 완료 — includeHTML 전역 등록됨");
})();
