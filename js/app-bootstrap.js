// /js/app-bootstrap.js
(function () {
  // -----------------------------------------------------
  // includeHTML: HTML 조각을 targetId에 넣고, Promise 반환
  // -----------------------------------------------------
  async function includeHTML(file, targetId = "form-container") {
    const container = document.getElementById(targetId);
    if (!container) {
      console.warn(`❌ includeHTML: #${targetId} not found`);
      return;
    }

    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      container.innerHTML = html;

      // 페이지별 후처리: 초기화 함수 호출
      if (file.includes("location-list.html")) {
        // 시약장 목록 화면
        if (App && App.Cabinet && typeof App.Cabinet.loadList === "function") {
          App.Cabinet.loadList();
        }
      }

      if (file.includes("cabinet-form.html")) {
        // 시약장 등록/수정 폼 화면
        if (App && App.Forms && typeof App.Forms.initCabinetForm === "function") {
          App.Forms.initCabinetForm(); // detail은 edit 시점에 넘김
        }
      }

      if (file.includes("inventory-list.html")) {
        App.Inventory?.load?.();
      }
      if (file.includes("inventory-detail.html")) {
        App.Inventory?.loadDetail?.();
      }
      if (file.includes("inventory-form.html")) {
        App.Forms?.initInventoryForm?.();
      }

      return true;
    } catch (err) {
      console.error(`❌ ${file} 로드 실패:`, err);
      container.innerHTML =
        `<p style="color:red; text-align:center;">페이지를 불러오는 데 실패했습니다.</p>`;
      return false;
    }
  }

  // -----------------------------------------------------
  // 앱 시작점
  // -----------------------------------------------------
  async function bootstrap() {
    console.log("🚀 App bootstrap 시작");

    // 메인 영역 로드
    await includeHTML("pages/main.html", "form-container");

    // navbar 로드 -> 로드된 뒤 setup 호출
    const ok = await includeHTML("pages/navbar.html", "navbar-container");
    if (ok && App && App.Navbar && typeof App.Navbar.setup === "function") {
      App.Navbar.setup();
      console.log("✅ Navbar setup complete");
    }

    // FAB 초기 숨김
    App.Fab?.setVisibility(false);
  }

  // -----------------------------------------------------
  // 전역 등록
  // -----------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.includeHTML = includeHTML;

  //globalThis.addEventListener("DOMContentLoaded", bootstrap);
})();
