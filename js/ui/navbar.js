(function () {
  function setupNavbar() {
    const startMenu = document.getElementById("start-menu");
    const menuBtn   = document.getElementById("menu-toggle-btn");

    // 토글
    if (menuBtn && startMenu) {
      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startMenu.classList.toggle("visible");
      });
    }

    // 공통: 메뉴 닫기 함수
    const closeMenu = () => startMenu && startMenu.classList.remove("visible");

    // 약품 관리
    const navInventory = document.getElementById("nav-inventory");
    if (navInventory) {
      navInventory.addEventListener("click", (e) => {
        e.preventDefault();
        includeHTML("pages/inventory-list.html", "form-container", () => {
          if (typeof fetchInventoryAndRender === "function") fetchInventoryAndRender();
        });
        closeMenu(); // ← 여기!
      });
    }

    // 시약장 설정
    const navCabinet = document.getElementById("menu-location");
    if (navCabinet) {
      navCabinet.addEventListener("click", (e) => {
        e.preventDefault();
        includeHTML("pages/location-list.html", "form-container", () => {
          if (typeof loadCabinetList === "function") loadCabinetList();
        });
        closeMenu(); // ← 여기!
      });
    }

    // 홈
    const navHome = document.getElementById("menu-home");
    if (navHome) {
      navHome.addEventListener("click", (e) => {
        e.preventDefault();
        includeHTML("pages/main.html", "form-container");
        closeMenu(); // ← 여기!
      });
    }

    // 팝업 바깥 클릭 시 닫기
    document.addEventListener("click", (e) => {
      if (!startMenu) return;
      const clickedInside = startMenu.contains(e.target) || (menuBtn && menuBtn.contains(e.target));
      if (!clickedInside) startMenu.classList.remove("visible");
    });
  }

  globalThis.setupNavbar = setupNavbar; // deno-lint 회피
})();
