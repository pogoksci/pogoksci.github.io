// ================================================================
// /js/index.js — 앱 전체 초기화 및 모듈 로더 (최종 실행 버전)
// ================================================================
(async function () {
  console.log("🚀 App index.js 시작 — 모듈 로딩 중...");

  // ------------------------------------------------------------
  // 1️⃣ 모듈 경로 정의
  // ------------------------------------------------------------
  const coreModules = [
    "/js/core/utils.js",
    "/js/core/state.js",
    "/js/core/api.js",
    "/js/core/camera.js",
    "/js/core/fan.js",
  ];

  const uiModules = [
    "/js/ui/forms.js",
    "/js/ui/cabinet.js",
    "/js/ui/inventory.js",
    "/js/ui/inventory-detail.js",
    "/js/ui/navbar.js",
  ];

  const routerModules = [
    "/js/router/router.js",
  ];

  const baseModules = [
    "/js/supabaseClient.js",
    "/js/app-bootstrap.js", // ✅ includeHTML 로딩
  ];

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

  // ------------------------------------------------------------
  // 3️⃣ 순차 로드 (의존 순서 엄격히 보장)
  // ------------------------------------------------------------
  try {
    // (1) Supabase & includeHTML 로드
    for (const mod of baseModules) await loadScript(mod);

    // (2) Core 모듈 로드
    for (const mod of coreModules) await loadScript(mod);

    // (3) UI 모듈 로드
    for (const mod of uiModules) await loadScript(mod);

    // (4) Router 로드 (맨 마지막)
    for (const mod of routerModules) await loadScript(mod);

    console.log("🧩 모든 모듈 로드 완료!");

  } catch (err) {
    console.error("❌ 모듈 로딩 중 오류:", err);
    alert("필수 스크립트를 불러오지 못했습니다.");
    return;
  }

  // ------------------------------------------------------------
  // 4️⃣ 초기 진입점 (bootstrap → Router)
  // ------------------------------------------------------------
  globalThis.addEventListener("DOMContentLoaded", async () => {
    console.log("📦 DOMContentLoaded — 초기화 시작");

    // ① app-bootstrap.js 내 includeHTML() 동작 확인
    if (typeof App.includeHTML !== "function") {
      console.error("❌ App.includeHTML이 정의되지 않음");
      return;
    }

    // ② 기본 네비게이션 및 메인 페이지 로드
    await App.includeHTML("pages/navbar.html", "navbar-container");
    await App.includeHTML("pages/main.html", "form-container");

    // ③ Router를 통해 시약장 목록 기본 진입
    if (App.Router && typeof App.Router.go === "function") {
      App.Router.go("cabinets");
    } else {
      console.warn("⚠️ App.Router.go() 없음 — 기본 includeHTML 사용");
      App.includeHTML("pages/location-list.html", "form-container");
    }

    console.log("✅ 초기화 완료 — App 실행 중");
  });
})();
