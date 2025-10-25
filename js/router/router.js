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
    const file = routes[pageKey];
    if (!file) return console.error(`❌ Router: ${pageKey} 라우트 없음`);

    console.log(`🧭 Router → ${pageKey}`);
    await App.includeHTML(file, targetId);

    // ✅ 브라우저가 HTML을 DOM에 실제로 반영할 시간을 잠시 줌
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // ✅ 페이지별 후처리 실행 (예: 목록 로딩)
    if (pageKey === "cabinets" && App.Cabinet?.loadList) {
      await App.Cabinet.loadList();
    }

    if (typeof callback === "function") await callback();
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Router = { go, routes };
})();
