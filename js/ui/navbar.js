// js/ui/navbar.js
(function () {
  function setupNavbar() {
    const menuBtn = document.getElementById("menu-toggle-btn");
    const startMenu = document.getElementById("start-menu");

    if (menuBtn && startMenu) {
      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startMenu.classList.toggle("visible");
      });
    } else {
      console.warn("⚠️ Navbar elements not found, retrying...");
      setTimeout(setupNavbar, 200); // ✅ 늦게 로드된 경우 자동 재시도
      return;
    }

    // 메뉴 선택 시 팝업 닫히도록 수정
    document.querySelectorAll("#start-menu .menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        startMenu.classList.remove("visible");

        const id = item.id;
        if (id === "menu-home") includeHTML("pages/main.html");
        if (id === "menu-location") includeHTML("pages/location-list.html");
        if (id === "menu-equipment") alert("교구/물품 설정 준비 중입니다.");
        if (id === "menu-lablog") alert("과학실 기록/예약 기능 준비 중입니다.");
      });
    });

    console.log("✅ Navbar setup complete");
  }

  window.setupNavbar = setupNavbar;
})();
