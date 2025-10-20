(function () {
  // ================================================================
  // 앱 부트스트랩 (초기 로딩)
  // ================================================================
  window.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 App bootstrap 시작");

    // 1️⃣ 메인 화면 로드
    includeHTML("pages/main.html", "form-container");

    // 2️⃣ navbar.html 로드 후 setupNavbar 실행
    includeHTML("pages/navbar.html", "navbar-container", () => {
      console.log("✅ Navbar HTML 로드 완료 — setupNavbar() 실행");
      setupNavbar();
    });

    // 3️⃣ FAB 초기화
    setFabVisibility(false);
  });

  // ================================================================
  // HTML 조각 로드 유틸리티
  // ================================================================
  async function includeHTML(file, targetId = "form-container", callback) {
    const container = document.getElementById(targetId);
    if (!container) {
      console.warn(`❌ includeHTML: 대상 요소 #${targetId}를 찾지 못했습니다.`);
      return;
    }

    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      container.innerHTML = html;

      // 페이지별 후처리
      if (file.includes("inventory-list")) fetchInventoryAndRender?.();
      if (file.includes("inventory-detail")) loadInventoryDetail?.();
      if (file.includes("location-list")) loadCabinetList?.();
      if (file.includes("inventory-form")) initializeFormListeners?.();

      // 콜백 실행 (navbar 등)
      if (callback) callback();
    } catch (err) {
      console.error(`❌ includeHTML('${file}') 로드 실패:`, err);
    }
  }

  // 전역 노출
  window.includeHTML = includeHTML;
})();
