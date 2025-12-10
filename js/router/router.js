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
    inventoryDetail: "pages/inventory-detail.html", // ✅ 상세 페이지 추가
    usageRegister: "pages/usage-register.html", // ✅ 사용량 등록 페이지 추가
    dataSync: "pages/data-sync.html",
    wasteList: "pages/waste-list.html",
    wasteForm: "pages/waste-form.html",
    kits: "pages/kits.html",
    kitDetail: "pages/kit-detail.html", // ✅ 키트 상세 페이지 추가
    teachingAids: "pages/teaching-aids.html", // ✅ 교구 페이지 추가
    teachingAidDetail: "pages/teaching-aid-detail.html", // ✅ 교구 상세 페이지 추가
    export: "pages/export.html", // ✅ 내보내기 페이지 추가
  };

  // ✅ 현재 상태 추적 (중복 pushState 방지)
  let currentState = null;

  /**
   * Router.go()
   * @param {string} pageKey - 이동할 페이지 키
   * @param {object} [params] - 페이지 파라미터 (예: { id: 123 })
   * @param {object} [options] - 옵션 (skipPush: history push 생략 여부)
   */
  async function go(pageKey, params = {}, options = {}) {
    const file = routes[pageKey];
    if (!file) {
      console.warn(`❌ Router: ${pageKey} 라우트 없음`);
      return;
    }

    console.log(`🧭 Router → ${pageKey}`, params);

    // ✅ History Push (뒤로가기 지원)
    if (!options.skipPush) {
      const state = { pageKey, params };
      // URL은 변경하지 않음 (null)
      history.pushState(state, "", null);
      currentState = state;
    }

    // ✅ 브라우저 자동 스크롤 복원 방지
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // ✅ HTML include
    const targetId = "form-container";
    await App.includeHTML(file, targetId);

    // ✅ 렌더 안정화를 위해 2프레임 대기
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    // ✅ 페이지별 후처리
    switch (pageKey) {
      case "cabinets":
        if (App?.Cabinet?.loadList) await App.Cabinet.loadList();
        break;

      case "inventory":
        if (App?.Inventory?.showListPage) {
          // showListPage는 내부적으로 includeHTML을 또 호출하므로, 
          // 여기서는 bindListPage와 loadList만 호출하는 것이 효율적일 수 있으나,
          // 기존 로직 유지를 위해 showListPage 호출 (단, 무한루프 주의)
          // 하지만 showListPage가 includeHTML을 호출하면 비효율적임.
          // Router가 이미 includeHTML을 했으므로, bind와 load만 수행하도록 변경 권장.
          // 일단은 기존 showListPage 사용 (약간의 중복 로드 감수)
          // await App.Inventory.showListPage(); 

          // 최적화: includeHTML(app-bootstrap.js)에서 이미 bindListPage와 loadList를 호출하므로 중복 호출 제거
          if (App.Fab?.setVisibility) App.Fab.setVisibility(false);
        }
        break;

      case "inventoryDetail":
        if (App?.Inventory?.loadDetail && params.id) {
          await App.Inventory.loadDetail(params.id);
        }
        break;

      case "usageRegister":
        if (App?.UsageRegister?.init) {
          await App.UsageRegister.init();
        }
        break;

      case "addCabinet":
        if (App?.Forms?.initCabinetForm) {
          await App.Forms.initCabinetForm("create");
        }
        break;

      case "addInventory":
        if (App?.Forms?.initInventoryForm) {
          const mode = params.mode || "create";
          const detail = params.detail || null;
          await App.Forms.initInventoryForm(mode, detail);
        }
        break;

      case "kits":
        if (App?.Kits?.init) {
          await App.Kits.init();
        }
        break;

      case "kitDetail":
        if (App?.Kits?.loadDetail && params.id) {
          await App.Kits.loadDetail(params.id);
        }
        break;

      case "dataSync":
        if (App?.DataSync?.init) App.DataSync.init();
        break;

      case "wasteList":
        if (App?.Waste?.bindListPage) App.Waste.bindListPage();
        break;

      case "wasteForm": // ✅ Missing case fixed
        if (App?.Waste?.initForm) {
          const mode = params.mode || "create";
          const id = params.id || null;
          App.Waste.initForm(mode, id);
        }
        break;

      case "export": // ✅ Export page logic
        if (App?.ExportPage?.init) {
          App.ExportPage.init();
        }
        break;

      case "teachingAids":
        if (App?.TeachingAids?.init) {
          await App.TeachingAids.init();
        }
        break;

      case "teachingAidDetail":
        if (App?.TeachingAids?.loadDetail && params.id) {
          await App.TeachingAids.loadDetail(params.id);
        }
        break;



      case "main":
        // 메인 화면 로직
        break;
    }

    // ✅ Navbar Active State Sync
    const navMapping = {
      inventory: "nav-inventory",
      inventoryDetail: "nav-inventory", // 상세 페이지도 약품 관리 활성화
      usageRegister: "nav-usage",
      cabinets: "menu-location",
      dataSync: "menu-datasync",
      wasteList: "nav-waste",
      wasteForm: "nav-waste",
      kits: "nav-kit",
      teachingAids: "nav-teaching-aids", // 교구 메뉴 활성화
      teachingAidDetail: "nav-teaching-aids",
      export: "menu-export", // 내보내기 메뉴 활성화
      main: "menu-home"
    };

    const navId = navMapping[pageKey];
    if (navId && App.Navbar?.setActive) {
      App.Navbar.setActive(navId);
    }

    // ✅ 스크롤 상단 이동
    window.scrollTo(0, 0);
  }

  // ✅ 뒤로가기 감지 (PopState)
  window.addEventListener("popstate", (event) => {
    const state = event.state;
    if (state && state.pageKey) {
      console.log("🔙 뒤로가기 감지:", state);
      go(state.pageKey, state.params, { skipPush: true });
    } else {
      // 초기 상태거나 state가 없는 경우 -> 메인으로
      console.log("🔙 초기 상태 복귀 -> Main");
      go("main", {}, { skipPush: true });
    }
  });

  // ✅ 초기 로드 시 현재 상태 저장 (Replace)
  // document.addEventListener("DOMContentLoaded", () => {
  //   history.replaceState({ pageKey: "main" }, "", null);
  // });

  globalThis.App = globalThis.App || {};
  globalThis.App.Router = { go, routes };
})();
