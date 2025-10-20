/* =================================================================
   ✅ navbar.js
   Material Symbols 기반 모바일 네비게이션 제어 스크립트
================================================================= */

// 메뉴 토글 및 외부 클릭 시 닫기
document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("menu-toggle-btn");
  const startMenu = document.getElementById("start-menu");

  if (menuButton && startMenu) {
    // 메뉴 열기/닫기
    menuButton.addEventListener("click", (e) => {
      e.preventDefault();
      startMenu.classList.toggle("visible");
    });

    // 외부 클릭 시 닫기
    document.addEventListener("click", (e) => {
      if (!startMenu.contains(e.target) && !menuButton.contains(e.target)) {
        startMenu.classList.remove("visible");
      }
    });
  }

  // active 상태 전환 로직
  const navItems = document.querySelectorAll(".navbar .nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      navItems.forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
    });
  });

  // 메뉴 항목 클릭 시 자동 닫기
  const menuItems = document.querySelectorAll(".start-menu-popup .menu-item");
  menuItems.forEach((menuItem) => {
    menuItem.addEventListener("click", () => {
      startMenu.classList.remove("visible");
    });
  });
});
