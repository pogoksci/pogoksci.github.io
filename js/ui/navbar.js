(function () {
  console.log("🧭 App.Navbar 모듈 로드됨");

  const getApp = () => globalThis.App || {};

  function closeStartMenu() {
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.classList.remove("open");
  }

  function setup() {
    console.log("🧭 Navbar.setup() 실행");

    // ----------------------
    // 📌 Start 메뉴 토글 버튼
    // ----------------------
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");

    if (toggleBtn && startMenu) {
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startMenu.classList.toggle("open");
      });
    }

    // ----------------------
    // 📌 홈 버튼 (Start 메뉴 내부)
    // ----------------------
    const menuHomeBtn = document.getElementById("menu-home");
    if (menuHomeBtn) {
      menuHomeBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        console.log("🏠 홈 버튼 클릭됨");

        // Start 메뉴 닫기
        closeStartMenu();

        // FAB 숨김
        getApp().Fab?.setVisibility(false);

        // form-container 비우기
        const container = document.getElementById("form-container");
        if (container) container.innerHTML = "";

        // 메인 화면 로드
        await App.Router.go("main");

        // 로고 화면 활성화
        document.body.classList.add("home-active");
        document.body.classList.remove("loaded");

        console.log("🏠 홈 화면으로 전환 완료");
      });
    }

    // ----------------------
    // 📌 시약장 설정 버튼
    // ----------------------
    const menuLocationBtn = document.getElementById("menu-location");
    if (menuLocationBtn) {
      menuLocationBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeStartMenu();
        App.Router.go("cabinets");
      });
    }

    // ----------------------
    // 📌 약품 관리
    // ----------------------
    const inventoryBtn = document.getElementById("nav-inventory");
    if (inventoryBtn) {
      inventoryBtn.addEventListener("click", (e) => {
        e.preventDefault();
        App.Router.go("inventory");
      });
    }

    console.log("✅ Navbar.setup() 완료");
  }

  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup };
})();
