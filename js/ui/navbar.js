// ================================================================
// /js/ui/navbar.js — 네비게이션 & Start 메뉴 제어 (정리/통합 버전)
// ================================================================
(function () {
  console.log("🧭 App.Navbar 모듈 로드됨");

  // ✅ 헬퍼 함수: 페이지 로드
  async function loadPage(htmlPath, callback) {
    await includeHTML(htmlPath, "form-container");
    if (typeof callback === "function") callback();
  }

  // ✅ Start 메뉴 토글 (햄버거 버튼)
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

  // ✅ Start 메뉴 닫기
  function closeStartMenu() {
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.classList.remove("open");
  }

  // ✅ active 상태 표시
  function setActive(id) {
    document.querySelectorAll(".nav-item, .menu-item").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  // ✅ 공통 페이지 이동 함수
  async function goToPage(id, htmlPath, onLoad) {
    document.body.classList.remove("home-active");
    console.log(`📄 페이지 이동: ${id} → ${htmlPath}`);
    await loadPage(htmlPath, onLoad);
    closeStartMenu();
    setActive(id);
  }

  // ✅ 메뉴 이벤트 연결
  function setupMenuNavigation() {
    // 1️⃣ 약품 관리
    const menuInventory = document.getElementById("menu-inventory-btn");
    if (menuInventory) {
      menuInventory.addEventListener("click", async () => {
        await goToPage("menu-inventory-btn", "pages/inventory-list.html", () => {
          App.Inventory?.loadList?.();
        });
      });
    }

    // 2️⃣ 시약장 관리
    const menuCabinet = document.getElementById("menu-cabinet-btn");
    if (menuCabinet) {
      menuCabinet.addEventListener("click", async () => {
        await goToPage("menu-cabinet-btn", "pages/cabinet-list.html", () => {
          App.Cabinet?.loadList?.();
        });
      });
    }

    // 3️⃣ 홈 화면
    const menuHome = document.getElementById("menu-home-btn");
    if (menuHome) {
      menuHome.addEventListener("click", async () => {
        document.body.classList.add("home-active");
        console.log("🏠 홈 화면 복귀 — 로고 표시됨");
        closeStartMenu();
        setActive("menu-home-btn");
      });
    }
  }

  // ✅ 초기화
  function setup() {
    setupStartMenuToggle();
    setupMenuNavigation();
    console.log("✅ Navbar.setup() 완료 — 약품 관리 연결 포함됨");
  }

  // ✅ 전역 등록
  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup, closeStartMenu, setActive };

  document.addEventListener("DOMContentLoaded", setup);
})();
