// ================================================================
// /js/ui/navbar.js — 네비게이션 & Start 메뉴 제어 (ID 정확 매칭, 단일 바인딩)
// ================================================================
(function () {
  console.log("🧭 App.Navbar 모듈 로드됨");

  // ---- 공통: 페이지 로드 헬퍼 ----
  async function loadPage(htmlPath, after) {
    if (typeof includeHTML === "function") {
      await includeHTML(htmlPath, "form-container");
    } else if (typeof App?.includeHTML === "function") {
      await App.includeHTML(htmlPath, "form-container");
    } else {
      console.warn("⚠️ includeHTML 함수가 없습니다.");
    }
    if (typeof after === "function") after();
  }

  // ---- Start 메뉴 열기/닫기 ----
  function setupStartMenuToggle() {
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");
    if (!toggleBtn || !startMenu) {
      console.warn("⚠️ Navbar: 메뉴 토글 요소를 찾을 수 없습니다.");
      return;
    }
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

  function closeStartMenu() {
    const startMenu = document.getElementById("start-menu");
    if (startMenu) startMenu.classList.remove("open");
  }

  function setActive(id) {
    document.querySelectorAll(".nav-item, .menu-item").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  // ---- 단일 바인딩: 정확한 ID들만 연결 ----
  function setupExactIdLinks() {
    // 1) Start 메뉴 안의 버튼들
    const menuInventory = document.getElementById("menu-inventory-btn");
    if (menuInventory) {
      menuInventory.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/inventory-list.html", () => App.Inventory?.loadList?.());
        closeStartMenu();
        setActive("menu-inventory-btn");
      });
    }

    const menuCabinet = document.getElementById("menu-cabinet-btn");
    if (menuCabinet) {
      menuCabinet.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/location-list.html", () => App.Cabinet?.loadList?.());
        closeStartMenu();
        setActive("menu-cabinet-btn");
      });
    }

    const menuHome = document.getElementById("menu-home");
    if (menuHome) {
      menuHome.addEventListener("click", (e) => {
        e.preventDefault();
        document.body.classList.add("home-active"); // 로고 화면
        document.body.classList.remove("loaded"); // 필요하면 유지, 아니면 빼도 됨

        // 2️⃣ form-container 비우기 (이전에 열려있던 페이지 흔적 제거)
        const container = document.getElementById("form-container");
        if (container) container.innerHTML = "";

        // 3️⃣ FAB 숨기기 (예: '새 시약장 등록' 버튼)
        if (globalThis.App && App.Fab && typeof App.Fab.setVisibility === "function") {
          App.Fab.setVisibility(false);
        }

        closeStartMenu();
        setActive("menu-home");
      });
    }

    // 2) 상단 Navbar 영역(정확 ID)
    const navInventory = document.getElementById("nav-inventory");
    if (navInventory) {
      navInventory.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/inventory-list.html", () => App.Inventory?.loadList?.());
        closeStartMenu();
        setActive("nav-inventory");
      });
    }

    const navUsage = document.getElementById("nav-usage");
    if (navUsage) {
      navUsage.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/inventory-list.html", () => App.Inventory?.loadList?.()); // 임시 동일 페이지
        closeStartMenu();
        setActive("nav-usage");
      });
    }

    const navWaste = document.getElementById("nav-waste");
    if (navWaste) {
      navWaste.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/inventory-list.html", () => App.Inventory?.loadList?.()); // 임시 동일 페이지
        closeStartMenu();
        setActive("nav-waste");
      });
    }

    const navKit = document.getElementById("nav-kit");
    if (navKit) {
      navKit.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/inventory-list.html", () => App.Inventory?.loadList?.()); // 임시 동일 페이지
        closeStartMenu();
        setActive("nav-kit");
      });
    }

    // 3) Start 메뉴의 기타 항목(정확 ID)
    const menuLocation = document.getElementById("menu-location");
    if (menuLocation) {
      menuLocation.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/location-list.html", () => App.Cabinet?.loadList?.());
        closeStartMenu();
        setActive("menu-location");
      });
    }

    const menuEquipment = document.getElementById("menu-equipment");
    if (menuEquipment) {
      menuEquipment.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/inventory-list.html", () => App.Inventory?.loadList?.()); // 임시
        closeStartMenu();
        setActive("menu-equipment");
      });
    }

    const menuLablog = document.getElementById("menu-lablog");
    if (menuLablog) {
      menuLablog.addEventListener("click", async (e) => {
        e.preventDefault();
        document.body.classList.remove("home-active");
        await loadPage("pages/inventory-list.html", () => App.Inventory?.loadList?.()); // 임시
        closeStartMenu();
        setActive("menu-lablog");
      });
    }
  }

  // ---- 초기화 ----
  function setup() {
    setupStartMenuToggle();
    setupExactIdLinks(); // ✅ 단일 바인딩 (정확 ID)
    console.log("✅ Navbar.setup() 완료 — 정확 ID 바인딩/Start 메뉴 토글");
  }

  // ---- 전역 등록 ----
  globalThis.App = globalThis.App || {};
  globalThis.App.Navbar = { setup, setActive, closeStartMenu };

  document.addEventListener("DOMContentLoaded", setup);
})();
