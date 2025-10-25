// ================================================================
// /js/router/router.js — 간단한 라우터 (App.Router)
// ================================================================
(function () {
  const routes = {
    main: "pages/main.html",
    cabinets: "pages/location-list.html",
    addCabinet: "pages/cabinet-form.html",
    inventory: "pages/inventory-list.html",
    addInventory: "pages/inventory-form.html",
  };

  async function go(pageKey, targetId = "form-container", callback = null) {
    const routes = {
      main: "pages/main.html",
      cabinets: "pages/location-list.html",
      inventory: "pages/inventory-list.html",
    };

    const file = routes[pageKey];
    if (!file) {
      console.warn(`❌ Router: ${pageKey} 라우트 없음`);
      return;
    }

    console.log(`🧭 Router → ${pageKey}`);

    await App.includeHTML(file, targetId);

    // ✅ DOM 렌더링 완료 보장
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // ✅ 페이지별 후처리
    if (pageKey === "cabinets" && App?.Cabinet?.loadList) {
      console.log("📦 Router → Cabinet.loadList() 실행");
      await App.Cabinet.loadList();
    }

    if (pageKey === "inventory" && App?.Inventory?.load) {
      console.log("📦 Router → Inventory.load() 실행");
      await App.Inventory.load();
    }

    if (typeof callback === "function") await callback();
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Router = { go, routes };
})();
