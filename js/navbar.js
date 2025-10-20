// navbar.js — Material Symbols + 모바일 UX 강화 버전
document.addEventListener("DOMContentLoaded", () => {
  const menuToggleBtn = document.getElementById("menu-toggle-btn");
  const startMenu = document.getElementById("start-menu");

  // ☰ 메뉴 열기/닫기
  if (menuToggleBtn) {
    menuToggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startMenu.classList.toggle("visible");
    });
  }

  // 🧪 약품 관리
  const navInventory = document.getElementById("nav-inventory");
  if (navInventory) {
    navInventory.addEventListener("click", async (e) => {
      e.preventDefault();
      startMenu.classList.remove("visible");
      await includeHTML("pages/inventory-list.html");
      if (typeof fetchInventoryAndRender === "function") {
        fetchInventoryAndRender();
      }
      highlightActiveNav(navInventory);
    });
  }

  // 🧫 시약장 설정
  const menuLocation = document.getElementById("menu-location");
  if (menuLocation) {
    menuLocation.addEventListener("click", async (e) => {
      e.preventDefault();
      startMenu.classList.remove("visible");
      await includeHTML("pages/location-list.html");
    });
  }

  // 🏠 홈
  const menuHome = document.getElementById("menu-home");
  if (menuHome) {
    menuHome.addEventListener("click", async (e) => {
      e.preventDefault();
      startMenu.classList.remove("visible");
      await includeHTML("pages/main.html");
    });
  }

  // 메뉴 외부 클릭 시 닫기
  document.addEventListener("click", (e) => {
    if (
      startMenu.classList.contains("visible") &&
      !startMenu.contains(e.target) &&
      e.target !== menuToggleBtn
    ) {
      startMenu.classList.remove("visible");
    }
  });
});

// ✅ 현재 활성화된 nav 표시
function highlightActiveNav(activeItem) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  activeItem.classList.add("active");
}
