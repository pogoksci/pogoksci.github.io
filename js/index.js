// ================================================================
// /js/index.js — 홈 로고 유지 + 비동기 모듈 로딩 최적화
// ================================================================
(async function () {
  console.log("🚀 App index.js 시작 — 모듈 비동기 로딩 중...");

  // ✅ 홈(로고) 화면 표시 + 스크롤 비활성화
  document.body.classList.add("home-active");

  // ------------------------------------------------------------
  // 1️⃣ 모듈 경로 정의
  // ------------------------------------------------------------
  const baseModules = [
    "./js/supabaseClient.js",
    "./js/app-bootstrap.js", // includeHTML 정의
  ];
  const coreModules = [
    "./js/core/utils.js",
    "./js/core/state.js",
    "./js/core/api.js",
    "./js/core/camera.js",
    "./js/core/fab.js",
  ];
  const uiModules = [
    "./js/ui/cabinet.js",
    "./js/ui/forms.js",
    "./js/ui/inventory.js",
    "./js/ui/inventory-detail.js",
    "./js/ui/navbar.js",
    "./js/ui/data-sync.js",
    "./js/ui/usage-register.js?v=4", // ✅ 캐시 갱신을 위해 버전 추가
    "./js/ui/waste.js", // ✅ 폐수 관리 모듈 추가
    "./js/pages/kits.js", // ✅ 키트 페이지 로직
  ];
  const componentModules = [
    "./js/components/sort-dropdown.js", // 🔹 여기 추가됨
    "./js/utils/kit-sync.js", // ✅ 키트 동기화 유틸
  ];

  const routerModules = ["./js/router/router.js"];

  // ------------------------------------------------------------
  // 2️⃣ 스크립트 로드 유틸리티
  // ------------------------------------------------------------
  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = path;
      script.defer = true;
      script.onload = () => {
        console.log(`✅ ${path} 로드 완료`);
        resolve();
      };
      script.onerror = () => reject(`❌ ${path} 로드 실패`);
      document.head.appendChild(script);
    });
  }

  async function loadModulesSequentially(list, label) {
    console.log(`📦 ${label} 모듈 로딩 시작`);
    for (const mod of list) {
      try {
        await loadScript(mod);
      } catch (err) {
        console.error(`❌ ${mod} 로드 실패:`, err);
        throw err;
      }
    }
  }

  // ------------------------------------------------------------
  // 3️⃣ 초기화 함수
  // ------------------------------------------------------------
  async function initApp() {
    console.log("📦 initApp() — 초기화 시작");

    if (typeof App.includeHTML !== "function") {
      console.error("❌ App.includeHTML이 정의되지 않음");
      return;
    }

    // Navbar 로드
    await App.includeHTML("pages/navbar.html", "navbar-container");
    if (App.Navbar?.setup) App.Navbar.setup();

    // ---------------------------------------------------
    // ✅ Navbar 로드 후, 스플래시 텍스트를 최종 상태(GOE학교)로 변경
    // ---------------------------------------------------
    const { APPNAME, SCHOOL } = globalThis.APP_CONFIG || {};
    const titleEl = document.getElementById("app-title");
    const schoolEl = document.getElementById("school-name");

    if (titleEl && APPNAME) titleEl.textContent = APPNAME;
    if (schoolEl && SCHOOL) schoolEl.textContent = SCHOOL;
    console.log("🔄 Splash 화면 텍스트 업데이트 완료 (GOE학교)");

    // Main 화면 로드
    await App.includeHTML("pages/main.html", "form-container");

    // FAB 숨김
    App.Fab?.setVisibility(false);

    console.log("✅ 초기화 완료 — App 실행 중");

    // 🚫 더 이상 splash를 숨기지 않음 (홈 로고로 계속 유지)
    console.log("🏠 홈 로고 화면 유지 중 (home-active 상태 지속)");
  }

  // ---------------------------------------------------
  // Splash 화면 텍스트 즉시 반영 (index.html 기반)
  // ---------------------------------------------------
  function updateSplashScreenText() {
    const { APPNAME, VERSION, SCHOOL } = globalThis.APP_CONFIG || {};

    const titleEl = document.getElementById("app-title");
    const verEl = document.getElementById("app-version");
    const schoolEl = document.getElementById("school-name");

    if (titleEl) titleEl.textContent = APPNAME || "";
    if (verEl) verEl.textContent = VERSION || "";
    if (schoolEl) schoolEl.textContent = SCHOOL || "";

    console.log("🔄 Splash 화면 텍스트 업데이트 완료");
  }

  // DOMContentLoaded 또는 initApp에서 실행
  document.addEventListener("DOMContentLoaded", () => {
    // updateSplashScreenText(); // 🚫 초기 로딩 시 텍스트 덮어쓰기 방지 (HTML 하드코딩 사용)
  });

  // ------------------------------------------------------------
  // 4️⃣ 실행 순서
  // ------------------------------------------------------------
  try {
    await loadModulesSequentially(baseModules, "Base");
    await loadModulesSequentially(coreModules, "Core");
    await loadModulesSequentially(componentModules, "Components"); // ✅ UI보다 먼저 로드
    await loadModulesSequentially(uiModules, "UI");
    await loadModulesSequentially(routerModules, "Router");
    console.log("🧩 모든 모듈 로드 완료!");

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initApp);
    } else {
      await initApp();
    }
  } catch (err) {
    console.error("❌ 전체 모듈 로드 실패:", err);
    alert("필수 스크립트를 불러오지 못했습니다.");
  }
})();
