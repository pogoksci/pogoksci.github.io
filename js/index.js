// ================================================================
// /js/index.js — 로딩 스플래시 + 비동기 JS 로딩 최적화 + 완전 실행 보장
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

    // includeHTML 준비 확인
    if (typeof App.includeHTML !== "function") {
      console.error("❌ App.includeHTML이 정의되지 않음");
      return;
    }

    // Navbar 로드
    await App.includeHTML("pages/navbar.html", "navbar-container");
    if (App.Navbar?.setup) App.Navbar.setup();

    // Main 화면 로드
    await App.includeHTML("pages/main.html", "form-container");

    // FAB 숨김
    App.Fab?.setVisibility(false);
    console.log("✅ 초기화 완료 — App 실행 중");

    // ⭐ 스플래시 유지 → 0.8초 후 사라짐
    setTimeout(() => {
      document.body.classList.remove("home-active"); // splash 종료
      document.body.classList.add("loaded");         // 화면 표시
      console.log("🌈 Splash → Loaded 전환 완료");
    }, 800);
  }

  // ------------------------------------------------------------
  // 4️⃣ 실행 순서
  // ------------------------------------------------------------
  try {
    await loadModulesSequentially(baseModules, "Base");
    await loadModulesSequentially(coreModules, "Core");
    await loadModulesSequentially(uiModules, "UI");
    await loadModulesSequentially(routerModules, "Router");
    console.log("🧩 모든 모듈 로드 완료!");

    // DOM 상태에 따라 초기화 실행
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
