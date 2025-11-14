// ================================================================
// /js/ui/navbar.js — 홈 버튼 최소 동작 버전
// ================================================================
(function () {
  console.log("🧭 App.Navbar 모듈 로드됨");

  const getApp = () => globalThis.App || {};

  function closeStartMenu() {
    const menu = document.getElementById("start-menu");
    if (menu) menu.classList.remove("open");
  }

  /** 메뉴 active 표시 */
  function setActive(id) {
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.remove("active");
    });
    const btn = document.getElementById(id);
    if (btn) btn.classList.add("active");
  }

  // --------------------------------------------------------
  // 🌟 1️⃣ 홈 버튼 — 화면만 로고 화면으로 전환
  // --------------------------------------------------------
  function setupHomeButton() {
    const menuHomeBtn = document.getElementById("menu-home-btn");
    if (!menuHomeBtn) return;

    menuHomeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("🏠 홈 버튼 클릭됨 — 화면만 로고화면으로 복귀");

      // ① 로고 화면을 보이게 업데이트
      document.body.classList.add("home-active");
      document.body.classList.remove("loaded");

      // ② form-container 비우기 (이전 페이지 흔적 제거)
      const container = document.getElementById("form-container");
      if (container) container.innerHTML = "";

      // ③ FAB 숨김
      getApp().Fab?.setVisibility(false);

      // ④ Start 메뉴 닫기
      closeStartMenu();

      // ⑤ 메뉴 active 표시
      setActive("menu-home-btn");

      // ⑥ 로고 화면의 텍스트 갱신 (스크립트 재로드 없음)
      const { APPNAME, VERSION, SCHOOL } = globalThis.APP_CONFIG || {};

      const titleEl = document.getElementById("app-title");
      const verEl = document.getElementById("app-version");
      const schoolEl = document.getElementById("school-name");

      if (titleEl) titleEl.textContent = APPNAME || "앱명";
      if (verEl) verEl.textContent = VERSION || "";
      if (schoolEl) schoolEl.textContent = SCHOOL || "";

      console.log("✨ 홈 화면 텍스트 갱신 완료");
    });
  }

  // --------------------------------------------------------
  // 2️⃣ Start 메뉴 토글 기능
  // --------------------------------------------------------
  function setupStartMenuToggle() {
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");

    if (!toggleBtn || !startMenu) return;

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startMenu.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!startMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        startMenu.classList.remove("open");
      }
    });
  }

  // --------------------------------------------------------
  // 3️⃣ 초기화
  // --------------------------------------------------------
  function setup() {
    setupHomeButton();
    setupStartMenuToggle();
    console.log("✅ Navbar.setup() 완료");
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup };
})();
