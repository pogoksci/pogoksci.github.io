// js/app-bootstrap.js
(function () {
  // ================================================================
  // 앱 부트스트랩 (초기 로딩)
  // ================================================================
  window.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 App bootstrap 시작");

    // 1️⃣ 메인 페이지 로드
    await includeHTML("pages/main.html", "form-container");

    // 2️⃣ 네비게이션 바 로드
    await includeHTML("pages/navbar.html", "navbar-container");
    setupNavbar?.();

    // 3️⃣ 플로팅 버튼 초기화
    setFabVisibility?.(false);
  });

  // ================================================================
  // HTML 조각 로드 유틸리티 (Promise 기반)
  // ================================================================
  async function includeHTML(file, targetId = "form-container") {
    const container = document.getElementById(targetId);
    if (!container) {
      console.warn(`❌ includeHTML: 대상 요소 #${targetId}를 찾지 못했습니다.`);
      return Promise.reject(new Error("Target container not found"));
    }

    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      container.innerHTML = html;

      // 페이지별 후처리
      if (file.includes("inventory-list")) await fetchInventoryAndRender?.();
      if (file.includes("inventory-detail")) await loadInventoryDetail?.();
      if (file.includes("location-list")) await loadCabinetList?.();
      if (file.includes("inventory-form")) await initializeFormListeners?.();
      if (file.includes("navbar")) await setupNavbar?.();

      return true; // ✅ resolve
    } catch (err) {
      console.error(`❌ includeHTML('${file}') 로드 실패:`, err);
      throw err; // ✅ reject
    }
  }

  // 전역 노출
  window.includeHTML = includeHTML;
})();
