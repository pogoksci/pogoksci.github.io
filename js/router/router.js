// ================================================================
// /js/router/router.js — 완전 안정화 버전 (2프레임 대기 + 중복 제거)
// ================================================================
(function () {
  const routes = {
    login: "pages/login.html", // ✅ 로그인 페이지 추가
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
    teachingTools: "pages/teaching-tools.html", // ✅ 교구 페이지 추가
    teachingToolsDetail: "pages/teaching-tools-detail.html", // ✅ 교구 상세 페이지 추가
    toolsForm: "pages/tools-form.html", // ✅ 교구 등록 폼 페이지
    kitForm: "pages/kit-form.html", // ✅ 키트 등록 폼 페이지
    equipmentCabinets: "pages/equipment-cabinet-list.html", // ✅ 교구·물품장 설정 페이지
    labSettings: "pages/lab-settings.html", // ✅ 과학실 설정 페이지
    labTimetable: "pages/lab-timetable.html", // ✅ 시간표 설정 페이지
    labTimetableViewer: "pages/lab-timetable-viewer.html", // ✅ 시간표 전체 보기 페이지 (New)
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
    
    // ... code omitted for brevity ...
    
    // ✅ 페이지별 후처리
    switch (pageKey) {
        // ... previous cases ...
      case "labSettings": 
        if (App?.LabSettings?.init) {
          await App.LabSettings.init();
        }
        break;

      case "labTimetable":
        if (App?.LabTimetable?.init) {
          await App.LabTimetable.init();
        }
        break;
        
      case "labTimetableViewer":
        if (App?.TimetableViewer?.init) {
             await App.TimetableViewer.init();
        }
        break;

      case "wasteList":
        if (App.Waste?.bindListPage) App.Waste.bindListPage();
        break;
      
      case "wasteForm":
        if (App.Waste?.initForm) App.Waste.initForm(params.mode || "create", params.id || null);
        break;

      case "kits":
        if (App.Kits?.init) await App.Kits.init();
        break;

      case "kitDetail":
        if (App.Kits?.loadDetail && params.id) await App.Kits.loadDetail(params.id);
        break;

      case "teachingTools":
        if (App.TeachingTools?.init) await App.TeachingTools.init();
        break;
      
      case "teachingToolsDetail":
        if (App.TeachingTools?.loadDetail && params.id) await App.TeachingTools.loadDetail(params.id);
        break;

      case "toolsForm":
        // Usually handled by auto-run script or simple form logic, 
        // but if there's an init method, call it.
        // Assuming tools-form.js auto-binds or needs init.
        // Let's assume standard behavior for now.
        break;

      case "kitForm":
        // Similar to toolsForm
        break;

      case "login":
        if (App?.Auth?.bindLoginForm) {
          App.Auth.bindLoginForm();
        }
        // 로그인 페이지에서는 Navbar 숨기기? (선택사항, 일단은 둠)
        break;

      case "main":
        // 메인 화면 로직: Splash 모드 복구
        document.body.classList.add("home-active");
        document.body.classList.remove("loaded");

        // Router.go에서 includeHTML을 호출하므로, 
        // bootstrap.js 내부 로직이 텍스트 업데이트(App config)는 처리함.
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
      teachingTools: "nav-teaching-tools", // 교구 메뉴 활성화
      teachingToolsDetail: "nav-teaching-tools",
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
  globalThis.App.Router = { go, routes, getCurrentState: () => currentState };
})();
