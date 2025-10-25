// ================================================================
// /js/index.js — 로딩 스플래시 + 비동기 JS 로딩 최적화 + 완전 실행 보장
// ================================================================
(async function () {
  console.log("🚀 App index.js 시작 — 모듈 비동기 로딩 중...");

  // ------------------------------------------------------------
  // 1️⃣ 모듈 경로 정의 (상대 경로)
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
    "./js/ui/forms.js",
    "./js/ui/cabinet.js",
    "./js/ui/inventory.js",
    "./js/ui/inventory-detail.js",
    "./js/ui/navbar.js",
  ];
  const routerModules = [
    "./js/router/router.js",
  ];

  // ------------------------------------------------------------
  // 2️⃣ 스크립트 로드 유틸리티 (Promise 기반 비동기 로더)
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
  // 3️⃣ 로딩 스플래시 표시 (로고)
  // ------------------------------------------------------------
  function showSplash() {
    const splash = document.createElement("div");
    splash.id = "splash-screen";
    splash.style = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:#ffffff; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      z-index:9999; transition:opacity 0.5s ease;
    `;
    splash.innerHTML = `
      <img src="css/logo.png" alt="SciManager" style="max-width:150px; opacity:0.9;">
      <h2 style="color:#333; margin-top:15px;">SciManager</h2>
      <p style="color:#666;">로딩 중...</p>
    `;
    document.body.appendChild(splash);
  }

  function hideSplash() {
    const splash = document.getElementById("splash-screen");
    if (splash) {
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 500);
    }
  }

  // ------------------------------------------------------------
  // 4️⃣ 초기화 함수
  // ------------------------------------------------------------
  async function initApp() {
    console.log("📦 initApp() — 초기화 시작");

    // ✅ includeHTML 준비 확인
    if (typeof App.includeHTML !== "function") {
      console.error("❌ App.includeHTML이 정의되지 않음");
      return;
    }

    // ✅ Navbar & Main 페이지 로드
    await App.includeHTML("pages/navbar.html", "navbar-container");

    if (App.Navbar && typeof App.Navbar.setup === "function") {
      App.Navbar.setup();
      console.log("✅ Navbar setup 완료");
    }

    await App.includeHTML("pages/main.html", "form-container");

    // ✅ 기본 페이지 (시약장 목록 X, 로고 유지)
    App.Fab?.setVisibility(false);
    console.log("✅ 초기화 완료 — App 실행 중");

    // ✅ 로딩 스플래시 제거
    hideSplash();
  }

  // ------------------------------------------------------------
  // 5️⃣ 실제 실행 (스플래시 표시 + 비동기 로드 + initApp)
  // ------------------------------------------------------------
  showSplash();

  try {
    // base → core → ui → router 순서대로 로드
    await loadModulesSequentially(baseModules, "Base");
    await loadModulesSequentially(coreModules, "Core");
    await loadModulesSequentially(uiModules, "UI");
    await loadModulesSequentially(routerModules, "Router");

    console.log("🧩 모든 모듈 로드 완료!");

    // DOM 상태에 관계없이 즉시 초기화
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initApp);
    } else {
      await initApp();
    }

  } catch (err) {
    console.error("❌ 전체 모듈 로드 실패:", err);
    alert("필수 스크립트를 불러오지 못했습니다.");
    hideSplash();
  }
})();
