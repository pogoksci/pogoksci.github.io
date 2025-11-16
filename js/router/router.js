// ================================================================
// /js/router/router.js — 완전 안정화 버전 (2프레임 대기 + 중복 제거)
// ================================================================
(function () {
  const routes = {
    main: "pages/main.html",
    cabinets: "pages/location-list.html",
    addCabinet: "pages/cabinet-form.html",
    inventory: "pages/inventory-list.html",
    addInventory: "pages/inventory-form.html",
  };

  /**
   * Router.go()
   * @param {string} pageKey - 이동할 페이지 키
   * @param {string} targetId - HTML을 로드할 컨테이너 ID
   * @param {function} [callback] - 후처리 콜백
   */
  async function go(pageKey, targetId = "form-container", callback = null) {
    const file = routes[pageKey];
    if (!file) {
      console.warn(`❌ Router: ${pageKey} 라우트 없음`);
      return;
    }

    console.log(`🧭 Router → ${pageKey}`);

    // ✅ HTML include
    await App.includeHTML(file, targetId);

    // ✅ 렌더 안정화를 위해 2프레임 대기 (layout + paint 보장)
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    // ✅ 페이지별 후처리
    switch (pageKey) {
      case "cabinets":
        if (App?.Cabinet?.loadList) {
          console.log("📦 Router → Cabinet.loadList() 실행");
          await App.Cabinet.loadList();
        }
        break;

      case "inventory":
        if (App?.Inventory?.showListPage) {
          console.log("📦 Router → Inventory.showListPage() 실행");
          await App.Inventory.showListPage();
        }
        break;

      case "addCabinet":
        if (App?.Forms?.initCabinetForm) {
          console.log("🧩 Router → Cabinet Form 초기화 실행");
          await App.Forms.initCabinetForm("create");
        }
        break;

      case "addInventory":
        if (App?.Forms?.initInventoryForm) {
          console.log("🧩 Router → Inventory Form 초기화 실행");
          await App.Forms.initInventoryForm("create");
        }
        break;

      case "main":
        console.log("🏠 Router → 메인 화면 진입");
        break;

      default:
        console.warn(`⚠️ Router: ${pageKey}에 대한 후처리 없음`);
        break;
    }

    // ✅ 콜백이 있으면 실행
    if (typeof callback === "function") await callback();
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Router = { go, routes };
})();
