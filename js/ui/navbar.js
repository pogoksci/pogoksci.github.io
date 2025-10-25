// ================================================================
// /js/ui/navbar.js — 네비게이션 & Start 메뉴 제어 (모든 항목 완전 대응)
// ================================================================
(function () {
  console.log("🧭 App.Navbar 모듈 로드됨");

  // ------------------------------------------------------------
  // 1️⃣ Start 메뉴 토글 (햄버거 버튼)
  // ------------------------------------------------------------
  function setupStartMenuToggle() {
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");

    if (!toggleBtn || !startMenu) {
      console.warn("⚠️ Navbar: 메뉴 토글 요소를 찾을 수 없습니다.");
      return;
    }

    // 메뉴 열기/닫기
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startMenu.classList.toggle("open");
    });

    // 메뉴 외부 클릭 시 닫기
    document.addEventListener("click", (e) => {
      if (!startMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        startMenu.classList.remove("open");
      }
    });
  }

  // ------------------------------------------------------------
  // 2️⃣ Navbar & Start 메뉴 항목 클릭 → Router 이동
  // ------------------------------------------------------------
  function setupNavLinks() {
    const links = [
      // 상단 Navbar 영역
      { id: "nav-inventory", route: "inventory" },
      { id: "nav-usage", route: "inventory" },
      { id: "nav-waste", route: "inventory" },
      { id: "nav-kit", route: "inventory" },

      // Start 메뉴 영역
      { id: "menu-location", route: "cabinets" },
      { id: "menu-equipment", route: "inventory" }, // 교구·물품 설정 → 임시 inventory로 연결
      { id: "menu-lablog", route: "inventory" }, // 과학실 기록·예약 → 임시 inventory로 연결
      { id: "menu-home", route: "main" },
    ];

    links.forEach(({ id, route }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", async (e) => {
          e.preventDefault();
          console.log(`➡️ Navbar 클릭: ${id} → ${route}`);

          // ✅ 시약장 설정 클릭 시 Cabinet 모듈 상태 점검
          if (id === "menu-location") {
            console.log("🧪 App.Cabinet:", App.Cabinet);
          }

          if (App.Router && typeof App.Router.go === "function") {
            await App.Router.go(route);
          } else {
            console.warn("⚠️ App.Router.go() 없음 — includeHTML 대체 실행");
            App.includeHTML(`pages/${route}.html`, "form-container");
          }

          closeStartMenu();
          setActive(id);
        });
      }
    });
  }

  // ------------------------------------------------------------
  // 3️⃣ active 상태 관리
  // ------------------------------------------------------------
  function setActive(id) {
    document.querySelectorAll(".nav-item, .menu-item").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  // ------------------------------------------------------------
  // 4️⃣ Start 메뉴 닫기
  // ------------------------------------------------------------
  function closeStartMenu() {
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.classList.remove("open");
  }

  // ------------------------------------------------------------
  // 5️⃣ setup() — Navbar 초기화 진입점
  // ------------------------------------------------------------
  function setup() {
    setupStartMenuToggle();
    setupNavLinks();
    console.log("✅ Navbar.setup() 완료 — 모든 메뉴 바인딩 완료");
  }

  // ------------------------------------------------------------
  // 6️⃣ 전역 등록
  // ------------------------------------------------------------
  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup, setActive, closeStartMenu };
})();
